// Pull-to-refresh math (see PullToRefresh.tsx).

/** How far (px) the indicator must come down before letting go reloads. */
export const PULL_TRIGGER = 70
const PULL_MAX = 110

/** The finger moved `dy` px down: the indicator follows at half speed (feels like resistance), capped. */
export function pullAmount(dy: number): number {
  return Math.min(PULL_MAX, Math.max(0, dy * 0.5))
}
