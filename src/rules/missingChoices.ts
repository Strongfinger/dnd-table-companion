// Choices a character should have made by their level but hasn't (2024 rules): the subclass (every class at
// level 3) and the Ability Score Improvement feature (class levels from srd/featSlots.ts, plus the Epic Boon
// at 19, which works the same way). Shown as a reminder on the sheet, never blocking.
import { SUBCLASS_LEVEL } from './classes'
import { featSlots } from './srd/featSlots'
import type { ClassName } from './types'

export interface MissingChoice {
  kind: 'subclass' | 'asi' | 'epicBoon'
  /** Class level the choice comes at. */
  level: number
  /** Thai text for the sheet, e.g. "ยังไม่ได้เลือก Subclass (Level 3)". */
  message: string
}

export interface MissingChoiceInput {
  className: ClassName
  subclass: string
  level: number
  species: string
  /** Ids of the feat slots that already hold a feat (e.g. "asi-4"; see featSlots). */
  filledSlots: readonly string[]
}

export function missingChoices(c: MissingChoiceInput): MissingChoice[] {
  const out: MissingChoice[] = []
  if (c.level >= SUBCLASS_LEVEL && !c.subclass.trim()) {
    out.push({ kind: 'subclass', level: SUBCLASS_LEVEL, message: `ยังไม่ได้เลือก Subclass (Level ${SUBCLASS_LEVEL})` })
  }
  for (const slot of featSlots(c)) {
    if ((slot.kind === 'asi' || slot.kind === 'epicBoon') && !c.filledSlots.includes(slot.id)) {
      out.push({ kind: slot.kind, level: slot.level, message: `ยังไม่ได้เลือก ${slot.label}` })
    }
  }
  return out
}
