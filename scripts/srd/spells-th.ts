// Builds src/data/srd-spells-th.json (Thai spell text) from a CSV of Thai translations.
// Only SRD 5.2.1 spells are kept (matched by English name); everything else is skipped.
// It prints counts and English names only, never the Thai text. How to make the CSV: docs/THAI-SPELLS.md
//
//   node scripts/srd/spells-th.ts <thai-spells.csv>
import fs from 'node:fs'
import { buildSpellsTh, SPELLS_TH_CREDIT, type SpellsThFile } from '../../src/model/spellsTh.ts'

const source = process.argv[2]
if (!source) throw new Error('usage: node scripts/srd/spells-th.ts <thai-spells.csv>')
if (fs.statSync(source).size > 10_000_000) throw new Error('CSV is over 10 MB: is it the right file?')

const srd = JSON.parse(fs.readFileSync('src/data/srd-spells.json', 'utf8'))
const result = buildSpellsTh(fs.readFileSync(source, 'utf8'), srd)
if ('error' in result) throw new Error(result.error)
const { spells, report } = result

const file: SpellsThFile = {
  source: `Thai translation by ${SPELLS_TH_CREDIT.name} (${SPELLS_TH_CREDIT.url}), of SRD 5.2.1 spells`,
  license: `${SPELLS_TH_CREDIT.license} (${SPELLS_TH_CREDIT.licenseUrl})`,
  builtAt: new Date().toISOString(),
  spells,
}
fs.writeFileSync('src/data/srd-spells-th.json', JSON.stringify(file) + '\n')

const list = (title: string, names: string[]) => names.length && console.log(`\n${title} (${names.length}):\n  ${names.join(', ')}`)
console.log(`CSV rows: ${report.rows} · matched SRD spells: ${report.matched} / ${srd.length} · incomplete rows: ${report.incomplete}`)
list('Not in SRD 5.2.1, skipped', report.notInSrd)
list('Repeated names, first kept (did the CSV include the 2014 list too?)', report.duplicates)
list('SRD spells with no Thai row (they stay English)', report.missing)
console.log('\nWrote src/data/srd-spells-th.json')
