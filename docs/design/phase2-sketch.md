# Phase 2 UX sketch: DM tracker speed-ups and player "ใช้ได้เลย"

Status: **design only, nothing built.** Author: ux-ui-designer, 2026-10-22. For Tan to approve, then the developer scopes PRs.
Scope approved by Tan: 2a Next Turn key + Turn Card, 2b multi-select batch, 2c pinned notes + quick search, 2d (optional) condition chips,
and the Phase 4 view "ใช้ได้เลย" at the top of the player sheet's combat tab.
UI text is Thai, D&D terms English. Wireframes are ASCII; widths are in CSS px. Tailwind classes named are the ones already used in the repo.

---------------------------------------------------------------------

## 0. What the current UI already has (checked in code, 2026-10-22, branch `fix/phase1-mule-houserules-phone`)

| Need | Already there | Where | Gap |
|---|---|---|---|
| Next turn | Big bottom bar `ถัดไป ▶ {next name}`, `◀` previous, `🏁 จบ`. `advanceTurn(id, expect?)` is shared with players' end-turn and already takes an `expect {activeId, round}` guard | `Tracker.tsx` (fixed bottom bar), `db/turns.ts` | **No keyboard shortcut at all.** The only `keydown` handlers in the app are Enter in some inputs and one in `GiveForm`. No cheat sheet. |
| Stat block that follows the turn | Side panel tab `👹 Stat block` follows the active monster; "ตามเทิร์น" select | `DmPanel.tsx` `StatsTab`, `MonsterStatBlock.tsx` | It is the **full** stat block (about 1.5 screens tall); the DM must scroll it to find Multiattack. Nothing for a PC. Not in the middle column. |
| Parsed attacks / Multiattack / Legendary | Data has `actions[]`, `bonusActions[]`, `legendaryActions[]`, `legendaryUses` as **free text** ("Melee Attack Roll: +4, reach 5 ft. Hit: 5 (1d6 + 2) Slashing damage ..."). Pure text, no parsed numbers | `model/monsterDetails.ts`, `src/data/srd-monster-details.json` | Needs a small pure parser (to-hit, damage dice, DC). Legendary uses left and Recharge state are **not stored** on the combatant. |
| Roll from a number | `openRoller({expression,label})` opens the dice roller pre-filled; the sheet's Attacks use it | `ui/rollerBus.ts`, `Attacks.tsx` | Reusable for monster attacks as is. On laptop the roller is docked to the `🎲` in the panel header. |
| Damage / heal on a row | Laptop: amount box + `−` / `+` on each collapsed row (Enter = damage). Open row: `− ดาเมจ`, `+ ฮีล`, `Temp`. `damageMonster` (temp HP first, concentration reminder, defeated at 0). PCs go through `playAction(...,'dm')` | `CombatantRow.tsx`, `model/encounter.ts` | **One creature at a time. No selection state. No undo anywhere** (`grep undo` finds nothing). |
| Conditions | Open row only: a `<select>` of the 14 conditions (Exhaustion is separate) + rounds box + `นับต้น/ท้ายเทิร์น` select + `+ เพิ่ม` = about 4 taps. Applied conditions show as red chips on the row; tap a chip in the open row to remove. PCs also get the condition on their sheet. | `CombatantRow.tsx` `addTimedEffect` | The "⋯ menu" in HANDOFF is not a condition menu: `⋯` on the tracker header only holds "delete fight". There are no one-tap chips. |
| Notes beside the tracker | Panel tab `📒 สมุด` shows `NotebookList` (kind filter, search box **only when the campaign has more than 3 pages**) and opens a page in place (`NotebookPage`). Scenes live inside session pages (`note.scenes`). `searchNotes` already indexes title, fields, body **and scene text**. | `DmPanel.tsx` `NotesTab`, `Notebook.tsx`, `model/note.ts` | No pinning. The panel's tab is remembered (`dm-panel-tab`) but not the open page. Opening a page = tab tap + find in list (more than 5 s on a long list). Search box hidden on small campaigns, no keyboard focus key. |
| Player view never shows monster HP | `playerView.ts` sends only `healthStatus` (healthy/hurt/Bloodied/down); hidden creatures dropped; combat log lines for monsters are DM-only by default (`log(text)` has `forPlayers=false`) | `model/playerView.ts`, `Tracker.tsx` `log` | Must stay true for batch lines. |
| Player sheet, "Combat tab" | It is the first tab, id `play`, label **ต่อสู้**: `ExhaustionNote`, `PlayPanel` (section "ระหว่างเล่น": Action/Bonus/Reaction bar, death saves, Concentration, spell-slot pips, limited-use feature pips (name, pips, recharge label), rests, Exhaustion, Conditions, Buffs) then `Attacks` (🎯 / 💥). HP is above the tabs (`HpCard`), AC/Init/Speed/PB tiles above that. | `CharacterSheet.tsx`, `PlayPanel.tsx`, `Attacks.tsx`, `HpCard.tsx` | **So slots and features are already on the tab, but** buried under economy, death saves and concentration, with no per-level "left" summary, no dimming/return time, **no spells at all** (they are on the คาถา tab, with cast panel), **no skills** (they are on the ความสามารถ tab, **not tappable**; `SkillsSection` is a plain list with the modifier, expertise ★ and a "แตะ" that only opens help). |
| Spell action type | `actionKindFor(castingTime)` and `actionSuggestions` already sort spells/features into action / bonusAction / reaction | `model/castSpell.ts`, `model/actionSuggestions.ts` | Reusable for the grouping. |
| 🎲 button | Fixed `right-4 bottom-20`, 56 px round, `z-30`; hides (`tucked`) at some moments; `main` has `pb-36` (144 px) so the last item can scroll clear of it | `DiceRoller.tsx`, `App.tsx` | Anything on the right edge passes under it while scrolling. |

