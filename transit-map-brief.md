# Transit Map Editor — Engineering Brief
## For Claude Code / VS Code handoff

---

## What we're building

A web-based SVG vector editor for drawing schematic public transit maps — think London Tube, Berlin U-Bahn style. Manual drag-and-drop editing with grid snapping. Runs entirely static (GitHub Pages). No backend.

Reference design system: Roberta Aehnelt's "Transit Maps Design Study" series (see `/reference-images` if added to repo).

---

## Stack

| Concern | Choice | Reason |
|---|---|---|
| Framework | React 19 + Vite 6 | existing familiarity, fast HMR |
| Canvas | Pure SVG in DOM | free export, native events, declarative styling |
| State | Zustand 5 | simple, persistable to localStorage |
| Styling | Tailwind 4 | UI chrome only, nothing inside SVG |
| Font | Inter + Inter Condensed (Google Fonts) | open, clean, transit-appropriate |
| PDF export | jsPDF + svg2pdf.js | client-side only |
| PNG export | Native canvas via `drawImage(svgBlob)` | no library needed |
| SVG export | Serialize DOM node, strip editor layers | trivial |

**No diagram library. No canvas library. Own all geometry.**

---

## File structure

```
transit-map/
├── index.html
├── vite.config.ts          # base: '/transit-map/' for GH Pages deploy
├── src/
│   ├── types/
│   │   └── index.ts        # ALL shared types live here
│   ├── store/
│   │   ├── mapStore.ts     # document state, persisted to localStorage
│   │   └── editorStore.ts  # tool mode, selection, hover — NOT persisted
│   ├── geometry/
│   │   ├── snap.ts         # angle snap + grid snap
│   │   ├── offset.ts       # parallel polyline offset with arc corners ← hardest file
│   │   ├── condense.ts     # schematic position spring relaxation
│   │   └── hitTest.ts      # click detection on lines/stations
│   ├── rendering/
│   │   ├── GridRenderer.tsx
│   │   ├── FeatureRenderer.tsx   # rivers, parks, borders
│   │   ├── LineRenderer.tsx      # core rendering + offset grouping
│   │   ├── StationRenderer.tsx   # symbols + label placement
│   │   └── patterns.ts           # SVG <defs> patterns for line styles
│   ├── editor/
│   │   ├── Canvas.tsx            # SVG root, event dispatch
│   │   └── tools/
│   │       ├── SelectTool.tsx
│   │       ├── DrawLineTool.tsx
│   │       ├── AddStationTool.tsx
│   │       └── DrawFeatureTool.tsx
│   ├── panels/
│   │   ├── LinePanel.tsx
│   │   ├── StationPanel.tsx
│   │   ├── GridPanel.tsx
│   │   └── MapSettingsPanel.tsx
│   ├── export/
│   │   ├── svgExport.ts
│   │   ├── pngExport.ts
│   │   └── pdfExport.ts    # pre-expands patterns before passing to svg2pdf
│   └── App.tsx
└── package.json
```

---

## Data model (`src/types/index.ts`)

