# Roadmap

## Phase 0 — Setup (½ day)
- [x] Scaffold Vite + React + TS + Tailwind, add Thai font
- [x] Add a Vitest test that runs
- [x] Push to GitHub and deploy to Vercel — https://dnd-table-companion.vercel.app

## Phase 1 — Character sheets (players, phone-first)
- [x] Data model: `Character` (ability scores, class, level, HP, AC, skills, inventory, spells)
- [x] Rules engine in `src/rules/`: modifiers, proficiency, skills, saves, spell DC (with tests)
- [ ] Create/edit sheet UI, store in IndexedDB
- [ ] HP +/- quick buttons, short/long rest, spell slot tracking
- [ ] Export/import a character as JSON or QR code (to hand to the DM)

## Phase 2 — Initiative & combat tracker (DM, laptop/tablet)
- [ ] Add combatants (import a player JSON, or add an SRD monster quickly)
- [ ] Roll or enter initiative, sort, Next Turn, round counter
- [ ] HP and damage, the 15 conditions with durations, concentration reminder
- [ ] Built-in dice roller (2d6+3, advantage/disadvantage)

## Phase 3 — DM assistant (offline)
- [ ] Random tables: Thai NPC names and traits, taverns, loot by CR, quick encounters
- [ ] SRD monster and spell lookup
- [ ] Session notes

## Phase 4 — Later
- [ ] Claude API DM helper through a Vercel serverless function (NPC dialogue, descriptions, rules Q&A)
- [ ] Live sync between devices (Supabase), with room codes
- [ ] Battle map
