import { useState } from 'react'
import UpdatePrompt from './app/UpdatePrompt'
import { HelpProvider } from './ui/help'
import { LobbyProvider } from './app/lobby'
import { useLobby } from './app/useLobby'
import { useRoute } from './app/router'
import About from './screens/About'
import CharacterEdit from './screens/CharacterEdit'
import CharacterList from './screens/CharacterList'
import CharacterSheet from './screens/CharacterSheet'
import CreateWizard from './screens/CreateWizard'
import DiceRoller, { type RollRecord } from './screens/DiceRoller'
import EncounterList from './screens/EncounterList'
import ImportCharacter from './screens/ImportCharacter'
import LiveFightBar from './screens/LiveFightBar'
import Lobby from './screens/Lobby'
import LobbyLab from './screens/LobbyLab'
import PartyOverview from './screens/PartyOverview'
import { PlayerFight, PlayerFightList } from './screens/PlayerFights'
import RoomRollToast from './screens/RoomRollToast'
import Tracker from './screens/Tracker'

export default function App() {
  const route = useRoute()
  // Dice history lives here so it survives moving between screens.
  const [rolls, setRolls] = useState<RollRecord[]>([])
  const inFights = route.name === 'fights' || route.name === 'fight'
  const tab = (active: boolean) => `flex-1 py-3 text-center font-bold ${active ? 'border-b-2 border-amber-400 text-amber-400' : 'text-stone-500'}`

  return (
    <HelpProvider>
    <LobbyProvider>
      <nav className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95">
        <div className="mx-auto flex max-w-5xl">
          <a href="#/" className={tab(!inFights && route.name !== 'lobby')}>📜 ตัวละคร</a>
          <a href="#/fights" className={tab(inFights)}>⚔️ การต่อสู้</a>
          <a href="#/lobby" className={tab(route.name === 'lobby')}>🌐 ห้อง <LobbyDot /></a>
        </div>
        <LiveFightBar />
      </nav>
      {/* The tracker gets a wider page for laptops/tablets; sheets stay phone-width. */}
      {/* pb-36: room so the floating 🎲 button and bottom bars never cover the last item. */}
      <main className={`mx-auto min-h-dvh p-4 pb-36 ${route.name === 'fight' || route.name === 'party' ? 'max-w-5xl' : 'max-w-xl'}`}>
        {route.name === 'list' && <CharacterList />}
        {route.name === 'new' && <CreateWizard />}
        {route.name === 'import' && <ImportCharacter />}
        {route.name === 'sheet' && <CharacterSheet id={route.id} />}
        {/* key makes React start a fresh form when switching characters */}
        {route.name === 'edit' && <CharacterEdit key={route.id} id={route.id} />}
        {route.name === 'fights' && <FightsRoute />}
        {route.name === 'fight' && <FightRoute key={route.id} id={route.id} />}
        {route.name === 'about' && <About />}
        {route.name === 'party' && <PartyOverview />}
        {route.name === 'lab' && <LobbyLab />}
        {route.name === 'lobby' && <Lobby code={route.code} />}
        <footer className="mt-10 text-center text-xs text-stone-600">
          <a href="#/about" className="underline">เกี่ยวกับแอป · เครดิต SRD 5.2.1 (CC-BY-4.0)</a>
        </footer>
      </main>
      <UpdatePrompt />
      <RoomRollToast />
      <DiceRoller history={rolls} onRoll={(r) => setRolls((old) => [{ ...r, id: Date.now() + Math.random() }, ...old].slice(0, 50))} />
    </LobbyProvider>
    </HelpProvider>
  )
}

/** Small connection light on the lobby tab, only while in a room. */
function LobbyDot() {
  const { session, status } = useLobby()
  if (!session) return null
  const color = status === 'connected' ? 'bg-green-500' : status === 'offline' ? 'bg-stone-500' : 'bg-amber-500'
  return <span className={`ml-1 inline-block h-2 w-2 rounded-full align-middle ${color}`} aria-label={status} />
}

/** Players in a live room see the DM's fights read-only; everyone else gets the tracker. */
const playingInRoom = (lobby: ReturnType<typeof useLobby>) => lobby.session?.role === 'player'

function FightsRoute() {
  const lobby = useLobby()
  return playingInRoom(lobby) ? <PlayerFightList /> : <EncounterList />
}

function FightRoute({ id }: { id: string }) {
  const lobby = useLobby()
  return playingInRoom(lobby) ? <PlayerFight id={id} /> : <Tracker id={id} />
}
