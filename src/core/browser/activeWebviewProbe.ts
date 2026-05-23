/**
 * Detect & read from the user's active webview leaf.
 *
 * Only explicit viewTypes are supported:
 *   - 'webviewer'   (Obsidian 1.8+ core Web Viewer)
 *   - 'url-webview' (.url WebView Opener — Kieirra/obsidian-url-extension)
 *
 * Other viewTypes that happen to host a <webview> element (Surfing, etc.)
 * are intentionally ignored to avoid pulling content from unverified plugins.
 *
 * This module is desktop-only. Callers must short-circuit on Platform.isMobile
 * before invoking probe functions — there is no <webview> element on mobile.
 */

import type { App, WorkspaceLeaf } from 'obsidian'

export const SUPPORTED_WEBVIEW_VIEW_TYPES = [
  'webviewer',
  'url-webview',
] as const

export type SupportedViewType = (typeof SUPPORTED_WEBVIEW_VIEW_TYPES)[number]

export type BrowserContextSource = 'core_webviewer' | 'url_webview_opener'

const VIEW_TYPE_TO_SOURCE: Record<SupportedViewType, BrowserContextSource> = {
  webviewer: 'core_webviewer',
  'url-webview': 'url_webview_opener',
}

export const BROWSER_PAGE_ID_PATTERN = /^page_[a-z0-9]{8}_[a-z0-9]{8}$/

const leafPageIds = new WeakMap<WorkspaceLeaf, string>()
const usedPageIds = new Set<string>()

const randomPageIdToken = (): string =>
  Math.random().toString(36).slice(2).padEnd(8, '0').slice(0, 8)

const pageIdSession = randomPageIdToken()

const getLeafPageId = (leaf: WorkspaceLeaf): string => {
  const existing = leafPageIds.get(leaf)
  if (existing) return existing
  let pageId = ''
  do {
    pageId = `page_${pageIdSession}_${randomPageIdToken()}`
  } while (usedPageIds.has(pageId))
  usedPageIds.add(pageId)
  leafPageIds.set(leaf, pageId)
  return pageId
}

/**
 * Structural type for the parts of the Electron `<webview>` API we depend on.
 * Avoids pulling in @types/electron and keeps the probe testable.
 */
export type WebviewLike = {
  getURL: () => string
  getTitle: () => string
  executeJavaScript: (code: string, userGesture?: boolean) => Promise<unknown>
  isLoading?: () => boolean
  isLoadingMainFrame?: () => boolean
}

export type ActiveWebviewHandle = {
  pageId: string
  leaf: WorkspaceLeaf
  webview: WebviewLike
  viewType: SupportedViewType
  source: BrowserContextSource
  /**
   * True when the handle came from the workspace's most-recent leaf (the user
   * was last interacting with this webview). False when it came from the
   * `recentlyFocusedWebviewLeaf` scan — i.e. the user's current focus is on
   * something else (note, log tab, canvas) and this webview is only still
   * open in the background.
   */
  userFocused: boolean
}

const isSupportedViewType = (viewType: string): viewType is SupportedViewType =>
  (SUPPORTED_WEBVIEW_VIEW_TYPES as readonly string[]).includes(viewType)

const handleFromLeaf = (
  leaf: WorkspaceLeaf,
  userFocused: boolean,
): ActiveWebviewHandle | null => {
  const view = leaf.view
  const viewType =
    typeof view.getViewType === 'function' ? view.getViewType() : ''
  if (!isSupportedViewType(viewType)) return null

  const containerEl = view.containerEl
  if (!containerEl) return null

  const element = containerEl.querySelector('webview')
  if (!element) return null

  const candidate = element as unknown as Partial<WebviewLike>
  if (
    typeof candidate.getURL !== 'function' ||
    typeof candidate.getTitle !== 'function' ||
    typeof candidate.executeJavaScript !== 'function'
  ) {
    return null
  }

  return {
    pageId: getLeafPageId(leaf),
    leaf,
    webview: candidate as WebviewLike,
    viewType,
    source: VIEW_TYPE_TO_SOURCE[viewType],
    userFocused,
  }
}

export type FindActiveWebviewOptions = {
  /**
   * Fallback leaf, tracked externally via `BrowserFocusTracker`. When the
   * user's current focus is not itself a webview, this leaf is used so the
   * model can still see the page they were last viewing. Pass null to
   * disable the fallback entirely.
   *
   * Caller is responsible for ensuring the leaf is still alive; the probe
   * additionally rejects it if `view`/`containerEl`/`<webview>` checks fail.
   */
  recentlyFocusedWebviewLeaf?: WorkspaceLeaf | null
}

