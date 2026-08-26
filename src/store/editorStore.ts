// ============================================================================
// editorStore.ts — ephemeral editor state (NOT persisted)
//
// Tool mode, selection, hover, pan/zoom view transform, and the in-progress
// "draft" line being assembled from stops. None of this belongs in the saved
// document.
// ============================================================================

import { create } from 'zustand'
import type { Selection, ToolMode, Vec2, ViewTransform } from '../types'

const MIN_SCALE = 0.15
const MAX_SCALE = 8

interface EditorState {
  tool: ToolMode
  selection: Selection
  hover: Selection
  view: ViewTransform

  /** Station IDs chained so far in the current connect-line gesture. */
  draftStops: string[]
  /** Live cursor (world coords) for the ghost segment while connecting. */
  draftCursor: Vec2 | null
  /** Snapped cursor position for the grid snap indicator (any tool). */
  snapIndicator: Vec2 | null
  /** Transient "just anchored" feedback: station id + a bump nonce. */
  pulse: { id: string; nonce: number } | null

  setTool: (tool: ToolMode) => void
  select: (selection: Selection) => void
  clearSelection: () => void
  setHover: (hover: Selection) => void

  setView: (view: ViewTransform) => void
  panBy: (dxScreen: number, dyScreen: number) => void
  zoomAt: (screenX: number, screenY: number, factor: number) => void

  // connect-line gesture
  startLineDraft: (stationId: string) => void
  appendStop: (stationId: string) => void
  setDraftCursor: (p: Vec2 | null) => void
  clearDraft: () => void

  setSnapIndicator: (p: Vec2 | null) => void
  firePulse: (stationId: string) => void
}

const IDENTITY_VIEW: ViewTransform = { scale: 1, tx: 0, ty: 0 }

export const useEditorStore = create<EditorState>()((set) => ({
  tool: 'add-station',
  selection: { kind: null, id: null },
  hover: { kind: null, id: null },
  view: { ...IDENTITY_VIEW },

  draftStops: [],
  draftCursor: null,
  snapIndicator: null,
  pulse: null,

  setTool: (tool) =>
    set({ tool, draftStops: [], draftCursor: null, selection: { kind: null, id: null } }),

  select: (selection) => set({ selection }),
  clearSelection: () => set({ selection: { kind: null, id: null } }),
  setHover: (hover) => set({ hover }),

  setView: (view) => set({ view }),

  panBy: (dxScreen, dyScreen) =>
    set((s) => ({
      view: { ...s.view, tx: s.view.tx + dxScreen, ty: s.view.ty + dyScreen },
    })),

  zoomAt: (screenX, screenY, factor) =>
    set((s) => {
      const { scale, tx, ty } = s.view
      const nextScale = clamp(scale * factor, MIN_SCALE, MAX_SCALE)
      const k = nextScale / scale
      return {
        view: {
          scale: nextScale,
          tx: screenX - k * (screenX - tx),
          ty: screenY - k * (screenY - ty),
        },
      }
    }),

  startLineDraft: (stationId) =>
    set({ draftStops: [stationId], draftCursor: null, pulse: pulseFor(stationId) }),

  appendStop: (stationId) =>
    set((s) => {
      // ignore an immediate repeat of the last stop
      if (s.draftStops[s.draftStops.length - 1] === stationId) return {}
      return { draftStops: [...s.draftStops, stationId], pulse: pulseFor(stationId) }
    }),

  setDraftCursor: (p) => set({ draftCursor: p }),
  clearDraft: () => set({ draftStops: [], draftCursor: null }),

  setSnapIndicator: (p) => set({ snapIndicator: p }),
  firePulse: (stationId) => set({ pulse: pulseFor(stationId) }),
}))

let _nonce = 0
function pulseFor(id: string) {
  _nonce += 1
  return { id, nonce: _nonce }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// --- screen <-> world helpers (pure) --------------------------------------

export function screenToWorld(p: Vec2, view: ViewTransform): Vec2 {
  return { x: (p.x - view.tx) / view.scale, y: (p.y - view.ty) / view.scale }
}

export function worldToScreen(p: Vec2, view: ViewTransform): Vec2 {
  return { x: p.x * view.scale + view.tx, y: p.y * view.scale + view.ty }
}
