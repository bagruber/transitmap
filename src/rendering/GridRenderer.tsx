// ============================================================================
// GridRenderer.tsx — draws the snapping grid in world coordinates.
//
// Rendered inside the view-transformed <g>, so it draws in world units. We only
// emit lines covering the visible world rect to keep the node count bounded.
// pointer-events: none so it never intercepts clicks.
// ============================================================================

import type { GridConfig } from '../types'

export interface WorldBounds {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

interface Props {
  grid: GridConfig
  bounds: WorldBounds
  /** current zoom scale, so stroke width can stay ~constant on screen */
  scale: number
}

const MAJOR_EVERY = 5

export function GridRenderer({ grid, bounds, scale }: Props) {
  if (!grid.visible) return null
  // Only the square grid is implemented for now (hex/triangular come later).
  if (grid.gridShape !== 'square') return null

  const { cellSize } = grid
  const x0 = Math.floor(bounds.minX / cellSize)
  const x1 = Math.ceil(bounds.maxX / cellSize)
  const y0 = Math.floor(bounds.minY / cellSize)
  const y1 = Math.ceil(bounds.maxY / cellSize)

  // Guard against pathological zoom-out producing millions of lines.
  if (x1 - x0 > 1000 || y1 - y0 > 1000) return null

  const minor: string[] = []
  const major: string[] = []

  for (let i = x0; i <= x1; i++) {
    const x = i * cellSize
    const seg = `M ${x} ${bounds.minY} L ${x} ${bounds.maxY}`
    ;(i % MAJOR_EVERY === 0 ? major : minor).push(seg)
  }
  for (let j = y0; j <= y1; j++) {
    const y = j * cellSize
    const seg = `M ${bounds.minX} ${y} L ${bounds.maxX} ${y}`
    ;(j % MAJOR_EVERY === 0 ? major : minor).push(seg)
  }

  const minorW = 1 / scale
  const majorW = 1.5 / scale

  return (
    <g id="grid" style={{ pointerEvents: 'none' }}>
      <path d={minor.join(' ')} stroke="#e2e8f0" strokeWidth={minorW} fill="none" />
      <path d={major.join(' ')} stroke="#cbd5e1" strokeWidth={majorW} fill="none" />
    </g>
  )
}
