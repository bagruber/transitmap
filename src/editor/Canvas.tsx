// ============================================================================
// Canvas.tsx — the SVG root and central event dispatcher.
//
// Layer order matches the brief's rendering pipeline:
//   <g transform=view> { grid, features, lines, stations, editor-overlay }
// Everything inside the transformed <g> is drawn in world coordinates.
// ============================================================================

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { MapDocument, Vec2 } from '../types'
import { screenToWorld, useEditorStore } from '../store/editorStore'
import { GridRenderer } from '../rendering/GridRenderer'
import { LineRenderer } from '../rendering/LineRenderer'
import { StationRenderer } from '../rendering/StationRenderer'
import { layoutNetwork } from '../rendering/network'
import { useAddStationTool } from './tools/AddStationTool'
import { useConnectTool } from './tools/ConnectTool'
import { useSelectTool } from './tools/SelectTool'
import type { ToolApi } from './tools/types'

interface Props {
  doc: MapDocument
}

const EMPTY_TOOL: ToolApi = {}

export function Canvas({ doc }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })

  const tool = useEditorStore((s) => s.tool)
  const view = useEditorStore((s) => s.view)
  const selection = useEditorStore((s) => s.selection)
  const hover = useEditorStore((s) => s.hover)
  const snapIndicator = useEditorStore((s) => s.snapIndicator)
  const panBy = useEditorStore((s) => s.panBy)
  const zoomAt = useEditorStore((s) => s.zoomAt)

  // Always call every tool hook (rules of hooks); pick the active one.
  const addTool = useAddStationTool(doc)
  const connectTool = useConnectTool(doc)
  const selectTool = useSelectTool(doc)
  const api: ToolApi =
    tool === 'add-station'
      ? addTool
      : tool === 'connect-line'
        ? connectTool
        : tool === 'select'
          ? selectTool
          : EMPTY_TOOL

  // --- size tracking ------------------------------------------------------
  useLayoutEffect(() => {
    const el = svgRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      const r = el.getBoundingClientRect()
      setSize({ w: r.width, h: r.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // --- pointer → world ----------------------------------------------------
  const toWorld = (e: { clientX: number; clientY: number }): Vec2 => {
    const rect = svgRef.current!.getBoundingClientRect()
    return screenToWorld(
      { x: e.clientX - rect.left, y: e.clientY - rect.top },
      useEditorStore.getState().view,
    )
  }

  // --- panning ------------------------------------------------------------
  const panRef = useRef<{ x: number; y: number } | null>(null)
  const spaceHeld = useRef(false)

  const isPanGesture = (e: React.PointerEvent) =>
    e.button === 1 || (e.button === 0 && spaceHeld.current)

  const onPointerDown = (e: React.PointerEvent) => {
    svgRef.current?.setPointerCapture(e.pointerId)
    if (isPanGesture(e)) {
      panRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    api.onPointerDown?.(e, toWorld(e))
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (panRef.current) {
      panBy(e.clientX - panRef.current.x, e.clientY - panRef.current.y)
      panRef.current = { x: e.clientX, y: e.clientY }
      return
    }
    api.onPointerMove?.(e, toWorld(e))
  }

  const onPointerUp = (e: React.PointerEvent) => {
    svgRef.current?.releasePointerCapture(e.pointerId)
    if (panRef.current) {
      panRef.current = null
      return
    }
    api.onPointerUp?.(e, toWorld(e))
  }

  const onDoubleClick = (e: React.MouseEvent) => {
    api.onDoubleClick?.(e, toWorld(e))
  }

  // --- wheel zoom (native listener so we can preventDefault) --------------
  useEffect(() => {
    const el = svgRef.current
    if (!el) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const factor = Math.exp(-e.deltaY * 0.0015)
      zoomAt(e.clientX - rect.left, e.clientY - rect.top, factor)
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [zoomAt])

  // --- keyboard (space pan + active tool shortcuts) -----------------------
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = true
      api.onKeyDown?.(e)
    }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') spaceHeld.current = false
    }
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
    }
  }, [api])

  // --- visible world bounds (for the grid) --------------------------------
  const tl = screenToWorld({ x: 0, y: 0 }, view)
  const br = screenToWorld({ x: size.w, y: size.h }, view)
  const bounds = { minX: tl.x, minY: tl.y, maxX: br.x, maxY: br.y }

  const orderedLines = doc.lineOrder
    .map((id) => doc.lines[id])
    .filter((l): l is NonNullable<typeof l> => Boolean(l))

  // Derive all geometry: routed + bundled line paths and adaptive station layout.
  const layout = useMemo(() => layoutNetwork(doc), [doc])

  return (
    <svg
      ref={svgRef}
      id="map-root"
      width="100%"
      height="100%"
      className="block h-full w-full bg-white"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={onDoubleClick}
    >
      <g transform={`translate(${view.tx} ${view.ty}) scale(${view.scale})`}>
        <GridRenderer grid={doc.grid} bounds={bounds} scale={view.scale} />

        {/* features layer reserved (rivers/parks) — Phase 5 */}
        <g id="features" />

        <g id="lines">
          {orderedLines.map((line) => (
            <LineRenderer
              key={line.id}
              line={line}
              d={layout.lineDs[line.id] ?? ''}
              emphasis={
                selection.kind === 'line' && selection.id === line.id
                  ? 'selected'
                  : hover.kind === 'line' && hover.id === line.id
                    ? 'hover'
                    : 'none'
              }
            />
          ))}
        </g>

        <g id="stations">
          {Object.values(doc.stations).map((st) => {
            const stLayout = layout.stations[st.id]
            if (!stLayout) return null
            return (
              <StationRenderer
                key={st.id}
                station={st}
                layout={stLayout}
                typography={doc.typography}
                emphasis={
                  selection.kind === 'station' && selection.id === st.id
                    ? 'selected'
                    : hover.kind === 'station' && hover.id === st.id
                      ? 'hover'
                      : 'none'
                }
              />
            )
          })}
        </g>

        {/* editor overlay — STRIPPED from export */}
        <g id="editor-overlay" style={{ pointerEvents: 'none' }}>
          {api.overlay}
          {snapIndicator && (
            <circle
              cx={snapIndicator.x}
              cy={snapIndicator.y}
              r={4 / view.scale + 2}
              fill="none"
              stroke="#2563eb"
              strokeWidth={1.5 / view.scale}
            />
          )}
        </g>
      </g>
    </svg>
  )
}
