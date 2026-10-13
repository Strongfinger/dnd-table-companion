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

## 3. Owner decisions (2026-10-13)
1. **Attacks:** attack roll and damage roll are **separate taps** (damage after the DM says it hit; Critical doubles the dice).
2. **Feature text:** SRD **English text only** for now (Thai gloss of the name is fine).
3. **Weapon Mastery:** just **show** the mastery on each weapon the character is trained with; no per-weapon choice tracking.
4. **Equipment:** **track equipped items** (inventory items can be equipped; AC and attacks come from what is equipped).
5. **New request:** limited-use actions (Second Wind, Action Surge, Rage…) get full details and live in a
   **catalog the player picks from, like spells** (see §4).

## 4. Limited-use feature catalog (research for the new request)

**Problem with today's model** (`features: {name, max, used, recharge: 'short'|'long'}`, hand-entered):
- **Wrong Short Rest rule.** `shortRest()` (`src/rules/play.ts`) gives back **all** uses of a "short"
  feature. In 2024 several features regain **one** use on a Short Rest and all on a Long Rest: Second Wind,
  Rage, Channel Divinity (Cleric and Paladin), Wild Shape. Others regain all on a Short Rest (Action Surge,
  Focus Points, Stroke of Luck, Adrenaline Rush). The model needs three cases: `long`, `short` (all),
  `shortOne` (one on Short, all on Long).
- **Pools don't fit.** Lay On Hands is a pool of 5 × Paladin level HP (up to 100); `io.ts` rejects `max > 20`.
  Focus/Sorcery Points are pools too. Add `kind: 'uses' | 'pool'` (pool = spend any amount) and raise the limit.
- **No details:** no activation (Bonus Action…), no effect or dice, no rules text, no link to the SRD.
- **Uses change with level or ability** (Rage count, Bardic Inspiration = CHA mod, Breath Weapon = PB), so
  hand-typed max goes stale on level-up or an ASI.

**Source data:** 5e-bits `Features` has the text of all 232 class features (61 mention a rest) and `Traits`
has the species traits (18 mention a rest), but **no structured uses/recharge/activation**. `Levels.class_specific`
has some counts (rage_count, channel_divinity_charges, wild_shape_uses, second_wind_uses, focus_points,
sorcery_points, favored_enemies). So: SRD text from the data file + a **small hand-written rules table**
(~40 entries) for the numbers. Note: feature text has PDF line-break hyphens ("ex- pended", "Blud- geoning")
and lost dashes ("Strength-with"); the build script must clean the first, carefully.

**Catalog entries** (2024, SRD 5.2.1 only; ⟳ = recharge; to be checked by `rules-reviewer` when built):

