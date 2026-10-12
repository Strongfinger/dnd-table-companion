// Players' phones in a live lobby: a bar under the top menu while the DM runs a fight.
// Shows the round and whose turn it is ("your turn!" stands out); tap it for the initiative order.
import { useEffect, useState } from 'react'
import { useLobby } from '../app/useLobby'
import { activeTurn } from '../model/playerView'
import PlayerViewPanel from './PlayerViewPanel'

export default function LiveFightBar() {
  const { session, fight } = useLobby()
  const [open, setOpen] = useState(false)
  const myCharacterId = session?.role === 'player' ? session.characterId : null
  const turn = fight ? activeTurn(fight) : null
  const myTurn = !!myCharacterId && turn !== null && turn !== 'hidden' && turn.pc?.characterId === myCharacterId

  // A short buzz when my turn starts (phones that support it; iPhones ignore it).
  useEffect(() => {
    if (myTurn) navigator.vibrate?.(200)
  }, [myTurn])

  if (!session || session.role !== 'player' || !fight) return null
  const who = turn === 'hidden' ? '👀 มีบางอย่างที่มองไม่เห็นกำลังเคลื่อนไหว…' : turn ? `ตาของ ${turn.name}` : 'รอเริ่มรอบ'

  return (
    <div className="mx-auto max-w-5xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className={`flex w-full items-center justify-between px-4 py-2 text-left text-sm font-bold ${myTurn ? 'bg-amber-500 text-stone-900' : 'bg-red-950 text-red-100'}`}
      >
        <span>⚔️ {fight.name} · รอบที่ {fight.round} · {myTurn ? '🎯 ตาของคุณ!' : who}</span>
        <span aria-hidden>{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="max-h-[60dvh] overflow-y-auto bg-stone-950 p-3">
          <PlayerViewPanel view={fight} title="⚔️ ลำดับ Initiative" myCharacterId={myCharacterId} />
        </div>
      )}
    </div>
  )
}
