// Builds src/data/srd-equipment.json (SRD 5.2.1 weapons, armor, gear, tools and packs, plus the texts of the
// weapon properties and Weapon Mastery properties) from three 5e-bits/5e-database files in src/2024/en/.
// The sources are read as plain data (never run), every value is checked, and only the fields the app
// uses are written.
//
//   mkdir -p /tmp/srd && cd /tmp/srd
//   for f in Equipment Weapon-Properties Weapon-Mastery-Properties Poisons; do
//     curl -L -o $f.json https://raw.githubusercontent.com/5e-bits/5e-database/main/src/2024/en/5e-SRD-$f.json
//   done
//   node scripts/srd/equipment.mjs /tmp/srd/Equipment.json /tmp/srd/Weapon-Properties.json /tmp/srd/Weapon-Mastery-Properties.json /tmp/srd/Poisons.json
//
// Poisons (14, kind 'poison'): price per dose, type and text; types, DCs and prices checked against the PDF.
//
// Corrections: the source has some 2014 values and gaps. Every cost, weight, weapon row, armor row, tool
// and pack below was checked against the official SRD 5.2.1 PDF (tables on pp. 91–99); see ITEM_FIXES.
// - Weapons: Trident 1d8 / Versatile 1d10, Sling Bludgeoning, Morningstar 5 ft. reach, plus costs/weights.
// - Hide Armor is Medium armor (source: Light).
// - Packs: contents written from the SRD text (the source's lists are wrong or messy).
// - Tools: Brewer's and Tinker's DCs, Glassblower's Utilize, Disguise Kit is a tool; Utilize text cleaned.
// - Spellbook isn't in the SRD gear table (it's the Wizard's class item); its source cost is kept.
import fs from 'node:fs'

const [equipmentFile, propertiesFile, masteryFile, poisonsFile] = process.argv.slice(2)
if (!poisonsFile) throw new Error('usage: node scripts/srd/equipment.mjs <Equipment.json> <Weapon-Properties.json> <Weapon-Mastery-Properties.json> <Poisons.json>')
const read = (f) => JSON.parse(fs.readFileSync(f, 'utf8'))

const fail = (id, what) => { throw new Error(`${id}: ${what}`) }
const str = (v, id, what, max) => (typeof v === 'string' && v.length > 0 && v.length <= max ? v : fail(id, `bad ${what}`))
const int = (v, id, what, min, max) => (Number.isInteger(v) && v >= min && v <= max ? v : fail(id, `bad ${what}`))
const num = (v, id, what, max) => (typeof v === 'number' && v >= 0 && v <= max ? v : fail(id, `bad ${what}`))
const DICE = /^(\d+d(4|6|8|10|12)|1)$/
const DAMAGE_TYPES = ['Bludgeoning', 'Piercing', 'Slashing']
const PROPERTIES = ['Ammunition', 'Finesse', 'Heavy', 'Light', 'Loading', 'Reach', 'Thrown', 'Two-Handed', 'Versatile']
const MASTERIES = ['Cleave', 'Graze', 'Nick', 'Push', 'Sap', 'Slow', 'Topple', 'Vex']

/** Weapon and armor fixes applied while reading the source, by item id. */
const CORRECTIONS = {
  trident: { dice: '1d8', versatile: '1d10' },
  sling: { damageType: 'Bludgeoning' },
  morningstar: { range: { normal: 5 } },
  'hide-armor': { armorCategory: 'Medium' },
}

