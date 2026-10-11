// Shows "new version available" / "ready offline" messages from the service worker.
import { useRegisterSW } from 'virtual:pwa-register/react'
import { Button } from '../ui/kit'

export default function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW()

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