/**
 * Synchronously find the user's active webview leaf if it belongs to a
 * supported source. Returns null when:
 *   - There is no most-recent leaf
 *   - The leaf's viewType is not in the allowlist
 *   - The leaf's container does not contain a <webview> element
 *   - The webview element is missing the expected sync methods
 *
 * Uses `getMostRecentLeaf(rootSplit)` rather than the deprecated
 * `workspace.activeLeaf`. Webviews are normally opened in the root split
 * (main editor area) by core Web Viewer and `.url WebView Opener`, so this
 * picks up the page the user was just interacting with even if they refocused
 * the chat sidebar to send a message.
 */
export function findActiveWebviewHandle(
  app: App,
  options: FindActiveWebviewOptions = {},
): ActiveWebviewHandle | null {
  const workspace = app.workspace
  const leaf =
    workspace.getMostRecentLeaf(workspace.rootSplit) ??
    workspace.getMostRecentLeaf()
  if (leaf) {
    const handle = handleFromLeaf(leaf, true)
    if (handle) return handle
  }

  const recent = options.recentlyFocusedWebviewLeaf
  if (recent) {
    const fallback = handleFromLeaf(recent, false)
    if (fallback) return fallback
  }

  return null
}

/**
 * Locate an open webview leaf by its opaque page id from `<browser_context>`.
 * This disambiguates multiple open pages with the same URL.
 * Page ids use format `page_<8 lowercase base36 chars>_<8 lowercase base36
 * chars>`. Both tokens are random-looking: the first is per plugin process,
 * the second is per leaf. They are stable only while the plugin process and
 * target leaf remain alive.
 *
 * Intentionally searches all open supported webviews, not just the current or
 * most-recent page: when the model has a prior `<page_id>`, the user may ask
 * it to read that still-open page explicitly.
 */
export function findWebviewHandleByPageId(
  app: App,
  pageId: string,
): ActiveWebviewHandle | null {
  if (!pageId) return null
  const workspace = app.workspace
  if (typeof workspace.iterateAllLeaves !== 'function') return null
  let match: ActiveWebviewHandle | null = null
  workspace.iterateAllLeaves((leaf) => {
    if (match) return
    const handle = handleFromLeaf(leaf, false)
    if (handle?.pageId === pageId) match = handle
  })
  return match
}

export type ActiveWebviewSnapshot = {
  pageId: string
  source: BrowserContextSource
  viewType: SupportedViewType
  url: string
  title: string
  loading: boolean
  /**
   * Whether the user's most-recent leaf IS this webview. False when the
   * webview was located via `recentlyFocusedWebviewLeaf` — i.e. the user's
   * current focus is on a note/log/canvas and this page is a background tab.
   */
  userFocused: boolean
  meta?: {
    visibleTextChars: number
    renderedHtmlChars: number
    selectionChars: number
    scrollY: number
    viewportHeight: number
    documentHeight: number
  }
  selection?: string
  selectionTruncated?: boolean
}

const DEFAULT_SELECTION_TIMEOUT_MS = 200
const DEFAULT_META_TIMEOUT_MS = 200
const TRUNCATION_SUFFIX = '...(truncated)'

export const isWebviewLoading = (webview: WebviewLike): boolean => {
  let loading = false
  try {
    if (typeof webview.isLoadingMainFrame === 'function') {
      loading = Boolean(webview.isLoadingMainFrame()) || loading
    }
    if (typeof webview.isLoading === 'function') {
      loading = Boolean(webview.isLoading()) || loading
    }
  } catch {
    return false
  }
  return loading
}

const truncateSelection = (
  selection: string,
  maxChars: number,
): { value: string; truncated: boolean } => {
  if (maxChars <= 0) return { value: '', truncated: false }
  if (selection.length <= maxChars) {
    return { value: selection, truncated: false }
  }
  // Keep room for the suffix so the model sees the truncation marker.
  const head = Math.max(0, maxChars - TRUNCATION_SUFFIX.length)
  return {
    value: `${selection.slice(0, head)}${TRUNCATION_SUFFIX}`,
    truncated: true,
  }
}

const withTimeout = <T>(promise: Promise<T>, timeoutMs: number): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      reject(new Error(`Timed out after ${timeoutMs}ms`))
    }, timeoutMs)
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

