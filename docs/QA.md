# QA log

QA passes: what was tested, what was fixed, and findings handed to the implementor.
Newest pass first. Implementor: move an item to "Done" (or delete it) when it ships.

## Pass 3 — owner requests, 2026-10-12
| Request | Done |
|---|---|
| Room's campaign can't change after opening (e.g. after a campaign pack import) | DM picks the campaign on the room screen; players' phones and played characters follow |
| Only the DM who created a campaign may manage it | ⚙️ rename/delete next to the campaign picker, only on the creating device; players see 🔒; a player in a room can't create campaigns or change a character's campaign |
| Players see the party read-only | `#/party` on a player's phone in a room: name, class/level, AC, HP, conditions, Action/Bonus/Reaction of every played character; only their own cards open a sheet |
| Monster/NPC → character file; DM gives control to a player | "🧑 เป็นตัวละคร" on a tracker row (full SRD stat block) → 📤 export on its sheet; 🎮 on its row hands it to a player in the room ("เอาคืน" on the room screen takes it back) |

Also fixed: test-mode transport dropped the DM's catch-up messages after a tab reload.
Rules review (all 341 SRD monsters): PB and average HP exact; known gaps written into the sheet's notes:
Initiative = DEX (data lacks the 2024 Initiative bonus), Hit Dice capped at 20, 3 odd stat-block bonuses.
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
1. **High: no attacks, weapons, equipment or class features on the sheet.** E.g. Nyx (Rogue 1) shows no
   Sneak Attack, Thieves' Cant, Weapon Mastery, and has no attack rolls. At a real table players need
   "attack +X, damage YdZ+M" in one tap. Already in ROADMAP "Later"; recommend doing it **before** Phase 5.
   Needs SRD 5.2.1 weapon/armor data (name, damage, properties, mastery) and AC from worn armor
   (Nyx shows AC 13 = unarmored; Rogues start with Leather Armor). Run `rules-reviewer` after.
2. **Medium: floating 🎲 button covers content on phones**: the last "+ เพิ่ม" in the spell picker and the
   monster form's "เพิ่ม" sit under it until you scroll. Option: bottom padding on `<main>` equal to the
   button's height, or hide the button while a picker/form is open.
3. **Low: first load is one 676 KB JS chunk** (build warning). Lazy-load the DM-only screens (tracker, DM
   panel, notebook, generators, lookup) with `React.lazy` so players' phones load faster.
4. **Low: a PC combatant's own `hp` copy goes stale** (the sheet is the source; the copy is only a fallback
   if the sheet is deleted). Harmless now; either keep it in sync or drop it.
5. Known from HANDOFF and still open: 2024 "Bonus Action spell → only a cantrip with your action" warning,
   ritual casting for non-Wizards, Firebase room cleanup.

### Next QA pass should cover
Live room with 2+ real phones (join by QR, player damage/heal/slots, end turn, kick, reload mid-fight,
airplane mode then reconnect), character wizard for each class, export → import on another device.
