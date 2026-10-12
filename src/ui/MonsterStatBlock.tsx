// One SRD 5.2.1 monster, laid out like a 2024 stat block. Game terms stay in English (see CLAUDE.md).
import type { ReactNode } from 'react'
import { abilityModifier, formatModifier } from '../rules'
import { abilityRows, challengeLine, immunitiesLine, sensesLine, type FullMonster, type StatBlockEntry } from '../model/monsterDetails'

/** Labels inside action text ("Melee Attack Roll:", "Hit:", "Failure:"…) in italics, as in the book. */
const LABELS = /((?:Melee or Ranged|Melee|Ranged) Attack Roll:|Hit:|Failure or Success:|Failure:|Success:|(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:|Trigger:|Response:|First Failure:|Second Failure:)/

function richText(text: string): ReactNode[] {
  return text.split(LABELS).map((part, i) => (i % 2 ? <em key={i} className="text-stone-300">{part}</em> : part))
}

const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <p><b className="text-amber-200">{label}</b> {children}</p>
)

function Entries({ title, list, note }: { title: string; list: StatBlockEntry[]; note?: string }) {
  if (list.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="border-b border-amber-900 text-lg font-bold text-amber-400">{title}</h3>
      {note && <p className="text-xs text-stone-400">{note}</p>}
      {list.map((e, i) => (
        <div key={i}>
          <p>
            <b>{e.name}{e.usage && ` (${e.usage})`}.</b> {richText(e.text)}
          </p>
          {e.spells?.map((g) => (
            <p key={g.usage} className="ml-3"><b>{g.usage}:</b> {g.names.join(', ')}</p>
          ))}
        </div>
      ))}
    </section>
  )
}

export default function MonsterStatBlock({ m }: { m: FullMonster }) {
  const dex = abilityModifier(m.scores[1])
  return (
    <article className="space-y-3 rounded-xl border border-amber-900/60 bg-stone-900 p-4 text-sm leading-relaxed">
      <header>
        <h2 className="text-2xl font-bold text-amber-400">{m.name}</h2>
        <p className="italic text-stone-400">{m.size} {m.type[0].toUpperCase() + m.type.slice(1)}, {m.alignment}</p>
      </header>

      <div className="space-y-0.5">
        <Line label="AC">{m.ac}{m.acFrom.length > 0 && ` (${m.acFrom.join(', ')})`}</Line>
        <Line label="Initiative">
          {formatModifier(dex)} ({10 + dex})
          <span className="ml-1 text-xs text-stone-500" title="ข้อมูลต้นทางไม่มีค่า Initiative ของ 2024 (บางตัวบวก Proficiency Bonus เพิ่ม)">· ใช้ค่า DEX</span>
        </Line>
        <Line label="HP">{m.hp} ({m.hpRoll})</Line>
        <Line label="Speed">{m.speed}</Line>
      </div>

      <table className="w-full text-center text-sm">
        <thead className="text-xs text-stone-400">
          <tr><th /><th>Score</th><th>Mod</th><th>Save</th></tr>
        </thead>
        <tbody>
          {abilityRows(m).map((r) => (
            <tr key={r.ability} className="odd:bg-stone-800/60">
              <th className="py-0.5 text-left font-bold uppercase text-amber-200">{r.ability}</th>
              <td>{r.score}</td><td>{r.mod}</td><td className={r.save !== r.mod ? 'font-bold' : ''}>{r.save}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="space-y-0.5">
        {m.skills.length > 0 && <Line label="Skills">{m.skills.map((s) => `${s.name} ${formatModifier(s.bonus)}`).join(', ')}</Line>}
        {m.vulnerabilities.length > 0 && <Line label="Vulnerabilities">{m.vulnerabilities.join(', ')}</Line>}
        {m.resistances.length > 0 && <Line label="Resistances">{m.resistances.join(', ')}</Line>}
        {(m.immunities.length > 0 || m.conditionImmunities.length > 0) && <Line label="Immunities">{immunitiesLine(m)}</Line>}
        {m.gear && <Line label="Gear">{m.gear}</Line>}
        <Line label="Senses">{sensesLine(m)}</Line>
        <Line label="Languages">{m.languages || 'None'}</Line>
        <Line label="CR">{challengeLine(m)}</Line>
      </div>

      <Entries title="Traits" list={m.traits} />
      <Entries title="Actions" list={m.actions} />
      <Entries title="Bonus Actions" list={m.bonusActions} />
      <Entries title="Reactions" list={m.reactions} />
      <Entries
        title="Legendary Actions"
        list={m.legendaryActions}
        note="ใช้ได้ทันทีหลังตาของสิ่งมีชีวิตอื่น ทีละ 1 ตัวเลือก · จำนวนครั้งต่อรอบไม่มีในข้อมูลต้นทาง ดูใน SRD"
      />
      <p className="text-xs text-stone-500">SRD 5.2.1 (CC-BY-4.0)</p>
    </article>
  )
}
