// ============================================================================
// offset.ts — parallel-offset polyline with arc corners.
//
// Shifts every segment perpendicularly by `offset`, re-intersects neighbouring
// shifted segments to find the offset vertices, then rounds them. Used for the
// `double` stroke style and for parallel line groups (lines sharing a
// parallelGroupId, offset by parallelIndex).
//
// Known limitation (see brief): on very tight inner curves the offset vertex
// can overshoot; buildRoundedPath clamps the fillet so the corner degrades to a
// miter rather than inverting. Good enough until the parallel-group UI lands.
// ============================================================================

import type { Vec2 } from '../types'
import { buildRoundedPath } from './path'

/** Unit direction from a to b, or null for a zero-length segment. */
function unit(a: Vec2, b: Vec2): Vec2 | null {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy)
  if (l < 1e-9) return null
  return { x: dx / l, y: dy / l }
}

/** Left-hand normal of a direction (rotate -90° in SVG y-down coords). */
function normal(d: Vec2): Vec2 {
  return { x: d.y, y: -d.x }
}

/**
 * Intersect line (p1, dir d1) with line (p2, dir d2). Returns null if parallel.
 */
function intersect(p1: Vec2, d1: Vec2, p2: Vec2, d2: Vec2): Vec2 | null {
  const denom = d1.x * d2.y - d1.y * d2.x
  if (Math.abs(denom) < 1e-9) return null
  const dx = p2.x - p1.x
  const dy = p2.y - p1.y
  const a = (dx * d2.y - dy * d2.x) / denom
  return { x: p1.x + a * d1.x, y: p1.y + a * d1.y }
}

/**
 * Vertices of the polyline offset perpendicularly by `offset`
 * (positive = left-hand side of travel direction). Corners are placed at the
 * intersection of the shifted neighbouring segments.
 */
export function offsetVertices(pts: Vec2[], offset: number): Vec2[] {
  if (offset === 0 || pts.length < 2) return pts.slice()

  // Per-segment direction + shifted start point.
  const dirs: Vec2[] = []
  const starts: Vec2[] = [] // shifted P_i for segment i
  for (let i = 0; i < pts.length - 1; i++) {
    const d = unit(pts[i], pts[i + 1])
    if (!d) {
      // collapse degenerate segment: reuse previous direction if any
      dirs.push(dirs[i - 1] ?? { x: 1, y: 0 })
    } else {
      dirs.push(d)
    }
    const nrm = normal(dirs[i])
    starts.push({ x: pts[i].x + nrm.x * offset, y: pts[i].y + nrm.y * offset })
  }

  const out: Vec2[] = []
  const nSeg = dirs.length

  // first vertex = shifted start of first segment
  out.push(starts[0])

  // interior vertices = intersection of shifted seg (i-1) and seg (i)
  for (let i = 1; i < nSeg; i++) {
    const hit = intersect(starts[i - 1], dirs[i - 1], starts[i], dirs[i])
    if (hit) out.push(hit)
    else out.push(starts[i]) // parallel/collinear → just use the shifted vertex
  }

  // last vertex = shifted end of last segment
  const lastDir = dirs[nSeg - 1]
  const lastNrm = normal(lastDir)
  const lastPt = pts[pts.length - 1]
  out.push({ x: lastPt.x + lastNrm.x * offset, y: lastPt.y + lastNrm.y * offset })

  return out
}

/** Offset polyline as an SVG path `d` string with rounded corners. */
export function offsetPolyline(pts: Vec2[], offset: number, cornerRadius: number): string {
  return buildRoundedPath(offsetVertices(pts, offset), cornerRadius)
}
