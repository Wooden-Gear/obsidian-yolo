import { ChatModel } from '../../types/chat-model.types'

/**
 * Provider built-in (hosted / server-side) tools. These are executed on the
 * model provider's side and share the same `tools` array slot as
 * function-calling tools in the request body — but use provider-specific
 * shapes. Configured per-model via `builtinToolProvider` + `builtinTools`.
 */
export type BuiltinProviderTool =
  | { type: 'web_search' } // OpenAI / OpenAI-compatible hosted web search
  | { type: 'openrouter:web_search' } // OpenRouter server tool: web_search

export function getBuiltinProviderTools(
  model: Pick<ChatModel, 'builtinToolProvider' | 'builtinTools'>,
): BuiltinProviderTool[] {
  switch (model.builtinToolProvider) {
    case 'gpt': {
      const tools: BuiltinProviderTool[] = []
      if (model.builtinTools?.gpt?.webSearch?.enabled) {
        tools.push({ type: 'web_search' })
      }
      return tools
    }
    case 'openrouter': {
      const tools: BuiltinProviderTool[] = []
      if (model.builtinTools?.openrouter?.webSearch?.enabled) {
        tools.push({ type: 'openrouter:web_search' })
      }
      return tools
    }
    default:
      return []
  }
}
