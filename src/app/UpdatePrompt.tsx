// Shows "new version available" / "ready offline" messages from the service worker,
// and, for a player in a room, "the DM has a newer app" (room version check, sync/appVersion.ts).
import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { playerNeedsUpdate } from '../sync/appVersion'
import { Button } from '../ui/kit'
import { useLobby } from './useLobby'

export default function UpdatePrompt() {
  const registration = useRef<ServiceWorkerRegistration | undefined>(undefined)
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW({ onRegisteredSW: (_url, r) => { registration.current = r } })
  const { session, members } = useLobby()
  const behindDm = session?.role === 'player' && playerNeedsUpdate(members, __BUILD_TIME__)
  const [laterBehindDm, setLaterBehindDm] = useState(false)
  const [checking, setChecking] = useState(false)

  // Behind the DM: ask the server for the new version now, instead of waiting for the next check.
  useEffect(() => {
    if (behindDm) void registration.current?.update().catch(() => undefined)
  }, [behindDm])

  // The new version may not have downloaded yet: check once more, then install it, or just reload.
  async function updateNow() {
    if (needRefresh) return updateServiceWorker(true)
    setChecking(true)
    try {
      await registration.current?.update()
    } catch {
      // Offline or no service worker (e.g. dev mode): a reload is the best we can do.
    }
    if (registration.current?.waiting) return updateServiceWorker(true)
    window.location.reload()
  }

  if (behindDm && !laterBehindDm) {
    return (
      <div role="status" className="fixed inset-x-3 top-14 z-40 mx-auto max-w-md rounded-xl border border-amber-500 bg-stone-900 p-3 shadow-2xl">
        <p className="text-sm">⚠ แอปของคุณเก่ากว่าของ DM กดอัปเดตเพื่อให้เป็นเวอร์ชันเดียวกัน (ข้อมูลตัวละครไม่หาย)</p>
        <div className="mt-2 flex gap-2">
          <Button variant="primary" className="flex-1" onClick={() => { if (!checking) void updateNow() }}>{checking ? 'กำลังโหลด…' : 'อัปเดตเลย'}</Button>
          <Button className="flex-1" onClick={() => setLaterBehindDm(true)}>ไว้ทีหลัง</Button>
        </div>
      </div>
    )
  }

  if (!needRefresh && !offlineReady) return null

  return (
    <div role="status" className="fixed inset-x-3 top-14 z-40 mx-auto max-w-md rounded-xl border border-amber-500 bg-stone-900 p-3 shadow-2xl">
      {needRefresh ? (
        <>
          <p className="text-sm">✨ มีเวอร์ชันใหม่ของแอป กดอัปเดตเมื่อสะดวก (ข้อมูลตัวละครไม่หาย)</p>
          <div className="mt-2 flex gap-2">
            <Button variant="primary" className="flex-1" onClick={() => updateServiceWorker(true)}>อัปเดตเลย</Button>
            <Button className="flex-1" onClick={() => setNeedRefresh(false)}>ไว้ทีหลัง</Button>
          </div>
        </>
      ) : (
        <div className="flex items-center gap-2">
          <p className="flex-1 text-sm">✅ แอปพร้อมใช้งานแบบออฟไลน์แล้ว</p>
          <Button className="text-sm" onClick={() => setOfflineReady(false)}>ปิด</Button>
        </div>
      )}
    </div>
  )
}
