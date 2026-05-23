import type { SettingMigration } from '../setting.types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * v60→v61: introduce the `browser` settings group for Phase 1 browser
 * integration (passive `<browser_context>` injection + `browser_read_page`
 * tool against the user's active webview).
 *
 * Defaults match the design doc:
 *   - injectActivePageContext: true (parity with focus-sync defaults)
 *   - injectSelectionMaxChars: 2000
 */
export const migrateFrom60To61: SettingMigration['migrate'] = (data) => {
  const next: Record<string, unknown> = { ...data, version: 61 }
  const browser = isRecord(next.browser) ? { ...next.browser } : {}
  if (typeof browser.injectActivePageContext !== 'boolean') {
    browser.injectActivePageContext = true
  }
  if (
    typeof browser.injectSelectionMaxChars !== 'number' ||
    !Number.isFinite(browser.injectSelectionMaxChars) ||
    browser.injectSelectionMaxChars < 0
  ) {
    browser.injectSelectionMaxChars = 2000
  }
  next.browser = browser
  return next
}
