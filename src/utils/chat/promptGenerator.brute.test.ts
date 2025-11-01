/**
 * Minimal tests for PromptGenerator brute mode behavior
 */
import { App } from 'obsidian'
import type { RAGEngine } from '../../core/rag/ragEngine'
import type { ContentPart } from '../../types/llm/request'

import { PromptGenerator } from './promptGenerator'

jest.mock('../llm/token', () => ({
  tokenCount: jest.fn(async () => 999999), // force threshold exceed
}))

jest.mock('../obsidian', () => ({
  readMultipleTFiles: jest.fn(async () => ['A', 'B']),
  getNestedFiles: jest.fn((_folder: any) => []),
  readTFileContent: jest.fn(async () => 'X'),
}))

describe('PromptGenerator brute mode', () => {
  it('forces non-RAG and concatenates all mentioned files', async () => {
    const fakeApp = { vault: {} } as unknown as App
    const settings: any = {
      ragOptions: { thresholdTokens: 10 },
      chatOptions: { includeCurrentFileContent: false, maxContextMessages: 0 },
      assistants: [],
    }

    const gen = new PromptGenerator(
      async (): Promise<RAGEngine> => {
        throw new Error('RAG engine should not be used in brute mode tests')
      },
      fakeApp,
      settings,
    )

    const file1 = { path: 'a.md' }
    const file2 = { path: 'b.md' }

    const message: any = {
      role: 'user',
      content: {
        root: { children: [{ type: 'paragraph', children: [{ text: 'Q' }] }] },
      },
      mentionables: [
        { type: 'file', file: file1 },
        { type: 'file', file: file2 },
      ],
    }
    const { shouldUseRAG, promptContent } = await gen.compileUserMessagePrompt({
      message,
      chatMode: 'brute',
    })

    expect(shouldUseRAG).toBe(false)
    if (!Array.isArray(promptContent)) {
      throw new Error('Expected promptContent to be an array')
    }
    type TextPart = Extract<ContentPart, { type: 'text' }>
    const textPart = promptContent.find(
      (part): part is TextPart => part.type === 'text',
    )
    expect(textPart?.text).toContain('```a.md')
    expect(textPart?.text).toContain('```b.md')
  })
})
