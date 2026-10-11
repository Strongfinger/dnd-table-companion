import { useRoute } from './app/router'
import CharacterEdit from './screens/CharacterEdit'
import CharacterList from './screens/CharacterList'
import CharacterSheet from './screens/CharacterSheet'
import CreateWizard from './screens/CreateWizard'

export default function App() {
  const route = useRoute()

  return (
    <main className="mx-auto min-h-dvh max-w-xl p-4">
      {route.name === 'list' && <CharacterList />}
      {route.name === 'new' && <CreateWizard />}
      {route.name === 'sheet' && <CharacterSheet id={route.id} />}
      {/* key makes React start a fresh form when switching characters */}
      {route.name === 'edit' && <CharacterEdit key={route.id} id={route.id} />}
    </main>
  )
}
