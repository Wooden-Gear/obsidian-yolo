import { migrateFrom15To16 } from './15_to_16'

describe('migrateFrom15To16', () => {
  it('should enable super continuation when legacy setting used fixed model', () => {
    const result = migrateFrom15To16({
      version: 15,
      chatModelId: 'openai/gpt-4o-mini',
      continuationOptions: {
        useCurrentModel: false,
        fixedModelId: 'anthropic/claude-3-haiku',
      },
    })

    const continuationOptions =
      (result.continuationOptions as Record<string, any>) ?? {}

    expect(result.version).toBe(16)
    expect(continuationOptions.enableSuperContinuation).toBe(true)
    expect(continuationOptions.continuationModelId).toBe(
      'anthropic/claude-3-haiku',
    )
    expect('useCurrentModel' in continuationOptions).toBe(false)
    expect('fixedModelId' in continuationOptions).toBe(false)
  })

  it('should disable super continuation when legacy setting used chat model', () => {
    const result = migrateFrom15To16({
      version: 15,
      chatModelId: 'openai/gpt-4o-mini',
      continuationOptions: {
        useCurrentModel: true,
      },
    })

    const continuationOptions =
      (result.continuationOptions as Record<string, any>) ?? {}

    expect(result.version).toBe(16)
    expect(continuationOptions.enableSuperContinuation).toBe(false)
    expect(continuationOptions.continuationModelId).toBe('openai/gpt-4o-mini')
  })

  it('should fall back to default model when no data present', () => {
    const result = migrateFrom15To16({ version: 15 })

    const continuationOptions =
      (result.continuationOptions as Record<string, any>) ?? {}

    expect(result.version).toBe(16)
    expect(continuationOptions.enableSuperContinuation).toBe(false)
    expect(typeof continuationOptions.continuationModelId).toBe('string')
  })
})
