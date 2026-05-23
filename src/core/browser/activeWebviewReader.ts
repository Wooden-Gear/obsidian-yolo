/**
 * Read the rendered contents of the user's active webview (Phase 1).
 *
 * Used by the `browser_read_page` tool when called with
 * `pageId: '$active_webview'`. Always reads from the same source as the
 * passive `<browser_context>` injection so the model sees a consistent view.
 *
 * Implementation notes:
 *   - We run an extraction script inside the webview via `executeJavaScript`.
 *     The script clones a region of the DOM, strips sensitive form inputs,
 *     and returns HTML + headings/links + redaction counts.
 *   - HTML→markdown happens on the host via Obsidian's `htmlToMarkdown` to
 *     match `web_scrape`'s output format.
 *   - Cookies / localStorage / sessionStorage are NEVER read — they only live
 *     in JS state and our extraction script never touches them.
 */

import { htmlToMarkdown } from 'obsidian'

import type {
  ActiveWebviewHandle,
  BrowserContextSource,
  SupportedViewType,
} from './activeWebviewProbe'

export type BrowserReadScope = 'viewport' | 'document' | 'selection'
export type BrowserReadFormat =
  | 'readable'
  | 'raw_html'
  | 'links_and_headings'
  | 'key_visible_info'

export type BrowserReadRedaction = {
  kind: 'password' | 'hidden_input' | 'file_input'
  count: number
}

export type BrowserReadHeading = { level: number; text: string }
export type BrowserReadLink = { text: string; href: string }

export type BrowserReadResult = {
  source: BrowserContextSource
  sourceViewType: SupportedViewType
  url: string
  title: string
  scope: BrowserReadScope
  format: BrowserReadFormat
  capturedAt: number
  text?: string
  headings?: BrowserReadHeading[]
  links?: BrowserReadLink[]
  range?: {
    startChar: number
    endChar: number
    totalChars: number
    nextStartChar?: number
  }
  truncated?: { totalChars: number; returnedChars: number }
  redactions: BrowserReadRedaction[]
}

export type BrowserReadError =
  | 'page_not_ready'
  | 'extraction_failed'
  | 'extraction_timeout'

export class BrowserReadFailure extends Error {
  constructor(
    public readonly code: BrowserReadError,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message)
    this.name = 'BrowserReadFailure'
  }
}

export const DEFAULT_BROWSER_READ_MAX_CHARS = 20000
export const MAX_BROWSER_READ_MAX_CHARS = 500000
const DEFAULT_EXTRACTION_TIMEOUT_MS = 5000

type RawExtractionResult = {
  url: string
  title: string
  html: string
  keyInfo: string
  headings: BrowserReadHeading[]
  links: BrowserReadLink[]
  counts: {
    password: number
    hidden_input: number
    file_input: number
  }
}

const isRawExtractionResult = (
  value: unknown,
): value is RawExtractionResult => {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  return (
    typeof v.url === 'string' &&
    typeof v.title === 'string' &&
    typeof v.html === 'string' &&
    typeof v.keyInfo === 'string' &&
    Array.isArray(v.headings) &&
    Array.isArray(v.links) &&
    typeof v.counts === 'object' &&
    v.counts !== null
  )
}

