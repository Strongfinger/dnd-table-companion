// The "what are you doing with this Action / Bonus Action / Reaction / Concentration?" dialog with
// suggestions that fit the button (spells by casting time). Shown only while open, so the SRD spell
// list loads on the first tap, not with every sheet or tracker row.
import type { ComponentProps } from 'react'
import { actionSuggestions, type SuggestionKind } from '../model/actionSuggestions'
import type { Character } from '../model/character'
import UseActionDialog from '../ui/UseActionDialog'
import { useSpells } from './useSrdData'

export default function ActionChoiceDialog({ kind, character, ...dialog }: {
  kind: SuggestionKind
  character: Character | null
} & Omit<ComponentProps<typeof UseActionDialog>, 'suggestions'>) {
  const spells = useSpells()
  return <UseActionDialog {...dialog} suggestions={actionSuggestions(kind, character, spells)} />
}