```typescript
export type Vec2 = { x: number; y: number }

// --- Grid / angle modes ---

export type AngleMode =
  | 'tetralinear'   // 90°  — square grid
  | 'hexalinear'    // 60°  — triangular/hex grid
  | 'octolinear'    // 45°  — square grid (London tube default)
  | 'multilinear'   // any — free-angle, no snap
  | 'curvy'         // bezier handles, grid still active

export type GridShape = 'square' | 'hex' | 'triangular'

export interface GridConfig {
  angleMode: AngleMode
  gridShape: GridShape    // derived from angleMode but overridable
  cellSize: number        // px at 1:1
  visible: boolean
  snapEnabled: boolean
}

// --- Stations ---

export type StationSymbolType =
  | 'dot'           // filled circle, small
  | 'circle'        // open circle
  | 'capsule'       // elongated pill, aligns perpendicular to line
  | 'interchange'   // double-dot or ring, used at multi-line junctions
  | 'ring'          // large open ring

export type LabelAnchor = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'

export interface Station {
  id: string
  name: string
  geoPos: Vec2          // geographic / freehand position
  schPos?: Vec2         // condensed/schematic position (computed or manually adjusted)
  symbolType: StationSymbolType
  labelAnchor: LabelAnchor
  labelOffset: Vec2     // additional px nudge from anchor
  // which line IDs pass through this station (computed, not stored)
}

// --- Lines ---

export type StrokeStyleType =
  | 'solid'
  | 'double'          // two parallel strokes with gap — suburban rail look
  | 'dashed'
  | 'dotted'
  | 'striped'         // diagonal stripe fill via SVG <pattern>
  | 'cased'           // outline in caseColor, fill in line color
  | 'labeled'         // line shortcode repeated along path (e.g. "M3 M3 M3")

export interface StrokeStyle {
  type: StrokeStyleType
  dashArray?: string  // for dashed/dotted, raw SVG dasharray value
  gap?: number        // for double stroke, gap between the two strokes
  caseColor?: string  // for cased style
  stripeAngle?: number // for striped, degrees
}

export type LineCategory = 'metro' | 'tram' | 'bus' | 'train' | 'ferry' | 'cable'

export type Elevation = 'surface' | 'elevated' | 'underground' | 'construction'

export interface TransitLine {
  id: string
  name: string
  shortCode?: string      // "U6", "S1", "M3" etc — used for labeled style
  color: string           // hex
  width: number           // px — train 8, tram 6, bus 4 as defaults
  category: LineCategory
  strokeStyle: StrokeStyle
  elevation: Elevation
  cornerRadius: number    // base radius for turns; adjusted per parallel offset
  waypoints: string[]     // ordered list of station IDs; intermediate (non-station)
                          // waypoints stored as synthetic station IDs with empty name
  parallelGroupId?: string  // if set, this line is in an offset group
  parallelIndex?: number    // signed offset index in group (0=center, 1=first right, -1=first left)
  zIndex: number
}

// --- Geographic features (rivers, parks, etc.) ---

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

// --- Document root ---

export interface MapDocument {
  version: number           // schema version for future migration
  id: string
  title: string
  stations: Record<string, Station>
  lines: Record<string, TransitLine>
  features: Record<string, GeographicFeature>
  lineOrder: string[]       // z-order for lines
  grid: GridConfig
  viewport: { w: number; h: number }
  background?: {
    dataUrl: string         // base64 PNG/JPG
    opacity: number         // 0.05–0.4 typical
    transform: { x: number; y: number; scale: number; rotation: number }
  }
  condenseFactor: number    // 0 = geographic positions, 1 = schematic positions
  typography: {
    fontFamily: string      // default 'Inter'
    stationFontSize: number
    stationFontWeight: number
    lineLabelFontSize: number
  }
}
```

---

## Geometry module specs

### `snap.ts`

```typescript
// Snap angle to nearest allowed angle for the current mode.
// Returns angle in radians.
function snapAngle(dx: number, dy: number, mode: AngleMode): number

// Snap a point to the nearest grid intersection.
// For square grid: round to nearest (cellSize, cellSize)
// For hex grid: convert to axial coords, round, convert back
function snapToGrid(pt: Vec2, grid: GridConfig): Vec2

// Given a start point and a raw end point, return the end point
// repositioned so the segment angle is snapped.
function snapEndpoint(start: Vec2, rawEnd: Vec2, grid: GridConfig): Vec2
```

### `offset.ts` — the most complex file

Computes a parallel-offset polyline with proper arc corners. Used whenever two or more lines share a `parallelGroupId`.

**Algorithm:**

1. For each segment `[P_i, P_{i+1}]`, shift both endpoints perpendicularly by `offset = parallelIndex * (lineWidth + parallelGap)`.
2. At each interior vertex, the shifted segments from either side won't meet exactly. Connect them:
   - If lines diverge (outside of curve): insert a circular arc of radius `cornerRadius + |offset|`
   - If lines converge (inside of curve): use `cornerRadius - |offset|`; if this goes ≤ 0, clamp to a miter point (tight inner line)
3. Return as SVG path `d` string using `L` and `A` commands.

```typescript
function offsetPolyline(
  pts: Vec2[],
  offset: number,
  cornerRadius: number
): string  // SVG path d attribute
```

**Note:** `LineRenderer` must call this for every line in a parallel group, pre-computing all offsets before rendering any of them, so z-ordering within the group can be handled correctly.

### `condense.ts`

```typescript
// Given current lines/stations, compute schematic (equidistant) positions.
// Strategy: spring relaxation.
//   - Target spring length = grid.cellSize * 2 (one "stop" = two cells)
//   - Junction stations (served by 3+ lines) are fixed anchors
//   - Positions relax from anchors outward
//   - Angle snap applied after each iteration
//   - 100–200 iterations is sufficient
// Returns map of stationId → schPos
function computeSchematicPositions(
  lines: Record<string, TransitLine>,
  stations: Record<string, Station>,
  grid: GridConfig
): Record<string, Vec2>
```

### `hitTest.ts`

