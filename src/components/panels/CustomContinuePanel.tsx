import { EditorView, WidgetType } from '@codemirror/view'
import {
  Brain,
  FileText,
  Lightbulb,
  ListTodo,
  MessageCircle,
  PenLine,
  Sparkles,
  Table,
  Workflow,
} from 'lucide-react'
import { Editor } from 'obsidian'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Root, createRoot } from 'react-dom/client'

import { LanguageProvider, useLanguage } from '../../contexts/language-context'
import { PluginProvider, usePlugin } from '../../contexts/plugin-context'
import DotLoader from '../common/DotLoader'

type CustomContinuePanelProps = {
  editor: Editor
  onClose: () => void
}

function CustomContinuePanelBody({
  editor,
  onClose,
}: CustomContinuePanelProps) {
  const plugin = usePlugin()
  const { t } = useLanguage()
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const [instruction, setInstruction] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // 自动调整 textarea 高度
  useEffect(() => {
    const textarea = inputRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      const scrollHeight = textarea.scrollHeight
      const maxHeight = 200 // 最大高度约 8-10 行
      textarea.style.height = `${Math.min(scrollHeight, maxHeight)}px`
    }
  }, [instruction])

  const sections = useMemo(() => {
    type SectionItem = {
      id: string
      label: string
      instruction: string
      icon: React.ReactNode
    }

    type Section = {
      id: string
      title: string
      items: SectionItem[]
    }

    const makeItem = (
      id: string,
      labelKey: string,
      instructionKey: string,
      icon: React.ReactNode,
    ): SectionItem | null => {
      const label = t(labelKey, '')
      const instruction = t(instructionKey, '')
      if (!label || !instruction) return null
      return { id, label, instruction, icon }
    }

    const makeSection = (
      id: string,
      titleKey: string,
      items: (SectionItem | null)[],
    ): Section | null => {
      const title = t(titleKey, '')
      const resolvedItems = items.filter((item): item is SectionItem => !!item)
      if (!title || resolvedItems.length === 0) return null
      return { id, title, items: resolvedItems }
    }

    return [
      makeSection(
        'suggestions',
        'chat.customContinueSections.suggestions.title',
        [
          makeItem(
            'continue',
            'chat.customContinueSections.suggestions.items.continue.label',
            'chat.customContinueSections.suggestions.items.continue.instruction',
            <Sparkles
              className="smtcmp-custom-continue-item-icon-svg"
              size={14}
            />,
          ),
        ],
      ),
      makeSection('writing', 'chat.customContinueSections.writing.title', [
        makeItem(
          'summarize',
          'chat.customContinueSections.writing.items.summarize.label',
          'chat.customContinueSections.writing.items.summarize.instruction',
          <FileText
            className="smtcmp-custom-continue-item-icon-svg"
            size={14}
          />,
        ),
        makeItem(
          'todo',
          'chat.customContinueSections.writing.items.todo.label',
          'chat.customContinueSections.writing.items.todo.instruction',
          <ListTodo
            className="smtcmp-custom-continue-item-icon-svg"
            size={14}
          />,
        ),
        makeItem(
          'flowchart',
          'chat.customContinueSections.writing.items.flowchart.label',
          'chat.customContinueSections.writing.items.flowchart.instruction',
          <Workflow
            className="smtcmp-custom-continue-item-icon-svg"
            size={14}
          />,
        ),
        makeItem(
          'table',
          'chat.customContinueSections.writing.items.table.label',
          'chat.customContinueSections.writing.items.table.instruction',
          <Table className="smtcmp-custom-continue-item-icon-svg" size={14} />,
        ),
        makeItem(
          'freewrite',
          'chat.customContinueSections.writing.items.freewrite.label',
          'chat.customContinueSections.writing.items.freewrite.instruction',
          <PenLine
            className="smtcmp-custom-continue-item-icon-svg"
            size={14}
          />,
        ),
      ]),
      makeSection('thinking', 'chat.customContinueSections.thinking.title', [
        makeItem(
          'brainstorm',
          'chat.customContinueSections.thinking.items.brainstorm.label',
          'chat.customContinueSections.thinking.items.brainstorm.instruction',
          <Lightbulb
            className="smtcmp-custom-continue-item-icon-svg"
            size={14}
          />,
        ),
        makeItem(
          'analyze',
          'chat.customContinueSections.thinking.items.analyze.label',
          'chat.customContinueSections.thinking.items.analyze.instruction',
          <Brain className="smtcmp-custom-continue-item-icon-svg" size={14} />,
        ),
        makeItem(
          'dialogue',
          'chat.customContinueSections.thinking.items.dialogue.label',
          'chat.customContinueSections.thinking.items.dialogue.instruction',
          <MessageCircle
            className="smtcmp-custom-continue-item-icon-svg"
            size={14}
          />,
        ),
      ]),
    ].filter((section): section is Section => !!section)
  }, [t])

  const handleSubmit = async (value?: string) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const payload = (value ?? instruction).trim()
    try {
      await plugin.continueWriting(
        editor,
        payload.length > 0 ? payload : undefined,
      )
      onClose()
    } catch (err) {
      console.error('Custom continue failed', err)
      setIsSubmitting(false)
      setError(
        t('chat.customContinueError', 'Generation failed. Please try again.'),
      )
    }
  }

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter（含 Cmd/Ctrl+Enter）直接提交
    if (event.key === 'Enter') {
      event.preventDefault()
      void handleSubmit()
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  return (
    <div className="smtcmp-custom-continue-panel">
      {!isSubmitting ? (
        <>
          <div className="smtcmp-custom-continue-input-card">
            <div className="smtcmp-custom-continue-header">
              <div className="smtcmp-custom-continue-avatar">
                <Sparkles size={14} />
              </div>
              <div className="smtcmp-custom-continue-input-wrapper">
                <textarea
                  ref={inputRef}
                  className="smtcmp-custom-continue-input"
                  placeholder={t(
                    'chat.customContinuePromptPlaceholder',
                    'Ask AI...',
                  )}
                  value={instruction}
                  onChange={(event) => setInstruction(event.target.value)}
                  onKeyDown={handleInputKeyDown}
                  disabled={isSubmitting}
                  rows={1}
                />
                {instruction.length > 0 && (
                  <div className="smtcmp-custom-continue-input-hint">
                    {t('chat.customContinueHint', '⏎ 提交')}
                  </div>
                )}
              </div>
            </div>
          </div>
          {error && (
            <div className="smtcmp-custom-continue-error" role="alert">
              {error}
            </div>
          )}
          {sections.length > 0 && (
            <div className="smtcmp-custom-continue-section-card">
              <div className="smtcmp-custom-continue-section-list">
                {sections.map((section) => (
                  <div
                    className="smtcmp-custom-continue-section"
                    key={section.id}
                  >
                    <div className="smtcmp-custom-continue-section-title">
                      {section.title}
                    </div>
                    <div className="smtcmp-custom-continue-section-items">
                      {section.items.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          className="smtcmp-custom-continue-item"
                          onClick={() => void handleSubmit(item.instruction)}
                          disabled={isSubmitting}
                        >
                          <span className="smtcmp-custom-continue-item-icon">
                            {item.icon}
                          </span>
                          <span className="smtcmp-custom-continue-item-label">
                            {item.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="smtcmp-custom-continue-status" aria-live="polite">
          <span>{t('chat.customContinueProcessing', 'Thinking')}</span>
          <DotLoader />
        </div>
      )}
    </div>
  )
}

export class CustomContinueWidget extends WidgetType {
  private static overlayRoot: HTMLElement | null = null

  private root: Root | null = null
  private overlayContainer: HTMLDivElement | null = null
  private anchor: HTMLSpanElement | null = null
  private cleanupListeners: (() => void) | null = null
  private cleanupCallbacks: (() => void)[] = []
  private rafId: number | null = null
  private resizeObserver: ResizeObserver | null = null

  constructor(
    private readonly options: {
      plugin: any
      editor: Editor
      view: EditorView
      onClose: () => void
    },
  ) {
    super()
  }

  eq(): boolean {
    return false
  }

  toDOM(): HTMLElement {
    const anchor = document.createElement('span')
    anchor.className = 'smtcmp-custom-continue-inline-anchor'
    anchor.setAttribute('aria-hidden', 'true')
    this.anchor = anchor

    this.mountOverlay()
    this.setupGlobalListeners()
    this.schedulePositionUpdate()

    return anchor
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

    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }

    this.resizeObserver?.disconnect()
    this.resizeObserver = null

    this.root?.unmount()
    this.root = null
    if (this.overlayContainer?.parentNode) {
      this.overlayContainer.parentNode.removeChild(this.overlayContainer)
    }
    this.overlayContainer = null
    this.anchor = null
  }

  private static getOverlayRoot(): HTMLElement {
    if (CustomContinueWidget.overlayRoot)
      return CustomContinueWidget.overlayRoot
    const root = document.createElement('div')
    root.className = 'smtcmp-custom-continue-overlay-root'
    document.body.appendChild(root)
    CustomContinueWidget.overlayRoot = root
    return root
  }

  private mountOverlay() {
    const overlayRoot = CustomContinueWidget.getOverlayRoot()
    const overlayContainer = document.createElement('div')
    overlayContainer.className = 'smtcmp-custom-continue-overlay'
    overlayRoot.appendChild(overlayContainer)
    this.overlayContainer = overlayContainer

    this.root = createRoot(overlayContainer)
    this.root.render(
      <PluginProvider plugin={this.options.plugin}>
        <LanguageProvider>
          <CustomContinuePanelBody
            editor={this.options.editor}
            onClose={this.options.onClose}
          />
        </LanguageProvider>
      </PluginProvider>,
    )

    const handleScroll = () => this.schedulePositionUpdate()
    window.addEventListener('scroll', handleScroll, true)
    this.cleanupCallbacks.push(() =>
      window.removeEventListener('scroll', handleScroll, true),
    )

    const handleResize = () => this.schedulePositionUpdate()
    window.addEventListener('resize', handleResize)
    this.cleanupCallbacks.push(() =>
      window.removeEventListener('resize', handleResize),
    )

    const scrollDom = this.options.view?.scrollDOM
    if (scrollDom) {
      scrollDom.addEventListener('scroll', handleScroll)
      this.cleanupCallbacks.push(() =>
        scrollDom.removeEventListener('scroll', handleScroll),
      )
    }

    this.resizeObserver = new ResizeObserver(() =>
      this.schedulePositionUpdate(),
    )
    if (scrollDom) this.resizeObserver.observe(scrollDom)
    this.resizeObserver.observe(overlayContainer)
  }

  private setupGlobalListeners() {
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target) return
      if (this.overlayContainer?.contains(target)) return
      if (this.anchor?.contains(target)) return
      this.options.onClose()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      this.options.onClose()
    }

    window.addEventListener('pointerdown', handlePointerDown, true)
    window.addEventListener('keydown', handleKeyDown, true)
    this.cleanupListeners = () => {
      window.removeEventListener('pointerdown', handlePointerDown, true)
      window.removeEventListener('keydown', handleKeyDown, true)
      this.cleanupListeners = null
    }
  }

  private schedulePositionUpdate() {
    if (this.rafId !== null) return
    this.rafId = window.requestAnimationFrame(() => {
      this.rafId = null
      this.updateOverlayPosition()
    })
  }

  private updateOverlayPosition() {
    if (!this.overlayContainer || !this.anchor) return
    if (!this.anchor.isConnected) {
      // Anchor not mounted yet, try again on next frame
      this.schedulePositionUpdate()
      return
    }
    const anchorRect = this.anchor.getBoundingClientRect()

    const viewportWidth = window.innerWidth
    const margin = 12
    const offsetY = 6
    const maxPanelWidth = 420
    const availableWidth = Math.max(120, viewportWidth - margin * 2)
    const panelWidth = Math.min(maxPanelWidth, availableWidth)

    let left = anchorRect.left
    if (left + panelWidth > viewportWidth - margin) {
      left = viewportWidth - margin - panelWidth
    }
    if (left < margin) left = margin

    const top = anchorRect.bottom + offsetY

    this.overlayContainer.style.width = `${panelWidth}px`
    this.overlayContainer.style.left = `${Math.round(left)}px`
    this.overlayContainer.style.top = `${Math.round(top)}px`
  }
}
