// Builds src/data/srd-magic-items.json (SRD 5.2.1 magic items, for the loot generator) from the
// 5e-bits/5e-database file src/2024/en/5e-SRD-Magic-Items.json. Read as plain data, values checked.
//
//   curl -L -o /tmp/srd/items.json https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-Magic-Items.json
//   node scripts/srd/magic-items.mjs /tmp/srd/items.json
//
// Items whose rarity depends on a version are handled so every entry has one rarity:
// - "+1/+2/+3" items (Weapon, Armor, Shield…) have their own entries in the source ("Weapon +1"…): the
//   parent entry is left out.
// - Potions of Healing and Spell Scroll are split into their 2024 rarity tiers (see TIERS below).
// - Other "Rarity Varies" items (Ioun Stone, Figurine of Wondrous Power…) are kept as "Varies" and not
//   rolled as loot.
import fs from 'node:fs'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/magic-items.mjs <5e-SRD-Magic-Items.json>')
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

const out = []
for (const x of raw) {
  const id = str(x.index, '?', 'index', 80)
  const name = str(x.name, id, 'name', 80)
  // Variant entries write their rarity with the bonus, e.g. "Uncommon (+1)".
  const rarity = str(x.rarity?.name, id, 'rarity', 120).replace(/^(Common|Uncommon|Rare|Very Rare|Legendary) \(\+\d\)$/, '$1')
  const base = { category: str(x.equipment_category?.name, id, 'category', 40), attunement: x.attunement === true, desc: str(x.desc, id, 'desc', 12000).trim() }
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
out.sort((a, b) => a.name.localeCompare(b.name))
const target = new URL('../../src/data/srd-magic-items.json', import.meta.url)
fs.writeFileSync(target, JSON.stringify(out))
const by = Object.fromEntries(['Varies', ...RARITIES].map((r) => [r, out.filter((i) => i.rarity === r).length]))
console.log(`wrote ${out.length} items, ${fs.statSync(target).size} bytes`, by)
