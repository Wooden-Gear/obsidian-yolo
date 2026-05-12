import { getBuiltinProviderTools } from './model-tools'

describe('getBuiltinProviderTools', () => {
  it('returns web_search when GPT web search is enabled', () => {
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'gpt',
        builtinTools: {
          gpt: { webSearch: { enabled: true } },
        },
      }),
    ).toEqual([{ type: 'web_search' }])
  })

  it('returns no tools when GPT web search is disabled', () => {
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'gpt',
        builtinTools: {
          gpt: { webSearch: { enabled: false } },
        },
      }),
    ).toEqual([])
  })

  it('returns openrouter:web_search when OpenRouter web search is enabled', () => {
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'openrouter',
        builtinTools: {
          openrouter: { webSearch: { enabled: true } },
        },
      }),
    ).toEqual([{ type: 'openrouter:web_search' }])
  })

  it('returns no tools when OpenRouter is selected but web search disabled', () => {
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'openrouter',
        builtinTools: {
          openrouter: { webSearch: { enabled: false } },
        },
      }),
    ).toEqual([])
  })

  it('returns no tools for gemini (no model-level config — Gemini tools come from options)', () => {
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'gemini',
        builtinTools: {
          gpt: { webSearch: { enabled: true } },
          openrouter: { webSearch: { enabled: true } },
        },
      }),
    ).toEqual([])
  })

  it('returns no tools when builtinToolProvider is none or unset', () => {
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'none',
        builtinTools: { gpt: { webSearch: { enabled: true } } },
      }),
    ).toEqual([])
    expect(
      getBuiltinProviderTools({
        builtinTools: { gpt: { webSearch: { enabled: true } } },
      }),
    ).toEqual([])
  })

  it('does not leak GPT toggle to OpenRouter provider and vice versa', () => {
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'openrouter',
        builtinTools: { gpt: { webSearch: { enabled: true } } },
      }),
    ).toEqual([])
    expect(
      getBuiltinProviderTools({
        builtinToolProvider: 'gpt',
        builtinTools: { openrouter: { webSearch: { enabled: true } } },
      }),
    ).toEqual([])
  })
})
