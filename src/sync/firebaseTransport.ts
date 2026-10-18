// The real lobby connection: Firebase Realtime Database (free Spark plan).
//
// Layout (protected by database.rules.json in the repo):
//   rooms/{code}/members/{uid}   who is in the room (uid = anonymous sign-in id)
//   rooms/{code}/messages/{id}   { fromUid, at, json }  (json = the Envelope as text)
// The sender of a message is the member record of `fromUid` (checked by the rules),
// never what the message claims.
//
// Firebase is loaded only when a lobby is joined, so the rest of the app stays small.
import { Deduper, parseEnvelope, type Envelope } from './envelope'
import type { Me, Member, RoomConnection, RoomHandlers, RoomTransport } from './transport'

/** The public (publishable) web config from .env.local / Vercel. Null if not set up yet. */
export function firebaseConfig() {
  const env = import.meta.env
  const config = {
    apiKey: env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    databaseURL: env.VITE_FIREBASE_DATABASE_URL as string | undefined,
    projectId: env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    appId: env.VITE_FIREBASE_APP_ID as string | undefined,
  }
  return config.apiKey && config.databaseURL && config.projectId ? config : null
}

export function firebaseTransport(): RoomTransport | null {
  const config = firebaseConfig()
  if (!config) return null
  return {
    label: 'ออนไลน์ (Firebase)',
    join(code: string, me: Me, handlers: RoomHandlers): RoomConnection {
      let closed = false
      let self: Omit<Member, 'online'> = { deviceId: me.id, name: me.name, role: me.role, characterId: me.characterId, characterName: me.characterName }
      const queue: Envelope[] = []
      let sendNow: ((e: Envelope) => void) | null = null
      let updateSelf: (() => void) | null = null
      let goOffline: ((forget: boolean) => void) | null = null
      const cleanups: (() => void)[] = []
      handlers.onStatus('connecting')

      ;(async () => {
        const [{ initializeApp, getApps }, auth, db] = await Promise.all([
          import('firebase/app'), import('firebase/auth'), import('firebase/database'),
        ])
        const app = getApps()[0] ?? initializeApp(config)
        const user = (await auth.signInAnonymously(auth.getAuth(app))).user
        if (closed) return
        const database = db.getDatabase(app)
        const room = `rooms/${code}`
        const memberRef = db.ref(database, `${room}/members/${user.uid}`)
        const memberData = () => ({ ...self, online: true, lastSeen: db.serverTimestamp() })
        // Declared up front: the connection callback below uses them.
        const byUid = new Map<string, { id: string; name: string }>()
        const dedupe = new Deduper()
        const joinedAt = Date.now() - 5000
        let listening = false

        // Presence: write myself; Firebase marks me offline by itself if the connection drops.
        const connectedRef = db.ref(database, '.info/connected')
        cleanups.push(db.onValue(connectedRef, async (snap) => {
          if (snap.val() === true) {
            try {
              // Write my member record FIRST: the security rules check the "mark me offline
              // when I disconnect" instruction against the record, so it must already exist.
              await db.set(memberRef, memberData())
              await db.onDisconnect(memberRef).update({ online: false, lastSeen: db.serverTimestamp() })
              // Only members may read messages, so start listening once I'm a member.
              listenForMessages()
              handlers.onStatus('connected')
              // Anything sent while offline goes out now.
              while (queue.length) sendNow?.(queue.shift()!)
            } catch (err) {
              console.error('lobby: could not join room', err)
              handlers.onStatus('offline')
            }
          } else {
            handlers.onStatus('reconnecting')
          }
        }))
        updateSelf = () => void db.update(memberRef, { ...self, lastSeen: db.serverTimestamp() })

        // Members: also remembers uid → device (byUid) so we know who sent each message.
        cleanups.push(db.onValue(db.ref(database, `${room}/members`), (snap) => {
          const list: Member[] = []
          byUid.clear()
          snap.forEach((child) => {
            const m = child.val() as Member
            if (typeof m?.deviceId !== 'string' || typeof m?.name !== 'string') return
            byUid.set(child.key!, { id: m.deviceId, name: m.name.slice(0, 40) })
            list.push({ deviceId: m.deviceId, name: m.name, role: m.role === 'dm' ? 'dm' : 'player', characterId: typeof m.characterId === 'string' ? m.characterId : null, characterName: typeof m.characterName === 'string' ? m.characterName.slice(0, 60) : null, online: !!m.online })
          })
          handlers.onMembers(list)
        }))

        // Messages: only new ones (from a moment before joining); checked and de-duplicated.
        // Who sent it: the member record of the sender's sign-in id. A brand-new member's
        // first message can arrive before our member list updates, so look them up directly.
        async function senderOf(uid: string): Promise<{ id: string; name: string } | undefined> {
          const known = byUid.get(uid)
          if (known) return known
          const m = (await db.get(db.ref(database, `${room}/members/${uid}`))).val() as Member | null
          return m && typeof m.deviceId === 'string' && typeof m.name === 'string' ? { id: m.deviceId, name: m.name.slice(0, 40) } : undefined
        }
        function listenForMessages() {
          if (listening) return
          listening = true
          const recent = db.query(db.ref(database, `${room}/messages`), db.orderByChild('at'), db.startAt(joinedAt))
          cleanups.push(db.onChildAdded(recent, async (snap) => {
            const raw = snap.val() as { fromUid?: string; json?: string }
            if (!raw?.fromUid || raw.fromUid === user.uid || typeof raw.json !== 'string') return
            const sender = await senderOf(raw.fromUid)
            if (!sender) return
            const r = parseEnvelope(raw.json, sender)
            if (r.ok && dedupe.firstTime(r.envelope.id)) handlers.onMessage(r.envelope)
          }, (err) => {
            // Firebase stops a listener it refuses; say so instead of going quiet.
            console.error('lobby: message listener stopped', err)
            listening = false
            handlers.onStatus('offline')
          }))
        }

        // `at` on the record is when it was sent (listeners only read recent records); the envelope
        // inside keeps its own time. A change re-sent from a player's outbox is old but sent now.
        sendNow = (e) => void db.push(db.ref(database, `${room}/messages`), { fromUid: user.uid, at: Date.now(), json: JSON.stringify(e) })
        // Leaving: show me offline. Kicked (`forget`): delete my member record, or the others keep seeing
        // me as an offline member. Cancel the "mark me offline" first: it would write a half record after the delete.
        goOffline = (forget) => {
          if (forget) db.onDisconnect(memberRef).cancel().then(() => db.remove(memberRef)).catch((err) => console.error('lobby: could not leave room', err))
          else void db.update(memberRef, { online: false, lastSeen: db.serverTimestamp() })
        }
      })().catch((err) => {
        console.error('lobby: could not connect', err)
        handlers.onStatus('offline')
      })

      return {
        code,
        send: (e) => (sendNow ? sendNow(e) : queue.push(e)),
        updateMe: (patch) => {
          self = { ...self, ...patch }
          updateSelf?.()
        },
        leave: (options) => {
          closed = true
          cleanups.splice(0).forEach((stop) => stop())
          goOffline?.(options?.forget === true)
          handlers.onStatus('offline')
        },
      }
    },
  }
}

