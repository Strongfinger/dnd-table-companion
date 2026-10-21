# UX/UI kit (vendored)

Design knowledge and checking scripts for the `ux-ui-designer` agent.

- **Source:** https://github.com/plugin87/ux-ui-agent-skills, version 2.10.0, commit `55156b40e3a9aafa52448bde76cdcb5147b958db` (added 2026-10-21).
- **License:** MIT, see `LICENSE` in this folder.
- **Upstream guide:** `KIT-CLAUDE.md` (the kit's own CLAUDE.md, renamed so Claude Code does not load it as project rules).

## What is where

| Here | What it is |
|---|---|
| `../skills/<name>/` | 22 skills (design-screen, design-component, a11y-audit, critique, ux-writing, ...). Their paths were changed from the kit root to this folder. |
| `rules/` | The kit's design rules (tokens and color, typography, components, accessibility). Read on demand, not auto-loaded. |
| `agents/design-critic.md` | Brief used by the `critique` skill. Not one of the 10 team agents. |
| `tokens/ components/ taste/ accessibility/ design-systems/ frameworks/ workflows/ content/ examples/` | Reference files the skills read. `design-systems/library/fantasy/` fits this app. |
| `scripts/` | Checking scripts. Python ones need only Python 3. The `.mjs` render checks need Playwright + axe-core, which this repo does not install, so they print SKIPPED (not a pass). |

## Left out on purpose

- **Hooks** (SessionStart, PostToolUse on every Write/Edit, Stop that can block a session). They would run for every agent, and the app's existing style (Tailwind palette classes, emoji in buttons) fails the kit's strict lints about 900 times.
- **`.claude/settings.json`** permissions, Figma MCP config, CLI (`bin/`), MCP server, tests, evals, release scripts, images.
- **Skills** `scaffold-project`, `ship`, `observe`, `figma-integration` (for the kit's own repo, its hooks, or Figma).

## Project rules win

Where the kit and this project disagree, follow the repo `CLAUDE.md` and `docs/TEAM.md`:
Thai UI with D&D terms in English, Noto Sans Thai, Tailwind as already used, existing emoji icons stay
(prefer no new emoji in new UI), mobile phones for players and a laptop for the DM.

## Updating

Copy the same folders from a newer upstream release, re-apply the path change
(`${CLAUDE_SKILL_DIR}/../../../` to `${CLAUDE_SKILL_DIR}/../../ux-ui-kit/`, and `.claude/rules/` to `.claude/ux-ui-kit/rules/`),
and review any new scripts before committing.
