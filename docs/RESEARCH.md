# Research: content sources and enhancement plan (2026-10-13)

Goal: find SRD 5.2.1 data for the top QA finding (QA Pass 1 #1: **no weapons, armor or class features on
the sheet**) and the known data gaps, then plan the work. Researcher only: nothing in `src/` changed.

## 1. Sources checked

| Source | What it has (2024 / SRD 5.2) | License | Verdict |
|---|---|---|---|
| **5e-bits/5e-database** `src/2024/en/` (already our source) | 25 files. New for us: `Equipment` (182 items: 38 weapons, 12 armors + Shield, tools, gear, packs, foci), `Weapon-Mastery-Properties` (8), `Weapon-Properties`, `Features` (232 class/subclass features, full text), `Levels` (287, with per-level `class_specific` numbers), `Classes` (starting equipment options), `Feats` (17), `Backgrounds` (4), `Species` (9), `Traits` (67), `Poisons` (14) | SRD data CC-BY-4.0 | **Main source**, same pipeline as today (`scripts/srd/*.mjs`). Has a few errors, see §2 |
| **Open5e API v2**, document `srd-2024` (`https://api.open5e.com/v2/...?document__key=srd-2024`) | 331 creatures **with `initiative_bonus`**, weapons, spells, classes, rules sections | `srd-2024` doc = CC-BY-4.0 | **Use as a cross-check**, and as the source for monster Initiative. Its other documents (Kobold Press, Tome of Beasts, A5E, Black Flag…) are OGL/other books: **not allowed** (SRD 5.2.1 only) |
| Official **SRD 5.2.1 PDF** (dndbeyond.com/srd) | The authoritative text | CC-BY-4.0 | Final word for any disagreement; needed by hand for Legendary Action uses |
| Foundry VTT `dnd5e` system | SRD 5.2 compendia (LevelDB packs, not plain JSON) | data CC-BY-4.0, code MIT | Not worth it: harder to read, same content |
| The DM's Toolkit SRD 5.2 API | `/api/2024/monsters`, `/spells` | unclear | Skip (third party, no extra value) |

## 2. Data quality findings (checked 2026-10-13)

**Weapons (5e-bits `5e-SRD-Equipment.json`, 192,438 bytes, SHA-256 `4219c83f…4f22`)**: all 38 weapons have
damage and a Mastery; versatile and thrown ranges are present. Checked every row against the 2024 table
and Open5e `srd-2024`. **Corrections the build script must apply:**
- **Trident**: source says 1d6 / Versatile 1d8 (2014 values). 2024: **1d8 Piercing, Versatile 1d10**, Thrown 20/60, Topple (Open5e agrees).
- **Sling**: source says Piercing. 2024: **Bludgeoning** (Open5e agrees).
- **Morningstar**: no `range` → treat as melee 5 ft.
- Properties list leaves out Range itself; ammunition type (Arrow/Bolt/Bullet/Needle) is not linked. Minor.

**Armor**: 13 entries (Padded, Leather, Studded, Hide, Chain Shirt, Scale, Breastplate, Half-Plate, Ring,
Chain Mail, Splint, Plate, Shield). Base AC, DEX cap (`max_bonus` missing = no cap), Strength minimum
(Chain 13, Splint/Plate 15) and Stealth Disadvantage all match the 2024 table.

**Class features** (`Features` + `Levels`): every feature has text; one SRD subclass per class.
`Levels.class_specific` gives the scaling numbers we need: Barbarian `rage_count`, `rage_damage_bonus`,
`weapon_mastery`; Bard `bardic_inspiration_die`; Cleric/Paladin `channel_divinity_charges`; Druid
`wild_shape_uses`; Fighter `second_wind_uses`, `weapon_mastery`; Monk `martial_arts_die`, `focus_points`,
`unarmored_movement_bonus`; Rogue `sneak_attack`; Sorcerer `sorcery_points`; Warlock `eldritch_invocations`.
Missing: weapon-mastery counts for Paladin/Ranger/Rogue (fixed 2 in 2024, put in `src/rules/classes.ts`).
**Caution:** `Classes.proficiencies` looks 2014-style for Rogue (lists Longswords; 2024 = Simple + Martial
with Finesse or Light). Don't import weapon training from it; write it in `src/rules/classes.ts` instead.

**Monster Initiative (known gap in HANDOFF)**: Open5e `srd-2024` has `initiative_bonus` for all 331
creatures. Matched to our 341 entries (forms share the base creature): **340/341 equal DEX, DEX+PB or
DEX+2×PB** (223 / 79 / 38), as 2024 stat blocks should. Odd one: **Archmage +7** (DEX +2, PB 4); check the PDF.
**Legendary Action uses** are in neither source (30 legendary creatures); enter by hand from the PDF
("Legendary Action Uses: 3 (4 in Lair)").