// Note: the script body is embedded as a string template. Keep it
// self-contained and JSON-safe — it must serialize and run inside the
// remote Electron context.
const EXTRACTION_SCRIPT = `((scope) => {
  const doc = document;
  const counts = { password: 0, hidden_input: 0, file_input: 0 };

  const intersectsViewport = (el) => {
    const rect = el.getBoundingClientRect();
    const vh = window.innerHeight || doc.documentElement.clientHeight || 0;
    const vw = window.innerWidth || doc.documentElement.clientWidth || 0;
    return rect.bottom >= 0 && rect.top <= vh && rect.right >= 0 && rect.left <= vw;
  };

  const isContentElement = (el) => {
    const tag = el.tagName;
    return /^(ARTICLE|SECTION|MAIN|P|LI|PRE|CODE|BLOCKQUOTE|TD|TH|CAPTION|H[1-6]|FIGCAPTION|SUMMARY|DT|DD|A|BUTTON|LABEL|TEXTAREA|INPUT)$/.test(tag);
  };

  const buildViewportWrapper = () => {
    const wrapper = doc.createElement('div');
    const root = doc.body || doc.documentElement;
    if (!root) return wrapper;
    const visibleNodes = [];
    const walk = (el) => {
      if (!el || el.nodeType !== 1) return false;
      if (/^(SCRIPT|STYLE|NOSCRIPT|META|LINK)$/.test(el.tagName)) return false;
      if (!intersectsViewport(el)) return false;
      let childIncluded = false;
      Array.from(el.children || []).forEach((child) => {
        childIncluded = walk(child) || childIncluded;
      });
      const text = (el.innerText || el.textContent || '').trim();
      const includeSelf = !childIncluded && text && isContentElement(el);
      if (includeSelf) visibleNodes.push(el.cloneNode(true));
      return childIncluded || includeSelf;
    };
    Array.from(root.children || []).forEach((child) => walk(child));
    visibleNodes.forEach((node) => wrapper.appendChild(node));
    return wrapper;
  };

  const buildWrapper = () => {
    const sel = window.getSelection ? window.getSelection() : null;
    if (scope === 'selection') {
      const wrapper = doc.createElement('div');
      if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
        wrapper.appendChild(sel.getRangeAt(0).cloneContents());
      }
      return wrapper;
    }
    if (scope === 'viewport') return buildViewportWrapper();
    const root = doc.body || doc.documentElement;
    return root ? root.cloneNode(true) : doc.createElement('div');
  };

  const cloned = buildWrapper();

  const removeMatching = (selector, key) => {
    cloned.querySelectorAll(selector).forEach((el) => {
      counts[key]++;
      el.remove();
    });
  };
  removeMatching('input[type="password"]', 'password');
  removeMatching('input[type="hidden"]', 'hidden_input');
  removeMatching('input[type="file"]', 'file_input');
  cloned.querySelectorAll('script,style,noscript,[hidden],[aria-hidden="true"]').forEach((el) => el.remove());

  const headings = [];
  cloned.querySelectorAll('h1,h2,h3,h4,h5,h6').forEach((el) => {
    const level = parseInt(el.tagName.slice(1), 10);
    const text = (el.textContent || '').trim();
    if (text) headings.push({ level: level, text: text });
  });
  const links = [];
  cloned.querySelectorAll('a[href]').forEach((el) => {
    const href = el.getAttribute('href');
    const text = (el.textContent || '').trim();
    if (href && text) links.push({ text: text, href: href });
  });

  const textOf = (el) => (el.innerText || el.textContent || '').replace(/\\s+/g, ' ').trim();
  const keyRoot = scope === 'document'
    ? (doc.body || doc.documentElement || cloned)
    : cloned;
  const shouldCheckLiveVisibility = keyRoot !== cloned;
  const isVisibleForKeyInfo = (el) => {
    if (!shouldCheckLiveVisibility) return true;
    if (!el || el.nodeType !== 1) return false;
    if (el.closest('[hidden],[aria-hidden="true"]')) return false;
    const style = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (style && (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0')) {
      return false;
    }
    if (/^(SCRIPT|STYLE|NOSCRIPT|META|LINK)$/.test(el.tagName)) return false;
    if (/^(HTML|BODY|ARTICLE|SECTION|MAIN|DIV|UL|OL|TABLE|TBODY|THEAD|TFOOT|TR)$/.test(el.tagName)) {
      return true;
    }
    const rects = el.getClientRects ? el.getClientRects() : [];
    return rects.length > 0;
  };
  const seen = new Set();
  const keyLines = [];
  const pushLine = (line) => {
    const normalized = String(line || '').replace(/\\s+/g, ' ').trim();
    if (!normalized || normalized.length < 2 || seen.has(normalized)) return;
    seen.add(normalized);
    keyLines.push(normalized);
  };

  const formulaSelector = [
    'math',
    '.katex',
    '.MathJax',
    'script[type^="math/tex"]',
    'annotation[encoding*="tex" i]',
    '[data-tex]',
    '[aria-label*="formula" i]',
    '[aria-label*="equation" i]',
  ].join(',');
  keyRoot.querySelectorAll(formulaSelector).forEach((el) => {
    if (!isVisibleForKeyInfo(el) && !(el.closest && isVisibleForKeyInfo(el.closest('.katex,.MathJax,math')))) {
      return;
    }
    const annotation = el.querySelector
      ? el.querySelector('annotation[encoding*="tex" i]')
      : null;
    const raw =
      el.getAttribute('data-tex') ||
      el.getAttribute('alttext') ||
      el.getAttribute('aria-label') ||
      (annotation ? annotation.textContent : '') ||
      el.textContent ||
      '';
    const formula = String(raw).replace(/\\s+/g, ' ').trim();
    if (formula) pushLine('Formula: ' + formula);
  });

  const blockSelector = [
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'p',
    'li',
    'blockquote',
    'pre',
    'code',
    'figcaption',
    'caption',
    'summary',
    'dt',
    'dd',
    'th',
    'td',
  ].join(',');
  keyRoot.querySelectorAll(blockSelector).forEach((el) => {
    if (!isVisibleForKeyInfo(el)) return;
    if (el.closest && el.closest(formulaSelector)) return;
    const text = textOf(el);
    if (!text) return;
    if (/^H[1-6]$/.test(el.tagName)) {
      pushLine('#'.repeat(Number(el.tagName.slice(1))) + ' ' + text);
      return;
    }
    if (el.tagName === 'LI') {
      pushLine('- ' + text);
      return;
    }
    pushLine(text);
  });

  return {
    url: location.href,
    title: doc.title || '',
    html: cloned.innerHTML,
    keyInfo: keyLines.join('\\n'),
    headings: headings,
    links: links,
    counts: counts,
  };
})`

