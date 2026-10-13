// Builds src/data/srd-features-th.json (Thai feature text) from DND-TH's data (used with DND-TH's permission,
// 2026-10-13): feats from their published feats.json, class/subclass features and species traits from their
// 2024 class and species markdown pages (2024-classes.zip, 2024-races.zip, unzipped). Only SRD 5.2.1 features
// are kept. The sources are read as plain text/data and checked; nothing in them is run.
//
//   curl -L -o /tmp/dndth/feats.json https://dnd-th.com/data/feats.json
//   unzip 2024-classes.zip -d /tmp/dndth/classes && unzip 2024-races.zip -d /tmp/dndth/races
//   node scripts/srd/features-th.ts /tmp/dndth/feats.json /tmp/dndth/classes /tmp/dndth/races
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { buildClassFeaturesTh, buildFeatsTh, buildTraitsTh, type FeaturesThFile } from '../../src/model/featuresTh.ts'
import { DND_TH_CREDIT as CREDIT } from '../../src/model/dndTh.ts'

const [featsFile, classDir, raceDir] = process.argv.slice(2)
if (!featsFile || !classDir || !raceDir) throw new Error('usage: node scripts/srd/features-th.ts <feats.json> <classes dir> <races dir>')

const sha = (b: Buffer) => crypto.createHash('sha256').update(b).digest('hex')
/** Every .md page in a folder with its frontmatter `name:` (the English class/species name). */
function pages(dir: string) {
  return fs.readdirSync(dir).filter((f) => f.endsWith('.md')).sort().map((f) => {
    const raw = fs.readFileSync(path.join(dir, f))
    if (raw.length > 2_000_000) throw new Error(`${f} is over 2 MB: is it the right file?`)
    const md = raw.toString('utf8')
    const name = md.match(/^name:\s*(.+)$/m)?.[1].trim()
    if (!name) throw new Error(`${f} has no "name:" line`)
    return { file: f, name, md, sha: sha(raw) }
  })
}

const srd = JSON.parse(fs.readFileSync('src/data/srd-features.json', 'utf8'))
const featsRaw = fs.readFileSync(featsFile)
if (featsRaw.length > 5_000_000) throw new Error('feats.json is over 5 MB: is it the right file?')
const feats = buildFeatsTh(JSON.parse(featsRaw.toString('utf8')), srd.feats)
if ('error' in feats) throw new Error(feats.error)
const classPages = pages(classDir)
const racePages = pages(raceDir)
const classes = buildClassFeaturesTh(classPages.map((p) => ({ className: p.name, md: p.md })), srd.classFeatures)
const traits = buildTraitsTh(racePages.map((p) => ({ species: p.name, md: p.md })), srd.traits)

const file: FeaturesThFile = {
  source: `Thai translation by ${CREDIT.name} (${CREDIT.url}): data/feats.json and their 2024 class and species pages; SRD 5.2.1 content only; used with permission`,
  license: `${CREDIT.license} (${CREDIT.licenseUrl})`,
  builtAt: new Date().toISOString(),
  features: { ...feats.features, ...classes.features, ...traits.features },
}
const out = JSON.stringify(file) + '\n'
fs.writeFileSync('src/data/srd-features-th.json', out)

const list = (title: string, names: string[]) => names.length && console.log(`\n${title} (${names.length}):\n  ${names.join('\n  ')}`)
console.log(`feats.json: ${featsRaw.length} bytes, SHA-256 ${sha(featsRaw)}`)
for (const p of [...classPages, ...racePages]) console.log(`${p.file}: SHA-256 ${p.sha}`)
console.log(`\nFeats: ${feats.report.matched} / ${srd.feats.length} · class features: ${classes.report.matched} / ${srd.classFeatures.length} · species traits: ${traits.report.matched} / ${srd.traits.length}`)
list('Feats with no Thai', feats.report.missing)
list('Class features with no Thai', classes.report.missing)
list('Species traits with no Thai', traits.report.missing)
list('Left English: the Thai names a non-SRD world or person', [...classes.report.nonSrd, ...traits.report.nonSrd])
list('Possible typos to tell DND-TH about', [...feats.report.typos, ...classes.report.typos, ...traits.report.typos])
console.log(`\nWrote src/data/srd-features-th.json (${out.length} characters)`)
