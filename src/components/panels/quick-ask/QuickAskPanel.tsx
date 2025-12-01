import { EditorView } from '@codemirror/view'
import { $getRoot, LexicalEditor, SerializedEditorState } from 'lexical'
import {
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  PanelRight,
  Send,
  Square,
  X,
} from 'lucide-react'
import { Component, Editor, MarkdownRenderer, Notice } from 'obsidian'
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { v4 as uuidv4 } from 'uuid'

import { useApp } from '../../../contexts/app-context'
import { useLanguage } from '../../../contexts/language-context'
import { useMcp } from '../../../contexts/mcp-context'
import { useRAG } from '../../../contexts/rag-context'
import { useSettings } from '../../../contexts/settings-context'
import { getChatModelClient } from '../../../core/llm/manager'
import { useChatHistory } from '../../../hooks/useChatHistory'
import SmartComposerPlugin from '../../../main'
import { Assistant } from '../../../types/assistant.types'
import { ChatMessage, ChatUserMessage } from '../../../types/chat'
import { renderAssistantIcon } from '../../../utils/assistant-icon'
import { PromptGenerator } from '../../../utils/chat/promptGenerator'
import { ResponseGenerator } from '../../../utils/chat/responseGenerator'
import LexicalContentEditable from '../../chat-view/chat-input/LexicalContentEditable'
import { ModelSelect } from '../../chat-view/chat-input/ModelSelect'
import { editorStateToPlainText } from '../../chat-view/chat-input/utils/editor-state-to-plain-text'

import { AssistantSelectMenu } from './AssistantSelectMenu'

type QuickAskPanelProps = {
  plugin: SmartComposerPlugin
  editor: Editor
  view: EditorView
  contextText: string
  onClose: () => void
  containerRef?: React.RefObject<HTMLDivElement>
  onOverlayStateChange?: (isOverlayActive: boolean) => void
  onDragOffset?: (offsetX: number, offsetY: number) => void
}

// Simple markdown renderer component for Quick Ask
function SimpleMarkdownContent({
  content,
  component,
}: {
  content: string
  component: Component
}) {
  const app = useApp()
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (containerRef.current && content) {
      containerRef.current.replaceChildren()
      void MarkdownRenderer.render(
        app,
        content,
        containerRef.current,
        '',
        component,
      )
    }
  }, [app, component, content])

  return (
    <div
      ref={containerRef}
      className="markdown-rendered smtcmp-markdown-rendered"
    />
  )
}

