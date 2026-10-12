// Wipe everything this app keeps on this device: characters, fights, logs, campaigns, settings
// (device id and name, current room, outbox), and the anonymous sign-in used for live rooms.
// The app itself stays installed and works offline; it starts as on a brand-new device.
import Dexie from 'dexie'
import { db } from './db'

/** IndexedDB databases the Firebase SDK keeps (sign-in and its own bookkeeping). */
const FIREBASE_DATABASES = ['firebaseLocalStorageDb', 'firebase-heartbeat-database', 'firebase-installations-database']

function deleteDatabase(name: string): Promise<void> {
  return new Promise((resolve) => {
    const req = indexedDB.deleteDatabase(name)
    // "blocked" = another tab still has it open; it's deleted once that tab closes.
    req.onsuccess = req.onerror = req.onblocked = () => resolve()
  })
}

export async function resetDevice(): Promise<void> {
  db.close()
  await Dexie.delete(db.name)
  await Promise.all(FIREBASE_DATABASES.map(deleteDatabase))
  sessionStorage.clear()
  localStorage.clear()
}
