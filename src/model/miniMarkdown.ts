// A very small markdown reader for translated rules text (DND-TH's Thai spells): paragraphs, line breaks,
// #-headings, "- " / "* " lists, | tables |, **bold** and _italic_. Everything else stays plain text.
// It returns plain data; src/ui/MiniMarkdown.tsx turns it into React elements (never raw HTML).

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

/** "**bold** and _italic_, \*" → spans. Unclosed marks just end with the line. */
export function parseInline(text: string): Line {
  const spans: Span[] = []
  let bold = false
  let italic = false
  let buf = ''
  const flush = () => {
    if (buf) spans.push({ text: buf, ...(bold ? { bold: true as const } : {}), ...(italic ? { italic: true as const } : {}) })
    buf = ''
  }
  for (let i = 0; i < text.length; i++) {
    if (text[i] === '\\' && i + 1 < text.length && '*_\\|#-'.includes(text[i + 1])) { buf += text[++i]; continue }
    if (text.startsWith('**', i)) { flush(); bold = !bold; i++; continue }
    if (text[i] === '_') { flush(); italic = !italic; continue }
    buf += text[i]
  }
  flush()
  return spans
}

const tableCells = (line: string) => line.trim().replace(/^\||\|$/g, '').split('|').map((c) => parseInline(c.trim()))
const isTableRule = (line: string) => /^\|?(\s*:?-{2,}:?\s*\|)+\s*:?-*:?\s*\|?$/.test(line.trim())

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = []
  const last = () => blocks[blocks.length - 1]
  let open = false // is the last block still taking lines?
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trim()
    if (!line) { open = false; continue }
    const heading = line.match(/^#{1,6}\s+(.*)$/)
    const item = line.match(/^[-*+]\s+(.*)$/)
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
