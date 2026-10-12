// Builds src/data/srd-monster-details.json (full SRD 5.2.1 stat blocks for the lookup) from the
// 5e-bits/5e-database file src/2024/en/5e-SRD-Monsters.json. The source file is read as plain data
// (never run), every value is checked, and only the fields the stat block shows are written.
//
//   curl -L -o /tmp/srd/monsters.json https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Monsters.json
//   node scripts/srd/monster-details.mjs /tmp/srd/monsters.json
import fs from 'node:fs'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/monster-details.mjs <5e-SRD-Monsters.json>')
const raw = JSON.parse(fs.readFileSync(source, 'utf8'))
const slim = JSON.parse(fs.readFileSync(new URL('../../src/data/srd-monsters.json', import.meta.url), 'utf8'))
const slimIds = new Set(slim.map((m) => m.id))

const fail = (id, what) => { throw new Error(`${id}: ${what}`) }
const str = (v, id, what, max = 4000) => (typeof v === 'string' && v.length <= max ? v : fail(id, `bad ${what}`))
const int = (v, id, what) => (Number.isInteger(v) ? v : fail(id, `bad ${what}`))
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1)
const ABILITIES = { STR: 'str', DEX: 'dex', CON: 'con', INT: 'int', WIS: 'wis', CHA: 'cha' }

/** "(Recharge 5–6)", "(3/Day, or 4/Day in Lair)"… as printed in 2024 stat blocks. */
function usageText(u, id) {
  if (!u) return undefined
  if (u.type === 'recharge on roll') return int(u.min_value, id, 'recharge') === 6 ? 'Recharge 6' : `Recharge ${u.min_value}–6`
  if (u.type === 'per day') return `${int(u.times, id, 'times')}/Day` + (u.times_in_lair ? `, or ${int(u.times_in_lair, id, 'lair')}/Day in Lair` : '')
  if (u.type === 'recharge after rest') return 'Recharges after a Short or Long Rest'
  return fail(id, `unknown usage ${u.type}`)
}

/** Spell lists the description leaves out ("…casts one of the following spells:"), grouped like the book. */
function spellGroups(sc, id) {
  const groups = new Map()
  for (const s of sc.spells ?? []) {
    const u = s.usage
    const label = !u || u.type === 'at will' ? 'At Will' : u.type === 'per day' ? `${int(u.times, id, 'spell times')}/Day Each` : fail(id, `spell usage ${u.type}`)
    const name = str(s.name, id, 'spell name', 80) + (s.notes ? ` (${str(s.notes, id, 'spell notes', 300)})` : '')
    groups.set(label, [...(groups.get(label) ?? []), name])
  }
  return [...groups].map(([usage, names]) => ({ usage, names }))
}

function blocks(list, id) {
  return (list ?? []).map((a) => {
    const text = str(a.desc, id, `${a.name} text`).trim()
    const b = { name: str(a.name, id, 'action name', 120), text }
    const usage = usageText(a.usage, id)
    if (usage) b.usage = usage
    // Only when the text stops at the list ("…the following spells:"); otherwise it names the spells itself.
    if (a.spellcasting && text.endsWith(':')) b.spells = spellGroups(a.spellcasting, id)
    return b
  })
}

const out = raw.map((m) => {
  const id = str(m.index, '?', 'index', 64)
  if (!slimIds.has(id)) fail(id, 'not in srd-monsters.json')
  const saves = {}
  const skills = []
  for (const p of m.proficiencies ?? []) {
    const name = str(p.proficiency?.name, id, 'proficiency')
    if (name.startsWith('Saving Throw: ')) saves[ABILITIES[name.slice(14)] ?? fail(id, name)] = int(p.value, id, 'save')
    else if (name.startsWith('Skill: ')) skills.push({ name: name.slice(7), bonus: int(p.value, id, 'skill') })
    else fail(id, `proficiency ${name}`)
  }
  const ac = m.armor_class?.[0] ?? fail(id, 'no AC')
  const senses = Object.entries(m.senses ?? {}).filter(([k]) => k !== 'passive_perception')
    .map(([k, v]) => `${cap(k)} ${str(v, id, 'sense', 40)}`)
  const d = {
    id,
    alignment: str(m.alignment, id, 'alignment', 60),
    acFrom: (ac.armor ?? []).map((x) => str(x.name, id, 'armor', 40)),
    saves,
    skills,
    vulnerabilities: (m.damage_vulnerabilities ?? []).map((x) => cap(str(x, id, 'vulnerability', 200))),
    resistances: (m.damage_resistances ?? []).map((x) => cap(str(x, id, 'resistance', 200))),
    immunities: (m.damage_immunities ?? []).map((x) => cap(str(x, id, 'immunity', 200))),
    conditionImmunities: (m.condition_immunities ?? []).map((x) => str(x.name, id, 'condition', 40)),
    senses,
    passivePerception: int(m.senses?.passive_perception, id, 'passive perception'),
    languages: str(m.languages ?? '', id, 'languages', 300),
    pb: int(m.proficiency_bonus, id, 'proficiency bonus'),
    traits: blocks(m.special_abilities, id),
    actions: blocks(m.actions, id),
    bonusActions: blocks(m.bonus_actions, id),
    reactions: blocks(m.reactions, id),
    legendaryActions: blocks(m.legendary_actions, id),
  }
  if (m.xp_in_lair) d.xpInLair = int(m.xp_in_lair, id, 'xp in lair')
  if (m.gear) d.gear = str(m.gear, id, 'gear', 300)
  return d
})

if (out.length !== slim.length) throw new Error(`expected ${slim.length} monsters, got ${out.length}`)
const target = new URL('../../src/data/srd-monster-details.json', import.meta.url)
fs.writeFileSync(target, JSON.stringify(out))
console.log(`wrote ${out.length} stat blocks, ${fs.statSync(target).size} bytes`)
