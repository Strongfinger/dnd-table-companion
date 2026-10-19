// A very small markdown reader for translated rules text (DND-TH's Thai spells): paragraphs, line breaks,
// #-headings, "- " / "* " lists, | tables |, **bold**, _italic_ and *italic*. Everything else stays plain text.
// It returns plain data; src/ui/MiniMarkdown.tsx turns it into React elements (never raw HTML).
// With `story` (the journey chronicle) it also reads pictures "![caption](img:<id>)", "> quotes" and "---" breaks.

export interface Span {
  text: string
  bold?: true
  italic?: true
}
export type Line = Span[]

export type Block =
  | { kind: 'p'; lines: Line[] }
  | { kind: 'h'; line: Line }
  | { kind: 'ul'; items: Line[] }
  | { kind: 'table'; head: Line[]; rows: Line[][] }
  /** story only: a chapter picture by id, with its caption. */
  | { kind: 'img'; id: string; caption: string }
  | { kind: 'quote'; lines: Line[] }
  | { kind: 'hr' }

/**
 * "**bold**, _italic_, *italic*, \*" → spans. Unclosed marks just end with the line. A single "*" starts italic
 * only when a word follows and another "*" comes later ("***Name.***" = bold italic); a lone "* " is just text.
 */
export function parseInline(text: string): Line {
  const spans: Span[] = []
  let bold = false
  let italic = false
  let star = false // italic was started by "*" (so the next "*" ends it)
  let buf = ''
  const flush = () => {
    if (buf) spans.push({ text: buf, ...(bold ? { bold: true as const } : {}), ...(italic ? { italic: true as const } : {}) })
    buf = ''
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length && '*_\\|#-'.includes(text[i + 1])) { buf += text[++i]; continue }
    if (text.startsWith('**', i)) { flush(); bold = !bold; i++; continue }
    if (text[i] === '_') { flush(); italic = !italic; continue }
    if (text[i] === '*' && (star || (/\S/.test(text[i + 1] ?? ' ') && text.indexOf('*', i + 2) > 0))) { flush(); italic = !italic; star = !star; continue }
    buf += text[i]
  }
  flush()
  return spans
}

const tableCells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => parseInline(c.trim()))
const isTableRule = (line: string) => /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*\|?$/.test(line.trim())

export function parseMarkdown(md: string, opts: { story?: boolean } = {}): Block[] {
  const blocks: Block[] = []
  const last = () => blocks[blocks.length - 1]
  let open = false // is the last block still taking lines?
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) { open = false; continue }
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    const item = line.match(/^[-*+]\s+(.*)$/)
    if (opts.story) {
      const img = line.match(/^!\[([^\]\n]*)\]\(img:([\w-]{1,64})\)$/)
      const quote = line.match(/^>\s?(.*)$/)
      if (img) { blocks.push({ kind: 'img', id: img[2], caption: img[1].trim() }); open = false; continue }
      if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { blocks.push({ kind: 'hr' }); open = false; continue }
      if (quote) {
        const b = last()
        if (open && b?.kind === 'quote') b.lines.push(parseInline(quote[1]))
        else { blocks.push({ kind: 'quote', lines: [parseInline(quote[1])] }); open = true }
        continue
      }
    }
    if (heading) { blocks.push({ kind: 'h', line: parseInline(heading[1]) }); open = false }
    else if (line.startsWith('|')) {
      const b = last()
      if (open && b?.kind === 'table') { if (!isTableRule(line)) b.rows.push(tableCells(line)) }
      else { blocks.push({ kind: 'table', head: tableCells(line), rows: [] }); open = true }
    } else if (item) {
      const b = last()
      if (open && b?.kind === 'ul') b.items.push(parseInline(item[1]))
      else { blocks.push({ kind: 'ul', items: [parseInline(item[1])] }); open = true }
    } else {
      const b = last()
      if (open && b?.kind === 'p') b.lines.push(parseInline(line))
      else { blocks.push({ kind: 'p', lines: [parseInline(line)] }); open = true }
    }
  }
  return blocks
}
