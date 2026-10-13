# Thai spell text from DND-TH

The app can show Thai spell descriptions (with a **ไทย / EN** switch on every spell card) from a CSV
that you collect yourself from https://dnd-th.com/spells/. Only the **339 SRD 5.2.1 spells** are kept;
everything else in the CSV is skipped.

**Before anything is published:** DND-TH's content is CC BY-NC-SA 4.0. `src/data/srd-spells-th.json` is
git-ignored, so it only works in your local dev app (`npm run dev`) until DND-TH says yes. Then remove its
line from `.gitignore`, commit the file and push. The About page and every Thai spell card credit DND-TH.

Claude does not read the site or the Thai text (the site's robots.txt asks for no AI input). You do the
collecting; the build script prints only counts and English names.

## 1. Collect the CSV with the "Web Scraper" Chrome extension

1. Install **Web Scraper** (webscraper.io) from the Chrome Web Store. Open https://dnd-th.com/spells/ and
   press F12 → the **Web Scraper** tab → *Create new sitemap*. Start URL: `https://dnd-th.com/spells/`.
2. Add a **Link** selector, id `spell`, *Multiple* ticked. Click *Select* and click 2–3 spell names
   **in the 2024 list only** until all 2024 spells highlight (not the 2014 list: it repeats names).
3. Open the `spell` selector and add three child selectors (on any spell page, use *Select* to click):
   | id | type | what to click |
   |---|---|---|
   | `title` | Text | the page title, e.g. "ลูกไฟโลกันต์ (Fireball)" |
   | `thai_text` | **HTML** | the box holding the description paragraphs (HTML keeps the paragraph breaks) |
   | `thai_higher_levels` | Text | the "higher-level slot" paragraph, if it is separate (optional) |
4. *Scrape* with **Request interval 3000 ms** or more (be gentle with their server), then
   *Export data* → **CSV**. Extra columns (order, url…) are ignored.

The script also accepts columns `english_name` + `thai_name` instead of `title`.

## 2. Build the data file

```bash
node scripts/srd/spells-th.ts ~/Downloads/dnd-th-spells.csv
```

It writes `src/data/srd-spells-th.json` and prints:
- **matched SRD spells:** aim for close to 339;
- **Not in SRD 5.2.1:** spells only in the Player's Handbook: skipped, as they must be;
- **Repeated names:** the 2014 list got in; redo step 2 with only the 2024 list;
- **no Thai row:** those spells stay English.

## 3. Check it

`npm run dev` → *ค้นหา → คาถา SRD* → open a few spells (Fireball, Cure Wounds, Shield). Read the Thai,
switch to EN and back, search by a Thai name. If a description has stray menu text, fix the `thai_text`
selector in step 3 and run again.
