// Turns game-icons.net silhouettes into 256px item pictures that sit next to the painted Gemini art:
// a tinted, softly lit icon on the same dark vignette background. No AI and no credits needed.
//
//   git clone --depth 1 https://github.com/game-icons/icons.git <icons>
//   node scripts/item-icons/render.mjs <icons> [ids...]      (needs playwright-core + Chromium)
//
// icons.json maps an SRD item id to an icon name ("name" or "author/name"); the kind of the item picks the tint.
// The pictures go to public/items/<id>.webp and the icon and author of each to src/data/item-icon-credits.json (CC BY 3.0, listed on the About page).
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from 'playwright-core'

const here = dirname(fileURLToPath(import.meta.url))
const root = join(here, '..', '..')
const [iconsDir, ...only] = process.argv.slice(2)
if (!iconsDir) { console.error('usage: node render.mjs <game-icons repo> [ids...]'); process.exit(1) }

const map = JSON.parse(readFileSync(join(here, 'icons.json'), 'utf8'))
const kinds = Object.fromEntries(JSON.parse(readFileSync(join(root, 'src/data/srd-equipment.json'), 'utf8')).items
  .map((i) => [i.id, i.kind]))

// Light top colour, dark bottom colour, glow: warm metal and leather like the painted art, green poison, violet magic.
const TINT = {
  gear: ['#f6dfae', '#a8743a', '#e0a24a'],
  tool: ['#efcf98', '#8a5a2b', '#d99a48'],
  pack: ['#ecc794', '#86542c', '#c98a4a'],
  ammunition: ['#eef1f5', '#7d8794', '#9fb3c8'],
  focus: ['#eedcff', '#7b4bc4', '#a77bff'],
  poison: ['#d4f7a8', '#3f8a2e', '#7bd44a'],
}

// Every icon file once, by "author/name" and by bare name (the "badges" folder holds frames, not objects).
const byName = new Map()
for (const author of readdirSync(iconsDir)) {
  const dir = join(iconsDir, author)
  if (author === 'badges' || author.startsWith('.') || !statSync(dir).isDirectory()) continue
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.svg')) continue
    const name = f.slice(0, -4)
    byName.set(`${author}/${name}`, { author, file: join(dir, f) })
    if (!byName.has(name)) byName.set(name, { author, file: join(dir, f) })
  }
}

/** The white shapes of a game-icons SVG (its first path is the black square background). */
function shapes(file) {
  const paths = [...readFileSync(file, 'utf8').matchAll(/<path[^>]*\sd="([^"]+)"/g)].map((m) => m[1])
  return paths.filter((d) => !/^M0 0h512v512H0z$/.test(d))
}

function page(d, [light, dark, glow]) {
  return `<!doctype html><html><body style="margin:0;background:#000">
<svg id="art" xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">
  <defs>
    <radialGradient id="bg" cx="50%" cy="45%" r="75%">
      <stop offset="0" stop-color="#2b2e33"/><stop offset="0.6" stop-color="#1a1c1f"/><stop offset="1" stop-color="#0f1012"/>
    </radialGradient>
    <linearGradient id="fill" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${light}"/><stop offset="1" stop-color="${dark}"/>
    </linearGradient>
    <filter id="lit" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
      <feSpecularLighting in="blur" surfaceScale="4" specularConstant="0.6" specularExponent="18" lighting-color="#fff6e0" result="spec">
        <feDistantLight azimuth="235" elevation="45"/>
      </feSpecularLighting>
      <feComposite in="spec" in2="SourceAlpha" operator="in" result="shine"/>
      <feComposite in="SourceGraphic" in2="shine" operator="arithmetic" k2="1" k3="0.55"/>
    </filter>
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="9"/></filter>
    <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <rect width="256" height="256" fill="url(#bg)"/>
  <ellipse cx="128" cy="214" rx="70" ry="10" fill="#000" opacity="0.55" filter="url(#shadow)"/>
  <g transform="translate(40 36) scale(0.34375)">
    <path d="${d}" fill="${glow}" opacity="0.28" filter="url(#glow)"/>
    <path d="${d}" fill="url(#fill)" stroke="#1a120a" stroke-opacity="0.5" stroke-width="6" paint-order="stroke" filter="url(#lit)"/>
  </g>
</svg></body></html>`
}

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' })
const tab = await browser.newPage({ viewport: { width: 256, height: 256 } })
const creditsFile = join(root, 'src/data/item-icon-credits.json')
const credits = (() => { try { return JSON.parse(readFileSync(creditsFile, 'utf8')) } catch { return {} } })()
let done = 0
for (const [id, icon] of Object.entries(map)) {
  if (only.length && !only.includes(id)) continue
  const hit = byName.get(icon)
  const tint = TINT[kinds[id]]
  if (!hit || !tint) { console.error(`skip ${id}: ${!hit ? `no icon "${icon}"` : `no tint for kind ${kinds[id]}`}`); continue }
  await tab.setContent(page(shapes(hit.file).join(' '), tint))
  const png = await tab.locator('#art').screenshot({ type: 'png' })
  // Chromium can't write WebP screenshots, so re-encode through a canvas in the page.
  const webp = await tab.evaluate(async (b64) => {
    const img = new Image(); img.src = `data:image/png;base64,${b64}`; await img.decode()
    const c = document.createElement('canvas'); c.width = c.height = 256
    c.getContext('2d').drawImage(img, 0, 0)
    return c.toDataURL('image/webp', 0.82).split(',')[1]
  }, png.toString('base64'))
  writeFileSync(join(root, 'public/items', `${id}.webp`), Buffer.from(webp, 'base64'))
  credits[id] = { icon: icon.split('/').pop(), author: hit.author }
  done++
}
writeFileSync(creditsFile, JSON.stringify(Object.fromEntries(Object.entries(credits).sort()), null, 2) + '\n')
await browser.close()
console.log(`${done} pictures written`)
