// Lets the Turn Card and the "/" key ask the DM panel (side panel on the fight screen) to show a tab.
export type PanelRequest = 'stats' | 'lookup'

type Listener = (tab: PanelRequest) => void
const listeners = new Set<Listener>()

export function requestPanelTab(tab: PanelRequest): void {
  for (const l of listeners) l(tab)
}

/** The panel subscribes; returns the unsubscribe function (for useEffect). */
export function onPanelRequest(l: Listener): () => void {
  listeners.add(l)
  return () => listeners.delete(l)
}
