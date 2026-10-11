---
name: dnd-5e-rules
description: D&D 5e (2014, SRD 5.1) rule formulas, licensing limits and Thai terminology conventions. Use whenever writing or reviewing code that computes game values (modifiers, HP, AC, proficiency, saves, DCs, initiative, conditions, dice) or adds game content (classes, spells, monsters, items).
---

# D&D 5e (SRD 5.1) rules reference

## Licensing
- Use **only SRD 5.1 content** (CC-BY-4.0). Include this attribution in the app's About page:
  "This work includes material taken from the System Reference Document 5.1 (“SRD 5.1”) by Wizards of the Coast LLC, available at https://dnd.wizards.com/resources/systems-reference-document. Licensed under CC-BY-4.0."
- The SRD has only **one subclass per class** (for example Champion, Life Domain, School of Evocation) and one background (Acolyte). It has no Beholder, Mind Flayer and similar. Do not add non-SRD content. Homebrew is fine if it is labeled as homebrew.
- Use the open data at https://www.dnd5eapi.co (SRD only) or https://github.com/5e-bits/5e-database as the source for monsters and spells.

## Core formulas
| Value | Formula |
|---|---|
| Ability modifier | `Math.floor((score - 10) / 2)` |
| Proficiency bonus | `Math.ceil(level / 4) + 1` (levels 1–4: +2 … 17–20: +6) |
| Skill / save bonus | mod + (proficient ? prof : 0), or ×2 prof with Expertise |
| Passive Perception | 10 + Perception bonus (+5 advantage / −5 disadvantage) |
| Initiative | d20 + Dex mod |
| Unarmored AC | 10 + Dex mod (Barbarian: + Con, Monk: + Wis) |
| Spell save DC | 8 + prof + casting mod |
| Spell attack | prof + casting mod |
| HP at level 1 | max hit die + Con mod |
| HP per level after 1 | fixed `die/2 + 1` (or roll) + Con mod, minimum 1 per level |
| Concentration save | Con save, DC = `max(10, floor(damage / 2))` |
| Carrying capacity | Str × 15 lb |
| Crit | double the number of damage dice, not the modifier |
| Advantage / disadvantage | roll 2d20 and take the higher / lower. They cancel out, and multiple sources do not stack |

Hit dice: d6 Sorcerer, Wizard · d8 Bard, Cleric, Druid, Monk, Rogue, Warlock · d10 Fighter, Paladin, Ranger · d12 Barbarian.

## Combat
- Temp HP does not stack (take the higher value) and is lost first.
- At 0 HP the creature is unconscious and makes death saves (DC 10). 3 successes = stable, 3 failures = dead. A nat 20 regains 1 HP, a nat 1 counts as 2 failures. Damage at 0 HP = 1 failure (a crit = 2).
- Massive damage: if leftover damage after reaching 0 ≥ max HP → instant death.
- Initiative ties: use the higher Dex, otherwise the DM decides.

## Conditions (15)
Blinded, Charmed, Deafened, Exhaustion (levels 1–6), Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious.

## Skills → ability
Str: Athletics · Dex: Acrobatics, Sleight of Hand, Stealth · Int: Arcana, History, Investigation, Nature, Religion · Wis: Animal Handling, Insight, Medicine, Perception, Survival · Cha: Deception, Intimidation, Performance, Persuasion.

## Rests
- Short rest: spend hit dice (roll + Con mod each).
- Long rest: regain all HP and up to half your total hit dice (minimum 1). Reduces exhaustion by 1.

## Thai language conventions
- UI labels and descriptions are in Thai. **Keep game terms in English**: HP, AC, Initiative, Saving Throw, ability names (STR/DEX/CON/INT/WIS/CHA), skill names, condition names, spell and monster names.
- Optional Thai gloss in a tooltip, e.g. "Prone (ล้มลง)", "Saving Throw (ทอยป้องกัน)".
- Numbers use Arabic numerals.
