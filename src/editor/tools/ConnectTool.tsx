// ============================================================================
// ConnectTool — assemble a line by clicking existing stations in order.
//
// Click a station to anchor it (with a pulse), click more to chain them,
// double-click / Enter to finish, Escape to cancel. Geometry between stops is
// auto-routed under the grid's angle rules; a dashed ghost previews it live.
// Empty-grid clicks are ignored — place stations first with the Add tool.
// ============================================================================

import { useCallback } from 'react'
import type { MapDocument, Vec2 } from '../../types'
import { useEditorStore } from '../../store/editorStore'
import { useMapStore } from '../../store/mapStore'
import { resolveStationPos } from '../../rendering/derive'
import { edgePolyline } from '../../geometry/route'
import { buildRoundedPath } from '../../geometry/path'
import type { ToolApi } from './types'

function closestId(target: EventTarget | null, attr: string): string | null {
  if (!(target instanceof Element)) return null
  const el = target.closest(`[${attr}]`)
  return el ? el.getAttribute(attr) : null
}

export function useConnectTool(doc: MapDocument): ToolApi {
  const startLineDraft = useEditorStore((s) => s.startLineDraft)
  const appendStop = useEditorStore((s) => s.appendStop)
  const setDraftCursor = useEditorStore((s) => s.setDraftCursor)
  const clearDraft = useEditorStore((s) => s.clearDraft)
  const setHover = useEditorStore((s) => s.setHover)
  const addLine = useMapStore((s) => s.addLine)

  const draftStops = useEditorStore((s) => s.draftStops)
  const draftCursor = useEditorStore((s) => s.draftCursor)
  const pulse = useEditorStore((s) => s.pulse)

  const finish = useCallback(() => {
    const stops = useEditorStore.getState().draftStops
    if (stops.length >= 2) addLine(stops)
    clearDraft()
  }, [addLine, clearDraft])

  const onPointerDown = useCallback(
    (e: React.PointerEvent, _world: Vec2) => {
      if (e.button !== 0) return
      const stationId = closestId(e.target, 'data-station-id')
      if (!stationId) return // stations only
      if (useEditorStore.getState().draftStops.length === 0) startLineDraft(stationId)
      else appendStop(stationId)
    },
    [startLineDraft, appendStop],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent, world: Vec2) => {
      setDraftCursor(world)
      const stationId = closestId(e.target, 'data-station-id')
      setHover(stationId ? { kind: 'station', id: stationId } : { kind: null, id: null })
    },
    [setDraftCursor, setHover],
  )

  const onDoubleClick = useCallback(() => finish(), [finish])

  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Enter') finish()
      else if (e.key === 'Escape') clearDraft()
    },
    [finish, clearDraft],
  )

  // --- overlay: ghost routed path + committed markers + anchor pulse --------
  const stopPts = draftStops
    .map((id) => {
      const st = doc.stations[id]
      return st ? resolveStationPos(st, doc.condenseFactor) : null
    })
    .filter((p): p is Vec2 => p !== null)

  // tentative terminal point: a hovered station snaps the ghost to it
  const hover = useEditorStore.getState().hover
  const hoverPt =
    hover.kind === 'station' && hover.id && !draftStops.includes(hover.id)
      ? (() => {
          const st = doc.stations[hover.id!]
          return st ? resolveStationPos(st, doc.condenseFactor) : null
        })()
      : null
  const terminal = hoverPt ?? draftCursor

  const ghostPts: Vec2[] = []
  const chain = terminal ? [...stopPts, terminal] : stopPts
  for (let i = 0; i < chain.length - 1; i++) {
    const seg = edgePolyline(chain[i], chain[i + 1], doc.grid.angleMode)
    if (i > 0) seg.shift() // avoid duplicating the shared vertex
    ghostPts.push(...seg)
  }
  const ghostD = ghostPts.length >= 2 ? buildRoundedPath(ghostPts, doc.grid.cellSize) : ''

  const pulsePt =
    pulse && doc.stations[pulse.id]
      ? resolveStationPos(doc.stations[pulse.id], doc.condenseFactor)
      : null

  const overlay = (
    <g style={{ pointerEvents: 'none' }}>
      {ghostD && (
        <path
          d={ghostD}
          fill="none"
          stroke="#2563eb"
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2 7"
          opacity={0.85}
        />
      )}
      {stopPts.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r={7}
          fill="none"
          stroke="#2563eb"
          strokeWidth={2}
        />
      ))}
      {pulsePt && (
        <circle key={pulse!.nonce} cx={pulsePt.x} cy={pulsePt.y} r={7} fill="none" stroke="#2563eb" strokeWidth={2.5}>
          <animate attributeName="r" from="7" to="20" dur="0.5s" fill="freeze" />
          <animate attributeName="opacity" from="0.9" to="0" dur="0.5s" fill="freeze" />
        </circle>
      )}
    </g>
  )

  return { onPointerDown, onPointerMove, onDoubleClick, onKeyDown, overlay }
}
