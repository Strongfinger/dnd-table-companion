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
- **Initiative (`init`):** the 2024 Initiative bonus of each stat block, added on 2026-10-13 from the official
  SRD 5.2.1 PDF by `scripts/srd/monster-initiative.mjs` (the 5e-bits data has none). All 341 ACs match the PDF,
  and every value equals Open5e's `srd-2024` data. The PDF misprints two scores (Gray Ooze "−2 (13)", Invisible
  Stalker "+7 (22)"); the bonus is used. Archmage's +7 isn't DEX + n×PB but is what the SRD prints.

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
- **Legendary Action uses (`legendaryUses`, e.g. "3 (4 in Lair)"):** added from the SRD 5.2.1 PDF by
  `scripts/srd/monster-initiative.mjs` (32 entries, counting each Vampire form).
- **Not in the source data:** some spell notes such as "(level 5 version)". Check the SRD for those.

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

- **Source:** item list, rarity, category and attunement from 5e-bits/5e-database
  `src/2024/en/5e-SRD-Magic-Items.json` (downloaded 2026-10-12, again 2026-10-13 unchanged, 288,137 bytes, SHA-256
  `c97abb7d570656f9329007f17d5bb4fddbe0d65d62abd141f66c1ff3b9c39d2f`). **Descriptions from the official SRD 5.2.1
  PDF** (`SRD_CC_v5.2.1.pdf` from D&D Beyond, 6,031,375 bytes, SHA-256 `8974902d109d6e63672d7c490bde9ccf052410503d9cfa768237154fbc5e3d87`;
  "Magic Items A–Z", pp. 209–253), text taken out with
  `scripts/srd/pdf-text.py` (pypdf).
