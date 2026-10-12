// Adds each monster's 2024 Initiative bonus (to src/data/srd-monsters.json, field `init`) and its Legendary
// Action uses (to src/data/srd-monster-details.json, field `legendaryUses`, e.g. "3 (4 in Lair)") from the
// text of the official SRD 5.2.1 PDF. The 5e-bits data has neither.
//
// 1. Download https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
// 2. Extract its text, one "=====PAGE n" marker per page, e.g. with Python's pypdf in a scratch venv:
//      python3 -m venv /tmp/v && /tmp/v/bin/pip install pypdf
//      /tmp/v/bin/python -c "import pypdf; r=pypdf.PdfReader('SRD_CC_v5.2.1.pdf'); \
//        open('srd.txt','w').write(''.join(f'\n=====PAGE {i+1}\n'+(p.extract_text() or '') for i,p in enumerate(r.pages)))"
// 3. node scripts/srd/monster-initiative.mjs srd.txt
//
// A stat block in the text starts "Name / Size Type, Alignment / AC 17  Initiative +7 (17)". Every value is
// checked: the AC must match our data, and the bonus must be DEX, DEX + PB or DEX + 2 × PB (the 2024 rule;
// a few stat blocks differ and are listed, not trusted blindly).
import fs from 'node:fs'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/monster-initiative.mjs <SRD 5.2.1 text file>')
const lines = fs.readFileSync(source, 'utf8').split('\n').map((l) => l.trim())
const monstersFile = new URL('../../src/data/srd-monsters.json', import.meta.url)
const detailsFile = new URL('../../src/data/srd-monster-details.json', import.meta.url)
const monsters = JSON.parse(fs.readFileSync(monstersFile, 'utf8'))
const details = JSON.parse(fs.readFileSync(detailsFile, 'utf8'))

const norm = (s) => s.toLowerCase().replace(/[’']/g, "'").replace(/\s+/g, ' ').trim()
const AC_LINE = /^AC (\d+)\b.*Initiative ([+−-])\s?(\d+) \((\d+)\)/

/** name → { ac, init, legendaryUses } from the PDF text. */
const blocks = new Map()
const scoreTypos = []
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(AC_LINE)
  if (!m) continue
  const name = lines[i - 2]
  const init = (m[2] === '+' ? 1 : -1) * Number(m[3])
  // The PDF has a few misprinted scores (Gray Ooze: "−2 (13)"); the bonus is what the tracker uses.
  if (Number(m[4]) !== 10 + init) scoreTypos.push(`${name}: Initiative ${init} but score ${m[4]} (bonus used)`)
  // Legendary Action uses: before the next stat block.
  let legendaryUses
  for (let j = i + 1; j < lines.length && !AC_LINE.test(lines[j]); j++) {
    const l = lines[j].match(/^Legendary Action Uses: (.+?)\. /)
    if (l) { legendaryUses = l[1]; break }
  }
  if (!blocks.has(norm(name))) blocks.set(norm(name), { name, ac: Number(m[1]), init, legendaryUses })
}

const pbFor = (cr) => (cr < 5 ? 2 : cr < 9 ? 3 : cr < 13 ? 4 : cr < 17 ? 5 : cr < 21 ? 6 : cr < 25 ? 7 : cr < 29 ? 8 : 9)
const missing = []
const odd = []
let legendary = 0
for (const m of monsters) {
  // Forms share one stat block in the PDF ("Vampire, Bat Form" → "Vampire").
  const b = blocks.get(norm(m.name)) ?? blocks.get(norm(m.name.split(',')[0]))
  if (!b) { missing.push(m.name); continue }
  if (b.ac !== m.ac) odd.push(`${m.name}: AC ${m.ac} in our data, ${b.ac} in the PDF`)
  const dex = Math.floor((m.scores[1] - 10) / 2)
  const pb = pbFor(m.cr)
  if (![dex, dex + pb, dex + 2 * pb].includes(b.init)) odd.push(`${m.name}: Initiative ${b.init} (DEX ${dex}, PB ${pb})`)
  m.init = b.init
  const d = details.find((x) => x.id === m.id)
  if (!d) throw new Error(`${m.id}: no stat block details`)
  if (b.legendaryUses) {
    if (d.legendaryActions.length === 0) throw new Error(`${m.name}: legendary uses but no legendary actions`)
    d.legendaryUses = b.legendaryUses
    legendary++
  } else if (d.legendaryActions.length > 0) {
    odd.push(`${m.name}: has Legendary Actions but no uses line found`)
  }
}
if (missing.length) throw new Error(`not found in the PDF: ${missing.join(', ')}`)
fs.writeFileSync(monstersFile, JSON.stringify(monsters))
fs.writeFileSync(detailsFile, JSON.stringify(details))
console.log(`Initiative for ${monsters.length} monsters, Legendary uses for ${legendary}`)
if (odd.length || scoreTypos.length) console.log('check these against the PDF:\n  ' + [...scoreTypos, ...odd].join('\n  '))
