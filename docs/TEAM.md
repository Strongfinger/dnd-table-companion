# Team and work process (agreed with Tan, 2026-10-21)

Ten agents in four teams, defined in `.claude/agents/`. The main Claude session routes each request to them.

| Team | Agent | Owns |
|---|---|---|
| App | `business-analyst` | Requirements, spec and solution ideas (with tech-researcher / dnd-specialist) before coding |
| App | `developer` | Code, algorithms, debugging, code review; branch + PR, never merges |
| App | `ux-ui-designer` | Desktop/mobile screens, mockups, layout, interface code; design skills from `.claude/ux-ui-kit/` |
| Quality | `qa-tester` | Test cases, bug hunting, root cause → back to the app team |
| Quality | `content-reviewer` | Thai language and spelling, pictures, D&D rules and SRD license (replaces rules-reviewer) |
| Knowledge | `tech-researcher` | Skills, tools and libraries; folders, backups, project memory |
| Knowledge | `dnd-specialist` | D&D sources (story, rules, news) in NotebookLM; answers with sources |
| DM | `dm-assistant` | Session prep, app import packages, after-session export/archive, DM vs. player files |
| DM | `campaign-bard` | Novel-style Thai chapter (.md) for บันทึกการเดินทาง |
| DM | `artist` | Chronicle, app and item pictures, tokens; Gemini only with Tan's yes each time |

## How a request moves

1. **Tan asks** in the project chat. One task = one thread.
2. **App work:** business-analyst writes the spec (Tan agrees on big or unclear items) → developer and/or ux-ui-designer build on a branch → tests + build pass → PR (assigned to Tan) → qa-tester and content-reviewer check → Tan gets a Thai summary and how to try it.
3. **Merge only when Tan says so** ("merge เลย" etc.). main deploys to Vercel automatically.
4. **Bugs:** qa-tester writes steps + root cause → developer fixes → qa-tester re-checks.
5. **After each play session:** dm-assistant archives the export and writes the recap → campaign-bard writes the chapter → artist asks Tan before making pictures → content-reviewer checks → Tan shares with players. tech-researcher reminds Tan to back up.
6. **Gemini images:** the artist asks Tan every time (what, how many, which model) and waits for a yes.
7. **Cannot be undone** (publishing Firebase rules, Vercel settings, deleting data, sending things to players): wait for Tan's go-ahead.
8. **Finish:** one result message, save lasting facts to memory, close the thread.

## Agent status board

Tan watches the team on a live board: [ทีม Agent ของ Tan](https://claude.ai/artifact/3yEQREAwjGXPvKyQtFvxdP). It cannot read threads by itself, so every thread updates it with the `ArtifactData` tool (collection `agents`, one document per agent id, e.g. `developer`):

- **Start of work:** `status: "working"`, `task` (short Thai text), `thread_id` (the thread's `cmsg_…` id), `updated_at` (ISO time).
- **Waiting on Tan** (a PR to merge, a yes for Gemini, a decision): `status: "waiting"`, same fields.
- **Done:** `status: "idle"`, remove `task` and `thread_id`, set `updated_at`.

Update every agent role the thread is acting as. Read the document first and pass its `version` as `if_version`.

All agents: reply to Tan in Thai, keep D&D terms in English, SRD 5.2.1 content only, no AI inside the app, no secret keys in code.
