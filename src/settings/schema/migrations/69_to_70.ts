import {
  getDefaultApprovalModeForTool,
  getDefaultDisclosureModeForTool,
} from '../../../core/agent/tool-preferences'
import { getLocalFileToolServerName } from '../../../core/mcp/localFileTools'
import { McpManager } from '../../../core/mcp/mcpManager'
import type { SettingMigration } from '../setting.types'

const BROWSER_READ_PAGE_TOOL_FQN = `${getLocalFileToolServerName()}${McpManager.TOOL_NAME_DELIMITER}browser_read_page`

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

/**
 * v69→v70: register default `browser_read_page` tool preferences on assistants.
 * Web page context is injected via per-agent focus sync, not a global setting.
 */
export const migrateFrom69To70: SettingMigration['migrate'] = (data) => {
  const next: Record<string, unknown> = { ...data, version: 70 }
  delete next.browser

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
