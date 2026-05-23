/**
 * Global settings for sending the user's active web page context with chat.
 * Lives next to AgentFocusSyncSection so note and web page context controls
 * are discoverable in the same capabilities block.
 */

import { useCallback } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ObsidianToggle } from '../../common/ObsidianToggle'

export function BrowserIntegrationSection() {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()

  const handleInjectToggle = useCallback(
    (value: boolean) => {
      void (async () => {
        try {
          await setSettings({
            ...settings,
            browser: {
              ...settings.browser,
              injectActivePageContext: value,
            },
          })
        } catch (error) {
          console.error('Failed to update browser inject toggle', error)
        }
      })()
    },
    [settings, setSettings],
  )

  const handleMaxCharsChange = useCallback(
    (raw: string) => {
      const parsed = Number.parseInt(raw, 10)
      if (!Number.isFinite(parsed) || parsed < 0) return
      const clamped = Math.min(parsed, 20000)
      if (clamped === settings.browser.injectSelectionMaxChars) return
      void (async () => {
        try {
          await setSettings({
            ...settings,
            browser: {
              ...settings.browser,
              injectSelectionMaxChars: clamped,
            },
          })
        } catch (error) {
          console.error(
            'Failed to update browser injectSelectionMaxChars',
            error,
          )
        }
      })()
    },
    [settings, setSettings],
  )

  const handleRetainToggle = useCallback(
    (value: boolean) => {
      void (async () => {
        try {
          await setSettings({
            ...settings,
            browser: {
              ...settings.browser,
              retainLastViewedPage: value,
            },
          })
        } catch (error) {
          console.error(
            'Failed to update browser retainLastViewedPage toggle',
            error,
          )
        }
      })()
    },
    [settings, setSettings],
  )

  return (
    <div className="yolo-agent-sub-card">
      <div className="yolo-agent-sub-card-head">
        {t('settings.browser.title', 'Web integration')}
      </div>

      <ObsidianSetting
        name={t('settings.browser.injectActiveTitle', 'Active page context')}
        desc={t(
          'settings.browser.injectActiveDesc',
          'When you send a message, include brief information about the current web page, such as its address, title, page length, scroll position, and any text selected on the page.',
        )}
      >
        <ObsidianToggle
          value={settings.browser.injectActivePageContext}
          onChange={handleInjectToggle}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.browser.selectionMaxTitle', 'Selected text limit')}
        desc={t(
          'settings.browser.selectionMaxDesc',
          'Maximum selected text to include from the page. Set to 0 to never include selected text.',
        )}
      >
        <ObsidianTextInput
          type="number"
          value={String(settings.browser.injectSelectionMaxChars)}
          onChange={handleMaxCharsChange}
          disabled={!settings.browser.injectActivePageContext}
        />
      </ObsidianSetting>

      {settings.browser.injectActivePageContext && (
        <ObsidianSetting
          name={t(
            'settings.browser.retainLastViewedTitle',
            'Keep recent page context',
          )}
          desc={t(
            'settings.browser.retainLastViewedDesc',
            'When the current tab is not a web page, still include brief context from the most recent open page.',
          )}
        >
          <ObsidianToggle
            value={settings.browser.retainLastViewedPage}
            onChange={handleRetainToggle}
          />
        </ObsidianSetting>
      )}

      <div className="yolo-settings-desc">
        {t(
          'settings.browser.fullPageToolHint',
          'To let the assistant read the full page content, enable the page reading tool for the agent.',
        )}
      </div>
    </div>
  )
}
