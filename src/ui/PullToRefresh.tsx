// Pull down at the top of the page to reload. An installed app (opened from the home screen) has no
// browser reload button or pull-to-refresh; in a normal browser tab the browser's own one is used.
import { useEffect, useState } from 'react'
import { PULL_TRIGGER, pullAmount } from './pull'

function isInstalledApp(): boolean {
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as { standalone?: boolean }).standalone === true
}

/** Inside a box that scrolls on its own and isn't at its top (e.g. the DM panel): that box scrolls instead. */
function insideScrolledBox(target: EventTarget | null): boolean {
  for (let el = target instanceof Element ? target : null; el && el !== document.body; el = el.parentElement) {
    const overflow = getComputedStyle(el).overflowY
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollTop > 0) return true
  }
  return false
}

async function reload() {
  // Ask for a newer app version first (the update prompt then offers it), then reload the page.
  try {
    await (await navigator.serviceWorker?.getRegistration())?.update()
  } catch {
    // Offline: just reload from the cached app.
  }
  window.location.reload()
}

export default function PullToRefresh() {
  const [pull, setPull] = useState(0)
  const [refreshing, setRefreshing] = useState(false)

  useEffect(() => {
    if (!isInstalledApp()) return
    let startY: number | null = null
    let amount = 0
    const onStart = (e: TouchEvent) => {
      // Only from the very top of the page, with one finger.
      startY = window.scrollY <= 0 && e.touches.length === 1 && !insideScrolledBox(e.target) ? e.touches[0].clientY : null
    }
    const onMove = (e: TouchEvent) => {
      if (startY === null) return
      amount = window.scrollY <= 0 ? pullAmount(e.touches[0].clientY - startY) : 0
      setPull(amount)
    }
    const onEnd = () => {
      if (startY !== null && amount >= PULL_TRIGGER) {
        setRefreshing(true)
        void reload()
      }
      startY = null
      amount = 0
      setPull(0)
    }
    window.addEventListener('touchstart', onStart, { passive: true })
    window.addEventListener('touchmove', onMove, { passive: true })
    window.addEventListener('touchend', onEnd)
    window.addEventListener('touchcancel', onEnd)
    return () => {
      window.removeEventListener('touchstart', onStart)
      window.removeEventListener('touchmove', onMove)
      window.removeEventListener('touchend', onEnd)
      window.removeEventListener('touchcancel', onEnd)
    }
  }, [])

  if (pull === 0 && !refreshing) return null
  const ready = refreshing || pull >= PULL_TRIGGER
  return (
    <div
      role="status"
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex justify-center"
      style={{ transform: `translateY(${refreshing ? 48 : pull - 20}px)` }}
    >
      <div className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold shadow-lg shadow-black/50 ${ready ? 'bg-amber-500 text-stone-900' : 'bg-stone-800 text-stone-200'}`}>
        <span className={refreshing ? 'animate-spin' : ''} style={refreshing ? undefined : { display: 'inline-block', transform: `rotate(${pull * 3}deg)` }}>↻</span>
        {refreshing ? 'กำลังรีเฟรช…' : ready ? 'ปล่อยเพื่อรีเฟรช' : 'ดึงลงเพื่อรีเฟรช'}
      </div>
    </div>
  )
}
