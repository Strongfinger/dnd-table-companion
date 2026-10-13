// Builds src/data/srd-features-th.json (Thai feature text) from DND-TH's published feats.json
// (used with DND-TH's permission, 2026-10-13). Only 2024 feats that are SRD 5.2.1 feats are kept.
// The source is read as plain data and checked; nothing in it is run.
//
//   curl -L -o /tmp/dndth/feats.json https://dnd-th.com/data/feats.json
//   node scripts/srd/features-th.ts /tmp/dndth/feats.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import { buildFeatsTh, type FeaturesThFile } from '../../src/model/featuresTh.ts'
import { SPELLS_TH_CREDIT as CREDIT } from '../../src/model/spellsTh.ts'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/features-th.ts <dnd-th feats.json>')
const raw = fs.readFileSync(source)
if (raw.length > 5_000_000) throw new Error('feats.json is over 5 MB: is it the right file?')

const srd = JSON.parse(fs.readFileSync('src/data/srd-features.json', 'utf8')).feats
const result = buildFeatsTh(JSON.parse(raw.toString('utf8')), srd)
if ('error' in result) throw new Error(result.error)
const { features, report } = result

const file: FeaturesThFile = {
  source: `Thai translation by ${CREDIT.name} (${CREDIT.url}data/feats.json), SRD 5.2.1 feats only; used with permission`,
  license: `${CREDIT.license} (${CREDIT.licenseUrl})`,
  builtAt: new Date().toISOString(),
  features,
}
const out = JSON.stringify(file) + '\n'
fs.writeFileSync('src/data/srd-features-th.json', out)

const list = (title: string, names: string[]) => names.length && console.log(`\n${title} (${names.length}):\n  ${names.join('\n  ')}`)
console.log(`Source: ${raw.length} bytes, SHA-256 ${crypto.createHash('sha256').update(raw).digest('hex')}`)
console.log(`DND-TH 2024 feats: ${report.translated2024} · SRD feats with Thai: ${report.matched} / ${srd.length}`)
list('SRD feats with no Thai (they stay English)', report.missing)
list('Possible typos to tell DND-TH about', report.typos)
console.log(`\nWrote src/data/srd-features-th.json (${out.length} characters)`)
