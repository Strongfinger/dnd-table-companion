// Shared helper for the lobby test scripts: a fake device in a Firebase room (uses .env.local).
const PROJECT = require('node:path').resolve(__dirname, '../..')
const { createRequire } = require('node:module')
const req = createRequire(PROJECT + '/package.json')
const fs = require('node:fs')
const crypto = require('node:crypto')
const env = Object.fromEntries(fs.readFileSync(PROJECT + '/.env.local', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => l.split('=').map((s) => s.trim())))
const { initializeApp } = req('firebase/app')
const auth = req('firebase/auth')
const db = req('firebase/database')
exports.join = async (code, member, onEnvelope) => {
  const app = initializeApp({ apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, databaseURL: env.VITE_FIREBASE_DATABASE_URL, projectId: env.VITE_FIREBASE_PROJECT_ID, appId: env.VITE_FIREBASE_APP_ID })
  const user = (await auth.signInAnonymously(auth.getAuth(app))).user
  const d = db.getDatabase(app)
  const me = db.ref(d, `rooms/${code}/members/${user.uid}`)
  await db.set(me, { ...member, online: true })
  const q = db.query(db.ref(d, `rooms/${code}/messages`), db.orderByChild('at'), db.startAt(Date.now() - 2000))
  db.onChildAdded(q, (s) => { const m = s.val(); if (m.fromUid !== user.uid) onEnvelope(JSON.parse(m.json)) })
  const send = (kind, body) => { const e = { v: 2, id: crypto.randomUUID(), kind, from: member.deviceId, fromName: member.name, at: Date.now(), body }; return db.push(db.ref(d, `rooms/${code}/messages`), { fromUid: user.uid, at: e.at, json: JSON.stringify(e) }) }
  const leave = () => db.update(me, { online: false })
  return { send, leave }
}
exports.sleep = (ms) => new Promise((r) => setTimeout(r, ms))
