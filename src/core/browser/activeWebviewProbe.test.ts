import type { App } from 'obsidian'

import {
  type ActiveWebviewHandle,
  type WebviewLike,
  findActiveWebviewHandle,
  readActiveWebviewSnapshot,
} from './activeWebviewProbe'

// Minimal element stub providing only the API findActiveWebviewHandle relies on.
type ContainerEl = {
  querySelector: (selector: string) => unknown
}

const buildFakeApp = (
  viewType: string | null,
  webview: Partial<WebviewLike> | null,
): App => {
  if (viewType === null) {
    return {
      workspace: {
        rootSplit: {},
        getMostRecentLeaf: () => null,
      },
    } as unknown as App
  }
  const containerEl: ContainerEl = {
    querySelector: (selector: string) =>
      selector === 'webview' ? webview : null,
  }
  const leaf = {
    view: {
      getViewType: () => viewType,
      containerEl,
    },
  }
  return {
    workspace: {
      rootSplit: {},
      getMostRecentLeaf: () => leaf,
    },
  } as unknown as App
}

const stubWebview = (
  overrides: Partial<WebviewLike> = {},
): Partial<WebviewLike> => ({
  getURL: () => 'https://example.com/page',
  getTitle: () => 'Example',
  executeJavaScript: () => Promise.resolve(''),
  ...overrides,
})

describe('findActiveWebviewHandle', () => {
  it('returns null when there is no active leaf', () => {
    expect(findActiveWebviewHandle(buildFakeApp(null, null))).toBeNull()
  })

  it('returns null when viewType is not in the allowlist', () => {
    expect(
      findActiveWebviewHandle(buildFakeApp('surfing-view', stubWebview())),
    ).toBeNull()
  })

  it('returns null when no <webview> element exists', () => {
    expect(findActiveWebviewHandle(buildFakeApp('webviewer', null))).toBeNull()
  })

  it('returns null when the <webview> element is missing required methods', () => {
    expect(
      findActiveWebviewHandle(buildFakeApp('webviewer', { getURL: () => 'x' })),
    ).toBeNull()
  })

  it('maps viewType=webviewer → source=core_webviewer', () => {
    const handle = findActiveWebviewHandle(
      buildFakeApp('webviewer', stubWebview()),
    )
    expect(handle).not.toBeNull()
    expect(handle?.source).toBe('core_webviewer')
    expect(handle?.viewType).toBe('webviewer')
  })

  it('maps viewType=url-webview → source=url_webview_opener', () => {
    const handle = findActiveWebviewHandle(
      buildFakeApp('url-webview', stubWebview()),
    )
    expect(handle).not.toBeNull()
    expect(handle?.source).toBe('url_webview_opener')
    expect(handle?.viewType).toBe('url-webview')
  })
})

const buildHandle = (webview: Partial<WebviewLike>): ActiveWebviewHandle => {
  const handle = findActiveWebviewHandle(buildFakeApp('webviewer', webview))
  if (!handle) throw new Error('handle should exist for test fixture')
  return handle
}

describe('readActiveWebviewSnapshot', () => {
  it('returns null when URL is empty (page not yet loaded)', async () => {
    const handle = buildHandle({
      getURL: () => '',
      getTitle: () => '',
      executeJavaScript: () => Promise.resolve(''),
    })
    expect(
      await readActiveWebviewSnapshot(handle, { maxSelectionChars: 2000 }),
    ).toBeNull()
  })

  it('returns null for about:blank', async () => {
    const handle = buildHandle({
      getURL: () => 'about:blank',
      getTitle: () => '',
      executeJavaScript: () => Promise.resolve(''),
    })
    expect(
      await readActiveWebviewSnapshot(handle, { maxSelectionChars: 2000 }),
    ).toBeNull()
  })

  it('returns snapshot with URL/title and omits selection when empty', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Example Article',
      executeJavaScript: () => Promise.resolve(''),
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 2000,
    })
    expect(snapshot).toEqual({
      source: 'core_webviewer',
      viewType: 'webviewer',
      url: 'https://example.com/article',
      title: 'Example Article',
      loading: false,
      meta: undefined,
      selection: undefined,
      selectionTruncated: undefined,
    })
  })

  it('includes page length and viewport metadata when available', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Example Article',
      executeJavaScript: (code) => {
        if (code.includes('visibleTextChars')) {
          return Promise.resolve({
            visibleTextChars: 12345,
            renderedHtmlChars: 54321,
            selectionChars: 9,
            scrollY: 800,
            viewportHeight: 700,
            documentHeight: 5000,
          })
        }
        return Promise.resolve('selected')
      },
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 2000,
    })
    expect(snapshot?.meta).toEqual({
      visibleTextChars: 12345,
      renderedHtmlChars: 54321,
      selectionChars: 9,
      scrollY: 800,
      viewportHeight: 700,
      documentHeight: 5000,
    })
    expect(snapshot?.selection).toBe('selected')
  })

  it('reports loading state and skips page scripts while loading', async () => {
    const exec = jest.fn(() => Promise.resolve('selected'))
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Loading Article',
      isLoading: () => true,
      executeJavaScript: exec,
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 2000,
    })
    expect(snapshot).toEqual({
      source: 'core_webviewer',
      viewType: 'webviewer',
      url: 'https://example.com/article',
      title: 'Loading Article',
      loading: true,
    })
    expect(exec).not.toHaveBeenCalled()
  })

  it('treats either webview loading API as loading', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Loading Article',
      isLoadingMainFrame: () => false,
      isLoading: () => true,
      executeJavaScript: jest.fn(() => Promise.resolve('selected')),
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 2000,
    })
    expect(snapshot?.loading).toBe(true)
    expect(snapshot?.selection).toBeUndefined()
  })

  it('includes trimmed non-empty selection', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Example',
      executeJavaScript: () => Promise.resolve('  highlighted phrase  '),
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 2000,
    })
    expect(snapshot?.selection).toBe('highlighted phrase')
    expect(snapshot?.selectionTruncated).toBe(false)
  })

  it('truncates selection longer than maxSelectionChars and tags as truncated', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Example',
      executeJavaScript: () => Promise.resolve('a'.repeat(50)),
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 20,
    })
    expect(snapshot?.selection).toMatch(/\.\.\.\(truncated\)$/)
    expect(snapshot?.selection?.length).toBeLessThanOrEqual(20)
    expect(snapshot?.selectionTruncated).toBe(true)
  })

  it('skips selection when maxSelectionChars is 0 but still reads page metadata', async () => {
    const exec = jest.fn((_code?: string) => Promise.resolve('something'))
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Example',
      executeJavaScript: exec,
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 0,
    })
    expect(snapshot?.selection).toBeUndefined()
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec.mock.calls[0]?.[0]).toContain('visibleTextChars')
  })

  it('omits selection when executeJavaScript exceeds the timeout', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Example',
      executeJavaScript: () => new Promise(() => undefined),
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 2000,
      selectionTimeoutMs: 20,
    })
    expect(snapshot?.url).toBe('https://example.com/article')
    expect(snapshot?.selection).toBeUndefined()
  })

  it('omits selection when executeJavaScript rejects (cross-origin, page closed, etc.)', async () => {
    const handle = buildHandle({
      getURL: () => 'https://example.com/article',
      getTitle: () => 'Example',
      executeJavaScript: () => Promise.reject(new Error('cross-origin')),
    })
    const snapshot = await readActiveWebviewSnapshot(handle, {
      maxSelectionChars: 2000,
    })
    expect(snapshot?.selection).toBeUndefined()
  })
})
