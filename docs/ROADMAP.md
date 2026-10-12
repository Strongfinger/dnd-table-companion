# Roadmap

## Phase 0 — Setup (½ day)
- [x] Scaffold Vite + React + TS + Tailwind, add Thai font
- [x] Add a Vitest test that runs
- [x] Push to GitHub and deploy to Vercel — https://dnd-table-companion.vercel.app

## Phase 1 — Character sheets (players, phone-first)
- [x] Data model: `Character` (ability scores, class, level, HP, AC, skills, inventory, spells)
- [x] Rules engine in `src/rules/`: modifiers, proficiency, skills, saves, spell DC (with tests)
- [x] Create/edit sheet UI, store in IndexedDB
- [x] HP +/- quick buttons, short/long rest, spell slot tracking (+ death saves, conditions, Exhaustion, concentration)
- [x] Export/import a character as JSON (download, share, copy/paste)
- [ ] QR code export/import (optional, moved to Later)

## Phase 2 — Initiative & combat tracker (DM, laptop/tablet)
- [x] Add combatants: PCs linked to their sheet, quick monsters (name/AC/HP/init, numbered copies)
- [x] SRD monster quick-add: 341 SRD 5.2.1 monsters (search, CR filter, average or rolled HP), About page with CC-BY credit
- [x] Roll or enter initiative, sort, Next Turn, round counter, fight log by round
- [x] HP and damage, the 15 conditions with durations, concentration reminder, death saves
- [x] Built-in dice roller (2d6+3, advantage/disadvantage, Critical, real-dice entry, history)
- [x] Action / Bonus Action / Reaction tracking (sheet + tracker, refreshed at the start of each turn)

## Offline / PWA
- [x] Installable app (manifest + d20 icon), works fully offline after the first visit, update prompt, build time on About page

## Plan update (2026-10-11): campaign lobby with live sync
Decision: **online room code on a free tier** (option C). Chosen over Wi-Fi-only options because the goal is
avoiding paid services, not avoiding the internet; it works with the installed PWA, survives phones locking,
and works on any Wi-Fi or mobile data. Everything outside a live session stays offline-first.

Live scope: players' own sheets synced with the DM · players see initiative order, round and whose turn ·
monsters shown to players with name and rough health only (never exact HP) · shared dice log.
Estimates are in "sessions" (one long working block like the ones that built Phase 1 or 2).

## Step A — Sync-ready foundation (no networking) · 1–2 sessions ✅ done 2026-10-11
- [x] Campaign: groups characters, fights and notes; a lobby is a live session of a campaign
- [x] Device identity (random id + device name) and ownership: a player's device owns their character, the DM owns fights/monsters/notes
- [x] Revision counter on every saved record; app/data version handshake
- [x] Every change expressed as a small serializable action (we already have pure rule functions + `updateCharacter`)
- [x] DM-secret flags: hidden monsters, exact HP, notes
- [x] Validation for incoming actions (reuse the import validation: network data is untrusted)

## Step B — Realtime service trial · 1 session ✅ done 2026-10-12
- [x] Pick the free realtime service → **Firebase Realtime Database** (free, never pauses, presence + room state built in, Singapore region; Supabase free projects pause after 7 idle days)
- [x] Prototype (#/lab): DM creates a room code, a second device joins, presence list, send/receive messages, offline on disconnect: works on the live site
- [x] Real-phone test: joined from a phone, locked it, reconnected after unlocking (2026-10-12)
- [x] Public client key: publishable Firebase config allowed via env vars + security rules + anonymous sign-in; never secret keys

## Phase 3 — DM assistant (offline) · 2–3 sessions
- [ ] Random tables: Thai NPC names and traits, taverns, loot by CR, quick encounters
- [ ] SRD monster and spell lookup
- [ ] Session notes (belong to a campaign from day one)

## Phase 4 — Lobby & live sync · 3–4 sessions
- [x] Create/join lobby with room code (+ QR), player list with online status, kick/rejoin (step 4.1, 2026-10-12: `#/lobby`, rejoins after reload)
- [x] DM device is the source of truth during a session; players send actions, DM device applies and broadcasts (step 4.2)
- [x] Players' sheets synced both ways (HP, conditions, slots, death saves, action economy) (step 4.2, 2026-10-12)
- [x] Players see initiative order, round and whose turn; monsters with name + rough health ("Bloodied") (step 4.3, 2026-10-12)
- [x] Shared dice log: rolls from any phone appear in the fight log (step 4.4, 2026-10-12)
- [ ] Reconnect after a phone sleeps; full state resync on join; offline changes merged on reconnect
- [x] Message layer: id per message (drop duplicates), sender = device from the connection, players may only act on their own character, rate limit per device (4.4)

## Phase 5 — Hardening · 1–2 sessions
- [ ] Multi-device tests (several browser tabs as players), a real test session with friends, fixes

## Later
- [ ] Content enhancement: help and data for SRD weapons and armor (damage, properties, mastery), more action sources (class features), items/magic items, spells, and other SRD 5.2.1 content
- [ ] Minimap / battle map (shared view for players)
- [ ] Claude API DM helper through a Vercel serverless function (NPC dialogue, descriptions, rules Q&A)
- [ ] QR code export/import of a character (optional)
