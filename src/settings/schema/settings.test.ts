import {
  DEFAULT_APPLY_MODEL_ID,
  DEFAULT_CHAT_MODELS,
  DEFAULT_CHAT_MODEL_ID,
  DEFAULT_EMBEDDING_MODELS,
  DEFAULT_PROVIDERS,
} from '../../constants'

import { SETTINGS_SCHEMA_VERSION } from './migrations'
import { parseSmartComposerSettings } from './settings'

describe('parseSmartComposerSettings', () => {
  it('should return default values for empty input', () => {
    const result = parseSmartComposerSettings({})
    expect(result).toEqual({
      version: SETTINGS_SCHEMA_VERSION,

      providers: [...DEFAULT_PROVIDERS],

      chatModels: [...DEFAULT_CHAT_MODELS],
      embeddingModels: [...DEFAULT_EMBEDDING_MODELS],

      chatModelId: DEFAULT_CHAT_MODEL_ID,
      applyModelId: DEFAULT_APPLY_MODEL_ID,
      embeddingModelId: 'openai/text-embedding-3-small',

      systemPrompt: '',

      ragOptions: {
        chunkSize: 1000,
        thresholdTokens: 8192,
        minSimilarity: 0.0,
        limit: 10,
        excludePatterns: [],
        includePatterns: [],
        autoUpdateEnabled: false,
        autoUpdateIntervalHours: 24,
        lastAutoUpdateAt: 0,
      },

      mcp: {
        servers: [],
      },

      chatOptions: {
        includeCurrentFileContent: true,
        enableTools: true,
        maxAutoIterations: 1,
        maxContextMessages: 32,
      },

      continuationOptions: {
        useCurrentModel: true,
        fixedModelId: 'openai/gpt-4.1-mini',
        defaultSystemPrompt:
          'You are a helpful writing assistant. Continue writing from the provided context without repeating or paraphrasing the context. Match the tone, language, and style. Output only the continuation text.',
        enableKeywordTrigger: true,
        triggerKeyword: '  ',
        enableFloatingPanelKeywordTrigger: false,
        floatingPanelTriggerKeyword: '',
      },

      assistants: [],
      language: 'en',
    })
  })
})
