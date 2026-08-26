// ============================================================================
// Transit Map Editor — shared types
// ALL cross-module types live here. Keep this file dependency-free.
// ============================================================================

export type Vec2 = { x: number; y: number }

// --- Grid / angle modes ---------------------------------------------------

export type AngleMode =
  | 'tetralinear' // 90°  — square grid
  | 'hexalinear' //  60°  — triangular/hex grid
  | 'octolinear' //  45°  — square grid (London tube default)
  | 'multilinear' // any  — free-angle, no snap
  | 'curvy' //       bezier handles, grid still active

export type GridShape = 'square' | 'hex' | 'triangular'

export interface GridConfig {
  angleMode: AngleMode
  gridShape: GridShape // derived from angleMode but overridable
  cellSize: number // px at 1:1
  visible: boolean
  snapEnabled: boolean
}

// --- Stations -------------------------------------------------------------

export type StationSymbolType =
  | 'dot' //         filled circle, small
  | 'circle' //      open circle
  | 'capsule' //     elongated pill, aligns perpendicular to line
  | 'interchange' // double-dot or ring, used at multi-line junctions
  | 'ring' //        large open ring

export type LabelAnchor = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface Station {
  id: string
  name: string
  geoPos: Vec2 //       geographic / freehand position
  schPos?: Vec2 //      condensed/schematic position (computed or manually adjusted)
  symbolType: StationSymbolType
  labelAnchor: LabelAnchor
  labelOffset: Vec2 //  additional px nudge from anchor
  // which line IDs pass through this station is computed, not stored
}

// --- Lines ----------------------------------------------------------------

export type StrokeStyleType =
  | 'solid'
  | 'double' //   two parallel strokes with gap — suburban rail look
  | 'dashed'
  | 'dotted'
  | 'striped' //  diagonal stripe fill via SVG <pattern>
  | 'cased' //    outline in caseColor, fill in line color
  | 'labeled' //  line shortcode repeated along path (e.g. "M3 M3 M3")

export interface StrokeStyle {
  type: StrokeStyleType
  dashArray?: string // for dashed/dotted, raw SVG dasharray value
  gap?: number //       for double stroke, gap between the two strokes
  caseColor?: string // for cased style
  stripeAngle?: number // for striped, degrees
}

export type LineCategory = 'metro' | 'tram' | 'bus' | 'train' | 'ferry' | 'cable'

export type Elevation = 'surface' | 'elevated' | 'underground' | 'construction'

export interface TransitLine {
  id: string
  name: string
  shortCode?: string //  "U6", "S1", "M3" etc — used for labeled style
  color: string //       hex
  width: number //       px — train 8, tram 6, bus 4 as defaults
  category: LineCategory
  strokeStyle: StrokeStyle
  elevation: Elevation
  cornerRadius: number // base radius for turns; adjusted per parallel offset
  stops: string[] //      ordered list of REAL station IDs the line serves.
  //                      Geometry between consecutive stops is auto-routed under
  //                      the grid's angle rules (see geometry/route.ts), and
  //                      parallel offset is derived automatically per shared
  //                      segment (see rendering/network.ts).
  zIndex: number
}

// --- Routing --------------------------------------------------------------
// How the auto-router connects two consecutive stops. Stored per undirected
// station-pair on the document (doc.routing) so a segment shared by several
// lines has ONE centreline shape that the parallel lines offset around.
// This is the hook for future drag-to-tweak manipulation.

export type RouteVariant =
  | 'auto'
  | 'diag-first' //     octolinear: diagonal leg first, then orthogonal
  | 'straight-first' // octolinear: orthogonal leg first, then diagonal
  | 'hv' //             tetralinear: horizontal then vertical
  | 'vh' //             tetralinear: vertical then horizontal
  | 'direct' //         straight line, ignore angle rules

// --- Geographic features (rivers, parks, etc.) ----------------------------

export type FeatureType = 'river' | 'park' | 'border' | 'coastline' | 'water'

export interface GeographicFeature {
  id: string
  type: FeatureType
  strokeStyle: StrokeStyle
  strokeColor: string
  strokeWidth: number
  fillColor?: string
  points: Vec2[]
  closed: boolean
}

// --- Document root --------------------------------------------------------

export interface MapDocument {
  version: number //       schema version for future migration
  id: string
  title: string
  stations: Record<string, Station>
  lines: Record<string, TransitLine>
  features: Record<string, GeographicFeature>
  lineOrder: string[] //   z-order for lines
  routing?: Record<string, RouteVariant> // per undirected station-pair override
  grid: GridConfig
  viewport: { w: number; h: number }
  background?: {
    dataUrl: string //     base64 PNG/JPG
    opacity: number //     0.05–0.4 typical
    transform: { x: number; y: number; scale: number; rotation: number }
  }
  condenseFactor: number // 0 = geographic positions, 1 = schematic positions
  typography: {
    fontFamily: string //  default 'Inter'
    stationFontSize: number
    stationFontWeight: number
    lineLabelFontSize: number
  }
}

// --- Editor / interaction (not persisted in the document) -----------------

export type ToolMode = 'select' | 'add-station' | 'connect-line' | 'draw-feature'

export type EditorPhase =
  | 'idle'
  | 'drawing'
  | 'selected-station'
  | 'selected-line'
  | 'dragging-station'
  | 'dragging-waypoint'
  | 'panning'

export interface Selection {
  kind: 'station' | 'line' | null
  id: string | null
}

/** Pan/zoom transform mapping document (world) coords -> screen coords. */
export interface ViewTransform {
  /** screen px per world unit */
  scale: number
  /** screen-space translation of world origin */
  tx: number
  ty: number
}
