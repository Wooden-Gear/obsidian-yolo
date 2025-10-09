import { DEFAULT_TAB_COMPLETION_SYSTEM_PROMPT } from '../setting.types'

import { migrateFrom14To15 } from './14_to_15'

describe('migrateFrom14To15', () => {
  it('should add defaults when options missing', () => {
    const result = migrateFrom14To15({
      version: 14,
      continuationOptions: {},
    })

    expect(result.version).toBe(15)
    const options = (result.continuationOptions as any)?.tabCompletionOptions
    expect(options).toMatchObject({
      maxTokens: 64,
      maxSuggestionLength: 240,
    })
    expect((result.continuationOptions as any).tabCompletionSystemPrompt).toBe(
      DEFAULT_TAB_COMPLETION_SYSTEM_PROMPT,
    )
  })

  it('should preserve existing values', () => {
    const result = migrateFrom14To15({
      version: 14,
      continuationOptions: {
        tabCompletionOptions: {
          maxTokens: 120,
        },
        tabCompletionSystemPrompt: 'Custom prompt',
      },
    })

    expect(result.version).toBe(15)
    const options = (result.continuationOptions as any).tabCompletionOptions
    expect(options.maxTokens).toBe(120)
    expect((result.continuationOptions as any).tabCompletionSystemPrompt).toBe(
      'Custom prompt',
    )
  })
})
