/**
 * Render the passive `<browser_context>` injection (Phase 1).
 *
 * Mirrors how `<ide_selection>` / `<editor-snapshot>` work for vault notes:
 * when the user's active leaf is a supported webview (core Web Viewer or
 * .url WebView Opener) and they send a chat message, the model is told the
 * page's URL/title/loading state and (when present) the user's selection —
 * without the model having to call any browser_* tool.
 *
 * Body is constructed at render time so the URL/title/selection reflect the
 * webview's state at request build time, not at chat-input submit time.
 */

import {
  findActiveWebviewHandle,
  readActiveWebviewSnapshot,
} from '../../../core/browser/activeWebviewProbe'
import type { RequestMessage } from '../../../types/llm/request'

import type { BrowserContextInjection } from './types'

const escapeXml = (raw: string): string =>
  raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

export async function renderBrowserContextInjection(
  injection: BrowserContextInjection,
): Promise<RequestMessage | null> {
  const handle = findActiveWebviewHandle(injection.app)
  if (!handle) return null

  const snapshot = await readActiveWebviewSnapshot(handle, {
    maxSelectionChars: injection.maxSelectionChars,
  })
  if (!snapshot) return null

  const lines: string[] = ['<browser_context>', '  <active_page>']
  lines.push(`    <url>${escapeXml(snapshot.url)}</url>`)
  lines.push(`    <title>${escapeXml(snapshot.title)}</title>`)
  lines.push(`    <source>${snapshot.source}</source>`)
  lines.push(`    <loading>${snapshot.loading ? 'true' : 'false'}</loading>`)
  if (snapshot.meta) {
    lines.push(
      `    <visible_text_chars>${snapshot.meta.visibleTextChars}</visible_text_chars>`,
    )
    lines.push(
      `    <rendered_html_chars>${snapshot.meta.renderedHtmlChars}</rendered_html_chars>`,
    )
    lines.push(
      `    <document_height_px>${snapshot.meta.documentHeight}</document_height_px>`,
    )
    lines.push(
      `    <viewport_height_px>${snapshot.meta.viewportHeight}</viewport_height_px>`,
    )
    lines.push(`    <scroll_y_px>${snapshot.meta.scrollY}</scroll_y_px>`)
    lines.push(
      `    <selection_chars>${snapshot.meta.selectionChars}</selection_chars>`,
    )
  }
  lines.push('  </active_page>')
  if (snapshot.selection) {
    lines.push(`  <selection>${escapeXml(snapshot.selection)}</selection>`)
  }
  lines.push('</browser_context>')

  return {
    role: 'user',
    content: lines.join('\n'),
  }
}