Conclusion: 2a needs a new card + a key handler + a small parser; 2b needs selection state, a batch bar and an undo snapshot (all new); 2c needs pin storage and a pinned strip (search and the notes list already exist); 2d is a chip row reusing `addEffect` (new UI only); Phase 4 is mostly **re-arranging existing blocks plus two new ones (spells by action type, tap-to-roll skills)**.

---------------------------------------------------------------------

## 1. Layout budget at 1366x768 (laptop)

Real inner height on a 768-tall laptop with browser chrome is about **650 px** (worst case). Today: top nav 56 + page header (back link, title, round pill, buttons) about 96 + bottom Next bar 64 = 216 px of chrome, which leaves about 434 px. The turn card must live in that.

Decisions:
- **Turn Card sits at the top of the middle column**, directly above the initiative rows, `sticky` under the nav (`top: var(--nav-h)`) so it is visible while the order scrolls. Max height **168 px**, collapsible to a 44 px one-line strip ("ย่อ"), state remembered like the panel tab (`localStorage`, guarded in try/catch).
- The page header shrinks to **one line** while a fight is active (title + round pill + buttons; back link moves into the same line): saves about 40 px. Setup state keeps today's two-line header.
- Budget: nav 56 + header 56 + card 168 + 3 rows x 84 = 532, plus bottom bar 64 = 596 px. Fits 650. Rows scroll under the card, so the active row is never hidden (the card is sticky above them, the Next bar below).
- The side panel keeps the full stat block for lookups ("ดู Stat block เต็ม" in the card jumps the panel to that tab).
- Under `lg` (tablet portrait) the card is not sticky; it is the first thing in the page, same content.

---------------------------------------------------------------------

## 2. 2a: One-key Next Turn + Turn Card

### 2.1 Wireframe, monster's turn (laptop, middle column about 740 px wide)

```
+--------------------------------------------------------------------------------+
| ▶ ตาของ  Goblin Boss        AC 17 · HP 21/21 ████████████ · Speed 30 ft.   [ย่อ ▲]|
| ถัดไป: Mira (ผู้เล่น)                                                           |
|--------------------------------------------------------------------------------|
| Multiattack  ทำ 2 โจมตี ใช้ Scimitar หรือ Shortbow ผสมกันได้   [ ] [ ] ← ติ๊กนับ  |
|                                                                                |
| Scimitar  ประชิด 5 ft.   [🎯 +4]  [💥 5 (1d6+2) Slashing]   +2 (1d4) ถ้า Advantage|
| Shortbow  ระยะ 80/320    [🎯 +4]  [💥 5 (1d6+2) Piercing]   +2 (1d4) ถ้า Advantage|
|                                                                                |
| Bonus  Nimble Escape: Disengage หรือ Hide            [ ใช้แล้ว? ]               |
|--------------------------------------------------------------------------------|
| Action ▣  Bonus ▣  Reaction ▣        Condition:  [Prone][Poisoned][Frightened] ⋯|
+--------------------------------------------------------------------------------+
  ⌨ N / Space = ถัดไป · ? = ทางลัดทั้งหมด                                  (footer line, 12 px)
```

Rules for content:
1. **Header line**: name, AC, HP bar (DM may see exact HP), Speed, who is next. `Multiattack` entry is shown first as its sentence in plain text, never summarised (we do not paraphrase rules text).
2. **Attack lines** come from a parser of the stat block text (`Melee/Ranged/Melee or Ranged Attack Roll: +N, reach/range ... Hit: avg (dice) Type damage[, plus ...]`). Each line gets `🎯 +N` (opens the roller with `1d20+N`, label "Goblin Boss · Scimitar · โจมตี") and `💥 dice` (opens the roller with the dice, label includes the damage type). Extra damage text ("plus 2 (1d4) ... if Advantage") is shown as small grey text, not a second button.
3. **Save-based actions** (breath weapons, etc.): `DC 21 Dex · 59 (17d6) Fire · Success: half`, button `💥 17d6`. A **Recharge** badge if the entry has `usage: "Recharge 5-6"`: two states `พร้อม` (green) / `ใช้แล้ว` (dim, tap to flip). When the card opens for the monster's turn and it is `ใช้แล้ว`, the card shows a small `🎲 ทอย Recharge (d6 ≥ 5)` button (opens the roller; the DM taps the result to flip).
4. **Bonus Actions** and **Reactions**: name + the first sentence of the text, tap the name to expand the full text in place.
5. **Legendary Actions**: shown as a row `👑 Legendary 3/3` with one chip per action (cost if the text says "Costs 2 actions"); tap a chip = spend that cost and expands the text. Uses reset to full at the start of this monster's own turn (the stat block says so; the existing `MonsterStatBlock` note already says it). Uses are stored on the combatant.
6. **Legendary monsters take actions on other creatures' turns**, so a thin strip `👑 Adult Red Dragon · Legendary 3/3 [Commanding Presence][Fiery Rays 1][...]` also shows **under the card while it is someone else's turn** (one line, only when a legendary monster is in the fight). This is the part that is easy to forget at the table.
7. **Traits / Spellcasting / Lair actions**: not on the card (they are not "what do I do now"); one link `ดู Stat block เต็ม ▸`.
8. If the monster name does not match an SRD entry (homebrew, renamed): the card shows name, AC, HP and "ไม่พบ Stat block ใน SRD · เพิ่มโน้ตสั้นๆ" with the combatant's `notes` field editable (it exists on `Combatant`). No empty box.
9. If an entry's text cannot be parsed, fall back to the raw sentence under the name, no buttons. Never hide an action because parsing failed.

