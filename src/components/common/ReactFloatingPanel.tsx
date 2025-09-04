import React, { useEffect, useRef, useState } from 'react'
import { createRoot, Root } from 'react-dom/client'

import { LanguageProvider } from '../../contexts/language-context'
import { PluginProvider } from '../../contexts/plugin-context'

export type FloatingPanelOptions = {
  title?: string
  initialPosition?: { x: number; y: number }
  width?: number
  height?: number
  closeOnEscape?: boolean
  closeOnOutsideClick?: boolean
}

type FloatingPanelProps<T> = {
  Component: React.ComponentType<T>
  props: Omit<T, 'onClose'>
  plugin?: any
  options?: FloatingPanelOptions
}

export class ReactFloatingPanel<T> {
  private root: Root | null = null
  private container: HTMLDivElement | null = null
  private Component: React.ComponentType<T>
  private props: Omit<T, 'onClose'>
  private options?: FloatingPanelOptions
  private plugin?: any

  constructor({ Component, props, options, plugin }: FloatingPanelProps<T>) {
    this.Component = Component
    this.props = props
    this.options = options
    this.plugin = plugin
  }

  open() {
    if (this.container) return

    this.container = document.createElement('div')
    this.container.className = 'smtcmp-floating-panel-container'
    Object.assign(this.container.style, {
      position: 'fixed',
      zIndex: '9999',
      top: '0px',
      left: '0px',
    })
    document.body.appendChild(this.container)

    this.root = createRoot(this.container)

    const options = this.options
    const PanelShell: React.FC<{ onClose: () => void }> = ({ onClose }) => {
      const [pos, setPos] = useState<{ x: number; y: number }>(
        options?.initialPosition ?? { x: window.innerWidth / 2 - 180, y: window.innerHeight / 2 - 120 },
      )
      const [dragging, setDragging] = useState(false)
      const dragOffset = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
      const panelRef = useRef<HTMLDivElement>(null)

      useEffect(() => {
        function onKeyDown(e: KeyboardEvent) {
          if (e.key === 'Escape' && (options?.closeOnEscape ?? true)) onClose()
        }
        if (options?.closeOnEscape ?? true) {
          document.addEventListener('keydown', onKeyDown as any)
          return () => document.removeEventListener('keydown', onKeyDown as any)
        }
      }, [])

      useEffect(() => {
        function onMouseDown(e: MouseEvent) {
          if (!panelRef.current) return
          if (!panelRef.current.contains(e.target as Node) && (options?.closeOnOutsideClick ?? true)) {
            onClose()
          }
        }
        if (options?.closeOnOutsideClick ?? true) {
          document.addEventListener('mousedown', onMouseDown)
          return () => document.removeEventListener('mousedown', onMouseDown)
        }
      }, [])

      const onHeaderPointerDown = (e: React.PointerEvent) => {
        setDragging(true)
        dragOffset.current = { x: e.clientX - pos.x, y: e.clientY - pos.y }
        ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
      }
      const onHeaderPointerMove = (e: React.PointerEvent) => {
        if (!dragging) return
        const next = { x: e.clientX - dragOffset.current.x, y: e.clientY - dragOffset.current.y }
        setPos(next)
      }
      const onHeaderPointerUp = (e: React.PointerEvent) => {
        setDragging(false)
        ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
      }

      return (
        <PluginProvider plugin={this.plugin}>
          <LanguageProvider>
            <div
              ref={panelRef}
              className="smtcmp-floating-panel"
              style={{
                position: 'fixed',
                top: pos.y,
                left: pos.x,
                width: options?.width ?? 360,
                maxWidth: '92vw',
                background: 'var(--background-primary)',
                color: 'var(--text-normal)',
                boxShadow: 'var(--shadow-s)',
                border: '1px solid var(--background-modifier-border)',
                borderRadius: 8,
              }}
            >
              <div
                className="smtcmp-floating-panel-header"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  cursor: 'move',
                  userSelect: 'none',
                  borderBottom: '1px solid var(--background-modifier-border)',
                  background: 'var(--background-secondary)',
                }}
                onPointerDown={onHeaderPointerDown}
                onPointerMove={onHeaderPointerMove}
                onPointerUp={onHeaderPointerUp}
              >
                <div style={{ fontWeight: 600 }}>{options?.title ?? ''}</div>
                <button
                  aria-label="Close"
                  className="clickable-icon"
                  onClick={onClose}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                  }}
                >
                  ✕
                </button>
              </div>
              <div className="smtcmp-floating-panel-body" style={{ padding: 12 }}>
                <this.Component {...(this.props as T)} onClose={onClose} />
              </div>
            </div>
          </LanguageProvider>
        </PluginProvider>
      )
    }

    this.root.render(<PanelShell onClose={() => this.close()} />)
  }

  close() {
    if (this.root) {
      this.root.unmount()
      this.root = null
    }
    if (this.container) {
      this.container.remove()
      this.container = null
    }
  }
}
