import { Prec, StateEffect, StateField } from '@codemirror/state'
import { Decoration, DecorationSet, EditorView, WidgetType, keymap } from '@codemirror/view'
import { Editor, MarkdownView, Notice, Plugin, TAbstractFile, TFile, TFolder } from 'obsidian'
import { minimatch } from 'minimatch'

import { ApplyView, ApplyViewState } from './ApplyView'
import { ChatView } from './ChatView'
import { ChatProps } from './components/chat-view/Chat'
import { InstallerUpdateRequiredModal } from './components/modals/InstallerUpdateRequiredModal'
import { APPLY_VIEW_TYPE, CHAT_VIEW_TYPE } from './constants'
import { getChatModelClient } from './core/llm/manager'
import { McpManager } from './core/mcp/mcpManager'
import { RAGEngine } from './core/rag/ragEngine'
import { DatabaseManager } from './database/DatabaseManager'
import { PGLiteAbortedException } from './database/exception'
import { createTranslationFunction } from './i18n'
import { CustomContinueModal } from './components/modals/CustomContinueModal'
import { CustomContinuePanel } from './components/panels/CustomContinuePanel'
import { CustomRewritePanel } from './components/panels/CustomRewritePanel'
import { ConversationOverrideSettings } from './types/conversation-settings.types'
import {
  DEFAULT_TAB_COMPLETION_OPTIONS,
  SmartComposerSettings,
  smartComposerSettingsSchema,
} from './settings/schema/setting.types'
import { parseSmartComposerSettings } from './settings/schema/settings'
import { SmartComposerSettingTab } from './settings/SettingTab'
import { getMentionableBlockData, readTFileContent } from './utils/obsidian'

type TabCompletionGhostPayload = { from: number; text: string } | null

const tabCompletionGhostEffect = StateEffect.define<TabCompletionGhostPayload>()

class TabCompletionGhostWidget extends WidgetType {
  constructor(private readonly text: string) {
    super()
  }

  eq(other: TabCompletionGhostWidget) {
    return this.text === other.text
  }

  ignoreEvent(): boolean {
    return true
  }

  toDOM(): HTMLElement {
    const span = document.createElement('span')
    span.className = 'smtcmp-ghost-text'
    span.textContent = this.text
    return span
  }
}

const tabCompletionGhostField = StateField.define<DecorationSet>({
  create() {
    return Decoration.none
  },
  update(value, tr) {
    let decorations = value.map(tr.changes)

    for (const effect of tr.effects) {
      if (effect.is(tabCompletionGhostEffect)) {
        const payload = effect.value
        if (!payload) {
          decorations = Decoration.none
          continue
        }
        const widget = Decoration.widget({
          widget: new TabCompletionGhostWidget(payload.text),
          side: 1,
        }).range(payload.from)
        decorations = Decoration.set([widget])
      }
    }

    if (tr.docChanged) {
      decorations = Decoration.none
    }

    return decorations
  },
  provide: (field) => EditorView.decorations.from(field),
})

const tabCompletionExtensionViews = new WeakSet<EditorView>()

export default class SmartComposerPlugin extends Plugin {
  settings: SmartComposerSettings
  initialChatProps?: ChatProps // TODO: change this to use view state like ApplyView
  settingsChangeListeners: ((newSettings: SmartComposerSettings) => void)[] = []
  mcpManager: McpManager | null = null
  dbManager: DatabaseManager | null = null
  ragEngine: RAGEngine | null = null
  private dbManagerInitPromise: Promise<DatabaseManager> | null = null
  private ragEngineInitPromise: Promise<RAGEngine> | null = null
  private timeoutIds: ReturnType<typeof setTimeout>[] = [] // Use ReturnType instead of number
  private isContinuationInProgress = false
  private continuationTriggerKeyword = '  '
  private autoUpdateTimer: ReturnType<typeof setTimeout> | null = null
  private isAutoUpdating = false
  private activeAbortControllers: Set<AbortController> = new Set()
  private tabCompletionTimer: ReturnType<typeof setTimeout> | null = null
  private tabCompletionAbortController: AbortController | null = null
  private tabCompletionSuggestion: {
    editor: Editor
    view: EditorView
    text: string
    cursorOffset: number
  } | null = null
  private tabCompletionPending: {
    editor: Editor
    cursorOffset: number
  } | null = null

  // Compute a robust panel anchor position just below the caret line
  private getCaretPanelPosition(editor: Editor, dy = 8): { x: number; y: number } | undefined {
    try {
      // CM6: use selection head to get viewport coords
      const cm: any = (editor as any).cm
      const head: number | undefined = cm?.state?.selection?.main?.head
      if (cm?.coordsAtPos && typeof head === 'number') {
        const rect = cm.coordsAtPos(head)
        if (rect) {
          const y = (rect.bottom ?? rect.top) + dy
          return { x: rect.left, y }
        }
      }
    } catch {}
    // Fallback: center (handled by caller when returning undefined)
    return undefined
  }

  private getActiveConversationOverrides():
    | ConversationOverrideSettings
    | undefined {
    const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
    for (const leaf of leaves) {
      const view = leaf.view
      if (
        view instanceof ChatView &&
        typeof view.getCurrentConversationOverrides === 'function'
      ) {
        return view.getCurrentConversationOverrides()
      }
    }
    return undefined
  }

  private getActiveConversationModelId(): string | undefined {
    const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
    for (const leaf of leaves) {
      const view = leaf.view
      if (
        view instanceof ChatView &&
        typeof view.getCurrentConversationModelId === 'function'
      ) {
        const modelId = view.getCurrentConversationModelId()
        if (modelId) return modelId
      }
    }
    return undefined
  }

