// ============================================================================
// StationPanel — edit the selected station (name it, pick a symbol, place its
// label). Naming an unnamed draw-waypoint "upgrades" it into a real station.
// ============================================================================

import type { LabelAnchor, Station, StationSymbolType } from '../types'
import { useMapStore } from '../store/mapStore'
import { useEditorStore } from '../store/editorStore'
import { DeleteButton, Field, Select, TextInput } from './controls'

const SYMBOLS: { value: StationSymbolType; label: string }[] = [
  { value: 'dot', label: 'Dot' },
  { value: 'circle', label: 'Circle' },
  { value: 'ring', label: 'Ring' },
  { value: 'interchange', label: 'Interchange' },
  { value: 'capsule', label: 'Capsule' },
]

const ANCHORS: { value: LabelAnchor; label: string }[] = [
  { value: 'e', label: 'Right' },
  { value: 'w', label: 'Left' },
  { value: 'n', label: 'Above' },
  { value: 's', label: 'Below' },
  { value: 'ne', label: 'Upper right' },
  { value: 'nw', label: 'Upper left' },
  { value: 'se', label: 'Lower right' },
  { value: 'sw', label: 'Lower left' },
]

export function StationPanel({ station }: { station: Station }) {
  const updateStation = useMapStore((s) => s.updateStation)
  const deleteStation = useMapStore((s) => s.deleteStation)
  const clearSelection = useEditorStore((s) => s.clearSelection)

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold text-slate-900">Station</h2>

      <Field label="Name">
        <TextInput
          value={station.name}
          placeholder="(unnamed stop)"
          onChange={(v) => updateStation(station.id, { name: v })}
        />
      </Field>

      <Field label="Symbol">
        <Select
          value={station.symbolType}
          options={SYMBOLS}
          onChange={(v) => updateStation(station.id, { symbolType: v })}
        />
      </Field>

      <Field label="Label position">
        <Select
          value={station.labelAnchor}
          options={ANCHORS}
          onChange={(v) => updateStation(station.id, { labelAnchor: v })}
        />
      </Field>

      <DeleteButton
        label="Delete station"
        onClick={() => {
          deleteStation(station.id)
          clearSelection()
        }}
      />
    </div>
  )
}
