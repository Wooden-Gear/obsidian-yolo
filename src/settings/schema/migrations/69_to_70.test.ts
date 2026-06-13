import { migrateFrom69To70 } from './69_to_70'

describe('migrateFrom69To70', () => {
  it('bumps version and removes legacy browser settings', () => {
    const result = migrateFrom69To70({
      version: 69,
      browser: {
        injectActivePageContext: true,
        retainLastViewedPage: true,
        injectSelectionMaxChars: 500,
      },
    })

    expect(result.version).toBe(70)
    expect(result.browser).toBeUndefined()
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

  it('preserves existing browser read page tool preferences', () => {
    const result = migrateFrom69To70({
      version: 69,
      assistants: [
        {
          id: 'agent-1',
          toolPreferences: {
            yolo_local__browser_read_page: {
              enabled: false,
              approvalMode: 'full_access',
              disclosureMode: 'on_demand',
            },
          },
        },
      ],
    })

    const assistants = result.assistants as Array<Record<string, unknown>>
    const preferences = assistants[0].toolPreferences as Record<
      string,
      Record<string, unknown>
    >
    expect(preferences['yolo_local__browser_read_page']).toEqual({
      enabled: false,
      approvalMode: 'full_access',
      disclosureMode: 'on_demand',
    })
  })
})
