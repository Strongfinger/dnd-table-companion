// The live lobby, shared by every screen (React context): one room connection for the whole app,
// so moving from the lobby to a sheet or the tracker doesn't disconnect.
// The room is saved in settings: after a reload, or the browser killing a sleeping tab, the app rejoins.
// (Test-mode rooms are saved per browser tab instead, since there each tab plays a different device.)
//
// Later steps (sheet sync, initiative, dice log) use `send` and `subscribe` from here.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { currentDevice, getSetting, setSetting } from '../db/device'
import { makeEnvelope, type Envelope } from '../sync/envelope'
import { firebaseTransport } from '../sync/firebaseTransport'
import { isDm, isKicked, parseKick, parseLobbySession, type LobbySession } from '../sync/lobby'
import { localTransport } from '../sync/localTransport'
import { newRoomCode } from '../sync/roomCode'
import { LobbyContext, type LobbyApi } from './useLobby'
import type { ConnectionStatus, Member, RoomConnection } from '../sync/transport'

const SETTING = 'lobby'

/** In test mode two tabs of one browser must look like two devices, so each tab gets its own id. */
function tabDevice(base: { id: string; name: string }) {
  let tab = sessionStorage.getItem('lobby-tab')
  if (!tab) {
    tab = Math.random().toString(36).slice(2, 6)
    sessionStorage.setItem('lobby-tab', tab)
  }
  return { id: `${base.id}-tab-${tab}`, name: `${base.name} (แท็บ ${tab})` }
}

function deviceFor(local: boolean) {
  const device = currentDevice() ?? { id: 'unknown', name: 'อุปกรณ์' }
  return local ? tabDevice(device) : device
}

export function LobbyProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<LobbySession | null>(null)
  const [status, setStatus] = useState<ConnectionStatus>('offline')
  const [members, setMembers] = useState<Member[]>([])
  const [kickedNotice, setKickedNotice] = useState<string | null>(null)
  // Refs: the message handler below runs long after render, so it reads the latest values here.
  const conn = useRef<RoomConnection | null>(null)
  const sessionRef = useRef<LobbySession | null>(null)
  const membersRef = useRef<Member[]>([])
  const listeners = useRef(new Set<(e: Envelope) => void>())
  const online = firebaseTransport()

  /** Remember the session (state for the screen, ref for handlers, settings for a reload). */
  function save(s: LobbySession | null) {
    sessionRef.current = s
    setSession(s)
    if (s?.local) {
      sessionStorage.setItem(SETTING, JSON.stringify(s))
    } else {
      sessionStorage.removeItem(SETTING)
      void setSetting(SETTING, s)
    }
  }

  function disconnect() {
    conn.current?.leave()
    conn.current = null
    membersRef.current = []
    setMembers([])
  }

  function onMessage(e: Envelope) {
    const s = sessionRef.current
    if (!s) return
    // The DM ignores devices it removed (the DM device is the source of truth).
    if (s.role === 'dm' && isKicked(s.kicked, e.from)) return
    if (e.kind === 'kick') {
      const kick = parseKick(e.body)
      // Only the DM may remove someone, and only this device reacts to its own kick.
      if (kick?.deviceId === deviceFor(s.local).id && isDm(membersRef.current, e.from)) {
        disconnect()
        save(null)
        setKickedNotice(`${e.fromName} (DM) นำคุณออกจากห้อง ${s.code}`)
      }
      return
    }
    listeners.current.forEach((listen) => listen(e))
  }

  function connect(s: LobbySession) {
    disconnect()
    const transport = s.local || !online ? localTransport() : online
    const me = deviceFor(s.local)
    conn.current = transport.join(s.code, { id: me.id, name: me.name, role: s.role, characterId: s.characterId, characterName: s.characterName }, {
      onMessage,
      onMembers: (list) => {
        // DM: a removed player who comes back online (e.g. typed the code again) is removed again.
        const s = sessionRef.current
        if (s?.role === 'dm') {
          for (const m of list) {
            const wasOnline = membersRef.current.some((old) => old.deviceId === m.deviceId && old.online)
            if (isKicked(s.kicked, m.deviceId) && m.online && !wasOnline) conn.current?.send(makeEnvelope('kick', { deviceId: m.deviceId }, me))
          }
        }
        membersRef.current = list
        setMembers(list)
      },
      onStatus: setStatus,
    })
    save({ ...s, local: s.local || !online })
    setKickedNotice(null)
  }

  // Rejoin the saved room when the app starts.
  useEffect(() => {
    let cancelled = false
    const tabSaved = sessionStorage.getItem(SETTING)
    ;(tabSaved ? Promise.resolve(JSON.parse(tabSaved) as unknown) : getSetting<unknown>(SETTING)).then((saved) => {
      const s = parseLobbySession(saved)
      if (s && !cancelled) connect(s)
    })
    return () => {
      cancelled = true
      disconnect()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on start
  }, [])

  const api: LobbyApi = {
    session,
    status,
    members,
    me: deviceFor(session?.local ?? false),
    onlineAvailable: !!online,
    kickedNotice,
    create: (campaignId, local) =>
      connect({ code: newRoomCode(), role: 'dm', campaignId, characterId: null, characterName: null, local, kicked: [] }),
    join: (code, character, local) =>
      connect({ code, role: 'player', campaignId: null, characterId: character?.id ?? null, characterName: character?.name ?? null, local, kicked: [] }),
    leave: () => {
      disconnect()
      save(null)
      setStatus('offline')
    },
    kick: (deviceId) => {
      const s = sessionRef.current
      if (!s || s.role !== 'dm' || isKicked(s.kicked, deviceId)) return
      conn.current?.send(makeEnvelope('kick', { deviceId }, deviceFor(s.local)))
      const name = membersRef.current.find((m) => m.deviceId === deviceId)?.name ?? ''
      save({ ...s, kicked: [...s.kicked, { deviceId, name }] })
    },
    readmit: (deviceId) => {
      const s = sessionRef.current
      if (s) save({ ...s, kicked: s.kicked.filter((k) => k.deviceId !== deviceId) })
    },
    pickCharacter: (character) => {
      const s = sessionRef.current
      if (!s) return
      const patch = { characterId: character?.id ?? null, characterName: character?.name ?? null }
      conn.current?.updateMe(patch)
      save({ ...s, ...patch })
    },
    send: (kind, body) => {
      const s = sessionRef.current
      if (s) conn.current?.send(makeEnvelope(kind, body, deviceFor(s.local)))
    },
    subscribe: (listener) => {
      listeners.current.add(listener)
      return () => {
        listeners.current.delete(listener)
      }
    },
  }

  return <LobbyContext.Provider value={api}>{children}</LobbyContext.Provider>
}
