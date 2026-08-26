// ============================================================================
// path.ts — turn a polyline of points into an SVG path `d` string with proper
// circular-arc rounded corners. Shared by LineRenderer, offset.ts and the
// draw preview.
//
// `cornerFillet` is factored out so other modules can ask "where does the line
// actually run at this corner?" — e.g. seating a station on the arc rather than
// at the cut-off vertex.
// ============================================================================

import type { Vec2 } from '../types'

function len(a: Vec2, b: Vec2): number {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function num(v: number): string {
  // Trim float noise so exported paths stay compact and diff-friendly.
  return (Math.round(v * 100) / 100).toString()
}

export interface Fillet {
  /** tangent point on the incoming segment */
  tp1: Vec2
  /** tangent point on the outgoing segment */
  tp2: Vec2
  /** effective radius after clamping to available segment length */
  effR: number
  /** SVG arc sweep flag */
  sweep: 0 | 1
  /** point on the arc closest to the vertex — where the line actually runs */
  arcMid: Vec2
}

/**
 * Circular fillet at vertex `v` between segments (prev→v) and (v→next).
 * Returns null when the corner is degenerate or near-collinear (no rounding).
 */
export function cornerFillet(
  prev: Vec2,
  v: Vec2,
  next: Vec2,
  cornerRadius: number,
): Fillet | null {
  const lp = len(v, prev)
  const ln = len(v, next)
  if (lp < 1e-6 || ln < 1e-6) return null

  const d1 = { x: (prev.x - v.x) / lp, y: (prev.y - v.y) / lp }
  const d2 = { x: (next.x - v.x) / ln, y: (next.y - v.y) / ln }

  const dot = Math.max(-1, Math.min(1, d1.x * d2.x + d1.y * d2.y))
  const phi = Math.acos(dot) // interior angle at the vertex
  if (phi > Math.PI - 1e-3 || phi < 1e-3) return null

  const halfTan = Math.tan(phi / 2)
  let t = cornerRadius / halfTan
  const maxT = Math.min(lp, ln) * 0.5
  if (t > maxT) t = maxT
  const effR = t * halfTan

  const tp1 = { x: v.x + d1.x * t, y: v.y + d1.y * t }
  const tp2 = { x: v.x + d2.x * t, y: v.y + d2.y * t }

  // inner bisector: direction from the vertex toward the arc/center
  const bx = d1.x + d2.x
  const by = d1.y + d2.y
  const bl = Math.hypot(bx, by) || 1
  const sinHalf = Math.sin(phi / 2)
  const distToMid = effR * (1 / sinHalf - 1)
  const arcMid = {
    x: v.x + (bx / bl) * distToMid,
    y: v.y + (by / bl) * distToMid,
  }

  const cross = d1.x * d2.y - d1.y * d2.x
  const sweep: 0 | 1 = cross < 0 ? 1 : 0

  return { tp1, tp2, effR, sweep, arcMid }
}

/**
 * Build a rounded-corner path through `pts`. Each interior vertex is replaced
 * by a circular fillet of radius up to `cornerRadius`, automatically reduced
 * when the adjacent segments are too short to fit the full radius.
 */
export function buildRoundedPath(pts: Vec2[], cornerRadius: number): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${num(pts[0].x)} ${num(pts[0].y)}`

  let d = `M ${num(pts[0].x)} ${num(pts[0].y)}`

  for (let i = 1; i < pts.length - 1; i++) {
    const f = cornerFillet(pts[i - 1], pts[i], pts[i + 1], cornerRadius)
    if (!f) {
      d += ` L ${num(pts[i].x)} ${num(pts[i].y)}`
      continue
    }
    d += ` L ${num(f.tp1.x)} ${num(f.tp1.y)}`
    d += ` A ${num(f.effR)} ${num(f.effR)} 0 0 ${f.sweep} ${num(f.tp2.x)} ${num(f.tp2.y)}`
  }

  const last = pts[pts.length - 1]
  d += ` L ${num(last.x)} ${num(last.y)}`
  return d
}
