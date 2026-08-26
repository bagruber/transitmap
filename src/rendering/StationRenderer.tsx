// ============================================================================
// StationRenderer.tsx — station symbol + label, driven by the network layout.
//
// The symbol (dot/circle/ring/interchange/capsule) and its size/orientation are
// decided upstream in network.ts based on how many lines meet the station and
// whether they run parallel (capsule spanning the bundle) or cross (interchange).
// ============================================================================

import type { LabelAnchor, MapDocument, Station } from '../types'
import type { StationLayout } from './network'

interface Props {
  station: Station
  layout: StationLayout
  typography: MapDocument['typography']
  emphasis?: 'none' | 'hover' | 'selected'
  onPointerDown?: (e: React.PointerEvent) => void
}

const SYMBOL_FILL = '#ffffff'
const SYMBOL_STROKE = '#1e293b'

type LabelLayout = {
  dx: number
  dy: number
  ta: 'start' | 'middle' | 'end'
  db: 'central' | 'text-after-edge' | 'text-before-edge'
}

function labelLayout(anchor: LabelAnchor, r: number): LabelLayout {
  const gap = r + 5
  const diag = gap * 0.72
  switch (anchor) {
    case 'e':
      return { dx: gap, dy: 0, ta: 'start', db: 'central' }
    case 'w':
      return { dx: -gap, dy: 0, ta: 'end', db: 'central' }
    case 'n':
      return { dx: 0, dy: -gap, ta: 'middle', db: 'text-after-edge' }
    case 's':
      return { dx: 0, dy: gap, ta: 'middle', db: 'text-before-edge' }
    case 'ne':
      return { dx: diag, dy: -diag, ta: 'start', db: 'text-after-edge' }
    case 'nw':
      return { dx: -diag, dy: -diag, ta: 'end', db: 'text-after-edge' }
    case 'se':
      return { dx: diag, dy: diag, ta: 'start', db: 'text-before-edge' }
    case 'sw':
      return { dx: -diag, dy: diag, ta: 'end', db: 'text-before-edge' }
  }
}

export function StationRenderer({
  station,
  layout,
  typography,
  emphasis = 'none',
  onPointerDown,
}: Props) {
  const { pos, symbol, size, length, angle } = layout
  const strokeW = symbol === 'dot' ? 0 : 2

  const symbolEl = (() => {
    switch (symbol) {
      case 'dot':
        return <circle cx={pos.x} cy={pos.y} r={size} fill={SYMBOL_STROKE} />
      case 'capsule': {
        // pill spanning the parallel bundle: length along `angle`, size = half-thickness
        const deg = (angle * 180) / Math.PI
        const half = length / 2
        return (
          <rect
            x={pos.x - half - size}
            y={pos.y - size}
            width={length + size * 2}
            height={size * 2}
            rx={size}
            transform={`rotate(${deg} ${pos.x} ${pos.y})`}
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={strokeW}
          />
        )
      }
      case 'interchange':
        return (
          <>
            <circle
              cx={pos.x}
              cy={pos.y}
              r={size}
              fill={SYMBOL_FILL}
              stroke={SYMBOL_STROKE}
              strokeWidth={strokeW}
            />
            <circle cx={pos.x} cy={pos.y} r={size * 0.4} fill={SYMBOL_STROKE} />
          </>
        )
      case 'ring':
      case 'circle':
      default:
        return (
          <circle
            cx={pos.x}
            cy={pos.y}
            r={size}
            fill={SYMBOL_FILL}
            stroke={SYMBOL_STROKE}
            strokeWidth={strokeW}
          />
        )
    }
  })()

  // label clears whichever half-extent is largest
  const labelR = symbol === 'capsule' ? length / 2 + size : size
  const lay = labelLayout(station.labelAnchor, labelR)

  return (
    <g
      data-station-id={station.id}
      onPointerDown={onPointerDown}
      style={{ cursor: 'pointer' }}
    >
      {emphasis !== 'none' && (
        <circle
          cx={pos.x}
          cy={pos.y}
          r={(symbol === 'capsule' ? length / 2 + size : size) + 4}
          fill="none"
          stroke={emphasis === 'selected' ? '#2563eb' : '#94a3b8'}
          strokeWidth={2}
        />
      )}
      {symbolEl}
      {station.name !== '' && (
        <text
          x={pos.x + lay.dx + station.labelOffset.x}
          y={pos.y + lay.dy + station.labelOffset.y}
          textAnchor={lay.ta}
          dominantBaseline={lay.db}
          fontFamily={typography.fontFamily}
          fontSize={typography.stationFontSize}
          fontWeight={typography.stationFontWeight}
          fill="#0f172a"
          style={{ pointerEvents: 'none' }}
        >
          {station.name}
        </text>
      )}
    </g>
  )
}
