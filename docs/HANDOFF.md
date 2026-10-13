# Handoff — state on 2026-10-13 (evening)

**Start here for Phase 5.** Since the morning: a **campaign pack import** (the owner's *Dragon of Icespire Peak*
Session 1 is prepared in it), and **Thai spell text from DND-TH** (with their permission). See "Phase 5: where to
start" below.


**Phases 0–4 and 3 are done**, plus the content plan in [docs/RESEARCH.md](RESEARCH.md) (2026-10-13): SRD weapons,
armor and gear in the inventory (equip on the sheet), attacks with separate attack/damage rolls, AC from armor,
the 2024 Short Rest rule + pools, a limited-use feature catalog, every class feature's text on the sheet, monster
Initiative and Legendary uses from the official PDF, starting equipment in the wizard, Lookup tabs for equipment and
features; owner decisions round 2 (upgrade button, free casts, poisons, lazy DM screens) done. **Suggested next:**
Phase 5 (a real session with phones), using the QA list in docs/QA.md.

## Run, test, deploy
- **Live:** https://dnd-table-companion.vercel.app (Vercel auto-deploys `main`; installable offline PWA)
- **Dev:** `npm run dev` (launch config `dev`, :5173) · `preview` = production build on :4173
- **Checks:** `npm test` (600 passing) · `npx tsc -b` · `npm run lint` · `npm run build`
- **Rules:** D&D 2024 / SRD 5.2.1 only. Pure rules in `src/rules/`; run the `rules-reviewer` agent after
  changing `src/rules/` (also worth it for new game content/data).
- **Reset a device:** About page → "ล้างข้อมูลในเครื่องนี้" (`src/db/reset.ts`). After a deploy, a device may run
  the old cached build until it reloads/updates; the About page shows the build time.