## 3. Plan (small runnable steps, in order)

Each step: build script / pure rules in `src/rules/` with tests → UI → `rules-reviewer` → commit + push.

| # | Step | Size | Notes |
|---|---|---|---|
| **E1** | `scripts/srd/equipment.mjs` → `src/data/srd-equipment.json`: weapons (name, simple/martial, melee/ranged, dice, type, properties, ranges, versatile dice, mastery), armor (base, DEX cap, Str min, Stealth), mastery + property texts. Apply §2 corrections; README entry with checksum | S | Lazy-loaded like the other SRD files |
| **E2** | Attacks from SRD weapons: "+ อาวุธ SRD" picker on the edit page fills dice/type; rules: Finesse = higher of STR/DEX, ranged = DEX, Versatile two-handed damage, proficiency from class training; Mastery shown when the character has Weapon Mastery. Tap an attack on the sheet → attack roll + damage via `DiceRoll` (app or real dice), Critical doubles dice | M | Directly fixes QA #1 "attack +X, damage YdZ+M in one tap" |
| **E3** | Armor & AC rule (`src/rules/armor.ts`): worn armor + Shield + DEX cap, Unarmored Defense (Barbarian/Monk), Str minimum → −10 ft. Speed, Stealth Disadvantage note, untrained armor warning. Calculated AC with **manual override** (guided + override) | M | Nyx would show AC 14 in Leather (11 + DEX 3) instead of 13 |
| **E4** | Class features on the sheet: section "ความสามารถของ Class" listing features up to the character's level (+ subclass), English name + text, Thai gloss of the name; auto-fill limited-use `features` (Rage, Second Wind, Channel Divinity, Wild Shape, Bardic Inspiration, Focus/Sorcery Points) with counts and recharge from `Levels`; scaling numbers shown (Sneak Attack 1d6, Martial Arts die, Rage damage) | L | Split into E4a (list + text) and E4b (auto uses on create/level-up) |
| **E5** | Starting equipment in the wizard: class option A/B + background option → inventory, attacks (E2), worn armor (E3), coins | M | Needs E1–E3 |
| **E6** | Monster Initiative: one-off script adds `init` to `srd-monsters.json` from Open5e `srd-2024` (validated as in §2), tracker uses it instead of DEX; remove the "Initiative = DEX" notes. Legendary Action uses for the 30 creatures typed from the PDF | S | Fixes two known gaps in HANDOFF |
| **E7** | Lookup tabs: Equipment (weapons/armor/gear), Weapon Mastery & Properties, Feats (17), Poisons (14); players see them too | S | Reuses E1 data |
| Q | Quick QA items between steps: QA #2 (🎲 button covers last buttons), QA #3 (`React.lazy` for DM screens) | S | |

Suggested order: **E1 → E2 → E3 → E4a → E6 → E4b → E5 → E7**. E1–E3 + E4a are the "before Phase 5"
minimum so players can attack and see their features at the first real session.

## 4. Questions for the owner (ask before building, as preferred)
1. Attacks: auto-roll damage right after a hit, or a separate "damage" tap after the DM says it hit?
2. Feature text: keep the SRD English text only, or add short hand-written Thai summaries for level 1–5 features (more work, slower to finish)?
3. Weapon Mastery: track which weapons the character has chosen (and change them on a Long Rest), or just show the mastery text on every proficient weapon?
4. Equipment: track "equipped vs carried" (needed for automatic AC), or just a worn-armor + shield picker?

## 5. Licensing notes
- Keep the existing CC-BY attribution (About page + `src/data/README.md`); add Open5e as the source of the
  Initiative numbers (the numbers are SRD 5.2.1 content, CC-BY-4.0).
- Never import Open5e documents other than `srd-2024`, and nothing from the PHB 2024 beyond the SRD
  (e.g. only one subclass per class, 4 backgrounds, 17 feats).

Sources: [5e-bits/5e-database 2024 files](https://github.com/5e-bits/5e-database/tree/main/src/2024/en) ·
[Open5e API](https://api.open5e.com/v2/documents/srd-2024/) · [Open5e releases](https://github.com/open5e/open5e-api/releases) ·
[SRD 5.2 announcement (D&D Beyond)](https://www.dndbeyond.com/posts/1717-2024-core-rulebooks-in-digital-formats) ·
[Foundry dnd5e](https://github.com/foundryvtt/dnd5e) · [The DM's Toolkit API](https://apisearch.thedmstoolkit.com/)