  private resolveSamplingParams(overrides?: ConversationOverrideSettings): {
    temperature?: number
    topP?: number
    stream: boolean
  } {
    const defaultTemperature = this.settings.chatOptions.defaultTemperature
    const defaultTopP = this.settings.chatOptions.defaultTopP

    const temperature =
      typeof overrides?.temperature === 'number'
        ? overrides.temperature
        : typeof defaultTemperature === 'number'
          ? defaultTemperature
          : undefined

    const topP =
      typeof overrides?.top_p === 'number'
        ? overrides.top_p
        : typeof defaultTopP === 'number'
          ? defaultTopP
          : undefined

    const stream =
      typeof overrides?.stream === 'boolean' ? overrides.stream : true

    return { temperature, topP, stream }
  }

  get t() {
    return createTranslationFunction(this.settings.language || 'en')
  }

  private cancelAllAiTasks() {
    if (this.activeAbortControllers.size === 0) {
      this.isContinuationInProgress = false
      return
    }
    for (const controller of Array.from(this.activeAbortControllers)) {
      try {
        controller.abort()
      } catch {}
    }
    this.activeAbortControllers.clear()
    this.isContinuationInProgress = false
    this.tabCompletionAbortController = null
  }

  private getEditorView(editor: Editor | null | undefined): EditorView | null {
    if (!editor) return null
    const view = (editor as any)?.cm as EditorView | undefined
    return view ?? null
  }

  private ensureTabCompletionExtension(view: EditorView) {
    if (tabCompletionExtensionViews.has(view)) return
    view.dispatch({
      effects: StateEffect.appendConfig.of([
        tabCompletionGhostField,
        Prec.high(
          keymap.of([
            {
              key: 'Tab',
              run: (v) => this.tryAcceptTabCompletionFromView(v),
            },
          ]),
        ),
      ]),
    })
    tabCompletionExtensionViews.add(view)
  }

  private setTabCompletionGhost(view: EditorView, payload: TabCompletionGhostPayload) {
    this.ensureTabCompletionExtension(view)
    view.dispatch({ effects: tabCompletionGhostEffect.of(payload) })
  }

  private getTabCompletionOptions() {
    return {
      ...DEFAULT_TAB_COMPLETION_OPTIONS,
      ...(this.settings.continuationOptions.tabCompletionOptions ?? {}),
    }
  }

  private clearTabCompletionTimer() {
    if (this.tabCompletionTimer) {
      clearTimeout(this.tabCompletionTimer)
      this.tabCompletionTimer = null
    }
    this.tabCompletionPending = null
  }

  private cancelTabCompletionRequest() {
    if (!this.tabCompletionAbortController) return
    try {
      this.tabCompletionAbortController.abort()
    } catch {}
    this.activeAbortControllers.delete(this.tabCompletionAbortController)
    this.tabCompletionAbortController = null
  }

  private clearTabCompletionSuggestion() {
    if (!this.tabCompletionSuggestion) return
    const { view } = this.tabCompletionSuggestion
    if (view) {
      this.setTabCompletionGhost(view, null)
    }
    this.tabCompletionSuggestion = null
  }

  private scheduleTabCompletion(editor: Editor) {
    const view = this.getEditorView(editor)
    if (!view) return
    const selection = editor.getSelection()
    if (selection && selection.length > 0) return
    const cursorOffset = view.state.selection.main.head

    const options = this.getTabCompletionOptions()
    const delay = Math.max(0, options.triggerDelayMs)

    this.clearTabCompletionTimer()
    this.tabCompletionPending = { editor, cursorOffset }
    this.tabCompletionTimer = window.setTimeout(() => {
      if (!this.tabCompletionPending) return
      if (this.tabCompletionPending.editor !== editor) return
      void this.runTabCompletion(editor, cursorOffset)
    }, delay)
  }

