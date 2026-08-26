// ============================================================================
// LineRenderer.tsx — render one line from its pre-composed path `d`.
//
// Geometry (routing + per-segment parallel offset) is computed upstream in
// network.ts; this component only applies the visual StrokeStyle and elevation
// hints. `d` may contain several sub-paths (one per bundle segment).
// `labeled` textPath is the remaining Phase-2 stroke style.
// ============================================================================

import { type ReactNode } from 'react'
import type { TransitLine } from '../types'
import { stripePatternSpec } from './patterns'

interface Props {
  line: TransitLine
  d: string
  emphasis?: 'none' | 'hover' | 'selected'
  onPointerDown?: (e: React.PointerEvent) => void
}

export function LineRenderer({ line, d, emphasis = 'none', onPointerDown }: Props) {
  if (!d) return null

  const W = line.width
  const cap = 'round' as const

  const base = (stroke: string, width: number, extra?: React.SVGProps<SVGPathElement>) => (
    <path
      d={d}
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap={cap}
      strokeLinejoin="round"
      {...extra}
    />
  )

  const layers: ReactNode[] = []
  let defs: ReactNode = null

  switch (line.strokeStyle.type) {
    case 'cased': {
      const caseColor = line.strokeStyle.caseColor ?? '#ffffff'
      layers.push(<g key="case">{base(caseColor, W + 4)}</g>)
      layers.push(<g key="fill">{base(line.color, W)}</g>)
      break
    }
    case 'double': {
      layers.push(<g key="outer">{base(line.color, W)}</g>)
      layers.push(<g key="inner">{base('#ffffff', Math.max(1, W * 0.45))}</g>)
      break
    }
    case 'dashed': {
      const da = line.strokeStyle.dashArray ?? `${W * 1.6} ${W * 1.1}`
      layers.push(
        <g key="dash">{base(line.color, W, { strokeDasharray: da, strokeLinecap: 'butt' })}</g>,
      )
      break
    }
    case 'dotted': {
      const da = line.strokeStyle.dashArray ?? `0.01 ${W * 1.8}`
      layers.push(
        <g key="dot">{base(line.color, W, { strokeDasharray: da, strokeLinecap: 'round' })}</g>,
      )
      break
    }
    case 'striped': {
      const spec = stripePatternSpec(line.color, line.strokeStyle.stripeAngle ?? 45)
      defs = (
        <defs>
          <pattern
            id={spec.id}
            patternUnits="userSpaceOnUse"
            width={spec.tile}
            height={spec.tile}
            patternTransform={`rotate(${spec.angle})`}
          >
            <rect width={spec.tile} height={spec.tile} fill={spec.color} />
            <rect width={spec.tile / 2} height={spec.tile} fill={spec.stripe} />
          </pattern>
        </defs>
      )
      layers.push(<g key="stripe-case">{base(line.color, W + 1)}</g>)
      layers.push(<g key="stripe">{base(`url(#${spec.id})`, W)}</g>)
      break
    }
    case 'labeled':
    case 'solid':
    default:
      layers.push(<g key="solid">{base(line.color, W)}</g>)
      break
  }

  // --- elevation hints ----------------------------------------------------
  const preLayers: ReactNode[] = []
  let groupOpacity = 1
  if (line.elevation === 'elevated') {
    preLayers.push(<g key="elev">{base('rgba(15,23,42,0.18)', W + 6)}</g>)
  } else if (line.elevation === 'underground') {
    groupOpacity = 0.78
  } else if (line.elevation === 'construction') {
    layers.push(
      <g key="constr">
        {base('#ffffff', Math.max(1, W * 0.5), {
          strokeDasharray: `${W} ${W}`,
          strokeLinecap: 'butt',
        })}
      </g>,
    )
  }

  return (
    <g
      data-line-id={line.id}
      onPointerDown={onPointerDown}
      style={{ cursor: 'pointer' }}
      opacity={groupOpacity}
    >
      {defs}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={Math.max(W + 10, 16)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {emphasis !== 'none' && (
        <path
          d={d}
          fill="none"
          stroke={emphasis === 'selected' ? '#1e293b' : '#94a3b8'}
          strokeWidth={W + 8}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.3}
        />
      )}
      {preLayers}
      {layers}
    </g>
  )
}