| Source | Feature (level) | Activation | Uses | ⟳ | One-tap effect |
|---|---|---|---|---|---|
| Barbarian | Rage (1) | Bonus Action | 2/2/3(3)/4(6)/5(12)/6(17) | shortOne | Rage damage +2/+3(9)/+4(16); reminder: Resistance B/P/S, STR Advantage |
| Barbarian | Persistent Rage (15) | on Initiative | 1 | long | regain all Rage uses |
| Berserker | Intimidating Presence (14) | Bonus Action | 1 (or spend a Rage) | long | WIS save DC 8+STR+PB |
| Bard | Bardic Inspiration (1) | Bonus Action | CHA mod (min 1) | long; **short from Font of Inspiration (5)** | die d6/d8(5)/d10(10)/d12(15) |
| Cleric | Channel Divinity (2) | Magic action | 2/3(6)/4(18) | shortOne | Divine Spark 1d8(+1d8 at 7,13,18)+WIS; Turn Undead (WIS save) |
| Cleric | Divine Intervention (10) | Magic action | 1 | long | |
| Druid | Wild Shape (2) | Bonus Action | 2/3(6)/4(17) | shortOne | |
| Druid | Wild Resurgence (5) | — | 1 (slot from Wild Shape) | long | |
| Land | Natural Recovery (6) | — | 1 | long | |
| Fighter | Second Wind (1) | Bonus Action | 2/3(4)/4(10) | shortOne | heal 1d10 + Fighter level |
| Fighter | Action Surge (2) | free, on your turn | 1/2(17) | short | +1 Action this turn (not Magic) → hook into action economy |
| Fighter | Indomitable (9) | when you fail a save | 1/2(13)/3(17) | long | reroll + Fighter level |
| Monk | Focus Points (2) | — | **pool** = Monk level | short | Flurry of Blows / Patient Defense / Step of the Wind (1 point, Bonus Action) |
| Monk | Uncanny Metabolism (2) | on Initiative | 1 | long | regain all Focus, heal Martial Arts die + Monk level |
| Open Hand | Wholeness of Body (6) | Bonus Action | WIS mod (min 1) | long | heal Martial Arts die + WIS |
| Paladin | Lay On Hands (1) | Bonus Action | **pool** = 5 × level | long | heal chosen amount (5 to cure Poisoned) |
| Paladin | Paladin's Smite (2) | free cast | 1 | long | Divine Smite without a slot |
| Paladin | Channel Divinity (3) | Bonus Action / varies | 2/3(11) | shortOne | Divine Sense; Sacred Weapon (Devotion) |
| Paladin | Faithful Steed (5) | free cast | 1 | long | Find Steed without a slot |
| Devotion | Holy Nimbus (20) | Bonus Action | 1 | long | |
| Ranger | Favored Enemy (1) | free cast | 2/3(5)/4(9)/5(13)/6(17) | long | Hunter's Mark without a slot |
| Ranger | Tireless (10) | Magic action | WIS mod (min 1) | long | Temp HP 1d8 + WIS |
| Ranger | Nature's Veil (14) | Bonus Action | WIS mod (min 1) | long | Invisible until end of next turn |
| Rogue | Stroke of Luck (20) | — | 1 | short | |
| Sorcerer | Innate Sorcery (1) | Bonus Action | 2 | long | 1 minute: spell DC +1, Advantage on spell attacks |
| Sorcerer | Sorcery Points (2) | — | **pool** = Sorcerer level | long | convert slots ↔ points |
| Sorcerer | Sorcerous Restoration (5) | on Short Rest | 1 | long | regain points = half level |
| Draconic | Dragon Wings (14) / Dragon Companion (18) | Bonus Action / free cast | 1 | long | |
| Warlock | Magical Cunning (2) | 1 minute | 1 | long | regain half Pact slots |
| Warlock | Contact Patron (9) / Mystic Arcanum (11+) | free cast | 1 each | long | |
| Fiend | Dark One's Own Luck (6) | — | CHA mod (min 1) | long | +1d10 to a check or save |
| Fiend | Hurl Through Hell (14) | — | 1 | long | |
| Wizard | Arcane Recovery (1) | on Short Rest | 1 | long | slot levels ≤ half Wizard level |
| Wizard | Signature Spells (20) | free cast | 1 each (2 spells) | short | |
| Dragonborn | Breath Weapon (1) | replaces 1 attack | PB | long | 1d10/2d10(5)/3d10(11)/4d10(17), DEX save DC 8+CON+PB |
| Dragonborn | Draconic Flight (5) | Bonus Action | 1 | long | |
| Goliath | Giant Ancestry (1) / Large Form (5) | varies / Bonus Action | PB / 1 | long | |
| Orc | Adrenaline Rush (1) | Bonus Action | PB | short | Dash + Temp HP = PB |
| Orc | Relentless Endurance (1) | at 0 HP | 1 | long | drop to 1 HP instead |
| Dwarf | Stonecunning (1) | Bonus Action | PB | long | Tremorsense 60 ft. for 10 minutes |
| Elf/Gnome/Tiefling | lineage spells | free cast | 1 each | long | |
| Feat | Magic Initiate | free cast | 1 (level 1 spell) | long | |

Not uses (leave out or show as text only): Relentless Rage (DC goes up), Fiendish Resilience, Weapon Mastery swaps,
Heroic Inspiration (already on the sheet).

**Proposed design** (same pattern as spells):
- `src/rules/srd/limitedFeatures.ts` (pure, tested): the table above as data + functions
  `featureUses(entry, character)` (by level table / ability mod min 1 / PB / pool) and the recharge kind.
- `src/data/srd-class-features.json` (built by script from `Features` + `Traits`, lazy-loaded): the English text,
  shown in the detail view and in the Lookup.