  private async runTabCompletion(editor: Editor, scheduledCursorOffset: number) {
    try {
      if (!this.settings.continuationOptions?.enableTabCompletion) return
      if (this.isContinuationInProgress) return

      const view = this.getEditorView(editor)
      if (!view) return
      if (view.state.selection.main.head !== scheduledCursorOffset) return
      const selection = editor.getSelection()
      if (selection && selection.length > 0) return

      const options = this.getTabCompletionOptions()

      const cursorPos = editor.getCursor()
      const headText = editor.getRange({ line: 0, ch: 0 }, cursorPos)
      const headLength = headText.trim().length
      if (!headText || headLength === 0) return
      if (headLength < options.minContextLength) return

      const context =
        headText.length > options.maxContextChars
          ? headText.slice(-options.maxContextChars)
          : headText

      let modelId = this.settings.continuationOptions.tabCompletionModelId
      if (!modelId || modelId.length === 0) {
        modelId = this.settings.continuationOptions.fixedModelId
      }
      if (!modelId) return

      const sidebarOverrides = this.getActiveConversationOverrides()
      const { temperature, topP } = this.resolveSamplingParams(sidebarOverrides)

      const { providerClient, model } = getChatModelClient({
        settings: this.settings,
        modelId,
      })

      const fileTitle = this.app.workspace.getActiveFile()?.basename?.trim()
      const titleSection = fileTitle ? `File title: ${fileTitle}\n\n` : ''
      const systemPrompt =
        'You are a helpful assistant providing inline writing suggestions. Predict a concise continuation after the user\'s cursor. Do not repeat existing text. Return only the suggested continuation without quotes or extra commentary.'

      const isBaseModel = Boolean((model as any).isBaseModel)
      const baseModelSpecialPrompt =
        (this.settings.chatOptions.baseModelSpecialPrompt ?? '').trim()
      const basePromptSection =
        isBaseModel && baseModelSpecialPrompt.length > 0
          ? `${baseModelSpecialPrompt}\n\n`
          : ''
      const userContent = isBaseModel
        ? `${basePromptSection}${context}\n\nPredict the next words that continue naturally.`
        : `${basePromptSection}${titleSection}Recent context:\n\n${context}\n\nProvide the next words that would help continue naturally.`

      const requestMessages = [
        ...(isBaseModel
          ? []
          : ([
              {
                role: 'system' as const,
                content: systemPrompt,
              },
            ] as const)),
        {
          role: 'user' as const,
          content: userContent,
        },
      ]

      this.cancelTabCompletionRequest()
      this.clearTabCompletionSuggestion()
      this.tabCompletionPending = null

      const controller = new AbortController()
      this.tabCompletionAbortController = controller
      this.activeAbortControllers.add(controller)

      const baseRequest: any = {
        model: model.model,
        messages: requestMessages as unknown as any,
        stream: false,
        max_tokens: 64,
      }
      if (typeof options.temperature === 'number') {
        baseRequest.temperature = Math.min(Math.max(options.temperature, 0), 2)
      } else if (typeof temperature === 'number') {
        baseRequest.temperature = Math.min(Math.max(temperature, 0), 2)
      } else {
        baseRequest.temperature = DEFAULT_TAB_COMPLETION_OPTIONS.temperature
      }
      if (typeof topP === 'number') {
        baseRequest.top_p = topP
      }
      const requestTimeout = Math.max(0, options.requestTimeoutMs)
      const attempts = Math.max(0, Math.floor(options.maxRetries)) + 1

      this.cancelTabCompletionRequest()
      this.clearTabCompletionSuggestion()
      this.tabCompletionPending = null

      for (let attempt = 0; attempt < attempts; attempt++) {
        const controller = new AbortController()
        this.tabCompletionAbortController = controller
        this.activeAbortControllers.add(controller)

        let timeoutHandle: ReturnType<typeof setTimeout> | null = null
        if (requestTimeout > 0) {
          timeoutHandle = window.setTimeout(() => controller.abort(), requestTimeout)
        }

        try {
          const response = await providerClient.generateResponse(
            model,
            baseRequest,
            { signal: controller.signal },
          )

          if (timeoutHandle) clearTimeout(timeoutHandle)

          let suggestion = response.choices?.[0]?.message?.content ?? ''
          suggestion = suggestion.replace(/\r\n/g, '\n').replace(/\s+$/, '')
          if (!suggestion.trim()) return
          if (/^[\s\n\t]+$/.test(suggestion)) return

          // Avoid leading line breaks which look awkward in ghost text
          suggestion = suggestion.replace(/^[\s\n\t]+/, '')

          // Guard against large multiline insertions
          if (suggestion.length > options.maxSuggestionLength) {
            suggestion = suggestion.slice(0, options.maxSuggestionLength)
          }

          const currentView = this.getEditorView(editor)
          if (!currentView) return
          if (currentView.state.selection.main.head !== scheduledCursorOffset) return
          if (editor.getSelection()?.length) return

          this.setTabCompletionGhost(currentView, {
            from: scheduledCursorOffset,
            text: suggestion,
          })
          this.tabCompletionSuggestion = {
            editor,
            view: currentView,
            text: suggestion,
            cursorOffset: scheduledCursorOffset,
          }
          return
        } catch (error) {
          if (timeoutHandle) clearTimeout(timeoutHandle)

          const aborted = controller.signal.aborted || (error as any)?.name === 'AbortError'
          if (attempt < attempts - 1 && aborted) {
            this.activeAbortControllers.delete(controller)
            this.tabCompletionAbortController = null
            continue
          }
          if ((error as any)?.name === 'AbortError') {
            return
          }
          console.error('Tab completion failed:', error)
          return
        } finally {
          if (this.tabCompletionAbortController === controller) {
            this.activeAbortControllers.delete(controller)
            this.tabCompletionAbortController = null
          } else {
            this.activeAbortControllers.delete(controller)
          }
        }
      }
    } catch (error) {
      if ((error as any)?.name === 'AbortError') return
      console.error('Tab completion failed:', error)
    } finally {
      if (this.tabCompletionAbortController) {
        this.activeAbortControllers.delete(this.tabCompletionAbortController)
        this.tabCompletionAbortController = null
      }
    }
  }

  private tryAcceptTabCompletionFromView(view: EditorView): boolean {
    const suggestion = this.tabCompletionSuggestion
    if (!suggestion) return false
    if (suggestion.view !== view) return false

    if (view.state.selection.main.head !== suggestion.cursorOffset) {
      this.clearTabCompletionSuggestion()
      return false
    }

    const editor = suggestion.editor
    if (this.getEditorView(editor) !== view) {
      this.clearTabCompletionSuggestion()
      return false
    }

    if (editor.getSelection()?.length) {
      this.clearTabCompletionSuggestion()
      return false
    }

    const cursor = editor.getCursor()
    const suggestionText = suggestion.text
    this.clearTabCompletionSuggestion()
    editor.replaceRange(suggestionText, cursor, cursor)

    const parts = suggestionText.split('\n')
    const endCursor =
      parts.length === 1
        ? { line: cursor.line, ch: cursor.ch + parts[0].length }
        : {
            line: cursor.line + parts.length - 1,
            ch: parts[parts.length - 1].length,
          }
    editor.setCursor(endCursor)
    return true
  }

