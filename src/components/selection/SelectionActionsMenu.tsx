import {
  MessageCircle,
  PenLine,
  Sparkles,
  BookOpen,
} from 'lucide-react'
import React, { useEffect, useRef, useState } from 'react'

import { useLanguage } from '../../contexts/language-context'
import type { SelectionInfo } from './SelectionManager'

export interface SelectionAction {
  id: string
  label: string
  icon: React.ReactNode
  handler: () => void | Promise<void>
}

interface SelectionActionsMenuProps {
  selection: SelectionInfo
  indicatorPosition: { left: number; top: number }
  onAction: (actionId: string) => void | Promise<void>
  onClose: () => void
  onHoverChange: (isHovering: boolean) => void
}

export function SelectionActionsMenu({
  selection,
  indicatorPosition,
  onAction,
  onClose,
  onHoverChange,
}: SelectionActionsMenuProps) {
  const { t } = useLanguage()
  const menuRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ left: 0, top: 0 })
  const [isVisible, setIsVisible] = useState(false)

  const actions: SelectionAction[] = [
    {
      id: 'add-to-chat',
      label: t('selection.actions.addToChat', '添加到对话'),
      icon: <MessageCircle size={14} />,
      handler: () => onAction('add-to-chat'),
    },
    {
      id: 'rewrite',
      label: t('selection.actions.rewrite', 'AI 改写'),
      icon: <PenLine size={14} />,
      handler: () => onAction('rewrite'),
    },
    {
      id: 'explain',
      label: t('selection.actions.explain', '深入解释'),
      icon: <BookOpen size={14} />,
      handler: () => onAction('explain'),
    },
    {
      id: 'continue',
      label: t('selection.actions.continue', '继续写作'),
      icon: <Sparkles size={14} />,
      handler: () => onAction('continue'),
    },
  ]

  useEffect(() => {
    updatePosition()
    // Fade in after positioning
    const timer = window.setTimeout(() => setIsVisible(true), 50)
    
    return () => window.clearTimeout(timer)
  }, [selection, indicatorPosition])

  const updatePosition = () => {
    // Position menu relative to indicator
    const menuWidth = 200 // Approximate menu width
    const menuHeight = 44 * actions.length + 16 // Approximate height
    const offset = 8
    
    let left = indicatorPosition.left + 28 + offset // 28px is indicator width
    let top = indicatorPosition.top

    // Ensure menu stays within viewport
    const viewportWidth = window.innerWidth
    const viewportHeight = window.innerHeight

    if (left + menuWidth > viewportWidth - 8) {
      // Position to the left of indicator
      left = indicatorPosition.left - menuWidth - offset
    }
    if (left < 8) {
      left = 8
    }

    if (top + menuHeight > viewportHeight - 8) {
      top = viewportHeight - menuHeight - 8
    }
    if (top < 8) {
      top = 8
    }

    setPosition({ left, top })
  }

  const handleMouseEnter = () => {
    onHoverChange(true)
  }

  const handleMouseLeave = () => {
    onHoverChange(false)
  }

  const handleActionClick = async (action: SelectionAction) => {
    await action.handler()
  }

  return (
    <div
      ref={menuRef}
      className={`smtcmp-selection-menu ${isVisible ? 'visible' : ''}`}
      style={{
        left: `${position.left}px`,
        top: `${position.top}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <div className="smtcmp-selection-menu-content">
        {actions.map((action) => (
          <button
            key={action.id}
            type="button"
            className="smtcmp-selection-menu-item"
            onClick={() => void handleActionClick(action)}
          >
            <span className="smtcmp-selection-menu-item-icon">
              {action.icon}
            </span>
            <span className="smtcmp-selection-menu-item-label">
              {action.label}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}
