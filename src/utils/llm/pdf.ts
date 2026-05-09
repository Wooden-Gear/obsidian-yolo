import { MentionablePDF } from '../../types/mentionable'
import { uint8ArrayToBase64 } from '../base64'
import { createYieldController } from '../common/yield-to-main'
import { getPdfPageCount } from '../pdf/pdfPages'

/**
 * Hard cap for uploaded PDF size at the chat input. Anthropic's native-PDF
 * document block caps the *whole request payload* at 32 MB, and inline base64
 * inflates raw bytes by ~33%. Capping raw uploads at 24 MB keeps the encoded
 * payload comfortably under that ceiling so a Claude request that passed
 * upload won't fail at the API layer.
 */
export const PDF_UPLOAD_MAX_BYTES = 24 * 1024 * 1024

export async function fileToMentionablePDF(
  file: File,
  options: { maxBinaryBytes?: number } = {},
): Promise<MentionablePDF> {
  const maxBinaryBytes = options.maxBinaryBytes ?? PDF_UPLOAD_MAX_BYTES

  if (file.size > maxBinaryBytes) {
    throw new Error(
      `PDF too large (${file.size} bytes). Limit is ${maxBinaryBytes} bytes.`,
    )
  }

  const buf = await file.arrayBuffer()
  const bytes = new Uint8Array(buf)
  const maybeYield = createYieldController(1)

  // Inspect the document for pageCount metadata without running the heavier
  // text-extraction pipeline. Native-PDF adapters forward the raw bytes
  // directly; the text fallback (and any per-extraction truncation) happens
  // lazily downstream in `ensurePdfText`. Per-page or per-token caps belong
  // to the destination provider, not the upload site.
  const pageCount = await getPdfPageCount(bytes, { maybeYield })

  return {
    type: 'pdf',
    name: file.name,
    rawData: uint8ArrayToBase64(bytes),
    pageCount,
  }
}