- **Made by:** `scripts/srd/magic-items.mjs <items.json> <srd.txt>`. Every entry gets one rarity:
  "+1/+2/+3" parents (Weapon, Armor, Shield, Ammunition, Wand of the War Mage, Horn of Valhalla) are left
  out because each version has its own entry (with the parent's text); Potions of Healing and Spell Scroll are split
  into their 2024 tiers (Healing Common → Supreme Very Rare; scrolls Cantrip/1 Common, 2–3 Uncommon, 4–5 Rare,
  6–8 Very Rare, 9 Legendary); other "Rarity Varies" items are kept as "Varies" and not rolled as loot. The script
  checks each item's attunement and rarity against the PDF's type line.
- **Why the PDF texts:** every 5e-bits description was compared with the PDF (2026-10-13) and 186 of 263 differed.
  Wrong text: Potion of Gaseous Form held a Potion of Healing fragment; Potion of Heroism held the Gaseous Form text;
  Potion of Giant Strength held the Heroism text and Potion of Flying the Giant Strength table; Potion of Healing's
  table lost its Supreme row; Staff of Fire and Staff of Frost held pieces of other items and Staff of Power lost a
  sentence and its table; rows missing
  from the tables of Amulet of the Planes, Bag of Beans, Deck of Illusions, Mysterious Deck, Efreeti Bottle, Robe of
  Useful Items, Wand of Wonder, Sphere of Annihilation, Necklace of Prayer Beads, Ring of Resistance and others;
  130 run-together words ("whereyou", "yourlast"); missing paragraph breaks; every table flattened. Patching that
  would have meant rewriting most texts, so the script takes the text from the PDF instead.
- **Text format:** `"<type>  \n <paragraph>  \n <paragraph>…"`. Tables are written out by hand in
  `scripts/srd/magic-item-tables.mjs`, one row per line with cells split by `" | "` (the PDF's text jumbles table
  cells); the script checks each table uses the same words as the PDF lines it replaces. Also there: the stat blocks
  of the Giant Fly (Figurine of Wondrous Power) and the Avatar of Death (Mysterious Deck). Words broken over two
  lines ("be- comes") are joined when the joined word is a real word or the second part a suffix ("-ing"); compounds
  ("bright-pink", "50-foot-long") keep the hyphen. Checked: the prose matches the PDF word for
  word.
- **Not in the app yet:** 15 SRD 5.2.1 items that 5e-bits doesn't have: Bead of Nourishment, Cloak of Invisibility,
  Elixir of Health, Energy Bow, Gloves of Thievery, Hat of Many Spells, Potions of Invulnerability, Longevity and
  Vitality, Quarterstaff of the Acrobat, Rod of Resurrection, Sending Stones, Sentinel Shield, Shield of the Cavalier,
  Thunderous Greatclub.

## srd-equipment.json

SRD 5.2.1 equipment (182 items: 38 weapons, 12 armors, Shield, ammunition, packs, tools, spellcasting foci,
adventuring gear) with cost, weight and the fields the app uses: weapon category, melee/ranged, damage
dice and type, properties, Weapon Mastery, ranges, Versatile dice, ammunition; armor category, base AC,
DEX cap, Strength minimum, Stealth Disadvantage; tool ability and uses; pack contents. Also the texts of
the weapon properties (10, incl. Range) and the 8 Weapon Mastery properties. Loaded only when needed.

- **Source:** 5e-bits/5e-database `src/2024/en/` (downloaded 2026-10-13):
  `5e-SRD-Equipment.json` (192,438 bytes, SHA-256 `4219c83f945f2c1a9a0029ee1bd8ff492d70d1eefd8d42546630ef6b5eef4f22`),
  `5e-SRD-Weapon-Properties.json` (SHA-256 `a881e9fd8de5e332483871aa9a4e66756cef305582f96a5ff26198477a833db2`),
  `5e-SRD-Weapon-Mastery-Properties.json` (SHA-256 `0932ec552adfc63fdf87d8e5c3fad4035a728092c78e1c8a32a8712c4ce6d969`).
- **Made by:** `scripts/srd/equipment.mjs` (reads the files as plain data, checks every value).
- **Corrections:** the source has some 2014 values and gaps. Every weapon, armor, gear, tool and pack row was
  diffed against the official SRD 5.2.1 PDF (`SRD_CC_v5.2.1.pdf` from D&D Beyond, tables on pp. 91–99) and fixed in
  the script (`CORRECTIONS`, `ITEM_FIXES`): Trident 1d8 / Versatile 1d10; Sling Bludgeoning; Morningstar 5 ft.;
  Hide Armor is Medium; costs or weights of Dart, Javelin, Spear, Mace, Pike, Longbow, Hand Crossbow, Chain Shirt
  and 16 gear items; Poisoner's Kit 50 GP, Viol 1 lb.; Brewer's and Tinker's Utilize DCs, Glassblower's Utilize,
  Disguise Kit as a tool; all 7 packs' weights and contents written from the SRD text.
- **Poisons (kind `poison`, 14):** from `5e-SRD-Poisons.json` (6,137 bytes, SHA-256
  `e0aa4d9eba7f90d1344d4e36f95232b312cbb991afa86b8f1f7627bd4d8b160d`): price per dose, type, text. Types, save DCs
  and prices match the PDF's Sample Poisons.
- **Not in the SRD table:** Spellbook (the Wizard's class item) keeps the source's 50 GP, 3 lb.

## srd-features.json

The English rules text of the SRD 5.2.1 class and subclass features (232), species traits (67) and feats (17),
for the sheet's feature cards and the lookup. Loaded only when needed. The numbers the sheet uses (uses per
level, recharge, dice) are not in this file: they are in `src/rules/srd/limitedFeatures.ts`, keyed by the same ids.

- **Source:** 5e-bits/5e-database `src/2024/en/` (downloaded 2026-10-13): `5e-SRD-Features.json`
  (184,384 bytes, SHA-256 `6390b3a1ad2ae68ad21516c38309799f610f893cb008cd3ad920d0eed89f8249`),
  `5e-SRD-Traits.json` (53,892 bytes, SHA-256 `acbe77b03e08959b6d8901b10d7d9eaad57a2624af121c4ef72157c708bf9427`),
  `5e-SRD-Feats.json` (9,773 bytes, SHA-256 `f80bf64d46b4addb5d991c6b4b1e05e8c0f9209ffbae297222c5439022abcbc3`).
- **Made by:** `scripts/srd/features.mjs`. Text clean-up: the PDF's line-break hyphens ("ex- pended") are joined
  when the joined word is a real word (the texts' own words plus the system word list); a few dashes the source
  lost ("Strength-with" → "Strength—with") are put back by a short fix list in the script.

## srd-spells-th.json

Thai name, description, higher-level text and material component for **332 of the 339** SRD 5.2.1 spells,
by spell id. Translation by **DND-TH** (https://dnd-th.com/), licensed **CC BY-NC-SA 4.0**, and used with
DND-TH's permission (email to the owner, 2026-10-13: "use it freely"). The 7 spells DND-TH hasn't translated
(Floating Disk, Arcanist's Magic Aura, Faithful Hound, Private Sanctum, Resilient Sphere, Secret Chest,
Instant Summons) stay English.

- **Source:** https://dnd-th.com/data/spells.json (downloaded 2026-10-13, 1,358,286 bytes,
  SHA-256 `55370171c69f59dc3cf527e92b0d9540fa2f8c2f11a738835934cddfab2c7c02`). It holds 2014 and 2024
  spells together; only `version: "2024"` entries that are SRD 5.2.1 spells are kept, matched by English
  name (also without the wizard's name, e.g. "Tasha's Hideous Laughter" = Hideous Laughter, plus
  Bigby's Hand = Arcane Hand and Mordenkainen's Sword = Arcane Sword).
- **Made by:** `node scripts/srd/spells-th.ts <spells.json>`. Links to DND-TH pages become plain text; the
  higher-level paragraph and the material note are split off; the rest stays simple markdown, shown by
  `src/ui/MiniMarkdown.tsx` (never as HTML).
- **Typos:** the script lists likely typos; DND-TH asked to be told about them.
- **Non-SRD names (2026-10-13):** DND-TH's Thai names keep the wizards the SRD drops ("…ของทาชา", "มือของบิกบี้").
  `stripNonSrdNames()` in `src/model/dndTh.ts` takes them out (10 names changed; Arcane Hand/Sword get
  "มือเวทมนตร์"/"ดาบเวทมนตร์"); texts that still name a non-SRD world or person stay English.

## srd-features-th.json

Thai name and rules text for SRD 5.2.1 features, by the same ids as `srd-features.json`: **all 17 feats**,
**231 of 232 class and subclass features**, **37 of 67 species traits** (every base trait; the 30 left are
variant entries such as "Giant Ancestry: Cloud's Jaunt" and lineage spells, whose base trait's Thai text covers
them). Translation by **DND-TH** (https://dnd-th.com/), **CC BY-NC-SA 4.0**, used with permission (2026-10-13).

- **Sources:**
  - https://dnd-th.com/data/feats.json (downloaded 2026-10-13, 122,204 bytes,
    SHA-256 `da4869c9d7083a871d5643553b3c01d339e32bacf7ea506d370c464cfe447203`): description, then each benefit
    as a paragraph (prerequisites left out, as in the English text).
  - DND-TH's 2024 class and species pages (their Thai *Free Rules*), from the owner: `2024-classes.zip`
    (176,676 bytes, SHA-256 `afbb2b9a24db28819b5f58b7eaefd72c671839aebdc2e01eefea9b527cd9a2b7`) and
    `2024-races.zip` (22,455 bytes, SHA-256 `b0dabaec485384720a9fd1c5172fa4addbf478d0e31da80b220d70dc7adf2896`).
    They also hold non-SRD subclasses and Aasimar; only sections matching an SRD feature are kept (by class,
    subclass, English name and level; traits by species and name, "Darkvision (120 ft.)" by its range).
- **Made by:** `node scripts/srd/features-th.ts <feats.json> <classes dir> <races dir>` (`src/model/featuresTh.ts`).
  Sidebars ("> …" boxes) are left out; spell ids like "2618887-fireball" become "Fireball"; people's names the SRD
  drops are removed.
- **Known gaps:** Circle of the Land Spells stays English (its Thai heading has no English name). DND-TH's
  Nature's Ward has no resistance table (the English one does).
- **Typos found (2026-10-13):** Grappler (Fast Wrestler) "น้้น" → "นั้น"; Barbarian Weapon Mastery "เปลีี่ยน" →
  "เปลี่ยน".

## srd-magic-items-th.json

Thai name and text for **259 of the 263** SRD 5.2.1 magic items, by the ids in `srd-magic-items.json`.
Translation by **DND-TH**, **CC BY-NC-SA 4.0**, used with permission (2026-10-13). Stay English: Amulet of the
Planes, Mace of Terror, Weapon of Warning (no 2024 DND-TH entry) and Dragon Orb (DND-TH's "Orb of Dragonkind" is
the longer Dragonlance artifact, not the SRD item).

- **Source:** https://dnd-th.com/data/magic-items.json (downloaded 2026-10-13, 904,478 bytes,
  SHA-256 `54c91a344c33bfc2fb9de2bcca51eef084b6e84427f4bab0152d62ca97aedadb`), 2014 + 2024 items; only 2024 SRD
  items kept. Matched by English name, plus `ALIASES` in `src/model/magicItemsTh.ts`: items the SRD renames
  (Handy Haversack = Heward's…, Apparatus of the Crab = Apparatus of Kwalish, Mysterious Deck = Deck of Many
  Things…) and DND-TH entries that cover several SRD items (+1/+2/+3, the four Potions of Healing, Spell Scroll
  levels, Horns of Valhalla, Crystal Balls; each gets the shared text and its own Thai name).
- **Made by:** `node scripts/srd/magic-items-th.ts <magic-items.json>`. People's names the SRD leaves out are
  removed from names and texts (`stripNonSrdNames`); an item whose text still names a non-SRD world is skipped.
- **Typos found:** none.
- **English data errors seen while comparing:** Potion of Gaseous Form's English `desc` was wrong and Potion of
  Healing's table garbled (5e-bits). The Thai text is right; the English texts now come from the PDF (see above).

## srd-glossary-th.json

DND-TH's Thai translation of the **SRD 5.2.1 Rules Glossary**: all **154 entries** (English name, Thai name, tag,
text), in glossary order. **CC BY-NC-SA 4.0**; the owner confirmed DND-TH's permission covers using it in the app
(2026-10-13). Every entry name was checked against the glossary in the official SRD 5.2.1 PDF (all present; the
SRD calls "D20 Tests" "D20 Test").

