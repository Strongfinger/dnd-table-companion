# DND Table Companion

A web app the DM (the owner) uses at **in-person** D&D sessions with friends.
The DM runs it on a laptop or tablet. Players use phones for their own character sheets.

## Decisions (agreed 2026-10-11)
- **Rules:** D&D 5e **2024 rules, SRD 5.2.1 content only** (CC-BY-4.0). Switched from 2014/SRD 5.1 on 2026-10-11 because the group plays 2024 (D&D Beyond). See the `dnd-5e-rules` skill.
- **MVP features:** 1) Character sheets 2) Initiative/combat tracker 3) DM assistant (offline generators first, Claude API later)
- **No sync between devices** in the MVP. Each device stores its own data locally (IndexedDB). Use JSON export/import to share characters.
- **AI:** free only for now. Build offline random tables (NPCs, loot, names) and keep a clean `ai/` interface so the Claude API can be plugged in later through a serverless function. Never put an API key in client code.
- **Hosting:** free static host (Vercel). The app must work as a PWA, including offline at the table.
- **Language:** UI and generated text in **Thai**. Keep D&D game terms in English (HP, AC, Saving Throw, spell and monster names), optionally with a Thai gloss.

## Stack
- Vite + React + TypeScript + Tailwind CSS
- Dexie (IndexedDB) for storage, vite-plugin-pwa for offline support
- Vitest for unit tests. Every rules calculation (modifiers, proficiency, HP, DCs) must have tests.
- Font: Noto Sans Thai

## Working style
- The owner has some HTML/JS/Python experience. Explain non-obvious code briefly and keep code simple and readable.
- Reply in English even when the owner writes in Thai.
- Build in small, runnable steps. After each step, say how to run or see it.
- Put game-rule logic in `src/rules/` as pure functions, separate from UI.
- After changing anything in `src/rules/`, run the `rules-reviewer` agent.

## Roadmap
See [docs/ROADMAP.md](docs/ROADMAP.md).