/** Messages older than this are deleted (the rules allow deleting ones over 1 hour old; the extra hour covers a wrong phone clock). */
export const CLEANUP_AFTER_MS = 2 * 60 * 60 * 1000

/**
 * The DM's device clears old messages from rooms it hosts (now and recently): nothing reads them any more,
 * since each device only listens from when it joined. Allowed only to room members (this sign-in stays a
 * member of rooms it was in). Returns how many were deleted; quietly 0 if not allowed or offline.
 */
export async function cleanupOldMessages(codes: string[], now = Date.now()): Promise<number> {
  const config = firebaseConfig()
  if (!config || codes.length === 0) return 0
  try {
    const [{ initializeApp, getApps }, auth, db] = await Promise.all([
      import('firebase/app'), import('firebase/auth'), import('firebase/database'),
    ])
    const app = getApps()[0] ?? initializeApp(config)
    await auth.signInAnonymously(auth.getAuth(app))
    const database = db.getDatabase(app)
    let removed = 0
    for (const code of codes) {
      try {
        const messages = db.ref(database, `rooms/${code}/messages`)
        const old = await db.get(db.query(messages, db.orderByChild('at'), db.endAt(now - CLEANUP_AFTER_MS), db.limitToFirst(500)))
        // One update for all of them: each path set to null = deleted.
        const patch: Record<string, null> = {}
        old.forEach((child) => {
          patch[child.key!] = null
        })
        const n = Object.keys(patch).length
        if (n) await db.update(messages, patch)
        removed += n
      } catch {
        // Not a member of that room any more, or the new rules aren't published yet.
      }
    }
    return removed
  } catch {
    return 0
  }
}
