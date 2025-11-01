import { Sparkles } from 'lucide-react'
import React, { useCallback, useEffect, useRef, useState, useMemo } from 'react'

import type { SelectionInfo } from './SelectionManager'
import { useDynamicStyleClass } from '../../hooks/useDynamicStyleClass'

type SelectionIndicatorProps = {
  selection: SelectionInfo
  onHoverChange: (isHovering: boolean) => void
  offset?: number
}

export function SelectionIndicator({
  selection,
  onHoverChange,
  offset = 8,
}: SelectionIndicatorProps) {
  const indicatorRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const [isVisible, setIsVisible] = useState(false)

  const updatePosition = useCallback(() => {
    const { rect } = selection
    const isRTL = document.dir === 'rtl'

    let left: number
    let top: number

    if (isRTL) {
      // For RTL, position to the left of the selection
      left = rect.left - 28 - offset // 28px is approximate indicator width
    } else {
      // For LTR, position to the right of the selection
      left = rect.right + offset
    }

    top = rect.bottom + offset

    // Ensure the indicator stays within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight
    const indicatorWidth = 28
    const indicatorHeight = 28

    if (left + indicatorWidth > viewportWidth - 8) {
      left = viewportWidth - indicatorWidth - 8
    }
    if (left < 8) {
      left = 8
    }
    if (top + indicatorHeight > viewportHeight - 8) {
      top = rect.top - indicatorHeight - offset
    }

    setPosition({ left, top })
  }, [offset, selection])

  useEffect(() => {
    updatePosition()
    // Fade in after positioning
    const timer = window.setTimeout(() => setIsVisible(true), 10)

    return () => window.clearTimeout(timer)
  }, [selection, updatePosition])

  const handleMouseEnter = () => {
    onHoverChange(true)
  }

  const handleMouseLeave = () => {
    onHoverChange(false)
  }

  const positionStyles = useMemo(
    () => ({
      left: `${Math.round(position.left)}px`,
      top: `${Math.round(position.top)}px`,
    }),
    [position.left, position.top],
  )

  const indicatorClassName = useDynamicStyleClass(
    'smtcmp-selection-indicator',
    'smtcmp-selection-indicator-pos',
    positionStyles,
  )

  const classes = `${indicatorClassName} ${isVisible ? 'visible' : ''}`.trim()

  return (
    <div
      ref={indicatorRef}
      className={classes}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <Sparkles size={14} />
    </div>
  )
}
