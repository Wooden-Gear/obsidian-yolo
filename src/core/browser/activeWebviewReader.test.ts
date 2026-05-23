import type { ActiveWebviewHandle, WebviewLike } from './activeWebviewProbe'
import {
  BrowserReadFailure,
  MAX_BROWSER_READ_MAX_CHARS,
  readActiveWebviewPage,
} from './activeWebviewReader'

const buildHandle = (webview: Partial<WebviewLike>): ActiveWebviewHandle => ({
  leaf: {} as ActiveWebviewHandle['leaf'],
  webview: {
    getURL: () => 'https://example.com/article',
    getTitle: () => 'Example',
    executeJavaScript: () => Promise.resolve(''),
    ...webview,
  } as WebviewLike,
  viewType: 'webviewer',
  source: 'core_webviewer',
})

describe('readActiveWebviewPage', () => {
  it('returns already rendered content when URL is not ready yet', async () => {
    const handle = buildHandle({
      getURL: () => '',
      executeJavaScript: () =>
        Promise.resolve({
          url: '',
          title: 'Partial',
          html: '<p>Partial body</p>',
          keyInfo: 'Partial body',
          headings: [],
          links: [],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'readable',
      maxChars: 1000,
    })
    expect(result?.title).toBe('Partial')
    expect(result?.text).toBe('<p>Partial body</p>')
    expect(result?.loading).toBe(false)
  })

  it('returns null for an empty about:blank page', async () => {
    const handle = buildHandle({
      getURL: () => 'about:blank',
      executeJavaScript: () =>
        Promise.resolve({
          url: 'about:blank',
          title: '',
          html: '',
          keyInfo: '',
          headings: [],
          links: [],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'readable',
      maxChars: 1000,
    })
    expect(result).toBeNull()
  })

  it('returns markdown text in readable format', async () => {
    const handle = buildHandle({
      executeJavaScript: () =>
        Promise.resolve({
          url: 'https://example.com/article',
          title: 'Article',
          html: '<h1>Hi</h1><p>Body text</p>',
          keyInfo: 'Hi\nBody text',
          headings: [{ level: 1, text: 'Hi' }],
          links: [],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'readable',
      maxChars: 1000,
    })
    expect(result).not.toBeNull()
    expect(result?.text).toBe('<h1>Hi</h1><p>Body text</p>') // mocked htmlToMarkdown is identity
    expect(result?.source).toBe('core_webviewer')
    expect(result?.headings).toEqual([{ level: 1, text: 'Hi' }])
    expect(result?.redactions).toEqual([])
  })

  it('returns raw HTML when format=raw_html', async () => {
    const handle = buildHandle({
      executeJavaScript: () =>
        Promise.resolve({
          url: 'https://example.com',
          title: 'X',
          html: '<div>Some <em>raw</em> markup</div>',
          keyInfo: 'Some raw markup',
          headings: [],
          links: [{ text: 'a', href: '/x' }],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'raw_html',
      maxChars: 1000,
    })
    expect(result?.text).toBe('<div>Some <em>raw</em> markup</div>')
    expect(result?.links).toEqual([{ text: 'a', href: '/x' }])
  })

  it('drops body text when format=links_and_headings', async () => {
    const handle = buildHandle({
      executeJavaScript: () =>
        Promise.resolve({
          url: 'https://example.com',
          title: 'X',
          html: '<h1>Title</h1><p>body</p><a href="/y">y</a>',
          keyInfo: 'Title\nbody',
          headings: [{ level: 1, text: 'Title' }],
          links: [{ text: 'y', href: '/y' }],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'links_and_headings',
      maxChars: 1000,
    })
    expect(result?.text).toBeUndefined()
    expect(result?.headings).toEqual([{ level: 1, text: 'Title' }])
    expect(result?.links).toEqual([{ text: 'y', href: '/y' }])
  })

  it('returns compact key visible information including formulas', async () => {
    const handle = buildHandle({
      executeJavaScript: () =>
        Promise.resolve({
          url: 'https://example.com',
          title: 'X',
          html: '<article><h1>Paper</h1><p>Long body</p></article>',
          keyInfo: '## Main result\nFormula: E = mc^2\n- Important point',
          headings: [{ level: 2, text: 'Main result' }],
          links: [],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'key_visible_info',
      maxChars: 1000,
    })
    expect(result?.text).toContain('Formula: E = mc^2')
    expect(result?.text).toContain('Important point')
    expect(result?.headings).toEqual([{ level: 2, text: 'Main result' }])
  })

  it('truncates text exceeding maxChars and reports truncation metadata', async () => {
    const html = 'a'.repeat(1000)
    const handle = buildHandle({
      executeJavaScript: () =>
        Promise.resolve({
          url: 'https://example.com',
          title: 'X',
          html,
          keyInfo: html,
          headings: [],
          links: [],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'readable',
      maxChars: 100,
    })
    expect(result?.text?.length).toBe(100)
    expect(result?.range).toEqual({
      startChar: 0,
      endChar: 100,
      totalChars: 1000,
      nextStartChar: 100,
    })
    expect(result?.truncated).toEqual({ totalChars: 1000, returnedChars: 100 })
  })

  it('reads a later segment when startChar is provided', async () => {
    const handle = buildHandle({
      executeJavaScript: () =>
        Promise.resolve({
          url: 'https://example.com',
          title: 'X',
          html: '0123456789abcdef',
          keyInfo: '0123456789abcdef',
          headings: [],
          links: [],
          counts: { password: 0, hidden_input: 0, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'raw_html',
      maxChars: 4,
      startChar: 8,
    })
    expect(result?.text).toBe('89ab')
    expect(result?.range).toEqual({
      startChar: 8,
      endChar: 12,
      totalChars: 16,
      nextStartChar: 12,
    })
  })

  it('allows larger rendered output chunks', () => {
    expect(MAX_BROWSER_READ_MAX_CHARS).toBe(500000)
  })

  it('surfaces redaction counts', async () => {
    const handle = buildHandle({
      executeJavaScript: () =>
        Promise.resolve({
          url: 'https://example.com',
          title: 'X',
          html: '',
          keyInfo: '',
          headings: [],
          links: [],
          counts: { password: 1, hidden_input: 3, file_input: 0 },
        }),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'readable',
      maxChars: 1000,
    })
    expect(result?.redactions).toEqual([
      { kind: 'password', count: 1 },
      { kind: 'hidden_input', count: 3 },
    ])
  })

  it('wraps extraction errors in BrowserReadFailure', async () => {
    const handle = buildHandle({
      executeJavaScript: () => Promise.reject(new Error('boom')),
    })
    await expect(
      readActiveWebviewPage(handle, {
        scope: 'document',
        format: 'readable',
        maxChars: 1000,
      }),
    ).rejects.toBeInstanceOf(BrowserReadFailure)
  })

  it('flags timeout via BrowserReadFailure code=extraction_timeout', async () => {
    const handle = buildHandle({
      executeJavaScript: () => new Promise(() => undefined),
    })
    await expect(
      readActiveWebviewPage(handle, {
        scope: 'document',
        format: 'readable',
        maxChars: 1000,
        executionTimeoutMs: 20,
      }),
    ).rejects.toMatchObject({ code: 'extraction_timeout' })
  })

  it('returns partial success instead of timing out while the page is loading', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/loading',
      getTitle: () => 'Loading',
      isLoading: () => true,
      executeJavaScript: () => new Promise(() => undefined),
    })
    const result = await readActiveWebviewPage(handle, {
      scope: 'document',
      format: 'key_visible_info',
      maxChars: 1000,
      executionTimeoutMs: 20,
    })
    expect(result).toMatchObject({
      url: 'https://example.com/loading',
      title: 'Loading',
      loading: true,
      text: '',
      headings: [],
      links: [],
      partial: { reason: 'page_loading' },
      redactions: [],
    })
  })

  it('rejects malformed extraction payloads', async () => {
    const handle = buildHandle({
      executeJavaScript: () => Promise.resolve({ url: 1, title: 2 }),
    })
    await expect(
      readActiveWebviewPage(handle, {
        scope: 'document',
        format: 'readable',
        maxChars: 1000,
      }),
    ).rejects.toMatchObject({ code: 'extraction_failed' })
  })
})
