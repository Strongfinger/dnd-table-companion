// The live lobby, shared by every screen (React context): one room connection for the whole app,
// so moving from the lobby to a sheet or the tracker doesn't disconnect.
// The room is saved in settings: after a reload, or the browser killing a sleeping tab, the app rejoins.
// (Test-mode rooms are saved per browser tab instead, since there each tab plays a different device.)
//
// Character sheets are synced here too (protocol in src/sync/sheets.ts). The DM device is the
// source of truth: it applies players' actions and sends its copy of every played character back.
// The running fight is sent to players too, as the secret-free player view ('fight' messages).
// Dice rolls are shared with everyone in the room; the DM device writes them into the fight log.
//
// Nothing gets lost or applied twice (4.5): a player's changes wait in a saved outbox until the DM's
// device confirms them ('ack'), and are re-sent until then; the DM's device saves the ids it has
// applied, so a re-sent change, or one replayed after a reload, is only confirmed again.
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { adoptCampaign, getCampaign } from '../db/campaigns'
import { deleteCharacter, getCharacter, saveReceivedCharacter, setCharacterCampaign, updateCharacter, watchCharacters } from '../db/characters'
import { currentDevice, getSetting, setSetting } from '../db/device'
import { getEncounter, watchPlayerFight } from '../db/encounters'
import { applyCharacterLog, logCharacterEvent, logSharedRoll, watchCharacterLogs, watchFightsForPlayers } from '../db/log'
import { logShortRestStart, playAction, restParty } from '../db/play'
import { advanceTurn } from '../db/turns'
import type { Character } from '../model/character'
import { checkIncomingLevel, lockLevel } from '../model/levelLock'
import { parsePlayerView, type PlayerEncounterView } from '../model/playerView'
import { parseRollEvent, rollEventText, type RollEvent } from '../model/rollEvent'
import { Deduper, makeEnvelope, RateLimiter, type Envelope } from '../sync/envelope'
import { cleanupOldMessages, firebaseTransport } from '../sync/firebaseTransport'
import { isDm, isKicked, parseKick, parseLobbySession, rollerName, type LobbySession } from '../sync/lobby'
import { localTransport } from '../sync/localTransport'
import { newRoomCode } from '../sync/roomCode'
import {
  applyLogMessage, fullLog, logDiff, parseFights, parseLogBody, type FightSummary, type LogTarget, type PlayerLogEntry,
} from '../sync/fights'
import { OUTBOX_LIMIT, outboxFor, parseAck, removeAcked, resendRound, type OutboxItem } from '../sync/outbox'
import { parseParty, partyCards, type PartyCard } from '../sync/party'
import {
  isEditHello, MAX_GRANTS, mayChange, mergeEdit, parseActionBody, parseControl, parseEndTurn, parseSheetBody, playedCharacterIds, takeDmState, takeIncomingSheet, takenBack,
} from '../sync/sheets'
import { LobbyContext, type LobbyApi, type RoomRoll } from './useLobby'
import type { ConnectionStatus, Member, RoomConnection } from '../sync/transport'

const SETTING = 'lobby'
/** Player: changes not yet confirmed by the DM's device. */
const OUTBOX = 'lobby-outbox'
/** DM: ids of players' changes and rolls already handled. */
const APPLIED = 'lobby-applied'
/** DM: the last room codes hosted on this device (their old messages are cleaned up). */
const HOSTED_ROOMS = 'lobby-hosted-rooms'
const RETRY_MS = 4000
/** Fight-log lines per message. */
const LOG_CHUNK = 100

/** Small saved values: in settings, or per browser tab in test mode (each tab is a device there). */
function store(key: string, value: unknown, local: boolean) {
  if (!local) return void setSetting(key, value)
  if (value == null) sessionStorage.removeItem(key)
  else sessionStorage.setItem(key, JSON.stringify(value))
}