const readSelectionFromWebview = async (
  webview: WebviewLike,
  maxSelectionChars: number,
  timeoutMs: number,
): Promise<{ value: string; truncated: boolean } | null> => {
  if (maxSelectionChars <= 0) return null
  try {
    const raw = await withTimeout(
      webview.executeJavaScript(
        'String(window.getSelection ? window.getSelection().toString() : "")',
      ),
      timeoutMs,
    )
    if (typeof raw !== 'string') return null
    const trimmed = raw.trim()
    if (trimmed.length === 0) return null
    return truncateSelection(trimmed, maxSelectionChars)
  } catch {
    // Timeout / cross-origin / page closed — skip selection silently.
    return null
  }
}

const PAGE_META_SCRIPT = `(() => {
  const doc = document;
  const body = doc.body;
  const root = doc.documentElement;
  const text = (body ? body.textContent : root ? root.textContent : '') || '';
  const html = (root ? root.outerHTML : body ? body.outerHTML : '') || '';
  const selection = window.getSelection ? String(window.getSelection().toString() || '') : '';
  const viewportHeight = window.innerHeight || (root ? root.clientHeight : 0) || 0;
  const documentHeight = Math.max(
    body ? body.scrollHeight : 0,
    body ? body.offsetHeight : 0,
    root ? root.clientHeight : 0,
    root ? root.scrollHeight : 0,
    root ? root.offsetHeight : 0
  );
  return {
    visibleTextChars: text.trim().length,
    renderedHtmlChars: html.length,
    selectionChars: selection.trim().length,
    scrollY: Math.max(0, Math.round(window.scrollY || window.pageYOffset || 0)),
    viewportHeight: Math.max(0, Math.round(viewportHeight)),
    documentHeight: Math.max(0, Math.round(documentHeight)),
  };
})()`

const isPageMeta = (
  value: unknown,
): value is NonNullable<ActiveWebviewSnapshot['meta']> => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.visibleTextChars === 'number' &&
    typeof v.renderedHtmlChars === 'number' &&
    typeof v.selectionChars === 'number' &&
    typeof v.scrollY === 'number' &&
    typeof v.viewportHeight === 'number' &&
    typeof v.documentHeight === 'number'
  )
}

const readPageMetaFromWebview = async (
  webview: WebviewLike,
  timeoutMs: number,
): Promise<ActiveWebviewSnapshot['meta'] | undefined> => {
  try {
    const raw = await withTimeout(
      webview.executeJavaScript(PAGE_META_SCRIPT),
      timeoutMs,
    )
    return isPageMeta(raw) ? raw : undefined
  } catch {
    return undefined
  }
}

/**
 * Read URL/title/loading/(optional)selection from the active webview. The caller is
 * responsible for first calling `findActiveWebviewHandle` and passing in the
 * resulting handle.
 *
 * URL/title/loading come from sync Electron `<webview>` APIs. Selection and
 * page metadata are read via `executeJavaScript` only after the webview stops
 * loading, and are bounded by short timeouts.
 *
 * Returns null when the page hasn't finished loading (URL empty) — that's the
 * convention used by `<webview>` before navigation completes.
 */
export async function readActiveWebviewSnapshot(
  handle: ActiveWebviewHandle,
  options: {
    maxSelectionChars: number
    selectionTimeoutMs?: number
    metaTimeoutMs?: number
  },
): Promise<ActiveWebviewSnapshot | null> {
  const url = handle.webview.getURL()
  if (!url || url === 'about:blank') return null
  const title = handle.webview.getTitle()
  const loading = isWebviewLoading(handle.webview)
  if (loading) {
    return {
      pageId: handle.pageId,
      source: handle.source,
      viewType: handle.viewType,
      url,
      title,
      loading,
      userFocused: handle.userFocused,
    }
  }

  const [selection, meta] = await Promise.all([
    readSelectionFromWebview(
      handle.webview,
      options.maxSelectionChars,
      options.selectionTimeoutMs ?? DEFAULT_SELECTION_TIMEOUT_MS,
    ),
    readPageMetaFromWebview(
      handle.webview,
      options.metaTimeoutMs ?? DEFAULT_META_TIMEOUT_MS,
    ),
  ])
  return {
    pageId: handle.pageId,
    source: handle.source,
    viewType: handle.viewType,
    url,
    title,
    loading,
    userFocused: handle.userFocused,
    meta,
    selection: selection?.value,
    selectionTruncated: selection?.truncated,
  }
}
