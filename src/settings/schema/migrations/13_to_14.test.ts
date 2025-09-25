import { migrateFrom13To14 } from './13_to_14'

describe('migrateFrom13To14', () => {
  it('should populate default tab completion options when missing', () => {
    const result = migrateFrom13To14({
      version: 13,
      continuationOptions: {},
    })

    expect(result.version).toBe(14)
    expect(result.continuationOptions).toHaveProperty('tabCompletionOptions')
    const options = (result.continuationOptions as any).tabCompletionOptions
    expect(options).toMatchObject({
      triggerDelayMs: 3000,
      minContextLength: 20,
      maxContextChars: 4000,
      maxSuggestionLength: 240,
      temperature: 0.5,
      requestTimeoutMs: 12000,
      maxRetries: 0,
    })
  })

  it('should normalize existing tab completion options', () => {
    const result = migrateFrom13To14({
      version: 13,
      continuationOptions: {
        tabCompletionOptions: {
          triggerDelayMs: '5000',
          minContextLength: '5',
          maxContextChars: 8000,
          maxSuggestionLength: '600',
          temperature: '0.8',
          requestTimeoutMs: '20000',
          maxRetries: '3',
        },
      },
    })

    expect(result.version).toBe(14)
    const options = (result.continuationOptions as any).tabCompletionOptions
    expect(options).toMatchObject({
      triggerDelayMs: 5000,
      minContextLength: 5,
      maxContextChars: 8000,
      maxSuggestionLength: 600,
      temperature: 0.8,
      requestTimeoutMs: 20000,
      maxRetries: 3,
    })
  })
})

