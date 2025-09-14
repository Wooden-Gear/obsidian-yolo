import { UseMutationResult, useMutation } from '@tanstack/react-query'
import { Notice } from 'obsidian'
import { useCallback, useMemo, useRef } from 'react'

import { useApp } from '../../contexts/app-context'
import { useMcp } from '../../contexts/mcp-context'
import { useSettings } from '../../contexts/settings-context'
import {
  LLMAPIKeyInvalidException,
  LLMAPIKeyNotSetException,
  LLMBaseUrlNotSetException,
  LLMModelNotFoundException,
} from '../../core/llm/exception'
import { getChatModelClient } from '../../core/llm/manager'
import { ChatMessage } from '../../types/chat'
import { PromptGenerator } from '../../utils/chat/promptGenerator'
import { ResponseGenerator } from '../../utils/chat/responseGenerator'
import { ErrorModal } from '../modals/ErrorModal'
import { ConversationOverrideSettings } from '../../types/conversation-settings.types'

type UseChatStreamManagerParams = {
  setChatMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>
  autoScrollToBottom: () => void
  promptGenerator: PromptGenerator
  chatMode: 'rag' | 'brute'
  learningMode: boolean
  conversationOverrides?: ConversationOverrideSettings
  modelId: string
}

export type UseChatStreamManager = {
  abortActiveStreams: () => void
  submitChatMutation: UseMutationResult<
    void,
    Error,
    { chatMessages: ChatMessage[]; conversationId: string }
  >
}

export function useChatStreamManager({
  setChatMessages,
  autoScrollToBottom,
  promptGenerator,
  chatMode,
  learningMode,
  conversationOverrides,
  modelId,
}: UseChatStreamManagerParams): UseChatStreamManager {
  const app = useApp()
  const { settings } = useSettings()
  const { getMcpManager } = useMcp()

  const activeStreamAbortControllersRef = useRef<AbortController[]>([])

  const abortActiveStreams = useCallback(() => {
    for (const abortController of activeStreamAbortControllersRef.current) {
      abortController.abort()
    }
    activeStreamAbortControllersRef.current = []
  }, [])

  const { providerClient, model } = useMemo(() => {
    try {
      return getChatModelClient({
        settings,
        modelId: modelId,
      })
    } catch (error) {
      if (error instanceof LLMModelNotFoundException) {
        if (settings.chatModels.length === 0) {
          throw error
        }
        // Fallback to the first chat model if the selected chat model is not found
        const firstChatModel = settings.chatModels[0]
        // Do NOT write back to global settings here; just use fallback locally
        return getChatModelClient({ settings, modelId: firstChatModel.id })
      }
      throw error
    }
  }, [settings, modelId])

  const submitChatMutation = useMutation({
    mutationFn: async ({
      chatMessages,
      conversationId,
    }: {
      chatMessages: ChatMessage[]
      conversationId: string
    }) => {
      const lastMessage = chatMessages.at(-1)
      if (!lastMessage) {
        // chatMessages is empty
        return
      }

      abortActiveStreams()
      const abortController = new AbortController()
      activeStreamAbortControllersRef.current.push(abortController)

      let unsubscribeResponseGenerator: (() => void) | undefined

      try {
        const mcpManager = await getMcpManager()
        const responseGenerator = new ResponseGenerator({
          providerClient,
          model,
          messages: chatMessages,
          conversationId,
          enableTools: settings.chatOptions.enableTools,
          maxAutoIterations: settings.chatOptions.maxAutoIterations,
          promptGenerator,
          mcpManager,
          abortSignal: abortController.signal,
          chatMode,
          learningMode,
          requestParams: {
            stream: conversationOverrides?.stream ?? true,
            temperature:
              conversationOverrides?.temperature ?? undefined,
            top_p: conversationOverrides?.top_p ?? undefined,
          },
          maxContextOverride:
            conversationOverrides?.maxContextMessages ?? undefined,
          geminiTools: {
            useWebSearch: conversationOverrides?.useWebSearch ?? false,
            useUrlContext: conversationOverrides?.useUrlContext ?? false,
          },
        })

        unsubscribeResponseGenerator = responseGenerator.subscribe(
          (responseMessages) => {
            setChatMessages((prevChatMessages) => {
              const lastMessageIndex = prevChatMessages.findIndex(
                (message) => message.id === lastMessage.id,
              )
              if (lastMessageIndex === -1) {
                // The last message no longer exists in the chat history.
                // This likely means a new message was submitted while this stream was running.
                // Abort this stream and keep the current chat history.
                abortController.abort()
                return prevChatMessages
              }
              return [
                ...prevChatMessages.slice(0, lastMessageIndex + 1),
                ...responseMessages,
              ]
            })
            autoScrollToBottom()
          },
        )

        await responseGenerator.run()
      } catch (error) {
        // Ignore AbortError
        if (error instanceof Error && error.name === 'AbortError') {
          return
        }
        throw error
      } finally {
        if (unsubscribeResponseGenerator) {
          unsubscribeResponseGenerator()
        }
        activeStreamAbortControllersRef.current =
          activeStreamAbortControllersRef.current.filter(
            (controller) => controller !== abortController,
          )
      }
    },
    onError: (error) => {
      if (
        error instanceof LLMAPIKeyNotSetException ||
        error instanceof LLMAPIKeyInvalidException ||
        error instanceof LLMBaseUrlNotSetException
      ) {
        new ErrorModal(app, 'Error', error.message, error.rawError?.message, {
          showSettingsButton: true,
        }).open()
      } else {
        new Notice(error.message)
        console.error('Failed to generate response', error)
      }
    },
  })

  return {
    abortActiveStreams,
    submitChatMutation,
  }
}
