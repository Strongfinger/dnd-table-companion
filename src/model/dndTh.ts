// Shared helpers for DND-TH's Thai translation (https://dnd-th.com/, used with their permission, 2026-10-13):
// tidying their markdown, spotting typos, and keeping the text inside SRD 5.2.1. The SRD leaves out the
// wizards' and other people's names ("Tasha's Hideous Laughter" is just Hideous Laughter) and the worlds;
// DND-TH translates the full books, so their text sometimes has those names and we take them out.
// No runtime imports, so Node can run the build scripts on these files directly.

export const DND_TH_CREDIT = { name: 'DND-TH', url: 'https://dnd-th.com/', license: 'CC BY-NC-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-nc-sa/4.0/' }

/** DND-TH's markdown → ours: site links (also empty anchors) become plain text, escaped "\*" a plain "*", tidy blank lines. */
export function cleanMarkdown(md: string): string {
  return md
    .replace(/\r\n?/g, '\n')
    .replace(/\[\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .split('\n').map((l) => l.replace(/[ \t]+$/g, '')).join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Spots slips worth a human look, each with a little text around it: a vowel or tone mark typed twice,
 * a word typed twice in a row, and Latin letters stuck to a Thai word. Thai has no spaces between words, so
 * a repeat only counts when it starts a word and ends before a non-Thai character; "ที่ที่" is normal Thai.
 */
export function findTypos(text: string): string[] {
  const hits: { at: number; len: number }[] = []
  for (const m of text.matchAll(/([ะาิีึืุู่้๊๋็์])\1/g)) hits.push({ at: m.index, len: 2 })
  for (const m of text.matchAll(/(?<![ก-๛])([ก-ฮเแโใไ][ก-๛]{2,})\1(?![ก-๛])/g)) {
    if (m[1] !== 'ที่') hits.push({ at: m.index, len: m[0].length })
  }
  for (const m of text.matchAll(/[ก-๛][a-z]+\b/g)) hits.push({ at: m.index, len: m[0].length })
  return hits.map(({ at, len }) => `…${text.slice(Math.max(0, at - 15), at + len + 15).replace(/\s+/g, ' ')}…`)
}

// People's names the SRD drops from spell and item names, in English and as DND-TH spells them in Thai
// (longest first, so "ควาลิช" goes before "ควาล").
const OWNERS_EN = ['Abi-Dalzim', 'Bigby', 'Bilarro', 'Daern', 'Drawmij', 'Ehlonna', 'Evard', 'Heward', 'Kwalish', 'Leomund', 'Melf', 'Mordenkainen', 'Nolzur', 'Nystul', 'Otiluke', 'Otto', 'Quaal', 'Rary', 'Tasha', 'Tenser']
const OWNERS_TH = ['มอร์เดนไคเนน', 'อิห์ลอนนา', 'เลโอมุนด์', 'เลโอมันด์', 'ฮิวเวิร์ด', 'บิลาร์โร', 'นอลเซอร์', 'เทนเซอร์', 'อีวาร์ด', 'อ๊อตโต้', 'โอติลุค', 'ควาลิช', 'บิกบี้', 'แรรี่', 'เมล์ฟ', 'ทาชา', 'ดาร์น', 'ควาล']
/** Items the SRD names differently: the books' name → the SRD's. */
const RENAMED: [RegExp, string][] = [
  [/Deck of Many Things/g, 'Mysterious Deck'], [/Apparatus of Kwalish/g, 'Apparatus of the Crab'],
  [/Quiver of Ehlonna/g, 'Efficient Quiver'], [/Iron Bands of Bilarro/g, 'Iron Bands'], [/Orb of Dragonkind/g, 'Dragon Orb'],
  [/สำรับไพ่สารพัดสิ่ง/g, 'สำรับไพ่ลึกลับ'],
]
const OWNER_EN = new RegExp(`\\b(?:${OWNERS_EN.join('|')})['’]s\\s+`, 'g')
const OWNER_TH = new RegExp(`\\s?(?:ของ)?(?:${OWNERS_TH.join('|')})`, 'g')

/** Take the non-SRD people's names out of a name or text ("เป้สารพัดนึกของฮิวเวิร์ด (Heward's Handy Haversack)" → "เป้สารพัดนึก (Handy Haversack)"). */
export function stripNonSrdNames(text: string): string {
  let out = text.replace(OWNER_EN, '').replace(OWNER_TH, '')
  for (const [from, to] of RENAMED) out = out.replace(from, to)
  return out
}

/** Worlds and people that never appear in the SRD. Text that still names one after stripNonSrdNames isn't used. */
const NON_SRD = /Dragonlance|Krynn|Faerûn|Forgotten Realms|Greyhawk|Eberron|Ravenloft|Strahd|Waterdeep|Baldur's Gate|Vecna|Tiamat|Bahamut|ดราก้อนแลนซ์|ไครนน์|ฟาเอรูน|เกรย์ฮอว์ก|เอเบอร์รอน|วอเตอร์ดีพ|เวคนา|เทียแมท|บาฮามุท/
export function nonSrdName(text: string): string | null {
  return text.match(NON_SRD)?.[0] ?? null
}