## Code map
| Area | Files |
|---|---|
| Rules engine | `src/rules/` (sheet, play, turns, diceExpr, spellslots, preparedSpells, classes, srd/, checks, creation, challenge) |
| Characters | `src/model/character.ts`, `characterActions.ts` (one reducer for every play change + `parseCharacterAction`), `actions.ts`, `io.ts` (import/export, also checks network sheets) |
| Play changes + permissions | `src/db/play.ts` `playAction(id, action, 'player'\|'dm'\|'system', ctx)` — every play change goes through it; rules in `src/model/permissions.ts`; sheet UI uses `src/screens/useCharacterAct.ts` |
| Feats + Level Up | Rules `src/rules/srd/featSlots.ts` (17 SRD feats, slots per class/level), model `src/model/feats.ts` (`featPicks` with recorded ability increases, older sheets placed into slots), `src/model/levelUp.ts` (draft, HP gain incl. retroactive CON, finish); UI `src/screens/FeatSlots.tsx` (edit page + level up), `LevelUp.tsx` (⬆️ on the sheet) |
| Upgrade older sheets | `src/model/upgrade.ts` (match names → SRD items, link/add features, wear armor), `src/screens/UpgradePanel.tsx` (banner until `srdLinked`) |
| Starting equipment | `src/rules/srd/startingEquipment.ts` (class A/B(/C) + background A/B, from the PDF), `src/model/startingGear.ts`; wizard step "อุปกรณ์" in `CreateWizard.tsx` |
| Feature catalog | Numbers in `src/rules/srd/limitedFeatures.ts` (uses/recharge/activation/dice per SRD feature id), English text in `src/data/srd-features.json` (`scripts/srd/features.mjs`, `src/model/featureTexts.ts`); `src/model/featureCatalog.ts` (add, refresh on edit save, add newly available on level-up, use plan; Action Surge = `actionSurge` play action); UI `src/screens/FeatureCatalog.tsx` (picker + card in the play panel), `ClassFeatures.tsx` (every feature's text on the sheet) |
| Character spells | `src/screens/SpellList.tsx` (list, SRD picker, ✨ cast panel), `src/model/characterSpells.ts`, `castSpell.ts`, `src/rules/preparedSpells.ts` |
| Fights | `src/model/encounter.ts`, `src/screens/Tracker.tsx`, `CombatantRow.tsx`, `AddCombatants.tsx`; `src/db/turns.ts` (`advanceTurn`, `addMonstersToFight` — shared by tracker, players' end-turn, lookup, generators) |
| DM panel (next to tracker) | `src/screens/DmPanel.tsx`: stat block following the turn (`findMonsterForCombatant`), lookup, 🎲 generators, 📒 notebook, fight log |
| Player view | `src/model/playerView.ts`, `src/screens/PlayerViewPanel.tsx`, `LiveFightBar.tsx`, `PlayerFights.tsx` (read-only combat tab) |
| Live room | `src/app/lobby.tsx` (LobbyProvider: connection, sync, outbox, rest), `src/app/useLobby.ts`, `src/screens/Lobby.tsx` (`#/lobby`, QR `#/lobby/CODE`) |
| Sync protocol (pure) | `src/sync/` — `envelope.ts` (kinds, Deduper, RateLimiter), `sheets.ts`, `outbox.ts`, `fights.ts` (fight list, log diffs), `lobby.ts`; transports `firebaseTransport.ts`, `localTransport.ts` |
| Sync bookkeeping | `src/model/sync.ts` (DATA_VERSION 2, `stamp`, `newerOf`, `mergeDraft`), `src/model/campaign.ts`, `src/db/device.ts` |
| SRD equipment | `src/model/equipment.ts` (types, loader, table-style lines), data `src/data/srd-equipment.json` (`scripts/srd/equipment.mjs`); sheet: `src/screens/Inventory.tsx` (SRD picker, packs unpack, ถือ/สวม toggle) and `Attacks.tsx` (🎯 attack / 💥 damage open the floating roller via `src/ui/rollerBus.ts`, rolls carry a `label`); rules `src/rules/weapons.ts` + `armor.ts` (AC, training, drawbacks), model `src/model/inventory.ts` (`applyAutoAC`: with `acAuto` the stored `ac` is worked out from equipped armor, so tracker/party views need nothing new) |
| SRD lookup | `src/screens/Lookup.tsx` (`#/lookup/...`; tabs monsters, spells, rules, equipment, items, features), `src/ui/MonsterStatBlock.tsx`, `src/model/monsterDetails.ts`, `spells.ts`, data hooks `src/screens/useSrdData.ts` |
| Thai text (DND-TH) | Shared: `src/model/dndTh.ts`, `src/ui/ThaiText.tsx`, `src/ui/useTextLang.ts`. Magic items: `magicItemsTh.ts`, `scripts/srd/magic-items-th.ts`, `useMagicItemsTh`. Feats (and later class features/species): `src/model/featuresTh.ts`, `scripts/srd/features-th.ts` → `src/data/srd-features-th.json`, hook `useFeaturesTh`, `src/screens/FeatureText.tsx`. Spells: `src/model/spellsTh.ts` (build: match 2024 DND-TH entries to SRD ids, split higher-level/material, typo finder), `scripts/srd/spells-th.ts` → `src/data/srd-spells-th.json`; hooks `useSpellsTh` (via `import.meta.glob`, optional file) + `useTextLang` (`src/ui/useTextLang.ts`, TH/EN for every card) in `useSrdData.ts`; `SpellCard` in `Lookup.tsx`; Thai names in search + sheet. Markdown: `src/model/miniMarkdown.ts` + `src/ui/MiniMarkdown.tsx` (bold/italic/lists/tables/headings, never raw HTML). Credits on the card and the About page |
| Notebook + planner | `src/screens/Notebook.tsx` (`#/dm/note/<id>`), `SessionPlan.tsx`, `src/ui/LinkedText.tsx`; `src/model/note.ts` (kinds, fields, `[[links]]`, backlinks), `sessionPlan.ts` |
| Campaign pack import | `src/model/campaignPack.ts` (pure parse, stable ids `<campaign>-<id>`), `src/db/campaignPack.ts`, `src/screens/ImportPack.tsx` (`#/dm/import`). The owner's Icespire Peak pack + generator `make_pack.py` live in `docs/DM Scripts/` (private, git-ignored) |
| Generators | `src/model/generators/` (`index.ts` pure with `rng`, `tables.ts` homebrew Thai content), `src/screens/Generators.tsx` |
| DM tab | `src/screens/DmHome.tsx` (`#/dm`; players in a room get `📖 ค้นหา` instead) |
| Storage | `src/db/` — Dexie DB version 5: characters, log, encounters, campaigns, settings, notes |
| Help/glossary | `src/model/glossary.ts`, `src/ui/help.tsx`, `src/ui/useHelp.ts` |

## Live rooms: how they work now
The **DM device is the source of truth**. Messages are envelopes (`src/sync/envelope.ts`): id (deduped),
sender taken from the connection (never the body), size limit; the DM device rate-limits (40 / 10 s / device).
- **Join:** DM opens a room for a campaign (6-letter code + QR). Players pick a character. Kick (DM re-kicks if
  they return) and "let back in". The room is saved, so reloads rejoin (test mode: per tab).
- **Sheets:** players send play changes as `action`s and edits as `hello {edit:true}` through a saved **outbox**,
  re-sent every 4 s until the DM `ack`s; the plain `hello` (full sheet) goes only when the outbox is empty.
  The DM saves applied ids (no double apply after reload), applies with `playAction(...,'player')`, and sends
  `state` (full sheet) whenever a played character changes. Edits merge by field (`mergeDraft` locally;
  `mergeEdit` on the DM: player owns the build, DM owns play state and slot/feature uses).
- **Fight:** DM sends the running fight's player view (`fight`; no monster HP/AC, hidden creatures left out),
  the list of started fights (`fights`) and player-safe log lines (`log`, with deletions and full copies on
  reconnect). Each player's character log mirrors the DM's.
- **Players' rules:** spend but never give back (actions, slots, features), no ↻ new turn, no rests; Action /
  Bonus Action only on their own turn in a fight; Hit Dice only during a DM-started short rest; read-only
  logs; can end their own turn (`endTurn`). The DM may give a use back only in the round it was spent.
- **Party rest (DM room screen):** Long Rest = one tap; Short Rest = start/end period (`rest {since}`).
- **Dice:** the floating roller shares rolls with the room (players on, DM off by default); the DM logs them.
- **Campaign:** players adopt the DM's campaign id; the DM can switch the room's campaign any time
  (`setCampaign` → `campaign` message). Rename/delete only on the device that created it (`canManageCampaign`).
- **Party view (players):** `party` message = read-only cards of every played character (`src/sync/party.ts`).
- **Level-up permission (2026-10-13):** `levelLock` on the sheet (DM-owned; `src/model/levelLock.ts`). The DM's device
  locks a player's character when it arrives, refuses sheets above the allowed level (edit and plain `hello`), and the
  room screen has "⬆️ ให้เลเวลอัป" per player. Locked everywhere once played; the campaign's own device can always level.
- **Handed-over characters:** the tracker's "🧑 เป็นตัวละคร" turns a monster/NPC into a sheet
  (`src/model/monsterCharacter.ts`, `monster` field: PB/Hit Die from the stat block). The DM can give it to a
  player (🎮 on its row): `session.grants` + `control` message; `mayChange`/`playedCharacterIds` include grants.

## SRD data (offline, loaded only when opened)
Built by scripts from 5e-bits/5e-database **2024** files (download to a scratch folder, then
`node scripts/srd/<script>.mjs <file>`); details, checksums and corrections in `src/data/README.md`:
`srd-monsters.json` (quick-add), `srd-monster-details.json` (stat blocks, `monster-details.mjs`),
`srd-spells.json` (`spells.mjs`), `srd-equipment.json` (`equipment.mjs`, checked line by line against the official SRD 5.2.1 PDF), `srd-magic-items.json` (`magic-items.mjs`; healing potion and spell scroll
tiers rules-reviewed). Monster Initiative and Legendary Action uses come from the official SRD 5.2.1 PDF
(`scripts/srd/monster-initiative.mjs`). Known gap: some spell notes like "(level 5 version)".
**Thai:** `srd-spells-th.json` from DND-TH's `spells.json` (`node scripts/srd/spells-th.ts <file>`); source, checksum
and the 7 untranslated spells in `src/data/README.md`.

## Firebase
- Project `dnd-table-companion`, Realtime Database **asia-southeast1**, **anonymous** sign-in; rules in
  `database.rules.json` (re-publish in the console if it changes). Web config in `.env.local` (git-ignored,
  `node scripts/firebase-env.mjs`) and the same 5 `VITE_FIREBASE_…` vars in Vercel (Production + Preview).
- Gotchas: write the member record **before** `onDisconnect`; start the message listener **after** joining;
  records carry the **send** time (`at`) because listeners read only recent ones; room codes never contain
  0/O/1/I/L (the rules reject them).
- **Cleanup (2026-10-13):** the rules let a room member delete messages older than 1 hour; the DM's device
  deletes its rooms' messages older than 2 hours (current + last 5 hosted, `lobby-hosted-rooms` setting) on
  opening and every 15 min (`cleanupOldMessages`). Rules published by the owner 2026-10-13. Old abandoned
  rooms the DM device was never in stay.

## Testing tips
- Two tabs of one browser share IndexedDB **and** the Firebase sign-in, so they can't test sync. Use the
  fake devices in `scripts/lobby-test/` (each file's header says how): `player.cjs`, `dm.cjs`, `resync.cjs`,
  `permissions-dm.cjs` (`--not-my-turn`), `permissions-player.cjs`, `logs-player.cjs`, `rest-player.cjs`.
- Test mode (checkbox on the lobby screen in dev) = BroadcastChannel between tabs, no Firebase.
- The dev browser's data has test characters (Nyx, Node the Bard, ทดสอบ Wizard…) and a fight
  "ทดสอบ SRD" that wasn't created by Claude — leave it.

## Known limits / open items
- Anyone can join a room claiming `role: 'dm'` (fine among friends).
- Sheets over ~64 KB can't be sent; whole-sheet "higher rev wins" when a plain `hello` meets an old DM copy.
- Casting warns (2024, SRD 5.2.1): Ritual needs the spell prepared (not Wizards); one spell slot per turn
  (`turn.spellSlot`, Reactions excepted). The old 2014 "Bonus Action spell → cantrip" rule no longer exists.
- Generators' loot amounts and encounter XP budget are a homebrew guide (labelled in the UI).

## Phase 5: where to start

1. **First real session (owner's next game night):** the owner is a first-time DM running *Dragon of Icespire
   Peak* with 4 friends on phones (level 1: Fighter, Paladin, Rogue, Cleric; they build characters in the wizard at
   the table). Prep is done:
   - Private files in `docs/DM Scripts/` (git-ignored): `icespire-campaign-pack.json` (52 notebook pages, a
     13-scene Session 1 plan, 6 prepared fights; regenerate with `make_pack.py`), `Session 1 - DM Prep.md`
     (checklist, danger notes, how to run it in the app), and the owner's original Thai script PDFs.
   - Import on the DM laptop: DM → 📒 → 📦 นำเข้าแพ็ก. Re-import is safe ("add only" keeps edits).
   - After the session: collect what broke or felt clunky (docs/QA.md) and fix. Check the Firebase cleanup live.
2. **Thai translation (Phase 5 item, ROADMAP):** spells, feats, magic items, class features and species traits
   are done (class/species parsed from DND-TH's markdown pages: `classSections`/`traitSections` in
   `featuresTh.ts`; one script builds all of `srd-features-th.json`, see `src/data/README.md`). Shared helpers in
   `src/model/dndTh.ts` (credit, `cleanMarkdown`, `findTypos`, **`stripNonSrdNames`** + `nonSrdName`: DND-TH
   translates the full books, so names the SRD drops, e.g. Tasha, Bigby, Heward, Kwalish, Dragonlance, are taken
   out or the text stays English). One builder + script + `src/data/srd-*-th.json` per kind:
   `spellsTh.ts`, `featuresTh.ts` (keyed by `srd-features.json` ids: class features and species traits go into the
   **same file** and show up via `FeatureText.tsx`), `magicItemsTh.ts` (aliases for renamed/tiered items).
   UI: `src/ui/ThaiText.tsx` (`LangSwitch`, `ThaiCredit`, `WithThai`), `src/ui/useTextLang.ts` (one ไทย/EN choice
   for every card). Magic items: Lookup tab 🪄 ไอเทมเวท (`MagicItemSearch` in `LookupMore.tsx`) and the loot
   generator. `miniMarkdown` now reads `*italic*` and `***bold italic***`. **Rules Glossary** (all 154 SRD
   entries, from the private `docs/DND-TH/free-rules/rules-glossary.md`, owner confirmed DND-TH's OK for the app):
   `glossaryTh.ts`, `src/ui/useGlossaryTh.ts`; 📖 rules tab and the phone help sheet ("📖 อ่านกติกาเต็ม").
   Other `docs/DND-TH/` text (adventures, non-SRD) stays out of the app. **Equipment** (`equipmentTh.ts`,
   `useEquipmentTh`): Thai names everywhere items are listed or searched, Thai text only where the SRD English has
   text, tool uses, property/mastery text. **Next: monsters** (owner planned it for next week, 2026-10-13).
   - JSON (2014 + 2024 mixed; keep `version: "2024"` and SRD 5.2.1 entries only):
     `https://dnd-th.com/data/{feats,magic-items,monsters,equipments}.json`
   - Class features and species: markdown zips from DND-TH in the owner's `~/Downloads/resrd5_2_1/`
     (`2024-classes.zip`, `2024-races.zip`; not in git).
   - Same pattern as spells: build script → separate `src/data/srd-*-th.json` → TH/EN switch, credit DND-TH.
     Suggested order: ~~feats~~ → ~~magic items~~ → ~~class features/species~~ → ~~glossary~~ → ~~equipment~~ → monsters (next week).
   - DND-TH asked to hear about typos; the build scripts list them (spells: 5 sent to the owner to forward;
     feats/classes: Grappler "น้้น" → "นั้น", Barbarian Weapon Mastery "เปลีี่ยน" → "เปลี่ยน"; glossary: 7, listed
     in `src/data/README.md`).
3. **Not yet in the campaign pack:** follow-up quests (Butterskull Ranch, Loggers' Camp, Mountain's Toe, Axeholm,
   Dragon Barrow, Woodland Manse…) to add from the owner's own notes when they write them.

## Next steps (suggested)
0. **QA findings:** see [docs/QA.md](QA.md) (bugs fixed, open findings for the implementor; top one: attacks/weapons
   and class features on the sheet).
0b. **Content plan:** [docs/RESEARCH.md](RESEARCH.md) (2026-10-13): SRD 5.2.1 sources checked, data errors to correct,
   owner decisions, limited-use feature catalog (F1–F2), steps E1–E7 (weapons/attacks, equipped armor AC, class features,
   starting gear, monster Initiative). Order: E1 → E2 → E3 → F1 → F2 → E4 → E6 → E5 → E7.
1. **Phase 5:** a real session with friends on several phones; collect what broke or felt clunky; fix.
3. "Later" list in `docs/ROADMAP.md`: SRD weapons/armor help and data, class-feature actions, QR export.

## Owner preferences (also in Claude's memory and CLAUDE.md)
- Reply in English; UI in Thai with English game terms; generated proper names in English.
- Every dice roll: in-app roll **or** typed result from real dice.
- Guided rules with a DM override (warn, don't block); Point Buy in the wizard.
- No AI in the app (decided 2026-10-12); battle map = outside tool (e.g. Owlbear Rodeo).
- Adventure text (Icespire Peak) stays private in `docs/DM Scripts/` — the repo is public.
- Before building something with real design choices, ask a few questions first (the owner likes that).
- Small runnable steps; say how to see each step; commit and push each step.
