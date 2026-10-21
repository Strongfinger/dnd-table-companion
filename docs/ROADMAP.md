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

## Phase 3 — DM assistant (offline, no AI) · redesigned 2026-10-12 ✅ done 2026-10-12
Use: mostly live at the table, on a laptop. Layout: **one DM screen**: the fight tracker in the middle and a
side panel with tabs (Notebook · Generators · Lookup) that opens without leaving the fight.
- [x] 3.1 Session notes per campaign (🧙 DM tab, auto-save, search) — will become "Session" pages in the notebook
- [x] 3.2a SRD lookup: full SRD 5.2.1 monster stat blocks (DM only; "add to fight"), rules & conditions (players
      too: 📖 ค้นหา tab on their phones) (2026-10-12)
- [x] Spell casting from the sheet (✨ ร่าย: Action/Bonus/Reaction, slot with upcast, Ritual, Concentration) and 2024 cantrip/prepared limits (warn only) (2026-10-12)
- [x] Character spell list on the sheet (✨ คาถา): add from SRD spells (class + slot levels) or homebrew, prepared marks, links to spell cards (2026-10-12)
- [x] 3.2b Spells in the lookup: 339 SRD 5.2.1 spells, search by name/school, Level and Class filters (players start on their class) (2026-10-12)
- [x] 3.3 DM screen: panel next to the tracker (wide fight page on laptops): stat block that follows the active monster's turn, lookup opened in place (+ add monster to this fight), campaign notes edited in place, fight log (2026-10-12)
- [x] 3.4 Campaign notebook: pages for sessions, NPCs, places, quests, factions, items (a few key fields + text), [[links]] with "ถูกพูดถึงใน" backlinks, view/edit, on the DM tab and in the fight panel; DM only (2026-10-12)
- [x] 3.5 Generators: NPC, tavern/shop, plot hook, loot (SRD magic items), quick encounter (SRD monsters → new fight
      or this fight), weather/event. 🔄 per part; NPC/place/quest/items save to the notebook. Homebrew content (2026-10-12)
- [x] 3.6 Session planner: Session pages hold scenes (read-aloud, notes with [[links]], checklist, linked/created fight); tick while playing; carry unplayed scenes to a new session page (2026-10-12)

## Phase 4 — Lobby & live sync · 3–4 sessions ✅ done 2026-10-12
- [x] Create/join lobby with room code (+ QR), player list with online status, kick/rejoin (step 4.1, 2026-10-12: `#/lobby`, rejoins after reload)
- [x] DM device is the source of truth during a session; players send actions, DM device applies and broadcasts (step 4.2)
- [x] Players' sheets synced both ways (HP, conditions, slots, death saves, action economy) (step 4.2, 2026-10-12)
- [x] Players see initiative order, round and whose turn; monsters with name + rough health ("Bloodied") (step 4.3, 2026-10-12)
- [x] Shared dice log: rolls from any phone appear in the fight log (step 4.4, 2026-10-12)
- [x] Reconnect after a phone sleeps; full state resync on join; offline changes merged on reconnect (step 4.5: saved outbox + acks, applied-once ids, edits merged by field)
- [x] Player permissions: no self give-backs/rests/new turn, DM gives back in the same round only, read-only combat tab with safe log, players end their own turn; Action/Bonus Action on own turn only; read-only logs that follow the DM's deletions; DM rests the whole party from the room screen; short rest is a start/end period, Hit Dice only during it (2026-10-12)
- [x] Message layer: id per message (drop duplicates), sender = device from the connection, players may only act on their own character, rate limit per device (4.4)