```typescript
// Returns station ID if click within station symbol bounds, else null
function hitTestStation(pt: Vec2, stations: Record<string, Station>, radius: number): string | null

// Returns { lineId, waypointIndex } if click within threshold of a waypoint handle
function hitTestWaypoint(pt: Vec2, lines: Record<string, TransitLine>): { lineId: string; idx: number } | null

// Returns lineId if click within threshold of a line segment (not a waypoint)
function hitTestLine(pt: Vec2, lines: Record<string, TransitLine>, threshold: number): string | null
```

---

## Rendering pipeline

```
MapDocument (from Zustand)
    │
    ▼
<svg id="map-root" width height viewBox>   ← this node is serialized for export
    │
    ├── <defs>
    │     ├── <pattern id="stripe-*">      for each striped line
    │     ├── <pattern id="river-*">       river texture patterns
    │     └── <clipPath>                   viewport clip
    │
    ├── <image>                            faded background screenshot
    │
    ├── <g id="grid">                      GridRenderer — pointer-events: none
    │
    ├── <g id="features">                  rivers, parks — drawn under lines
    │
    ├── <g id="lines">
    │     └── per line, in lineOrder z-order:
    │           LineRenderer
    │             ├── resolves parallel group offset
    │             ├── calls offsetPolyline() → SVG path d
    │             ├── applies cornerRadius
    │             └── renders stroke per StrokeStyle
    │
    ├── <g id="stations">
    │     └── per station:
    │           StationRenderer
    │             ├── symbol (oriented to bisector of incident line directions)
    │             └── label (positioned per LabelAnchor + labelOffset)
    │
    └── <g id="editor-overlay">            ← STRIPPED from export
          ├── selection highlight
          ├── waypoint handles (draggable)
          ├── draw preview (ghost line during DrawLineTool)
          └── grid snap indicator
```

---

## Editor FSM (`editorStore.ts`)

```
IDLE
  → left-click empty canvas + draw mode active  → DRAWING
  → left-click station                           → SELECTED_STATION
  → left-click line                              → SELECTED_LINE
  → left-click+drag waypoint handle             → DRAGGING_WAYPOINT
  → left-click+drag canvas (no hit)             → PANNING
  → middle-click+drag / scroll                  → PANNING / ZOOMING

DRAWING (active line being placed)
  → mousemove                    snap preview endpoint
  → left-click                   commit waypoint, continue
  → left-click on existing station  terminate line at that station
  → Enter / double-click         finish line open-ended
  → Escape                       discard in-progress line

SELECTED_STATION
  → drag                         DRAGGING_STATION
  → panel interaction            edit name / symbol / label anchor
  → Delete key                   remove station + detach from lines

SELECTED_LINE
  → panel interaction            edit color / width / style / elevation
  → click segment midpoint       insert new waypoint
  → Delete key                   remove line

DRAGGING_WAYPOINT
  → mousemove                    snap to grid, live-update path
  → mouseup                      commit, recalculate parallel offsets for group
```

---

## SVG pattern registry (`rendering/patterns.ts`)

Pre-define these as `<pattern>` elements in `<defs>`. Each gets a deterministic ID based on color + params so the same visual reuses the same def.

| Style type | SVG approach |
|---|---|
| `solid` | plain `stroke` |
| `double` | two `<path>` elements, offset by `gap/2` in opposite perpendicular directions |
| `dashed` | `stroke-dasharray` |
| `dotted` | `stroke-dasharray: "2 4"` with `stroke-linecap: round` |
| `striped` | `<pattern>` with diagonal `<line>` elements, rotated to line angle |
| `cased` | two strokes: wide `caseColor` below, narrow `color` above |
| `labeled` | `<textPath>` with `href` to path, `startOffset` 0%, repeating shortCode |
| `construction` (elevation) | `stroke-dasharray` pattern OR second overlay path with lighter color |
| `elevated` (elevation) | double-cased stroke (inner white gap) |
| `underground` (elevation) | reduced opacity OR dashed center line |

---

## Export (`src/export/`)

### SVG export
1. Clone `#map-root` node
2. Remove `#editor-overlay` child
3. Set `xmlns` attribute
4. Return as blob / trigger download

### PNG export
1. Serialize SVG to data URL
2. Draw into `<canvas>` via `drawImage`
3. `canvas.toBlob('image/png')` → download
4. Let user choose resolution multiplier (1×, 2×, 4×)

### PDF export
**Important:** `svg2pdf.js` does not reliably render SVG `<pattern>` fills. Pre-processing step required:

Before passing SVG to svg2pdf:
- For each `<path>` using a `striped` pattern: replace with a `<g>` containing explicit diagonal line elements clipped to the path bounds
- For each `<image>` (background): rasterize to canvas first, replace with a PNG data-URL `<image>`

Then pass the processed clone to `svg2pdf`.

---

## localStorage persistence

`mapStore.ts` uses Zustand's `persist` middleware:

