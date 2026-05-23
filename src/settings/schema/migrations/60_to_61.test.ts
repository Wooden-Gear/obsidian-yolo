import { migrateFrom60To61 } from './60_to_61'

describe('migrateFrom60To61', () => {
  it('creates the browser block with defaults when absent', () => {
    const result = migrateFrom60To61({ version: 60 })

    expect(result.version).toBe(61)
    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(true)
    expect(browser.injectSelectionMaxChars).toBe(2000)
  })

  it('preserves existing browser values', () => {
    const result = migrateFrom60To61({
      version: 60,
      browser: {
        injectActivePageContext: false,
        injectSelectionMaxChars: 500,
      },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(false)
    expect(browser.injectSelectionMaxChars).toBe(500)
  })

  it('repairs bogus injectSelectionMaxChars values', () => {
    const result = migrateFrom60To61({
      version: 60,
      browser: { injectSelectionMaxChars: -5 },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectSelectionMaxChars).toBe(2000)
  })

  it('repairs non-numeric injectSelectionMaxChars', () => {
    const result = migrateFrom60To61({
      version: 60,
      browser: { injectSelectionMaxChars: 'lots' },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectSelectionMaxChars).toBe(2000)
  })

  it('repairs non-boolean injectActivePageContext', () => {
    const result = migrateFrom60To61({
      version: 60,
      browser: { injectActivePageContext: 'yes' },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(true)
  })

  it('replaces a non-object browser field with defaults', () => {
    const result = migrateFrom60To61({
      version: 60,
      browser: 'not-an-object',
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(true)
    expect(browser.injectSelectionMaxChars).toBe(2000)
  })
})
