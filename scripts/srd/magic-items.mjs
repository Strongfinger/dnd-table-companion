// Builds src/data/srd-magic-items.json (SRD 5.2.1 magic items, for the loot generator and the lookup).
//
// The item list, rarity, category and attunement come from the 5e-bits/5e-database file
// src/2024/en/5e-SRD-Magic-Items.json. The descriptions come from the official SRD 5.2.1 PDF instead, because
// the 5e-bits texts have too many errors to patch (rows missing from tables, text from one item pasted into
// another, words run together, tables flattened). Tables are written out by hand in magic-item-tables.mjs.
//
//   mkdir -p /tmp/srd && cd /tmp/srd
//   curl -L -o items.json https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Magic-Items.json
//   curl -L -o SRD_CC_v5.2.1.pdf https://media.dndbeyond.com/compendium-images/srd/5.2/SRD_CC_v5.2.1.pdf
//   python3 scripts/srd/pdf-text.py /tmp/srd/SRD_CC_v5.2.1.pdf /tmp/srd/srd.txt   (see that file for pypdf)
//   node scripts/srd/magic-items.mjs /tmp/srd/items.json /tmp/srd/srd.txt
//
// Items whose rarity depends on a version are handled so every entry has one rarity:
// - "+1/+2/+3" items (Weapon, Armor, Shield…) have their own entries in the source ("Weapon +1"…): the
//   parent entry is left out, and each version gets the parent's text.
// - Potions of Healing and Spell Scroll are split into their 2024 rarity tiers (see TIERS below).
// - Other "Rarity Varies" items (Ioun Stone, Figurine of Wondrous Power…) are kept as "Varies" and not
//   rolled as loot.
//
// Each description is "<type>  \n <paragraph>  \n <paragraph>…"; a table is one paragraph with a row per line.
import fs from 'node:fs'
import { TABLES } from './magic-item-tables.mjs'

const [source, pdfText] = process.argv.slice(2)
if (!pdfText) throw new Error('usage: node scripts/srd/magic-items.mjs <5e-SRD-Magic-Items.json> <srd.txt>')
const raw = JSON.parse(fs.readFileSync(source, 'utf8'))
const RARITIES = ['Common', 'Uncommon', 'Rare', 'Very Rare', 'Legendary', 'Artifact']
const fail = (id, what) => { throw new Error(`${id}: ${what}`) }
const str = (v, id, what, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : fail(id, `bad ${what}`))

/** 2024 tiers of the two items most often found as treasure. */
const TIERS = {
  'potions-of-healing': [
    ['Potion of Healing', 'Common'], ['Potion of Greater Healing', 'Uncommon'],
    ['Potion of Superior Healing', 'Rare'], ['Potion of Supreme Healing', 'Very Rare'],
  ],
  'spell-scroll': [
    ['Spell Scroll (Cantrip or Level 1)', 'Common'], ['Spell Scroll (Level 2 or 3)', 'Uncommon'],
    ['Spell Scroll (Level 4 or 5)', 'Rare'], ['Spell Scroll (Level 6 to 8)', 'Very Rare'], ['Spell Scroll (Level 9)', 'Legendary'],
  ],
}

// ---- The PDF text, cut into items ----

