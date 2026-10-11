// Thai glosses for game terms used in log lines and on screen (game terms stay in English).
import type { Condition } from '../rules'

export const CONDITION_TH: Record<Condition, string> = {
  Blinded: 'ตาบอด',
  Charmed: 'ถูกสะกดใจ',
  Deafened: 'หูหนวก',
  Frightened: 'หวาดกลัว',
  Grappled: 'ถูกจับล็อก',
  Incapacitated: 'ทำอะไรไม่ได้',
  Invisible: 'ล่องหน',
  Paralyzed: 'อัมพาต',
  Petrified: 'กลายเป็นหิน',
  Poisoned: 'ติดพิษ',
  Prone: 'ล้มลง',
  Restrained: 'ถูกพันธนาการ',
  Stunned: 'มึนงง',
  Unconscious: 'หมดสติ',
}