- Character `features[]` items gain optional `srdId`, `kind`, and `recharge: 'long' | 'short' | 'shortOne'`
  (old files still import: `short` keeps today's meaning). Max is recalculated from `srdId` on level-up/ASI;
  homebrew entries stay hand-typed. Only the id travels in room sync; text is looked up on each device.
- Picker "+ จากรายการ SRD" in the features section, filtered by class, subclass, level, species and feats
  (like the spell picker); the wizard and level-up add the right ones automatically.
- Tap to use: spends a use (pool: asks how many), ticks the Action/Bonus Action like a cast, logs it, and
  offers the dice roll (Second Wind 1d10+level, Breath Weapon…) via `DiceRoll`. Action Surge adds an extra
  Action to this turn's action economy.
- Rests: `shortRest` handles `shortOne`; Bardic Inspiration switches to Short Rest at Bard 5;
  room permissions unchanged (players spend, DM gives back).

## 5. Plan (small runnable steps, in order)

Each step: build script / pure rules in `src/rules/` with tests → UI → `rules-reviewer` → commit + push.

| # | Step | Size | Notes |
|---|---|---|---|
| **E1** ✅ | `scripts/srd/equipment.mjs` → `src/data/srd-equipment.json`: weapons, armor, mastery + property texts. Apply §2 corrections; README entry with checksum | S | Lazy-loaded |
| **E2** ✅ | Inventory items can point to an SRD item (`srdId`) and be **equipped**. Equipped weapons appear as attacks: Finesse = higher of STR/DEX, ranged = DEX, Versatile two-handed damage, proficiency from class training, Mastery text shown. **Attack tap → d20 roll; separate Damage tap** (Critical doubles dice), both via `DiceRoll`. Hand-made attacks stay | M | Fixes QA #1 "attack +X, damage YdZ+M" |
| **E3** ✅ | `src/rules/armor.ts`: AC from **equipped** armor + Shield + DEX cap, Unarmored Defense, Str minimum → −10 ft., Stealth Disadvantage, untrained-armor warning; manual override kept | M | Nyx: AC 14 in Leather |
| **F1** ✅ | Rules fix first: `shortOne` recharge + pools (`kind`), raise the max limit; old data still imports | S | Fixes a real Short Rest bug today |
| **F2** ✅ | Feature catalog (§4): rules table + text data, picker on the sheet, detail view with SRD text, use button (spend, action economy, log, dice) | L | The new request |
| **E4** ✅ | All class features listed on the sheet up to the character's level (English text); wizard and level-up add catalog features automatically | M | Uses F2 data |
| **E5** ✅ | Starting equipment in the wizard (class A/B + background) → inventory with armor/weapons equipped | M | Needs E1–E3 |
| **E6** ✅ | Monster Initiative from Open5e `srd-2024`; Legendary Action uses from the PDF | S | Known gaps |
| **E7** ✅ | Lookup tabs: Equipment, Weapon Mastery & Properties, Feats, Class features, Poisons | S | |
| **Q** ✅ | QA #2 (🎲 button covers buttons), QA #3 (`React.lazy` DM screens) | S | Done in QA pass 5 + `9bd49a9` |

E1–E7, F1, F2 all done 2026-10-13 (E2: equip on the sheet, decided by the owner) (the official SRD 5.2.1 PDF found ~40 more cost/weight/tool/pack errors in the source; all fixed).
Order: **E1 → E2 → E3 → F1 → F2 → E4 → E6 → E5 → E7**. Before Phase 5 (first real session): E1–F2.

## 6. Owner decisions, round 2 (2026-10-13) — all done
1. **Upgrade button** for older characters: ✅ banner "⬆️" on the sheet → plan (item links, feature links/adds, wear the
   armor found for auto AC, optionally replace hand-made attacks) → "อัปเกรด" or "ไม่ต้อง" (`srdLinked` flag).
2. **Free casts** as catalog features: ✅ Elven Lineage / Fiendish Legacy spells (levels 3 and 5), Forest Gnome Speak
   with Animals, Mystic Arcanum 6–9.
3. **Poisons:** ✅ 14 SRD poisons in the equipment data (Lookup and inventory filter "พิษ").
4. **Starting weapons** stay in the pack; the player equips them (armor and Shield still worn). ✅
5. **Critical:** no extra button (turn Critical on in the roller). ✅
6. **Faster start:** ✅ DM screens lazy-loaded; main JS 754 → 426 KB.
7. Weapon Mastery choices stay untracked (owner decision).

## 7. Licensing notes
- Keep the existing CC-BY attribution (About page + `src/data/README.md`); add Open5e as the source of the
  Initiative numbers (the numbers are SRD 5.2.1 content, CC-BY-4.0).
- Never import Open5e documents other than `srd-2024`, and nothing from the PHB 2024 beyond the SRD
  (e.g. only one subclass per class, 4 backgrounds, 17 feats).

Sources: [5e-bits/5e-database 2024 files](https://github.com/5e-bits/5e-database/tree/main/src/2024/en) ·
[Open5e API](https://api.open5e.com/v2/documents/srd-2024/) · [Open5e releases](https://github.com/open5e/open5e-api/releases) ·
[SRD 5.2 announcement (D&D Beyond)](https://www.dndbeyond.com/posts/1717-2024-core-rulebooks-in-digital-formats) ·
[Foundry dnd5e](https://github.com/foundryvtt/dnd5e) · [The DM's Toolkit API](https://apisearch.thedmstoolkit.com/)
