// Builds src/data/srd-glossary-th.json (Thai Rules Glossary) from DND-TH's Thai rules-glossary page (markdown;
// used with DND-TH's permission, confirmed by the owner 2026-10-13). All its entries are SRD 5.2.1 glossary
// entries. The source is read as plain text; nothing in it is run.
//
//   node scripts/srd/glossary-th.ts docs/DND-TH/free-rules/rules-glossary.md
import crypto from 'node:crypto'
import fs from 'node:fs'
import { buildGlossaryTh, type GlossaryThFile } from '../../src/model/glossaryTh.ts'
import { DND_TH_CREDIT as CREDIT } from '../../src/model/dndTh.ts'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/glossary-th.ts <rules-glossary.md>')
const raw = fs.readFileSync(source)
if (raw.length > 5_000_000) throw new Error('rules-glossary.md is over 5 MB: is it the right file?')

const { entries, report } = buildGlossaryTh(raw.toString('utf8'))
const file: GlossaryThFile = {
  source: `Thai translation by ${CREDIT.name} (${CREDIT.url}) of the SRD 5.2.1 Rules Glossary; used with permission`,
  license: `${CREDIT.license} (${CREDIT.licenseUrl})`,
  builtAt: new Date().toISOString(),
  entries,
}
const out = JSON.stringify(file) + '\n'
fs.writeFileSync('src/data/srd-glossary-th.json', out)

const list = (title: string, names: string[]) => names.length && console.log(`\n${title} (${names.length}):\n  ${names.join('\n  ')}`)
console.log(`Source: ${raw.length} bytes, SHA-256 ${crypto.createHash('sha256').update(raw).digest('hex')}`)
console.log(`Entries: ${report.entries}`)
list('Left out: the Thai names a non-SRD world or person', report.nonSrd)
list('Possible typos to tell DND-TH about', report.typos)
console.log(`\nWrote src/data/srd-glossary-th.json (${out.length} characters)`)
