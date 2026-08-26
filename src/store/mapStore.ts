// ============================================================================
// mapStore.ts — persisted document state (the saved map data)
//
// Holds every MapDocument keyed by id, plus the active document id. Persisted
// to localStorage via Zustand's persist middleware so reloads keep your work.
// Editor-only state (tool, selection, pan/zoom) lives in editorStore.ts.
// ============================================================================

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  GridConfig,
  LineCategory,
  MapDocument,
  Station,
  StationSymbolType,
  TransitLine,
  Vec2,
} from '../types'

const SCHEMA_VERSION = 2

// --- id helper ------------------------------------------------------------

let _counter = 0
function uid(prefix: string): string {
  _counter += 1
  const rand =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10)
  return `${prefix}_${rand}${_counter.toString(36)}`
}

// --- defaults -------------------------------------------------------------

const DEFAULT_GRID: GridConfig = {
  angleMode: 'octolinear',
  gridShape: 'square',
  cellSize: 24,
  visible: true,
  snapEnabled: true,
}

/** A small palette to cycle through as the user draws new lines. */
const LINE_PALETTE = [
  '#e3001b', // red
  '#0069b4', // blue
  '#009036', // green
  '#f39200', // orange
  '#943f8f', // purple
  '#00a19a', // teal
  '#e6007e', // magenta
  '#ffcc00', // yellow
]

const CATEGORY_WIDTH: Record<LineCategory, number> = {
  train: 8,
  metro: 7,
  tram: 6,
  cable: 5,
  bus: 4,
  ferry: 5,
}

export function createDocument(title = 'Untitled Map'): MapDocument {
  return {
    version: SCHEMA_VERSION,
    id: uid('doc'),
    title,
    stations: {},
    lines: {},
    features: {},
    lineOrder: [],
    grid: { ...DEFAULT_GRID },
    viewport: { w: 1600, h: 1000 },
    condenseFactor: 0,
    typography: {
      fontFamily: 'Inter',
      stationFontSize: 13,
      stationFontWeight: 600,
      lineLabelFontSize: 12,
    },
  }
}

// --- store shape ----------------------------------------------------------

interface MapState {
  documents: Record<string, MapDocument>
  activeDocumentId: string | null

  // document lifecycle
  newDocument: (title?: string) => string
  deleteDocument: (id: string) => void
  setActiveDocument: (id: string) => void
  renameDocument: (id: string, title: string) => void

  // grid
  updateGrid: (partial: Partial<GridConfig>) => void
  setCondenseFactor: (v: number) => void

  // stations
  addStation: (geoPos: Vec2, opts?: Partial<Station>) => string
  updateStation: (id: string, partial: Partial<Station>) => void
  moveStation: (id: string, geoPos: Vec2) => void
  deleteStation: (id: string) => void

  // lines (ordered lists of real station IDs)
  addLine: (stops: string[], opts?: Partial<TransitLine>) => string | null
  updateLine: (id: string, partial: Partial<TransitLine>) => void
  setLineStops: (id: string, stops: string[]) => void
  removeStopFromLine: (id: string, index: number) => void
  deleteLine: (id: string) => void
}

/** Mutate the active document immutably; no-op if there is none. */
function patchActive(
  state: MapState,
  fn: (doc: MapDocument) => MapDocument,
): Partial<MapState> {
  const id = state.activeDocumentId
  if (!id) return {}
  const doc = state.documents[id]
  if (!doc) return {}
  return { documents: { ...state.documents, [id]: fn(doc) } }
}

