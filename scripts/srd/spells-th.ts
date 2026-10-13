// Builds src/data/srd-spells-th.json (Thai spell text) from DND-TH's published spells.json
// (used with DND-TH's permission, 2026-10-13). Only 2024 spells that are SRD 5.2.1 spells are kept.
// The source is read as plain data and checked; nothing in it is run.
//
//   curl -L -o /tmp/dndth/spells.json https://dnd-th.com/data/spells.json
//   node scripts/srd/spells-th.ts /tmp/dndth/spells.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import { buildSpellsTh, type SpellsThFile } from '../../src/model/spellsTh.ts'
import { DND_TH_CREDIT as SPELLS_TH_CREDIT } from '../../src/model/dndTh.ts'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/spells-th.ts <dnd-th spells.json>')
const raw = fs.readFileSync(source)
if (raw.length > 20_000_000) throw new Error('spells.json is over 20 MB: is it the right file?')

const srd = JSON.parse(fs.readFileSync('src/data/srd-spells.json', 'utf8'))
const result = buildSpellsTh(JSON.parse(raw.toString('utf8')), srd)
if ('error' in result) throw new Error(result.error)
const { spells, report } = result

const file: SpellsThFile = {
  source: `Thai translation by ${SPELLS_TH_CREDIT.name} (${SPELLS_TH_CREDIT.url}data/spells.json), SRD 5.2.1 spells only; used with permission`,
  license: `${SPELLS_TH_CREDIT.license} (${SPELLS_TH_CREDIT.licenseUrl})`,
  builtAt: new Date().toISOString(),
  spells,
}
const out = JSON.stringify(file) + '\n'
fs.writeFileSync('src/data/srd-spells-th.json', out)

const list = (title: string, names: string[]) => names.length && console.log(`\n${title} (${names.length}):\n  ${names.join('\n  ')}`)
console.log(`Source: ${raw.length} bytes, SHA-256 ${crypto.createHash('sha256').update(raw).digest('hex')}`)
console.log(`DND-TH 2024 spells: ${report.translated2024} · SRD spells with Thai: ${report.matched} / ${srd.length}`)
list('Matched without the wizard\'s name', report.matchedWithoutOwner)
list('SRD spells with no Thai (they stay English)', report.missing)
list('Possible typos to tell DND-TH about', report.typos)
list('Left English: the Thai names a non-SRD world or person', report.nonSrd)
console.log(`\nWrote src/data/srd-spells-th.json (${out.length} characters)`)