export function QuickAskPanel({
  plugin,
  editor,
  view: _view,
  contextText,
  onClose,
  containerRef,
  onOverlayStateChange,
}: QuickAskPanelProps) {
  const app = useApp()
  const { settings } = useSettings()
  const { setSettings } = useSettings()
  const { t } = useLanguage()
  const { getRAGEngine } = useRAG()
  const { getMcpManager } = useMcp()
  const { createOrUpdateConversation, generateConversationTitle } =
    useChatHistory()

  const assistants = settings.assistants || []
  const currentAssistantId = settings.currentAssistantId

  // State
  const [selectedAssistant, setSelectedAssistant] = useState<Assistant | null>(
    () => {
      if (currentAssistantId) {
        return assistants.find((a) => a.id === currentAssistantId) || null
      }
      return null
    },
  )
  const [conversationId] = useState(() => uuidv4())
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [isAssistantMenuOpen, setIsAssistantMenuOpen] = useState(false)
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false)
  const assistantDropdownRef = useRef<HTMLDivElement | null>(null)
  const assistantTriggerRef = useRef<HTMLButtonElement | null>(null)
  const modelTriggerRef = useRef<HTMLButtonElement | null>(null)

  const contentEditableRef = useRef<HTMLDivElement>(null)
  const lexicalEditorRef = useRef<LexicalEditor | null>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  // Build promptGenerator with context
  const promptGenerator = useMemo(() => {
    const globalSystemPrompt = settings.systemPrompt || ''
    const assistantPrompt = selectedAssistant?.systemPrompt || ''
    const contextSection =
      contextText.trim().length > 0
        ? `\n\nThe user is asking a question in the context of their current document.\nHere is the text before the cursor (context):\n"""\n${contextText}\n"""\n\nAnswer the user's question based on this context when relevant.`
        : ''

    const combinedSystemPrompt =
      `${globalSystemPrompt}\n\n${assistantPrompt}${contextSection}`.trim()

    return new PromptGenerator(getRAGEngine, app, {
      ...settings,
      systemPrompt: combinedSystemPrompt,
    })
  }, [app, contextText, getRAGEngine, selectedAssistant, settings])

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [chatMessages])

  // Focus input on mount
  useEffect(() => {
    setTimeout(() => {
      contentEditableRef.current?.focus()
    }, 100)
  }, [])

  // Notify overlay state changes
  useEffect(() => {
    onOverlayStateChange?.(isAssistantMenuOpen || isModelMenuOpen)
  }, [isAssistantMenuOpen, isModelMenuOpen, onOverlayStateChange])

  // Arrow keys focus assistant trigger; Enter on the trigger will open the menu
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isAssistantMenuOpen) return
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
      event.preventDefault()
      event.stopPropagation()
      assistantTriggerRef.current?.focus()
    }
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isAssistantMenuOpen])

  // When focus在助手按钮但菜单未展开时，ArrowUp 将焦点送回输入框（兜底）
  useEffect(() => {
    const handleArrowUpBack = (event: KeyboardEvent) => {
      if (event.key !== 'ArrowUp') return
      if (isAssistantMenuOpen) return
      const active = document.activeElement
      if (active !== assistantTriggerRef.current) return
      event.preventDefault()
      event.stopPropagation()
      contentEditableRef.current?.focus()
    }
    window.addEventListener('keydown', handleArrowUpBack, true)
    return () => window.removeEventListener('keydown', handleArrowUpBack, true)
  }, [isAssistantMenuOpen])

  // When assistant menu已打开时按 Esc：只关闭菜单并回焦输入
  useEffect(() => {
    const handleMenuEscape = (event: KeyboardEvent) => {
      if (!isAssistantMenuOpen) return
      if (event.key !== 'Escape') return
      event.preventDefault()
      event.stopPropagation()
      setIsAssistantMenuOpen(false)
      requestAnimationFrame(() => {
        contentEditableRef.current?.focus()
      })
    }
    window.addEventListener('keydown', handleMenuEscape, true)
    return () => window.removeEventListener('keydown', handleMenuEscape, true)
  }, [isAssistantMenuOpen])

  // Get model client
  const { providerClient, model } = useMemo(() => {
    const continuationModelId = settings.continuationOptions?.continuationModelId
    const preferredModelId =
      continuationModelId &&
      settings.chatModels.some((m) => m.id === continuationModelId)
        ? continuationModelId
        : settings.chatModelId

    return getChatModelClient({ settings, modelId: preferredModelId })
  }, [settings])

  // Abort current stream
  const abortStream = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
  }, [])

  // Submit message
  const submitMessage = useCallback(
    async (editorState: SerializedEditorState) => {
      if (isStreaming) return

      // Extract text from editor state
      const textContent = editorStateToPlainText(editorState)
      if (!textContent.trim()) return

      setIsStreaming(true)
      setInputText('')

      // Clear the lexical editor
      lexicalEditorRef.current?.update(() => {
        const root = lexicalEditorRef.current?.getEditorState().read(() => {
          return $getRoot()
        })
        if (root) {
          root.clear()
        }
      })

      // Create user message with all required fields
      const userMessage: ChatUserMessage = {
        role: 'user',
        content: editorState,
        promptContent: textContent,
        id: uuidv4(),
        mentionables: [],
      }

      const newMessages: ChatMessage[] = [...chatMessages, userMessage]
      setChatMessages(newMessages)

      // Create abort controller
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      try {
        const mcpManager = await getMcpManager()

        const responseGenerator = new ResponseGenerator({
          providerClient,
          model,
          messages: newMessages,
          conversationId,
          enableTools: settings.chatOptions.enableTools,
          maxAutoIterations: settings.chatOptions.maxAutoIterations,
          promptGenerator,
          mcpManager,
          abortSignal: abortController.signal,
          requestParams: {
            stream: true,
          },
        })

        const unsubscribe = responseGenerator.subscribe((responseMessages) => {
          setChatMessages((prev) => {
            const lastMessageIndex = prev.findIndex(
              (m) => m.id === userMessage.id,
            )
            if (lastMessageIndex === -1) {
              abortController.abort()
              return prev
            }
            return [...prev.slice(0, lastMessageIndex + 1), ...responseMessages]
          })
        })

        await responseGenerator.run()
        unsubscribe()

        // Save conversation
        const finalMessages = [...newMessages]
        setChatMessages((current) => {
          finalMessages.push(...current.slice(newMessages.length))
          return current
        })

        createOrUpdateConversation?.(conversationId, finalMessages)
        generateConversationTitle?.(conversationId, finalMessages)
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          // Aborted by user
          return
        }
        console.error('Quick ask failed:', error)
        new Notice(t('quickAsk.error', 'Failed to generate response'))
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [
      chatMessages,
      conversationId,
      createOrUpdateConversation,
      generateConversationTitle,
      getMcpManager,
      isStreaming,
      model,
      promptGenerator,
      providerClient,
      settings,
      t,
    ],
  )

  // Handle Enter key
  const handleEnter = useCallback(
    (event: KeyboardEvent) => {
      if (event.shiftKey) return // Allow Shift+Enter for newline

      const lexicalEditor = lexicalEditorRef.current
      if (lexicalEditor) {
        const editorState = lexicalEditor.getEditorState().toJSON()
        void submitMessage(editorState)
      }
    },
    [submitMessage],
  )

  // Copy last assistant message
  const copyLastResponse = useCallback(() => {
    const lastAssistantMessage = [...chatMessages]
      .reverse()
      .find((m) => m.role === 'assistant')
    if (lastAssistantMessage && lastAssistantMessage.role === 'assistant') {
      navigator.clipboard.writeText(lastAssistantMessage.content || '')
      new Notice(t('quickAsk.copied', 'Copied to clipboard'))
    }
  }, [chatMessages, t])

  // Insert last assistant message at cursor
  const insertLastResponse = useCallback(() => {
    const lastAssistantMessage = [...chatMessages]
      .reverse()
      .find((m) => m.role === 'assistant')
    if (lastAssistantMessage && lastAssistantMessage.role === 'assistant') {
      const content = lastAssistantMessage.content || ''
      const cursor = editor.getCursor()
      editor.replaceRange(content, cursor)
      new Notice(t('quickAsk.inserted', 'Inserted at cursor'))
      onClose()
    }
  }, [chatMessages, editor, onClose, t])

  // Open in sidebar
  const openInSidebar = useCallback(() => {
    // Save conversation first
    if (chatMessages.length > 0) {
      createOrUpdateConversation?.(conversationId, chatMessages)
    }
    // Open chat view with this conversation
    plugin.activateChatView()
    // TODO: Load specific conversation by ID
    onClose()
  }, [
    chatMessages,
    conversationId,
    createOrUpdateConversation,
    onClose,
    plugin,
  ])

  const hasMessages = chatMessages.length > 0
  const hasAssistantResponse = chatMessages.some((m) => m.role === 'assistant')

  // Global key handling to match palette UX (Esc closes, even when dropdown is open)
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (isAssistantMenuOpen) {
        event.preventDefault()
        setIsAssistantMenuOpen(false)
        return
      }
      if (isModelMenuOpen) {
        // 交给模型下拉自身处理关闭，避免误关闭面板
        return
      }
      event.preventDefault()
      onClose()
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [isAssistantMenuOpen, isModelMenuOpen, onClose])

  return (
    <div
      className={`smtcmp-quick-ask-panel ${hasMessages ? 'has-messages' : ''}`}
      ref={containerRef ?? undefined}
    >
      {/* Top: Input row with close button (Cursor style) */}
      <div className="smtcmp-quick-ask-input-row">
        <div
          className={`smtcmp-quick-ask-input ${isStreaming ? 'is-disabled' : ''}`}
        >
          <LexicalContentEditable
            editorRef={lexicalEditorRef}
            contentEditableRef={contentEditableRef}
            onTextContentChange={setInputText}
            onEnter={handleEnter}
            autoFocus
            contentClassName="obsidian-default-textarea smtcmp-content-editable smtcmp-quick-ask-content-editable"
          />
          {inputText.length === 0 && (
            <div className="smtcmp-quick-ask-input-placeholder">
              {t('quickAsk.inputPlaceholder', 'Ask a question...')}
            </div>
          )}
        </div>
        <button
          className="smtcmp-quick-ask-close-button"
          onClick={onClose}
          aria-label={t('quickAsk.close', 'Close')}
        >
          <X size={14} />
        </button>
      </div>

      {/* Chat area - only shown when there are messages */}
      {hasMessages && (
        <div className="smtcmp-quick-ask-chat-area" ref={chatAreaRef}>
          {chatMessages.map((message) => {
            if (message.role === 'user') {
              const textContent =
                message.content && typeof message.content === 'object'
                  ? editorStateToPlainText(message.content)
                  : ''
              return (
                <div key={message.id} className="smtcmp-quick-ask-user-message">
                  {textContent}
                </div>
              )
            }
            if (message.role === 'assistant') {
              return (
                <div
                  key={message.id}
                  className="smtcmp-quick-ask-assistant-message"
                >
                  <SimpleMarkdownContent
                    content={message.content || ''}
                    component={plugin}
                  />
                </div>
              )
            }
            return null
          })}
        </div>
      )}

      {/* Bottom toolbar (Cursor style): assistant selector left, actions right */}
      <div className="smtcmp-quick-ask-toolbar">
        {/* Left: Assistant selector */}
        <div className="smtcmp-quick-ask-toolbar-left">
          <button
            ref={assistantTriggerRef}
            className="smtcmp-quick-ask-assistant-trigger"
            onClick={() => setIsAssistantMenuOpen(!isAssistantMenuOpen)}
            onKeyDown={(event) => {
              if (!isAssistantMenuOpen) {
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  event.stopPropagation()
                  contentEditableRef.current?.focus()
                  return
                }
                if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') {
                  event.preventDefault()
                  event.stopPropagation()
                  modelTriggerRef.current?.focus()
                  return
                }
              }
            }}
          >
            {selectedAssistant && (
              <span className="smtcmp-quick-ask-assistant-icon">
                {renderAssistantIcon(selectedAssistant.icon, 14)}
              </span>
            )}
            <span className="smtcmp-quick-ask-assistant-name">
              {selectedAssistant?.name ||
                t('quickAsk.noAssistant', 'No Assistant')}
            </span>
            {isAssistantMenuOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>

          {/* Assistant dropdown */}
          {isAssistantMenuOpen && (
            <div
              className="smtcmp-quick-ask-assistant-dropdown"
              ref={assistantDropdownRef}
            >
              <AssistantSelectMenu
                assistants={assistants}
                currentAssistantId={selectedAssistant?.id}
                onSelect={(assistant) => {
                  setSelectedAssistant(assistant)
                  void setSettings({
                    ...settings,
                    currentAssistantId: assistant?.id,
                  })
                  setIsAssistantMenuOpen(false)
                  requestAnimationFrame(() => {
                    contentEditableRef.current?.focus()
                  })
                }}
                onClose={() => setIsAssistantMenuOpen(false)}
                compact
              />
            </div>
          )}

          <div className="smtcmp-quick-ask-model-select smtcmp-smart-space-model-select">
            <ModelSelect
              ref={modelTriggerRef}
              modelId={
                settings.continuationOptions?.continuationModelId &&
                settings.chatModels.some(
                  (m) => m.id === settings.continuationOptions?.continuationModelId,
                )
                  ? settings.continuationOptions?.continuationModelId
                  : settings.chatModelId
              }
              onMenuOpenChange={(open) => setIsModelMenuOpen(open)}
              onChange={(modelId) => {
                void setSettings({
                  ...settings,
                  continuationOptions: {
                    ...settings.continuationOptions,
                    continuationModelId: modelId,
                  },
                })
              }}
              container={containerRef?.current ?? undefined}
              side="bottom"
              align="start"
              sideOffset={12}
              alignOffset={-4}
              contentClassName="smtcmp-smart-space-popover smtcmp-quick-ask-model-popover"
              onKeyDown={(event, isMenuOpen) => {
                if (isMenuOpen) {
                  if (event.key === 'Escape') {
                    event.preventDefault()
                    setIsModelMenuOpen(false)
                  }
                  return
                }

                if (event.key === 'ArrowLeft') {
                  event.preventDefault()
                  assistantTriggerRef.current?.focus()
                  return
                }
                if (event.key === 'ArrowRight') {
                  event.preventDefault()
                  assistantTriggerRef.current?.focus()
                  return
                }
                if (event.key === 'ArrowUp') {
                  event.preventDefault()
                  contentEditableRef.current?.focus()
                }
              }}
            />
          </div>
        </div>

        {/* Right: Action buttons */}
        <div className="smtcmp-quick-ask-toolbar-right">
          {/* Response actions - only shown when there's an assistant response */}
          {hasAssistantResponse && (
            <>
              <button
                className="smtcmp-quick-ask-toolbar-button"
                onClick={copyLastResponse}
                title={t('quickAsk.copy', 'Copy')}
              >
                <Copy size={14} />
              </button>
              <button
                className="smtcmp-quick-ask-toolbar-button"
                onClick={insertLastResponse}
                title={t('quickAsk.insert', 'Insert')}
              >
                <ExternalLink size={14} />
              </button>
              <button
                className="smtcmp-quick-ask-toolbar-button"
                onClick={openInSidebar}
                title={t('quickAsk.openInSidebar', 'Open in sidebar')}
              >
                <PanelRight size={14} />
              </button>
              <div className="smtcmp-quick-ask-toolbar-divider" />
            </>
          )}

          {/* Send/Stop button */}
          {isStreaming ? (
            <button
              className="smtcmp-quick-ask-send-button stop"
              onClick={abortStream}
              aria-label={t('quickAsk.stop', 'Stop')}
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              className="smtcmp-quick-ask-send-button"
              onClick={() => {
                const lexicalEditor = lexicalEditorRef.current
                if (lexicalEditor) {
                  const editorState = lexicalEditor.getEditorState().toJSON()
                  void submitMessage(editorState)
                }
              }}
              disabled={inputText.trim().length === 0}
              aria-label={t('quickAsk.send', 'Send')}
            >
              <Send size={14} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