export const useMapStore = create<MapState>()(
  persist(
    (set) => ({
      documents: {},
      activeDocumentId: null,

      newDocument: (title) => {
        const doc = createDocument(title)
        set((s) => ({
          documents: { ...s.documents, [doc.id]: doc },
          activeDocumentId: doc.id,
        }))
        return doc.id
      },

      deleteDocument: (id) =>
        set((s) => {
          const next = { ...s.documents }
          delete next[id]
          const activeDocumentId =
            s.activeDocumentId === id
              ? (Object.keys(next)[0] ?? null)
              : s.activeDocumentId
          return { documents: next, activeDocumentId }
        }),

      setActiveDocument: (id) => set({ activeDocumentId: id }),

      renameDocument: (id, title) =>
        set((s) => {
          const doc = s.documents[id]
          if (!doc) return {}
          return { documents: { ...s.documents, [id]: { ...doc, title } } }
        }),

      updateGrid: (partial) =>
        set((s) =>
          patchActive(s, (doc) => ({ ...doc, grid: { ...doc.grid, ...partial } })),
        ),

      setCondenseFactor: (v) =>
        set((s) =>
          patchActive(s, (doc) => ({ ...doc, condenseFactor: clamp01(v) })),
        ),

      addStation: (geoPos, opts) => {
        const id = uid('st')
        set((s) =>
          patchActive(s, (doc) => ({
            ...doc,
            stations: {
              ...doc.stations,
              [id]: {
                id,
                name: '',
                geoPos,
                symbolType: 'circle' as StationSymbolType,
                labelAnchor: 'e',
                labelOffset: { x: 0, y: 0 },
                ...opts,
              },
            },
          })),
        )
        return id
      },

      updateStation: (id, partial) =>
        set((s) =>
          patchActive(s, (doc) => {
            const st = doc.stations[id]
            if (!st) return doc
            return {
              ...doc,
              stations: { ...doc.stations, [id]: { ...st, ...partial } },
            }
          }),
        ),

      moveStation: (id, geoPos) =>
        set((s) =>
          patchActive(s, (doc) => {
            const st = doc.stations[id]
            if (!st) return doc
            return {
              ...doc,
              stations: { ...doc.stations, [id]: { ...st, geoPos } },
            }
          }),
        ),

      deleteStation: (id) =>
        set((s) =>
          patchActive(s, (doc) => {
            const stations = { ...doc.stations }
            delete stations[id]
            // detach from every line; drop lines with fewer than 2 stops left.
            // Collapse consecutive duplicate stops that removal may create.
            const lines: Record<string, TransitLine> = {}
            for (const [lid, line] of Object.entries(doc.lines)) {
              const stops = dedupeAdjacent(line.stops.filter((w) => w !== id))
              if (stops.length >= 2) lines[lid] = { ...line, stops }
            }
            const lineOrder = doc.lineOrder.filter((lid) => lid in lines)
            return { ...doc, stations, lines, lineOrder }
          }),
        ),

      addLine: (stops, opts) => {
        const clean = dedupeAdjacent(stops)
        if (clean.length < 2) return null
        const id = uid('line')
        set((s) =>
          patchActive(s, (doc) => {
            // ignore stops that don't reference a real station
            const valid = clean.filter((sid) => sid in doc.stations)
            if (valid.length < 2) return doc
            const index = doc.lineOrder.length
            const category = opts?.category ?? 'metro'
            const line: TransitLine = {
              id,
              name: opts?.name ?? `Line ${index + 1}`,
              color: opts?.color ?? LINE_PALETTE[index % LINE_PALETTE.length],
              width: opts?.width ?? CATEGORY_WIDTH[category],
              category,
              strokeStyle: opts?.strokeStyle ?? { type: 'solid' },
              elevation: opts?.elevation ?? 'surface',
              cornerRadius: opts?.cornerRadius ?? doc.grid.cellSize,
              stops: valid,
              zIndex: index,
              ...opts,
            }
            return {
              ...doc,
              lines: { ...doc.lines, [id]: line },
              lineOrder: [...doc.lineOrder, id],
            }
          }),
        )
        return id
      },

      updateLine: (id, partial) =>
        set((s) =>
          patchActive(s, (doc) => {
            const line = doc.lines[id]
            if (!line) return doc
            return { ...doc, lines: { ...doc.lines, [id]: { ...line, ...partial } } }
          }),
        ),

      setLineStops: (id, stops) =>
        set((s) =>
          patchActive(s, (doc) => {
            const line = doc.lines[id]
            if (!line) return doc
            const valid = dedupeAdjacent(stops.filter((sid) => sid in doc.stations))
            return { ...doc, lines: { ...doc.lines, [id]: { ...line, stops: valid } } }
          }),
        ),

      removeStopFromLine: (id, index) =>
        set((s) =>
          patchActive(s, (doc) => {
            const line = doc.lines[id]
            if (!line) return doc
            const stops = dedupeAdjacent(line.stops.filter((_, i) => i !== index))
            if (stops.length < 2) {
              // line no longer viable — remove it
              const lines = { ...doc.lines }
              delete lines[id]
              return { ...doc, lines, lineOrder: doc.lineOrder.filter((l) => l !== id) }
            }
            return { ...doc, lines: { ...doc.lines, [id]: { ...line, stops } } }
          }),
        ),

      deleteLine: (id) =>
        set((s) =>
          patchActive(s, (doc) => {
            const lines = { ...doc.lines }
            delete lines[id]
            // Stations are first-class now — deleting a line leaves them alone.
            return {
              ...doc,
              lines,
              lineOrder: doc.lineOrder.filter((lid) => lid !== id),
            }
          }),
        ),
    }),
    {
      name: 'transit-map-storage',
      version: SCHEMA_VERSION,
      migrate: (persisted, fromVersion) => {
        const state = persisted as MapState
        // v1 → v2: lines stored `waypoints`; the field is now `stops`.
        if (fromVersion < 2 && state?.documents) {
          for (const doc of Object.values(state.documents)) {
            for (const line of Object.values(doc.lines)) {
              const legacy = line as unknown as { waypoints?: string[] }
              if (!line.stops && legacy.waypoints) line.stops = legacy.waypoints
              delete legacy.waypoints
            }
          }
        }
        return state
      },
      // App.tsx guarantees an active document exists after hydration.
    },
  ),
)

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v))
}

/** Collapse consecutive duplicate ids (a line shouldn't stop twice in a row). */
function dedupeAdjacent(ids: string[]): string[] {
  return ids.filter((id, i) => i === 0 || id !== ids[i - 1])
}

// --- convenience selectors ------------------------------------------------

/** The currently active document, or null. */
export function selectActiveDoc(s: MapState): MapDocument | null {
  return s.activeDocumentId ? (s.documents[s.activeDocumentId] ?? null) : null
}