```typescript
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useMapStore = create(
  persist(
    (set, get) => ({
      documents: {} as Record<string, MapDocument>,
      activeDocumentId: null as string | null,
      // ... actions
    }),
    {
      name: 'transit-map-storage',
      version: 1,
      migrate: (state, version) => { /* handle schema migrations */ }
    }
  )
)
```

Multiple maps can be stored. The app shows a simple open/new/delete list on load.

---

## Condensed mode (UX)

- A slider in the sidebar: **Geographic ↔ Schematic** (0 → 1)
- At 0: all stations render at `geoPos`
- At 1: all stations render at `schPos` (computed by `computeSchematicPositions` or manually adjusted)
- In between: lerp between the two positions — smooth animated transition
- "Compute schematic" button triggers the spring relaxation
- User can then fine-tune individual `schPos` values by dragging in schematic mode
- Switching back to geographic mode never loses schematic positions

---

## GitHub Pages deploy

`vite.config.ts`:
```typescript
export default defineConfig({
  base: '/transit-map/',   // or '/' if using a custom domain
  plugins: [react()],
})
```

Deploy via GitHub Actions on push to `main`:
```yaml
# .github/workflows/deploy.yml
- uses: actions/checkout@v4
- uses: actions/setup-node@v4
  with: { node-version: 20 }
- run: npm ci && npm run build
- uses: actions/deploy-pages@v4
  with: { artifact_name: dist }
```

No server. No API keys. No build secrets. Fully static.

---

## Build order (recommended)

**Phase 1 — MVP canvas**
1. `types/index.ts` — full type definitions
2. `store/mapStore.ts` — basic CRUD for stations, lines, waypoints
3. `geometry/snap.ts` — angle snap + grid snap (test in isolation)
4. `editor/Canvas.tsx` — SVG root, pan/zoom, event routing
5. `rendering/GridRenderer.tsx` — square grid, snapping visual
6. `rendering/LineRenderer.tsx` — solid lines only, no offset yet
7. `rendering/StationRenderer.tsx` — circle + label
8. `editor/tools/DrawLineTool.tsx` — click to place waypoints, angle-snapped
9. `editor/tools/SelectTool.tsx` — click to select, drag to move

**Phase 2 — Line styling**
10. `rendering/patterns.ts` — defs for all stroke styles
11. `LineRenderer` extended for all StrokeStyle variants
12. `geometry/offset.ts` — parallel offset with arc corners
13. `panels/LinePanel.tsx` — color, width, style, elevation pickers
14. `panels/StationPanel.tsx` — symbol, label anchor, name editor

**Phase 3 — Export + persistence**
15. `store/mapStore.ts` — persist middleware, multi-document
16. `export/svgExport.ts`
17. `export/pngExport.ts`
18. `export/pdfExport.ts` — with pattern pre-expansion

**Phase 4 — Schematic mode**
19. `geometry/condense.ts` — spring relaxation
20. `store/mapStore.ts` — condenseFactor slider
21. Lerp rendering between geoPos and schPos

**Phase 5 — Advanced**
22. Hex / triangular grid mode
23. River / geographic feature drawing
24. Background image import + alignment controls
25. Multi-line select, group operations

---

## Known hard problems (flag for careful implementation)

1. **`offset.ts` arc corners**: The inner line at tight curves can have radius ≤ 0. Clamp to miter (sharp point) rather than letting it invert. Log a warning if the group width exceeds 50% of cornerRadius.

2. **Pattern PDF export**: Do not skip the pre-expansion step. svg2pdf will silently drop patterns without error.

3. **Spring relaxation stability**: Fix all 3-way junction stations as anchors before running relaxation. Running relaxation without fixed anchors causes the map to drift and rotate.

4. **Label placement at interchange stations**: When 3+ lines pass through a station, the symbol bisector is ambiguous. Use the direction of the highest-`zIndex` line as the dominant axis.

5. **Hex grid snap math**: Use axial coordinates (q, r), not offset coordinates. Conversion: `q = (2/3 * x) / cellSize`, `r = (-1/3 * x + sqrt(3)/3 * y) / cellSize`. Round each, then cube-coordinate check to resolve ties.

---

## Reference

Visual system: Roberta Aehnelt, transit.robertaehnelt.de / "Transit Maps Design Study"

Key studies to implement against:
- Study #2: Intersections — how overlapping lines are drawn
- Study #3b: Stops & Stations — symbol library
- Study #8: Line Angle — the angle mode system (tetra/hexa/octo/multi/curvy)
- Study #9: Busy Routes — parallel offset with curves
- Study #12: Over vs Underground — elevation stroke variants
- Study #17: Line Types — full stroke style catalogue
