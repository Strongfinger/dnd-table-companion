# QA log

QA passes: what was tested, what was fixed, and findings handed to the implementor.
Newest pass first. Implementor: move an item to "Done" (or delete it) when it ships.

## Pass 6 — owner's test session, 2026-10-13
| Found | Fix |
|---|---|
| Players could level up on their own (⬆️ or the Level field) | **Level-up permission** (`src/model/levelLock.ts`, owner's choices): once played in a room a character is locked on every device (even offline); the DM presses "⬆️ ให้เลเวลอัป" on that player's card in the room screen (one level, can be cancelled); ⬆️ is hidden until then and the edit page's Level is locked; the DM's device refuses a sheet above the allowed level. The device that runs the campaign can always level. |
| Re-importing the campaign pack with "replace" didn't reset a fight already played | New checkbox on the import screen: reset started/finished fights too (back to the prepared fight, fight log cleared; PC sheet conditions stay). Before this: delete the fight in the tracker, then import with "add only". |

**Open (low, owner: after the Firebase usage reset):**
- **A removed (kicked) player still shows in the other players' room list.** Likely cause: the removed list lives only in
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
- The edit screen's rule check says ✓ at level 3+ with no Subclass, and at level 4 with no ASI/feat. A warning would help.
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
