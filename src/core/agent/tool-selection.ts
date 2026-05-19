import type { AssistantToolPreference } from '../../types/assistant.types'
import type { RequestTool } from '../../types/llm/request'
import type { McpTool } from '../../types/mcp.types'
import {
  LOCAL_FS_SPLIT_ACTION_TOOL_NAMES,
  LOCAL_MEMORY_SPLIT_ACTION_TOOL_NAMES,
  TOOL_SEARCH_LOCAL_TOOL_NAME,
  getLocalFileToolServerName,
} from '../mcp/localFileTools'
import { McpManager } from '../mcp/mcpManager'
import { parseToolName } from '../mcp/tool-name-utils'

import {
  DEFAULT_ASSISTANT_TOOL_APPROVAL_MODE,
  getAssistantToolApprovalMode,
  getAssistantToolDisclosureMode,
} from './tool-preferences'

const LOCAL_MEMORY_TOOL_NAMES = new Set([
  'memory_ops',
  'memory_add',
  'memory_update',
  'memory_delete',
])

const isOpenSkillToolName = (toolName: string): boolean => {
  try {
    const parsed = parseToolName(toolName)
    return (
      parsed.serverName === getLocalFileToolServerName() &&
      parsed.toolName === 'open_skill'
    )
  } catch {
    return toolName === 'open_skill'
  }
}

export const isToolSearchToolName = (toolName: string): boolean => {
  try {
    const parsed = parseToolName(toolName)
    return (
      parsed.serverName === getLocalFileToolServerName() &&
      parsed.toolName === TOOL_SEARCH_LOCAL_TOOL_NAME
    )
  } catch {
    return toolName === TOOL_SEARCH_LOCAL_TOOL_NAME
  }
}

export const expandAllowedToolNames = (
  toolNames?: string[],
): Set<string> | undefined => {
  if (!toolNames) {
    return undefined
  }

  const expanded = new Set<string>(toolNames)
  const localServer = getLocalFileToolServerName()
  const localFileOpsTool = `${localServer}${McpManager.TOOL_NAME_DELIMITER}fs_file_ops`
  const localMemoryOpsTool = `${localServer}${McpManager.TOOL_NAME_DELIMITER}memory_ops`
  const hasFileOpsGroup =
    expanded.has(localFileOpsTool) || expanded.has('fs_file_ops')
  const hasMemoryOpsGroup =
    expanded.has(localMemoryOpsTool) || expanded.has('memory_ops')

  if (hasFileOpsGroup) {
    for (const splitToolName of LOCAL_FS_SPLIT_ACTION_TOOL_NAMES) {
      expanded.add(
        `${localServer}${McpManager.TOOL_NAME_DELIMITER}${splitToolName}`,
      )
      expanded.add(splitToolName)
    }
  }

  if (hasMemoryOpsGroup) {
    for (const splitToolName of LOCAL_MEMORY_SPLIT_ACTION_TOOL_NAMES) {
      expanded.add(
        `${localServer}${McpManager.TOOL_NAME_DELIMITER}${splitToolName}`,
      )
      expanded.add(splitToolName)
    }
  }

  return expanded
}

export const isMemoryToolAvailable = (toolName: string): boolean => {
  try {
    const parsed = parseToolName(toolName)
    return (
      parsed.serverName === getLocalFileToolServerName() &&
      LOCAL_MEMORY_TOOL_NAMES.has(parsed.toolName)
    )
  } catch {
    return LOCAL_MEMORY_TOOL_NAMES.has(toolName)
  }
}

const isToolAllowed = ({
  toolName,
  allowedToolNames,
  allowedSkillIds,
  allowedSkillNames,
}: {
  toolName: string
  allowedToolNames?: ReadonlySet<string>
  allowedSkillIds?: ReadonlySet<string>
  allowedSkillNames?: ReadonlySet<string>
}): boolean => {
  if (isOpenSkillToolName(toolName)) {
    const hasAllowedSkills =
      (allowedSkillIds?.size ?? 0) > 0 || (allowedSkillNames?.size ?? 0) > 0
    if (!hasAllowedSkills) {
      return false
    }
  }

  if (!allowedToolNames) {
    return true
  }

  return allowedToolNames.has(toolName)
}

export const buildRequestTools = (
  toolDefinitions: McpTool[],
): RequestTool[] | undefined => {
  if (toolDefinitions.length === 0) {
    return undefined
  }

  return toolDefinitions.map((tool) => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: {
        ...tool.inputSchema,
        properties: tool.inputSchema.properties ?? {},
      },
    },
  }))
}

export const selectAllowedTools = ({
  availableTools,
  allowedToolNames,
  allowedSkillIds,
  allowedSkillNames,
  toolPreferences,
  loadedToolNames,
}: {
  availableTools: McpTool[]
  allowedToolNames?: string[]
  allowedSkillIds?: string[]
  allowedSkillNames?: string[]
  toolPreferences?: Record<string, AssistantToolPreference>
  loadedToolNames?: ReadonlySet<string>
}): {
  filteredTools: McpTool[]
  deferredTools: McpTool[]
  loadedDeferredTools: McpTool[]
  hasTools: boolean
  hasMemoryTools: boolean
  requestTools: RequestTool[] | undefined
} => {
  const normalizedAllowedToolNames = expandAllowedToolNames(allowedToolNames)
  const normalizedAllowedSkillIds = allowedSkillIds
    ? new Set(allowedSkillIds.map((id) => id.toLowerCase()))
    : undefined
  const normalizedAllowedSkillNames = allowedSkillNames
    ? new Set(allowedSkillNames.map((name) => name.toLowerCase()))
    : undefined

  const filteredTools = availableTools.filter((tool) =>
    isToolAllowed({
      toolName: tool.name,
      allowedToolNames: normalizedAllowedToolNames,
      allowedSkillIds: normalizedAllowedSkillIds,
      allowedSkillNames: normalizedAllowedSkillNames,
    }),
  )
  const assistantLike = {
    toolPreferences,
    enabledToolNames: normalizedAllowedToolNames
      ? [...normalizedAllowedToolNames]
      : undefined,
  }
  const requestToolDefinitions: McpTool[] = []
  const deferredTools: McpTool[] = []
  const loadedDeferredTools: McpTool[] = []

  for (const tool of filteredTools) {
    const disclosureMode = isToolSearchToolName(tool.name)
      ? 'always'
      : getAssistantToolDisclosureMode(assistantLike, tool.name)
    const isLoaded = loadedToolNames?.has(tool.name) ?? false
    if (disclosureMode === 'on_demand' && !isLoaded) {
      deferredTools.push(tool)
      continue
    }
    requestToolDefinitions.push(tool)
    if (disclosureMode === 'on_demand' && isLoaded) {
      loadedDeferredTools.push(tool)
    }
  }

  return {
    filteredTools,
    deferredTools,
    loadedDeferredTools,
    hasTools: filteredTools.length > 0,
    hasMemoryTools: filteredTools.some((tool) =>
      isMemoryToolAvailable(tool.name),
    ),
    requestTools: buildRequestTools(requestToolDefinitions),
  }
}

export const getToolApprovalModeForCatalog = (
  toolPreferences: Record<string, AssistantToolPreference> | undefined,
  toolName: string,
): 'full_access' | 'require_approval' => {
  return (
    getAssistantToolApprovalMode({ toolPreferences }, toolName) ??
    DEFAULT_ASSISTANT_TOOL_APPROVAL_MODE
  )
}
