/**
 * Minimal tests for PromptGenerator brute mode behavior
 */
import { App, type FileStats, TFile } from 'obsidian'

import type { RAGEngine } from '../../core/rag/ragEngine'
import type { SmartComposerSettings } from '../../settings/schema/setting.types'
import { parseSmartComposerSettings } from '../../settings/schema/settings'
import type { ChatUserMessage } from '../../types/chat'
import type { ContentPart } from '../../types/llm/request'

import { PromptGenerator } from './promptGenerator'

jest.mock('../llm/token', () => ({
  tokenCount: jest.fn(() => Promise.resolve(999999)), // force threshold exceed
}))

jest.mock('../obsidian', () => ({
  readMultipleTFiles: jest.fn(() => Promise.resolve(['A', 'B'])),
  getNestedFiles: jest.fn((_folder: unknown) => []),
  readTFileContent: jest.fn(() => Promise.resolve('X')),
}))

describe('PromptGenerator brute mode', () => {
  const createMockTFile = (path: string, vault: App['vault']): TFile => {
    const file: TFile = Object.create(TFile.prototype)
    const extension = path.split('.').pop() ?? ''
    const basename = path.split('/').pop() ?? path
    const defaultStat: FileStats = { ctime: 0, mtime: 0, size: 0 }
    file.path = path
    file.name = basename
    file.basename = basename
    file.extension = extension
    file.stat = defaultStat
    file.vault = vault
    file.parent = null
    return file
  }

  it('forces non-RAG and concatenates all mentioned files', async () => {
    const fakeApp = { vault: {} } as unknown as App
    const baseSettings = parseSmartComposerSettings({})
    const settings: SmartComposerSettings = {
      ...baseSettings,
      ragOptions: {
        ...baseSettings.ragOptions,
        thresholdTokens: 10,
      },
      chatOptions: {
        ...baseSettings.chatOptions,
        includeCurrentFileContent: false,
        maxContextMessages: 0,
      },
      assistants: [],
    }

    const gen = new PromptGenerator(
      (): Promise<RAGEngine> =>
        Promise.reject(
          new Error('RAG engine should not be used in brute mode tests'),
        ),
      fakeApp,
      settings,
    )

    const file1 = createMockTFile('a.md', fakeApp.vault)
    const file2 = createMockTFile('b.md', fakeApp.vault)

    const message: ChatUserMessage = {
      role: 'user',
      id: 'user-message',
      content: {
        root: { children: [{ type: 'paragraph', children: [{ text: 'Q' }] }] },
      } as unknown as ChatUserMessage['content'],
      promptContent: null,
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
