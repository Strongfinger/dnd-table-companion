// The journey chronicle (บันทึกการเดินทาง): the campaign's story so far, read like a storybook.
// - Shelf (#/story): every book this device can open. Players see the DM's shared book; the DM also writes.
// - Reader (#/story/c/… or #/story/s/…): contents, then one chapter a page with previous / next.
// - Manage (#/story/m/<campaign>, DM): the chapters, "players may read", and sharing through Firebase.
// - Editor (#/story/edit/<chapter>, DM): text with pictures; saves by itself a moment after typing.
import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import { renderSVG } from 'uqr'
import { go, goBack } from '../app/router'
import { useLobby } from '../app/useLobby'
import { listCampaigns, setChronicleId } from '../db/campaigns'
import { deleteChapter, deleteSharedBook, getChapter, getSharedBook, listChapters, listSharedBooks, saveChapter, saveSharedBook } from '../db/chronicle'
import { deviceId } from '../db/device'
import { canManageCampaign, type Campaign } from '../model/campaign'
import {
  bookOf, chapterFromMarkdown, chapterHeading, createChapter, imageMarkdown, insertBlock, MAX_IMAGES_PER_CHAPTER, neighbours,
  readingMinutes, usedImageIds, type Book, type Chapter,
} from '../model/chronicle'
import { thaiDate } from '../model/note'
import { fetchChronicle, isShareId, newShareId, publishChronicle, SHARE_ERROR_TEXT, ShareFailed } from '../sync/chronicleShare'
import { firebaseConfig } from '../sync/firebaseTransport'
import { compressImage } from '../ui/imageResize'
import { Button, Section, TextInput } from '../ui/kit'
import StoryText from '../ui/StoryText'

const NO_CAMPAIGN = 'none'
const SAVE_AFTER_MS = 700
const select = 'rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base'

/** Remembered per viewer on this device (a convenience: it may be missing, e.g. in a private window). */
function remembered(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function remember(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
  } catch {
    // Nothing to do: it just won't be remembered.
  }
}

const shareLink = (shareId: string) => `${window.location.origin}${window.location.pathname}#/story/s/${shareId}`