const gp = (qty, unit = 'gp') => ({ qty, unit })
/** Fixes applied to the finished items (SRD 5.2.1 PDF values), by item id. */
const ITEM_FIXES = {
  // Weapons table (p. 91)
  dart: { cost: gp(5, 'cp') },
  javelin: { cost: gp(5, 'sp') },
  spear: { cost: gp(1), weight: 3 },
  mace: { weight: 4 },
  pike: { weight: 18 },
  longbow: { cost: gp(50) },
  'hand-crossbow': { cost: gp(75), weight: 3 },
  // Armor table (p. 92)
  'chain-shirt': { weight: 20 },
  // Adventuring Gear table (p. 95–96)
  'alchemists-fire': { cost: gp(50) },
  antitoxin: { weight: 0 },
  basket: { cost: gp(4, 'sp') },
  bedroll: { cost: gp(1), weight: 7 },
  bell: { weight: 0 },
  blanket: { cost: gp(5, 'sp') },
  caltrops: { cost: gp(1) },
  chain: { weight: 10 },
  chest: { cost: gp(5), weight: 25 },
  'climbers-kit': { weight: 12 },
  'clothes-fine': { weight: 6 },
  'clothes-travelers': { cost: gp(2) },
  'component-pouch': { cost: gp(25), weight: 2 },
  parchment: { cost: gp(1, 'sp') },
  robe: { weight: 4 },
  sack: { weight: 0.5 },
  'spikes-iron': { weight: 5 },
  'ball-bearings': { name: 'Ball Bearings' },
  // Tools (p. 93–94)
  viol: { weight: 1 },
  'poisoners-kit': { cost: gp(50) },
  'brewers-supplies': { utilize: ['Detect poisoned drink (DC 15)', 'Identify alcohol (DC 10)'] },
  'tinkers-tools': { utilize: ['Assemble a Tiny item composed of scrap, which falls apart in 1 minute (DC 20)'] },
  'glassblowers-tools': { utilize: ['Discern what a glass object held in the past 24 hours (DC 15)'] },
  'disguise-kit': { kind: 'tool' },
  // Packs: weight from the gear table, contents from each pack's text (p. 96–99)
  'burglars-pack': { weight: 42, contents: [['Backpack', 1], ['Ball Bearings', 1], ['Bell', 1], ['Candle', 10], ['Crowbar', 1], ['Lantern, Hooded', 1], ['Oil', 7], ['Rations', 5], ['Rope', 1], ['Tinderbox', 1], ['Waterskin', 1]] },
  'diplomat-pack': { weight: 39, contents: [['Chest', 1], ['Clothes, Fine', 1], ['Ink', 1], ['Ink Pen', 5], ['Lamp', 1], ['Case, Map or Scroll', 2], ['Oil', 4], ['Paper', 5], ['Parchment', 5], ['Perfume', 1], ['Tinderbox', 1]] },
  'dungeoneer-pack': { contents: [['Backpack', 1], ['Caltrops', 1], ['Crowbar', 1], ['Oil', 2], ['Rations', 10], ['Rope', 1], ['Tinderbox', 1], ['Torch', 10], ['Waterskin', 1]] },
  'entertainers-pack': {
    kind: 'pack', weight: 58.5,
    text: "An Entertainer's Pack contains the following items: Backpack, Bedroll, Bell, Bullseye Lantern, 3 Costumes, Mirror, 8 flasks of Oil, 9 days of Rations, Tinderbox, and Waterskin.",
    contents: [['Backpack', 1], ['Bedroll', 1], ['Bell', 1], ['Lantern, Bullseye', 1], ['Costume', 3], ['Mirror', 1], ['Oil', 8], ['Rations', 9], ['Tinderbox', 1], ['Waterskin', 1]],
  },
  'explorers-pack': { kind: 'pack', contents: [['Backpack', 1], ['Bedroll', 1], ['Oil', 2], ['Rations', 10], ['Rope', 1], ['Tinderbox', 1], ['Torch', 10], ['Waterskin', 1]] },
  'priests-pack': { contents: [['Backpack', 1], ['Blanket', 1], ['Holy Water', 1], ['Lamp', 1], ['Rations', 7], ['Robe', 1], ['Tinderbox', 1]] },
  'scholars-pack': { contents: [['Backpack', 1], ['Book', 1], ['Ink', 1], ['Ink Pen', 1], ['Lamp', 1], ['Oil', 10], ['Parchment', 10], ['Tinderbox', 1]] },
}

/** "': Seal or pry…'" / "' Discern…'" / "'sew a Tiny design'" → clean, capitalized. */
const cleanUtilize = (u) => u.replace(/^[\s:]+/, '').replace(/^./, (c) => c.toUpperCase())

