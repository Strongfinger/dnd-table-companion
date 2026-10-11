import { useState } from 'react'
import { useRoute } from './app/router'
import About from './screens/About'
import CharacterEdit from './screens/CharacterEdit'
import CharacterList from './screens/CharacterList'
import CharacterSheet from './screens/CharacterSheet'
import CreateWizard from './screens/CreateWizard'
import DiceRoller, { type RollRecord } from './screens/DiceRoller'
import EncounterList from './screens/EncounterList'
import ImportCharacter from './screens/ImportCharacter'
import Tracker from './screens/Tracker'

export default function App() {
  const route = useRoute()
  // Dice history lives here so it survives moving between screens.
  const [rolls, setRolls] = useState<RollRecord[]>([])
  const inFights = route.name === 'fights' || route.name === 'fight'

  return (
    <>
      <nav className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95">
        <div className="mx-auto flex max-w-5xl">
          <a href="#/" className={`flex-1 py-3 text-center font-bold ${inFights ? 'text-stone-500' : 'border-b-2 border-amber-400 text-amber-400'}`}>📜 ตัวละคร</a>
          <a href="#/fights" className={`flex-1 py-3 text-center font-bold ${inFights ? 'border-b-2 border-amber-400 text-amber-400' : 'text-stone-500'}`}>⚔️ การต่อสู้</a>
        </div>
      </nav>
      {/* The tracker gets a wider page for laptops/tablets; sheets stay phone-width. */}
      {/* pb-36: room so the floating 🎲 button and bottom bars never cover the last item. */}
      <main className={`mx-auto min-h-dvh p-4 pb-36 ${route.name === 'fight' ? 'max-w-5xl' : 'max-w-xl'}`}>
        {route.name === 'list' && <CharacterList />}
        {route.name === 'new' && <CreateWizard />}
        {route.name === 'import' && <ImportCharacter />}
        {route.name === 'sheet' && <CharacterSheet id={route.id} />}
        {/* key makes React start a fresh form when switching characters */}
        {route.name === 'edit' && <CharacterEdit key={route.id} id={route.id} />}
        {route.name === 'fights' && <EncounterList />}
        {route.name === 'fight' && <Tracker key={route.id} id={route.id} />}
        {route.name === 'about' && <About />}
        <footer className="mt-10 text-center text-xs text-stone-600">
          <a href="#/about" className="underline">เกี่ยวกับแอป · เครดิต SRD 5.2.1 (CC-BY-4.0)</a>
        </footer>
      </main>
      <DiceRoller history={rolls} onRoll={(r) => setRolls((old) => [{ ...r, id: Date.now() + Math.random() }, ...old].slice(0, 50))} />
    </>
  )
}