/** A pasted link (…#/story/s/<id>) or just the id. */
function shareIdFrom(text: string): string | null {
  const id = text.trim().match(/([A-Za-z0-9]{20})\/?$/)?.[1] ?? text.trim().match(/#\/story\/s\/([A-Za-z0-9]{20})/)?.[1]
  return id && isShareId(id) ? id : null
}

// --- shelf ---

export default function StoryShelf() {
  const campaigns = useLiveQuery(listCampaigns)
  const chapters = useLiveQuery(listChapters) ?? []
  const shared = useLiveQuery(listSharedBooks) ?? []
  const lobby = useLobby()
  const playerInRoom = lobby.session?.role === 'player'
  const [link, setLink] = useState('')
  if (!campaigns) return null

  const me = deviceId()
  const mine = campaigns.filter((c) => canManageCampaign(c, me, playerInRoom))
  // Books from the DM: the room's campaign (and others joined before), and links opened on this phone.
  const fromDm = new Map<string, string>()
  for (const c of campaigns) if (c.chronicleId && !mine.includes(c)) fromDm.set(c.chronicleId, c.name)
  for (const b of shared) if (!mine.some((c) => c.chronicleId === b.shareId)) fromDm.set(b.shareId, b.title || fromDm.get(b.shareId) || 'บันทึกการเดินทาง')
  const loose = chapters.filter((c) => !c.campaignId || !campaigns.some((x) => x.id === c.campaignId))
  const linkId = shareIdFrom(link)

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-3xl font-bold text-amber-400">📚 บันทึกการเดินทาง</h1>
        <p className="text-stone-400">เรื่องราวการผจญภัยที่ผ่านมา อ่านเหมือนนิยาย DM เพิ่มบทใหม่หลังจบแต่ละเซสชัน</p>
      </header>

      <Section title="📖 อ่าน">
        {fromDm.size === 0 && mine.length === 0 && (
          <p className="text-sm text-stone-400">ยังไม่มีบันทึก · เข้าห้องของ DM (แท็บ 🌐 ห้อง) แล้วบันทึกของแคมเปญจะมาที่นี่เอง หรือวางลิงก์ที่ DM ให้ด้านล่าง</p>
        )}
        <ul className="space-y-2">
          {[...fromDm].map(([shareId, title]) => (
            <li key={shareId}><BookCard href={`#/story/s/${shareId}`} title={title} note={shared.some((b) => b.shareId === shareId) ? 'อ่านแบบออฟไลน์ได้' : 'แตะเพื่อดาวน์โหลด'} /></li>
          ))}
          {mine.map((c) => {
            const n = chapters.filter((x) => x.campaignId === c.id).length
            return n > 0 && <li key={c.id}><BookCard href={`#/story/c/${c.id}`} title={c.name} note={`${n} บท (ฉบับของ DM รวมฉบับร่าง)`} /></li>
          })}
          {loose.length > 0 && <li><BookCard href={`#/story/c/${NO_CAMPAIGN}`} title="ไม่มีแคมเปญ" note={`${loose.length} บท`} /></li>}
        </ul>
        <div className="mt-3 flex gap-2">
          <div className="min-w-0 flex-1"><TextInput value={link} placeholder="วางลิงก์บันทึกที่ DM ส่งมา" onChange={setLink} /></div>
          <Button variant="primary" className="whitespace-nowrap" onClick={() => linkId && go(`/story/s/${linkId}`)}>เปิด</Button>
        </div>
        {link && !linkId && <p className="mt-1 text-xs text-red-300">ลิงก์ไม่ถูกต้อง (ต้องมี #/story/s/ ตามด้วยรหัส 20 ตัว)</p>}
      </Section>

      {!playerInRoom && (
        <Section title="✏️ เขียนบันทึก (DM)">
          {mine.length === 0
            ? <p className="text-sm text-stone-400">สร้างแคมเปญก่อน (หน้า 📜 ตัวละคร หรือแท็บ 🧙 DM) แล้วเขียนบันทึกของแคมเปญนั้นได้</p>
            : (
              <ul className="space-y-1.5">
                {mine.map((c) => (
                  <li key={c.id}>
                    <a href={`#/story/m/${c.id}`} className="flex items-center justify-between rounded-lg bg-stone-900 p-2.5 hover:bg-stone-700">
                      <span className="font-bold">🗺 {c.name}</span>
                      <span className="text-xs text-stone-400">{chapters.filter((x) => x.campaignId === c.id).length} บท{c.chronicleId ? ' · แชร์แล้ว' : ''} ›</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
        </Section>
      )}
    </div>
  )
}

function BookCard({ href, title, note }: { href: string; title: string; note: string }) {
  return (
    <a href={href} className="flex items-center gap-3 rounded-lg bg-gradient-to-r from-amber-900/60 to-stone-900 p-3 hover:from-amber-800/60">
      <span className="text-3xl" aria-hidden>📕</span>
      <span className="min-w-0">
        <span className="block truncate font-bold text-amber-100">{title}</span>
        <span className="block text-xs text-stone-400">{note}</span>
      </span>
    </a>
  )
}

// --- reading ---

/** #/story/c/<campaign> and #/story/s/<shareId>, with or without a chapter. */
export function BookRoute({ source, id, chapterId }: { source: 'local' | 'shared'; id: string; chapterId: string | null }) {
  if (source === 'local') return <LocalBook campaignId={id} chapterId={chapterId} />
  if (!isShareId(id)) return <p className="text-center text-stone-400">ลิงก์ไม่ถูกต้อง · <a href="#/story" className="underline">กลับ</a></p>
  return <SharedBookView shareId={id} chapterId={chapterId} />
}

function LocalBook({ campaignId, chapterId }: { campaignId: string; chapterId: string | null }) {
  const campaigns = useLiveQuery(listCampaigns)
  const chapters = useLiveQuery(listChapters)
  if (!campaigns || !chapters) return null
  const cid = campaignId === NO_CAMPAIGN ? null : campaignId
  const title = campaigns.find((c) => c.id === cid)?.name ?? 'ไม่มีแคมเปญ'
  return <BookReader book={bookOf(title, chapters, cid, false)} base={`/story/c/${campaignId}`} chapterId={chapterId} showDrafts />
}

function SharedBookView({ shareId, chapterId }: { shareId: string; chapterId: string | null }) {
  const cached = useLiveQuery(() => getSharedBook(shareId), [shareId])
  const [state, setState] = useState<'loading' | 'fresh' | { error: string }>('loading')
  const [loaded, setLoaded] = useState(false)

  // Download what's new once per visit; the saved copy shows meanwhile (and offline).
  useEffect(() => {
    let stop = false
    getSharedBook(shareId).then(async (old) => {
      setLoaded(true)
      try {
        const book = await fetchChronicle(shareId, old)
        if (stop) return
        await saveSharedBook(book)
        setState('fresh')
      } catch (err) {
        if (!stop) setState({ error: SHARE_ERROR_TEXT[err instanceof ShareFailed ? err.reason : 'offline'] })
      }
    })
    return () => {
      stop = true
    }
  }, [shareId])

  if (!loaded || (cached === undefined && state === 'loading')) return <p className="text-center text-stone-400">กำลังโหลดบันทึกการเดินทาง…</p>
  if (!cached) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-stone-300">{typeof state === 'object' ? state.error : 'โหลดไม่สำเร็จ'}</p>
        <Button onClick={() => goBack('/story')}>← กลับ</Button>
      </div>
    )
  }
  const status = state === 'loading' ? '⟳ กำลังเช็กบทใหม่…' : state === 'fresh' ? '' : `ออฟไลน์: แสดงฉบับที่บันทึกไว้ (${typeof state === 'object' ? state.error : ''})`
  return (
    <BookReader
      book={{ title: cached.title, chapters: cached.chapters }}
      base={`/story/s/${shareId}`}
      chapterId={chapterId}
      status={status}
      onRemove={chapterId ? undefined : async () => { await deleteSharedBook(shareId); go('/story') }}
    />
  )
}

const FONT_SIZES = ['text-base', 'text-lg', 'text-xl', 'text-2xl'] as const

/** The book: its contents (no chapter) or one chapter with previous / next. */
export function BookReader({ book, base, chapterId, status, showDrafts, onRemove }: {
  book: Book
  /** Route of this book, e.g. "/story/s/<id>". */
  base: string
  chapterId: string | null
  /** A short line about downloading (players). */
  status?: string
  showDrafts?: boolean
  onRemove?: () => void
}) {
  const [font, setFont] = useState(() => Math.max(0, FONT_SIZES.indexOf((remembered('story-font') ?? 'text-lg') as (typeof FONT_SIZES)[number])))
  const lastKey = `story-last:${base}`
  const chapter = chapterId ? book.chapters.find((c) => c.id === chapterId) : null
  useEffect(() => {
    if (chapter) remember(lastKey, chapter.id)
  }, [chapter, lastKey])

  const setSize = (i: number) => {
    setFont(i)
    remember('story-font', FONT_SIZES[i])
  }

  if (chapterId && !chapter) {
    return <p className="text-center text-stone-400">ไม่พบบทนี้ · <a href={`#${base}`} className="underline">ไปที่สารบัญ</a></p>
  }

  if (!chapter) {
    const last = book.chapters.find((c) => c.id === remembered(lastKey))
    const first = book.chapters[0]
    return (
      <div className="space-y-4">
        <button type="button" onClick={() => goBack('/story')} className="text-sm text-stone-400">← ชั้นหนังสือ</button>
        <div className="rounded-2xl bg-gradient-to-b from-amber-900 to-stone-900 px-6 py-10 text-center shadow-xl ring-1 ring-amber-700/50">
          <p className="text-sm tracking-widest text-amber-300/80">บันทึกการเดินทาง</p>
          <h1 className="mt-2 text-3xl font-bold text-amber-100">{book.title}</h1>
          <p className="mt-3 text-sm text-stone-300">{book.chapters.length} บท</p>
          {first && (
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              {last && last.id !== first.id && <Button variant="primary" onClick={() => go(`${base}/${last.id}`)}>อ่านต่อ: บทที่ {last.number}</Button>}
              <Button variant={last && last.id !== first.id ? 'secondary' : 'primary'} onClick={() => go(`${base}/${first.id}`)}>เริ่มอ่านจากบทแรก</Button>
            </div>
          )}
        </div>
        {status && <p className="text-center text-xs text-stone-500">{status}</p>}
        {book.chapters.length === 0
          ? <p className="text-center text-stone-400">ยังไม่มีบท · DM จะเพิ่มบทใหม่หลังจบเซสชัน</p>
          : (
            <ol className="space-y-1.5">
              {book.chapters.map((c) => (
                <li key={c.id}>
                  <a href={`#${base}/${c.id}`} className="block rounded-lg bg-stone-800 p-3 hover:bg-stone-700">
                    <span className="block font-bold text-amber-200">{chapterHeading(c)}{showDrafts && !c.published && <span className="ml-2 rounded bg-stone-600 px-1.5 text-xs font-normal text-stone-200">ฉบับร่าง</span>}</span>
                    <span className="block text-xs text-stone-400">{[thaiDate(c.sessionDate), `อ่าน ~${readingMinutes(c.body)} นาที`, c.images.length ? `🖼 ${c.images.length}` : ''].filter(Boolean).join(' · ')}</span>
                  </a>
                </li>
              ))}
            </ol>
          )}
        {onRemove && <div className="text-center"><button type="button" onClick={onRemove} className="text-xs text-stone-500 underline">เอาหนังสือเล่มนี้ออกจากเครื่องนี้</button></div>}
      </div>
    )
  }

  const { prev, next } = neighbours(book, chapter.id)
  return (
    <article className="space-y-3">
      <div className="flex items-center justify-between gap-2 text-sm">
        <a href={`#${base}`} className="truncate text-stone-400">← {book.title}</a>
        <span className="flex shrink-0 gap-1" aria-label="ขนาดตัวอักษร">
          <button type="button" className="rounded bg-stone-800 px-2 py-0.5 disabled:opacity-40" disabled={font === 0} onClick={() => setSize(font - 1)} aria-label="ตัวอักษรเล็กลง">ก−</button>
          <button type="button" className="rounded bg-stone-800 px-2 py-0.5 disabled:opacity-40" disabled={font === FONT_SIZES.length - 1} onClick={() => setSize(font + 1)} aria-label="ตัวอักษรใหญ่ขึ้น">ก+</button>
        </span>
      </div>
      <div className={`space-y-4 rounded-2xl bg-[#f6eedb] px-5 py-7 leading-loose text-stone-900 shadow-xl sm:px-8 ${FONT_SIZES[font]}`}>
        <header className="space-y-1 border-b border-amber-900/20 pb-4 text-center">
          <p className="text-[0.75em] tracking-widest text-amber-900/70">บทที่ {chapter.number}</p>
          {chapter.title.trim() && <h1 className="text-[1.5em] font-bold leading-snug text-amber-950">{chapter.title}</h1>}
          {chapter.sessionDate && <p className="text-[0.75em] text-stone-600">{thaiDate(chapter.sessionDate)}</p>}
          {showDrafts && !chapter.published && <p className="text-[0.75em] text-red-800">ฉบับร่าง: ผู้เล่นยังไม่เห็นบทนี้</p>}
        </header>
        {chapter.body.trim() ? <StoryText text={chapter.body} images={chapter.images} /> : <p className="text-center text-stone-500">(บทนี้ยังว่าง)</p>}
        <p className="pt-2 text-center text-amber-900/50" aria-hidden>❦</p>
      </div>
      <nav className="grid grid-cols-2 gap-2">
        {prev ? <a href={`#${base}/${prev.id}`} className="rounded-lg bg-stone-800 p-3 text-sm hover:bg-stone-700"><span className="block text-xs text-stone-400">‹ บทก่อนหน้า</span><span className="line-clamp-2">{chapterHeading(prev)}</span></a> : <span />}
        {next
          ? <a href={`#${base}/${next.id}`} className="rounded-lg bg-amber-500 p-3 text-right text-sm font-bold text-stone-900 hover:bg-amber-400"><span className="block text-xs font-normal">บทถัดไป ›</span><span className="line-clamp-2">{chapterHeading(next)}</span></a>
          : <a href={`#${base}`} className="rounded-lg bg-stone-800 p-3 text-right text-sm hover:bg-stone-700"><span className="block text-xs text-stone-400">จบบทล่าสุดแล้ว</span>📚 สารบัญ</a>}
      </nav>
    </article>
  )
}

// --- DM: manage a campaign's chronicle ---

export function StoryManage({ campaignId }: { campaignId: string }) {
  const campaigns = useLiveQuery(listCampaigns)
  const all = useLiveQuery(listChapters)
  if (!campaigns || !all) return null
  const campaign = campaigns.find((c) => c.id === campaignId)
  if (!campaign) return <p className="text-center text-stone-400">ไม่พบแคมเปญนี้ · <a href="#/story" className="underline">กลับ</a></p>
  const book = bookOf(campaign.name, all, campaign.id, false)

  async function add() {
    const c = await saveChapter(createChapter(campaign!.id, all!))
    go(`/story/edit/${c.id}`)
  }

  return (
    <div className="space-y-4">
      <button type="button" onClick={() => goBack('/story')} className="text-sm text-stone-400">← บันทึกการเดินทาง</button>
      <header>
        <p className="text-sm text-stone-400">บันทึกการเดินทาง (DM)</p>
        <h1 className="text-2xl font-bold text-amber-400">🗺 {campaign.name}</h1>
      </header>

      <Section title="📜 บท" action={<a href={`#/story/c/${campaign.id}`} className="text-sm text-amber-400 underline">👁 อ่านแบบผู้เล่น</a>}>
        <ul className="space-y-1.5">
          {book.chapters.map((c) => (
            <li key={c.id}>
              <a href={`#/story/edit/${c.id}`} className="block rounded-lg bg-stone-900 p-2.5 hover:bg-stone-700">
                <span className="flex items-baseline justify-between gap-2">
                  <span className="font-bold">{chapterHeading(c)}</span>
                  <span className={`shrink-0 text-xs ${c.published ? 'text-green-400' : 'text-stone-500'}`}>{c.published ? '👁 ผู้เล่นอ่านได้' : 'ฉบับร่าง'}</span>
                </span>
                <span className="block text-xs text-stone-400">{[thaiDate(c.sessionDate), c.images.length ? `🖼 ${c.images.length}` : ''].filter(Boolean).join(' · ')}</span>
              </a>
            </li>
          ))}
        </ul>
        {book.chapters.length === 0 && <p className="text-sm text-stone-400">ยังไม่มีบท · หลังจบเซสชัน กด "+ บทใหม่" แล้วเล่าเรื่องที่เกิดขึ้น (ใส่รูปประกอบได้ หรือนำเข้าไฟล์ .md ที่เขียนไว้)</p>}
        <Button variant="primary" className="mt-3 w-full" onClick={add}>+ บทใหม่</Button>
      </Section>

      <SharePanel campaign={campaign} chapters={book.chapters} />
    </div>
  )
}

/** Send the published chapters to Firebase, and give players the link. */
function SharePanel({ campaign, chapters }: { campaign: Campaign; chapters: Chapter[] }) {
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [sentFor, setSentFor] = useState<string>(() => remembered(`story-sent:${campaign.id}`) ?? '')
  const [copied, setCopied] = useState(false)
  const shareId = campaign.chronicleId
  const published = chapters.filter((c) => c.published)
  // What was last sent, to tell the DM when there's something new to send (only a hint: Firebase decides).
  const fingerprint = JSON.stringify(published.map((c) => [c.id, c.updatedAt, c.number]))
  const pending = shareId && sentFor !== `${shareId}:${fingerprint}`
  const lobby = useLobby()
  const roomPlaysIt = lobby.session?.role === 'dm' && lobby.campaignId === campaign.id

  if (!firebaseConfig()) {
    return <Section title="📤 ส่งให้ผู้เล่น"><p className="text-sm text-stone-400">แอปนี้ยังไม่ได้ตั้งค่า Firebase จึงแชร์ไม่ได้ (อ่านได้เฉพาะในเครื่องนี้)</p></Section>
  }

  async function send(id: string) {
    setBusy('กำลังส่ง…')
    setResult(null)
    try {
      const r = await publishChronicle(id, campaign.name, chapters, (done, total) => setBusy(`กำลังส่งบทที่ ${done + 1}/${total}…`))
      if (campaign.chronicleId !== id) await setChronicleId(campaign.id, id)
      const mark = `${id}:${fingerprint}`
      remember(`story-sent:${campaign.id}`, mark)
      setSentFor(mark)
      setResult({ ok: true, text: r.sent || r.removed ? `✓ ส่งแล้ว ${r.sent} บท${r.removed ? ` · เอาออก ${r.removed} บท` : ''}` : '✓ ผู้เล่นมีฉบับล่าสุดอยู่แล้ว' })
    } catch (err) {
      setResult({ ok: false, text: SHARE_ERROR_TEXT[err instanceof ShareFailed ? err.reason : 'offline'] })
    } finally {
      setBusy(null)
    }
  }

  async function copy(link: string) {
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard blocked: the link is shown to copy by hand.
    }
  }

  const link = shareId ? shareLink(shareId) : ''
  return (
    <Section title="📤 ส่งให้ผู้เล่น">
      <p className="mb-3 text-sm text-stone-400">
        ส่งเฉพาะบทที่ติ๊ก "ผู้เล่นอ่านได้" ({published.length} บท) ผู้เล่นอ่านได้ทุกเมื่อที่ออนไลน์ แล้วเก็บไว้อ่านออฟไลน์
        {roomPlaysIt ? ' · ผู้เล่นในห้องตอนนี้ได้ลิงก์อัตโนมัติ' : ' · ผู้เล่นที่เข้าห้องของแคมเปญนี้ได้ลิงก์อัตโนมัติ'}
      </p>
      {!shareId
        ? <Button variant="primary" className="w-full" onClick={() => !busy && send(newShareId())}>{busy ?? `📤 เริ่มแชร์ (${published.length} บท)`}</Button>
        : (
          <div className="space-y-3">
            <Button variant={pending ? 'primary' : 'secondary'} className="w-full" onClick={() => !busy && send(shareId)}>
              {busy ?? (pending ? '📤 ส่งบทใหม่/ที่แก้ให้ผู้เล่น' : '📤 ส่งอีกครั้ง')}
            </Button>
            <div className="rounded-lg bg-stone-900 p-3 text-center">
              <div className="mx-auto w-40 rounded-lg bg-white p-2" role="img" aria-label={`QR code: ${link}`} dangerouslySetInnerHTML={{ __html: renderSVG(link, { border: 1 }) }} />
              <p className="mt-2 break-all text-xs text-stone-400">{link}</p>
              <Button className="mt-2 text-sm" onClick={() => copy(link)}>{copied ? '✓ คัดลอกแล้ว' : '📋 คัดลอกลิงก์'}</Button>
            </div>
          </div>
        )}
      {result && <p className={`mt-2 text-sm ${result.ok ? 'text-green-400' : 'text-red-300'}`}>{result.text}</p>}
      {result && !result.ok && shareId && (
        <button type="button" className="mt-1 text-xs text-stone-400 underline" onClick={() => !busy && send(newShareId())}>สร้างลิงก์ใหม่ (ลิงก์เดิมจะไม่อัปเดตอีก)</button>
      )}
    </Section>
  )
}

// --- DM: write a chapter ---

export function ChapterEditor({ id }: { id: string }) {
  const [chapter, setChapter] = useState<Chapter | null | undefined>(undefined)
  useEffect(() => {
    getChapter(id).then((c) => setChapter(c ?? null))
  }, [id])
  if (chapter === undefined) return null
  if (chapter === null) return <p className="text-center text-stone-400">ไม่พบบทนี้ · <a href="#/story" className="underline">กลับ</a></p>
  return <EditorForm start={chapter} />
}

function EditorForm({ start }: { start: Chapter }) {
  const [c, setC] = useState(start)
  const [status, setStatus] = useState<'saved' | 'saving' | 'changed' | 'idle'>('idle')
  const [preview, setPreview] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [pendingImport, setPendingImport] = useState<{ title: string; body: string } | null>(null)
  const dirty = useRef(false)
  const bodyRef = useRef<HTMLTextAreaElement>(null)
  const imageInput = useRef<HTMLInputElement>(null)
  const mdInput = useRef<HTMLInputElement>(null)
  const back = c.campaignId ? `/story/m/${c.campaignId}` : `/story/c/${NO_CAMPAIGN}`

  useEffect(() => {
    if (!dirty.current) return
    const timer = setTimeout(async () => {
      dirty.current = false
      setStatus('saving')
      await saveChapter(c)
      setStatus('saved')
    }, SAVE_AFTER_MS)
    return () => clearTimeout(timer)
  }, [c])

  const set = (patch: Partial<Chapter>) => {
    dirty.current = true
    setStatus('changed')
    setC((old) => ({ ...old, ...patch }))
  }

  async function done() {
    if (dirty.current) await saveChapter(c)
    dirty.current = false
    go(back)
  }

  async function addImages(files: FileList | null) {
    if (!files?.length) return
    const room = MAX_IMAGES_PER_CHAPTER - c.images.length
    if (room <= 0) return setMessage(`บทหนึ่งใส่รูปได้ไม่เกิน ${MAX_IMAGES_PER_CHAPTER} รูป`)
    setMessage('กำลังย่อรูป…')
    let body = c.body
    let cursor = bodyRef.current?.selectionStart ?? body.length
    const images = [...c.images]
    try {
      for (const file of [...files].slice(0, room)) {
        const small = await compressImage(file)
        const img = { id: crypto.randomUUID(), ...small }
        images.push(img)
        const r = insertBlock(body, cursor, imageMarkdown(img.id, ''))
        body = r.body
        cursor = r.cursor
      }
      setMessage(files.length > room ? `ใส่ได้ ${room} รูป (เต็ม ${MAX_IMAGES_PER_CHAPTER} รูปแล้ว)` : 'ใส่รูปแล้ว · พิมพ์คำบรรยายในวงเล็บ [ ] ได้')
    } catch (err) {
      setMessage((err as Error).message)
    }
    set({ images, body })
  }

  async function importMarkdown(files: FileList | null) {
    const file = files?.[0]
    if (!file) return
    if (file.size > 1_000_000) return setMessage('ไฟล์ใหญ่เกินไป')
    const r = chapterFromMarkdown(await file.text())
    if (c.body.trim()) setPendingImport(r)
    else set({ title: c.title || r.title, body: r.body })
  }

  const used = usedImageIds(c.body)
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-stone-500">{status === 'saving' ? 'กำลังบันทึก…' : status === 'saved' ? '✓ บันทึกแล้ว' : status === 'changed' ? '…' : 'บันทึกให้อัตโนมัติ'}</span>
        <span className="flex gap-2">
          <Button className="text-sm" onClick={() => setPreview(!preview)}>{preview ? '✏️ เขียนต่อ' : '👁 ดูตัวอย่าง'}</Button>
          <Button variant="primary" className="text-sm" onClick={done}>✓ เสร็จ</Button>
        </span>
      </div>

      {preview
        ? <BookReader book={{ title: '', chapters: [c] }} base={`/story/edit/${c.id}`} chapterId={c.id} />
        : (
          <>
            <div className="flex gap-2">
              <label className="w-24 shrink-0 text-sm">
                <span className="text-stone-400">บทที่</span>
                <input type="number" min={0} max={9999} className={`mt-1 w-full ${select}`} value={c.number} onChange={(e) => set({ number: Math.max(0, Math.min(9999, Math.round(Number(e.target.value) || 0))) })} />
              </label>
              <label className="min-w-0 flex-1 text-sm">
                <span className="text-stone-400">วันที่เล่น</span>
                <input type="date" className={`mt-1 w-full ${select}`} value={c.sessionDate} onChange={(e) => set({ sessionDate: e.target.value })} />
              </label>
            </div>
            <TextInput value={c.title} placeholder="ชื่อตอน เช่น เงาในเหมืองดวอร์ฟ" onChange={(title) => set({ title })} />
            <label className="flex items-center gap-2 rounded-lg bg-stone-800 p-3">
              <input type="checkbox" className="h-5 w-5 accent-amber-500" checked={c.published} onChange={(e) => set({ published: e.target.checked })} />
              <span>
                <span className="block font-bold">👁 ผู้เล่นอ่านได้</span>
                <span className="block text-xs text-stone-400">ไม่ติ๊ก = ฉบับร่าง เห็นแค่เครื่องนี้ · ติ๊กแล้วกด "ส่งให้ผู้เล่น" ที่หน้ารายการบท</span>
              </span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button className="text-sm" onClick={() => imageInput.current?.click()}>🖼 ใส่รูปประกอบ</Button>
              <Button className="text-sm" onClick={() => mdInput.current?.click()}>📄 นำเข้าไฟล์ .md</Button>
              <input ref={imageInput} type="file" accept="image/*" multiple hidden onChange={(e) => { void addImages(e.target.files); e.target.value = '' }} />
              <input ref={mdInput} type="file" accept=".md,.markdown,.txt,text/markdown,text/plain" hidden onChange={(e) => { void importMarkdown(e.target.files); e.target.value = '' }} />
            </div>
            {message && <p className="text-sm text-amber-200">{message}</p>}
            {pendingImport && (
              <div className="rounded-lg bg-stone-800 p-3 text-sm">
                <p>บทนี้มีข้อความอยู่แล้ว จะใส่ไฟล์ "{pendingImport.title || 'ไม่มีชื่อ'}" อย่างไร?</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button className="text-sm" onClick={() => { set({ body: `${c.body.trimEnd()}\n\n${pendingImport.body}` }); setPendingImport(null) }}>ต่อท้าย</Button>
                  <Button variant="danger" className="text-sm" onClick={() => { set({ title: pendingImport.title || c.title, body: pendingImport.body }); setPendingImport(null) }}>แทนที่ทั้งหมด</Button>
                  <Button className="text-sm" onClick={() => setPendingImport(null)}>ยกเลิก</Button>
                </div>
              </div>
            )}
            <textarea
              ref={bodyRef}
              aria-label="เนื้อเรื่อง"
              className="min-h-[50dvh] w-full rounded-lg border border-stone-600 bg-stone-900 px-3 py-2 text-base leading-relaxed"
              placeholder={'เล่าเรื่องที่เกิดขึ้นในเซสชันนี้ เหมือนเล่านิทาน…\n\nเว้นบรรทัดว่าง = ขึ้นย่อหน้าใหม่\n## หัวข้อย่อย\n**ตัวหนา**  *ตัวเอียง*\n> คำพูดของตัวละคร\n--- = ตัวคั่นฉาก'}
              value={c.body}
              onChange={(e) => set({ body: e.target.value })}
            />
            {c.images.length > 0 && (
              <div>
                <p className="mb-1 text-xs text-stone-400">รูปในบทนี้ (ลบบรรทัด ![…](img:…) ออกจากเนื้อเรื่อง = เอารูปออก)</p>
                <div className="flex flex-wrap gap-2">
                  {c.images.map((img) => (
                    <img key={img.id} src={img.dataUrl} alt="" className={`h-16 w-16 rounded object-cover ${used.has(img.id) ? '' : 'opacity-30'}`} title={used.has(img.id) ? '' : 'ไม่ได้ใช้: จะถูกลบเมื่อบันทึก'} />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

      <div className="flex justify-end gap-2">
        <Button className="text-sm" onClick={() => setConfirmDelete(!confirmDelete)}>🗑 ลบบทนี้</Button>
        {confirmDelete && <Button variant="danger" className="text-sm" onClick={async () => { dirty.current = false; await deleteChapter(c.id); go(back) }}>ยืนยันลบ</Button>}
      </div>
    </div>
  )
}