/** Item names the PDF writes differently from the source. */
const PDF_NAMES = {
  'Ammunition, +1, +2, or +3': 'ammunition', 'Armor, +1, +2, or +3': 'armor', 'Shield, +1, +2, or +3': 'shield',
  'Weapon, +1, +2, or +3': 'weapon', 'Wand of the War Mage, +1, +2, or +3': 'wand-of-the-war-mage',
}
/** SRD 5.2.1 items that the 5e-bits file doesn't have (not in the app yet). */
const NOT_IN_SOURCE = [
  'Bead of Nourishment', 'Cloak of Invisibility', 'Elixir of Health', 'Energy Bow', 'Gloves of Thievery', 'Hat of Many Spells',
  'Potion of Invulnerability', 'Potion of Longevity', 'Potion of Vitality', 'Quarterstaff of the Acrobat', 'Rod of Resurrection',
  'Sending Stones', 'Sentinel Shield', 'Shield of the Cavalier', 'Thunderous Greatclub',
]
/** A type line: "Wondrous Item, Rare (Requires Attunement)", "Weapon (Any Ammunition), Very Rare"… */
const TYPE_LINE = /^(Armor|Weapon|Wondrous Item|Potion|Ring|Rod|Scroll|Staff|Wand)(, | \()/
const key = (name) => name.toLowerCase().replace(/[^a-z0-9]/g, '')
const byKey = new Map(raw.map((x) => [key(x.name), x.index]))
for (const [name, id] of Object.entries(PDF_NAMES)) byKey.set(key(name), id)

const pdfLines = fs.readFileSync(pdfText, 'utf8').split('\n')
const start = pdfLines.indexOf('Magic Items A–Z')
const end = pdfLines.indexOf('Stat Block Overview', start) // the "Monsters" chapter
if (start < 0 || end < 0) fail('pdf', 'magic items chapter not found')
// Leave out page breaks, page headers and empty lines.
const lines = pdfLines.slice(start + 1, end - 1)
  .filter((l) => !l.startsWith('=====PAGE') && l.trim() !== 'System Reference Document 5.2.1' && !/^\d{1,3}$/.test(l.trim()) && l.trim() !== '')

/** PDF entries by source id: the type line and the text lines. */
const pdf = new Map()
let current = null
for (let i = 0; i < lines.length; i++) {
  if (i + 1 < lines.length && TYPE_LINE.test(lines[i + 1])) {
    const twoLines = byKey.get(key(lines[i - 1] + lines[i])) // a name printed over two lines
    const id = twoLines ?? byKey.get(key(lines[i]))
    if (twoLines) current.text.pop()
    if (id || NOT_IN_SOURCE.includes(lines[i].trim())) {
      // The type line can run over a few lines: "…Very Rare (Requires" / "Attunement)", "…Rare" / "(+2), or…".
      let type = lines[++i]
      const goesOn = () => /(,|\(Requires|Very| or| by a)$/.test(type.trimEnd()) || type.split('(').length > type.split(')').length || !!lines[i + 1]?.startsWith('(')
      while (goesOn()) type += ' ' + lines[++i].trim()
      current = { id: id ?? null, type: type.replace(/\s+/g, ' ').trim(), text: [] }
      if (id) {
        if (pdf.has(id)) fail(id, 'twice in the PDF')
        pdf.set(id, current)
      }
      continue
    }
    if (!lines[i].trim().endsWith('.')) fail(lines[i], 'looks like an item name but is not in the source')
  }
  current?.text.push(lines[i])
}

// ---- Words, to join words the PDF breaks over two lines ("be -" / "comes") ----

const sourceText = raw.map((x) => x.desc ?? '').join(' ').toLowerCase()
const words = new Set(sourceText.match(/[a-z]+/g))
try {
  for (const w of fs.readFileSync('/usr/share/dict/words', 'utf8').split('\n')) words.add(w.toLowerCase())
} catch { /* no word list: the source texts' own words are enough for most */ }
const isWord = (w) => words.has(w) || (w.endsWith('s') && words.has(w.slice(0, -1)))

/**
 * Joins two lines of one paragraph. A line-break hyphen is dropped when the joined word is a real word ("tak-" "ing")
 * or the second part is a suffix ("cancel-" "ing", "foul-smell-" "ing"); it stays in compounds ("bright-" "pink",
 * "50-foot-" "long"). The 5e-bits texts can't tell them apart: they keep some line-break hyphens ("tak-ing").
 */
function joinLines(a, b) {
  a = a.trimEnd()
  b = b.trimStart()
  if (a.endsWith('-')) {
    const [, before, left] = a.match(/(-?)([A-Za-z]*)\s?-$/)
    const right = b.match(/^[a-z]*/)[0]
    const suffix = /^(ing|ed|es|ly)$/.test(right)
    const keep = !left || !right || (!suffix && (before === '-' || !isWord(`${left}${right}`.toLowerCase())))
    return a.replace(/\s?-$/, keep ? '-' : '') + b
  }
  if (a.endsWith('/')) return a + b // "Enlarge/" "Reduce"
  return `${a} ${b}`
}

/** Words of a text, to check that a table's rows say the same as the PDF lines they replace. */
const wordSet = (text) => new Set(text.toLowerCase().replace(/['’]/g, '').replace(/\s*-\s*\n/g, '').replace(/-/g, '').match(/[a-z0-9]+/g))
const sameWords = (a, b) => a.size === b.size && [...a].every((w) => b.has(w))

/** Swaps the table lines of an item for the rows in TABLES. Returns lines and { rows } entries. */
function withTables(id, text) {
  const out = text.map((line) => ({ line }))
  const find = (line, from = 0) => out.findIndex((e, i) => i >= from && e.line?.trim() === line)
  for (const t of TABLES[id] ?? []) {
    if (t.after) {
      const at = find(t.after)
      if (at < 0) fail(id, `table anchor "${t.after}" not found`)
      out.splice(at + 1, 0, { rows: t.rows })
      continue
    }
    const from = find(t.from)
    const to = out.findLastIndex((e) => e.line?.trim() === t.to)
    if (from < 0 || to < from) fail(id, `table lines "${t.from}" … "${t.to}" not found`)
    const replaced = out.slice(from, to + 1).map((e) => e.line).join('\n')
    if (t.check !== false && !sameWords(wordSet(replaced), wordSet(t.rows.join('\n')))) fail(id, `table rows don't match the PDF:\n${replaced}`)
    out.splice(from, to - from + 1, ...(t.rows.length ? [{ rows: t.rows }] : []))
  }
  return out
}

/** A bold lead-in that starts a paragraph the PDF doesn't indent: "Cast Spell.  You can…", "Fire. You know…". */
const LEAD_IN = /^[A-Z][\w'’]*(?: (?:[A-Z(][\w'’()]*|of|the|and|or|a|to|with|from))*\.\s/

/** The text of one item as paragraphs. */
function paragraphs(id, text) {
  const out = []
  let prev = null
  for (const entry of withTables(id, text)) {
    if (entry.rows) {
      out.push(entry.rows.join('\n'))
      prev = null
      continue
    }
    const line = entry.line
    const newParagraph = prev === null || line.startsWith(' ') || line.startsWith('•')
      || (prev.trimStart().startsWith('•') && !/^[a-z]/.test(line))
      || (/[.:)]\s*$/.test(prev) && LEAD_IN.test(line))
    if (newParagraph) out.push(line.trim())
    else out[out.length - 1] = joinLines(out[out.length - 1], line)
    prev = line
  }
  return out.map((p) => p
    .replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/ +([.,;:)])/g, '$1')
    .trim())
}

