// ============================================================================
// route.ts — semi-automatic routing between two consecutive stops.
//
// Given two grid-placed stations, produce the intermediate bend point(s) so the
// connecting polyline obeys the current angle mode. Octolinear and tetralinear
// are handled precisely; other modes fall back to a direct segment for now.
//
// Each segment generally has two "shortest" variants (which leg comes first).
// The default is deterministic; the stored RouteVariant lets the user flip it
// later by dragging. This is the manipulation hook the brief anticipates.
// ============================================================================

import type { AngleMode, RouteVariant, Vec2 } from '../types'

const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0)

/** Resolve 'auto' to the default concrete variant for a mode. */
function resolveVariant(mode: AngleMode, v: RouteVariant): RouteVariant {
  if (v !== 'auto') return v
  switch (mode) {
    case 'octolinear':
      return 'diag-first'
    case 'tetralinear':
      return 'hv'
    default:
      return 'direct'
  }
}

/**
 * Intermediate bend points between `a` and `b` (endpoints excluded) so every
 * leg is a legal angle for `mode`. Returns [] when the direct segment is
 * already legal (pure axis / pure diagonal) or the mode doesn't constrain.
 */
export function routeBetween(
  a: Vec2,
  b: Vec2,
  mode: AngleMode,
  variant: RouteVariant = 'auto',
): Vec2[] {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const adx = Math.abs(dx)
  const ady = Math.abs(dy)
  const sx = sign(dx)
  const sy = sign(dy)
  if (adx < 1e-9 && ady < 1e-9) return []

  const v = resolveVariant(mode, variant)

  if (mode === 'tetralinear' || v === 'hv' || v === 'vh') {
    if (adx < 1e-9 || ady < 1e-9) return [] // already axis-aligned
    return v === 'vh' ? [{ x: a.x, y: b.y }] : [{ x: b.x, y: a.y }]
  }

  if (mode === 'octolinear' || v === 'diag-first' || v === 'straight-first') {
    // already a legal 45°/90° line?
    if (adx < 1e-9 || ady < 1e-9 || Math.abs(adx - ady) < 1e-9) return []
    const diag = Math.min(adx, ady)
    const horizontalExtra = adx > ady
    if (v === 'straight-first') {
      return horizontalExtra
        ? [{ x: b.x - sx * diag, y: a.y }] // straight along x, then diagonal
        : [{ x: a.x, y: b.y - sy * diag }] // straight along y, then diagonal
    }
    // diag-first (default)
    return horizontalExtra
      ? [{ x: a.x + sx * diag, y: b.y }] // diagonal, then straight along x
      : [{ x: b.x, y: a.y + sy * diag }] // diagonal, then straight along y
  }

  // multilinear / curvy / hexalinear (unimplemented) → direct
  return []
}

/** Full routed polyline for one edge, endpoints included. */
export function edgePolyline(
  a: Vec2,
  b: Vec2,
  mode: AngleMode,
  variant: RouteVariant = 'auto',
): Vec2[] {
  return [a, ...routeBetween(a, b, mode, variant), b]
}
