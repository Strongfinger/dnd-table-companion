// The Turn Card's collapsed state is remembered on this device.
const COLLAPSE_KEY = 'turn-card-collapsed'

/** The collapsed state is remembered on this device (a convenience only: storage may be unavailable). */
export function savedCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === '1'
  } catch {
    return false
  }
}
export function saveCollapsed(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? '1' : '0')
  } catch {
    // not saved: fine
  }
}
