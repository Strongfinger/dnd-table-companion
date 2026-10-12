// Builds src/data/srd-spells.json (SRD 5.2.1 spells for the lookup) from the 5e-bits/5e-database file
// src/2024/en/5e-SRD-Spells.json. The source is read as plain data (never run), every value is
// checked, and only the fields the spell card shows are written.
//
//   curl -L -o /tmp/srd/spells.json https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Spells.json
//   node scripts/srd/spells.mjs /tmp/srd/spells.json
import fs from 'node:fs'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/spells.mjs <5e-SRD-Spells.json>')
const raw = JSON.parse(fs.readFileSync(source, 'utf8'))

const fail = (id, what) => { throw new Error(`${id}: ${what}`) }
const str = (v, id, what, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : fail(id, `bad ${what}`))
const CLASSES = ['Bard', 'Cleric', 'Druid', 'Paladin', 'Ranger', 'Sorcerer', 'Warlock', 'Wizard']
const SCHOOLS = ['Abjuration', 'Conjuration', 'Divination', 'Enchantment', 'Evocation', 'Illusion', 'Necromancy', 'Transmutation']

const out = raw.map((s) => {
  const id = str(s.index, '?', 'index', 64)
  if (!Number.isInteger(s.level) || s.level < 0 || s.level > 9) fail(id, 'level')
  const school = str(s.school?.name, id, 'school', 20)
  if (!SCHOOLS.includes(school)) fail(id, `school ${school}`)
  const classes = (s.classes ?? []).map((c) => str(c.name, id, 'class', 20))
  if (!classes.every((c) => CLASSES.includes(c))) fail(id, `classes ${classes}`)
  const components = (s.components ?? []).map((c) => (['V', 'S', 'M'].includes(c) ? c : fail(id, `component ${c}`)))
  if (typeof s.ritual !== 'boolean' || typeof s.concentration !== 'boolean') fail(id, 'ritual/concentration')
  // Correction: one spell (Protection from Evil and Good) writes "Concentration up to 10 minutes" in its
  // duration but isn't flagged; the flag is what the app uses, and the duration keeps the usual wording.
  let duration = str(s.duration, id, 'duration', 80)
  let concentration = s.concentration
  const conc = duration.match(/^Concentration,? (.*)$/)
  if (conc) {
    if (!concentration) console.log(`corrected: ${id} is a Concentration spell`)
    concentration = true
    duration = conc[1]
  }
  const spell = {
    id,
    name: str(s.name, id, 'name', 80),
    level: s.level,
    school,
    classes,
    castingTime: str(s.casting_time, id, 'casting time', 200),
    ritual: s.ritual,
    range: str(s.range, id, 'range', 80),
    components,
    duration,
    concentration,
    text: str(s.description, id, 'description', 8000).trim(),
  }
  if (s.material) spell.material = str(s.material, id, 'material', 300)
  if (s.higher_level) spell.higher = str(s.higher_level, id, 'higher level', 2000).trim()
  return spell
})

out.sort((a, b) => a.level - b.level || a.name.localeCompare(b.name))
const target = new URL('../../src/data/srd-spells.json', import.meta.url)
fs.writeFileSync(target, JSON.stringify(out))
console.log(`wrote ${out.length} spells, ${fs.statSync(target).size} bytes`)
