// Starting equipment at level 1 (2024 rules, SRD 5.2.1): each class and background offers "Choose A or B"
// (Fighter: A, B or C). Copied from the SRD 5.2.1 PDF class and background tables. Item names match
// src/data/srd-equipment.json, so they become SRD items in the inventory; `choose` items are ones the player
// picks (a Musical Instrument, a Gaming Set…) and are added under that name to be renamed.
import type { BackgroundName } from './backgrounds'
import type { ClassName } from '../types'

export interface GearItem {
  name: string
  qty: number
  /** A kind the player picks (e.g. "Musical Instrument"): added as a plain item to rename. */
  choose?: boolean
}

export interface GearOption {
  label: 'A' | 'B' | 'C'
  items: GearItem[]
  gp: number
}

const i = (name: string, qty = 1): GearItem => ({ name, qty })
const pick = (name: string): GearItem => ({ name, qty: 1, choose: true })
const gold = (label: 'A' | 'B' | 'C', gp: number): GearOption => ({ label, items: [], gp })

export const CLASS_STARTING_GEAR: Record<ClassName, GearOption[]> = {
  Barbarian: [{ label: 'A', items: [i('Greataxe'), i('Handaxe', 4), i("Explorer's Pack")], gp: 15 }, gold('B', 75)],
  Bard: [{ label: 'A', items: [i('Leather Armor'), i('Dagger', 2), pick('Musical Instrument'), i("Entertainer's Pack")], gp: 19 }, gold('B', 90)],
  Cleric: [{ label: 'A', items: [i('Chain Shirt'), i('Shield'), i('Mace'), pick('Holy Symbol'), i("Priest's Pack")], gp: 7 }, gold('B', 110)],
  // Druidic Focus (Quarterstaff): the Quarterstaff is the focus.
  Druid: [{ label: 'A', items: [i('Leather Armor'), i('Shield'), i('Sickle'), i('Quarterstaff'), i("Explorer's Pack"), i('Herbalism Kit')], gp: 9 }, gold('B', 50)],
  Fighter: [
    { label: 'A', items: [i('Chain Mail'), i('Greatsword'), i('Flail'), i('Javelin', 8), i("Dungeoneer's Pack")], gp: 4 },
    { label: 'B', items: [i('Studded Leather Armor'), i('Scimitar'), i('Shortsword'), i('Longbow'), i('Arrows', 20), i('Quiver'), i("Dungeoneer's Pack")], gp: 11 },
    gold('C', 155),
  ],
  Monk: [{ label: 'A', items: [i('Spear'), i('Dagger', 5), pick("Artisan's Tools / Musical Instrument"), i("Explorer's Pack")], gp: 11 }, gold('B', 50)],
  Paladin: [{ label: 'A', items: [i('Chain Mail'), i('Shield'), i('Longsword'), i('Javelin', 6), pick('Holy Symbol'), i("Priest's Pack")], gp: 9 }, gold('B', 150)],
  Ranger: [{ label: 'A', items: [i('Studded Leather Armor'), i('Scimitar'), i('Shortsword'), i('Longbow'), i('Arrows', 20), i('Quiver'), i('Sprig of Mistletoe'), i("Explorer's Pack")], gp: 7 }, gold('B', 150)],
  Rogue: [{ label: 'A', items: [i('Leather Armor'), i('Dagger', 2), i('Shortsword'), i('Shortbow'), i('Arrows', 20), i('Quiver'), i("Thieves' Tools"), i("Burglar's Pack")], gp: 8 }, gold('B', 100)],
  Sorcerer: [{ label: 'A', items: [i('Spear'), i('Dagger', 2), i('Crystal'), i("Dungeoneer's Pack")], gp: 28 }, gold('B', 50)],
  Warlock: [{ label: 'A', items: [i('Leather Armor'), i('Sickle'), i('Dagger', 2), i('Orb'), i('Book'), i("Scholar's Pack")], gp: 15 }, gold('B', 100)],
  // Arcane Focus (Quarterstaff): the Quarterstaff is the focus.
  Wizard: [{ label: 'A', items: [i('Dagger', 2), i('Quarterstaff'), i('Robe'), i('Spellbook'), i("Scholar's Pack")], gp: 5 }, gold('B', 55)],
}

export const BACKGROUND_STARTING_GEAR: Record<BackgroundName, GearOption[]> = {
  Acolyte: [{ label: 'A', items: [i("Calligrapher's Supplies"), i('Book'), pick('Holy Symbol'), i('Parchment', 10), i('Robe')], gp: 8 }, gold('B', 50)],
  Criminal: [{ label: 'A', items: [i('Dagger', 2), i("Thieves' Tools"), i('Crowbar'), i('Pouch', 2), i("Clothes, Traveler's")], gp: 16 }, gold('B', 50)],
  Sage: [{ label: 'A', items: [i('Quarterstaff'), i("Calligrapher's Supplies"), i('Book'), i('Parchment', 8), i('Robe')], gp: 8 }, gold('B', 50)],
  Soldier: [{ label: 'A', items: [i('Spear'), i('Shortbow'), i('Arrows', 20), pick('Gaming Set'), i("Healer's Kit"), i('Quiver'), i("Clothes, Traveler's")], gp: 14 }, gold('B', 50)],
}

/** "Greataxe, 4 Handaxe, Explorer's Pack, 15 GP" for the choice buttons. */
export function gearOptionLine(o: GearOption): string {
  return [...o.items.map((x) => (x.qty > 1 ? `${x.qty} ${x.name}` : x.name)), `${o.gp} GP`].join(', ')
}
