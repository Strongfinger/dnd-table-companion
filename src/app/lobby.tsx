// The live lobby, shared by every screen (React context): one room connection for the whole app,
// so moving from the lobby to a sheet or the tracker doesn't disconnect.
// The room is saved in settings: after a reload, or the browser killing a sleeping tab, the app rejoins.
// (Test-mode rooms are saved per browser tab instead, since there each tab plays a different device.)
//
// Character sheets are synced here too (protocol in src/sync/sheets.ts). The DM device is the
// source of truth: it applies players' actions and sends its copy of every played character back.
// The running fight is sent to players too, as the secret-free player view ('fight' messages).
// Later steps (dice log) use `send` and `subscribe` from here.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { getCharacter, saveReceivedCharacter, updateCharacter, watchCharacters } from '../db/characters'
import { currentDevice, getSetting, setSetting } from '../db/device'
import { watchPlayerFight } from '../db/encounters'
import { logCharacterEvent } from '../db/log'
import type { Character } from '../model/character'
import { applyCharacterAction } from '../model/characterActions'
import { parsePlayerView, type PlayerEncounterView } from '../model/playerView'
import { makeEnvelope, type Envelope } from '../sync/envelope'
import { firebaseTransport } from '../sync/firebaseTransport'
import { isDm, isKicked, parseKick, parseLobbySession, type LobbySession } from '../sync/lobby'
import { localTransport } from '../sync/localTransport'
import { newRoomCode } from '../sync/roomCode'
import { mayChange, parseActionBody, parseSheetBody, playedCharacterIds, takeDmState, takeIncomingSheet } from '../sync/sheets'
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
  const [fight, setFight] = useState<PlayerEncounterView | null>(null)
  // Refs: the message handler below runs long after render, so it reads the latest values here.
  const conn = useRef<RoomConnection | null>(null)
  const sessionRef = useRef<LobbySession | null>(null)
  const membersRef = useRef<Member[]>([])
  const listeners = useRef(new Set<(e: Envelope) => void>())
  /** DM: the revision of each character last sent to the room, so each change goes out once. */
  const lastSent = useRef(new Map<string, number>())
  /** DM: the fight view last sent (as JSON), to skip repeats and to resend to players who (re)join. */
  const lastFight = useRef<string | null>(null)
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
    setFight(null)
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
    if (e.kind === 'fight' && s.role === 'player' && isDm(membersRef.current, e.from)) {
      const body = e.body as { view?: unknown } | null
      setFight(body?.view == null ? null : parsePlayerView(body.view))
    }
    // DM: a player (re)connected; give them the running fight too.
    if (e.kind === 'hello' && s.role === 'dm' && lastFight.current !== null) send('fight', { view: JSON.parse(lastFight.current) })
    void syncSheet(e, s).catch((err) => console.error('lobby: sheet sync', err))
    listeners.current.forEach((listen) => listen(e))
  }

  function send(kind: Envelope['kind'], body: unknown) {
    const s = sessionRef.current
    if (s) conn.current?.send(makeEnvelope(kind, body, deviceFor(s.local)))
  }

  function sendState(c: Character) {
    lastSent.current.set(c.id, c.rev)
    send('state', { character: c })
  }

  async function sendHello(characterId: string) {
    const c = await getCharacter(characterId)
    if (c) send('hello', { character: c })
  }

  /**
   * Is the sender allowed to change this character? A player who just joined or picked a
   * character may not be in our member list yet, so wait a moment once before saying no.
   */
  async function allowed(senderId: string, characterId: string) {
    if (mayChange(membersRef.current, senderId, characterId)) return true
    await new Promise((r) => setTimeout(r, 1500))
    return mayChange(membersRef.current, senderId, characterId)
  }

  /** Sheet messages (see src/sync/sheets.ts). */
  async function syncSheet(e: Envelope, s: LobbySession) {
    if (s.role === 'dm' && e.kind === 'hello') {
      const c = parseSheetBody(e.body)
      if (!c || !(await allowed(e.from, c.id))) return
      const r = await saveReceivedCharacter(c, (stored) => takeIncomingSheet(stored, c), s.campaignId)
      // Taken: the watcher below sends it to the room. Kept ours: send it so the player catches up.
      if (!r.saved) sendState(r.stored)
    } else if (s.role === 'dm' && e.kind === 'action') {
      const a = parseActionBody(e.body)
      if (!a || !(await allowed(e.from, a.characterId))) return
      const text = await updateCharacter(a.characterId, (ch) => applyCharacterAction(ch, a.action) ?? { character: ch, text: '' })
      if (text) await logCharacterEvent(a.characterId, text)
    } else if (s.role === 'player' && e.kind === 'state' && isDm(membersRef.current, e.from)) {
      const c = parseSheetBody(e.body)
      if (c && c.id === s.characterId) await saveReceivedCharacter(c, (stored) => takeDmState(stored, c))
    }
  }

  function connect(s: LobbySession) {
    disconnect()
    lastSent.current.clear()
    lastFight.current = null
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

  // Player: send my sheet whenever I'm (re)connected or pick a character, so the DM has my latest.
  const myCharacter = session?.role === 'player' ? session.characterId : null
  useEffect(() => {
    if (myCharacter && status === 'connected') void sendHello(myCharacter)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendHello reads refs
  }, [myCharacter, status])

  // DM: whenever a played character changes on this device (a player's action, the tracker,
  // an edit), send the new copy to the room.
  const played = session?.role === 'dm' ? playedCharacterIds(members, (id) => isKicked(session.kicked, id)).join(',') : ''
  useEffect(() => {
    if (!played) return
    return watchCharacters(played.split(','), (list) => {
      for (const c of list) if (lastSent.current.get(c.id) !== c.rev) sendState(c)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendState reads refs
  }, [played])

  // DM: send what players see of the running fight whenever it changes (turns, rounds, HP...).
  const dmCampaign = session?.role === 'dm' ? session.campaignId ?? '' : null
  useEffect(() => {
    if (dmCampaign === null) return
    return watchPlayerFight(dmCampaign || null, (view) => {
      const json = JSON.stringify(view)
      if (json === lastFight.current) return
      lastFight.current = json
      send('fight', { view })
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send reads refs
  }, [dmCampaign])

  const mine = (characterId: string) => {
    const s = sessionRef.current
    return s?.role === 'player' && s.characterId === characterId
  }

  const api: LobbyApi = {
    session,
    status,
    members,
    me: deviceFor(session?.local ?? false),
    onlineAvailable: !!online,
    kickedNotice,
    fight,
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
    shareAction: (characterId, action) => {
      if (mine(characterId)) send('action', { characterId, action })
    },
    shareSheet: (characterId) => {
      if (mine(characterId)) void sendHello(characterId)
    },
    send,
    subscribe: (listener) => {
      listeners.current.add(listener)
      return () => {
        listeners.current.delete(listener)
      }
    },
  }

  return <LobbyContext.Provider value={api}>{children}</LobbyContext.Provider>
}
