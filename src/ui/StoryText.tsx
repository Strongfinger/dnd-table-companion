// A chronicle chapter's text on the "paper" of the reading view: markdown (model/miniMarkdown.ts with `story`)
// plus the chapter's pictures. Tap a picture to see it full screen. Text is always text: no raw HTML.
import { useState } from 'react'
import type { ChapterImage } from '../model/chronicle'
import { parseMarkdown } from '../model/miniMarkdown'
import { Spans } from './MiniMarkdown'

export default function StoryText({ text, images }: { text: string; images: ChapterImage[] }) {
  const [zoomed, setZoomed] = useState<{ src: string; caption: string } | null>(null)
  const byId = new Map(images.map((i) => [i.id, i]))
  return (
    <>
      {parseMarkdown(text, { story: true }).map((b, i) => {
        switch (b.kind) {
          case 'h': return <h3 key={i} className="pt-2 text-center text-[1.15em] font-bold text-amber-900"><Spans line={b.line} /></h3>
          case 'ul': return <ul key={i} className="list-disc space-y-1 pl-6">{b.items.map((it, j) => <li key={j}><Spans line={it} /></li>)}</ul>
          case 'hr': return <p key={i} className="text-center tracking-[0.6em] text-amber-800/60" aria-hidden>✦✦✦</p>
          case 'quote': return (
            <blockquote key={i} className="border-l-4 border-amber-700/40 pl-3 italic text-stone-700">
              {b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Spans line={l} /></span>)}
            </blockquote>
          )
          case 'img': {
            const img = byId.get(b.id)
            if (!img) return <p key={i} className="text-center text-sm text-stone-500">(ไม่พบรูป{b.caption && `: ${b.caption}`})</p>
            return (
              <figure key={i} className="-mx-2 sm:mx-0">
                <button type="button" className="block w-full" onClick={() => setZoomed({ src: img.dataUrl, caption: b.caption })} aria-label={`ดูรูปเต็มจอ ${b.caption}`}>
                  <img src={img.dataUrl} alt={b.caption} loading="lazy" width={img.width} height={img.height} className="h-auto w-full rounded-lg shadow-md" />
                </button>
                {b.caption && <figcaption className="mt-1 text-center text-[0.85em] italic text-stone-600">{b.caption}</figcaption>}
              </figure>
            )
          }
          case 'table': return (
            <div key={i} className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-[0.85em]">
                <thead><tr>{b.head.map((c, j) => <th key={j} className="border-b border-amber-800/40 px-2 py-1 font-bold"><Spans line={c} /></th>)}</tr></thead>
                <tbody>{b.rows.map((r, j) => <tr key={j} className="odd:bg-amber-900/5">{r.map((c, k) => <td key={k} className="px-2 py-1 align-top"><Spans line={c} /></td>)}</tr>)}</tbody>
              </table>
            </div>
          )
          default: return <p key={i} className="indent-6">{b.lines.map((l, j) => <span key={j}>{j > 0 && <br />}<Spans line={l} /></span>)}</p>
        }
      })}
      {zoomed && (
        <div role="dialog" aria-label="รูปเต็มจอ" className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/90 p-2" onClick={() => setZoomed(null)}>
          <img src={zoomed.src} alt={zoomed.caption} className="max-h-[85dvh] max-w-full object-contain" />
          {zoomed.caption && <p className="mt-2 text-center text-sm text-stone-200">{zoomed.caption}</p>}
          <p className="mt-2 text-xs text-stone-400">แตะเพื่อปิด</p>
        </div>
      )}
    </>
  )
}
