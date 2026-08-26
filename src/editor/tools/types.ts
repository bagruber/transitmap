// Shared contract every tool hook returns. The Canvas wires the active tool's
// handlers to the SVG root and renders its overlay into the editor layer.

import type { ReactNode } from 'react'
import type { Vec2 } from '../../types'

export interface ToolApi {
  onPointerDown?: (e: React.PointerEvent, world: Vec2) => void
  onPointerMove?: (e: React.PointerEvent, world: Vec2) => void
  onPointerUp?: (e: React.PointerEvent, world: Vec2) => void
  onDoubleClick?: (e: React.MouseEvent, world: Vec2) => void
  onKeyDown?: (e: KeyboardEvent) => void
  /** Rendered inside #editor-overlay (world coordinates). */
  overlay?: ReactNode
}
