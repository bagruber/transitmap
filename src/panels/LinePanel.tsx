// ============================================================================
// LinePanel — edit the selected transit line.
// ============================================================================

import type {
  Elevation,
  LineCategory,
  StrokeStyleType,
  TransitLine,
} from '../types'
import { selectActiveDoc, useMapStore } from '../store/mapStore'
import { useEditorStore } from '../store/editorStore'
import {
  ColorInput,
  DeleteButton,
  Field,
  RangeInput,
  Select,
  TextInput,
} from './controls'

const STROKE_STYLES: { value: StrokeStyleType; label: string }[] = [
  { value: 'solid', label: 'Solid' },
  { value: 'double', label: 'Double (rail)' },
  { value: 'dashed', label: 'Dashed' },
  { value: 'dotted', label: 'Dotted' },
  { value: 'cased', label: 'Cased (halo)' },
  { value: 'striped', label: 'Striped' },
]

const CATEGORIES: { value: LineCategory; label: string }[] = [
  { value: 'metro', label: 'Metro' },
  { value: 'train', label: 'Train / S-Bahn' },
  { value: 'tram', label: 'Tram' },
  { value: 'bus', label: 'Bus' },
  { value: 'ferry', label: 'Ferry' },
  { value: 'cable', label: 'Cable' },
]

const ELEVATIONS: { value: Elevation; label: string }[] = [
  { value: 'surface', label: 'Surface' },
  { value: 'elevated', label: 'Elevated' },
  { value: 'underground', label: 'Underground' },
  { value: 'construction', label: 'Construction' },
]

export function LinePanel({ line }: { line: TransitLine }) {
  const updateLine = useMapStore((s) => s.updateLine)
  const deleteLine = useMapStore((s) => s.deleteLine)
  const removeStopFromLine = useMapStore((s) => s.removeStopFromLine)
  const stations = useMapStore((s) => selectActiveDoc(s)?.stations ?? {})
  const clearSelection = useEditorStore((s) => s.clearSelection)
  const setHover = useEditorStore((s) => s.setHover)

  const patchStyle = (partial: Partial<TransitLine['strokeStyle']>) =>
    updateLine(line.id, { strokeStyle: { ...line.strokeStyle, ...partial } })

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-900">Line</h2>

      <Field label="Name">
        <TextInput value={line.name} onChange={(v) => updateLine(line.id, { name: v })} />
      </Field>

      <Field label="Short code">
        <TextInput
          value={line.shortCode ?? ''}
          placeholder="U6, S1, M3…"
          onChange={(v) => updateLine(line.id, { shortCode: v })}
        />
      </Field>

      <Field label="Colour">
        <ColorInput value={line.color} onChange={(v) => updateLine(line.id, { color: v })} />
      </Field>

      <Field label="Width">
        <RangeInput
          value={line.width}
          min={2}
          max={16}
          onChange={(v) => updateLine(line.id, { width: v })}
        />
      </Field>

      <Field label="Category">
        <Select
          value={line.category}
          options={CATEGORIES}
          onChange={(v) => updateLine(line.id, { category: v })}
        />
      </Field>

      <Field label="Stroke style">
        <Select
          value={line.strokeStyle.type}
          options={STROKE_STYLES}
          onChange={(v) => patchStyle({ type: v })}
        />
      </Field>

      {line.strokeStyle.type === 'cased' && (
        <Field label="Case colour">
          <ColorInput
            value={line.strokeStyle.caseColor ?? '#ffffff'}
            onChange={(v) => patchStyle({ caseColor: v })}
          />
        </Field>
      )}

      {line.strokeStyle.type === 'striped' && (
        <Field label="Stripe angle">
          <RangeInput
            value={line.strokeStyle.stripeAngle ?? 45}
            min={0}
            max={180}
            step={5}
            onChange={(v) => patchStyle({ stripeAngle: v })}
          />
        </Field>
      )}

      <Field label="Elevation">
        <Select
          value={line.elevation}
          options={ELEVATIONS}
          onChange={(v) => updateLine(line.id, { elevation: v })}
        />
      </Field>

      <Field label="Corner radius">
        <RangeInput
          value={line.cornerRadius}
          min={0}
          max={60}
          step={2}
          onChange={(v) => updateLine(line.id, { cornerRadius: v })}
        />
      </Field>

      <Field label={`Stops (${line.stops.length})`}>
        <ol className="flex flex-col gap-0.5">
          {line.stops.map((sid, i) => {
            const st = stations[sid]
            return (
              <li
                key={`${sid}-${i}`}
                onMouseEnter={() => setHover({ kind: 'station', id: sid })}
                onMouseLeave={() => setHover({ kind: null, id: null })}
                className="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-slate-100"
              >
                <span className="truncate text-slate-700">
                  <span className="mr-1.5 tabular-nums text-slate-400">{i + 1}.</span>
                  {st?.name || <em className="text-slate-400">unnamed</em>}
                </span>
                <button
                  onClick={() => removeStopFromLine(line.id, i)}
                  className="ml-2 shrink-0 rounded px-1 text-xs text-slate-400 hover:bg-red-100 hover:text-red-600"
                  title="Remove stop"
                >
                  ✕
                </button>
              </li>
            )
          })}
        </ol>
        <p className="mt-1 text-[11px] text-slate-400">
          Use the Connect tool to append more stops.
        </p>
      </Field>

      <DeleteButton
        label="Delete line"
        onClick={() => {
          deleteLine(line.id)
          clearSelection()
        }}
      />
    </div>
  )
}
