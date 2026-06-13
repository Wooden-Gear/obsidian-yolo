import { migrateFrom69To70 } from './69_to_70'

describe('migrateFrom69To70', () => {
  it('creates the browser block with defaults when absent', () => {
    const result = migrateFrom69To70({ version: 69 })

    expect(result.version).toBe(70)
    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(false)
    expect(browser.injectSelectionMaxChars).toBe(2000)
    expect(browser.retainLastViewedPage).toBe(false)
  })

  it('preserves existing browser values', () => {
    const result = migrateFrom69To70({
      version: 69,
      browser: {
        injectActivePageContext: false,
        injectSelectionMaxChars: 500,
        retainLastViewedPage: true,
      },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(false)
    expect(browser.injectSelectionMaxChars).toBe(500)
    expect(browser.retainLastViewedPage).toBe(true)
  })

  it('repairs bogus injectSelectionMaxChars values', () => {
    const result = migrateFrom69To70({
      version: 69,
      browser: { injectSelectionMaxChars: -5 },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectSelectionMaxChars).toBe(2000)
  })

  it('repairs non-numeric injectSelectionMaxChars', () => {
    const result = migrateFrom69To70({
      version: 69,
      browser: { injectSelectionMaxChars: 'lots' },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectSelectionMaxChars).toBe(2000)
  })

  it('repairs non-boolean injectActivePageContext', () => {
    const result = migrateFrom69To70({
      version: 69,
      browser: { injectActivePageContext: 'yes' },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(false)
  })

  it('replaces a non-object browser field with defaults', () => {
    const result = migrateFrom69To70({
      version: 69,
      browser: 'not-an-object',
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.injectActivePageContext).toBe(false)
    expect(browser.injectSelectionMaxChars).toBe(2000)
    expect(browser.retainLastViewedPage).toBe(false)
  })

  it('repairs non-boolean retainLastViewedPage', () => {
    const result = migrateFrom69To70({
      version: 69,
      browser: { retainLastViewedPage: 'remember' },
    })

    const browser = result.browser as Record<string, unknown>
    expect(browser.retainLastViewedPage).toBe(false)
  })

  it('adds the browser read page tool preference to existing assistants', () => {
    const result = migrateFrom69To70({
      version: 69,
      assistants: [
        {
          id: 'agent-1',
          toolPreferences: {},
        },
      ],
    })

    const assistants = result.assistants as Array<Record<string, unknown>>
    const preferences = assistants[0].toolPreferences as Record<
      string,
      Record<string, unknown>
    >
    expect(preferences['yolo_local__browser_read_page']).toEqual({
      enabled: true,
      approvalMode: 'require_approval',
      disclosureMode: 'always',
    })
  })
})
