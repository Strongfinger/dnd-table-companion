// Builds src/data/srd-equipment-th.json (Thai equipment names and text, weapon properties and masteries) from
// DND-TH's published equipments.json (used with DND-TH's permission, 2026-10-13). Only SRD 5.2.1 items are kept.
// The source is read as plain data and checked; nothing in it is run.
//
//   curl -L -o /tmp/dndth/equipments.json https://dnd-th.com/data/equipments.json
//   node scripts/srd/equipment-th.ts /tmp/dndth/equipments.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import { buildEquipmentTh, type EquipmentThFile } from '../../src/model/equipmentTh.ts'
import { DND_TH_CREDIT as CREDIT } from '../../src/model/dndTh.ts'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/equipment-th.ts <dnd-th equipments.json>')
const raw = fs.readFileSync(source)
if (raw.length > 10_000_000) throw new Error('equipments.json is over 10 MB: is it the right file?')

const srd = JSON.parse(fs.readFileSync('src/data/srd-equipment.json', 'utf8'))
const result = buildEquipmentTh(JSON.parse(raw.toString('utf8')), srd)
if ('error' in result) throw new Error(result.error)
const { file: built, report } = result

const file: EquipmentThFile = {
  source: `Thai translation by ${CREDIT.name} (${CREDIT.url}data/equipments.json), SRD 5.2.1 equipment only; used with permission`,
  license: `${CREDIT.license} (${CREDIT.licenseUrl})`,
  builtAt: new Date().toISOString(),
  ...built,
}
const out = JSON.stringify(file) + '\n'
fs.writeFileSync('src/data/srd-equipment-th.json', out)

const list = (title: string, names: string[]) => names.length && console.log(`\n${title} (${names.length}):\n  ${names.join('\n  ')}`)
console.log(`Source: ${raw.length} bytes, SHA-256 ${crypto.createHash('sha256').update(raw).digest('hex')}`)
console.log(`SRD items with Thai: ${report.matched} / ${srd.items.length} · properties ${Object.keys(built.properties).length} / ${srd.properties.length} · masteries ${Object.keys(built.masteries).length} / ${srd.masteries.length}`)
list('No Thai (they stay English)', report.missing)
list('Left English: the Thai names a non-SRD world or person', report.nonSrd)
list('Possible typos to tell DND-TH about', [...new Set(report.typos)])
console.log(`\nWrote src/data/srd-equipment-th.json (${out.length} characters)`)
