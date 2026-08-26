// ============================================================================
// snap.ts — angle snapping + grid snapping
//
// Pure functions, no React / no store. Easy to reason about and unit-test.
// All angles are in radians. Screen/world y grows downward (SVG convention),
// which doesn't affect snapping since we work symmetrically.
// ============================================================================

import type { AngleMode, GridConfig, Vec2 } from '../types'

const TAU = Math.PI * 2

/** Angular step (radians) for a mode, or null when the mode does not snap. */
function angleStep(mode: AngleMode): number | null {
  switch (mode) {
    case 'tetralinear':
      return Math.PI / 2 // 90°
    case 'hexalinear':
      return Math.PI / 3 // 60°
    case 'octolinear':
      return Math.PI / 4 // 45°
    case 'multilinear':
    case 'curvy':
      return null // free angle — the segment direction is not constrained
  }
}

/**
 * Snap the direction of a vector to the nearest allowed angle for `mode`.
 * Returns the angle in radians. For non-snapping modes returns the raw angle.
 */
export function snapAngle(dx: number, dy: number, mode: AngleMode): number {
  const raw = Math.atan2(dy, dx)
  const step = angleStep(mode)
  if (step == null) return raw
  return Math.round(raw / step) * step
}

/** Normalize an angle into [0, 2π). */
export function normalizeAngle(a: number): number {
  return ((a % TAU) + TAU) % TAU
}

// --- Grid snapping --------------------------------------------------------

function snapSquare(pt: Vec2, cell: number): Vec2 {
  return {
    x: Math.round(pt.x / cell) * cell,
    y: Math.round(pt.y / cell) * cell,
  }
}

/**
 * Hex grid snap via axial coordinates (q, r). Per the brief:
 *   q = (2/3 * x) / size
 *   r = (-1/3 * x + sqrt(3)/3 * y) / size
 * Round in cube space to resolve ties, then convert back.
 * `size` is the hex "radius" — we derive it from cellSize.
 */
function snapHex(pt: Vec2, size: number): Vec2 {
  const SQRT3 = Math.sqrt(3)
  const q = ((2 / 3) * pt.x) / size
  const r = ((-1 / 3) * pt.x + (SQRT3 / 3) * pt.y) / size

  // cube coords
  let cx = q
  let cz = r
  let cy = -cx - cz
  let rx = Math.round(cx)
  let ry = Math.round(cy)
  let rz = Math.round(cz)
  const dx = Math.abs(rx - cx)
  const dy = Math.abs(ry - cy)
  const dz = Math.abs(rz - cz)
  if (dx > dy && dx > dz) rx = -ry - rz
  else if (dy > dz) ry = -rx - rz
  else rz = -rx - ry

  // axial -> pixel
  return {
    x: size * ((3 / 2) * rx),
    y: size * ((SQRT3 / 2) * rx + SQRT3 * rz),
  }
}

/** Snap a point to the nearest grid intersection for the given grid shape. */
export function snapToGrid(pt: Vec2, grid: GridConfig): Vec2 {
  switch (grid.gridShape) {
    case 'hex':
    case 'triangular':
      return snapHex(pt, grid.cellSize)
    case 'square':
    default:
      return snapSquare(pt, grid.cellSize)
  }
}

// --- Endpoint snapping ----------------------------------------------------

/**
 * Given a fixed `start` and a raw cursor `rawEnd`, return the endpoint
 * repositioned so the segment respects the current angle + grid constraints.
 *
 * Strategy:
 *  1. If snapping is off, return the raw point untouched.
 *  2. For angle-snapping modes: snap the direction, project the raw vector's
 *     length onto that direction, place the endpoint there, then grid-snap it.
 *     Because allowed angles are 45°/90° multiples aligned to the square grid,
 *     grid-snapping keeps the point on the snapped axis (both coords round
 *     consistently).
 *  3. For free-angle modes: just grid-snap the raw point.
 */
export function snapEndpoint(start: Vec2, rawEnd: Vec2, grid: GridConfig): Vec2 {
  if (!grid.snapEnabled) return rawEnd

  const step = angleStep(grid.angleMode)
  if (step == null) {
    return snapToGrid(rawEnd, grid)
  }

  const dx = rawEnd.x - start.x
  const dy = rawEnd.y - start.y
  const angle = Math.round(Math.atan2(dy, dx) / step) * step
  const ux = Math.cos(angle)
  const uy = Math.sin(angle)

  // Projection of the raw vector onto the snapped direction (>= 0 because the
  // snapped angle is within step/2 of the raw angle).
  const projLen = Math.max(0, dx * ux + dy * uy)

  const along: Vec2 = { x: start.x + ux * projLen, y: start.y + uy * projLen }
  return snapToGrid(along, grid)
}
