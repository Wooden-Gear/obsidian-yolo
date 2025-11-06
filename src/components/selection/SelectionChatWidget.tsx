import { Editor } from 'obsidian'
import React, { useEffect, useRef, useState } from 'react'
import { Root, createRoot } from 'react-dom/client'

import { LanguageProvider } from '../../contexts/language-context'
import { PluginProvider } from '../../contexts/plugin-context'
import SmartComposerPlugin from '../../main'

import { SelectionActionsMenu } from './SelectionActionsMenu'
import { SelectionIndicator } from './SelectionIndicator'
import type { SelectionInfo } from './SelectionManager'

type SelectionChatWidgetProps = {
  plugin: SmartComposerPlugin
  editor: Editor
  selection: SelectionInfo
  onClose: () => void
  onAction: (actionId: string, selection: SelectionInfo) => void | Promise<void>
}

function SelectionChatWidgetBody({
  plugin: _plugin,
  editor: _editor,
  selection,
  onClose,
  onAction,
}: SelectionChatWidgetProps) {
  const [showMenu, setShowMenu] = useState(false)
  const [isHoveringIndicator, setIsHoveringIndicator] = useState(false)
  const [isHoveringMenu, setIsHoveringMenu] = useState(false)
  const hideTimeoutRef = useRef<number | null>(null)
  const showTimeoutRef = useRef<number | null>(null)
  const [indicatorPosition, setIndicatorPosition] = useState({
    left: 0,
    top: 0,
  })

  useEffect(() => {
    // Calculate indicator position for menu positioning
    const { rect } = selection
    const offset = 8
    const isRTL = document.dir === 'rtl'

    const left = isRTL ? rect.left - 28 - offset : rect.right + offset
    const top = rect.bottom + offset

    setIndicatorPosition({ left, top })
  }, [selection])

  useEffect(() => {
    const isHovering = isHoveringIndicator || isHoveringMenu

    if (hideTimeoutRef.current !== null) {
      window.clearTimeout(hideTimeoutRef.current)
      hideTimeoutRef.current = null
    }

    if (showTimeoutRef.current !== null) {
      window.clearTimeout(showTimeoutRef.current)
      showTimeoutRef.current = null
    }

    if (isHovering) {
      // Show menu after a short delay when hovering
      showTimeoutRef.current = window.setTimeout(() => {
        setShowMenu(true)
        showTimeoutRef.current = null
      }, 150)
    } else {
      // Hide menu after a delay when not hovering
      hideTimeoutRef.current = window.setTimeout(() => {
        setShowMenu(false)
        hideTimeoutRef.current = null
      }, 300)
    }

    return () => {
      if (hideTimeoutRef.current !== null) {
        window.clearTimeout(hideTimeoutRef.current)
      }
      if (showTimeoutRef.current !== null) {
        window.clearTimeout(showTimeoutRef.current)
      }
    }
  }, [isHoveringIndicator, isHoveringMenu])

  const handleAction = async (actionId: string) => {
    await onAction(actionId, selection)
    onClose()
  }

  return (
    <>
      <SelectionIndicator
        selection={selection}
        onHoverChange={setIsHoveringIndicator}
      />
      {showMenu && (
        <SelectionActionsMenu
          selection={selection}
          indicatorPosition={indicatorPosition}
          onAction={handleAction}
          onHoverChange={setIsHoveringMenu}
        />
      )}
    </>
  )
}

export class SelectionChatWidget {
  private static overlayRoot: HTMLElement | null = null
  private root: Root | null = null
  private overlayContainer: HTMLDivElement | null = null
  private cleanupListeners: (() => void) | null = null
  private cleanupCallbacks: (() => void)[] = []

  constructor(
    private readonly options: {
      plugin: SmartComposerPlugin
      editor: Editor
      selection: SelectionInfo
      onClose: () => void
      onAction: (
        actionId: string,
        selection: SelectionInfo,
      ) => void | Promise<void>
    },
  ) {}

  mount(): void {
    const overlayRoot = SelectionChatWidget.getOverlayRoot()
    const overlayContainer = document.createElement('div')
    overlayContainer.className = 'smtcmp-selection-chat-overlay'
    overlayRoot.appendChild(overlayContainer)
    this.overlayContainer = overlayContainer

    this.root = createRoot(overlayContainer)
    this.root.render(
      <PluginProvider plugin={this.options.plugin}>
        <LanguageProvider>
          <SelectionChatWidgetBody
            plugin={this.options.plugin}
            editor={this.options.editor}
            selection={this.options.selection}
            onClose={this.handleClose}
            onAction={this.options.onAction}
          />
        </LanguageProvider>
      </PluginProvider>,
    )

    this.setupGlobalListeners()
  }

  destroy(): void {
    if (this.cleanupListeners) {
      this.cleanupListeners()
      this.cleanupListeners = null
    }
    for (const cleanup of this.cleanupCallbacks) {
      try {
        cleanup()
      } catch {
        // ignore cleanup errors
      }
    }
    this.cleanupCallbacks = []

    this.root?.unmount()
    this.root = null
    if (this.overlayContainer?.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer)
    }
    this.overlayContainer = null
  }

  private static getOverlayRoot(): HTMLElement {
    if (SelectionChatWidget.overlayRoot) {
      return SelectionChatWidget.overlayRoot
    }
    const root = document.createElement('div')
    root.className = 'smtcmp-selection-chat-overlay-root'
    document.body.appendChild(root)
    SelectionChatWidget.overlayRoot = root
    return root
  }

  private handleClose = () => {
    this.options.onClose()
  }

  private setupGlobalListeners(): void {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (this.overlayContainer?.contains(target)) return

      // Close if clicking outside
      this.handleClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        this.handleClose()
      }
    }

    // Close on scroll to avoid positioning issues
    const handleScroll = () => {
      this.handleClose()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('scroll', handleScroll, true)

    this.cleanupListeners = () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('scroll', handleScroll, true)
      this.cleanupListeners = null
    }
  }
}
