import {
  Assistant,
  AssistantToolApprovalMode,
  AssistantToolDisclosureMode,
  AssistantToolPreference,
} from '../../types/assistant.types'
import {
  LOAD_TOOL_SCHEMAS_LOCAL_TOOL_NAME,
  LOCAL_FS_SPLIT_ACTION_TOOL_NAMES,
  getLocalFileToolServerName,
} from '../mcp/localFileTools'
import { parseToolName } from '../mcp/tool-name-utils'

export const DEFAULT_ASSISTANT_TOOL_APPROVAL_MODE: AssistantToolApprovalMode =
  'require_approval'
export const DEFAULT_ASSISTANT_TOOL_DISCLOSURE_MODE: AssistantToolDisclosureMode =
  'always'

/**
 * 这些工具永远不允许"始终允许"（always-allow）模式。
 * UI 侧应隐藏这些工具的 allowForThisChat 按钮。
 */
export const ALWAYS_ALLOW_DISABLED_TOOL_NAMES: readonly string[] = [
  'delegate_external_agent',
]

/**
 * local tool 中需要 require_approval 的工具名集合。
 * delegate_external_agent 是高风险工具（执行外部 CLI），必须在此列表中。
 */
const REQUIRE_APPROVAL_LOCAL_TOOLS: ReadonlySet<string> = new Set([
  'fs_file_ops',
  ...LOCAL_FS_SPLIT_ACTION_TOOL_NAMES,
  'delegate_external_agent',
])

const FULL_ACCESS_LOCAL_TOOLS: ReadonlySet<string> = new Set([
  LOAD_TOOL_SCHEMAS_LOCAL_TOOL_NAME,
])

/**
 * Default disclosure mode for a tool when the user has not customized it.
 *
 * Built-in `yolo_local__*` tools default to `always`: they total ~3.9K tokens
 * across ~13 tools, stub-izing them saves little and only adds a first-use
 * latency hit. Third-party MCP server tools default to `on_demand` so large
 * MCP fleets don't bloat the cached `tools` prefix.
 *
 * `yolo_local__load_tool_schemas` itself is forced to `always` by `selectAllowedTools`
 * — without it the model has no way to disclose anything else — and the UI
 * locks its disclosure dropdown to match.
 */
export const getDefaultDisclosureModeForTool = (
  toolName: string,
): AssistantToolDisclosureMode => {
  try {
    const { serverName } = parseToolName(toolName)
    if (serverName === getLocalFileToolServerName()) {
      return 'always'
    }
    return 'on_demand'
  } catch {
    return DEFAULT_ASSISTANT_TOOL_DISCLOSURE_MODE
  }
}

export const getDefaultApprovalModeForTool = (
  toolName: string,
): AssistantToolApprovalMode => {
  try {
    const { serverName, toolName: parsedToolName } = parseToolName(toolName)
    if (serverName !== getLocalFileToolServerName()) {
      return 'require_approval'
    }

    if (FULL_ACCESS_LOCAL_TOOLS.has(parsedToolName)) {
      return 'full_access'
    }

    return REQUIRE_APPROVAL_LOCAL_TOOLS.has(parsedToolName)
      ? 'require_approval'
      : 'full_access'
  } catch {
    return DEFAULT_ASSISTANT_TOOL_APPROVAL_MODE
  }
}

export const buildAssistantToolPreferencesFromEnabledToolNames = (
  enabledToolNames?: string[],
): Record<string, AssistantToolPreference> => {
  if (!enabledToolNames || enabledToolNames.length === 0) {
    return {}
  }

  return enabledToolNames.reduce<Record<string, AssistantToolPreference>>(
    (acc, toolName) => {
      acc[toolName] = {
        enabled: true,
        approvalMode: getDefaultApprovalModeForTool(toolName),
        disclosureMode: getDefaultDisclosureModeForTool(toolName),
      }
      return acc
    },
    {},
  )
}

export const getAssistantToolPreferences = (
  assistant?: Pick<Assistant, 'toolPreferences' | 'enabledToolNames'> | null,
): Record<string, AssistantToolPreference> => {
  const fromEnabledToolNames =
    buildAssistantToolPreferencesFromEnabledToolNames(
      assistant?.enabledToolNames,
    )

  return {
    ...fromEnabledToolNames,
    ...(assistant?.toolPreferences ?? {}),
  }
}

export const getEnabledAssistantToolNames = (
  assistant?: Pick<Assistant, 'toolPreferences' | 'enabledToolNames'> | null,
): string[] => {
  const toolPreferences = getAssistantToolPreferences(assistant)
  const enabledToolNames = Object.entries(toolPreferences)
    .filter(([, preference]) => preference.enabled)
    .map(([toolName]) => toolName)

  if (enabledToolNames.length > 0 || assistant?.toolPreferences) {
    return enabledToolNames
  }

  return assistant?.enabledToolNames ?? []
}

export const isAssistantToolEnabled = (
  assistant:
    | Pick<Assistant, 'toolPreferences' | 'enabledToolNames'>
    | null
    | undefined,
  toolName: string,
): boolean => {
  const toolPreferences = getAssistantToolPreferences(assistant)

  if (toolName in toolPreferences) {
    return toolPreferences[toolName]?.enabled ?? false
  }

  return assistant?.enabledToolNames?.includes(toolName) ?? false
}

export const getAssistantToolApprovalMode = (
  assistant:
    | Pick<Assistant, 'toolPreferences' | 'enabledToolNames'>
    | null
    | undefined,
  toolName: string,
): AssistantToolApprovalMode => {
  const toolPreferences = getAssistantToolPreferences(assistant)
  return (
    toolPreferences[toolName]?.approvalMode ??
    DEFAULT_ASSISTANT_TOOL_APPROVAL_MODE
  )
}

export const getAssistantToolDisclosureMode = (
  assistant:
    | Pick<Assistant, 'toolPreferences' | 'enabledToolNames'>
    | null
    | undefined,
  toolName: string,
): AssistantToolDisclosureMode => {
  const toolPreferences = getAssistantToolPreferences(assistant)
  return (
    toolPreferences[toolName]?.disclosureMode ??
    getDefaultDisclosureModeForTool(toolName)
  )
}