const texts = (file, allowed) => read(file).map((p) => {
  const name = str(p.name, p.index, 'name', 20)
  if (!allowed.includes(name) && name !== 'Range') fail(p.index, `unknown property ${name}`)
  return { name, text: str(p.description, p.index, 'description', 2000).trim() }
}).sort((a, b) => a.name.localeCompare(b.name))

const cost = (c, id) => ({ qty: num(c.quantity, id, 'cost', 5000), unit: ['cp', 'sp', 'gp'].includes(c.unit) ? c.unit : fail(id, 'cost unit') })
const range = (r, id) => {
  const out = { normal: int(r.normal, id, 'range', 5, 600) }
  if (r.long !== undefined) out.long = int(r.long, id, 'long range', out.normal, 1200)
  return out
}

function weapon(x, cats, id) {
  const fix = CORRECTIONS[id] ?? {}
  const dice = fix.dice ?? str(x.damage?.damage_dice, id, 'damage dice', 6)
  if (!DICE.test(dice)) fail(id, `damage dice ${dice}`)
  const damageType = fix.damageType ?? str(x.damage?.damage_type?.name, id, 'damage type', 20)
  if (!DAMAGE_TYPES.includes(damageType)) fail(id, `damage type ${damageType}`)
  const properties = (x.properties ?? []).map((p) => str(p.name, id, 'property', 20))
  if (!properties.every((p) => PROPERTIES.includes(p))) fail(id, `properties ${properties}`)
  const mastery = str(x.mastery?.name, id, 'mastery', 20)
  if (!MASTERIES.includes(mastery)) fail(id, `mastery ${mastery}`)
  const ranged = cats.includes('ranged-weapons')
  if (ranged === cats.includes('melee-weapons')) fail(id, 'melee or ranged')
  const out = {
    category: cats.includes('martial-weapons') ? 'Martial' : cats.includes('simple-weapons') ? 'Simple' : fail(id, 'simple or martial'),
    type: ranged ? 'Ranged' : 'Melee',
    dice,
    damageType,
    properties,
    mastery,
    range: fix.range ?? (x.range ? range(x.range, id) : fail(id, 'no range')),
  }
  if (properties.includes('Thrown')) out.thrown = range(x.throw_range ?? fail(id, 'thrown without range'), id)
  if (properties.includes('Versatile')) {
    out.versatile = fix.versatile ?? str(x.two_handed_damage?.damage_dice, id, 'versatile dice', 6)
    if (!DICE.test(out.versatile)) fail(id, `versatile dice ${out.versatile}`)
  }
  if (properties.includes('Ammunition')) out.ammunition = str(x.ammunition?.name, id, 'ammunition', 30)
  if (x.notes) out.notes = x.notes.map((n) => str(n, id, 'note', 100))
  return out
}

function armor(x, cats, id) {
  const ac = x.armor_class ?? fail(id, 'no armor_class')
  const category = CORRECTIONS[id]?.armorCategory ?? (cats.includes('shields') ? 'Shield'
    : cats.includes('light-armor') ? 'Light' : cats.includes('medium-armor') ? 'Medium' : cats.includes('heavy-armor') ? 'Heavy' : fail(id, 'armor category'))
  // dexCap: null = add the full DEX modifier, 0 = no DEX, 2 = DEX up to +2.
  const dexCap = ac.dex_bonus === true ? (ac.max_bonus === undefined ? null : int(ac.max_bonus, id, 'max bonus', 1, 5)) : 0
  if (category === 'Light' && dexCap !== null) fail(id, 'light armor with a DEX cap')
  if (category === 'Medium' && dexCap !== 2) fail(id, 'medium armor DEX cap')
  if ((category === 'Heavy' || category === 'Shield') && dexCap !== 0) fail(id, 'heavy armor or shield with DEX')
  return {
    category,
    base: int(ac.base, id, 'base AC', 2, 18),
    dexCap,
    strMin: int(x.str_minimum ?? 0, id, 'str minimum', 0, 20),
    stealthDisadvantage: x.stealth_disadvantage === true,
  }
}

