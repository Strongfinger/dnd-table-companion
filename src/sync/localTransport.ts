// A lobby connection between browser tabs on THIS computer (BroadcastChannel).
// For testing the lobby without internet: open two tabs, one as DM, one as a player.
// Same RoomTransport interface as the real Firebase connection.
import { Deduper, parseEnvelope, type Envelope } from './envelope'
import type { Me, Member, RoomConnection, RoomHandlers, RoomTransport } from './transport'

type Wire =
  | { type: 'presence'; member: Omit<Member, 'online'> }
  | { type: 'bye'; deviceId: string }
  | { type: 'msg'; from: { id: string; name: string }; envelope: Envelope }

export function localTransport(options: { heartbeatMs?: number; timeoutMs?: number } = {}): RoomTransport {
  const heartbeatMs = options.heartbeatMs ?? 2000
  const timeoutMs = options.timeoutMs ?? 6000

  return {
    label: 'ทดสอบในเครื่อง (หลายแท็บ)',
    join(code: string, me: Me, handlers: RoomHandlers): RoomConnection {
      const channel = new BroadcastChannel(`dnd-room-${code}`)
      const dedupe = new Deduper()
      const lastSeen = new Map<string, { member: Omit<Member, 'online'>; at: number }>()
      let self: Omit<Member, 'online'> = { deviceId: me.id, name: me.name, role: me.role, characterId: me.characterId }

      const publishMembers = () => {
        const now = Date.now()
        const others = [...lastSeen.values()].map(({ member, at }) => ({ ...member, online: now - at < timeoutMs }))
        handlers.onMembers([{ ...self, online: true }, ...others])
      }
      const announce = () => channel.postMessage({ type: 'presence', member: self } satisfies Wire)

      channel.onmessage = (ev: MessageEvent<Wire>) => {
        const w = ev.data
        if (!w || typeof w !== 'object') return
        if (w.type === 'presence' && w.member?.deviceId && w.member.deviceId !== me.id) {
          const isNew = !lastSeen.has(w.member.deviceId)
          lastSeen.set(w.member.deviceId, { member: w.member, at: Date.now() })
          if (isNew) announce() // say hello back so the newcomer sees us right away
          publishMembers()
        } else if (w.type === 'bye') {
          lastSeen.delete(w.deviceId)
          publishMembers()
        } else if (w.type === 'msg') {
          // The "connection" (the channel wrapper) says who sent it; the message can't claim otherwise.
          const r = parseEnvelope(w.envelope, w.from)
          if (r.ok && r.envelope.from !== me.id && dedupe.firstTime(r.envelope.id)) handlers.onMessage(r.envelope)
        }
      }

      handlers.onStatus('connected')
      announce()
      publishMembers()
      const beat = setInterval(() => {
        announce()
        publishMembers() // also notices members that went quiet
      }, heartbeatMs)

      return {
        code,
        send: (envelope) => channel.postMessage({ type: 'msg', from: { id: me.id, name: self.name }, envelope } satisfies Wire),
        updateMe: (patch) => {
          self = { ...self, ...patch }
          announce()
          publishMembers()
        },
        leave: () => {
          clearInterval(beat)
          channel.postMessage({ type: 'bye', deviceId: me.id } satisfies Wire)
          channel.close()
          handlers.onStatus('offline')
        },
      }
    },
  }
}
