// Writes .env.local from the Firebase web config you paste in.
// Run in Terminal:  node scripts/firebase-env.mjs
// Paste the `const firebaseConfig = { ... }` block from Firebase, then press Enter on an empty line.
import fs from 'node:fs'
import readline from 'node:readline'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
const lines = []
console.log('วาง firebaseConfig จาก Firebase (Project settings → Your apps → Config) แล้วกด Enter บรรทัดว่าง 1 ครั้ง:\n')
rl.on('line', (line) => {
  if (line.trim() === '' && lines.length > 0) return rl.close()
  lines.push(line)
})
rl.on('close', async () => {
  const text = lines.join('\n')
  const get = (key) => text.match(new RegExp(`${key}\\s*:\\s*["']([^"']+)["']`))?.[1] ?? ''
  const values = {
    VITE_FIREBASE_API_KEY: get('apiKey'),
    VITE_FIREBASE_AUTH_DOMAIN: get('authDomain'),
    VITE_FIREBASE_DATABASE_URL: get('databaseURL'),
    VITE_FIREBASE_PROJECT_ID: get('projectId'),
    VITE_FIREBASE_APP_ID: get('appId'),
  }
  if (!values.VITE_FIREBASE_DATABASE_URL && values.VITE_FIREBASE_PROJECT_ID) {
    // Older configs leave databaseURL out; ours is in Singapore.
    values.VITE_FIREBASE_DATABASE_URL = `https://${values.VITE_FIREBASE_PROJECT_ID}-default-rtdb.asia-southeast1.firebasedatabase.app`
    console.log('\n(ไม่พบ databaseURL ในที่วาง ใช้ค่ามาตรฐานของ Singapore ให้แทน)')
  }
  const missing = Object.entries(values).filter(([, v]) => !v).map(([k]) => k)
  if (missing.length) {
    console.log(`\n❌ หาไม่เจอ: ${missing.join(', ')}  ลองคัดลอกทั้งก้อน { ... } อีกครั้ง`)
    process.exit(1)
  }
  const out = Object.entries(values).map(([k, v]) => `${k}=${v}`).join('\n') + '\n'
  fs.writeFileSync(new URL('../.env.local', import.meta.url), out)
  console.log('\n✅ เขียน .env.local แล้ว (ไฟล์นี้ไม่ถูกอัปโหลดขึ้น GitHub)')
  for (const k of Object.keys(values)) console.log(`   ${k} ✓`)
})