const out = []
for (const x of read(equipmentFile)) {
  const id = str(x.index, '?', 'index', 64)
  const cats = (x.equipment_categories ?? []).map((c) => str(c.index, id, 'category', 40))
  const item = { id, name: str(x.name, id, 'name', 60) }
  if (cats.includes('weapons')) { item.kind = 'weapon'; item.weapon = weapon(x, cats, id) }
  else if (cats.includes('shields')) { item.kind = 'shield'; item.armor = armor(x, cats, id) }
  else if (cats.includes('armor')) { item.kind = 'armor'; item.armor = armor(x, cats, id) }
  else if (cats.includes('ammunition')) item.kind = 'ammunition'
  else if (cats.includes('equipment-packs')) item.kind = 'pack'
  else if (cats.includes('tools')) item.kind = 'tool'
  else if (cats.some((c) => ['arcane-foci', 'druidic-foci', 'holy-symbols'].includes(c))) item.kind = 'focus'
  else if (cats.includes('adventuring-gear')) item.kind = 'gear'
  else fail(id, `unknown categories ${cats}`)
  item.cost = cost(x.cost ?? fail(id, 'no cost'), id)
  // Entertainer's Pack has no weight in the source (fixed below).
  if (x.weight !== undefined) item.weight = num(x.weight, id, 'weight', 100)
  if (x.quantity !== undefined) item.qty = int(x.quantity, id, 'quantity', 1, 100)
  if (x.description) item.text = str(x.description, id, 'description', 2000).trim()
  if (x.ability) item.ability = str(x.ability.name, id, 'tool ability', 3).toLowerCase()
  if (x.utilize) {
    item.utilize = x.utilize.map((u) => `${cleanUtilize(str(u.name, id, 'utilize', 120))}${u.dc ? ` (DC ${int(u.dc.dc_value, id, 'utilize DC', 5, 30)})` : ''}`)
  }
  if (x.contents) item.contents = x.contents.map((c) => ({ name: str(c.item?.name, id, 'pack item', 60), qty: int(c.quantity, id, 'pack qty', 1, 100) }))
  out.push(item)
}
const POISON_TYPES = { contact: 'Contact', ingested: 'Ingested', inhaled: 'Inhaled', injury: 'Injury' }
for (const p of read(poisonsFile)) {
  const id = str(p.index, '?', 'index', 64)
  const type = POISON_TYPES[p.type] ?? fail(id, `poison type ${p.type}`)
  out.push({
    id, name: str(p.name, id, 'name', 60), kind: 'poison', cost: { qty: int(p.cost, id, 'cost', 1, 100000), unit: 'gp' }, weight: 0,
    text: `${type} Poison. ${str(p.description, id, 'description', 2000).trim()}`,
  })
}

for (const [id, fix] of Object.entries(ITEM_FIXES)) {
  const item = out.find((i) => i.id === id) ?? fail(id, 'fix for a missing item')
  const { contents, ...rest } = fix
  Object.assign(item, rest)
  if (contents) item.contents = contents.map(([name, qty]) => ({ name, qty }))
}
for (const id of Object.keys(CORRECTIONS)) if (!out.some((i) => i.id === id)) fail(id, 'correction for a missing item')
// Pack contents must name real items, so a pack can later be unpacked into the inventory.
const names = new Set(out.map((i) => i.name))
for (const i of out) {
  for (const c of i.contents ?? []) if (!names.has(c.name)) fail(i.id, `pack item ${c.name} is not an item`)
  if (i.kind === 'pack' && !i.contents) fail(i.id, 'pack without contents')
  if (i.weight === undefined) fail(i.id, 'no weight')
  if (i.kind === 'tool' && !i.utilize) fail(i.id, 'tool without Utilize')
}
out.sort((a, b) => a.name.localeCompare(b.name))

const data = {
  items: out,
  properties: texts(propertiesFile, PROPERTIES),
  masteries: texts(masteryFile, MASTERIES),
}
const target = new URL('../../src/data/srd-equipment.json', import.meta.url)
fs.writeFileSync(target, JSON.stringify(data))
const by = {}
for (const i of out) by[i.kind] = (by[i.kind] ?? 0) + 1
console.log(`wrote ${out.length} items, ${data.properties.length} properties, ${data.masteries.length} masteries, ${fs.statSync(target).size} bytes`, by)