// ---- The items ----

const parentOf = new Map(raw.flatMap((x) => (x.variants ?? []).map((v) => [v.index, x.index])))
const out = []
for (const x of raw) {
  const id = str(x.index, '?', 'index', 80)
  const name = str(x.name, id, 'name', 80)
  const entry = pdf.get(id) ?? pdf.get(parentOf.get(id)) ?? fail(id, 'not in the PDF')
  if ((x.attunement === true) !== /Requires Attunement/.test(entry.type)) fail(id, `attunement differs from the PDF (${entry.type})`)
  const typeLine = entry.type.match(/^(.*?), (?:Common|Uncommon|Rare|Very Rare|Legendary|Artifact|Rarity Varies)\b/)?.[1] ?? fail(id, `type line "${entry.type}"`)
  // Variant entries write their rarity with the bonus, e.g. "Uncommon (+1)".
  const rarity = str(x.rarity?.name, id, 'rarity', 120).replace(/^(Common|Uncommon|Rare|Very Rare|Legendary) \(\+\d\)$/, '$1')
  if (RARITIES.includes(rarity) && !parentOf.has(id) && !entry.type.includes(`, ${rarity}`)) fail(id, `rarity ${rarity} differs from the PDF (${entry.type})`)
  const desc = [typeLine, ...paragraphs(entry.id, entry.text)].join('  \n ')
  const base = { category: str(x.equipment_category?.name, id, 'category', 40), attunement: x.attunement === true, desc: str(desc, id, 'desc', 12000) }
  if (TIERS[id]) {
    for (const [tierName, tierRarity] of TIERS[id]) out.push({ id: `${id}-${tierRarity.toLowerCase().replace(' ', '-')}`, name: tierName, rarity: tierRarity, ...base })
  } else if (RARITIES.includes(rarity)) {
    out.push({ id, name, rarity, ...base })
  } else if (rarity === 'Rarity Varies') {
    out.push({ id, name, rarity: 'Varies', ...base })
  } else if ((x.variants ?? []).length === 0) {
    fail(id, `rarity "${rarity}" without variants`)
  } // else: a "+1/+2/+3" parent whose variants are their own entries
}
for (const id of Object.keys(TABLES)) if (!pdf.has(id)) fail(id, 'table for an item that is not in the PDF')
out.sort((a, b) => a.name.localeCompare(b.name))
const target = new URL('../../src/data/srd-magic-items.json', import.meta.url)
fs.writeFileSync(target, JSON.stringify(out))
const by = Object.fromEntries(['Varies', ...RARITIES].map((r) => [r, out.filter((i) => i.rarity === r).length]))
console.log(`wrote ${out.length} items, ${fs.statSync(target).size} bytes`, by)
