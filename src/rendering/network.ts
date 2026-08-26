// ============================================================================
// network.ts — derive all render geometry from the station graph.
//
// This is where the "stations first, lines derived" model pays off:
//   1. Each line is an ordered list of stops. Between consecutive stops we
//      auto-route an elbow under the grid angle rules (route.ts).
//   2. A segment (undirected station pair) shared by several lines forms a
//      BUNDLE; its members are offset in parallel on exactly that stretch and
//      re-centre where they split — per-shared-segment offsetting.
//   3. Each station's symbol adapts to what meets it: a capsule spanning a
//      parallel bundle, an interchange ring at a crossing, else its own symbol.
//
// Everything downstream (LineRenderer, StationRenderer) just consumes this.
// ============================================================================

import type { MapDocument, StationSymbolType, Vec2 } from '../types'
import { buildRoundedPath } from '../geometry/path'
import { offsetVertices } from '../geometry/offset'
import { edgePolyline } from '../geometry/route'
import { resolveStationPos } from './derive'

/** centre-to-centre spacing padding added to the widest line in a bundle */
const BUNDLE_GAP = 2

export interface StationLayout {
  id: string
  pos: Vec2
  symbol: StationSymbolType
  /** radius for circle/ring/interchange; half-thickness for capsule */
  size: number
  /** capsule long-axis length */
  length: number
  /** capsule orientation (radians) */
  angle: number
  lineCount: number
}

export interface NetworkLayout {
  /** composed SVG path `d` per line (concatenated offset sub-paths) */
  lineDs: Record<string, string>
  stations: Record<string, StationLayout>
}

interface Incident {
  dir: Vec2 // unit direction leaving the station along this edge (unoffset)
  offset: number // signed offset of this line within its bundle
  width: number
}

function key(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`
}
function unit(a: Vec2, b: Vec2): Vec2 {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const l = Math.hypot(dx, dy) || 1
  return { x: dx / l, y: dy / l }
}

export function layoutNetwork(doc: MapDocument): NetworkLayout {
  const cf = doc.condenseFactor
  const posOf = (id: string): Vec2 | null => {
    const st = doc.stations[id]
    return st ? resolveStationPos(st, cf) : null
  }

  // --- collect edges, grouped into bundles by undirected station pair -------
  interface EdgeMember {
    lineId: string
    aId: string
    bId: string
    order: number // lineOrder index, for stable stacking
  }
  const bundles = new Map<string, EdgeMember[]>()
  doc.lineOrder.forEach((lineId, order) => {
    const line = doc.lines[lineId]
    if (!line) return
    for (let i = 0; i < line.stops.length - 1; i++) {
      const aId = line.stops[i]
      const bId = line.stops[i + 1]
      if (aId === bId || !doc.stations[aId] || !doc.stations[bId]) continue
      const k = key(aId, bId)
      if (!bundles.has(k)) bundles.set(k, [])
      bundles.get(k)!.push({ lineId, aId, bId, order })
    }
  })

  const lineDs: Record<string, string> = {}
  const incidents: Record<string, Incident[]> = {}
  const addIncident = (stId: string, inc: Incident) => {
    ;(incidents[stId] ??= []).push(inc)
  }

  // --- per bundle: route the shared centreline once, offset each member -----
  for (const [k, membersRaw] of bundles) {
    const [canonA, canonB] = k.split('|')
    const pa = posOf(canonA)
    const pb = posOf(canonB)
    if (!pa || !pb) continue

    const variant = doc.routing?.[k] ?? 'auto'
    const centre = edgePolyline(pa, pb, doc.grid.angleMode, variant)

    // stable stacking order, then centre the bundle around index 0
    const members = [...membersRaw].sort((m1, m2) => m1.order - m2.order)
    const n = members.length
    const maxWidth = Math.max(...members.map((m) => doc.lines[m.lineId]?.width ?? 6))
    const spacing = maxWidth + BUNDLE_GAP

    // directions leaving each endpoint along the (unoffset) centreline
    const dirA = unit(centre[0], centre[1])
    const dirB = unit(centre[centre.length - 1], centre[centre.length - 2])

    members.forEach((m, p) => {
      const line = doc.lines[m.lineId]
      if (!line) return
      const signedOffset = (p - (n - 1) / 2) * spacing
      const pts = offsetVertices(centre, signedOffset)
      const d = buildRoundedPath(pts, line.cornerRadius)
      lineDs[m.lineId] = lineDs[m.lineId] ? `${lineDs[m.lineId]} ${d}` : d

      // record incidence at both real endpoints (canonA / canonB)
      addIncident(canonA, { dir: dirA, offset: signedOffset, width: line.width })
      addIncident(canonB, { dir: dirB, offset: signedOffset, width: line.width })
    })
  }

  // --- station symbols adapt to what meets them ----------------------------
  const stations: Record<string, StationLayout> = {}
  for (const st of Object.values(doc.stations)) {
    const pos = resolveStationPos(st, cf)
    const inc = incidents[st.id] ?? []
    const lineCount = inc.length // incident edge-ends ≈ line touches

    let layout: StationLayout = {
      id: st.id,
      pos,
      symbol: st.name === '' && lineCount === 0 ? 'dot' : st.symbolType,
      size: st.symbolType === 'dot' ? 3 : 5,
      length: 0,
      angle: 0,
      lineCount,
    }

    if (inc.length > 0) {
      const maxWidth = Math.max(...inc.map((e) => e.width))
      const offsets = inc.map((e) => e.offset)
      const span = Math.max(...offsets) - Math.min(...offsets)
      // collinear? all incident directions share one orientation (mod 180°)
      const ref = inc[0].dir
      const through = inc.every((e) => Math.abs(e.dir.x * ref.x + e.dir.y * ref.y) > 0.9)

      if (through && span > 0.5) {
        // parallel bundle passing through → capsule across the bundle width
        layout = {
          ...layout,
          symbol: 'capsule',
          size: (maxWidth + 4) / 2,
          length: span + maxWidth,
          angle: Math.atan2(ref.y, ref.x) + Math.PI / 2,
        }
      } else if (new Set(inc.map((e) => e.dir.x + ',' + e.dir.y)).size >= 2 && lineCount >= 2) {
        // lines meet from different directions → interchange
        layout = {
          ...layout,
          symbol: 'interchange',
          size: maxWidth * 0.75 + 3 + span / 2,
        }
      } else {
        // single line through → keep its own symbol, sized to the stroke
        layout = { ...layout, size: Math.max(layout.size, maxWidth * 0.7) }
      }
    }

    stations[st.id] = layout
  }

  return { lineDs, stations }
}
