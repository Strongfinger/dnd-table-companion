// Shows simple markdown (see model/miniMarkdown.ts) as React elements. Text is always text: no raw HTML.
import { parseMarkdown, type Line } from '../model/miniMarkdown'

function Spans({ line }: { line: Line }) {
  return line.map((s, i) => {
    const t = s.bold && s.italic ? <b><i>{s.text}</i></b> : s.bold ? <b>{s.text}</b> : s.italic ? <i>{s.text}</i> : s.text
    return <span key={i}>{t}</span>
  })
}

export default function MiniMarkdown({ text }: { text: string }) {
  return parseMarkdown(text).map((b, i) => {
    if (b.kind === 'h') return <p key={i} className="font-bold text-amber-200"><Spans line={b.line} /></p>
    if (b.kind === 'ul') return <ul key={i} className="list-disc space-y-1 pl-5">{b.items.map((it, j) => <li key={j}><Spans line={it} /></li>)}</ul>
    if (b.kind === 'table') {
      return (
        <div key={i} className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead><tr>{b.head.map((c, j) => <th key={j} className="border-b border-stone-600 px-2 py-1 font-bold text-amber-200"><Spans line={c} /></th>)}</tr></thead>
            <tbody>{b.rows.map((r, j) => <tr key={j} className="odd:bg-stone-800/60">{r.map((c, k) => <td key={k} className="px-2 py-1 align-top"><Spans line={c} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      )
    }
    return <p key={i}>{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Spans line={l} /></span>)}</p>
  })
}