Height check for a worst case (Adult Red Dragon: Multiattack, Rend, Fire Breath, 3 legendary chips): header 40 + multiattack 40 + 2 attack lines 56 + legendary row 36 = 172 px: allow the card to scroll inside (`max-h-44 overflow-y-auto`) instead of growing; the DM can also collapse it.

### 2.2 Wireframe, PC's turn

```
+--------------------------------------------------------------------------------+
| ▶ ตาของ  Mira · Wizard 3 (ผู้เล่น)        AC 15 · HP 18/18 ████████████          |
| ถัดไป: Goblin Boss                                                  [ย่อ ▲]     |
|--------------------------------------------------------------------------------|
| Condition: ไม่มี                          🔮 Concentration: Bless                |
| Action ▣  Bonus ▣  Reaction ▣       [ดูใบตัวละคร]   ผู้เล่นกด "จบเทิร์น" เองได้   |
| [Prone][Poisoned][Frightened][Stunned][Grappled][Restrained][Blinded][Charmed] ⋯|
+--------------------------------------------------------------------------------+
```

- PC: name (+ class level), AC, HP, Condition chips as they are now (tracker effects + sheet-only), Concentration, Action economy (`ActionEconomyBar`, tappable as in the open row), buffs as small chips. No attacks list here (that is the player's phone); a link to the sheet.
- The one-tap condition chips (2d) are shown here for the active creature and in the open row for everyone.

### 2.3 Keyboard

| Key | Action | Notes |
|---|---|---|
| `N` or `Space` | Next turn | Same function as the big button (`advanceTurn(enc.id, {activeId, round})`). The `expect` guard means a double press (or key repeat) advances **once**. |
| `P` | Previous turn | Same as `◀`. |
| `D` | Focus the batch damage box (2b) | Opens the selection bar if nothing is selected (box then applies to the active creature). |
| `Z` or `Ctrl/Cmd+Z` | Undo last batch (2b) | Only when not typing in a field. |
| `Esc` | Clear selection / close cheat sheet / close popover | |
| `/` | Focus quick search in the side panel (2c) | |
| `?` | Open the cheat sheet | Also a visible `⌨` button next to `🏁 จบ` and in the card footer. |

Guards (all in one `useHotkeys` hook, mounted only on the fight screen when `enc.status === 'active'`):
- **Ignore** when the event target is `input`, `textarea`, `select` or `contenteditable`, **when any of Ctrl/Meta/Alt is held** (so Cmd+N, Ctrl+R keep working; except the Z-undo combo above), when `e.isComposing`, when a dialog/popover is open (`role="dialog"`, `UseActionDialog`, `ActionChoiceDialog`, the roller sheet `fixed bottom-0`), and on `e.repeat`.
- **Space** is also ignored when the focused element is a `button`, `a`, `summary` or `[role=button]` (native Space must press that control, e.g. a condition chip, not skip the turn). `N` has no such conflict and always works. Tip printed in the cheat sheet: "ถ้าโฟกัสอยู่ที่ปุ่ม ใช้ N แทน Space".
- Match on **`e.code`** (`KeyN`, `KeyP`, `KeyD`, `KeyZ`, `Slash`), **not `e.key`**, so it still works when the laptop keyboard is on the **Thai layout** (where the N key types "ื").
- Feedback because the DM's eyes are on the table, not the screen: the card changes, and a polite live region announces "ตาของ Goblin Boss (รอบ 2)" (`role="status"`); the active row gets a 600 ms ring flash (respect `prefers-reduced-motion`: no flash, the ring is simply there).

### 2.4 Cheat sheet (visible)

Footer line in the card (`⌨ N/Space ถัดไป · P ก่อนหน้า · ? ทางลัด`) is always visible. `?` or the `⌨` button opens a small popover (not a modal page), `w-80`, anchored to the bottom bar:

```
+------------------------------------+
| ⌨ ทางลัด (ใช้ได้เมื่อไม่ได้พิมพ์อยู่)  |
|  N / Space   ถัดไป                 |
|  P           ก่อนหน้า               |
|  D           ใส่ดาเมจให้ตัวที่เลือก   |
|  Z           เลิกทำครั้งล่าสุด        |
|  /           ค้นหาในสมุด            |
|  Esc         ยกเลิก / ปิด           |
|  ?           เปิดหน้านี้             |
| ทำงานได้แม้แป้นพิมพ์เป็นภาษาไทย       |
+------------------------------------+
```
`Esc` or click outside closes it, focus returns to the `⌨` button. Keys are shown in `<kbd>` styling (border, `bg-stone-900`, `font-mono`).

---------------------------------------------------------------------

## 3. 2b: Multi-select and batch damage / condition

### 3.1 Row changes

Add a **select box** at the far left of each collapsed row (a 40 x 40 touch area around a 20 px checkbox; label `เลือก {name}`). Clicking the row body still opens/closes it as today; the box only selects. Selected rows get `ring-2 ring-sky-400` (different from the active turn's amber border so both read at once), plus a check mark inside the box (colour is not the only cue).
Shortcuts: `Shift+click` selects a range, a click on a group chip selects several at once.

### 3.2 Batch bar

Appears **between the card and the rows** (sticky under the card at `lg`, in flow below `lg`) only while 1 or more are selected, so nothing moves when it is hidden. It uses the same slot the "ทอย Initiative ให้มอนสเตอร์ทั้งหมด" button uses today.

```
 Select shortcuts (always shown above the rows while a fight is active, one line):
 [Goblin ×3] [Wolf ×2] [มอนสเตอร์ทั้งหมด] [ผู้เล่นทั้งหมด]            (1 click each)

 Selection bar (after 3 goblins are selected):
+--------------------------------------------------------------------------------+
| ✔ เลือก 3 · Goblin 1, Goblin 2, Goblin 3          [ล้าง Esc]                   |
| ดาเมจ [ 8   ]   [ − ดาเมจ ]  [ + ฮีล ]  [ 🌀 Condition ▾ ]       [ ↩︎ เลิกทำ Z ]|
+--------------------------------------------------------------------------------+
```

Typing a number in the box **immediately shows the preview list** (no extra step), still before anything is applied:

```
+--------------------------------------------------------------------------------+
| ดาเมจ [ 8 ]                                              [ ใช้ดาเมจ (Enter) ]    |
|  Goblin 1   HP 7 → 0 ☠️ ล้ม                      [½ Save สำเร็จ]  [ไม่โดน]        |
|  Goblin 2   HP 7 → 0 ☠️ ล้ม                      [½ Save สำเร็จ]  [ไม่โดน]        |
|  Goblin 3   HP 7 → 3        ← กด ½ แล้ว: 8 → 4    [½ Save สำเร็จ ✔] [ไม่โดน]      |
+--------------------------------------------------------------------------------+
```

- The preview rows use the **same** `damageMonster` / sheet logic, shown without writing. Numbers are for the DM only.
- `½ Save สำเร็จ` toggles half damage for that creature (rounded down, 2024 rules; the line then shows `8 → 4`). `ไม่โดน` sets 0 (for "evasion" or out of area). Both are per-creature, before confirming.
- Default focus after the number is typed stays in the box, so **Enter confirms**. Count of actions: **select (group chip or select-all, 1 click) → type → Enter/click = 3 actions.** A hand-picked set of n creatures costs n clicks to select (a plain fact, there is no shortcut for arbitrary subsets); `Shift+click` range keeps most real cases (adjacent in initiative order) at 2 clicks.
- `+ ฮีล` works the same way (no half toggle, a `Temp HP` option stays on the single-row control only).
- Concentration reminders from `damageMonster` ("ทอย CON Save DC N") are collected into **one list** in the toast/log instead of one line per creature.

### 3.3 Condition on the selection in 2 taps

`🌀 Condition ▾` opens a popover (anchored under the button) with the common-condition chips (same set as 2d: Prone, Poisoned, Frightened, Stunned, Grappled, Restrained, Blinded, Charmed, Incapacitated, Paralyzed ...) and a row `ระยะเวลา: [ไม่จำกัด] [1 รอบ] [10 รอบ]` (default: not limited). Tap 1 = open, tap 2 = a chip: applied to every selected creature and the popover closes. `⋯ อื่นๆ` opens the existing custom-effect form for names like Bless. PCs get the condition on their sheet through the same `setCondition` action used today. A creature that already has it is skipped (no stack) and counted in the toast: "ใส่ Prone ให้ 3 ตัว (ข้าม 1: มีอยู่แล้ว)".

### 3.4 Undo, one step for the whole batch

- After any batch action (damage, heal, condition) the bar shows `↩︎ เลิกทำ` and a toast `ดาเมจ 8 → 3 ตัว · เลิกทำ (Z)` (`role="status"`, stays until the next batch/turn change, **no auto-dismiss timer** so the DM is not rushed).
- One undo = the whole batch, one level only. A new batch replaces the stored snapshot.
- Undo restores, for each affected creature: HP/temp, `defeated`, `concentration`, `effects` (monsters), and for PCs the sheet's HP/temp, `deathSaves`, `conditions`, `concentration`. It writes one log line `↩︎ เลิกทำ: ...` instead of deleting earlier lines (players' logs mirror the DM's, so deleting would desync).
- Undo is dropped when the turn advances or the fight ends (stale). If a selected creature changed after the batch, undo restores the others and says "ข้าม {name} (มีการเปลี่ยนแปลงหลังจากนั้น)". See open question 3.
- Player phones: nothing special. The DM's device pushes the PC's restored sheet state like any other change.

### 3.5 Players never see monster HP

- Batch bar, preview and toast exist **only in the DM tracker**; they are not part of `playerView`.
- Batch log lines are DM-only (`forPlayers=false`), like today's single-creature damage lines. Optional later: a player-safe line without numbers for visible monsters ("Goblin 2 ล้ม"). Not in this scope.
- The `👁 มุมมองผู้เล่น` preview panel must keep showing only `healthStatus` (check in QA: select + damage while the preview is open, confirm no number appears).

---------------------------------------------------------------------

## 4. 2c: Pinned notes/scenes beside the tracker and quick search

### 4.1 Wireframe (side panel, about 520 px wide at lg)

```
+------------------------------------------------------+
| [👹 Stat block][🔎 ค้นหา][🎲 สุ่ม][📒 สมุด][📜 บันทึก]   🎲 |   <- existing tab row
|------------------------------------------------------|
| 📌 [Wolf Den][ฉาก 3 · ถ้ำ][Mira's quest][NPC ลุงบัน] ›  |   <- NEW pinned strip (always visible, 1 line, scrolls sideways)
| 🔎 ค้นหาสมุดและฉาก (/)  [__________________________]    |   <- NEW quick search (always visible when tab = 📒 or pinned strip used)
|------------------------------------------------------|
|  (content: stat block / page / list as today)          |
+------------------------------------------------------+
```

- **1 tap to open**: a pin chip opens that page **in place in the panel** (`NotebookPage`, same as today), with `← กลับ` returning to the tab the DM came from. No tab switch is needed first. Chip height 40 px (44 under `lg`), label truncated at 14 characters, full title in `title`/`aria-label`.
- A pinned **scene** (inside a session page) opens the session page scrolled to that scene (`#scene-{id}` anchor; existing scene ids) and chips read `ฉาก: {title}`.
- Up to **8 pins** per campaign; the strip scrolls sideways with a `›` fade edge. Order = order pinned; drag to reorder is out of scope (long-press `✕` to unpin).
- Saved **per campaign**: key `pins:{campaignId}` in the device `settings` table (same place as `reward-pool`), value `{ noteId, sceneId? }[]`. DM-only, never sent to players, no Dexie version bump. A deleted page's pin is dropped silently the next time the strip renders.
- A pin button `📌` also appears in the header of every open page (`NotebookPage`) and on scene rows of a session page, toggling pinned (filled = pinned).
- Empty state (no pins): the strip shows one grey line `📌 ยังไม่ได้ปักหมุด · เปิดหน้าสมุดแล้วกด 📌 เพื่อปักไว้ที่นี่` (not hidden, so the feature is discoverable).

### 4.2 Quick search

- Always-visible box in the panel header area (the hidden-when-3-pages rule goes away for this box), `/` focuses it from anywhere on the fight screen (guards as in 2.3).
- Searches **notes, fields and scene text** with the existing `searchNotes`, plus scene titles as their own results. Results show kind emoji, title, one summary line, and a `📌` toggle on the right (44 x 44). Up to 6 results, no pagination.
- Empty query shows **"ล่าสุด"**: the 5 most recently opened pages (stored in the same settings key, `recent:{campaignId}`), so even typing is optional for the repeat visits.
- Keys: `Enter` opens the first result; `Shift+Enter` pins/unpins it; `Esc` clears and returns focus to the fight. `↑/↓` moves through results.
- **Speed target, under 5 s**: `/` (0.3 s) + 2 to 3 letters (1.5 s) + `Enter` (0.3 s) is about 3 s with the keyboard; mouse: click a pin chip = 1 s. To verify in QA with a stopwatch on a 40-page campaign.
- Optional second section "ใน SRD" (monsters/spells/rules) under the notes results reuses `MonsterSearch`; **not in this scope** unless Tan wants it (open question 5).

---------------------------------------------------------------------

## 5. 2d (optional): one-tap common-condition chips

```
 Open row / Turn card:
 Condition: [Prone] [Poisoned] [Frightened] [Stunned] [Grappled] [Restrained] [Blinded] [Charmed]  [⋯ อื่นๆ]
            grey outline = off, red filled + ✓ = on; tap toggles
```

- The 8 chips = the most used at the table (list is a decision for Tan, see open questions); `⋯ อื่นๆ` reveals today's select + rounds + `นับต้น/ท้าย` form unchanged (kept for durations and custom effects like Bless).
- Tap = add with **no duration** (until removed); a long press or the `⋯` form sets rounds. Tapping an active chip removes it (same as ✕ today). Uses `addEffect` / `removeEffect` and `setCondition` for PCs: no rules change.
- Cost today: open row (1) + select (2: open list, pick) + `+ เพิ่ม` (1) = **4 taps**. With chips: open row + chip = **2 taps**; on the active creature (turn card) = **1 tap**.
- Chip uses `HelpButton` (hover/long-press shows the rules text, as in `PlayPanel`), so the DM can check what Prone does without leaving the screen.

---------------------------------------------------------------------

## 6. Phase 4: "ใช้ได้เลย" section at the top of the player's combat tab (360 px)

### 6.1 Placement and order on the tab (`CharacterSheet.tsx`, tab `play`)

Not a new tab. New section component placed **first** inside the `play` tab content, above `PlayPanel`. Death saves stay above everything when HP is 0 (urgent), moved out of `PlayPanel` only visually (same component, rendered first when `atZero`).

```
(above the tabs, unchanged: header, HpCard, AC/Init/Speed/PB tiles, sticky tab bar)

[ death saves block, only at 0 HP ]

+- ใช้ได้เลย -------------------------------------------------+   <- NEW section (<UsableNow/>)
| ตานี้   [Action][Bonus][Reaction]        (ActionEconomyBar)    |
| ไปที่:  (ช่อง 3) (พลัง 2) (คาถา 6) (Skills 18)                 |   <- jump chips, not sticky
|                                                              |
| ช่องคาถา · เหลือ                                               |
|  1st  ● ● ○ ○   2/4                                           |
|  2nd  ● ○ ○     1/3                                           |
|  3rd  ○ ○       0/2   (หมด · คืนเมื่อ Long Rest)               |
|                                                              |
| ความสามารถ (เหลือ/ทั้งหมด)                                      |
|  คืนเมื่อ Short Rest                                          |
|   Action Surge   ▣  1/1                                       |
|   Second Wind    ▢  0/1   dim · คืน Short Rest                |
|  คืนเมื่อ Long Rest                                           |
|   Rage           ▣ ▣ ▢  2/3                                   |
|   Lay On Hands   18/25  [ใช้][คืน]                              |
|                                                              |
| คาถาที่ใช้ได้                                                  |
|  Action                                                        |
|   ★ Fire Bolt (cantrip)                        [ร่าย]          |
|   ★ Magic Missile  L1  slot ได้                [ร่าย]          |
|   ○ Fireball       L3  ช่อง 3 หมด  (สีเทา)      [ร่าย]          |
|  Bonus Action                                                  |
|   ★ Misty Step     L2                          [ร่าย]          |
|  Reaction                                                      |
|   ★ Shield         L1                          [ร่าย]          |
|                                                              |
| Skills (แตะเพื่อทอย d20)                                       |
|  +7 ● Stealth   DEX    |  +3   Athletics  STR                  |
|  +5 ● Arcana    INT    |  +1   History    INT                  |
|  ...  (18 รายการ, 2 คอลัมน์ x 9 แถว)                            |
+--------------------------------------------------------------+
[ ระหว่างเล่น (existing PlayPanel without slots/features/economy ) ]
[ อาวุธและการโจมตี (existing Attacks) ]
```

The slot pips and feature rows **move** out of `PlayPanel` into this section; they are not duplicated. `PlayPanel` keeps Concentration, rests, Exhaustion, Conditions, Buffs. The Action/Bonus/Reaction bar moves into the section's first line (still the same `ActionEconomyBar` and the same `act` handlers).

### 6.2 Block details

1. **Spell slots left per level.** One row per level that has slots (`c.spellSlots[i].max > 0`): label, pips, and `left/max` as text (`2/4`). The row is the spend control as today (tap a full pip to spend one, an empty pip gives one back; players in a room cannot give back, as now). When a level is at 0: the label dims and `หมด` appears; the Warlock note "คืนเมื่อพักสั้น" stays. Each pip keeps its `aria-label` ("1st slot 2"); the pip hit area is padded to 44 x 44 with a 28 px visible circle (`h-7 w-7` inside a `min-h-11 min-w-11` button, as the rest of the sheet does).
2. **Limited-use features grouped by recharge.** Groups from `f.recharge`: `คืนเมื่อ Short Rest` (`short`; and `shortOne` as "Short Rest คืน 1 · Long Rest คืนหมด"), `คืนเมื่อ Long Rest` (`long`). Row: name (tap opens `FeatureCard` as today), pips or `left/max`, nothing else. **Used-up** (`used >= max`): the whole row at 50 % opacity with the line `คืนเมื่อ Short Rest` / `คืนเมื่อ Long Rest` right under the name, so the player sees when it comes back. Pool features (Lay On Hands, Focus Points: `f.pool || f.max > 10`) keep `PoolRow`'s amount box + `ใช้`/`คืน`.
3. **Spells grouped by Action / Bonus Action / Reaction.** Uses `actionKindFor(castingTime)` (needs the SRD spell list: `useSpells()`; while it loads show the current spell list under `Action` with a small `กำลังโหลด…`, never a blank). Spells with another casting time (1 minute, ritual only) go under a 4th group `อื่นๆ (ใช้เวลานาน)`. **Order inside a group: prepared first** (cantrips count as always ready), then unprepared. **Greyed** = a leveled spell whose every castable slot level has 0 left (`castableSlotLevels` is empty): `text-stone-500`, `ช่อง N หมด`, button stays tappable (the app warns, never blocks, as today). `[ร่าย]` opens the existing cast panel (`castPlan`: slot choice, Concentration, spends the Action) inline under that row. Non-casters: the block is omitted (no empty header).
4. **18 skills: modifier, proficiency mark, tap to roll.** Two columns x 9 rows, alphabetical like `SKILLS`. Each cell is **one button** (whole cell is the target, min height 44): left = big modifier chip `+7`, then `●` (proficient) or `★` (Expertise) mark, then the name and ability short ("Stealth DEX"). Tap = `openRoller({expression: '1d20+7', label: 'Stealth'})` (existing roller, shares with the room like other rolls). The help text is moved to a small `?` in the section header ("ดูว่า Skill ใช้ทำอะไร" opens the existing glossary help for the name), because the name is no longer a help trigger. The `Skills` list on the ความสามารถ tab stays as it is (read-only reference), or links here; no duplication of rules text.
5. **Modifier placed at the left** of each cell so nothing important sits at the far right edge where the 🎲 passes.

### 6.3 360 px checks (design numbers, to be measured in the PR)

- Content width: 360 - 2 x 16 (`p-4`) = 328 px. Skills columns: (328 - 20 gap) / 2 = 154 px each: modifier chip 44 + mark 16 + name (about 90 px; "Sleight of Hand" and "Animal Handling" wrap to two lines at 14 px: allowed, row grows to 52 px; Thai ability names are not shown here, only EN short codes).
- Slots row: label 40 + 4 to 5 pips x (44 touch) = 220 + text 40 = 300 px fits; a 9-pip level (Warlock-style pools are fewer; a level with more than 6 pips wraps to a second line). Max 5 rows normally (levels 1 to 5), 220 px.
- **Nothing under the 🎲**: it covers x 288 to 344, y (viewport bottom - 136) to (bottom - 80). Rules: (a) the tab keeps `pb-36` (144 px) so the last row always scrolls clear above it; (b) no control, count or `ร่าย` button in the **last 56 px on the right** except the 2nd skill column, whose tap area is the whole cell (modifier is at the cell's left); (c) `[ร่าย]` buttons sit in a 44 px column at the right, and are the only right-edge targets; they are tappable once the row is scrolled above the button (the button also tucks itself while scrolling); (d) QA at 360 x 640 scrolled to each block's last row.
- **At most 1 scroll / 0 tab switches**: the section is about 1,100 px tall in a typical level-5 caster (slots 150, features 120, spells 330, skills 400, header 60), far more than one 360 x 640 screen, so "everything visible" is impossible. Interpretation used here (to confirm with Tan, open question 6): **any one block is reachable with at most one scroll gesture from the top of the tab**, using the jump chips (1 tap, 0 scroll) and ordering by use frequency (slots, features, spells, skills). The two blocks the player needs mid-combat (economy bar + slots) are in the first 220 px of the section.
- Collapsing: each block header is a `<button aria-expanded>`; Skills starts collapsed on a phone if the sheet is short on room? **No**: collapsed-by-default hides things, which the brief forbids. All blocks open; only the jump chips shorten the trip.

### 6.4 Empty / used-up / loading states

| State | Behaviour |
|---|---|
| Not a caster | No slot, no spell block. If the character has features only, show features + skills. |
| Caster with 0 slots configured (older sheets) | Existing banner "Spell Slots ยังไม่ได้ตั้ง" + button (`setSlotsFromTable`) in place of the slots block. |
| All slots of a level spent | Row dimmed, `หมด`, return rule text. Spells that need only that level are greyed. |
| No limited-use features | Block omitted. A catalog hint `+ จาก SRD` stays in the old "ความสามารถ" spot as today (`canAddFeatures`). |
| Feature used up | Dim 50 %, `คืนเมื่อ Short/Long Rest` under the name, pips outlined. |
| Spell list loading | Grouped by `Action` with a spinner line; no layout jump (reserve `min-h-16`). |
| Not your turn in a room | `Action`/`Bonus` chips show the existing 🔒 (locked) style and the `ร่าย` button explains "ใช้ได้เฉพาะตาของตัวเอง" (existing `waitingForTurn` message). Reaction stays open. |
| Rolling a skill offline | Roller works offline (local). Room share only when connected, as today. |

---------------------------------------------------------------------

## 7. State and interaction notes

**Selection state** (tracker only): `selectedIds: Set<string>` in `Tracker`, cleared on: `Esc`, fight status change, Next Turn and the `ล้าง` button (not after each batch, so a condition can follow the damage on the same selection), removal of a selected creature. Selected ids that no longer exist are filtered at render. Not persisted. Not synced.
**Active vs selected**: amber border = active turn; sky ring + check = selected; both can show.
**Hidden monsters** (`hidden` flag) can be selected; the preview marks them `🙈`.
**Defeated** rows are selectable (to heal them back); group chips ignore defeated ones.
**Keyboard + focus**: batch bar order in the tab sequence: select boxes, then group chips, then box, buttons; the bar is `role="region" aria-label="ตัวที่เลือก"`.
**Undo scope**: see 3.4. Single stored snapshot in component state; lost on reload (fine, the log has the line).
**Empty states (tracker)**: no one selected = no bar; selected but empty box = buttons disabled (`aria-disabled`) with the hint "ใส่ตัวเลขดาเมจ"; nothing to pin = see 4.1; no SRD match for the card = see 2.1 item 8; fight not started (`setup`) = no card, no keys (the cheat sheet says "ใช้ได้เมื่อเริ่มการต่อสู้แล้ว").
**Persistence**: card collapsed state, panel tab (existing), pins and recents per campaign in settings.
**Performance**: stat-block parsing is done once per monster id (memo), the SRD file is already loaded for the stat block tab (`useMonsters`); the card must not make the fight screen load it earlier than the first active monster.

---------------------------------------------------------------------

## 8. Accessibility notes (WCAG 2.2 AA targets; contrast numbers must be measured in the PR with `.claude/ux-ui-kit/scripts/contrast.py`, none are claimed here)

- Every shortcut has a **visible equivalent button** (Next, Previous, Undo, damage, search); no function is keyboard-only (2.1.1) and single-character shortcuts apply only when no field has focus, WCAG 2.1.4 asks for a way to turn off or remap single-character keys: provide `ปิดทางลัดแป้นพิมพ์` toggle in the cheat sheet (saved in `localStorage`, guarded).
- Matching by `e.code` so Thai layout works; `IME composition` ignored.
- Live regions: `role="status"` (polite) for turn changes, batch results and undo; **not** `alert`.
- Focus: opening the cheat sheet/popover moves focus into it and returns it on `Esc`; selection bar does not steal focus when it appears; after confirm, focus returns to the amount box (ready for the next number).
- Targets: 44 px under `lg` (select box, chips, pips, skill cells, `ร่าย`); at `lg` with a mouse 36 to 40 px with 8 px gaps (above the 24 px WCAG 2.5.8 minimum).
- Colour is never the only signal: used-up = dim + text `หมด`/`ใช้แล้ว` + outlined pips; selected = ring + check mark; greyed spell = text `ช่อง N หมด`; proficiency = `●`/`★` symbol with `aria-label`.
- Skill cell accessible name: "Stealth, +7, ถนัด, ทอย d20" (`aria-label`), not the modifier alone.
- `prefers-reduced-motion`: no ring flash, no toast slide.
- Thai text: line-height 1.5, `min-w-0` + wrap, never `truncate` on rules text; font stays Noto Sans Thai; chip labels allow two lines instead of cutting Thai mid-word.
- Dark theme only today (the app is dark); no new colours: reuse `stone`, `amber`, `emerald`, `red`, `sky` already in use.

---------------------------------------------------------------------

## 9. Components to add or change (for scoping PRs)

Suggested PR split, each shippable alone (UX owns the UI parts, developer owns logic/data):

**PR A: 2a Next Turn key + Turn Card**
- NEW `src/screens/TurnCard.tsx` (monster and PC variants), `ShortcutSheet.tsx`, `src/ui/useHotkeys.ts` (guards in 2.3; unit tests for the guard function as a pure `shouldIgnoreKey(event-like)`).
- NEW pure `src/model/statBlockActions.ts` + tests: parse attack lines (to-hit, reach/range, dice, damage type, rider text, save DC, recharge) from `FullMonster.actions` etc.; unparseable text returns `{raw}`. (developer; content-reviewer to spot-check against 10 SRD monsters)
- CHANGE `Tracker.tsx`: mount `useHotkeys`, render `TurnCard`, compact header while active. `DmPanel.tsx`: "ดู Stat block เต็ม" jumps to the stats tab (small prop/event).
- DATA (developer): `Combatant` gets optional `legendaryUsed?: number` and `spent?: string[]` (Recharge entries used). Optional fields, default = none (the way `turn` was added), reset in `freshMonster`/`startOfTurn` handling.

**PR B: 2b multi-select, batch damage/condition, undo**
- CHANGE `CombatantRow.tsx`: select box + selected ring (new props `selected`, `onSelect`).
- NEW `BatchBar.tsx` (shortcuts chips, amount, preview list with ½ / ไม่โดน, condition popover), `useBatchUndo` state.
- NEW pure `src/model/batch.ts` + tests: `planDamage(combatants, sheets, amount, overrides)` (returns per-creature result without writing), `applyHalf` (round down), snapshot/restore shapes.
- CHANGE `Tracker.tsx`: `selectedIds`, one `update()` call for all monster changes (one write, one `rev`), PC changes through `playAction`, one combined log line per batch. **PC undo needs a restore path**: either a `restoreVitals` system action in `characterActions.ts` or inverse actions; this is logic/data = developer decision (see open question 3).

**PR C: 2c pinned notes + quick search**
- NEW `src/db/pins.ts` (settings key `pins:{campaignId}`, `recent:{campaignId}`) + pure `src/model/pins.ts` (+ tests); NEW `PinnedStrip.tsx`, `QuickSearch.tsx` in `DmPanel.tsx`.
- CHANGE `Notebook.tsx`: `📌` in page header and on scene rows, scene anchors; `DmPanel.tsx` opens a pinned page without a tab switch (lifts "open page" state out of `NotesTab`).
- Backup: check `model/backup.ts` includes the new settings keys (data side).

**PR D (optional): 2d condition chips**
- NEW `ConditionChips.tsx` (reused in `CombatantRow` open row, `TurnCard`, `BatchBar` popover); no model change.

**PR E: Phase 4 "ใช้ได้เลย" on the sheet**
- NEW `src/screens/UsableNow.tsx` with sub-blocks `SlotsLeft`, `FeaturesByRecharge`, `SpellsByAction`, `SkillRoller`; NEW pure helper `src/model/usableNow.ts` + tests (group features by recharge, group spells by action kind with prepared-first and out-of-slot flags, uses `actionKindFor`, `castableSlotLevels`).
- CHANGE `CharacterSheet.tsx` (tab `play` order, death saves first at 0 HP), `PlayPanel.tsx` (slots, features and economy move out; keeps Concentration, rests, Exhaustion, Conditions, Buffs), `SpellList.tsx` (export the cast panel as a component reusable from the new block; no behaviour change), `SkillsSection` (unchanged or links to the new block).
- No data/model changes; reuses `useCharacterAct`, `openRoller`, `useSpells`.

QA to add (`docs/QA.md`): keys on Thai layout; key ignored in every input; double press advances once; batch of 3 goblins + undo; PC in the batch at 0 HP; player-view preview shows no monster HP after a batch; pin per campaign, switching campaigns; search under 5 s; sheet at 360 x 640 scrolled to each block with the 🎲 visible; screenshots at 390 and 1366, long Thai names.

---------------------------------------------------------------------

## 10. Open questions for Tan

1. **Turn Card place.** Recommended: top of the middle column, sticky, collapsible (DM looks at the tracker, not the side). Alternative: make it the default top of the side panel. Which?
2. **Attacks vs "ใช้ได้เลย" order (player sheet).** The section is at the top as asked, so the 🎯/💥 Attacks list moves below about 1,100 px of content on a phone. Keep it below, or put Attacks inside the section as its first block (so fighters see their weapon first)?
3. **Undo depth and PCs.** One step for the whole batch as asked. Should undo also work after a Next Turn (my default: no, it expires on turn change), and may it restore a **player's** sheet HP while the player may have changed it from their phone in the meantime (my default: skip that creature and say so)?
4. **Condition chips list (2d / batch).** My eight: Prone, Poisoned, Frightened, Stunned, Grappled, Restrained, Blinded, Charmed. Add Incapacitated and Paralyzed, or swap any? Your table's real usage decides.
5. **Quick search scope.** Notes and scene text only (as sketched), or also SRD monsters/spells/rules in the same box (one more section, reuses Lookup)?
6. **"At most 1 scroll" on a 360 px phone.** The full section is longer than one screen. I read it as "any block is reachable with at most one scroll from the top, with jump chips". Is that what you meant, or should the section be shortened (e.g. skills as a collapsed block, only prepared spells)?
7. **Damage types and resistances.** Batch damage is a single number. Should the preview also flag resistance/vulnerability/immunity from the stat block (e.g. "Fire: ½") per creature, or do you apply that with the ½ toggle yourself?
8. **Legendary and Recharge state** need two small optional fields on each monster in the fight (data change, handed to the developer). OK to add, or should the card be display-only (no counters) for now?
9. **Shortcut off-switch.** Single-key shortcuts get an on/off toggle in the cheat sheet (accessibility rule). OK, or should N/Space always be on?