  private handleTabCompletionEditorChange(editor: Editor) {
    this.clearTabCompletionTimer()
    this.cancelTabCompletionRequest()

    if (!this.settings.continuationOptions?.enableTabCompletion) {
      this.clearTabCompletionSuggestion()
      return
    }

    if (this.isContinuationInProgress) {
      this.clearTabCompletionSuggestion()
      return
    }

    this.clearTabCompletionSuggestion()
    this.scheduleTabCompletion(editor)
  }

  private async handleCustomRewrite(editor: Editor, customPrompt?: string) {
    const selected = editor.getSelection()
    if (!selected || selected.trim().length === 0) {
      new Notice('请先选择要改写的文本。')
      return
    }

    const notice = new Notice('正在生成改写...', 0)
    let controller: AbortController | null = null
    try {
      const sidebarOverrides = this.getActiveConversationOverrides()
      const { temperature, topP } = this.resolveSamplingParams(sidebarOverrides)

      const { providerClient, model } = getChatModelClient({
        settings: this.settings,
        modelId: this.settings.applyModelId,
      })

      const systemPrompt =
        'You are an intelligent assistant that rewrites ONLY the provided markdown text according to the instruction. Preserve the original meaning, structure, and any markdown (links, emphasis, code) unless explicitly told otherwise. Output ONLY the rewritten text without code fences or extra explanations.'

      const instruction = (customPrompt ?? '').trim()
      const isBaseModel = Boolean((model as any).isBaseModel)
      const baseModelSpecialPrompt =
        (this.settings.chatOptions.baseModelSpecialPrompt ?? '').trim()
      const basePromptSection =
        isBaseModel && baseModelSpecialPrompt.length > 0
          ? `${baseModelSpecialPrompt}\n\n`
          : ''
      const requestMessages = [
        ...(isBaseModel
          ? []
          : ([{ role: 'system' as const, content: systemPrompt }] as const)),
        {
          role: 'user' as const,
          content: `${basePromptSection}Instruction:\n${instruction}\n\nSelected text:\n${selected}\n\nRewrite the selected text accordingly. Output only the rewritten text.`,
        },
      ] as const

      controller = new AbortController()
      this.activeAbortControllers.add(controller)

      const rewriteRequest: any = {
        model: model.model,
        messages: requestMessages as unknown as any,
        stream: false,
        prediction: {
          type: 'content',
          content: [
            { type: 'text', text: selected },
            { type: 'text', text: instruction },
          ],
        },
      }
      if (typeof temperature === 'number') {
        rewriteRequest.temperature = temperature
      }
      if (typeof topP === 'number') {
        rewriteRequest.top_p = topP
      }

      const response = await providerClient.generateResponse(
        model,
        rewriteRequest,
        { signal: controller.signal },
      )

      const stripFences = (s: string) => {
        const lines = (s ?? '').split('\n')
        if (lines.length > 0 && lines[0].startsWith('```')) lines.shift()
        if (lines.length > 0 && lines[lines.length - 1].startsWith('```')) lines.pop()
        return lines.join('\n')
      }

      const rewritten = stripFences(response.choices?.[0]?.message?.content ?? '').trim()
      if (!rewritten) {
        notice.setMessage('未生成改写内容。')
        this.registerTimeout(() => notice.hide(), 1200)
        return
      }

      // Open ApplyView with a preview diff and let user choose; ApplyView will close back to doc
      const activeFile = this.app.workspace.getActiveFile()
      if (!activeFile) {
        notice.setMessage('未找到当前文件。')
        this.registerTimeout(() => notice.hide(), 1200)
        return
      }

      const from = editor.getCursor('from')
      const head = editor.getRange({ line: 0, ch: 0 }, from)
      const originalContent = await readTFileContent(activeFile, this.app.vault)
      const tail = originalContent.slice(head.length + selected.length)
      const newContent = head + rewritten + tail

      await this.app.workspace.getLeaf(true).setViewState({
        type: APPLY_VIEW_TYPE,
        active: true,
        state: {
          file: activeFile,
          originalContent,
          newContent,
        } satisfies ApplyViewState,
      })

      notice.setMessage('改写结果已生成。')
      this.registerTimeout(() => notice.hide(), 1200)
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        notice.setMessage('已取消生成。')
        this.registerTimeout(() => notice.hide(), 1000)
      } else {
        console.error(error)
        notice.setMessage('改写失败。')
        this.registerTimeout(() => notice.hide(), 1200)
      }
    } finally {
      if (controller) this.activeAbortControllers.delete(controller)
    }
  }

  async onload() {
    await this.loadSettings()
    // initialize keyword from settings
    this.continuationTriggerKeyword =
      this.settings.continuationOptions?.triggerKeyword ?? this.continuationTriggerKeyword

    // keep keyword in sync with settings changes
    this.addSettingsChangeListener((newSettings) => {
      this.continuationTriggerKeyword =
        newSettings.continuationOptions?.triggerKeyword ?? this.continuationTriggerKeyword
    })

    this.registerView(CHAT_VIEW_TYPE, (leaf) => new ChatView(leaf, this))
    this.registerView(APPLY_VIEW_TYPE, (leaf) => new ApplyView(leaf))

    // This creates an icon in the left ribbon.
    this.addRibbonIcon('wand-sparkles', this.t('commands.openChat'), () =>
      this.openChatView(),
    )

    // This adds a simple command that can be triggered anywhere
    this.addCommand({
      id: 'open-new-chat',
      name: this.t('commands.openChat'),
      callback: () => this.openChatView(true),
    })

    // Global ESC to cancel any ongoing AI continuation/rewrite
    this.registerDomEvent(document, 'keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        // Do not prevent default so other ESC behaviors (close modals, etc.) still work
        this.cancelAllAiTasks()
      }
    })

    this.addCommand({
      id: 'add-selection-to-chat',
      name: this.t('commands.addSelectionToChat'),
      editorCallback: (editor: Editor, view: MarkdownView) => {
        this.addSelectionToChat(editor, view)
      },
    })
    
    // Auto update: listen to vault file changes and schedule incremental index updates
    this.registerEvent(this.app.vault.on('create', (file) => this.onVaultFileChanged(file)))
    this.registerEvent(this.app.vault.on('modify', (file) => this.onVaultFileChanged(file)))
    this.registerEvent(this.app.vault.on('delete', (file) => this.onVaultFileChanged(file)))
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.onVaultFileChanged(file)
      if (oldPath) this.onVaultPathChanged(oldPath)
    }))

    this.addCommand({
      id: 'rebuild-vault-index',
      name: this.t('commands.rebuildVaultIndex'),
      callback: async () => {
        const notice = new Notice(this.t('notices.rebuildingIndex'), 0)
        try {
          const ragEngine = await this.getRAGEngine()
          await ragEngine.updateVaultIndex(
            { reindexAll: true },
            (queryProgress) => {
              if (queryProgress.type === 'indexing') {
                const { completedChunks, totalChunks } =
                  queryProgress.indexProgress
                notice.setMessage(
                  `Indexing chunks: ${completedChunks} / ${totalChunks}${
                    queryProgress.indexProgress.waitingForRateLimit
                      ? '\n(waiting for rate limit to reset)'
                      : ''
                  }`,
                )
              }
            },
          )
          notice.setMessage(this.t('notices.rebuildComplete'))
        } catch (error) {
          console.error(error)
          notice.setMessage(this.t('notices.rebuildFailed'))
        } finally {
          this.registerTimeout(() => {
            notice.hide()
          }, 1000)
        }
      },
    })

    this.addCommand({
      id: 'update-vault-index',
      name: this.t('commands.updateVaultIndex'),
      callback: async () => {
        const notice = new Notice(this.t('notices.updatingIndex'), 0)
        try {
          const ragEngine = await this.getRAGEngine()
          await ragEngine.updateVaultIndex(
            { reindexAll: false },
            (queryProgress) => {
              if (queryProgress.type === 'indexing') {
                const { completedChunks, totalChunks } =
                  queryProgress.indexProgress
                notice.setMessage(
                  `Indexing chunks: ${completedChunks} / ${totalChunks}${
                    queryProgress.indexProgress.waitingForRateLimit
                      ? '\n(waiting for rate limit to reset)'
                      : ''
                  }`,
                )
              }
            },
          )
          notice.setMessage(this.t('notices.indexUpdated'))
        } catch (error) {
          console.error(error)
          notice.setMessage(this.t('notices.indexUpdateFailed'))
        } finally {
          this.registerTimeout(() => {
            notice.hide()
          }, 1000)
        }
      },
    })
    // This adds a settings tab so the user can configure various aspects of the plugin
    this.addSettingTab(new SmartComposerSettingTab(this.app, this))

    // removed templates JSON migration

    // Editor context menu: AI Continue Writing
    this.registerEvent(
      this.app.workspace.on('editor-menu', (menu, editor) => {
        const hasSelection = (() => {
          try {
            const sel = editor?.getSelection?.()
            return !!sel && sel.trim().length > 0
          } catch {
            return false
          }
        })()

        const title = hasSelection
          ? this.t('commands.continueWritingSelected')
          : this.t('commands.continueWriting')

        menu.addItem((item) =>
          item
            .setTitle(title)
            .setIcon('wand-sparkles')
            .onClick(async () => {
              await this.handleContinueWriting(editor)
            }),
        )

        // Custom continuation via floating panel
        menu.addItem((item) =>
          item
            .setTitle(this.t('commands.customContinueWriting'))
            .setIcon('wand-sparkles')
            .onClick(() => {
              const position = this.getCaretPanelPosition(editor, 8)
              new CustomContinuePanel({ plugin: this, editor, position }).open()
            }),
        )

        // Custom rewrite via floating panel (only when there is a selection)
        if (hasSelection) {
          menu.addItem((item) =>
            item
              .setTitle(this.t('commands.customRewrite'))
              .setIcon('wand-sparkles')
              .onClick(() => {
                const position = this.getCaretPanelPosition(editor, 8)
                new CustomRewritePanel({ plugin: this, editor, position }).open()
              }),
          )
        }
      }),
    )

    // Keyword triggers: floating panel (custom continue) and inline continuation
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor) => {
        try {
          if (!editor) return
          this.handleTabCompletionEditorChange(editor)
          if (this.isContinuationInProgress) return
          const selection = editor.getSelection()
          const cursor = editor.getCursor()

          // 1) Floating panel trigger (optional)
          const enablePanel =
            this.settings.continuationOptions?.enableFloatingPanelKeywordTrigger ?? false
          const panelKeyword = this.settings.continuationOptions?.floatingPanelTriggerKeyword ?? ''
          if (enablePanel && panelKeyword && panelKeyword.length > 0) {
            const klen = panelKeyword.length
            const start = { line: cursor.line, ch: Math.max(0, cursor.ch - klen) }
            const before = editor.getRange(start, cursor)
            if (before === panelKeyword) {
              // remove keyword and open panel near caret
              editor.replaceRange('', start, cursor)
              {
                const position = this.getCaretPanelPosition(editor, 8)
                const hasSel = !!selection && selection.trim().length > 0
                if (hasSel) {
                  new CustomRewritePanel({ plugin: this, editor, position }).open()
                } else {
                  new CustomContinuePanel({ plugin: this, editor, position }).open()
                }
              }
              return
            }
          }

          // 2) Continuation trigger (inline)
          if (!this.settings.continuationOptions?.enableKeywordTrigger) return
          // Only run inline continuation when there is NO selection
          if (selection && selection.length > 0) return
          const keyword =
            this.settings.continuationOptions?.triggerKeyword ?? this.continuationTriggerKeyword
          if (!keyword || keyword.length === 0) return
          const keyLen = keyword.length
          const start = { line: cursor.line, ch: Math.max(0, cursor.ch - keyLen) }
          const before = editor.getRange(start, cursor)
          if (before === keyword) {
            // Mark in-progress first to suppress re-entrancy from subsequent editor-change
            this.isContinuationInProgress = true
            // Remove the trigger keyword before starting streaming continuation
            editor.replaceRange('', start, cursor)
            // Defer continuation to next tick to avoid interfering with current input transaction
            setTimeout(() => {
              void this.handleContinueWriting(editor)
            }, 0)
          }
        } catch (err) {
          console.error('Keyword trigger error:', err)
        }
      }),
    )
  }

  onunload() {
    // clear all timers
    this.timeoutIds.forEach((id) => clearTimeout(id))
    this.timeoutIds = []

    // RagEngine cleanup
    this.ragEngine?.cleanup()
    this.ragEngine = null

    // Promise cleanup
    this.dbManagerInitPromise = null
    this.ragEngineInitPromise = null

    // DatabaseManager cleanup
    this.dbManager?.cleanup()
    this.dbManager = null

    // McpManager cleanup
    this.mcpManager?.cleanup()
    this.mcpManager = null
    if (this.autoUpdateTimer) {
      clearTimeout(this.autoUpdateTimer)
      this.autoUpdateTimer = null
    }
    // Ensure all in-flight requests are aborted on unload
    this.cancelAllAiTasks()
    this.clearTabCompletionTimer()
    this.cancelTabCompletionRequest()
    this.clearTabCompletionSuggestion()
  }

  async loadSettings() {
    this.settings = parseSmartComposerSettings(await this.loadData())
    await this.saveData(this.settings) // Save updated settings
  }

  async setSettings(newSettings: SmartComposerSettings) {
    const validationResult = smartComposerSettingsSchema.safeParse(newSettings)

    if (!validationResult.success) {
      new Notice(`Invalid settings:
${validationResult.error.issues.map((v) => v.message).join('\n')}`)
      return
    }

    this.settings = newSettings
    await this.saveData(newSettings)
    this.ragEngine?.setSettings(newSettings)
    this.settingsChangeListeners.forEach((listener) => listener(newSettings))
  }

  addSettingsChangeListener(
    listener: (newSettings: SmartComposerSettings) => void,
  ) {
    this.settingsChangeListeners.push(listener)
    return () => {
      this.settingsChangeListeners = this.settingsChangeListeners.filter(
        (l) => l !== listener,
      )
    }
  }

  async openChatView(openNewChat = false) {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView)
    const editor = view?.editor
    if (!view || !editor) {
      this.activateChatView(undefined, openNewChat)
      return
    }
    const selectedBlockData = await getMentionableBlockData(editor, view)
    this.activateChatView(
      {
        selectedBlock: selectedBlockData ?? undefined,
      },
      openNewChat,
    )
  }

  async activateChatView(chatProps?: ChatProps, openNewChat = false) {
    // chatProps is consumed in ChatView.tsx
    this.initialChatProps = chatProps

    const leaf = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0]

    await (leaf ?? this.app.workspace.getRightLeaf(false))?.setViewState({
      type: CHAT_VIEW_TYPE,
      active: true,
    })

    if (openNewChat && leaf && leaf.view instanceof ChatView) {
      leaf.view.openNewChat(chatProps?.selectedBlock)
    }

    this.app.workspace.revealLeaf(
      this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)[0],
    )
  }

  async addSelectionToChat(editor: Editor, view: MarkdownView) {
    const data = await getMentionableBlockData(editor, view)
    if (!data) return

    const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
    if (leaves.length === 0 || !(leaves[0].view instanceof ChatView)) {
      await this.activateChatView({
        selectedBlock: data,
      })
      return
    }

    // bring leaf to foreground (uncollapse sidebar if it's collapsed)
    await this.app.workspace.revealLeaf(leaves[0])

    const chatView = leaves[0].view
    chatView.addSelectionToChat(data)
    chatView.focusMessage()
  }

  async getDbManager(): Promise<DatabaseManager> {
    if (this.dbManager) {
      return this.dbManager
    }

    if (!this.dbManagerInitPromise) {
      this.dbManagerInitPromise = (async () => {
        try {
          this.dbManager = await DatabaseManager.create(this.app)
          return this.dbManager
        } catch (error) {
          this.dbManagerInitPromise = null
          if (error instanceof PGLiteAbortedException) {
            new InstallerUpdateRequiredModal(this.app).open()
          }
          throw error
        }
      })()
    }

    // if initialization is running, wait for it to complete instead of creating a new initialization promise
    return this.dbManagerInitPromise
  }

  async getRAGEngine(): Promise<RAGEngine> {
    if (this.ragEngine) {
      return this.ragEngine
    }

    if (!this.ragEngineInitPromise) {
      this.ragEngineInitPromise = (async () => {
        try {
          const dbManager = await this.getDbManager()
          this.ragEngine = new RAGEngine(
            this.app,
            this.settings,
            dbManager.getVectorManager(),
          )
          return this.ragEngine
        } catch (error) {
          this.ragEngineInitPromise = null
          throw error
        }
      })()
    }

    return this.ragEngineInitPromise
  }

  async getMcpManager(): Promise<McpManager> {
    if (this.mcpManager) {
      return this.mcpManager
    }

    try {
      this.mcpManager = new McpManager({
        settings: this.settings,
        registerSettingsListener: (
          listener: (settings: SmartComposerSettings) => void,
        ) => this.addSettingsChangeListener(listener),
      })
      await this.mcpManager.initialize()
      return this.mcpManager
    } catch (error) {
      this.mcpManager = null
      throw error
    }
  }

  private registerTimeout(callback: () => void, timeout: number): void {
    const timeoutId = setTimeout(callback, timeout)
    this.timeoutIds.push(timeoutId)
  }

  // ===== Auto Update helpers =====
  private onVaultFileChanged(file: TAbstractFile) {
    try {
      // 使用严格类型判断，避免通过 any 访问 path
      if (file instanceof TFile || file instanceof TFolder) {
        this.onVaultPathChanged(file.path)
      }
    } catch {}
  }

  private onVaultPathChanged(path: string) {
    if (!this.settings?.ragOptions?.autoUpdateEnabled) return
    if (!this.isPathSelectedByIncludeExclude(path)) return
    // Check minimal interval
    const intervalMs = (this.settings.ragOptions.autoUpdateIntervalHours ?? 24) * 60 * 60 * 1000
    const last = this.settings.ragOptions.lastAutoUpdateAt ?? 0
    const now = Date.now()
    if (now - last < intervalMs) {
      // Still within cool-down; no action
      return
    }
    // Debounce multiple changes within a short window
    if (this.autoUpdateTimer) clearTimeout(this.autoUpdateTimer)
    this.autoUpdateTimer = setTimeout(() => void this.runAutoUpdate(), 3000)
  }

  private isPathSelectedByIncludeExclude(path: string): boolean {
    const { includePatterns = [], excludePatterns = [] } = this.settings?.ragOptions ?? {}
    // Exclude has priority
    if (excludePatterns.some((p) => minimatch(path, p))) return false
    if (!includePatterns || includePatterns.length === 0) return true
    return includePatterns.some((p) => minimatch(path, p))
  }

  private async runAutoUpdate() {
    if (this.isAutoUpdating) return
    this.isAutoUpdating = true
    try {
      const ragEngine = await this.getRAGEngine()
      await ragEngine.updateVaultIndex(
        { reindexAll: false },
        undefined,
      )
      await this.setSettings({
        ...this.settings,
        ragOptions: {
          ...this.settings.ragOptions,
          lastAutoUpdateAt: Date.now(),
        },
      })
      new Notice(this.t('notices.indexUpdated'))
    } catch (e) {
      console.error('Auto update index failed:', e)
      new Notice(this.t('notices.indexUpdateFailed'))
    } finally {
      this.isAutoUpdating = false
      this.autoUpdateTimer = null
    }
  }

  // Public wrapper for use in React modal
  async continueWriting(editor: Editor, customPrompt?: string) {
    return this.handleContinueWriting(editor, customPrompt)
  }

  // Public wrapper for use in React panel
  async customRewrite(editor: Editor, customPrompt?: string) {
    return this.handleCustomRewrite(editor, customPrompt)
  }

  private async handleContinueWriting(editor: Editor, customPrompt?: string) {
    let controller: AbortController | null = null
    try {
      const notice = new Notice('Generating continuation...', 0)
      const cursor = editor.getCursor()
      const selected = editor.getSelection()
      const headText = editor.getRange({ line: 0, ch: 0 }, cursor)

      // Prefer selected text as context when available; otherwise use preceding content
      const hasSelection = !!selected && selected.trim().length > 0
      const baseContext = hasSelection ? selected : headText
      const fallbackInstruction = (customPrompt ?? '').trim()
      const fileTitleCandidate = this.app.workspace.getActiveFile()?.basename?.trim() ?? ''

      if (!baseContext || baseContext.trim().length === 0) {
        // 没有前文时，如果既没有自定义指令也没有文件标题，则提示无法续写；
        // 否则允许基于标题或自定义指令开始写作
        if (!fallbackInstruction && !fileTitleCandidate) {
          notice.setMessage('No preceding content to continue.')
          this.registerTimeout(() => notice.hide(), 1000)
          return
        }
      }

      // Truncate context to avoid exceeding model limits (simple char-based cap)
      const MAX_CONTEXT_CHARS = 8000
      const context =
        baseContext.length > MAX_CONTEXT_CHARS
          ? baseContext.slice(-MAX_CONTEXT_CHARS)
          : baseContext

      const continuationModelId = this.settings.continuationOptions?.useCurrentModel
        ? this.getActiveConversationModelId() ?? this.settings.chatModelId
        : this.settings.continuationOptions.fixedModelId

      const sidebarOverrides = this.getActiveConversationOverrides()
      const { temperature, topP, stream: streamPreference } =
        this.resolveSamplingParams(sidebarOverrides)

      const { providerClient, model } = getChatModelClient({
        settings: this.settings,
        modelId: continuationModelId,
      })

      const userInstruction = (customPrompt ?? '').trim()
      const instructionSuffix = userInstruction
        ? `\n\nInstruction: ${userInstruction}`
        : ''

      const systemPrompt =
        this.settings.continuationOptions?.defaultSystemPrompt?.trim() &&
        (this.settings.continuationOptions.defaultSystemPrompt as string).trim().length > 0
          ? (this.settings.continuationOptions.defaultSystemPrompt as string).trim()
          : 'You are a helpful writing assistant. Continue writing from the provided context without repeating or paraphrasing the context. Match the tone, language, and style. Output only the continuation text.'

      const activeFileForTitle = this.app.workspace.getActiveFile()
      const fileTitle = activeFileForTitle?.basename?.trim() ?? ''
      const titleLine = fileTitle ? `File title: ${fileTitle}\n\n` : ''
      const hasContext = (baseContext ?? '').trim().length > 0
      const contextSection = hasContext
        ? `Context (up to recent portion):\n\n${context}\n\n`
        : ''
      const baseModelContextSection = hasContext ? `${context}\n\n` : ''
      const continueText = hasSelection || hasContext
        ? 'Continue writing from here.'
        : 'Start writing this document.'

      const isBaseModel = Boolean((model as any).isBaseModel)
      const baseModelSpecialPrompt =
        (this.settings.chatOptions.baseModelSpecialPrompt ?? '').trim()
      const basePromptSection =
        isBaseModel && baseModelSpecialPrompt.length > 0
          ? `${baseModelSpecialPrompt}\n\n`
          : ''
      const baseModelCoreContent = `${basePromptSection}${titleLine}${baseModelContextSection}`
      const baseModelInstructionSuffix = userInstruction
        ? `${baseModelCoreContent.trim().length > 0 ? '\n\n' : ''}Instruction: ${userInstruction}`
        : ''

      const requestMessages = [
        ...(isBaseModel
          ? []
          : ([
              {
                role: 'system' as const,
                content: systemPrompt,
              },
            ] as const)),
        {
          role: 'user' as const,
          content: isBaseModel
            ? `${baseModelCoreContent}${baseModelInstructionSuffix}`
            : `${basePromptSection}${titleLine}${contextSection}${continueText}${instructionSuffix}`,
        },
      ] as const

      // Mark in-progress to avoid re-entrancy from keyword trigger during insertion
      this.isContinuationInProgress = true

      // Stream response and progressively insert into editor
      controller = new AbortController()
      this.activeAbortControllers.add(controller)

      const baseRequest: any = {
        model: model.model,
        messages: requestMessages as unknown as any,
      }
      if (typeof temperature === 'number') {
        baseRequest.temperature = temperature
      }
      if (typeof topP === 'number') {
        baseRequest.top_p = topP
      }

      console.debug('Continuation request params', {
        overrides: sidebarOverrides,
        request: baseRequest,
        streamPreference,
      })

      // Insert at current cursor by default; if a selection exists, insert at selection end
      let insertStart = editor.getCursor()
      if (hasSelection) {
        const endPos = editor.getCursor('to')
        editor.setCursor(endPos)
        insertStart = endPos
      }
      let insertedText = ''
      let prevEnd = insertStart

      const calcEndPos = (start: { line: number; ch: number }, text: string) => {
        const parts = text.split('\n')
        const lineDelta = parts.length - 1
        const endLine = start.line + lineDelta
        const endCh = lineDelta === 0 ? start.ch + parts[0].length : parts[parts.length - 1].length
        return { line: endLine, ch: endCh }
      }

      if (streamPreference) {
        const streamIterator = await providerClient.streamResponse(
          model,
          { ...baseRequest, stream: true },
          { signal: controller.signal },
        )

        for await (const chunk of streamIterator) {
          const delta = chunk?.choices?.[0]?.delta
          const piece = delta?.content ?? ''
          if (!piece) continue

          insertedText += piece
          const newEnd = calcEndPos(insertStart, insertedText)
          // Replace the previously inserted range with the new accumulated text
          editor.replaceRange(insertedText, insertStart, prevEnd)
          prevEnd = newEnd
        }
      } else {
        const response = await providerClient.generateResponse(
          model,
          { ...baseRequest, stream: false },
          { signal: controller.signal },
        )

        const fullText = response.choices?.[0]?.message?.content ?? ''
        if (fullText) {
          insertedText = fullText
          const newEnd = calcEndPos(insertStart, insertedText)
          editor.replaceRange(insertedText, insertStart, prevEnd)
          prevEnd = newEnd
        }
      }

      if (insertedText.trim().length > 0) {
        notice.setMessage('AI continuation inserted.')
      } else {
        notice.setMessage('No continuation generated.')
      }
      this.registerTimeout(() => notice.hide(), 1200)
    } catch (error) {
      if ((error as any)?.name === 'AbortError') {
        const n = new Notice('已取消生成。')
        this.registerTimeout(() => n.hide(), 1000)
      } else {
        console.error(error)
        new Notice('Failed to generate continuation.')
      }
    } finally {
      this.isContinuationInProgress = false
      if (controller) this.activeAbortControllers.delete(controller)
    }
  }

  // removed migrateToJsonStorage (templates)

  private async reloadChatView() {
    const leaves = this.app.workspace.getLeavesOfType(CHAT_VIEW_TYPE)
    if (leaves.length === 0 || !(leaves[0].view instanceof ChatView)) {
      return
    }
    new Notice('Reloading "next-composer" due to migration', 1000)
    leaves[0].detach()
    await this.activateChatView()
  }
}
