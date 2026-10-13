import { describe, expect, it } from 'vitest'
import { buildGlossaryTh } from './glossaryTh'

const page = `# รายการกฏ (Rules Glossary)
## นิยามกฏ (Rules Definitions)
### ติดพิษ (Poisoned) [สภาวะ (Condition)] {#PoisonedCondition}

ขณะที่คุณมีสภาวะติดพิษ

***ผลกระทบ*** ทอยแบบ [เสียเปรียบ (Disadvantage)](/free-rules/rules-glossary#Disadvantage)

---

### ทำลายวัตถุ (Breaking Objects)

วัตถุเสียหายได้

#### ระดับการป้องกันของวัตถุ (Object Armor Class) {#ObjectAC}

| AC   | วัตถุ    |
| --- | --- |

> คำแนะนำสำหรับ DM

### หัวข้อไม่มีชื่ออังกฤษ
ข้าม
`

describe('buildGlossaryTh', () => {
  it('reads each entry with its tag, sub-headings and tables; drops dividers, sidebars and links', () => {
    const { entries, report } = buildGlossaryTh(page)
    expect(entries).toEqual([
      { th: 'ติดพิษ', en: 'Poisoned', tag: 'Condition', text: 'ขณะที่คุณมีสภาวะติดพิษ\n\n***ผลกระทบ*** ทอยแบบ เสียเปรียบ (Disadvantage)' },
      { th: 'ทำลายวัตถุ', en: 'Breaking Objects', text: 'วัตถุเสียหายได้\n\n#### ระดับการป้องกันของวัตถุ (Object Armor Class)\n\n| AC | วัตถุ |\n| --- | --- |' },
    ])
    expect(report.entries).toBe(2)
  })
})
