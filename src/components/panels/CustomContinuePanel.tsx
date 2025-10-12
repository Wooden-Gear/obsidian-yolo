import { EditorView, WidgetType } from '@codemirror/view'
import {
  Brain,
  FileText,
  Globe,
  Lightbulb,
  Link,
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
import { getChatModelClient } from '../../core/llm/manager'
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
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [instruction, setInstruction] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [useWebSearch, setUseWebSearch] = useState(false)
  const [useUrlContext, setUseUrlContext] = useState(false)

  useEffect(() => {
    inputRef.current?.focus({ preventScroll: true })
  }, [])

  // Check if current model supports Gemini tools
  const hasGeminiTools = useMemo(() => {
    try {
      const superContinuationEnabled = Boolean(
        plugin.settings?.continuationOptions?.enableSuperContinuation,
      )
      const continuationModelId = superContinuationEnabled
        ? (plugin.settings?.continuationOptions?.continuationModelId ??
          plugin.settings?.chatModelId)
        : plugin.settings?.chatModelId

      const { model } = getChatModelClient({
        settings: plugin.settings,
        modelId: continuationModelId,
      })
      return (model as any)?.toolType === 'gemini'
    } catch {
      return false
    }
  }, [plugin.settings])

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

    // Get custom quick actions from settings if available
    const customActions = plugin.settings?.continuationOptions?.smartSpaceQuickActions
    
    if (customActions && customActions.length > 0) {
      // Use custom actions
      const enabledActions = customActions.filter(action => action.enabled)
      
      // Group actions by category
      const categorizedActions = {
        suggestions: [] as SectionItem[],
        writing: [] as SectionItem[],
        thinking: [] as SectionItem[],
        custom: [] as SectionItem[],
      }
      
      const iconMap = {
        sparkles: Sparkles,
        filetext: FileText,
        listtodo: ListTodo,
        workflow: Workflow,
        table: Table,
        penline: PenLine,
        lightbulb: Lightbulb,
        brain: Brain,
        messagecircle: MessageCircle,
      } as const
      
      for (const action of enabledActions) {
        const IconComponent = iconMap[action.icon as keyof typeof iconMap] || Sparkles
        const item: SectionItem = {
          id: action.id,
          label: action.label,
          instruction: action.instruction,
          icon: <IconComponent className="smtcmp-custom-continue-item-icon-svg" size={14} />,
        }
        const category = action.category || 'custom'
        categorizedActions[category].push(item)
      }
      
      const sections: Section[] = []
      
      const categoryTitles: Record<string, string> = {
        suggestions: t('chat.customContinueSections.suggestions.title', '建议'),
        writing: t('chat.customContinueSections.writing.title', '撰写'),
        thinking: t('chat.customContinueSections.thinking.title', '思考 · 询问 · 对话'),
        custom: t('chat.customContinueSections.custom.title', '自定义'),
      }
      
      for (const [category, items] of Object.entries(categorizedActions)) {
        if (items.length > 0) {
          sections.push({
            id: category,
            title: categoryTitles[category] || category,
            items,
          })
        }
      }
      
      return sections
    } else {
      // Use default actions
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
    }
  }, [t, plugin.settings])

  const totalItems = useMemo(
    () => sections.reduce((sum, section) => sum + section.items.length, 0),
    [sections],
  )

  useEffect(() => {
    if (itemRefs.current.length !== totalItems) {
      const nextRefs = new Array<HTMLButtonElement | null>(totalItems).fill(null)
      for (let i = 0; i < totalItems; i += 1) {
        nextRefs[i] = itemRefs.current[i] ?? null
      }
      itemRefs.current = nextRefs
    }
  }, [totalItems])

  const focusFirstItem = () => {
    for (const ref of itemRefs.current) {
      if (ref && !ref.disabled) {
        ref.focus()
        return
      }
    }
  }

  const focusLastItem = () => {
    for (let i = itemRefs.current.length - 1; i >= 0; i -= 1) {
      const ref = itemRefs.current[i]
      if (ref && !ref.disabled) {
        ref.focus()
        return
      }
    }
  }

  const moveFocus = (startIndex: number, direction: 1 | -1) => {
    if (totalItems === 0) return
    let nextIndex = startIndex
    for (let i = 0; i < totalItems; i += 1) {
      nextIndex = (nextIndex + direction + totalItems) % totalItems
      const ref = itemRefs.current[nextIndex]
      if (ref && !ref.disabled) {
        ref.focus()
        return
      }
    }
  }

  const handleSubmit = async (value?: string) => {
    if (isSubmitting) return
    setIsSubmitting(true)
    setError(null)
    const payload = (value ?? instruction).trim()
    try {
      const geminiTools = hasGeminiTools
        ? { useWebSearch, useUrlContext }
        : undefined
      await plugin.continueWriting(
        editor,
        payload.length > 0 ? payload : undefined,
        geminiTools,
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
    } else if (event.key === 'ArrowDown') {
      if (totalItems === 0) return
      event.preventDefault()
      focusFirstItem()
    } else if (event.key === 'ArrowUp') {
      if (totalItems === 0) return
      event.preventDefault()
      focusLastItem()
    }
  }

  const handleItemKeyDown = (
    event: React.KeyboardEvent<HTMLButtonElement>,
    index: number,
    instructionText: string,
  ) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveFocus(index, 1)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveFocus(index, -1)
    } else if (event.key === 'Enter') {
      event.preventDefault()
      void handleSubmit(instructionText)
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
              {hasGeminiTools && (
                <div className="smtcmp-custom-continue-tools">
                  <button
                    type="button"
                    className={`smtcmp-custom-continue-tool-button ${ 
                      useWebSearch ? 'active' : ''
                    }`}
                    onClick={() => setUseWebSearch(!useWebSearch)}
                    title={t('chat.conversationSettings.webSearch', 'Web Search')}
                    aria-label={t('chat.conversationSettings.webSearch', 'Web Search')}
                  >
                    <Globe size={14} />
                  </button>
                  <button
                    type="button"
                    className={`smtcmp-custom-continue-tool-button ${
                      useUrlContext ? 'active' : ''
                    }`}
                    onClick={() => setUseUrlContext(!useUrlContext)}
                    title={t('chat.conversationSettings.urlContext', 'URL Context')}
                    aria-label={t('chat.conversationSettings.urlContext', 'URL Context')}
                  >
                    <Link size={14} />
                  </button>
                </div>
              )}
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
                {(() => {
                  let itemIndex = -1
                  return sections.map((section) => (
                    <div
                      className="smtcmp-custom-continue-section"
                      key={section.id}
                    >
                      <div className="smtcmp-custom-continue-section-title">
                        {section.title}
                      </div>
                      <div className="smtcmp-custom-continue-section-items">
                        {section.items.map((item) => {
                          itemIndex += 1
                          const currentIndex = itemIndex
                          return (
                            <button
                              key={item.id}
                              type="button"
                              className="smtcmp-custom-continue-item"
                              onClick={() => void handleSubmit(item.instruction)}
                              onKeyDown={(event) =>
                                handleItemKeyDown(event, currentIndex, item.instruction)
                              }
                              disabled={isSubmitting}
                              ref={(element) => {
                                itemRefs.current[currentIndex] = element
                              }}
                            >
                              <span className="smtcmp-custom-continue-item-icon">
                                {item.icon}
                              </span>
                              <span className="smtcmp-custom-continue-item-label">
                                {item.label}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                })()}
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
  private static currentInstance: CustomContinueWidget | null = null

  private root: Root | null = null
  private overlayContainer: HTMLDivElement | null = null
  private anchor: HTMLSpanElement | null = null
  private cleanupListeners: (() => void) | null = null
  private cleanupCallbacks: (() => void)[] = []
  private rafId: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private isClosing: boolean = false
  private closeAnimationTimeout: number | null = null

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

    // 保存当前实例的引用
    CustomContinueWidget.currentInstance = this

    this.mountOverlay()
    this.setupGlobalListeners()
    this.schedulePositionUpdate()

    return anchor
  }

  destroy(): void {
    // 清除当前实例引用
    if (CustomContinueWidget.currentInstance === this) {
      CustomContinueWidget.currentInstance = null
    }

    if (this.closeAnimationTimeout !== null) {
      window.clearTimeout(this.closeAnimationTimeout)
      this.closeAnimationTimeout = null
    }

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

  // 静态方法：从外部触发当前实例的关闭动画
  static closeCurrentWithAnimation(): boolean {
    if (CustomContinueWidget.currentInstance) {
      CustomContinueWidget.currentInstance.closeWithAnimation()
      return true
    }
    return false
  }

  private closeWithAnimation = () => {
    if (this.isClosing) return
    this.isClosing = true

    // 添加关闭动画类
    if (this.overlayContainer) {
      this.overlayContainer.classList.add('closing')
    }

    // 等待动画完成后执行真正的关闭
    this.closeAnimationTimeout = window.setTimeout(() => {
      this.closeAnimationTimeout = null
      this.options.onClose()
    }, 200) // 与 CSS 动画时长一致
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
            onClose={this.closeWithAnimation}
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
      this.closeWithAnimation()
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      this.closeWithAnimation()
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

    const scrollDom = this.options.view.scrollDOM
    const scrollRect = scrollDom?.getBoundingClientRect()
    const sizer = scrollDom?.querySelector('.cm-sizer') as HTMLElement | null
    const sizerRect = sizer?.getBoundingClientRect()

    const fallbackWidth = parseInt(
      getComputedStyle(document.documentElement)
        .getPropertyValue('--file-line-width') || '720',
      10,
    )

    const editorContentWidth = sizerRect?.width ?? scrollRect?.width ?? fallbackWidth
    const maxPanelWidth = Math.max(
      120,
      Math.min(editorContentWidth, viewportWidth - margin * 2),
    )

    const contentLeft = sizerRect?.left ?? scrollRect?.left ?? margin
    const contentRight = contentLeft + editorContentWidth

    let left = anchorRect.left
    left = Math.min(left, contentRight - maxPanelWidth)
    left = Math.max(left, contentLeft)
    left = Math.min(left, viewportWidth - margin - maxPanelWidth)
    left = Math.max(left, margin)

    const top = anchorRect.bottom + offsetY

    this.overlayContainer.style.width = `${maxPanelWidth}px`
    this.overlayContainer.style.left = `${Math.round(left)}px`
    this.overlayContainer.style.top = `${Math.round(top)}px`
  }
}
