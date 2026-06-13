import type { SettingMigration } from '../setting.types'
import {
  getDefaultApprovalModeForTool,
  getDefaultDisclosureModeForTool,
} from '../../../core/agent/tool-preferences'
import { getLocalFileToolServerName } from '../../../core/mcp/localFileTools'
import { McpManager } from '../../../core/mcp/mcpManager'

const BROWSER_READ_PAGE_TOOL_FQN = `${getLocalFileToolServerName()}${McpManager.TOOL_NAME_DELIMITER}browser_read_page`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * v69→v70: introduce the `browser` settings group for browser integration
 * (passive `<browser_context>` injection + `browser_read_page` tool against
 * the user's active webview).
 */
export const migrateFrom69To70: SettingMigration['migrate'] = (data) => {
  const next: Record<string, unknown> = { ...data, version: 70 }
  const browser = isRecord(next.browser) ? { ...next.browser } : {}

  if (typeof browser.injectActivePageContext !== 'boolean') {
    browser.injectActivePageContext = false
  }
  if (
    typeof browser.injectSelectionMaxChars !== 'number' ||
    !Number.isFinite(browser.injectSelectionMaxChars) ||
    browser.injectSelectionMaxChars < 0
  ) {
    browser.injectSelectionMaxChars = 2000
  }
  if (typeof browser.retainLastViewedPage !== 'boolean') {
    browser.retainLastViewedPage = false
  }

  next.browser = browser

  if (Array.isArray(next.assistants)) {
    next.assistants = next.assistants.map((assistant: unknown) => {
      if (!isRecord(assistant)) return assistant

      const toolPreferences = isRecord(assistant.toolPreferences)
        ? { ...assistant.toolPreferences }
        : {}
      if (
        !Object.prototype.hasOwnProperty.call(
          toolPreferences,
          BROWSER_READ_PAGE_TOOL_FQN,
        )
      ) {
        toolPreferences[BROWSER_READ_PAGE_TOOL_FQN] = {
          enabled: true,
          approvalMode: getDefaultApprovalModeForTool(
            BROWSER_READ_PAGE_TOOL_FQN,
          ),
          disclosureMode: getDefaultDisclosureModeForTool(
            BROWSER_READ_PAGE_TOOL_FQN,
          ),
        }
      }

      return {
        ...assistant,
        toolPreferences,
      }
    })
  }

  return next
}
