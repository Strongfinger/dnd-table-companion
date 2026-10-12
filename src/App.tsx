import { useState } from 'react'
import UpdatePrompt from './app/UpdatePrompt'
import { HelpProvider } from './ui/help'
import { LobbyProvider } from './app/lobby'
import { useLobby } from './app/useLobby'
import { useRoute, type Route } from './app/router'
import About from './screens/About'
import CharacterEdit from './screens/CharacterEdit'
import CharacterList from './screens/CharacterList'
import CharacterSheet from './screens/CharacterSheet'
import DmHome from './screens/DmHome'
import CreateWizard from './screens/CreateWizard'
import DiceRoller, { type RollRecord } from './screens/DiceRoller'
import EncounterList from './screens/EncounterList'
import ImportCharacter from './screens/ImportCharacter'
import LiveFightBar from './screens/LiveFightBar'
import Lobby from './screens/Lobby'
import LobbyLab from './screens/LobbyLab'
import Lookup, { MonsterView, SpellView } from './screens/Lookup'
import NoteEdit from './screens/NoteEdit'
import PartyOverview from './screens/PartyOverview'
import { PlayerFight, PlayerFightList } from './screens/PlayerFights'
import RoomRollToast from './screens/RoomRollToast'
import Tracker from './screens/Tracker'

export default function App() {
  const route = useRoute()
  // Dice history lives here so it survives moving between screens.
  const [rolls, setRolls] = useState<RollRecord[]>([])

  return (
    <HelpProvider>
    <LobbyProvider>
      <NavBar route={route} />
      {/* The tracker gets a wider page for laptops/tablets; sheets stay phone-width. */}
      {/* pb-36: room so the floating 🎲 button and bottom bars never cover the last item. */}
      <main className={`mx-auto min-h-dvh p-4 pb-36 ${route.name === 'fight' ? 'max-w-7xl' : route.name === 'party' ? 'max-w-5xl' : 'max-w-xl'}`}>
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
        {route.name === 'dm' && <DmHome />}
        {route.name === 'note' && <NoteEdit key={route.id} id={route.id} />}
        {route.name === 'lookup' && <Lookup tab={route.tab} />}
        {route.name === 'monster' && <MonsterView key={route.id} id={route.id} />}
        {route.name === 'spell' && <SpellView key={route.id} id={route.id} />}
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

/** Top tabs. The DM tab (notes, tools) is hidden on a player's phone in a live room. */
function NavBar({ route }: { route: Route }) {
  const lobby = useLobby()
  const inFights = route.name === 'fights' || route.name === 'fight'
  const inDm = route.name === 'dm' || route.name === 'note' || route.name === 'lookup' || route.name === 'monster' || route.name === 'spell'
  const tab = (active: boolean) => `flex-1 py-3 text-center font-bold ${active ? 'border-b-2 border-amber-400 text-amber-400' : 'text-stone-500'}`
  return (
    <nav className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95">
      <div className="mx-auto flex max-w-5xl text-sm sm:text-base">
        <a href="#/" className={tab(!inFights && !inDm && route.name !== 'lobby')}>📜 ตัวละคร</a>
        <a href="#/fights" className={tab(inFights)}>⚔️ การต่อสู้</a>
        {/* Players in a room get the lookup (spells, rules, conditions) instead of the DM's tools. */}
        {lobby.session?.role === 'player'
          ? <a href="#/lookup" className={tab(inDm)}>📖 ค้นหา</a>
          : <a href="#/dm" className={tab(inDm)}>🧙 DM</a>}
        <a href="#/lobby" className={tab(route.name === 'lobby')}>🌐 ห้อง <LobbyDot /></a>
      </div>
      <LiveFightBar />
      {lobby.session?.role === 'player' && lobby.shortRestSince && (
        // Players: the DM started a short rest. Tap to roll Hit Dice on my sheet.
        <a href={lobby.session.characterId ? `#/c/${lobby.session.characterId}` : '#/lobby'} className="mx-auto block max-w-5xl bg-sky-900 px-4 py-2 text-sm font-bold text-sky-100">
          ☕ กำลังพักสั้น · แตะเพื่อทอย Hit Dice ฟื้น HP
        </a>
      )}
    </nav>
  )
}
