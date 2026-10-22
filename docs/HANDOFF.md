# Handoff — state on 2026-10-22

> **Updated 2026-10-22** for handing work to Claude Code on the owner's Mac. New: "Before you start", "Working rules",
> Phase 7 (PRs #19–#27), Session 1 played, new next steps. Removed as outdated: "Suggested next: the first real session"
> (it was played 2026-10-18) and "Reply in English" under owner preferences (the team rule is now Thai).

## Before you start (Claude Code on the Mac)
- This folder (`/Users/mac/Claude Project/DND`) **is the git clone** of https://github.com/Strongfinger/dnd-table-companion.
  On 2026-10-22 it sat at `55d28ca` (PR #26); `origin/main` is at `1db62e0` (PR #27). Run `git pull` first
  (PR #27 adds `tools/agent-guild/` and changes only `docs/TEAM.md`, so the uncommitted edits in ROADMAP/HANDOFF/QA pull cleanly).
- The 2026-10-22 edits to `docs/ROADMAP.md`, `docs/HANDOFF.md`, `docs/QA.md` are **not committed**. Commit them on a
  branch + PR (the repo is public), don't push to `main`.
- Untracked folders, **do not commit**: `agent-guild/` (the owner's local copy of `tools/agent-guild/`, used by
  `install.py` hooks) and `docs/Character Art/` (new party looks based on real friends' faces; ask the owner, or add it
  to `.gitignore` with his OK).
- Private, git-ignored: `docs/DM Scripts/` (campaign packs, session scripts, backups), `docs/Character Sheets/`,
  `docs/Owlbear-Rodeo/`, `docs/DND-TH/`, `.env.local`.

## Working rules (owner's standing rules, see [TEAM.md](TEAM.md))
- **Merge a PR only when Tan says so** ("merge", "merge เลย"). `main` deploys to Vercel at once.
- **Ask Tan before every Gemini image run** (what, how many, which model) and wait for a yes. Credits are limited.
- **Wait for Tan's go-ahead** before anything that can't be undone: publishing Firebase rules, Vercel settings,
  deleting data, sending things to players.
- **Reply to Tan in Thai** (he writes Thai; TEAM.md says Thai; CLAUDE.md still has an older "reply in English" line).
  UI in Thai, D&D terms in English, SRD 5.2.1 content only, no AI in the app, no secret keys in code.
- One task = one thread/branch; flow BA → developer/UX → tests + build → PR assigned to Tan → qa-tester +
  content-reviewer → Tan merges. Run `content-reviewer` after changing `src/rules/` or game content.
- Agent status board: update the agent's row (cloud threads via `ArtifactData`; on the Mac the agent-guild hooks
  show local sessions). Details in TEAM.md.
- Stage only your own files (never `git add -A`).


**Start here.** The app is feature-complete for the table. Phases 0–4 and 3 are done, plus the content plan in
[docs/RESEARCH.md](RESEARCH.md) and the **Thai translation** of all SRD content (DND-TH's text, with permission).
A **playtest on 2026-10-16** found five problems; they were fixed on 2026-10-18 (PRs #1–#4). Then **Phase 6 (2026-10-19
to 10-21, PRs #5–#18)** added table extras the owner asked for: coin purse and equipment slots, temporary buffs, full
backup/restore, the journey chronicle, item pictures, Carrying Capacity, the reward pool with coin requests, magic items
on the sheet and a waist slot (see "Phase 6" below). All 278 SRD magic items are in.
**Session 1** of *Dragon of Icespire Peak* was played 2026-10-18 (5 players); its feedback became PRs #5–#9. Then
**Phase 7 (2026-10-21 to 10-22)**: party give, house rules, sheet tabs + fight tracker redesign, party overview
redesign, plus the agent team, UX kit and agent guild (PRs #19–#27, all merged). No PR is open.
**Suggested next:** Session 2, then a fix pass; see "Next steps" at the bottom.
Progress page: `npm run roadmap` → `docs/roadmap.html` (git-ignored; a local post-commit hook rebuilds it).

## Run, test, deploy
- **Live:** https://dnd-table-companion.vercel.app (Vercel auto-deploys `main`; installable offline PWA)
- **Dev:** `npm run dev` (launch config `dev`, :5173) · `preview` = production build on :4173
- **Checks:** `npm test` (781 passing after PR #26) · `npx tsc -b` · `npm run lint` · `npm run build`
- **Rules:** D&D 2024 / SRD 5.2.1 only. Pure rules in `src/rules/`; run the `content-reviewer` agent (was rules-reviewer) after
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
| Buffs (temporary effects) | Rules `src/rules/buffs.ts` (flat bonuses to AC/Speed/Attack/Saves/Skill Checks/Initiative, added in `deriveSheet`; same name = no stacking; rests end them by duration), actions `addBuff`/`removeBuff` in `characterActions.ts` (players in a room may only remove), UI `src/screens/BuffPanel.tsx` (play panel on the sheet and the tracker row of a PC) |
| Reward pool + coin requests | Model `src/model/rewards.ts` (pool, take, coin requests, `dmRunsEconomy`, `keepDmEconomy`), storage `src/db/rewards.ts` (DM device settings `reward-pool`, `coin-requests`), UI `src/screens/RewardDesk.tsx` (DM tab "🎁 คลังกลาง" with "+ ของรางวัล", "💰 คำขอเงิน", bar under the tabs), sheet `Inventory.tsx` (`PoolPicker`, `CoinRequestForm`). A character run by a DM on another device (player in a room, or filed under another device's campaign) takes items only from the pool and asks the DM for coin changes; the DM's device keeps coins and refuses extra items in incoming sheets. Room messages `pool`, `coinRequests` (DM → all), `take`, `coinRequest` (player → DM, through the outbox) |
| Give to a friend (ส่งของในปาร์ตี้) | Model `src/model/give.ts` (`giveItem` pack items only, keeps name/slot/weight/text/✨/picture, stacks on the same item; `giveCoins` breaks bigger coins like paying; `parseGive`), storage `src/db/give.ts` (`giveNow`: both sheets in one transaction + a 🤝 log line on each), UI `src/screens/GiveForm.tsx` ("🤝 ส่งให้เพื่อน" on an item, "🤝 ส่งเงินให้เพื่อน" under the purse). Player in a room: friends = party cards, room message `give` (player → DM, through the outbox); the DM's device moves it only if the receiver is played in the room. Elsewhere: other characters saved on the same device in the same campaign, moved at once. A DM-run character outside the room can't give. **Phase 3 (2026-10-22): in a room a give is a pending OFFER, nothing moves until the receiver taps accept.** Pure model `src/model/giveOffer.ts` (create / accept / remove, failed offers with a Thai reason), DM-device storage `src/db/giveOffers.ts` (settings key `give-offers`, not in backups; accept = one transaction, a second accept does nothing; cleared when the DM leaves or opens a room), room messages `giveOffer`, `giveAccept`, `giveDecline`, `giveCancel` (player → DM through the outbox) and `giveOffers` (DM → all, resent on join), UI `src/screens/GiveOffers.tsx` (incoming notice on every page, "🤝 รอ X รับ" under the item or purse with ยกเลิก; give sheet shows waiting). Offers never expire. An older phone's plain `give` message is treated as an offer. Characters on one device (no room, or the DM's device) still move at once. No DM approval |
| DM panel (next to tracker) | `src/screens/DmPanel.tsx`: stat block following the turn (`findMonsterForCombatant`), lookup, 🎲 generators, 📒 notebook, fight log |
| Player view | `src/model/playerView.ts`, `src/screens/PlayerViewPanel.tsx`, `LiveFightBar.tsx`, `PlayerFights.tsx` (read-only combat tab) |
| Live room | `src/app/lobby.tsx` (LobbyProvider: connection, sync, outbox, rest), `src/app/useLobby.ts`, `src/screens/Lobby.tsx` (`#/lobby`, QR `#/lobby/CODE`) |
| Sync protocol (pure) | `src/sync/` — `envelope.ts` (kinds, Deduper, RateLimiter), `sheets.ts`, `outbox.ts`, `fights.ts` (fight list, log diffs), `lobby.ts`; transports `firebaseTransport.ts`, `localTransport.ts` |
| Sync bookkeeping | `src/model/sync.ts` (DATA_VERSION 2, `stamp`, `newerOf`, `mergeDraft`), `src/model/campaign.ts`, `src/db/device.ts` |
| SRD equipment | `src/model/equipment.ts` (types, loader, table-style lines), data `src/data/srd-equipment.json` (`scripts/srd/equipment.mjs`); sheet: `src/screens/Inventory.tsx` (SRD picker, packs unpack, ถือ/สวม toggle) and `Attacks.tsx` (🎯 attack / 💥 damage open the floating roller via `src/ui/rollerBus.ts`, rolls carry a `label`); rules `src/rules/weapons.ts` + `armor.ts` (AC, training, drawbacks), model `src/model/inventory.ts` (`applyAutoAC`: with `acAuto` the stored `ac` is worked out from equipped armor, so tracker/party views need nothing new) |
| SRD lookup | `src/screens/Lookup.tsx` (`#/lookup/...`; tabs monsters, spells, rules, equipment, items, features), `src/ui/MonsterStatBlock.tsx`, `src/model/monsterDetails.ts`, `spells.ts`, data hooks `src/screens/useSrdData.ts` |
| Thai text (DND-TH) | Shared: `src/model/dndTh.ts`, `src/ui/ThaiText.tsx`, `src/ui/useTextLang.ts`. Magic items: `magicItemsTh.ts`, `scripts/srd/magic-items-th.ts`, `useMagicItemsTh`. Feats (and later class features/species): `src/model/featuresTh.ts`, `scripts/srd/features-th.ts` → `src/data/srd-features-th.json`, hook `useFeaturesTh`, `src/screens/FeatureText.tsx`. Spells: `src/model/spellsTh.ts` (build: match 2024 DND-TH entries to SRD ids, split higher-level/material, typo finder), `scripts/srd/spells-th.ts` → `src/data/srd-spells-th.json`; hooks `useSpellsTh` (via `import.meta.glob`, optional file) + `useTextLang` (`src/ui/useTextLang.ts`, TH/EN for every card) in `useSrdData.ts`; `SpellCard` in `Lookup.tsx`; Thai names in search + sheet. Markdown: `src/model/miniMarkdown.ts` + `src/ui/MiniMarkdown.tsx` (bold/italic/lists/tables/headings, never raw HTML). Credits on the card and the About page |
| Journey chronicle (บันทึกการเดินทาง) | Model `src/model/chronicle.ts` (chapters per campaign, pictures as `![caption](img:<id>)`, `.md` import), storage `src/db/chronicle.ts` (Dexie v6 `chapters`, players' downloaded copies in `storyCache`), sharing `src/sync/chronicleShare.ts` (Firebase `chronicles/<20-char shareId>`, only changed chapters sent; campaign.`chronicleId` reaches players in the `campaign` room message), UI `src/screens/Chronicle.tsx` (`#/story` shelf, `#/story/c|s/…` reader, `#/story/m/<campaign>` DM list + share link/QR, `#/story/edit/<id>`), `src/ui/StoryText.tsx`, `src/ui/imageResize.ts` (≤1600 px WebP). Chapters are in backups |
| Notebook + planner | `src/screens/Notebook.tsx` (`#/dm/note/<id>`), `SessionPlan.tsx`, `src/ui/LinkedText.tsx`; `src/model/note.ts` (kinds, fields, `[[links]]`, backlinks), `sessionPlan.ts`. Kind `rule` = 📏 House rule (the group's own rules, marked as not official; fields status/type/trigger/effect/duration/who/official SRD rule). Players read them in the lookup tab `#/lookup/house` (`src/screens/HouseRuleSearch.tsx`): the DM's device sends the room campaign's rules in use (not "off") as room message `houseRules` (`src/model/houseRules.ts`, `src/db/houseRules.ts`); phones keep the last copy in settings `house-rules` |
| Campaign pack import | `src/model/campaignPack.ts` (pure parse, stable ids `<campaign>-<id>`), `src/db/campaignPack.ts`, `src/screens/ImportPack.tsx` (`#/dm/import`). The owner's Icespire Peak pack + generator `make_pack.py` live in `docs/DM Scripts/` (private, git-ignored) |
| Generators | `src/model/generators/` (`index.ts` pure with `rng`, `tables.ts` homebrew Thai content), `src/screens/Generators.tsx` |
| DM tab | `src/screens/DmHome.tsx` (`#/dm`, in this order: notebook, party rest `PartyRest.tsx`, coin requests, reward pool, generators, chronicle; hidden for players in a room). The SRD lookup is its own `📖 ค้นหา` tab for everyone |
| Storage | `src/db/` — Dexie DB version 6: characters, log, encounters, campaigns, settings, notes, chapters, storyCache |
| Inventory, coins, slots | `src/model/inventory.ts` (13 slots: head, neck, hands, ring1/2, cloak, body, waist, legs, feet, main/off hand, back; one item per slot; custom items get a `wear` slot), `src/model/carrying.ts` + `src/rules/carrying.ts` (Carrying Capacity, Speed cut), `src/screens/Inventory.tsx` |
| Item pictures | Painted `public/items/<srdId>.webp` (`scripts/item-art/gen.py`, Gemini) + game-icons.net icons (`scripts/item-icons/render.mjs`, CC BY 3.0, credited on About); `src/model/itemImage.ts` (custom items keep a small `image`), requirement in [ITEM-IMAGES.md](ITEM-IMAGES.md) |
| Buffs | `src/rules/buffs.ts` (flat numbers added by `deriveSheet`; some end on rests), `src/screens/BuffPanel.tsx`; worn ✨ Magic Items with an effect text show here too |
| Reward pool + coin requests | `src/model/rewards.ts` (pure), `src/db/rewards.ts` (pool saved in `settings` key `reward-pool`, transactions), `src/screens/RewardDesk.tsx`; room messages `pool`, `take`, `coinRequest`, `coinRequests`. A character run by another device can't add items/coins itself |
| Backup | `src/model/backup.ts` (pure, record-by-record checks), `src/db/backup.ts`, `src/screens/Backup.tsx` (`#/backup`; also reads a hand-made console dump) |
| Journey chronicle | `src/model/chronicle.ts` (`Chapter`, images ≤24, limits), `src/db/chronicle.ts` (tables `chapters`, `storyCache`), `src/sync/chronicleShare.ts` (Firebase `chronicles/{shareId}`), `src/screens/Chronicle.tsx` (shelf, book, manage, editor). The DM tab links to it |
| Help/glossary | `src/model/glossary.ts` (incl. Thai help for the 18 skills), `src/ui/help.tsx`, `src/ui/useHelp.ts` |
| Action suggestions | `src/model/actionSuggestions.ts` (`actionKindFor`: spells by SRD casting time, features by `activation`; Focus/Sorcery Points also under Bonus Action), `src/screens/ActionChoiceDialog.tsx` |
| Missing choices | `src/rules/missingChoices.ts` (subclass from level 3, empty ASI slots) → amber banner with "เลือก" on `CharacterSheet.tsx` |
| Sheet tabs + HP strip (PR #25) | `src/screens/CharacterSheet.tsx` (5 tabs ต่อสู้/ความสามารถ/คาถา/กระเป๋า/โน้ต, sticky tab bar uses `--nav-h`), `src/screens/HpCard.tsx` (HP + damage/heal above the tabs); tracker rows `CombatantRow.tsx` (quick HP −/+, tags, condition chips, ⋯ menu), dice docked in `DmPanel.tsx` on lg |
| Party overview (PR #26) | `src/screens/PartyOverview.tsx` (`#/party`: "ต้องดูแลก่อน" box, HP total, Passive Perception, sort, card/table view, give sheet), pure helpers `src/model/partySummary.ts`; give sheet reuses `GiveForm.tsx` |
| Agent guild (PR #27, tool) | `tools/agent-guild/` (`guild.html` board page, `server.py` local SSE on 127.0.0.1:4777, `install.py` adds/removes Claude Code hooks marked `#agent-guild` in `~/.claude/settings.json`, `open-guild.command`). Not part of the app build |
| Navigation | `src/app/router.ts` `goBack()` (previous in-app page, scroll restored); lookup pages have "← กลับ"; spell cards open in place on the sheet |

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
- **Party rest (DM tab, `src/screens/PartyRest.tsx`):** Long Rest = one tap; Short Rest = start/end period (`rest {since}`). Both use `lobby.playedIds` (handed-over characters included).
- **Leaving / rejoining (DM):** leaving keeps the room (`lobby-last-hosted`); the lobby offers "กลับเข้าห้องเดิม" with the same code, campaign, removed players and grants. A running short rest ends on leave. Players see a note while no DM is online.
- **Kicked players (2026-10-18):** the kick is shared through Firebase (`src/sync/lobby.ts`, `firebaseTransport.ts`),
  so a kicked player leaves every phone's member list, not only the DM's; "let back in" + rejoin shows them again.
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

- **Chronicle (2026-10-19):** `chronicles/{shareId}` (20-character id, any signed-in user reads, only its `owner` writes);
  rules in `database.rules.json`, published by the owner 2026-10-19 (he publishes by hand; re-publish only if the file changes).

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

## Phase 5: where things stand

1. **Playtest (2026-10-16) — done, fixes merged 2026-10-18** (PR #1 one commit per issue, #2, #3): DM can rejoin the
   room they left; Thai help for all 18 skills; Action/Bonus Action/Reaction/Concentration only suggest what fits;
   spell cards open in place + back button; 📖 ค้นหา tab for everyone; party rest on the DM tab (`lobby.playedIds`,
   fixes a Long Rest that skipped handed-over characters); missing subclass/ASI banner; kicked players leave every
   list. Checked with Playwright in test mode (two tabs); **Firebase online mode was not re-tested** after these.
2. **First real session (open, the owner's next game night):** first-time DM running *Dragon of Icespire Peak* with
   4 friends on phones (level 1: Fighter, Paladin, Rogue, Cleric; they build characters in the wizard at the table).
   - Private files in `docs/DM Scripts/` (git-ignored): `icespire-campaign-pack.json` (**v2**, 2026-10-13: 56 notebook
     pages, a 15-scene Session 1 plan, 7 prepared fights), `Session 1 - DM Prep.md`, the owner's Thai script PDFs.
   - `python3 "docs/DM Scripts/make_pack.py"` rebuilds the pack from the private DND-TH library (`docs/DND-TH/doip/`,
     skill `dnd-th-library`). Owner's choices: DND-TH wording · 2024 SRD stat blocks where they exist · the book's
     difficulty with safety valves · dragon d20 location rolls, Session 1 = scare only.
   - Import on the DM laptop: DM → 📒 → 📦 นำเข้าแพ็ก. Re-import is safe ("add only" keeps edits).
   - Battle maps and tokens: Owlbear Rodeo, files in `docs/Owlbear-Rodeo/` (third-party art, git-ignored).
   - Voices for read-aloud (prep time only, on the laptop): Paxa Labs Thai TTS, key `PAXA_API_KEY` in `.env.local`,
     never in the app (see Claude's memory `paxa-tts`).
   - **Never put test copies of the pack inside the repo** (e.g. `public/`): one leaked in `b5cd2a8` and is still in git
     history (owner decided not to rewrite it). Stage only your own files (never `git add -A`).
   - After the session: collect what broke or felt clunky in [docs/QA.md](QA.md), fix, and check that the Firebase
     cleanup ran.
3. **Thai translation — done** (2026-10-13 to 10-18). One builder + script + `src/data/srd-*-th.json` per kind
   (`spellsTh.ts`, `featuresTh.ts` for feats/class features/species, `magicItemsTh.ts`, `glossaryTh.ts`,
   `equipmentTh.ts`, `monstersTh.ts`); shared helpers in `src/model/dndTh.ts` (credit, `cleanMarkdown`, `findTypos`,
   `stripNonSrdNames`: DND-TH translates the full books, so non-SRD names like Tasha or Bigby are removed or the text
   stays English). UI: `src/ui/ThaiText.tsx`, `src/ui/useTextLang.ts` (one ไทย/EN choice for every card). Monsters:
   numbers stay the English data; Thai text with different numbers isn't used. Sources, checksums and typos for DND-TH
   are in `src/data/README.md`. Only SRD 5.2.1 entries; other `docs/DND-TH/` text stays out of the app.
   - **Gaps with no DND-TH text** (still English): 7 spells, 4 magic items, 16 equipment items, 1 class feature,
     1 monster. Could get our own translation.
4. **All 278 SRD 5.2.1 magic items are in (2026-10-18):** the 15 that 5e-bits lacks (Hat of Many Spells, Cloak of
   Invisibility, Sending Stones…) are built from the PDF (`PDF_ONLY` in `scripts/srd/magic-items.mjs`; category named
   like 5e-bits and checked against the other 263). Thai for 274 of 278 (see `src/data/README.md`).
5. **Not yet in the campaign pack:** follow-up quests (Butterskull Ranch, Loggers' Camp, Mountain's Toe, Axeholm,
   Dragon Barrow, Woodland Manse…) to add from the owner's own notes when they write them.

## Phase 6: table extras (2026-10-19 to 10-21, PRs #5–#18)
Requested by the owner (Tan) after the playtest. Written by parallel sessions; unit tests pass (749).
- **Inventory:** coin purse, custom items, one item per slot, two rings, waist slot (belts on the legs move there),
  edit/use/delete, tap a worn item to read it; worn/held items have no "use" button.
- **Carrying Capacity:** Str × 15 lb (Goliath one size larger), coins 50 per lb; over it Speed ≤ 5 ft, over double it 0.
- **Buffs:** DM-added flat effects (AC, Speed, attack, saves, skills, initiative); same-named penalties keep the biggest.
- **Reward pool:** the DM puts SRD equipment, ✨ SRD magic items or custom items in the pool; players take them. Coin
  changes by a player whose character a DM runs go through the DM as requests. The treasure generator can fill the pool.
- **Magic items:** custom items can be ✨ Magic Item with an effect (mini markdown, ≤2000 chars) and a short `summary`;
  `srd-magic-items-summary-th.json` has a Thai summary for all 278; "อ่านเพิ่มเติม" opens `#/c/<id>/item/<itemId>`.
  Only the DM edits effects of characters it runs.
- **Chronicle + backup:** see the code map. Chapters live on the DM's device and are included in backups.
- **UI:** one ไทย/EN button in the top bar sets every card (the old per-card switches are gone; a section on the room tab too).
- **Open/unknown:** ~~Firebase rules for `chronicles/` published?~~ Published by the owner 2026-10-19 and sharing works. The reward pool and coin requests are still unchecked over real Firebase. This handoff's older sections (Phase 5, Known limits) are still accurate.

## Phase 7: party tools, house rules, new look (2026-10-21 to 10-22, PRs #19–#27)
- **Party give (PR #21):** see the code map. Two-tab test room only.
- **House rules (PR #23 + QA fixes):** notebook kind `rule`; players read them at `#/lookup/house`. The owner's 3 rules
  pack is in the project files (`house-rules-pack.json`). Two-context test room only, not real Firebase.
- **UI redesign (PRs #25, #26):** sheet tabs with HP on top, quicker fight tracker, party overview with give sheet.
  Built with the UX kit (`.claude/ux-ui-kit/`, PR #24; project rules win over kit rules). Room view checked by code only.
- **Team (PRs #19, #22):** 10 agents in `.claude/agents/`, process in TEAM.md.
- **Agent guild (PR #27):** board artifact restyled; on the Mac Tan runs `python3 agent-guild/install.py` himself
  (Claude Code auto mode blocks editing `~/.claude/settings.json`; don't retry that for him), then double-clicks
  `open-guild.command`. Remove with `python3 install.py --uninstall` (see its README). Installed and confirmed moving on the Mac 2026-10-22 (hooks reach only sessions started after install).
- **Party character redesign (2026-10-22, not in the app):** all 5 new looks approved; images + design notes in
  `docs/Character Art/`, English prompt text for future chapter pictures in
  `docs/Character Art/คำบรรยายตัวละครใหม่ (สำหรับ prompt ภาพบทต่อไป).md` (the old chapter-1 reference sheet is outdated).
- **Chronicle:** chapter 1 with 14 pictures is live (Firebase `chronicles/` rules published by the owner, sharing works).

## Campaign state (for DM work)
- Party (all level 1 after Session 1, level 2 planned in Session 2): HypenosZ (Orc Paladin), PetchKung (Dwarf Cleric),
  Mobius (Elf Rogue), Griffith (Human Fighter), Gojo Satoru (Elf Ranger). All male.
- Session 2 package ready (2026-10-21): `docs/DM Scripts/Session 2/` (read-aloud, app pack with fights E7 Ochre Jelly
  and E1 orcs led by Grukthar, new NPC Silas Crowe) and `docs/Owlbear-Rodeo/Session 2/`. Import the pack with
  "add only" so the owner's edited notebook pages stay. Note: on the DM device the E7 fight has id `doip-fight-ochre-e5`.
- After each session: ask the owner to export a backup (`#/backup`), then recap → chronicle chapter → pictures (ask first).

## Next steps (suggested)
1. **Session 2** with friends; keep a list of problems during play. Confirm the real-phone checks in [QA.md](QA.md)
   ("Real-phone checklist").
2. **Fix pass** on that list (one commit per issue, like the playtest PR).
3. **Mule data bug:** English Mule in `src/data/srd-monster-details.json` is the Octopus stat block (5e-bits error);
   fix from the SRD 5.2.1 PDF (and check the Thai entry), run `content-reviewer`.
4. **Chapter 2** of the chronicle after Session 2 with the new character looks (Gemini only after Tan's yes).
5. Optional: our own Thai for the translation gaps; QR export; DM approval / receiver accept for party give.

## Owner preferences (also in Claude's memory and CLAUDE.md)
- Reply in Thai (updated 2026-10-22); UI in Thai with English game terms; generated proper names in English.
- Every dice roll: in-app roll **or** typed result from real dice.
- Guided rules with a DM override (warn, don't block); Point Buy in the wizard.
- No AI in the app (decided 2026-10-12); battle map = outside tool (e.g. Owlbear Rodeo).
- Adventure text (Icespire Peak) stays private in `docs/DM Scripts/` — the repo is public.
- Before building something with real design choices, ask a few questions first (the owner likes that).
- Small runnable steps; say how to see each step; commit and push each step.