async function load(key: string, local: boolean): Promise<unknown> {
  if (!local) return getSetting<unknown>(key)
  const v = sessionStorage.getItem(key)
  return v ? JSON.parse(v) : null
}

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
  const [fight, setFightState] = useState<PlayerEncounterView | null>(null)
  /** Player: the short rest the DM started (from 'rest' messages). The DM keeps it in the session. */
  const [restSince, setRestSince] = useState<number | null>(null)
  const fightRef = useRef<PlayerEncounterView | null>(null)
  const setFight = (f: PlayerEncounterView | null) => {
    fightRef.current = f
    setFightState(f)
  }
  const [rolls, setRolls] = useState<RoomRoll[]>([])
  /** Player: the DM's started fights and their player-safe logs. */
  const [fightList, setFightList] = useState<FightSummary[]>([])
  const [fightLogs, setFightLogs] = useState<Record<string, PlayerLogEntry[]>>({})
  /** Player: the party cards from the DM. DM: the cards last sent (JSON), to skip repeats and resend on (re)join. */
  const [party, setParty] = useState<PartyCard[]>([])
  const lastParty = useRef<string | null>(null)
  /** Player: extra characters the DM handed to this device ('control' messages). */
  const [controlled, setControlledState] = useState<string[]>([])
  const controlledRef = useRef<string[]>([])
  const setControlled = (ids: string[]) => {
    controlledRef.current = ids
    setControlledState(ids)
  }
  /** Player: every character this device plays in the room (picked + handed over). */
  const myIds = (s: LobbySession) => (s.role === 'player' ? [...(s.characterId ? [s.characterId] : []), ...controlledRef.current] : [])
  /** Player: the room's campaign (from the DM), so a character picked later joins it too. */
  const roomCampaign = useRef<string | null>(null)
  const [roomCampaignId, setRoomCampaignId] = useState<string | null>(null)
  /** DM: the fight list as last sent to players, and each log as last sent (fights' and played characters'). */
  const sentFights = useRef<FightSummary[] | null>(null)
  const sentLogs = useRef(new Map<string, { target: LogTarget; entries: PlayerLogEntry[] }>())
  const limiter = useRef(new RateLimiter())
  // Refs: the message handler below runs long after render, so it reads the latest values here.
  const conn = useRef<RoomConnection | null>(null)
  const sessionRef = useRef<LobbySession | null>(null)
  const membersRef = useRef<Member[]>([])
  const listeners = useRef(new Set<(e: Envelope) => void>())
  /** DM: the revision of each character last sent to the room, so each change goes out once. */
  const lastSent = useRef(new Map<string, number>())
  /** DM: the fight view last sent (as JSON), to skip repeats and to resend to players who (re)join. */
  const lastFight = useRef<string | null>(null)
  /** DM: players' changes and rolls already handled (saved, so a reload doesn't apply them again). */
  const applied = useRef(new Deduper(500))
  /** Player: changes waiting for the DM's 'ack' (saved), and their count for the screen. */
  const outbox = useRef<OutboxItem[]>([])
  const [pending, setPending] = useState(0)
  /** Player: send my full sheet once the outbox is empty (after connecting or picking a character). */
  const needHello = useRef(false)
  const statusRef = useRef<ConnectionStatus>('offline')
  /** Counts connects, so a slow load for an old connect can't start it after a newer one. */
  const connectRun = useRef(0)
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
    connectRun.current++
    conn.current?.leave()
    conn.current = null
    membersRef.current = []
    setMembers([])
    setFight(null)
    setRolls([])
    setFightList([])
    setFightLogs({})
    setParty([])
    setControlled([])
    setRestSince(null)
  }

  function onMessage(e: Envelope) {
    const s = sessionRef.current
    if (!s) return
    // The DM ignores devices it removed (the DM device is the source of truth).
    if (s.role === 'dm' && isKicked(s.kicked, e.from)) return
    // The DM's device protects itself from floods (players always take the DM's own messages).
    if (s.role === 'dm' && !limiter.current.allow(e.from)) {
      console.warn('lobby: too many messages, dropped one from', e.fromName)
      return
    }
    if (e.kind === 'roll') {
      onRoll(e, s)
      return
    }
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
    if (e.kind === 'ack' && s.role === 'player' && isDm(membersRef.current, e.from)) {
      const ids = parseAck(e.body)
      if (ids) setOutbox(removeAcked(outbox.current, ids), s)
      return
    }
    if (e.kind === 'fight' && s.role === 'player' && isDm(membersRef.current, e.from)) {
      const body = e.body as { view?: unknown } | null
      setFight(body?.view == null ? null : parsePlayerView(body.view))
    }
    // DM: a player (re)connected; give them the running fight, the fight list with logs, and the campaign.
    if (e.kind === 'hello' && s.role === 'dm' && !isEditHello(e.body)) void resyncPlayer(s, e.from)
    if (s.role === 'player' && isDm(membersRef.current, e.from)) onDmMessage(e, s)
    void syncSheet(e, s).catch((err) => console.error('lobby: sheet sync', err))
    listeners.current.forEach((listen) => listen(e))
  }

  /** DM: everything a (re)connecting player needs besides their sheet: fights, logs (full copies), campaign. */
  async function resyncPlayer(s: LobbySession, from: string) {
    if (lastFight.current !== null) send('fight', { view: JSON.parse(lastFight.current) })
    if (sentFights.current) send('fights', { fights: sentFights.current })
    const theirCharacter = membersRef.current.find((m) => m.deviceId === from)?.characterId
    const handedToThem = s.grants.filter((g) => g.deviceId === from).map((g) => g.characterId)
    send('control', { grants: s.grants })
    for (const id of handedToThem) {
      const c = await getCharacter(id)
      if (c) sendState(c)
    }
    for (const { target, entries } of sentLogs.current.values()) {
      if (target.kind === 'fight' || target.id === theirCharacter || handedToThem.includes(target.id)) send('log', { ...logKey(target), ...fullLog(entries) })
    }
    if (lastParty.current !== null) send('party', { cards: JSON.parse(lastParty.current) })
    send('rest', { since: sessionRef.current?.shortRestSince ?? null })
    const campaign = s.campaignId ? await getCampaign(s.campaignId) : undefined
    if (campaign) send('campaign', { id: campaign.id, name: campaign.name })
  }

  /** DM: characters played in the room right now. */
  const playedNow = () => {
    const s = sessionRef.current
    return s ? playedCharacterIds(membersRef.current, (id) => isKicked(s.kicked, id), s.grants) : []
  }

  const logKey = (t: LogTarget) => (t.kind === 'fight' ? { encounterId: t.id } : { characterId: t.id })

  /** DM: send what changed in a log since last time: new lines (in chunks, messages have a size limit) and deleted ones. */
  function syncLog(target: LogTarget, entries: PlayerLogEntry[]) {
    const key = `${target.kind}:${target.id}`
    const before = sentLogs.current.get(key)
    sentLogs.current.set(key, { target, entries })
    const { added, removed } = logDiff(new Map((before?.entries ?? []).map((e) => [e.id, e.at])), entries)
    if (removed.length) send('log', { ...logKey(target), entries: [], removed })
    for (let i = 0; i < added.length; i += LOG_CHUNK) send('log', { ...logKey(target), entries: added.slice(i, i + LOG_CHUNK) })
  }

  /** Player: the fight list, fight logs and campaign sent by the DM's device. */
  function onDmMessage(e: Envelope, s: LobbySession) {
    if (e.kind === 'fights') {
      const list = parseFights(e.body)
      if (!list) return
      setFightList(list)
      // Logs of fights the DM deleted go too.
      setFightLogs((old) => Object.fromEntries(Object.entries(old).filter(([id]) => list.some((f) => f.id === id))))
    } else if (e.kind === 'log') {
      const m = parseLogBody(e.body)
      if (m?.target.kind === 'fight') {
        const id = m.target.id
        setFightLogs((old) => ({ ...old, [id]: applyLogMessage(old[id] ?? [], m) }))
      } else if (m && myIds(s).includes(m.target.id)) {
        // My character's log follows the DM's (lines the DM deletes go away here too).
        void applyCharacterLog(m.target.id, m)
      }
    } else if (e.kind === 'control') {
      const me = deviceFor(s.local).id
      const ids = parseControl(e.body, me)
      if (!ids) return
      // The DM took some back: their copies leave this phone (also ones taken back while I was offline).
      const gone = takenBack(s.grants.map((g) => g.characterId), ids, s.characterId)
      setControlled(ids)
      save({ ...(sessionRef.current ?? s), grants: ids.map((characterId) => ({ characterId, deviceId: me })) })
      // Test mode: the tabs share one database with the DM's, so nothing is deleted there.
      if (!s.local) for (const id of gone) void deleteCharacter(id)
    } else if (e.kind === 'party') {
      const cards = parseParty(e.body)
      if (cards) setParty(cards)
    } else if (e.kind === 'rest') {
      const since = (e.body as { since?: unknown } | null)?.since
      setRestSince(Number.isFinite(since) ? (since as number) : null)
    } else if (e.kind === 'campaign') {
      const b = e.body as { id?: unknown; name?: unknown } | null
      if (typeof b?.id !== 'string' || b.id.length > 64 || typeof b.name !== 'string') return
      roomCampaign.current = b.id
      setRoomCampaignId(b.id)
      // The DM's campaign on this phone too, with my character in it (party overview, lists).
      void adoptCampaign(b.id, b.name, e.from).then(async () => {
        if (s.characterId) await setCharacterCampaign(s.characterId, b.id as string)
        await setSetting('currentCampaignId', b.id)
      })
    }
  }

  function addRoll(r: RoomRoll) {
    setRolls((old) => [r, ...old].slice(0, 30))
  }

  /** A roll from another device: named by the member list, shown, and (DM) logged in the fight. */
  function onRoll(e: Envelope, s: LobbySession) {
    const parsed = parseRollEvent(e.body)
    if (!parsed) return
    const roll = { ...parsed, by: rollerName(membersRef.current, e.from, e.fromName) }
    // DM: a roll replayed after a reload was already logged.
    if (s.role === 'dm' && !markApplied(e.id, s)) return
    addRoll({ id: e.id, at: e.at, roll, mine: false })
    if (s.role === 'dm') {
      const characterId = membersRef.current.find((m) => m.deviceId === e.from && m.role === 'player')?.characterId ?? null
      void logSharedRoll(rollEventText(roll), characterId, s.campaignId)
    }
  }

  function send(kind: Envelope['kind'], body: unknown) {
    const s = sessionRef.current
    if (s) conn.current?.send(makeEnvelope(kind, body, deviceFor(s.local)))
  }

  function sendState(c: Character) {
    lastSent.current.set(c.id, c.rev)
    send('state', { character: c })
  }

  /** DM: remember a handled id (saved). False if it was handled before. */
  function markApplied(id: string, s: LobbySession): boolean {
    if (!applied.current.firstTime(id)) return false
    store(APPLIED, { code: s.code, ids: applied.current.ids() }, s.local)
    return true
  }

  /** Player: replace the outbox (saved, and counted for the screen); send my sheet once it's empty. */
  function setOutbox(items: OutboxItem[], s: LobbySession) {
    outbox.current = items.slice(-OUTBOX_LIMIT)
    setPending(outbox.current.length)
    store(OUTBOX, { code: s.code, items: outbox.current }, s.local)
    maybeHello()
  }

  /** Player: send a change to the DM through the outbox (kept until confirmed). */
  function queue(kind: Envelope['kind'], body: unknown) {
    const s = sessionRef.current
    if (!s) return
    const envelope = makeEnvelope(kind, body, deviceFor(s.local))
    setOutbox([...outbox.current, { envelope, sentAt: Date.now(), tries: 0 }], s)
    conn.current?.send(envelope)
  }

  /**
   * Player: the plain full-sheet 'hello' goes out once nothing is pending, so it never
   * races changes still on their way (the DM could otherwise take the whole sheet and apply them twice).
   */
  function maybeHello() {
    const s = sessionRef.current
    if (!s || s.role !== 'player' || !s.characterId || !needHello.current) return
    if (outbox.current.length > 0 || statusRef.current !== 'connected') return
    needHello.current = false
    void getCharacter(s.characterId).then((c) => c && send('hello', { character: c }))
  }

  function onStatus(status: ConnectionStatus) {
    statusRef.current = status
    setStatus(status)
    if (status !== 'connected' || sessionRef.current?.role !== 'player') return
    // (Re)connected: send everything still pending now, then my sheet once it's confirmed.
    // (Next tick: a transport may report "connected" before join() has returned the connection.)
    setTimeout(() => {
      for (const item of outbox.current) conn.current?.send(item.envelope)
      needHello.current = true
      maybeHello()
    }, 0)
  }

  /**
   * Is the sender allowed to change this character? A player who just joined or picked a
   * character may not be in our member list yet, so wait a moment once before saying no.
   */
  async function allowed(senderId: string, characterId: string) {
    const grants = () => sessionRef.current?.grants ?? []
    if (mayChange(membersRef.current, senderId, characterId, grants())) return true
    await new Promise((r) => setTimeout(r, 1500))
    return mayChange(membersRef.current, senderId, characterId, grants())
  }

  /** Sheet messages (see src/sync/sheets.ts). */
  async function syncSheet(e: Envelope, s: LobbySession) {
    if (s.role === 'dm' && e.kind === 'hello' && isEditHello(e.body)) {
      // A player's edit-screen save: their build, our play state.
      const c = parseSheetBody(e.body)
      if (!c || !(await allowed(e.from, c.id))) return
      if (markApplied(e.id, s)) {
        const dm = await getCharacter(c.id)
        // Above the level the DM allowed (see model/levelLock.ts): refused, the phone gets our copy back.
        const checked = checkIncomingLevel(dm, c)
        if (!checked) sendState(dm!)
        else if (dm) await updateCharacter(c.id, (latest) => ({ character: mergeEdit(latest, checkIncomingLevel(latest, c) ?? latest), text: '' }))
        else await saveReceivedCharacter(checked, () => true, s.campaignId)
      }
      send('ack', { ids: [e.id] })
    } else if (s.role === 'dm' && e.kind === 'hello') {
      const c = parseSheetBody(e.body)
      if (!c || !(await allowed(e.from, c.id))) return
      const r = await saveReceivedCharacter(c, (stored) => takeIncomingSheet(stored, c), s.campaignId, (x, stored) => checkIncomingLevel(stored, x))
      // Taken: the watcher below sends it to the room. Kept ours: send it so the player catches up,
      // with the level lock on it if it had none yet (a character from before the lock, now played in a room).
      if (!r.saved && !r.stored.levelLock) await updateCharacter(c.id, (dm) => ({ character: lockLevel(dm), text: '' }))
      else if (!r.saved) sendState(r.stored)
    } else if (s.role === 'dm' && e.kind === 'action') {
      const a = parseActionBody(e.body)
      if (!a || !(await allowed(e.from, a.characterId))) return
      // Already applied (sent again, or replayed after a reload): just confirm it again.
      if (markApplied(e.id, s)) {
        // The same permissions as on the player's phone: a changed (or old) app can't give itself points back.
        const r = await playAction(a.characterId, a.action, 'player', { shortRest: !!sessionRef.current?.shortRestSince })
        if (r.refused) {
          const c = await getCharacter(a.characterId)
          if (c) sendState(c) // the phone goes back to the DM's copy
        } else if (r.text) await logCharacterEvent(a.characterId, r.text)
      }
      send('ack', { ids: [e.id] })
    } else if (s.role === 'dm' && e.kind === 'endTurn') {
      // A player ends their own turn: only if it really is their character's turn right now.
      const t = parseEndTurn(e.body)
      if (!t || !markApplied(e.id, s)) return
      const fight = await getEncounter(t.encounterId)
      const active = fight?.combatants.find((c) => c.id === t.combatantId)
      if (fight?.activeId !== t.combatantId || active?.kind !== 'pc' || !active.characterId) return
      if (!mayChange(membersRef.current, e.from, active.characterId, s.grants)) return
      await advanceTurn(t.encounterId, { activeId: t.combatantId, round: t.round })
    } else if (s.role === 'player' && e.kind === 'state' && isDm(membersRef.current, e.from)) {
      const c = parseSheetBody(e.body)
      if (c && myIds(s).includes(c.id)) await saveReceivedCharacter(c, (stored) => takeDmState(stored, c), roomCampaign.current)
    }
  }

  function connect(session: LobbySession) {
    disconnect()
    const s = { ...session, local: session.local || !online }
    const run = connectRun.current
    lastSent.current.clear()
    lastFight.current = null
    lastParty.current = null
    sentFights.current = null
    sentLogs.current = new Map()
    roomCampaign.current = null
    setRoomCampaignId(null)
    // Player: the characters the DM handed to this phone (saved, so a reload still knows them).
    if (s.role === 'player') setControlled(s.grants.map((g) => g.characterId))
    needHello.current = false
    save(s)
    setKickedNotice(null)
    // Load what was saved for this room (outbox / handled ids) before any message can arrive.
    void Promise.all([load(OUTBOX, s.local), load(APPLIED, s.local)]).then(([savedOutbox, savedApplied]) => {
      if (run !== connectRun.current) return // left or reconnected meanwhile
      outbox.current = outboxFor(savedOutbox, s.code)
      setPending(outbox.current.length)
      const a = savedApplied as { code?: string; ids?: unknown } | null
      applied.current = new Deduper(500, a?.code === s.code && Array.isArray(a.ids) ? a.ids.filter((x): x is string => typeof x === 'string') : [])
      join(s)
    })
  }

  function join(s: LobbySession) {
    const transport = s.local ? localTransport() : online!
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
      onStatus,
    })
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

  // DM (online): clear old messages from this room and the last rooms hosted here, now and every 15 minutes.
  const hostingCode = session?.role === 'dm' && !session.local ? session.code : null
  useEffect(() => {
    if (!hostingCode) return
    const run = async () => {
      const previous = (await getSetting<string[]>(HOSTED_ROOMS)) ?? []
      const codes = [hostingCode, ...previous.filter((c) => c !== hostingCode)].slice(0, 5)
      await setSetting(HOSTED_ROOMS, codes)
      const removed = await cleanupOldMessages(codes)
      if (removed) console.info(`lobby: removed ${removed} old room message(s)`)
    }
    void run()
    const timer = setInterval(() => void run(), 15 * 60 * 1000)
    return () => clearInterval(timer)
  }, [hostingCode])

  // Player: re-send unconfirmed changes every few seconds while connected.
  const isPlayer = session?.role === 'player'
  useEffect(() => {
    if (!isPlayer) return
    const timer = setInterval(() => {
      const s = sessionRef.current
      if (!s || statusRef.current !== 'connected' || outbox.current.length === 0) return
      const round = resendRound(outbox.current, Date.now(), RETRY_MS)
      for (const item of round.send) conn.current?.send(item.envelope)
      if (round.dropped) console.warn(`lobby: gave up ${round.dropped} change(s) the DM's device never confirmed`)
      setOutbox(round.items, s)
    }, RETRY_MS)
    return () => clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reads refs
  }, [isPlayer])

  // DM: whenever a played character changes on this device (a player's action, the tracker,
  // an edit), send the new copy to the room.
  const played = session?.role === 'dm' ? playedCharacterIds(members, (id) => isKicked(session.kicked, id), session.grants).join(',') : ''
  useEffect(() => {
    if (!played) {
      // Nobody plays a character any more: clear the party cards on phones too.
      if (lastParty.current !== null && lastParty.current !== '[]') {
        lastParty.current = '[]'
        send('party', { cards: [] })
      }
      return
    }
    return watchCharacters(played.split(','), (list) => {
      for (const c of list) if (lastSent.current.get(c.id) !== c.rev) sendState(c)
      // Everyone's read-only party cards (only when one of them changed).
      const json = JSON.stringify(partyCards(list))
      if (json !== lastParty.current) {
        lastParty.current = json
        send('party', { cards: JSON.parse(json) })
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- sendState reads refs
  }, [played])

  const dmCampaign = session?.role === 'dm' ? session.campaignId ?? '' : null

  // DM: send the list of started fights and their new player-safe log lines whenever they change.
  useEffect(() => {
    if (dmCampaign === null) return
    return watchFightsForPlayers(dmCampaign || null, (v) => {
      if (JSON.stringify(v.fights) !== JSON.stringify(sentFights.current)) send('fights', { fights: v.fights })
      sentFights.current = v.fights
      for (const [id, entries] of Object.entries(v.logs)) syncLog({ kind: 'fight', id }, entries)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send reads refs
  }, [dmCampaign])

  // DM: each played character's log goes to the room too (the player's phone keeps it in step).
  useEffect(() => {
    if (!played) return
    return watchCharacterLogs(played.split(','), (logs) => {
      for (const [id, entries] of Object.entries(logs)) syncLog({ kind: 'character', id }, entries)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps -- send reads refs
  }, [played])

  // DM: send what players see of the running fight whenever it changes (turns, rounds, HP...).
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
    return !!s && myIds(s).includes(characterId)
  }

  const api: LobbyApi = {
    session,
    status,
    members,
    me: deviceFor(session?.local ?? false),
    onlineAvailable: !!online,
    kickedNotice,
    fight,
    rolls,
    pending,
    shortRestSince: session?.role === 'dm' ? session.shortRestSince : restSince,
    startShortRest: async () => {
      const s = sessionRef.current
      if (s?.role !== 'dm' || s.shortRestSince) return
      const since = Date.now()
      save({ ...s, shortRestSince: since })
      send('rest', { since })
      await logShortRestStart(playedNow())
    },
    endShortRest: async () => {
      const s = sessionRef.current
      if (s?.role !== 'dm') return { rested: [], skipped: [] }
      // End it first, so Hit Dice still on their way are refused rather than counted after the rest.
      save({ ...s, shortRestSince: null })
      send('rest', { since: null })
      return restParty(playedNow(), 'shortRest')
    },
    fightList,
    fightLogs,
    party,
    myCharacterIds: session?.role === 'player' ? [...(session.characterId ? [session.characterId] : []), ...controlled] : [],
    grant: (characterId, deviceId) => {
      const s = sessionRef.current
      if (s?.role !== 'dm') return
      const grants = [...s.grants.filter((g) => g.characterId !== characterId), ...(deviceId ? [{ characterId, deviceId }] : [])].slice(-MAX_GRANTS)
      save({ ...s, grants })
      // A newly handed-over character's sheet goes out from the played-characters watcher.
      lastSent.current.delete(characterId)
      send('control', { grants })
    },
    campaignId: session?.role === 'dm' ? session.campaignId : session ? roomCampaignId : null,
    create: (campaignId, local) =>
      connect({ code: newRoomCode(), role: 'dm', campaignId, characterId: null, characterName: null, local, kicked: [], shortRestSince: null, grants: [] }),
    setCampaign: async (campaignId) => {
      const s = sessionRef.current
      if (s?.role !== 'dm' || s.campaignId === campaignId) return
      const campaign = await getCampaign(campaignId)
      if (!campaign) return
      // The fight and log watchers restart for the new campaign (they depend on session.campaignId).
      lastFight.current = null
      save({ ...s, campaignId })
      // The characters played right now belong to the new campaign too (party overview, lists).
      for (const id of playedNow()) await setCharacterCampaign(id, campaignId)
      send('campaign', { id: campaign.id, name: campaign.name })
    },
    join: (code, character, local) =>
      connect({ code, role: 'player', campaignId: null, characterId: character?.id ?? null, characterName: character?.name ?? null, local, kicked: [], shortRestSince: null, grants: [] }),
    leave: () => {
      const s = sessionRef.current
      // Player: handed-over characters belong to the DM; their copies leave with me (they come back on rejoin).
      if (s?.role === 'player' && !s.local) for (const id of takenBack(s.grants.map((g) => g.characterId), [], s.characterId)) void deleteCharacter(id)
      disconnect()
      if (s) {
        store(OUTBOX, null, s.local)
        store(APPLIED, null, s.local)
      }
      outbox.current = []
      setPending(0)
      save(null)
      onStatus('offline')
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
      if (character && roomCampaign.current) void setCharacterCampaign(character.id, roomCampaign.current)
      needHello.current = true
      maybeHello()
    },
    shareAction: (characterId, action) => {
      if (mine(characterId)) queue('action', { characterId, action })
    },
    shareSheet: (characterId) => {
      if (mine(characterId)) void getCharacter(characterId).then((c) => c && queue('hello', { character: c, edit: true }))
    },
    shareRoll: (r) => {
      const s = sessionRef.current
      if (!s) return
      const me = deviceFor(s.local)
      const roll: RollEvent = { ...r, type: 'roll', by: s.role === 'dm' ? 'DM' : (s.characterName || me.name).slice(0, 60) }
      const envelope = makeEnvelope('roll', roll, me)
      conn.current?.send(envelope)
      addRoll({ id: envelope.id, at: envelope.at, roll, mine: true })
      // The DM's shared rolls go into the fight log too, like the players'.
      if (s.role === 'dm') void logSharedRoll(rollEventText(roll), null, s.campaignId)
    },
    endTurn: () => {
      const s = sessionRef.current
      const f = fightRef.current
      const me = s && f?.combatants.find((c) => c.active && !!c.pc && myIds(s).includes(c.pc.characterId))
      if (s?.role === 'player' && f && me) send('endTurn', { encounterId: f.id, round: f.round, combatantId: me.id })
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
