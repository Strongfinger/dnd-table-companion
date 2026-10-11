// This device's identity: a random id (never changes) and a name players will see in a lobby.
// Loaded once at startup (see main.tsx) so saves can stamp records without waiting.
import { newId } from '../model/character'
import { db } from './db'

export interface DeviceInfo {
  id: string
  name: string
}

let current: DeviceInfo | null = null

/** Read this device's identity, creating it the first time the app runs here. */
export async function loadDevice(): Promise<DeviceInfo> {
  const stored = (await db.settings.get('device'))?.value as DeviceInfo | undefined
  current = stored ?? { id: newId(), name: 'อุปกรณ์ของฉัน' }
  if (!stored) await db.settings.put({ key: 'device', value: current })
  return current
}

/** The id loaded at startup ('' only if loadDevice hasn't run, e.g. in some tests). */
export function deviceId(): string {
  return current?.id ?? ''
}

export function currentDevice(): DeviceInfo | null {
  return current
}

export async function setDeviceName(name: string): Promise<DeviceInfo> {
  const device = { id: (current ?? (await loadDevice())).id, name: name.trim().slice(0, 40) || 'อุปกรณ์ของฉัน' }
  await db.settings.put({ key: 'device', value: device })
  current = device
  return device
}

/** Small per-device preferences, e.g. which campaign is selected. */
export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined
}

export async function setSetting(key: string, value: unknown): Promise<void> {
  await db.settings.put({ key, value })
}
