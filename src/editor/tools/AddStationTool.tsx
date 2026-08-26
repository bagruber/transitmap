// ============================================================================
// AddStationTool — drop stations on the grid. Click empty grid to place a new
// station (snapped); click an existing one to select it. Stations are the
// first-class objects lines are later built from.
// ============================================================================

import { useCallback } from 'react'
import type { MapDocument, Vec2 } from '../../types'
import { useEditorStore } from '../../store/editorStore'
import { useMapStore } from '../../store/mapStore'
import { snapToGrid } from '../../geometry/snap'
import type { ToolApi } from './types'

function closestId(target: EventTarget | null, attr: string): string | null {
  if (!(target instanceof Element)) return null
  const el = target.closest(`[${attr}]`)
  return el ? el.getAttribute(attr) : null
}

export function useAddStationTool(doc: MapDocument): ToolApi {
  const grid = doc.grid
  const addStation = useMapStore((s) => s.addStation)
  const select = useEditorStore((s) => s.select)
  const firePulse = useEditorStore((s) => s.firePulse)
  const setSnapIndicator = useEditorStore((s) => s.setSnapIndicator)

  const onPointerDown = useCallback(
    (e: React.PointerEvent, world: Vec2) => {
      if (e.button !== 0) return
      const existing = closestId(e.target, 'data-station-id')
      if (existing) {
        select({ kind: 'station', id: existing })
        firePulse(existing)
        return
      }
      const p = grid.snapEnabled ? snapToGrid(world, grid) : world
      const id = addStation(p)
      select({ kind: 'station', id })
      firePulse(id)
    },
    [grid, addStation, select, firePulse],
  )

  const onPointerMove = useCallback(
    (_e: React.PointerEvent, world: Vec2) => {
      setSnapIndicator(grid.snapEnabled ? snapToGrid(world, grid) : world)
    },
    [grid, setSnapIndicator],
  )

  return { onPointerDown, onPointerMove }
}
