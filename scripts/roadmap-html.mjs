// Builds docs/roadmap.html: a progress page made from docs/ROADMAP.md, the plan table in
// docs/RESEARCH.md and git (recent commits, uncommitted files).
// Run: npm run roadmap   (the git post-commit hook also runs it after every commit)
// The page reloads itself every 30 s, so an open browser tab follows along.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { execSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => (existsSync(join(root, p)) ? readFileSync(join(root, p), 'utf8') : '')
const git = (args) => {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

// ---------- Markdown helpers (only what our docs use) ----------
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
const inline = (s) =>
  esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/~~([^~]+)~~/g, '<s>$1</s>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/(^|[\s(])(https?:\/\/[^\s)<]+)/g, '$1<a href="$2">$2</a>')

// ---------- ROADMAP.md → sections with checklist items ----------
function parseRoadmap(md) {
  const sections = []
  let cur = null
  let last = null
  for (const line of md.split('\n')) {
    const h = line.match(/^##\s+(.*)/)
    if (h) {
      cur = { title: h[1].trim(), items: [], notes: [] }
      sections.push(cur)
      last = null
      continue
    }
    if (!cur) continue
    const item = line.match(/^- \[( |x)\]\s+(.*)/i)
    if (item) {
      last = { done: item[1].toLowerCase() === 'x', text: item[2].trim() }
      // Struck-out or "moved to Later" items don't count as open work in this phase
      last.dropped = last.text.startsWith('~~') || /moved to /i.test(last.text)
      cur.items.push(last)
    } else if (last && /^\s+\S/.test(line)) {
      last.text += ' ' + line.trim() // wrapped item line
    } else if (line.trim()) {
      last = null
      cur.notes.push(line.trim())
    }
  }
  for (const s of sections) {
    const counted = s.items.filter((i) => !i.dropped)
    s.total = counted.length
    s.done = counted.filter((i) => i.done).length
  }
  return sections
}

// ---------- RESEARCH.md → content plan steps (E1…, F1…) ----------
function parsePlan(md) {
  const start = md.indexOf('## 5. Plan')
  if (start < 0) return { steps: [], order: [], orderNote: '' }
  const body = md.slice(start).split(/\n## /)[0]
  const steps = []
  for (const line of body.split('\n')) {
    // A step row: "| **E2** ✅ | text | size | notes |" (bold and ✅ optional, e.g. "| Q | … |")
    const m = line.match(/^\|\s*(?:\*\*)?([A-Z]\d*)(?:\*\*)?\s*(✅)?\s*\|(.*)\|(.*)\|(.*)\|\s*$/)
    if (m) steps.push({ id: m[1], done: !!m[2], text: m[3].trim(), size: m[4].trim(), notes: m[5].trim() })
  }
  const orderLine = body.split('\n').find((l) => l.startsWith('Order:')) || ''
  const order = (orderLine.match(/\*\*(.+?)\*\*/)?.[1] || '').split('→').map((s) => s.trim()).filter(Boolean)
  for (const s of steps) if (!order.includes(s.id)) order.push(s.id) // e.g. Q goes last
  return { steps, order, orderNote: orderLine.replace(/^Order:\s*\*\*.+?\*\*\.?\s*/, '') }
}

const sections = parseRoadmap(read('docs/ROADMAP.md'))
const plan = parsePlan(read('docs/RESEARCH.md'))
const byId = Object.fromEntries(plan.steps.map((s) => [s.id, s]))
const orderedSteps = plan.order.map((id) => byId[id]).filter(Boolean)
// "Working on now": the next open content-plan step, else the first open roadmap item
const nowStep =
  orderedSteps.find((s) => !s.done) ??
  sections
    .flatMap((s) => s.items.filter((i) => !i.done && !i.dropped).map((i) => ({ id: s.title.split(/\s+[—·]\s+/)[0], text: i.text })))
    .find(Boolean)

const commits = git('log -12 --date=short --format=%h%x09%ad%x09%s')
  .split('\n')
  .filter(Boolean)
  .map((l) => l.split('\t'))
const dirty = git('status --short --untracked-files=all').split('\n').filter(Boolean)
const branch = git('rev-parse --abbrev-ref HEAD')

const phaseSections = sections.filter((s) => s.items.length)
const noteSections = sections.filter((s) => !s.items.length && s.notes.length)
const allDone = phaseSections.reduce((n, s) => n + s.done, 0) + plan.steps.filter((s) => s.done).length
const allTotal = phaseSections.reduce((n, s) => n + s.total, 0) + plan.steps.length
const pct = (d, t) => (t ? Math.round((d / t) * 100) : 0)
const stamp = new Date().toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })

// ---------- HTML pieces ----------
const bar = (d, t) =>
  `<div class="bar" role="progressbar" aria-valuenow="${pct(d, t)}" aria-valuemin="0" aria-valuemax="100"><span style="width:${pct(d, t)}%"></span></div>`

const status = (s) => (s.total && s.done === s.total ? 'done' : s.done ? 'active' : 'todo')
const statusLabel = { done: 'Done', active: 'In progress', todo: 'Planned' }

function sectionCard(s) {
  const st = status(s)
  const items = s.items
    .map(
      (i) =>
        `<li class="${i.dropped ? 'dropped' : i.done ? 'ok' : 'open'}"><span class="mark" aria-hidden="true">${
          i.dropped ? '–' : i.done ? '✓' : ''
        }</span><span>${inline(i.text)}</span></li>`,
    )
    .join('')
  const notes = s.notes.length ? `<p class="notes">${s.notes.map(inline).join(' ')}</p>` : ''
  return `<details class="card ${st}"${st === 'done' ? '' : ' open'}>
  <summary><span class="pill ${st}">${statusLabel[st]}</span><h3>${inline(s.title)}</h3>
  <span class="count">${s.done}/${s.total}</span>${bar(s.done, s.total)}</summary>
  ${notes}<ul class="check">${items}</ul></details>`
}

const planRows = orderedSteps
  .map((s) => {
    const st = s.done ? 'done' : s === nowStep ? 'now' : 'todo'
    return `<li class="step ${st}"><span class="sid">${esc(s.id)}</span><div><div class="stext">${inline(s.text)}</div>${
      s.notes ? `<div class="snote">${inline(s.notes)}</div>` : ''
    }</div><span class="size">${esc(s.size)}</span></li>`
  })
  .join('')

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="30">
<title>Roadmap progress</title>
<style>
:root{--bg:#f7f6f2;--card:#fff;--text:#1f1e1c;--muted:#6b6a65;--line:#e3e1d9;
--done:#0f6e56;--done-bg:#e1f5ee;--now:#993c1d;--now-bg:#faece7;--todo:#5f5e5a;--todo-bg:#f1efe8;--bar:#1d9e75}
@media (prefers-color-scheme:dark){:root{--bg:#191917;--card:#232321;--text:#ecebe6;--muted:#a3a19a;--line:#3a3936;
--done:#9fe1cb;--done-bg:#0d3b2f;--now:#f5c4b3;--now-bg:#4a1b0c;--todo:#c9c7bd;--todo-bg:#2e2d2a;--bar:#5dcaa5}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--text);font:15px/1.55 system-ui,-apple-system,"Noto Sans Thai",sans-serif}
main{max-width:960px;margin:0 auto;padding:24px 16px 48px}
h1{font-size:24px;font-weight:600;margin:0 0 4px}
h2{font-size:17px;font-weight:600;margin:32px 0 12px}
h3{font-size:15px;font-weight:600;margin:0;flex:1;min-width:0}
a{color:inherit}
code{font:13px ui-monospace,Menlo,monospace;background:var(--todo-bg);padding:1px 4px;border-radius:4px}
.meta{color:var(--muted);font-size:13px}
.hero{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:20px}
.tile{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:16px}
.tile .label{color:var(--muted);font-size:13px}
.tile .big{font-size:28px;font-weight:600}
.tile.now{border-color:var(--now);background:var(--now-bg)}
.tile.now .big{color:var(--now)}
.bar{height:6px;background:var(--todo-bg);border-radius:3px;overflow:hidden;width:100%}
.bar span{display:block;height:100%;background:var(--bar)}
.pill{font-size:12px;padding:2px 8px;border-radius:99px;white-space:nowrap}
.pill.done{background:var(--done-bg);color:var(--done)}
.pill.active{background:var(--now-bg);color:var(--now)}
.pill.todo{background:var(--todo-bg);color:var(--todo)}
.grid{display:grid;gap:12px;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));align-items:start}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px 16px}
.card.active{border-color:var(--now)}
summary{display:flex;flex-wrap:wrap;align-items:center;gap:8px;cursor:pointer;list-style:none}
summary::-webkit-details-marker{display:none}
summary .bar{flex-basis:100%}
.count{color:var(--muted);font-size:13px}
.check{list-style:none;margin:12px 0 0;padding:0}
.check li{display:flex;gap:8px;padding:4px 0;border-top:1px solid var(--line);font-size:14px}
.mark{flex:0 0 18px;height:18px;border-radius:5px;border:1.5px solid var(--line);display:grid;place-items:center;font-size:12px;margin-top:2px}
.ok .mark{background:var(--done-bg);border-color:var(--done);color:var(--done)}
.ok>span:last-child{color:var(--muted)}
.dropped{color:var(--muted)}
.notes{color:var(--muted);font-size:13px;margin:10px 0 0}
.steps{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.step{display:flex;gap:12px;align-items:flex-start;background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px}
.step.done{opacity:.7}
.step.now{border-color:var(--now);background:var(--now-bg)}
.sid{flex:0 0 36px;font-weight:600;font-size:14px;padding-top:1px}
.step.done .sid{color:var(--done)}.step.now .sid{color:var(--now)}
.step>div{flex:1;min-width:0}
.stext{font-size:14px}.snote{font-size:13px;color:var(--muted)}
.size{font-size:12px;color:var(--muted);border:1px solid var(--line);border-radius:6px;padding:0 6px}
.list{list-style:none;margin:0;padding:0;background:var(--card);border:1px solid var(--line);border-radius:12px}
.list li{padding:8px 14px;border-top:1px solid var(--line);font-size:14px;display:flex;gap:10px}
.list li:first-child{border-top:0}
.list .h{font:13px ui-monospace,Menlo,monospace;color:var(--muted)}
.list .d{color:var(--muted);font-size:13px;white-space:nowrap}
.empty{color:var(--muted);font-size:14px}
</style>
</head>
<body><main>
<h1>DND Table Companion — progress</h1>
<div class="meta">Built ${esc(stamp)} from docs/ROADMAP.md, docs/RESEARCH.md and git (${esc(branch)}) · reloads every 30 s · rebuild: <code>npm run roadmap</code></div>

<div class="hero">
  <div class="tile"><div class="label">Overall</div><div class="big">${pct(allDone, allTotal)}%</div>${bar(allDone, allTotal)}<div class="label" style="margin-top:6px">${allDone} of ${allTotal} items</div></div>
  <div class="tile now"><div class="label">Working on now</div><div class="big">${
    nowStep ? esc(nowStep.id) : 'Nothing open'
  }</div>${nowStep ? `<div class="stext">${inline(nowStep.text)}</div>` : ''}</div>
  <div class="tile"><div class="label">Uncommitted files</div><div class="big">${dirty.length}</div><div class="label">${
    dirty.length ? dirty.slice(0, 4).map((l) => `<code>${esc(l.slice(3))}</code>`).join(' ') + (dirty.length > 4 ? ' …' : '') : 'Working tree clean'
  }</div></div>
</div>

${
  orderedSteps.length
    ? `<h2>Content plan (docs/RESEARCH.md) · ${orderedSteps.filter((s) => s.done).length}/${orderedSteps.length}</h2>
<p class="meta" style="margin-top:-6px">${inline(plan.orderNote)}</p>
<ol class="steps">${planRows}</ol>`
    : ''
}

<h2>Phases (docs/ROADMAP.md)</h2>
<div class="grid">${phaseSections.map(sectionCard).join('')}</div>

${
  noteSections.length
    ? `<h2>Decisions</h2>${noteSections
        .map((s) => `<details class="card"><summary><h3>${inline(s.title)}</h3></summary><p class="notes">${s.notes.map(inline).join('<br>')}</p></details>`)
        .join('')}`
    : ''
}

<h2>Recent commits</h2>
${
  commits.length
    ? `<ul class="list">${commits
        .map(([h, d, s]) => `<li><span class="h">${esc(h)}</span><span style="flex:1">${inline(s)}</span><span class="d">${esc(d)}</span></li>`)
        .join('')}</ul>`
    : '<p class="empty">No commits found.</p>'
}
</main></body></html>
`

writeFileSync(join(root, 'docs/roadmap.html'), html)
console.log(`docs/roadmap.html: ${allDone}/${allTotal} done${nowStep ? `, now ${nowStep.id}` : ''}`)
