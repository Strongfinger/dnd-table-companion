// Session plans (Phase 3.6): a Session page holds an ordered list of scenes. Each scene has
// read-aloud text, notes (with [[links]] to notebook pages), a checklist of clues/secrets to reveal,
// and maybe a prepared fight. Scenes and checklist items are ticked off while playing; afterwards the
// page stays as the session record and unplayed scenes can move on to the next session.
import { newId } from './character'

export interface Scene {
  id: string
  title: string
  /** Text to read aloud to the players. */
  readAloud: string
  /** DM notes; [[Page title]] links to the notebook. */
  notes: string
  checklist: { id: string; text: string; done: boolean }[]
  /** A fight prepared in the tracker for this scene. */
  fightId: string | null
  done: boolean
}

export function createScene(title = ''): Scene {
  return { id: newId(), title: title.trim().slice(0, 100), readAloud: '', notes: '', checklist: [], fightId: null, done: false }
}

/** Move a scene one place up (-1) or down (+1). */
export function moveScene(scenes: Scene[], id: string, dir: -1 | 1): Scene[] {
  const i = scenes.findIndex((s) => s.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= scenes.length) return scenes
  const out = [...scenes]
  ;[out[i], out[j]] = [out[j], out[i]]
  return out
}

export const updateScene = (scenes: Scene[], id: string, patch: Partial<Scene>): Scene[] =>
  scenes.map((s) => (s.id === id ? { ...s, ...patch } : s))

export function addCheck(scene: Scene, text: string): Scene {
  const t = text.trim().slice(0, 200)
  return t ? { ...scene, checklist: [...scene.checklist, { id: newId(), text: t, done: false }] } : scene
}

export const setCheck = (scene: Scene, itemId: string, done: boolean): Scene =>
  ({ ...scene, checklist: scene.checklist.map((c) => (c.id === itemId ? { ...c, done } : c)) })

export const removeCheck = (scene: Scene, itemId: string): Scene =>
  ({ ...scene, checklist: scene.checklist.filter((c) => c.id !== itemId) })

/** "2 / 5 ฉาก" style progress. */
export function progress(scenes: Scene[]): { done: number; total: number } {
  return { done: scenes.filter((s) => s.done).length, total: scenes.length }
}

/**
 * After the session: split the scenes into those played (stay as the record) and those not played
 * (to carry over). Unplayed scenes keep their content; their ticks are cleared for a fresh start.
 */
export function splitUnplayed(scenes: Scene[]): { played: Scene[]; carried: Scene[] } {
  return {
    played: scenes.filter((s) => s.done),
    carried: scenes.filter((s) => !s.done).map((s) => ({ ...s, checklist: s.checklist.map((c) => ({ ...c, done: false })) })),
  }
}

/** All the text in a scene (for search and for finding [[links]]). */
export const sceneTexts = (s: Scene): string[] => [s.title, s.readAloud, s.notes, ...s.checklist.map((c) => c.text)]
