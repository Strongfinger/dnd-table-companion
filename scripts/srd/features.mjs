// Builds src/data/srd-features.json (SRD 5.2.1 class and subclass features, species traits and feats, with
// their English text) from 5e-bits/5e-database files in src/2024/en/. Read as plain data, every value checked.
//
//   mkdir -p /tmp/srd && cd /tmp/srd
//   for f in Features Traits Feats; do
//     curl -L -o $f.json https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-$f.json
//   done
//   node scripts/srd/features.mjs /tmp/srd/Features.json /tmp/srd/Traits.json /tmp/srd/Feats.json
//
// Text clean-up: the source text was copied from the PDF and keeps its line-break hyphens ("ex- pended",
// "Blud- geoning"). "word- word" is joined when the joined word appears elsewhere in the texts (so real
// hyphenated words like "Two-Handed" stay); otherwise it becomes "word-word". Markdown bold (**x**) is kept.
import fs from 'node:fs'

const [featuresFile, traitsFile, featsFile] = process.argv.slice(2)
if (!featsFile) throw new Error('usage: node scripts/srd/features.mjs <Features.json> <Traits.json> <Feats.json>')
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))
const fail = (id, what) => { throw new Error(`${id}: ${what}`) }
const str = (v, id, what, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : fail(id, `bad ${what}`))

const CLASSES = ['Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk', 'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard']
const SPECIES = ['Dragonborn', 'Dwarf', 'Elf', 'Gnome', 'Goliath', 'Halfling', 'Human', 'Orc', 'Tiefling']
const FEAT_TYPES = { origin: 'Origin', general: 'General', 'fighting-style': 'Fighting Style', 'epic-boon': 'Epic Boon' }

const features = read(featuresFile)
const traits = read(traitsFile)
const feats = read(featsFile)

// Words seen anywhere in the texts, to decide whether "ex- pended" should be joined.
const allText = [...features, ...traits, ...feats].map((x) => x.description ?? '').join(' ')
const words = new Set(allText.toLowerCase().match(/[a-z]+/g))
// Also the system word list when there is one (macOS/Linux), for words used only once ("instrument").
try {
  for (const w of fs.readFileSync('/usr/share/dict/words', 'utf8').split('\n')) words.add(w.toLowerCase())
} catch { /* no word list: the texts' own words are enough for most */ }
const isWord = (w) => words.has(w) || (w.endsWith('s') && words.has(w.slice(0, -1)))
/** Dashes the source lost ("Strength-with" was "Strength—with") and two words split the wrong way. */
const FIXES = [
  ['Strength-with', 'Strength—with'], ['Strike-and', 'Strike—and'], ['time-the', 'time—the'], ['benefits-a', 'benefits—a'],
  ['Great-axes', 'Greataxes'], ['spell-casting', 'spellcasting'],
]
function clean(text) {
  for (const [from, to] of FIXES) text = text.replaceAll(from.replace('-', '- '), to).replaceAll(from, to)
  return text
    .replace(/([A-Za-z]+)- ([a-z]+)/g, (_, a, b) => (isWord((a + b).toLowerCase()) ? a + b : `${a}-${b}`))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

const out = { classFeatures: [], traits: [], feats: [] }

for (const f of features) {
  const id = str(f.index, '?', 'index', 80)
  const className = str(f.class?.name, id, 'class', 20)
  if (!CLASSES.includes(className)) fail(id, `class ${className}`)
  const level = Number(str(f.level?.name, id, 'level', 20).match(/(\d+)$/)?.[1])
  if (!Number.isInteger(level) || level < 1 || level > 20) fail(id, 'level')
  const item = { id, name: str(f.name, id, 'name', 80), className, level, text: clean(str(f.description, id, 'description', 20000)) }
  if (f.subclass) item.subclass = str(f.subclass.name, id, 'subclass', 60)
  out.classFeatures.push(item)
}
out.classFeatures.sort((a, b) => a.className.localeCompare(b.className) || a.level - b.level || a.name.localeCompare(b.name))

for (const t of traits) {
  const id = str(t.index, '?', 'index', 80)
  const species = (t.species ?? []).map((s) => str(s.name, id, 'species', 30))
  if (species.length === 0 || !species.every((s) => SPECIES.includes(s))) fail(id, `species ${species}`)
  out.traits.push({ id, name: str(t.name, id, 'name', 80), species, text: clean(str(t.description, id, 'description', 20000)) })
}
out.traits.sort((a, b) => a.species[0].localeCompare(b.species[0]) || a.name.localeCompare(b.name))

for (const f of feats) {
  const id = str(f.index, '?', 'index', 80)
  const type = FEAT_TYPES[f.type] ?? fail(id, `feat type ${f.type}`)
  out.feats.push({ id, name: str(f.name, id, 'name', 80), type, repeatable: f.repeatable === true, text: clean(str(f.description, id, 'description', 20000)) })
}

const target = new URL('../../src/data/srd-features.json', import.meta.url)
fs.writeFileSync(target, JSON.stringify(out))
console.log(`wrote ${out.classFeatures.length} class features, ${out.traits.length} traits, ${out.feats.length} feats, ${fs.statSync(target).size} bytes`)
