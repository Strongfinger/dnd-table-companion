import { lazy, Suspense, useState } from 'react'
import UpdatePrompt from './app/UpdatePrompt'
import PullToRefresh from './ui/PullToRefresh'
import { HelpProvider } from './ui/help'
import { LobbyProvider } from './app/lobby'
import { useLobby } from './app/useLobby'
import { useRoute, type Route } from './app/router'
import About from './screens/About'
import Backup from './screens/Backup'
import CharacterEdit from './screens/CharacterEdit'
import CharacterList from './screens/CharacterList'
import CharacterSheet from './screens/CharacterSheet'
import CreateWizard from './screens/CreateWizard'
import DiceRoller, { type RollRecord } from './screens/DiceRoller'
import ImportCharacter from './screens/ImportCharacter'
import LiveFightBar from './screens/LiveFightBar'
import Lobby from './screens/Lobby'
import PartyOverview from './screens/PartyOverview'
import { PlayerFight, PlayerFightList } from './screens/PlayerFights'
import RoomRollToast from './screens/RoomRollToast'

// DM-side screens load on first use, so players' phones start faster (the offline app still caches them all).
const DmHome = lazy(() => import('./screens/DmHome'))
const ImportPack = lazy(() => import('./screens/ImportPack'))
const EncounterList = lazy(() => import('./screens/EncounterList'))
const LobbyLab = lazy(() => import('./screens/LobbyLab'))
const Lookup = lazy(() => import('./screens/Lookup'))
const MonsterView = lazy(() => import('./screens/Lookup').then((m) => ({ default: m.MonsterView })))
const SpellView = lazy(() => import('./screens/Lookup').then((m) => ({ default: m.SpellView })))
const NotePageRoute = lazy(() => import('./screens/Notebook'))
const Tracker = lazy(() => import('./screens/Tracker'))
const StoryShelf = lazy(() => import('./screens/Chronicle'))
const BookRoute = lazy(() => import('./screens/Chronicle').then((m) => ({ default: m.BookRoute })))
const StoryManage = lazy(() => import('./screens/Chronicle').then((m) => ({ default: m.StoryManage })))
const ChapterEditor = lazy(() => import('./screens/Chronicle').then((m) => ({ default: m.ChapterEditor })))

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
        <Suspense fallback={<p className="text-center text-stone-500">กำลังโหลด…</p>}>
        {route.name === 'list' && <CharacterList />}
        {route.name === 'new' && <CreateWizard />}
        {route.name === 'import' && <ImportCharacter />}
        {route.name === 'sheet' && <CharacterSheet id={route.id} />}
        {/* key makes React start a fresh form when switching characters */}
        {route.name === 'edit' && <CharacterEdit key={route.id} id={route.id} />}
        {route.name === 'fights' && <FightsRoute />}
        {route.name === 'fight' && <FightRoute key={route.id} id={route.id} />}
        {route.name === 'about' && <About />}
        {route.name === 'backup' && <Backup />}
        {route.name === 'party' && <PartyOverview />}
        {route.name === 'lab' && <LobbyLab />}
        {route.name === 'lobby' && <Lobby code={route.code} />}
        {route.name === 'dm' && <DmHome />}
        {route.name === 'packImport' && <ImportPack />}
        {route.name === 'note' && <NotePageRoute key={route.id} id={route.id} />}
        {route.name === 'lookup' && <Lookup tab={route.tab} />}
        {route.name === 'monster' && <MonsterView key={route.id} id={route.id} />}
        {route.name === 'spell' && <SpellView key={route.id} id={route.id} />}
        {route.name === 'stories' && <StoryShelf />}
        {route.name === 'book' && <BookRoute key={`${route.source}/${route.id}`} source={route.source} id={route.id} chapterId={route.chapterId} />}
        {route.name === 'storyManage' && <StoryManage key={route.campaignId} campaignId={route.campaignId} />}
        {route.name === 'chapterEdit' && <ChapterEditor key={route.id} id={route.id} />}
        </Suspense>
        <footer className="mt-10 text-center text-xs text-stone-600">
          <a href="#/about" className="underline">เกี่ยวกับแอป · เครดิต SRD 5.2.1 (CC-BY-4.0)</a>
        </footer>
      </main>
      <UpdatePrompt />
      <PullToRefresh />
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
  const inLookup = route.name === 'lookup' || route.name === 'monster' || route.name === 'spell'
  const inDm = route.name === 'dm' || route.name === 'packImport' || route.name === 'note'
  const isPlayer = lobby.session?.role === 'player'
  // Phones: icon above a short label so five tabs fit; wider screens: one line.
  const tab = (active: boolean) => `flex flex-1 flex-col items-center gap-0.5 whitespace-nowrap px-1 py-2 text-xs font-bold sm:flex-row sm:justify-center sm:gap-1 sm:py-3 sm:text-base ${active ? 'border-b-2 border-amber-400 text-amber-400' : 'text-stone-500'}`
  return (
    <nav className="sticky top-0 z-10 border-b border-stone-800 bg-stone-950/95">
      <div className="mx-auto flex max-w-5xl">
        <a href="#/" className={tab(!inFights && !inDm && !inLookup && route.name !== 'lobby')}><span className="text-base leading-none">📜</span><span>ตัวละคร</span></a>
        <a href="#/fights" className={tab(inFights)}><span className="text-base leading-none">⚔️</span><span>การต่อสู้</span></a>
        {/* The lookup (spells, rules, conditions; monsters for the DM) is everyone's. The DM's tools are not for players in a room. */}
        <a href="#/lookup" className={tab(inLookup)}><span className="text-base leading-none">📖</span><span>ค้นหา</span></a>
        {!isPlayer && <a href="#/dm" className={tab(inDm)}><span className="text-base leading-none">🧙</span><span>DM</span></a>}
        <a href="#/lobby" className={tab(route.name === 'lobby')}><span className="text-base leading-none">🌐</span><span>ห้อง <LobbyDot /></span></a>
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
