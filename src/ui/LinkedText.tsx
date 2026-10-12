// Text with its [[links]] as buttons (notebook pages, session plans). Links to pages that don't exist
// yet are dashed: tapping one creates the page (the caller's onFollow decides).
import { findPage, parseLinks, type Note } from '../model/note'

export default function LinkedText({ text, pages, campaignId, onFollow }: { text: string; pages: Note[]; campaignId: string | null; onFollow: (title: string) => void }) {
  return (
    <>
      {parseLinks(text).map((p, i) => {
        if ('text' in p) return <span key={i}>{p.text}</span>
        const exists = !!findPage(pages, p.link, campaignId)
        return (
          <button
            key={i}
            type="button"
            onClick={() => onFollow(p.link)}
            title={exists ? 'เปิดหน้านี้' : 'ยังไม่มีหน้านี้: แตะเพื่อสร้าง'}
            className={`font-bold underline ${exists ? 'text-sky-300' : 'text-stone-400 decoration-dashed'}`}
          >
            {p.link}
          </button>
        )
      })}
    </>
  )
}
