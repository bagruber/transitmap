// ============================================================================
// SelectTool — click to select a station or line; drag a station to move it
// (grid-snapped). Delete/Backspace removes the current selection.
//
// Hit-testing uses DOM event delegation (data-station-id / data-line-id on the
// rendered groups) rather than geometric tests — accurate and cheap for now.
// geometry/hitTest.ts becomes relevant once we need hit-testing off-DOM.
// ============================================================================

import { useCallback, useRef } from 'react'
import type { MapDocument, Vec2 } from '../../types'
import { useEditorStore } from '../../store/editorStore'
import { useMapStore } from '../../store/mapStore'
import { resolveStationPos } from '../../rendering/derive'
import { snapToGrid } from '../../geometry/snap'
import type { ToolApi } from './types'

function closestId(target: EventTarget | null, attr: string): string | null {
  if (!(target instanceof Element)) return null
  const el = target.closest(`[${attr}]`)
  return el ? el.getAttribute(attr) : null
}

export function useSelectTool(doc: MapDocument): ToolApi {
  const grid = doc.grid
  const select = useEditorStore((s) => s.select)
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const moveStation = useMapStore((s) => s.moveStation)
  const deleteStation = useMapStore((s) => s.deleteStation)
  const deleteLine = useMapStore((s) => s.deleteLine)

  // { stationId, grab offset between pointer and station position }
  const drag = useRef<{ id: string; offset: Vec2 } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent, world: Vec2) => {
      if (e.button !== 0) return
      const stationId = closestId(e.target, 'data-station-id')
      if (stationId) {
        const st = doc.stations[stationId]
        const pos = st ? resolveStationPos(st, doc.condenseFactor) : world
        drag.current = { id: stationId, offset: { x: world.x - pos.x, y: world.y - pos.y } }
        select({ kind: 'station', id: stationId })
        return
      }
      const lineId = closestId(e.target, 'data-line-id')
      if (lineId) {
        select({ kind: 'line', id: lineId })
        return
      }
      clearSelection()
    },
    [doc, select, clearSelection],
  )

  const onPointerMove = useCallback(
    (_e: React.PointerEvent, world: Vec2) => {
      const d = drag.current
      if (!d) return
      const raw = { x: world.x - d.offset.x, y: world.y - d.offset.y }
      moveStation(d.id, grid.snapEnabled ? snapToGrid(raw, grid) : raw)
    },
    [grid, moveStation],
  )

  const onPointerUp = useCallback(() => {
    drag.current = null
  }, [])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== 'Delete' && e.key !== 'Backspace') return
      const sel = useEditorStore.getState().selection
      if (sel.kind === 'station' && sel.id) deleteStation(sel.id)
      else if (sel.kind === 'line' && sel.id) deleteLine(sel.id)
      clearSelection()
    },
    [deleteStation, deleteLine, clearSelection],
  )

  return { onPointerDown, onPointerMove, onPointerUp, onKeyDown }
}
