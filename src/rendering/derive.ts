// ============================================================================
// derive.ts — small pure helpers shared by the renderers and tools.
// ============================================================================

import type { Station, Vec2 } from '../types'

/**
 * Resolved render position for a station given the geographic↔schematic
 * condense factor (0 = geoPos, 1 = schPos). Falls back to geoPos when no
 * schematic position has been computed yet.
 */
export function resolveStationPos(st: Station, condenseFactor: number): Vec2 {
  if (!st.schPos || condenseFactor <= 0) return st.geoPos
  const t = condenseFactor >= 1 ? 1 : condenseFactor
  return {
    x: st.geoPos.x + (st.schPos.x - st.geoPos.x) * t,
    y: st.geoPos.y + (st.schPos.y - st.geoPos.y) * t,
  }
}
