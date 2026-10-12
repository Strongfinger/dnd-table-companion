# Bundled game data

## srd-monsters.json

A slim list of the 341 monsters in the **System Reference Document 5.2.1** (2024 rules),
used by the combat tracker's monster quick-add. Each entry keeps only: id, name, size, type,
CR, XP, AC, HP (average and dice), speed, and the six ability scores.

- **Source:** [5e-bits/5e-database](https://github.com/5e-bits/5e-database),
  `src/2024/en/5e-SRD-Monsters.json` (downloaded 2026-10-11, 1,342,885 bytes,
  SHA-256 `34ec39f2b384a5e1ed11ac6d9e17601a19579ed67fd1775d21588d186714346f`).
- **Made by:** a one-off script that reads the file as plain data, checks every value's type
  and range, and writes only the fields above. The raw file is not kept in this repo.
- **Corrections:** XP is checked against the CR → XP table (`src/rules/challenge.ts`).
  The source had Archmage (CR 12) at 8,000 XP; corrected to 8,400.
- **Forms:** Vampire and the lycanthropes have one entry per form (e.g. "Werewolf, Hybrid Form"),
  which is why there are 341 entries rather than ~331 creatures.
- **License:** This work includes material from the System Reference Document 5.2.1
  ("SRD 5.2.1") by Wizards of the Coast LLC, available at https://www.dndbeyond.com/srd.
  The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License,
  available at https://creativecommons.org/licenses/by/4.0/legalcode.
- **Note:** the data has no initiative field, so the app uses the DEX modifier as the
  initiative bonus. Many 2024 stat blocks add their Proficiency Bonus (or twice it) to
  Initiative, e.g. Lich, adult dragons, Archmage; the DM can adjust the number when adding.

## srd-monster-details.json

The full stat block of each of the same 341 monsters, for the SRD lookup (joined with
srd-monsters.json by id; loaded only when the lookup opens). Keeps: alignment, what the AC comes from,
proficient saves, skills, vulnerabilities / resistances / immunities (damage and condition), senses,
languages, Proficiency Bonus, XP in lair, gear, and the traits, actions, bonus actions, reactions and
legendary actions (name, usage such as "Recharge 5–6" or "3/Day, or 4/Day in Lair", and text).

- **Source:** the same 5e-bits file as above (`src/2024/en/5e-SRD-Monsters.json`, downloaded
  2026-10-12, same SHA-256 `34ec39f2…346f`).
- **Made by:** `scripts/srd/monster-details.mjs` (kept in the repo; reads the file as plain data,
  checks every value, writes only the fields above). Run it again to rebuild.
- **Spell lists:** where a Spellcasting text stops at "the following spells:", the spells are added
  from the source's structured list, grouped as At Will / N/Day Each.
- **Not in the source data:** each monster's 2024 Initiative bonus (the app shows the DEX modifier and
  says so), the number of Legendary Action uses per round, and some spell notes such as
  "(level 5 version)". Check the SRD for those.

## srd-spells.json

The 339 spells of SRD 5.2.1 for the lookup (loaded only when the spell tab opens): name, level,
school, classes, casting time, ritual, range, components and material, duration, concentration,
description and the higher-level / cantrip-upgrade text.

- **Source:** 5e-bits/5e-database `src/2024/en/5e-SRD-Spells.json` (downloaded 2026-10-12,
  495,225 bytes, SHA-256 `16aa8e47a84c6b21ccc101c1ee7ab5b8a026da940985bc826b6b58aa1fe0b6bc`).
- **Made by:** `scripts/srd/spells.mjs` (reads the file as plain data, checks every value).
- **Correction:** Protection from Evil and Good had "Concentration up to 10 minutes" as its duration
  but was not flagged as Concentration; the script flags it and keeps the duration as "up to 10 minutes".

## srd-magic-items.json

SRD 5.2.1 magic items for the loot generator (263 entries): name, rarity, category, attunement and
description. Loaded only when the loot generator opens.

- **Source:** 5e-bits/5e-database `src/2024/en/5e-SRD-Magic-Items.json` (downloaded 2026-10-12,
  288,137 bytes, SHA-256 `c97abb7d570656f9329007f17d5bb4fddbe0d65d62abd141f66c1ff3b9c39d2f`).
- **Made by:** `scripts/srd/magic-items.mjs`. Every entry gets one rarity:
  "+1/+2/+3" parents (Weapon, Armor, Shield, Ammunition, Wand of the War Mage, Horn of Valhalla) are left
  out because each version has its own entry; Potions of Healing and Spell Scroll are split into their
  2024 tiers (Healing Common → Supreme Very Rare; scrolls Cantrip/1 Common, 2–3 Uncommon, 4–5 Rare,
  6–8 Very Rare, 9 Legendary); other "Rarity Varies" items are kept as "Varies" and not rolled as loot.
- **Note:** the source flattens tables inside descriptions (e.g. the potion and scroll tables), so the
  split tiers share their parent's description.
