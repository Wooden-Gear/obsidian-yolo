import { Editor, MarkdownView, Notice, Plugin, TAbstractFile } from 'obsidian'
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
import { migrateToJsonDatabase } from './database/json/migrateToJsonDatabase'
import { createTranslationFunction } from './i18n'
import { CustomContinueModal } from './components/modals/CustomContinueModal'
import { CustomContinuePanel } from './components/panels/CustomContinuePanel'
import { CustomRewritePanel } from './components/panels/CustomRewritePanel'
import {
  SmartComposerSettings,
  smartComposerSettingsSchema,
} from './settings/schema/setting.types'
import { parseSmartComposerSettings } from './settings/schema/settings'
import { SmartComposerSettingTab } from './settings/SettingTab'
import { getMentionableBlockData, readTFileContent } from './utils/obsidian'

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
      const { providerClient, model } = getChatModelClient({
        settings: this.settings,
        modelId: this.settings.applyModelId,
      })

      const systemPrompt =
        'You are an intelligent assistant that rewrites ONLY the provided markdown text according to the instruction. Preserve the original meaning, structure, and any markdown (links, emphasis, code) unless explicitly told otherwise. Output ONLY the rewritten text without code fences or extra explanations.'

      const instruction = (customPrompt ?? '').trim()
      const requestMessages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `Instruction:\n${instruction}\n\nSelected text:\n${selected}\n\nRewrite the selected text accordingly. Output only the rewritten text.`,
        },
      ] as const

      controller = new AbortController()
      this.activeAbortControllers.add(controller)

      const response = await providerClient.generateResponse(model, {
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
      }, { signal: controller.signal })

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

    void this.migrateToJsonStorage()

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
              try {
                const cm: any = (editor as any).cm
                const cursor = editor.getCursor('to')
                let position: { x: number; y: number } | undefined
                if (cm?.state) {
                  const lineFrom: number = cm.state.doc.line(cursor.line + 1).from
                  const pos: number = lineFrom + cursor.ch
                  const rect = cm.coordsAtPos(pos)
                  if (rect) {
                    position = { x: rect.left, y: (rect.bottom ?? rect.top) + 8 }
                  }
                }
                new CustomContinuePanel({ plugin: this, editor, position }).open()
              } catch {
                new CustomContinuePanel({ plugin: this, editor }).open()
              }
            }),
        )

        // Custom rewrite via floating panel (only when there is a selection)
        if (hasSelection) {
          menu.addItem((item) =>
            item
              .setTitle(this.t('commands.customRewrite'))
              .setIcon('wand-sparkles')
              .onClick(() => {
                try {
                  const cm: any = (editor as any).cm
                  const cursor = editor.getCursor('to')
                  let position: { x: number; y: number } | undefined
                  if (cm?.state) {
                    const lineFrom: number = cm.state.doc.line(cursor.line + 1).from
                    const pos: number = lineFrom + cursor.ch
                    const rect = cm.coordsAtPos(pos)
                    if (rect) {
                      position = { x: rect.left, y: (rect.bottom ?? rect.top) + 8 }
                    }
                  }
                  new CustomRewritePanel({ plugin: this, editor, position }).open()
                } catch {
                  new CustomRewritePanel({ plugin: this, editor }).open()
                }
              }),
          )
        }
      }),
    )

    // Keyword triggers: floating panel (custom continue) and inline continuation
    this.registerEvent(
      this.app.workspace.on('editor-change', (editor) => {
        try {
          if (this.isContinuationInProgress) return
          if (!editor) return
          const selection = editor.getSelection()
          if (selection && selection.length > 0) return
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
              try {
                const cm: any = (editor as any).cm
                let position: { x: number; y: number } | undefined
                if (cm?.state) {
                  const lineFrom: number = cm.state.doc.line(cursor.line + 1).from
                  const pos: number = lineFrom + cursor.ch
                  const rect = cm.coordsAtPos(pos)
                  if (rect) {
                    position = { x: rect.left, y: (rect.bottom ?? rect.top) + 8 }
                  }
                }
                new CustomContinuePanel({ plugin: this, editor, position }).open()
              } catch {
                new CustomContinuePanel({ plugin: this, editor }).open()
              }
              return
            }
          }

          // 2) Continuation trigger (inline)
          if (!this.settings.continuationOptions?.enableKeywordTrigger) return
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
      if (!('path' in file) || typeof (file as any).path !== 'string') return
      this.onVaultPathChanged((file as any).path as string)
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
        ? this.settings.chatModelId
        : this.settings.continuationOptions.fixedModelId

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
      const continueText = hasContext
        ? 'Continue writing from here.'
        : 'Start writing this document.'

      const requestMessages = [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `${titleLine}${contextSection}${continueText}${instructionSuffix}`,
        },
      ] as const

      // Mark in-progress to avoid re-entrancy from keyword trigger during insertion
      this.isContinuationInProgress = true

      // Stream response and progressively insert into editor
      controller = new AbortController()
      this.activeAbortControllers.add(controller)

      const stream = await providerClient.streamResponse(model, {
        model: model.model,
        messages: requestMessages as unknown as any,
        stream: true,
      }, { signal: controller.signal })

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

      for await (const chunk of stream) {
        const delta = chunk?.choices?.[0]?.delta
        const piece = delta?.content ?? ''
        if (!piece) continue

        insertedText += piece
        const newEnd = calcEndPos(insertStart, insertedText)
        // Replace the previously inserted range with the new accumulated text
        editor.replaceRange(insertedText, insertStart, prevEnd)
        prevEnd = newEnd
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

  private async migrateToJsonStorage() {
    try {
      const dbManager = await this.getDbManager()
      await migrateToJsonDatabase(this.app, dbManager, async () => {
        await this.reloadChatView()
        console.log('Migration to JSON storage completed successfully')
      })
    } catch (error) {
      console.error('Failed to migrate to JSON storage:', error)
      new Notice(
        'Failed to migrate to JSON storage. Please check the console for details.',
      )
    }
  }

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