- **Source:** DND-TH's Thai Free Rules page `rules-glossary.md` (the owner's private copy in `docs/DND-TH/`,
  git-ignored; 202,956 bytes, SHA-256 `ef3cee76e02624178ddebc35566d5323e747495ae0dca5a0c34c66896ab5d00a`).
- **Made by:** `node scripts/srd/glossary-th.ts docs/DND-TH/free-rules/rules-glossary.md` (`src/model/glossaryTh.ts`).
  Dividers and sidebars dropped, links made plain.
- **Used by:** the 📖 rules tab (full text under our own short summaries, plus the other glossary entries) and the
  help sheet on phones ("📖 อ่านกติกาเต็ม"). Our terms link to entries via `srd` in `src/model/glossary.ts`; a test
  checks every link exists. Spell Save DC, Spell Slots and Massive Damage have no glossary entry.
- **Typos found:** Dash "ถ้้า"; High Jump "ฟุุต"; Malnutrition "อาาร" (อาหาร) and "ปอนด์s" (×3); Temporary Hit
  Points "คุุณ".

## srd-equipment-th.json

Thai names (and text where the SRD has text) for **180 of the 196** SRD 5.2.1 equipment items, by the ids in
`srd-equipment.json`, plus Thai text for all **10 weapon properties** and **8 masteries** (by English name).
Translation by **DND-TH**, **CC BY-NC-SA 4.0**, used with permission (2026-10-13). Stay English: the 14 poisons
and the 2 Spell Scroll lines (not in DND-TH's equipment file).

- **Source:** https://dnd-th.com/data/equipments.json (downloaded 2026-10-13, 340,972 bytes,
  SHA-256 `9e81287402e75cf090ae12849eb7c642936c8f928f86dc827288900574500538`; 2024 equipment, no version field).
  Matched by name in any word order ("Crossbow, Hand" = Hand Crossbow), also without "Armor" or spaces
  ("Leather" = Leather Armor, "Great Club" = Greatclub).
