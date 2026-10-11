import { useLiveQuery } from 'dexie-react-hooks'
import { go } from '../app/router'
import { listCampaigns } from '../db/campaigns'
import { listCharacters, saveCharacter } from '../db/characters'
import { Button } from '../ui/kit'

export default function CharacterList() {
  // useLiveQuery re-runs automatically whenever the characters table changes.
  const characters = useLiveQuery(listCharacters)
  const campaignName = new Map((useLiveQuery(listCampaigns) ?? []).map((c) => [c.id, c.name]))

  async function loadSamples() {
    const { sampleCharacters } = await import('../dev/sampleCharacters')
    const existing = new Set(characters?.map((c) => c.name))
    for (const c of sampleCharacters()) if (!existing.has(c.name)) await saveCharacter(c)
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold text-amber-400">DND Table Companion</h1>
        <p className="text-stone-400">ตัวละครที่บันทึกไว้ในเครื่องนี้</p>
      </header>

      <div className="flex gap-2">
        <Button variant="primary" className="flex-1 py-3" onClick={() => go('/new')}>
          + สร้างตัวละครใหม่
        </Button>
        <Button className="py-3" onClick={() => go('/import')}>📥 นำเข้า</Button>
      </div>

      {characters?.length === 0 && (
        <p className="rounded-xl bg-stone-800 p-6 text-center text-stone-400">ยังไม่มีตัวละคร กดปุ่มด้านบนเพื่อสร้าง</p>
      )}

      <ul className="space-y-2">
        {characters?.map((c) => (
          <li key={c.id}>
            <a href={`#/c/${c.id}`} className="flex items-center justify-between rounded-xl bg-stone-800 p-4 hover:bg-stone-700">
              <div>
                <div className="text-lg font-bold">{c.name || '(ไม่มีชื่อ)'}</div>
                <div className="text-sm text-stone-400">
                  {c.className} {c.level}
                  {c.species && ` · ${c.species}`}
                  {c.background && ` · ${c.background}`}
                </div>
                {c.campaignId && campaignName.has(c.campaignId) && <div className="text-xs text-amber-500/80">🗺 {campaignName.get(c.campaignId)}</div>}
              </div>
              <div className="text-right text-sm">
                <div className="font-bold">{c.hp.current}/{c.hp.max}</div>
                <div className="text-stone-400">HP</div>
              </div>
            </a>
          </li>
        ))}
      </ul>

      {/* Only on the local dev server: the build removes this whole block. */}
      {import.meta.env.DEV && (
        <Button className="w-full text-sm" onClick={loadSamples}>
          🧪 โหลดตัวละครทดสอบ 4 ตัว (dev เท่านั้น)
        </Button>
      )}
    </div>
  )
}
