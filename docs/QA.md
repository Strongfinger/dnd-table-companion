# QA log

QA passes: what was tested, what was fixed, and findings handed to the implementor.
Newest pass first. Implementor: move an item to "Done" (or delete it) when it ships.

> **Updated 2026-10-22:** added "Status now" and the "Real-phone checklist" below; marked items fixed since passes 5–8
> with ✅ (nothing removed).

## Status now (2026-10-22, `main` at PR #27)
- **Unit tests:** 781 passing after PR #26 (PR #27 is a tool outside `src/`). `tsc -b`, lint and build were clean on
  every merged PR. Run: `npm test`, `npx tsc -b`, `npm run lint`, `npm run build`.
- **Browser checks:** Playwright in test mode (two tabs / two contexts, BroadcastChannel, no Firebase) for PRs #1–#26.
  Fake devices for Firebase rooms: `scripts/lobby-test/*.cjs`.
- **Real table:** playtest 2026-10-16 (fixed in PRs #1–#3); Session 1 played 2026-10-18 (feedback → PRs #5–#9).
  No QA pass has been written for PRs #9–#26 on real phones over Firebase yet.
- **Open data bug:** English **Mule** in `src/data/srd-monster-details.json` is the Octopus stat block (5e-bits);
  fix from the SRD 5.2.1 PDF.

## Real-phone checklist (next session, Firebase, 2+ phones + DM laptop)
Nothing below has been checked over real Firebase on separate phones. Tick and date each one; write problems as a new pass.
- [ ] DM leaves and rejoins with "กลับเข้าห้องเดิม" (same code, players and grants kept) (PR #1)
- [ ] Kicked player disappears from **every** phone's member list; "let back in" shows them again (PR #3)
- [ ] Player characters move into the room's campaign ("Dragon of Icespire Peak") on join; imported packs stay in it (PR #6)
- [ ] Firebase cleanup: old room messages deleted (DM device, on open + every 15 min)
- [ ] Level-up permission: ⬆️ hidden until "⬆️ ให้เลเวลอัป", sheet above allowed level refused (Pass 6) — matters for level 2 in Session 2
- [ ] Reward pool: player takes an item; coin request → DM approves; DM's copy keeps coins (PR #16–#18)
- [ ] Party give: item and coins between two phones in the room; 🤝 log line on both (PR #21); give sheet on `#/party` (PR #26)
- [ ] House rules arrive at `#/lookup/house`, update when the DM edits, readable offline after the room ends (PR #23)
- [ ] Sheet tabs: sticky tab bar + HP strip on small phones, nothing hidden under the 🎲 button (PR #25)
- [ ] DM fight tracker: quick HP −/+, ⋯ menu, condition chips on the laptop; players' fight view still hides monster HP (PR #25)
- [ ] Party overview room view: care box, sort, card/table (PR #26, checked by code only)
- [ ] Renamed fight name reaches players (PR #11, code only)
- [ ] Chronicle chapter 1 opens on a player's phone via link/QR and offline afterwards (works for the owner, 2026-10-19)
- [ ] Handed-over monster removed from the player's phone after "เอาคืน" (Pass 4)
- [ ] Older items from "Next QA pass should also cover" below (equip in a live room, Action Surge/Second Wind off-turn, airplane mode → reconnect)

## Pass 8 — players read house rules (`houseRules` room message, lookup tab 📏 House rules), commit 4b34078, 2026-10-21
**Result:** pass. vitest 771/771, `tsc -b`, lint, build clean. **Tested** (preview build of HEAD, Chromium; DM 1280 px,
player 390 px; DM and player in **two separate browser contexts** = separate IndexedDB, local test-mode room with the
BroadcastChannel relayed between contexts by the test script): import `house-rules-pack.json` → #/lookup/house shows 3
rules; search (fire / Burning / trait / ไฟ / Thai two-word / no match "พบ 0 ข้อ"); expand shows all fields + body with
[[links]] as plain text; no overflow at 390 px. Live room "Dragon of Icespire Peak": player with a character joins → saved
`house-rules` = 3 rules (campaign `doip`), player lookup shows them, monsters tab hidden. DM changes Burning's effect and
sets Investigate Monster to ⚪ เลิกใช้ → player's copy updates to 2 rules with the new effect. Player leaves, copy cleared,
rejoins → rules re-sent; reload → re-sent. Untitled rule not sent. Rule in another campaign not sent; switching the room's
campaign sends that campaign's rules, switching back restores. After leaving the room the player still reads the last copy.
Old app + new `houseRules` kind: `parseEnvelope` (`src/sync/envelope.ts:45`) rejects unknown kinds → transports drop it
silently (`localTransport.ts:46`, `firebaseTransport.ts:113`); no crash. No console errors.

**Open (low):**
- ✅ Fixed (6e0d12a). **Single search result can't be collapsed.** `isOpen = open === r.id || found.length === 1`
  (`src/screens/HouseRuleSearch.tsx:38`) forces it open; tapping the header does nothing. Fix: auto-open only while
  `open` is unset for that id, e.g. track a "closed" id, or drop the auto-open.
- ✅ Fixed + test (6e0d12a). **Rule with an empty status (`status: ""`, e.g. from a pack) was not sent** while the editor shows 🟢 ใช้อยู่
  (`isShared` used `??`, `src/model/houseRules.ts:30`). Already changed to `||` in the uncommitted working tree; add a test
  (`rulesToShare([rule('X', { status: '' })], 'doip')` → 1 rule).
- ✅ Fixed (6e0d12a, filtered to the current campaign). **DM's own lookup tab mixes rules from all campaigns** (`ownRules`, `HouseRuleSearch.tsx:14`): with 2 campaigns the DM
  sees "Other Campaign Rule" next to DoIP rules, while players only get the room campaign's. Idea: filter to the current
  campaign (or label each rule with its campaign).
- **A player in the room without a character gets no rules** (nor campaign/pool/party): catch-up is sent only on the
  player's `hello`, which needs a character (`src/app/lobby.tsx:394`, resync at `:229`). Picking a character later fixes it.
  Pre-existing design; matters only for a "spectator" phone.
- Body text shows Markdown raw (`- item` lines) in the player view; the notebook page renders the same text. Cosmetic.
- ✅ Kept (`RuleSharedHint`, 6e0d12a). At HEAD the DM gets no warning that rule pages (body, linked page names) are shown to players; the uncommitted working tree
  adds `RuleSharedHint` in `Notebook.tsx`. Keep it.

**Check with real phones:** rules arrive over Firebase (not tested, test mode only); offline reading after the room ends.

## Phase 4 "ใช้ได้เลย" (usable now) on the player sheet, combat tab (2026-10-22)
**Status:** built in the PR "Phase 4 usable now". Checked in the browser at 360 px (caster + martial); **not** checked on a real phone or in a live room.

How to try it (phone, or a 360 px window): open a character sheet, tab ต่อสู้ (the first tab).
1. Top of the tab: a card "ใช้ได้เลย" with Action / Bonus Action / Reaction and jump chips (โจมตี, ช่อง N, พลัง N, คาถา N, Skills 18). Each chip should scroll to its block with the title visible under the sticky bar. A character without spells has no คาถา/ช่อง chip; without weapons no โจมตี chip.
2. Attacks are the first block (same 🎯 / 💥 buttons as before). They are no longer under "ระหว่างเล่น".
3. Spell slots: one row per level, `left/max` text, tap a full circle = use one, empty circle = give one back (a player in a room cannot give back: the circle is disabled). A level at 0 is dimmed with "หมด".
4. Limited-use features: grouped "คืนเมื่อ Short Rest" / "คืนเมื่อ Long Rest". A used-up feature is dimmed and says when it comes back. Pool features (Lay On Hands) keep the amount box + ใช้ / คืน (คืน only for DM or offline play).
5. Spells: grouped Action / Bonus Action / Reaction (and "อื่นๆ" for 1 minute+). Prepared (★) first, unprepared (○) after; a leveled spell with no slot at its level or higher is grey with "ช่อง Level N ขึ้นไปหมด" but still opens the cast panel. Cast one: the slot count above updates at once, the Action turns used.
6. Skills: 18 cells, modifier on the left, ● proficient / ★ Expertise. Tap one: the dice roller opens with `1d20+N` and the skill name; try both the roll button and typing a real dice result.
7. Check nothing important is hidden under the 🎲 button when each block is scrolled to its last row (the page has room at the bottom), and that all targets are 44 px or more.
8. Live room: have the DM start a Long Rest / give back a slot; the section on the player's phone should update without reload. At 0 HP, Death Saves appear above the section.
9. "ระหว่างเล่น" (below) now only has Concentration, Hit Dice and rests, Exhaustion, Conditions, Buffs.

## Pass 7 — PR #23 house rule pages (`rule` kind), 2026-10-21
**Result:** pass. vitest 765/765, `tsc -b`, lint, build all clean. **Tested** (preview build, Chromium, 1280 px + 390 px):
import `house-rules-pack.json` (3 rules, preview shows "📏 House rule × 3"), filter chip, open each rule (labels, house-rule
note, [[links]] + backlinks between Flaming Weapon and Burning), new rule (default 🟢 ใช้อยู่, all 7 fields, link in "ใครใช้ได้"),
edit status → ⚪ เลิกใช้ shows in the list line, search (Fire / Thai text / link target / case-insensitive), re-import "add only"
and "replace" (no duplicates), backup download keeps `kind: 'rule'` and `parseBackup` keeps all 5, no overflow at 390 px,
no console errors. Generators / ImportPack / DmPanel unaffected; notes are not synced to players.

**Open (low):**
- ✅ Fixed (fb23d53, `changeKind` in `src/model/note.ts`). **Changing a page's type keeps old field values that mean something else.** Quest → House rule keeps `status: 'open'`:
  the page shows raw "สถานะกฎ: open", the list line drops the status, and the editor select shows "🟢 ใช้อยู่" while `open`
  is stored (same for rule → quest with `active`, and place → rule with free-text `type`). Cause: the type select
  (`src/screens/Notebook.tsx:237`) only sets `kind`. Fix idea: on type change, drop a choice field whose value is not
  one of the new type's choices and use the new type's default (`createNote` defaults), plus a test.
- ✅ Fixed (fb23d53, unknown kinds open as Session pages). **An older app build reading a `rule` page from IndexedDB would crash the notebook list** (`KIND_LABEL[n.kind].split`,
  `Notebook.tsx:70`; `KIND_FIELDS[note.kind].filter`, `:141`). Only after a rollback/stale PWA on the same device;
  backup/pack import in an old build falls back to a Session page (fields kept, hidden). Fix idea (future-proof): in
  `withNoteDefaults`, map unknown kinds to `'session'`.

## Pass 6 — owner's test session, 2026-10-13
| Found | Fix |
|---|---|
| Players could level up on their own (⬆️ or the Level field) | **Level-up permission** (`src/model/levelLock.ts`, owner's choices): once played in a room a character is locked on every device (even offline); the DM presses "⬆️ ให้เลเวลอัป" on that player's card in the room screen (one level, can be cancelled); ⬆️ is hidden until then and the edit page's Level is locked; the DM's device refuses a sheet above the allowed level. The device that runs the campaign can always level. |
| Re-importing the campaign pack with "replace" didn't reset a fight already played | New checkbox on the import screen: reset started/finished fights too (back to the prepared fight, fight log cleared; PC sheet conditions stay). Before this: delete the fight in the tracker, then import with "add only". |

**Open (low, owner: after the Firebase usage reset):**
- ✅ Fixed in PR #3 (2026-10-18; not yet checked on real phones). **A removed (kicked) player still shows in the other players' room list.** Likely cause: the removed list lives only in
  the DM's session (`session.kicked`); players filter with their own empty list (`visibleMembers` in `src/sync/lobby.ts`),
  and the removed player's member record stays in Firebase. Fix idea: the DM sends the removed list to the room (or
  players record the `kick` messages they see), or the DM deletes the member record.
- **Not verified live:** the level-up permission over Firebase (the room refused to open, `PERMISSION_DENIED`, likely
  the free plan's usage); fake player for it: `node scripts/lobby-test/levelup-player.cjs ROOMCODE`. Checked locally:
  locked → ⬆️ hidden + Level 🔒; granted → ⬆️ + notice; level up → Level 3, grant used.

## Pass 5 — 2026-10-13 (new content features)
**Tested** (dev, phone 375 px): older characters on new code (Nyx, Boom), inventory add/wear/hold → AC
(Leather 11 + DEX = 14) and attack card (Dagger +5, 1d4+3, off-hand, Nick), attack roll via roller, the upgrade
banner (Boom: + Second Wind, Action Surge), feature card use (Bonus Action + use spent, logged), 2024 Short
Rest (Second Wind +1 use, Action Surge back), level 2 → 4 (Second Wind max 3, typed level + Save tap saved),
starting gear for all 12 classes × options and 4 backgrounds (items, gold and AC match 2024), Lookup equipment
and features tabs, overflow scan of 24 routes at 375 px, lazy chunks all in the offline cache.

| Found | Fix |
|---|---|
| Second Wind's roll was only shown; the player had to type it into heal | The roller hands the total back: Second Wind, Uncanny Metabolism, Wholeness of Body heal, Tireless gives Temp HP (minimum 1), once per use |
| 🎲 button covered row buttons on phones (Pass 1 #2) | Slides away while scrolling down, back on scroll up / at the top |
| No warning for unprepared Ritual casting (non-Wizard) | Warning, per SRD 5.2.1 (Wizard Ritual Adept excepted) |
| "Bonus Action spell" rule (HANDOFF) | That's 2014; SRD 5.2.1 has **One Spell with a Spell Slot per Turn**: warned (not blocked), Reactions excepted (rules-reviewer) |
| Fight row's HP copy of a character went stale (Pass 1 #4) | Deleting a character saves its last HP/AC into linked fight rows (the only time the copy is shown) |
| Firebase messages piled up | Rules allow deleting messages > 1 h old; the DM's device cleans its rooms. Rules published by the owner 2026-10-13 |

**Open (low):**
- ✅ Done in PR #2 (amber banner on the sheet). The edit screen's rule check says ✓ at level 3+ with no Subclass, and at level 4 with no ASI/feat. A warning would help.
- The roller's big "last result" shows the last roll from any sheet (e.g. Nyx's Dagger while on Boom's sheet).
- **Not verified live yet:** the Firebase cleanup (rules now published; check during the next real session), and everything in "Next QA pass" below
  that needs real phones.

## Next QA pass should also cover (new 2026-10-13)
Equip/unequip on a real phone in a live room (the DM's copy follows), Action Surge and Second Wind as a player on
and off their turn, a level-up adding features, the wizard's equipment step for each class, older characters
(hand AC, plain inventory) still working, the floating 🎲 over the new right-hand toggle buttons.

## Research pass — 2026-10-13 (see docs/RESEARCH.md)
Findings for the implementor:
1. ✅ Fixed (F1). **Bug (rules): Short Rest gave back all uses of every "short" feature.** 2024: Second Wind, Rage,
   Channel Divinity and Wild Shape regain **one** use on a Short Rest (all on a Long Rest). `shortRest()` in
   `src/rules/play.ts` needs a third recharge kind (`shortOne`). Plan step F1.
2. ✅ Fixed (F1, limit 200 + pools). **Limit:** `io.ts` rejected features with max > 20, so Lay On Hands (pool of 5 × level HP) can't be stored. F1.
3. ✅ Fixed (E1). **Data errors in 5e-bits 2024 equipment** to correct when importing: Trident 1d8 / Versatile 1d10, Sling
   Bludgeoning, Morningstar missing range. Step E1.

## Pass 4 — owner reports, 2026-10-12
| Report | Fix |
|---|---|
| A handed-over monster stayed on the player's phone after "เอาคืน" | The phone remembers its handed-over characters (saved in its room session) and deletes the copy when the DM's `control` list drops it, also after being offline; leaving the room removes them too (they come back on rejoin if still granted). Not in test mode (shared database with the DM) |
| No way to refresh in the installed app (home screen) | Pull down at the top of the page → "ปล่อยเพื่อรีเฟรช" → reload (checks for a new app version first). Only in the installed app; browser tabs keep their own pull-to-refresh |

**Needs a real-phone check:** the delete-on-take-back itself (test mode skips it by design).

## Pass 3 — owner requests, 2026-10-12
| Request | Done |
|---|---|
| Room's campaign can't change after opening (e.g. after a campaign pack import) | DM picks the campaign on the room screen; players' phones and played characters follow |
| Only the DM who created a campaign may manage it | ⚙️ rename/delete next to the campaign picker, only on the creating device; players see 🔒; a player in a room can't create campaigns or change a character's campaign |
| Players see the party read-only | `#/party` on a player's phone in a room: name, class/level, AC, HP, conditions, Action/Bonus/Reaction of every played character; only their own cards open a sheet |
| Monster/NPC → character file; DM gives control to a player | "🧑 เป็นตัวละคร" on a tracker row (full SRD stat block) → 📤 export on its sheet; 🎮 on its row hands it to a player in the room ("เอาคืน" on the room screen takes it back) |

Also fixed: test-mode transport dropped the DM's catch-up messages after a tab reload.
Rules review (all 341 SRD monsters): PB and average HP exact; known gaps written into the sheet's notes:
Hit Dice capped at 20, 3 odd stat-block bonuses. (Initiative now uses the 2024 stat-block value, added 2026-10-13.)
**Note for testing:** in test mode (two tabs, one database) a player's damage shows applied twice; that's the
shared database, not the app (real phones have separate databases).

## Pass 2 — owner reports, 2026-10-12
| Bug | Fix |
|---|---|
| A fight could be deleted only after "🏁 จบ"; unwanted/test fights in setup or running stayed forever | `Tracker.tsx`: "🗑 ลบการต่อสู้นี้" in every state (asks first; says what is removed) |
| **Duplicate characters on the DM device**: importing a player's file saved it under a *new* id, then the player joined the room with the original id and the DM device saved a second copy | `ImportCharacter.tsx`: a first import keeps the file's id **and revision** (saved like a sheet received in a room); "➕ เก็บทั้งคู่" still makes a separate copy on purpose. The same fix covers DM → player files |

Note for the owner: joining a room already copies the player's character to the DM device, so importing
the file first isn't needed. Old duplicates made before this fix: delete the **older imported** copy (the
one not updated by the room) and re-add the synced one to fights if needed.

## Pass 1 — 2026-10-12

**Tested** (dev build, phone 375 px + laptop): character list, Rogue and Wizard sheets (rules math checked
by hand), spell add/cast/upcast, slot pips, fight setup (PCs + SRD Goblin Warriors), initiative and ties,
damage to 0 HP, death save (natural 20), defeated monsters skipped, stat block following the turn, player
view, DM panel generators, About page, a horizontal-overflow scan of every main route at 375 px.
**Not tested yet:** live room sync on real phones (Firebase), character creation wizard, import/export,
offline/PWA update, notebook and session planner editing.

### Fixed in this pass
| Bug | Fix |
|---|---|
| Tapping the last full spell-slot / feature pip spent **all** remaining uses at once (players can't give them back in a room) | `PlayPanel.tsx` `tapPip`: one tap = one use (full pip spends one, empty pip gives one back) |
| Conditions on a PC's sheet (Unconscious at 0 HP, or set by the player) never showed on the DM tracker or the players' fight view | `sheetOnlyConditions()` in `src/model/encounter.ts`, used by `CombatantRow.tsx` and `playerView.ts` (+ tests) |
| "Add players" kept its old count after adding; a second tap added nobody and closed the panel | `AddCombatants.tsx`: count only still-available picks, clear picks after adding |
| "↻ เทิร์นใหม่" stuck out of the play card at 375 px | `PlayPanel.tsx`: `min-w-0` on the action-economy wrapper |
| DM panel's last buttons (e.g. "สุ่ม NPC ใหม่") stayed under the floating 🎲 button | `DmPanel.tsx`: bottom padding on the scrolling panel (lg) |
| About page scrolled sideways on phones (long license URL) | `About.tsx`: `break-all` |

### Findings for the implementor (not fixed: features or design choices)
1. ✅ Done 2026-10-13 (verified in pass 5: attacks, inventory, AC from armor, class features). **High: no attacks, weapons, equipment or class features on the sheet.** E.g. Nyx (Rogue 1) shows no
   Sneak Attack, Thieves' Cant, Weapon Mastery, and has no attack rolls. At a real table players need
   "attack +X, damage YdZ+M" in one tap. Already in ROADMAP "Later"; recommend doing it **before** Phase 5.
   Needs SRD 5.2.1 weapon/armor data (name, damage, properties, mastery) and AC from worn armor
   (Nyx shows AC 13 = unarmored; Rogues start with Leather Armor). Run `rules-reviewer` after.
2. ✅ Fixed in pass 5 (tucks away on scroll). **Medium: floating 🎲 button covers content on phones**: the last "+ เพิ่ม" in the spell picker and the
   monster form's "เพิ่ม" sit under it until you scroll. Option: bottom padding on `<main>` equal to the
   button's height, or hide the button while a picker/form is open.
3. ✅ Done 2026-10-13 (DM screens lazy-loaded; main chunk 754 → 426 KB). **Low: first load is one 676 KB JS chunk** (build warning). Lazy-load the DM-only screens (tracker, DM
   panel, notebook, generators, lookup) with `React.lazy` so players' phones load faster.
4. ✅ Fixed in pass 5 (snapshot on delete). **Low: a PC combatant's own `hp` copy goes stale** (the sheet is the source; the copy is only a fallback
   if the sheet is deleted). Harmless now; either keep it in sync or drop it.
5. ✅ Done in pass 5 (Ritual warning; one slot per turn, the real 2024 rule; Firebase cleanup needs the rules published).

### Next QA pass should cover
Live room with 2+ real phones (join by QR, player damage/heal/slots, end turn, kick, reload mid-fight,
airplane mode then reconnect), character wizard for each class, export → import on another device.
