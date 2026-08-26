// ============================================================================
// patterns.ts — deterministic SVG <pattern> defs for stroke styles that can't
// be expressed with stroke-dasharray alone (currently: striped fills).
//
// IDs are derived from the visual params so identical looks reuse one def and
// exports stay tidy. PDF export will need to pre-expand these (see brief).
// ============================================================================

/** Stable id for a striped pattern given its parameters. */
export function stripePatternId(color: string, stripe: string, angle: number): string {
  const key = `${color}_${stripe}_${Math.round(angle)}`.replace(/[^a-z0-9]/gi, '')
  return `stripe_${key}`
}

export interface StripePatternSpec {
  id: string
  color: string
  stripe: string
  angle: number
  tile: number
}

export function stripePatternSpec(
  color: string,
  angle = 45,
  stripe = '#ffffff',
): StripePatternSpec {
  return { id: stripePatternId(color, stripe, angle), color, stripe, angle, tile: 8 }
}
