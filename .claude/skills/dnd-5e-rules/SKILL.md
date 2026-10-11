---
name: dnd-5e-rules
description: D&D 5e (2024 rules, SRD 5.2.1) rule formulas, licensing limits and Thai terminology conventions. Use whenever writing or reviewing code that computes game values (modifiers, HP, AC, proficiency, saves, DCs, initiative, conditions, dice) or adds game content (classes, spells, monsters, items).
---

# D&D 5e (2024 rules, SRD 5.2.1) rules reference

The group plays the **2024 rules** (D&D Beyond "free-rules"). Where 2014 and 2024 differ, use 2024.

## Licensing
- Use **only SRD 5.2.1 content** (CC-BY-4.0). Include this attribution in the app's About page:
  "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at https://creativecommons.org/licenses/by/4.0/legalcode."
- SRD 5.2.1 includes the 2024 species (e.g. Human, Dwarf), 4 backgrounds (Acolyte, Criminal, Sage, Soldier), origin feats such as Alert, Magic Initiate, Savage Attacker, Skilled, and weapon mastery. Not included: other PHB backgrounds (e.g. Noble), other subclasses. Verify against https://www.dndbeyond.com/srd when adding content.
- The SRD has only **one subclass per class** (for example Champion, Life Domain, School of Evocation). It has no Beholder, Mind Flayer and similar. Do not add non-SRD content. Homebrew is fine if it is labeled as homebrew.
- Source data: https://github.com/5e-bits/5e-database (use its 2024 / SRD 5.2 data, not the 2014 data) or the SRD 5.2.1 PDF.

## Core formulas
| Value | Formula |
|---|---|
| Ability modifier | `Math.floor((score - 10) / 2)` |
| Proficiency bonus | `Math.ceil(level / 4) + 1` (levels 1–4: +2 … 17–20: +6) |
| Skill / save bonus | mod + (proficient ? prof : 0), or ×2 prof with Expertise |
| Passive Perception | 10 + Perception bonus (+5 advantage / −5 disadvantage) |
| Initiative | d20 + Dex mod (Alert feat: + proficiency bonus) |
| Unarmored AC | 10 + Dex mod (Barbarian: + Con, Monk: + Wis) |
| Spell save DC | 8 + prof + casting mod |
| Spell attack | prof + casting mod |
| HP at level 1 | max hit die + Con mod |
| HP per level after 1 | fixed `die/2 + 1` (or roll) + Con mod, minimum 1 per level |
| Concentration save | Con save, DC = `max(10, floor(damage / 2))`, max DC 30 |
| Carrying capacity | Str × 15 lb |
| Crit | double the number of damage dice, not the modifier |
| Advantage / disadvantage | roll 2d20 and take the higher / lower. They cancel out, and multiple sources do not stack |

Hit dice: d6 Sorcerer, Wizard · d8 Bard, Cleric, Druid, Monk, Rogue, Warlock · d10 Fighter, Paladin, Ranger · d12 Barbarian.

## Character creation (2024)
- Ability score increases come from the **background** (+2/+1 or +1/+1/+1 to its three listed abilities), not the species. No score above 20 this way.
- Each background gives 2 skill proficiencies and 1 origin feat. Human (Versatile) gets one more origin feat and Skillful gives 1 skill.

## Combat
- Temp HP does not stack (take the higher value) and is lost first.
- At 0 HP the creature is unconscious and makes death saves (DC 10). 3 successes = stable, 3 failures = dead. A nat 20 regains 1 HP, a nat 1 counts as 2 failures. Damage at 0 HP = 1 failure (a crit = 2).
- Massive damage: if leftover damage after reaching 0 ≥ max HP → instant death.
- Initiative ties: the DM decides ties between monsters, the players decide ties between player characters, and the DM decides ties between a monster and a player character.

## Conditions (15)
Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious.

Exhaustion (2024): levels 1–6. Each level gives −2 to every D20 Test (ability checks, attack rolls, saving throws) and −5 ft. Speed, and lowers your spell save DC by 2 per level. Level 6 = death.

## Skills → ability
Str: Athletics · Dex: Acrobatics, Sleight of Hand, Stealth · Int: Arcana, History, Investigation, Nature, Religion · Wis: Animal Handling, Insight, Medicine, Perception, Survival · Cha: Deception, Intimidation, Performance, Persuasion.

## Rests
- Short rest: spend hit dice (roll + Con mod each).
- Long rest: regain all HP and **all** spent Hit Dice. Reduces Exhaustion by 1.

## Thai language conventions
- UI labels and descriptions are in Thai. **Keep game terms in English**: HP, AC, Initiative, Saving Throw, ability names (STR/DEX/CON/INT/WIS/CHA), skill names, condition names, spell and monster names.
- Optional Thai gloss in a tooltip, e.g. "Prone (ล้มลง)", "Saving Throw (ทอยป้องกัน)".
- Numbers use Arabic numerals.