const assertBrowserReadScope = (scope: string): BrowserReadScope => {
  if (scope === 'viewport' || scope === 'document' || scope === 'selection') {
    return scope
  }
  throw new BrowserReadFailure(
    'extraction_failed',
    `Invalid browser read scope: ${scope}`,
  )
}

const buildScript = (scope: BrowserReadScope): string =>
  `(${EXTRACTION_SCRIPT})(${JSON.stringify(assertBrowserReadScope(scope))})`

const withTimeout = <T>(
  promise: Promise<T>,
  timeoutMs: number,
  signal?: AbortSignal,
): Promise<T> => {
  return new Promise<T>((resolve, reject) => {
    let settled = false
    const onAbort = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(new Error('Aborted'))
    }
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      signal?.removeEventListener('abort', onAbort)
      reject(
        new BrowserReadFailure(
          'extraction_timeout',
          `Extraction timed out after ${timeoutMs}ms`,
        ),
      )
    }, timeoutMs)
    if (signal?.aborted) {
      onAbort()
      return
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    promise.then(
      (value) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        resolve(value)
      },
      (error: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        signal?.removeEventListener('abort', onAbort)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

const truncate = (
  text: string,
  maxChars: number,
  startChar: number,
): {
  value: string
  range: BrowserReadResult['range']
  truncated?: { totalChars: number; returnedChars: number }
} => {
  const totalChars = text.length
  const start = Math.max(0, Math.min(startChar, totalChars))
  const end = Math.min(start + maxChars, totalChars)
  const sliced = text.slice(start, end)
  const range = {
    startChar: start,
    endChar: end,
    totalChars,
    nextStartChar: end < totalChars ? end : undefined,
  }
  if (end >= totalChars && start === 0) return { value: sliced, range }
  return {
    value: sliced,
    range,
    truncated: { totalChars, returnedChars: sliced.length },
  }
}

const buildRedactions = (
  counts: RawExtractionResult['counts'],
): BrowserReadRedaction[] => {
  const out: BrowserReadRedaction[] = []
  if (counts.password > 0)
    out.push({ kind: 'password', count: counts.password })
  if (counts.hidden_input > 0)
    out.push({ kind: 'hidden_input', count: counts.hidden_input })
  if (counts.file_input > 0)
    out.push({ kind: 'file_input', count: counts.file_input })
  return out
}

/**
 * Read the active webview's rendered page contents. Always reads via
 * `executeJavaScript` against a Phase-1-supported leaf (caller is
 * responsible for resolving the handle first via
 * `findActiveWebviewHandle`).
 *
 * Throws `BrowserReadFailure` on timeout / extraction error. Returns null
 * only when the active view has no usable URL and no rendered content yet.
 */
export async function readActiveWebviewPage(
  handle: ActiveWebviewHandle,
  options: {
    scope: BrowserReadScope
    format: BrowserReadFormat
    maxChars: number
    startChar?: number
    signal?: AbortSignal
    executionTimeoutMs?: number
  },
): Promise<BrowserReadResult | null> {
  let raw: unknown
  try {
    raw = await withTimeout(
      handle.webview.executeJavaScript(buildScript(options.scope)),
      options.executionTimeoutMs ?? DEFAULT_EXTRACTION_TIMEOUT_MS,
      options.signal,
    )
  } catch (error) {
    if (error instanceof BrowserReadFailure) throw error
    throw new BrowserReadFailure(
      'extraction_failed',
      `Failed to extract page contents: ${
        error instanceof Error ? error.message : String(error)
      }`,
      error,
    )
  }

  if (!isRawExtractionResult(raw)) {
    throw new BrowserReadFailure(
      'extraction_failed',
      'Extraction script returned an unexpected payload',
    )
  }

  const hasRenderedContent =
    raw.html.trim().length > 0 ||
    raw.keyInfo.trim().length > 0 ||
    raw.headings.length > 0 ||
    raw.links.length > 0
  if ((!raw.url || raw.url === 'about:blank') && !hasRenderedContent) {
    return null
  }

  const maxChars = Math.max(
    1,
    Math.min(options.maxChars, MAX_BROWSER_READ_MAX_CHARS),
  )
  const startChar = Math.max(0, Math.floor(options.startChar ?? 0))

  const baseResult: BrowserReadResult = {
    source: handle.source,
    sourceViewType: handle.viewType,
    url: raw.url,
    title: raw.title,
    scope: options.scope,
    format: options.format,
    capturedAt: Date.now(),
    redactions: buildRedactions(raw.counts),
  }

  if (options.format === 'links_and_headings') {
    return {
      ...baseResult,
      headings: raw.headings,
      links: raw.links,
    }
  }

  if (options.format === 'key_visible_info') {
    const { value, range, truncated } = truncate(
      raw.keyInfo,
      maxChars,
      startChar,
    )
    return {
      ...baseResult,
      text: value,
      headings: raw.headings,
      links: raw.links,
      range,
      truncated,
    }
  }

  if (options.format === 'raw_html') {
    const { value, range, truncated } = truncate(raw.html, maxChars, startChar)
    return {
      ...baseResult,
      text: value,
      headings: raw.headings,
      links: raw.links,
      range,
      truncated,
    }
  }

  // 'readable' (default): markdownify then truncate
  const markdown = htmlToMarkdown(raw.html)
  const { value, range, truncated } = truncate(markdown, maxChars, startChar)
  return {
    ...baseResult,
    text: value,
    headings: raw.headings,
    links: raw.links,
    range,
    truncated,
  }
}
