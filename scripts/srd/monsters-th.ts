// Builds src/data/srd-monsters-th.json (Thai monster names and stat block text) from DND-TH's published
// monsters.json (used with DND-TH's permission, 2026-10-13). Only 2024 monsters that are SRD 5.2.1 monsters are kept.
// The source is read as plain data and checked; nothing in it is run.
//
//   curl -L -o /tmp/dndth/monsters.json https://dnd-th.com/data/monsters.json
//   node scripts/srd/monsters-th.ts /tmp/dndth/monsters.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import { buildMonstersTh, type MonstersThFile } from '../../src/model/monstersTh.ts'
import { DND_TH_CREDIT as CREDIT } from '../../src/model/dndTh.ts'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/monsters-th.ts <dnd-th monsters.json>')
const raw = fs.readFileSync(source)
if (raw.length > 20_000_000) throw new Error('monsters.json is over 20 MB: is it the right file?')

const names = new Map<string, string>(JSON.parse(fs.readFileSync('src/data/srd-monsters.json', 'utf8')).map((m: { id: string; name: string }) => [m.id, m.name]))
const details = JSON.parse(fs.readFileSync('src/data/srd-monster-details.json', 'utf8'))
const srd = details.map((d: { id: string }) => ({ ...d, name: names.get(d.id) ?? d.id }))
const result = buildMonstersTh(JSON.parse(raw.toString('utf8')), srd)
if ('error' in result) throw new Error(result.error)
const { monsters, report } = result

const file: MonstersThFile = {
  source: `Thai translation by ${CREDIT.name} (${CREDIT.url}data/monsters.json), SRD 5.2.1 monsters only; used with permission`,
  license: `${CREDIT.license} (${CREDIT.licenseUrl})`,
  builtAt: new Date().toISOString(),
  monsters,
}
const out = JSON.stringify(file) + '\n'
fs.writeFileSync('src/data/srd-monsters-th.json', out)

const list = (title: string, items: string[]) => items.length && console.log(`\n${title} (${items.length}):\n  ${items.join('\n  ')}`)
console.log(`Source: ${raw.length} bytes, SHA-256 ${crypto.createHash('sha256').update(raw).digest('hex')}`)
console.log(`SRD monsters with Thai: ${report.matched} / ${srd.length} · entries ${report.entries.translated} / ${report.entries.total}`)
list('SRD monsters with no Thai (they stay English)', report.missing)
list('Entries with no Thai (they stay English)', report.missingEntries)
list('Left English: the Thai names a non-SRD world or person', report.nonSrd)
list('Left English: the Thai numbers differ from the English (tell DND-TH)', report.numbersDiffer)
list('Possible typos to tell DND-TH about', report.typos)
console.log(`\nWrote src/data/srd-monsters-th.json (${out.length} characters)`)
