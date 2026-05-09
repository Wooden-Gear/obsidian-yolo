import { base64ToUint8Array } from '../base64'
import { createYieldController } from '../common/yield-to-main'

import { loadPdfPages } from './pdfPages'

/** Hard cap when extracting text from a chat-uploaded PDF as a non-native fallback. */
const FALLBACK_MAX_PAGES = 500

export type EnsurePdfTextInput = {
  /** Original PDF bytes as base64 (canonical source). */
  rawData?: string
  /** Optional pre-computed text (e.g., legacy mentionable). */
  extractedText?: string
}

export type EnsurePdfTextResult = {
  text: string
  /** Whether the document had to be truncated to the page cap. */
  truncated: boolean
  /** Total page count detected, when available. */
  pageCount?: number
}

/**
 * Resolve plain text for a PDF mentionable. Prefers a pre-computed extraction
 * (legacy data) and only falls back to pdfjs when raw bytes are present.
 *
 * No process-lifetime cache: this path only fires for non-pdf-capable models,
 * which are the rarer case after the modality system landed. Re-running pdfjs
 * per turn (1–2s on a multi-MB PDF) is cheaper and more predictable than
 * hashing tens of MB of base64 every call to key a cache, and avoids the
 * collision risk of any length-plus-prefix shortcut.
 */
export async function ensurePdfText(
  input: EnsurePdfTextInput,
): Promise<EnsurePdfTextResult> {
  if (input.extractedText !== undefined) {
    return { text: input.extractedText, truncated: false }
  }

  if (!input.rawData) {
    return { text: '', truncated: false }
  }

  const bytes = base64ToUint8Array(input.rawData)
  const maybeYield = createYieldController(1)
  const { totalPages, pages } = await loadPdfPages(bytes, {
    maxPages: FALLBACK_MAX_PAGES,
    maybeYield,
  })

  const text = pages
    .map(({ page, text }) => `--- Page ${page} ---\n${text}`)
    .join('\n\n')

  return {
    text,
    truncated: totalPages > FALLBACK_MAX_PAGES,
    pageCount: totalPages,
  }
}