- **Only SRD text:** DND-TH translates the 2024 Player's Handbook, whose armor and weapons have flavour text the
  SRD doesn't, so an item gets a Thai description only when our English item has text. Tools get their Thai
  "Utilize" line.
- **Made by:** `node scripts/srd/equipment-th.ts <equipments.json>` (`src/model/equipmentTh.ts`).
- **Typos found:** none.

## srd-monsters-th.json

Thai monster names and stat block text for **340 of the 341** SRD 5.2.1 monster entries (each Vampire and
lycanthrope form counted), by the ids in `srd-monsters.json`: the traits, actions, bonus actions, reactions and
legendary actions, **1,385 of 1,392 entries**. Only words: every number on the card (AC, HP, scores, CR…) is still
the English data. Translation by **DND-TH**, **CC BY-NC-SA 4.0**, used with permission (2026-10-13).

- **Source:** https://dnd-th.com/data/monsters.json (the owner downloaded it 2026-10-18, 1,063,577 bytes,
  SHA-256 `857d8ff45a97b5af89c928316ac94a79e5dc482fc64f2ed61cb1fbbc25c3c7a1`): 334 `version: "2024"` monsters and
  2 homebrew ones (left out). One stat block per Vampire/lycanthrope; each of our forms takes the entries it has.
