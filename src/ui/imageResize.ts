// Makes a photo small enough to keep in the chronicle: at most MAX_SIDE pixels on its long side, saved as WebP
// (JPEG where the browser can't), lowering the quality until it fits TARGET_CHARS. A phone photo of a few MB
// becomes about 100-300 KB, so chapters stay quick to send to players and to back up.
import { MAX_IMAGE_CHARS } from '../model/chronicle'

export const MAX_SIDE = 1600
export const TARGET_CHARS = 400_000

/** The size to draw at: the long side at most `max`, never bigger than the original. */
export function fitSize(width: number, height: number, max = MAX_SIDE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height, 1))
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) }
}

function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('อ่านรูปนี้ไม่ได้ (ลองไฟล์ JPG หรือ PNG)'))
    }
    img.src = url
  })
}

export async function compressImage(file: Blob): Promise<{ dataUrl: string; width: number; height: number }> {
  if (!file.type.startsWith('image/')) throw new Error('ไฟล์นี้ไม่ใช่รูปภาพ')
  const img = await loadImage(file)
  let size = fitSize(img.naturalWidth, img.naturalHeight)
  for (let attempt = 0; attempt < 6; attempt++) {
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('เบราว์เซอร์นี้ย่อรูปไม่ได้')
    ctx.drawImage(img, 0, 0, size.width, size.height)
    const quality = Math.max(0.5, 0.82 - attempt * 0.08)
    let dataUrl = canvas.toDataURL('image/webp', quality)
    // Browsers without WebP give back PNG instead: use JPEG there.
    if (!dataUrl.startsWith('data:image/webp')) dataUrl = canvas.toDataURL('image/jpeg', quality)
    if (dataUrl.length <= TARGET_CHARS || (attempt === 5 && dataUrl.length <= MAX_IMAGE_CHARS)) return { dataUrl, ...size }
    // Still too big: smaller next time as well.
    size = fitSize(size.width, size.height, Math.round(Math.max(size.width, size.height) * 0.85))
  }
  throw new Error('รูปนี้ใหญ่เกินไป ลองรูปอื่น')
}
