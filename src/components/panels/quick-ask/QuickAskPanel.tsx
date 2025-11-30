import { EditorView } from '@codemirror/view'
import { $getRoot, LexicalEditor, SerializedEditorState } from 'lexical'
import { Copy, ExternalLink, PanelRight, Send, Square, X } from 'lucide-react'
import { Editor, MarkdownRenderer, Notice } from 'obsidian'
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

type Phase = 'selecting-assistant' | 'chatting'

// Simple markdown renderer component for Quick Ask
function SimpleMarkdownContent({ content }: { content: string }) {
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        null as any,
      )
    }
  }, [app, content])

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
  onDragOffset,
}: QuickAskPanelProps) {
  const app = useApp()
  const { settings } = useSettings()
  const { t } = useLanguage()
  const { getRAGEngine } = useRAG()
  const { getMcpManager } = useMcp()
  const { createOrUpdateConversation, generateConversationTitle } =
    useChatHistory()

  const assistants = settings.assistants || []
  const currentAssistantId = settings.currentAssistantId

  // State
  const [phase, setPhase] = useState<Phase>(
    assistants.length > 0 ? 'selecting-assistant' : 'chatting',
  )
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
  const [isDragging, setIsDragging] = useState(false)

  const contentEditableRef = useRef<HTMLDivElement>(null)
  const lexicalEditorRef = useRef<LexicalEditor | null>(null)
  const chatAreaRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const dragStartRef = useRef<{
    x: number
    y: number
    offsetX: number
    offsetY: number
  } | null>(null)

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

  // Focus input when entering chat phase
  useEffect(() => {
    if (phase === 'chatting') {
      setTimeout(() => {
        contentEditableRef.current?.focus()
      }, 100)
    }
  }, [phase])

  // Notify overlay state changes
  useEffect(() => {
    onOverlayStateChange?.(isAssistantMenuOpen)
  }, [isAssistantMenuOpen, onOverlayStateChange])

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Only start drag on left mouse button
      if (e.button !== 0) return
      // Don't start drag if clicking on buttons
      if ((e.target as HTMLElement).closest('button')) return

      e.preventDefault()
      setIsDragging(true)

      // Get current panel position
      const panel = containerRef?.current
      if (panel) {
        const rect = panel.getBoundingClientRect()
        dragStartRef.current = {
          x: e.clientX,
          y: e.clientY,
          offsetX: rect.left,
          offsetY: rect.top,
        }
      }
    },
    [containerRef],
  )

  useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      if (!dragStartRef.current || !onDragOffset) return

      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y

      // Calculate new position
      let newX = dragStartRef.current.offsetX + deltaX
      let newY = dragStartRef.current.offsetY + deltaY

      // Constrain to viewport
      const panel = containerRef?.current
      if (panel) {
        const rect = panel.getBoundingClientRect()
        const margin = 12
        newX = Math.max(
          margin,
          Math.min(newX, window.innerWidth - rect.width - margin),
        )
        newY = Math.max(
          margin,
          Math.min(newY, window.innerHeight - rect.height - margin),
        )
      }

      onDragOffset(newX, newY)
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      dragStartRef.current = null
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, containerRef, onDragOffset])

  // Get model client
  const { providerClient, model } = useMemo(() => {
    const modelId = settings.chatModelId
    return getChatModelClient({ settings, modelId })
  }, [settings])

  // Handle assistant selection
  const handleSelectAssistant = useCallback((assistant: Assistant | null) => {
    setSelectedAssistant(assistant)
    setPhase('chatting')
  }, [])

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

  // Render assistant selection phase
  if (phase === 'selecting-assistant') {
    return (
      <div className="smtcmp-quick-ask-panel" ref={containerRef ?? undefined}>
        <AssistantSelectMenu
          assistants={assistants}
          currentAssistantId={currentAssistantId}
          onSelect={handleSelectAssistant}
          onClose={onClose}
        />
      </div>
    )
  }

  // Render chat phase
  const hasMessages = chatMessages.length > 0
  const hasAssistantResponse = chatMessages.some((m) => m.role === 'assistant')

  return (
    <div
      className={`smtcmp-quick-ask-panel ${isDragging ? 'is-dragging' : ''}`}
      ref={containerRef ?? undefined}
    >
      {/* Header - minimal drag handle */}
      <div
        className="smtcmp-quick-ask-header"
        onMouseDown={handleDragStart}
        style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
      >
        <div className="smtcmp-quick-ask-drag-indicator" />
        <button
          className="smtcmp-quick-ask-close-button"
          onClick={onClose}
          aria-label={t('quickAsk.close', 'Close')}
        >
          <X size={12} />
        </button>
      </div>

      {/* Chat area */}
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
                  <SimpleMarkdownContent content={message.content || ''} />
                </div>
              )
            }
            return null
          })}
        </div>
      )}

      {/* Assistant selector - above input */}
      <div className="smtcmp-quick-ask-assistant-row">
        <button
          className="smtcmp-quick-ask-assistant-button"
          onClick={() => setIsAssistantMenuOpen(!isAssistantMenuOpen)}
        >
          {selectedAssistant && (
            <span className="smtcmp-quick-ask-assistant-icon">
              {renderAssistantIcon(selectedAssistant.icon, 12)}
            </span>
          )}
          <span className="smtcmp-quick-ask-assistant-name">
            {selectedAssistant?.name ||
              t('quickAsk.noAssistant', 'No Assistant')}
          </span>
        </button>

        {/* Assistant selector dropdown */}
        {isAssistantMenuOpen && (
          <div className="smtcmp-quick-ask-assistant-dropdown">
            <AssistantSelectMenu
              assistants={assistants}
              currentAssistantId={selectedAssistant?.id}
              onSelect={(assistant) => {
                setSelectedAssistant(assistant)
                setIsAssistantMenuOpen(false)
              }}
              onClose={() => setIsAssistantMenuOpen(false)}
              compact
            />
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="smtcmp-quick-ask-input-area">
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
        <div className="smtcmp-quick-ask-input-actions">
          {isStreaming ? (
            <button
              className="smtcmp-quick-ask-action-button stop"
              onClick={abortStream}
              aria-label={t('quickAsk.stop', 'Stop')}
            >
              <Square size={14} />
            </button>
          ) : (
            <button
              className="smtcmp-quick-ask-action-button send"
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

      {/* Footer actions */}
      {hasAssistantResponse && (
        <div className="smtcmp-quick-ask-footer">
          <button
            className="smtcmp-quick-ask-footer-button"
            onClick={copyLastResponse}
            title={t('quickAsk.copy', 'Copy')}
          >
            <Copy size={12} />
            <span>{t('quickAsk.copy', 'Copy')}</span>
          </button>
          <button
            className="smtcmp-quick-ask-footer-button"
            onClick={insertLastResponse}
            title={t('quickAsk.insert', 'Insert')}
          >
            <ExternalLink size={12} />
            <span>{t('quickAsk.insert', 'Insert')}</span>
          </button>
          <button
            className="smtcmp-quick-ask-footer-button"
            onClick={openInSidebar}
            title={t('quickAsk.openInSidebar', 'Open in sidebar')}
          >
            <PanelRight size={12} />
            <span>{t('quickAsk.openInSidebar', 'Open in sidebar')}</span>
          </button>
        </div>
      )}
    </div>
  )
}
