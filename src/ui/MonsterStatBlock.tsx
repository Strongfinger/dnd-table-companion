// One SRD 5.2.1 monster, laid out like a 2024 stat block. Game terms stay in English (see CLAUDE.md).
// With DND-TH's Thai text (`th`), a ไทย/EN switch shows the traits and actions in Thai; every number above
// them (AC, HP, scores, CR…) is the English data either way.
import type { ReactNode } from 'react'
import { abilityModifier, formatModifier } from '../rules'
import { abilityRows, challengeLine, immunitiesLine, sensesLine, type FullMonster, type StatBlockEntry } from '../model/monsterDetails'
import type { MonsterEntryTh, MonsterTh } from '../model/monstersTh'
import MiniMarkdown from './MiniMarkdown'
import { LangSwitch, ThaiCredit } from './ThaiText'
import { useTextLang } from './useTextLang'

/** Labels inside action text ("Melee Attack Roll:", "Hit:", "Failure:"…) in italics, as in the book. */
const LABELS = /((?:Melee or Ranged|Melee|Ranged) Attack Roll:|Hit:|Failure or Success:|Failure:|Success:|(?:Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma) Saving Throw:|Trigger:|Response:|First Failure:|Second Failure:)/

function richText(text: string): ReactNode[] {
  return text.split(LABELS).map((part, i) => (i % 2 ? <em key={i} className="text-stone-300">{part}</em> : part))
}

const Line = ({ label, children }: { label: string; children: ReactNode }) => (
  <p><b className="text-amber-200">{label}</b> {children}</p>
)

/** Thai entry: "ควบคุมจิตใจ (Dominate Mind) (2/Day)." then DND-TH's text (its spell lists are part of it). */
function ThaiEntry({ e, th }: { e: StatBlockEntry; th: MonsterEntryTh }) {
  const name = (th.name ? `${th.name} (${e.name})` : e.name) + (e.usage ? ` (${e.usage})` : '')
  return <div className="space-y-1"><MiniMarkdown text={`**_${name}._** ${th.text}`} /></div>
}

function Entries({ title, list, note, th }: { title: string; list: StatBlockEntry[]; note?: string; th?: Record<string, MonsterEntryTh> }) {
  if (list.length === 0) return null
  return (
    <section className="space-y-2">
      <h3 className="border-b border-amber-900 text-lg font-bold text-amber-400">{title}</h3>
      {note && <p className="text-xs text-stone-400">{note}</p>}
      {list.map((e, i) => th?.[e.name] ? <ThaiEntry key={i} e={e} th={th[e.name]} /> : (
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

export default function MonsterStatBlock({ m, th }: { m: FullMonster; th?: MonsterTh }) {
  const dex = abilityModifier(m.scores[1])
  const [lang, setLang] = useTextLang()
  const thai = th && lang === 'th' ? th.entries : undefined
  return (
    <article className="space-y-3 rounded-xl border border-amber-900/60 bg-stone-900 p-4 text-sm leading-relaxed">
      <header className="flex items-start justify-between gap-2">
        <div>
          <h2 className="text-2xl font-bold text-amber-400">{m.name}</h2>
          {th && <p className="text-amber-200">{th.name}</p>}
          <p className="italic text-stone-400">{m.size} {m.type[0].toUpperCase() + m.type.slice(1)}, {m.alignment}</p>
        </div>
        {th && <LangSwitch lang={lang} onChange={setLang} />}
      </header>

      <div className="space-y-0.5">
        <Line label="AC">{m.ac}{m.acFrom.length > 0 && ` (${m.acFrom.join(', ')})`}</Line>
        <Line label="Initiative">{formatModifier(m.init ?? dex)} ({10 + (m.init ?? dex)})</Line>
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

      <Entries title="Traits" list={m.traits} th={thai?.traits} />
      <Entries title="Actions" list={m.actions} th={thai?.actions} />
      <Entries title="Bonus Actions" list={m.bonusActions} th={thai?.bonusActions} />
      <Entries title="Reactions" list={m.reactions} th={thai?.reactions} />
      <Entries
        title="Legendary Actions"
        list={m.legendaryActions}
        th={thai?.legendaryActions}
        note={`Legendary Action Uses: ${m.legendaryUses ?? '—'} · ใช้ได้ทันทีหลังตาของสิ่งมีชีวิตอื่น ทีละ 1 ครั้ง · ได้คืนทั้งหมดเมื่อเริ่มตาของตัวเอง`}
      />
      {thai ? <ThaiCredit /> : <p className="text-xs text-stone-500">SRD 5.2.1 (CC-BY-4.0)</p>}
    </article>
  )
}
