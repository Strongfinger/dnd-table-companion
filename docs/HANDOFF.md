# Handoff: state on 2026-10-12, Phase 4 done; Phase 3 in progress (3.1 notes done; next: 3.2 random generators, 3.3 monster lookup, 3.4 spell lookup)

## Where things are
- **Live:** https://dnd-table-companion.vercel.app (Vercel auto-deploys `main`; installable offline PWA)
- **Rules:** D&D 2024 / SRD 5.2.1. `src/rules/` = pure rule functions (run the `rules-reviewer` agent after changes)
- **Tests:** `npm test` (406 passing); `npm run build`; dev server `npm run dev` (launch config `dev`; `preview` = production build on :4173)

| Area | Files |
|---|---|
| Rules engine | `src/rules/` (sheet, play, turns, diceExpr, spellslots, classes, srd/, checks, creation, challenge) |
| Character model & actions | `src/model/character.ts`, `characterActions.ts` (one reducer for every play change + `parseCharacterAction`), `actions.ts` |
| Fights | `src/model/encounter.ts`, `src/screens/Tracker.tsx`, `CombatantRow.tsx`, `AddCombatants.tsx` |
| Player view (no DM secrets) | `src/model/playerView.ts` (+ `liveFight`, `parsePlayerView`, `activeTurn`), `src/screens/PlayerViewPanel.tsx`, `src/screens/LiveFightBar.tsx` (players' bar under the nav) |
| Sync bookkeeping | `src/model/sync.ts` (DATA_VERSION, stamp, newerOf), `src/model/campaign.ts`, `src/db/device.ts` |
| Lobby transport | `src/sync/` (`envelope.ts`, `roomCode.ts`, `transport.ts`, `localTransport.ts`, `firebaseTransport.ts`) |
| Lobby (real) | `src/app/lobby.tsx` (LobbyProvider: one connection for the whole app, `send`/`subscribe` for later steps), `src/app/useLobby.ts`, `src/sync/lobby.ts` (saved session, join link, kick), `src/screens/Lobby.tsx` (`#/lobby`, `#/lobby/CODE` from the QR) |
| Sheet sync | `src/sync/sheets.ts` (protocol + pure checks), handled in `src/app/lobby.tsx`; `saveReceivedCharacter`/`watchCharacters` in `src/db/characters.ts`; callers: `PlayPanel` (`shareAction`), `CharacterEdit` (`shareSheet`) |
| Outbox / applied-once | `src/sync/outbox.ts` (player outbox, retry rounds, acks); `mergeDraft` in `src/model/sync.ts` (edit screen); `mergeEdit` in `src/sync/sheets.ts` |
| Player permissions | `src/model/permissions.ts` (pure rules), `src/db/play.ts` (`playAction`: every play change goes through it), `src/db/turns.ts` (`advanceTurn`, shared by the tracker and players' end-turn) |
| Player combat tab | `src/sync/fights.ts`, `src/screens/PlayerFights.tsx`; `forPlayers` flag on log lines (`isPlayerSafe`) |
| Lobby test scripts | `scripts/lobby-test/` (`player.cjs`, `dm.cjs`, `resync.cjs`, `permissions-dm.cjs`, `permissions-player.cjs`): a fake 2nd device over Firebase (two tabs share one IndexedDB, so they can't test sheet sync) |
| Lobby test page | `src/screens/LobbyLab.tsx` (`#/lab`, linked from About) |
| Storage | `src/db/` (Dexie DB version 4: characters, log, encounters, campaigns, settings) |
| DM tools (Phase 3) | `src/screens/DmHome.tsx` (`#/dm`, hidden for players in a room), `NoteEdit.tsx` (`#/dm/note/<id>`, auto-save); `src/model/note.ts`, `src/db/notes.ts` (DB version 5: `notes`) |
| Help/glossary | `src/model/glossary.ts`, `src/ui/help.tsx`, `src/ui/useHelp.ts` |

## Firebase (set up and working)
- Project `dnd-table-companion`, Realtime Database in **asia-southeast1**, **anonymous** sign-in on,
  rules from `database.rules.json` published (re-publish in the console if that file changes).
- Public web config: `.env.local` (git-ignored; written by `node scripts/firebase-env.mjs`) and
  the same 5 `VITE_FIREBASE_…` variables in Vercel (Production + Preview).
- Proven: room code, members/presence, messages both ways, offline on disconnect, a real phone
  reconnects after unlocking.
- Gotchas learned: write the member record **before** `onDisconnect`; start the message listener
  only **after** joining (members-only read rule silently cancels earlier listeners); two tabs in one
  browser share one Firebase sign-in, so test a second member from a separate device or a node script.

## Phase 4 plan (from docs/ROADMAP.md)
1. ✅ Step 4.1 (2026-10-12): create/join lobby for a **campaign** (room code + QR), player list with online
   status and picked character, kick (DM re-kicks if they come back) and "let back in", rejoin after reload.
   The room is saved in settings (test mode: per browser tab, in sessionStorage). Test mode = checkbox on
   the lobby screen in `npm run dev` (two tabs). Verified over Firebase with a node script as the 2nd device.
   Kick is enforced by the DM device ignoring that device (no rule change needed). Not yet enforced: who may
   claim `role: 'dm'` (any member can); players should only trust `state` from the DM member (step 4.2).
2. ✅ Steps 2+3a (4.2, 2026-10-12): sheet sync both ways. Protocol: player→DM `hello {character}` (on
   connect/reconnect, picking a character, saving an edit) and `action {characterId, action}` (each play tap,
   also applied locally at once); DM→all `state {character}` whenever a played character changes on the DM
   device (one Dexie watcher covers players' actions, the tracker and DM edits). Received sheets are stored
   as sent (no re-stamp) so revisions match. DM takes a hello only if its rev is higher (tie = DM);
   players take `state` only from the DM and only if rev ≥ theirs. Players may only change the character
   they picked (`mayChange`). Verified over Firebase in both directions with `scripts/lobby-test/`.
   Known limits: (a) saving the edit screen overwrites play changes the DM made while it was open (edit
   wins, rev continues from the newest copy); (b) DM reloading within ~5 s of a player's action can apply
   it twice (listener replays the last 5 s, Deduper is fresh); (c) the phone's log only gets the player's
   own actions, not DM-made changes; (d) whole-sheet "higher rev wins", no per-field merge; (e) sheets
   over ~64 KB can't be sent.
3. ✅ Step 4.3 (2026-10-12): live fight view. DM device: `watchPlayerFight` (db/encounters.ts) picks the newest
   *running* fight (setup stays secret; prefers the room's campaign), builds `playerView`, and sends
   `fight {view|null}` on every change (skips repeats) and again on each player `hello`. Players accept it only
   from the DM, check it with `parsePlayerView`, and show `LiveFightBar` (round, whose turn, "🎯 ตาของคุณ!",
   vibrate; tap = initiative list) and the list on the lobby screen. DM's lobby screen says which fight players
   see. Verified over Firebase both ways (hidden monster left out, no HP/AC leak, turn changes arrive).
4. ✅ Step 4.4 (2026-10-12): shared dice log. The floating roller shares rolls with the room (`roll` =
   RollEvent; players on by default, DM off: "ปกติ DM ทอยลับ"). Every device hears them (no relay);
   the name comes from the member list (`rollerName`: "DM", the character, or the device), never the body.
   DM device logs each shared roll with `logSharedRoll` (running fight log + roller's sheet log).
   Others' rolls show in the roller ("ทอยล่าสุดในห้อง") and as a 5 s toast (`RoomRollToast`).
   `RateLimiter` (40 messages / 10 s per device) drops floods. Verified over Firebase in all directions.
   Not shared yet: death-save / hit-die rolls are already in the action log lines; initiative rolls by players.
5. ✅ Step 4.5 (2026-10-12): nothing lost, nothing applied twice. Player: every action / edit goes through a
   saved outbox (settings `lobby-outbox`; test mode: sessionStorage) and is re-sent every 4 s while connected
   until the DM device answers `ack {ids}` (gives up after 20 tries, e.g. character switched). The plain
   full-sheet `hello` is only sent when the outbox is empty (after connect or picking a character), so it
   can't race pending actions. DM: ids of applied actions/edits/rolls are saved (`lobby-applied`, last 500),
   so a re-send or a replay after a reload is only acked again. Edit-screen saves are merged by field on the
   device itself (`mergeDraft`) and, in a room, sent as `hello {edit: true}`: the DM takes the build and
   keeps its play state (`mergeEdit`: current/temp HP, conditions, death saves, exhaustion, turn, hit dice,
   inspiration, concentration). Firebase records now carry the send time (`at`), so re-sent old changes
   pass the listeners' "recent only" filter. Verified over Firebase: duplicate id applied once; same message
   after a DM reload only acked; edit with stale HP keeps the DM's HP; player outbox survives a reload with
   no DM online and is delivered in order when the DM joins, then the sheet hello follows.
   Fixed limits from 4.2: (a) edit screen overwrites, (b) double apply after DM reload, (d) partly (by field).
   Still open: (e) sheets over ~64 KB; old room messages pile up in
   Firebase (rules allow create only) — listed in Phase 5.
6. ✅ Player permissions (2026-10-12, owner's request). In a room a player may spend but not give back
   (Action/Bonus/Reaction, spell slots, feature uses), press ↻ new turn, or rest (DM-only; players can still
   roll Hit Dice). Enforced on the phone (UI + `playAction(..., 'player')`) and again on the DM device for
   arriving actions (refused → DM sends its copy back); `mergeEdit` keeps the DM's slot/feature uses.
   The DM (or any device outside a room) may give a use back only in the round it was spent while the
   character is in a running fight (`useRounds` setting records fight+round per use); outside fights any time.
   Players' combat tab is read-only: the DM's started fights (`fights`) + player-safe log lines (`log`; lines
   with characterId, or `forPlayers` = start/end, turns of visible creatures, rounds, shared rolls; never
   monster HP or hidden creatures). Players end their own turn (`endTurn`, checked: their PC is active,
   same round). Players adopt the DM's campaign (`campaign` → same id on the phone, their character filed
   under it) so the party overview works. Rate limit now only on the DM device.
   Owner decisions: party overview on phones = only my character; safe lines only; rests are DM-only.
   Update (same day): in a fight, players use Action / Bonus Action only on their own turn (Reaction, slots,
   features any time) — `playerMay(c, a, turn)`; the phone passes its turn from the live view, the DM device
   reads its fight. Logs are read-only for players in a room (no ✕, no clear). 'log' messages now carry
   deletions (`logDiff`: deleted vs just dropped out of the newest 200) and full copies on (re)connect
   (`fullLog` with `from`), for fight logs and for each played character's log: the phone's character log
   mirrors the DM's (`applyCharacterLog`, lines marked `fromDm`); the phone no longer logs its own taps in a
   room (the DM's line arrives instead). Test: `scripts/lobby-test/logs-player.cjs`, `permissions-dm.cjs --not-my-turn`.
   Original plan: **DM device is the source of truth.** Players send `CharacterAction`s inside an envelope;
   the DM device checks `parseCharacterAction`, applies with `applyCharacterAction`, broadcasts the result.
3. Players' sheets synced both ways; players see `playerView(encounter)` (initiative, round, whose
   turn, monsters' rough health only); shared dice log (`RollEvent`).
4. Message layer rules still to enforce: drop duplicates (Deduper), sender = connection,
   **players may only act on their own character**, rate limits.
5. Rejoin after sleep: full state resync on join (Firebase can hold room state).

## Owner preferences (also in Claude's memory)
- Reply in English; UI in Thai with English game terms.
- Every dice roll: in-app roll **or** typed result from real dice.
- Guided rules with a DM override (warn, don't block); Point Buy in the wizard.
- Small runnable steps; say how to see each step; commit and push each step.
