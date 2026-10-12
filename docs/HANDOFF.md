# Handoff: state on 2026-10-12, next up: Phase 4 (lobby & live sync)

## Where things are
- **Live:** https://dnd-table-companion.vercel.app (Vercel auto-deploys `main`; installable offline PWA)
- **Rules:** D&D 2024 / SRD 5.2.1. `src/rules/` = pure rule functions (run the `rules-reviewer` agent after changes)
- **Tests:** `npm test` (343 passing); `npm run build`; dev server `npm run dev` (launch config `dev`; `preview` = production build on :4173)

| Area | Files |
|---|---|
| Rules engine | `src/rules/` (sheet, play, turns, diceExpr, spellslots, classes, srd/, checks, creation, challenge) |
| Character model & actions | `src/model/character.ts`, `characterActions.ts` (one reducer for every play change + `parseCharacterAction`), `actions.ts` |
| Fights | `src/model/encounter.ts`, `src/screens/Tracker.tsx`, `CombatantRow.tsx`, `AddCombatants.tsx` |
| Player view (no DM secrets) | `src/model/playerView.ts`, `src/screens/PlayerViewPanel.tsx` |
| Sync bookkeeping | `src/model/sync.ts` (DATA_VERSION, stamp, newerOf), `src/model/campaign.ts`, `src/db/device.ts` |
| Lobby transport | `src/sync/` (`envelope.ts`, `roomCode.ts`, `transport.ts`, `localTransport.ts`, `firebaseTransport.ts`) |
| Lobby (real) | `src/app/lobby.tsx` (LobbyProvider: one connection for the whole app, `send`/`subscribe` for later steps), `src/app/useLobby.ts`, `src/sync/lobby.ts` (saved session, join link, kick), `src/screens/Lobby.tsx` (`#/lobby`, `#/lobby/CODE` from the QR) |
| Lobby test page | `src/screens/LobbyLab.tsx` (`#/lab`, linked from About) |
| Storage | `src/db/` (Dexie DB version 4: characters, log, encounters, campaigns, settings) |
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
2. **DM device is the source of truth.** Players send `CharacterAction`s inside an envelope;
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
