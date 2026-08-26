// ============================================================================
// App.tsx — top-level layout: toolbar chrome + the SVG canvas.
// ============================================================================

import { useEffect } from 'react'
import type { AngleMode } from './types'
import { selectActiveDoc, useMapStore } from './store/mapStore'
import { useEditorStore } from './store/editorStore'
import { Canvas } from './editor/Canvas'
import { LinePanel } from './panels/LinePanel'
import { StationPanel } from './panels/StationPanel'

const ANGLE_MODES: { value: AngleMode; label: string }[] = [
  { value: 'octolinear', label: 'Octolinear · 45°' },
  { value: 'tetralinear', label: 'Tetralinear · 90°' },
  { value: 'hexalinear', label: 'Hexalinear · 60°' },
  { value: 'multilinear', label: 'Multilinear · free' },
  { value: 'curvy', label: 'Curvy' },
]

export default function App() {
  const doc = useMapStore(selectActiveDoc)
  const newDocument = useMapStore((s) => s.newDocument)
  const updateGrid = useMapStore((s) => s.updateGrid)

  const tool = useEditorStore((s) => s.tool)
  const setTool = useEditorStore((s) => s.setTool)
  const selection = useEditorStore((s) => s.selection)

  const selectedLine =
    selection.kind === 'line' && selection.id ? doc?.lines[selection.id] : undefined
  const selectedStation =
    selection.kind === 'station' && selection.id
      ? doc?.stations[selection.id]
      : undefined

  // Guarantee an active document on first load.
  useEffect(() => {
    if (!doc) newDocument('My First Map')
  }, [doc, newDocument])

  if (!doc) return null

  const grid = doc.grid

  return (
    <div className="flex h-full flex-col bg-slate-100 text-slate-800">
      {/* Toolbar */}
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-300 bg-white px-4 py-2 shadow-sm">
        <h1 className="text-sm font-semibold tracking-tight text-slate-900">
          Transit Map Editor
        </h1>

        <div className="mx-1 h-5 w-px bg-slate-300" />

        {/* Tools */}
        <div className="flex overflow-hidden rounded-md border border-slate-300">
          <ToolButton active={tool === 'select'} onClick={() => setTool('select')}>
            Select
          </ToolButton>
          <ToolButton
            active={tool === 'add-station'}
            onClick={() => setTool('add-station')}
          >
            Add Station
          </ToolButton>
          <ToolButton
            active={tool === 'connect-line'}
            onClick={() => setTool('connect-line')}
          >
            Connect Line
          </ToolButton>
        </div>

        <div className="mx-1 h-5 w-px bg-slate-300" />

        {/* Angle mode */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Angle
          <select
            className="rounded border border-slate-300 bg-white px-1.5 py-1 text-xs"
            value={grid.angleMode}
            onChange={(e) => updateGrid({ angleMode: e.target.value as AngleMode })}
          >
            {ANGLE_MODES.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </label>

        {/* Cell size */}
        <label className="flex items-center gap-1.5 text-xs text-slate-600">
          Grid
          <input
            type="range"
            min={12}
            max={64}
            step={4}
            value={grid.cellSize}
            onChange={(e) => updateGrid({ cellSize: Number(e.target.value) })}
          />
          <span className="w-7 tabular-nums text-slate-500">{grid.cellSize}</span>
        </label>

        {/* Toggles */}
        <Toggle
          checked={grid.snapEnabled}
          onChange={(v) => updateGrid({ snapEnabled: v })}
          label="Snap"
        />
        <Toggle
          checked={grid.visible}
          onChange={(v) => updateGrid({ visible: v })}
          label="Show grid"
        />

        <div className="ml-auto text-xs text-slate-400">
          {tool === 'add-station'
            ? 'Click grid to place a station · they snap to the grid'
            : tool === 'connect-line'
              ? 'Click stations in order · double-click / Enter to finish · Esc to cancel'
              : 'Click to select · drag stations to reflow lines · Del to remove'}
        </div>
      </header>

      {/* Canvas + right sidebar */}
      <div className="flex min-h-0 flex-1">
        <main className="relative min-h-0 flex-1">
          <Canvas doc={doc} />
        </main>

        <aside className="w-72 shrink-0 overflow-y-auto border-l border-slate-300 bg-white p-4">
          {selectedLine ? (
            <LinePanel line={selectedLine} />
          ) : selectedStation ? (
            <StationPanel station={selectedStation} />
          ) : (
            <div className="text-sm text-slate-400">
              <p className="mb-2 font-medium text-slate-500">Nothing selected</p>
              <p>
                Use <span className="font-medium">Select</span> and click a line or
                station to edit it. Draw new lines with the{' '}
                <span className="font-medium">Draw Line</span> tool.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function ToolButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium transition-colors ${
        active ? 'bg-blue-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-100'
      }`}
    >
      {children}
    </button>
  )
}

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: string
}) {
  return (
    <label className="flex cursor-pointer items-center gap-1.5 text-xs text-slate-600">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  )
}
