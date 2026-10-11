// Placeholder home screen. Real features arrive in Phase 1+ (see docs/ROADMAP.md).
export default function App() {
  return (
    <main className="min-h-dvh bg-stone-900 p-6 text-stone-100">
      <h1 className="text-3xl font-bold text-amber-400">DND Table Companion</h1>
      <p className="mt-2 text-stone-300">ผู้ช่วยโต๊ะ D&amp;D สำหรับเล่นกับเพื่อน</p>

      <ul className="mt-6 space-y-2">
        <li className="rounded-lg bg-stone-800 p-4">📜 Character Sheet — ใบตัวละคร (เร็วๆ นี้)</li>
        <li className="rounded-lg bg-stone-800 p-4">⚔️ Initiative Tracker — ลำดับการต่อสู้ (เร็วๆ นี้)</li>
        <li className="rounded-lg bg-stone-800 p-4">🎲 DM Assistant — ผู้ช่วย DM (เร็วๆ นี้)</li>
      </ul>
    </main>
  )
}
