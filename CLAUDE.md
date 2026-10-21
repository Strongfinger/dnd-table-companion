# DND Table Companion

A web app the DM (the owner) uses at **in-person** D&D sessions with friends.
The DM runs it on a laptop or tablet. Players use phones for their own character sheets.

## Decisions (agreed 2026-10-11)
- **Rules:** D&D 5e **2024 rules, SRD 5.2.1 content only** (CC-BY-4.0). Switched from 2014/SRD 5.1 on 2026-10-11 because the group plays 2024 (D&D Beyond). See the `dnd-5e-rules` skill.
- **MVP features:** 1) Character sheets 2) Initiative/combat tracker 3) DM assistant (offline, no AI)
- **Data:** each device stores its own data locally (IndexedDB) and works offline. JSON export/import shares characters.
- **Live sync (planned, decided 2026-10-11):** a campaign lobby joined with a **room code** through **Firebase Realtime Database (free Spark plan)** (internet needed only during a live session). The DM device is the source of truth; players' sheets sync both ways; players see initiative/turn and limited monster info (never exact HP); shared dice log. Build a sync-ready foundation first. See docs/ROADMAP.md.
- **AI:** none (decided 2026-10-12, replaces "Claude API later"): the DM assistant is fully offline and free. Never put a **secret** key (e.g. the Claude API key) in client code. **Publishable** config (e.g. Firebase web config) is allowed, decided 2026-10-11: kept in env vars (`VITE_…`, `.env.local` + Vercel settings), never hard-coded, and only with access protected by security rules.
- **Hosting:** free static host (Vercel). The app must work as a PWA, including offline at the table.
- **Language:** UI and generated text in **Thai**. Keep D&D game terms in English (HP, AC, Saving Throw, spell and monster names), optionally with a Thai gloss.

- **DM assistant (redesign, 2026-10-12):** used mostly live at the table on a laptop. One DM screen: fight tracker in the middle, side panel with Notebook / Generators / Lookup. Build order: SRD lookup (full monster stat blocks; spells, conditions, rules also for players; monster stats DM-only) → campaign notebook (NPCs, places, quests & hooks, factions & items, linked) → generators (results saved to the notebook) → session planner. Generated proper names in English, descriptions in Thai. Battle map: use an outside tool (e.g. Owlbear Rodeo), not built in the app.

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
- After changing anything in `src/rules/` or game content, run the `content-reviewer` agent.
- Team of 10 agents and the work process: see [docs/TEAM.md](docs/TEAM.md).

## Roadmap
See [docs/ROADMAP.md](docs/ROADMAP.md). Latest state and next steps: [docs/HANDOFF.md](docs/HANDOFF.md).