## Phase 5 — Hardening · 1–2 sessions (one open item: the first real session)
- [ ] Multi-device tests, a real test session with friends, fixes
  - [x] Playtest (2026-10-16) and its fixes (2026-10-18, PRs #1–#3): DM rejoins the room they left, Thai help for the
        18 skills, Action/Bonus Action/Reaction only suggest spells and features that fit, spells open in place + back
        button, ค้นหา tab for everyone, party rest on the DM tab, missing subclass/ASI warning, kicked players leave
        every list
  - [ ] First real session with friends (Icespire Session 1) on several phones; check the Firebase cleanup live
- [x] Translation: Thai text for SRD rules content, game terms stay English, English original kept (TH/EN switch).
      Source: **DND-TH's translation, used with permission (2026-10-13)**; only SRD 5.2.1 (2024) entries, credit
      DND-TH. Our own translation only where DND-TH has none.
  - [x] Spells: 332 of 339 (`src/data/srd-spells-th.json`, 2026-10-13)
  - [x] Feats: all 17 SRD feats (`src/data/srd-features-th.json`, 2026-10-13; Lookup 🧬 tab and the sheet)
  - [x] Magic items: 274 of 278 (`src/data/srd-magic-items-th.json`, 2026-10-13; +15 SRD items 5e-bits lacks, from the PDF, 2026-10-18; new Lookup tab 🪄 ไอเทมเวท, loot generator)
  - [x] Class features (231/232) and species traits (all base traits) from DND-TH's markdown pages (2026-10-13; sheet + Lookup 🧬)
  - [x] Rules Glossary incl. conditions: all 154 SRD entries (2026-10-13; 📖 rules tab + help sheet on phones)
  - [x] Equipment: 180 of 196 items + all weapon properties and masteries (2026-10-13; Lookup ⚔️, inventory picker and details)
  - [x] Monsters: Thai names + stat block text, 340 of 341 monsters, ไทย/EN switch, Thai search (`src/data/srd-monsters-th.json`, 2026-10-18, PR #4)
- [x] Clean up old room messages in Firebase: the DM device deletes messages older than 1 h (rules published 2026-10-13; check live in the first real session)

## Phase 6 — Table extras (added after the playtest) ✅ done 2026-10-19 to 2026-10-21 (PRs #5–#18)
Owner requests that came out of the playtest and later table use; all done, none needs Firebase rule changes except the chronicle.
- [x] 2026-10-19 Inventory: coin purse (cp/sp/ep/gp/pp), custom items, one item per equipment slot, two ring slots, edit/use/delete items, tap an equipped item to read it
- [x] 2026-10-19 Temporary buffs: the DM puts effects like Longstrider or a blessing on a character (`src/rules/buffs.ts`); Bless and Shield of Faith presets end on a rest
- [x] 2026-10-19 Full backup and restore of all app data as one JSON file (`#/backup`, `src/model/backup.ts`)
- [x] 2026-10-19 Journey chronicle (บันทึกการเดินทาง): the DM writes a storybook chapter after each session (markdown, up to 24 pictures); published chapters sync through Firebase `chronicles/` so players read them any time, with an offline copy
- [x] 2026-10-19 Smaller: edit character notes in place, DM can rename a fight, room characters and imported packs stay in the DM's campaign, campaign name fix
- [x] 2026-10-20 Carrying Capacity (Str × 15 lb, coins 50 per lb); over it Speed is cut to 5 ft, past double it is 0
- [x] 2026-10-20 One Thai/English button in the top bar for every card
- [x] 2026-10-20 Reward pool (คลังกลาง) and coin requests: characters run by a DM take items from the pool and ask the DM for coin changes; the DM keeps the free controls
- [x] 2026-10-20 Magic items on the sheet: custom items can be marked ✨ Magic Item with an effect text; worn ones show with the buffs; only the DM edits effects
- [x] 2026-10-21 SRD magic items can go into the reward pool (✨ chip), get a wear slot after adding, and show a short Thai effect summary (`srd-magic-items-summary-th.json`, all 278) with a read-more page; the treasure generator can fill the pool
- [x] 2026-10-21 New waist slot (เอว) for belts; belts worn on the legs move to it

## Later
- [x] Content enhancement: SRD weapons/armor, class features and limited-use features, starting gear, magic items, spells, feats, poisons, Lookup tabs: done as the content plan E1–E7, F1, F2 in [RESEARCH.md](RESEARCH.md) (2026-10-13)
- [ ] ~~Minimap / battle map~~ → use an outside tool (e.g. Owlbear Rodeo) next to the app (decided 2026-10-12)
- [ ] ~~Claude API DM helper~~ → no AI (decided 2026-10-12)
- [ ] QR code export/import of a character (optional)
- [x] Item and equipment pictures: 98 painted SRD item pictures + 117 game-icons.net icons for gear, tools, poisons, foci, packs and ammunition, shown in the inventory, slots and item details; custom items can carry their own small picture (2026-10-20 plan in [ITEM-IMAGES.md](ITEM-IMAGES.md); built 2026-10-20, waist-slot belt picture 2026-10-21)
