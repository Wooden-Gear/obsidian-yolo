import { z } from 'zod'

import { customParameterSchema } from './custom-parameter.types'

export const CHAT_MODEL_MODALITIES = ['text', 'vision', 'pdf'] as const
export const chatModelModalitySchema = z.enum(CHAT_MODEL_MODALITIES)
export type ChatModelModality = z.infer<typeof chatModelModalitySchema>

const webSearchToggleSchema = z
  .object({
    webSearch: z
      .object({
        enabled: z.boolean(),
      })
      .optional(),
  })
  .optional()

/**
 * Built-in (a.k.a. hosted / server-side) tools provided by the model provider
 * itself — not function-calling tools the agent runs. They typically share the
 * same `tools` array slot in the request payload but use provider-specific
 * shapes (e.g. `{type:"web_search"}` for OpenAI, `{type:"openrouter:web_search"}`
 * for OpenRouter). Configure which provider's built-in tools to enable via
 * `builtinToolProvider`, and per-provider toggles via the matching sub-key.
 */
export const builtinToolsConfigSchema = z
  .object({
    gpt: webSearchToggleSchema,
    openrouter: webSearchToggleSchema,
  })
  .optional()

export const chatModelSchema = z.object({
  providerId: z
    .string({
      required_error: 'provider ID is required',
    })
    .min(1, 'provider ID is required'),
  id: z
    .string({
      required_error: 'id is required',
    })
    .min(1, 'id is required'),
  model: z
    .string({
      required_error: 'model is required',
    })
    .min(1, 'model is required'),
  // Optional display name for UI. When absent, UI should fallback to showing `model`.
  name: z.string().optional(),
  enable: z.boolean().default(true).optional(),
  reasoningType: z.enum(['none', 'openai', 'gemini', 'anthropic']).optional(),
  temperature: z.number().min(0).max(2).optional(),
  topP: z.number().min(0).max(1).optional(),
  maxContextTokens: z.number().int().min(1).optional(),
  maxOutputTokens: z.number().int().min(1).optional(),
  customParameters: z.array(customParameterSchema).optional(),
  modalities: z.array(chatModelModalitySchema).optional(),
  // Which provider's built-in (hosted) tools to enable on this model.
  // 'gemini' / 'gpt' / 'openrouter' map to the provider-native tool family in
  // the request body. See `builtinTools` for per-family toggles.
  builtinToolProvider: z
    .enum(['none', 'gemini', 'gpt', 'openrouter'])
    .default('none')
    .optional(),
  builtinTools: builtinToolsConfigSchema,
  web_search_options: z
    .object({
      search_context_size: z.string(),
    })
    .optional(),
})

export type ChatModel = z.infer<typeof chatModelSchema>