- **Made by:** `node scripts/srd/monsters-th.ts <monsters.json>` (`src/model/monstersTh.ts`). Each Thai entry is
  matched to ours by the English name in its header ("**_ควบคุมจิตใจ (Dominate Mind) (2/วัน)._**"), also without
  the note ("Entangling Rope (Requires Magic Rope)"), as a plural ("Vampire Weaknesses") or DND-TH's typo
  "Lighting Blade". Paragraphs without a header (spell lists, second paragraphs) join the entry before; the Legendary
  Actions intro is left out (the card writes its own).
- **Number check:** an entry is used only when its dice, DCs and bonuses equal the English text's (DND-TH writes
  "spell save DC 14" as "DC การทอยป้องกันคาถา 14"); a test checks the whole file. All match except Rhinoceros
  Gore, whose Thai leaves out "an extra 9 (2d8) Piercing damage" (stays English; worth telling DND-TH).
- **Stay English:** Warhorse Skeleton (no DND-TH entry); Mule, because **our English Mule is the Octopus stat
  block** (5e-bits error: Compression, Tentacles, Ink Cloud; the SRD 5.2.1 has both a Mule and an Octopus; fix the
  English from the PDF); Ancient Copper Dragon's "Spike (level 5 version)" entry (a 5e-bits split of its spell list).
- **Typos found:** none by `findTypos`. Seen by eye: Aboleth "ใต้นำ" (ใต้น้ำ), "Tentable" (Tentacle).
