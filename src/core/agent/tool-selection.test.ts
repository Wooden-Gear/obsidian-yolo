import type { McpTool } from '../../types/mcp.types'

import { selectAllowedTools } from './tool-selection'

describe('selectAllowedTools', () => {
  it('filters out open_skill when no allowed skills are provided', () => {
    const availableTools: McpTool[] = [
      {
        name: 'yolo_local__open_skill',
        description: 'Open skill',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ]

    expect(
      selectAllowedTools({
        availableTools,
      }),
    ).toEqual({
      filteredTools: [],
      deferredTools: [],
      loadedDeferredTools: [],
      hasTools: false,
      hasMemoryTools: false,
      requestTools: undefined,
    })
  })

  it('keeps open_skill when skill allowlist is present', () => {
    const availableTools: McpTool[] = [
      {
        name: 'yolo_local__open_skill',
        description: 'Open skill',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
    ]

    const result = selectAllowedTools({
      availableTools,
      allowedSkillIds: ['skill-1'],
    })

    expect(result.filteredTools).toHaveLength(1)
    expect(result.deferredTools).toEqual([])
    expect(result.loadedDeferredTools).toEqual([])
    expect(result.hasTools).toBe(true)
    expect(result.hasMemoryTools).toBe(false)
    expect(result.requestTools).toEqual([
      {
        type: 'function',
        function: {
          name: 'yolo_local__open_skill',
          description: 'Open skill',
          parameters: {
            type: 'object',
            properties: {},
          },
        },
      },
    ])
  })

  it('keeps old preferences always-loaded by default', () => {
    const availableTools: McpTool[] = [
      {
        name: 'server__tool_a',
        description: 'Tool A',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const result = selectAllowedTools({
      availableTools,
      allowedToolNames: ['server__tool_a'],
      toolPreferences: {
        server__tool_a: { enabled: true, approvalMode: 'full_access' },
      },
    })

    expect(result.deferredTools).toEqual([])
    expect(result.requestTools?.map((tool) => tool.function.name)).toEqual([
      'server__tool_a',
    ])
  })

  it('defers on-demand tools until they are loaded', () => {
    const availableTools: McpTool[] = [
      {
        name: 'yolo_local__tool_search',
        description: 'Search tools',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'server__tool_a',
        description: 'Tool A',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const result = selectAllowedTools({
      availableTools,
      allowedToolNames: ['yolo_local__tool_search', 'server__tool_a'],
      toolPreferences: {
        yolo_local__tool_search: { enabled: true },
        server__tool_a: { enabled: true, disclosureMode: 'on_demand' },
      },
    })

    expect(result.deferredTools.map((tool) => tool.name)).toEqual([
      'server__tool_a',
    ])
    expect(result.requestTools?.map((tool) => tool.function.name)).toEqual([
      'yolo_local__tool_search',
    ])
  })

  it('includes loaded on-demand tools in request schemas', () => {
    const availableTools: McpTool[] = [
      {
        name: 'server__tool_a',
        description: 'Tool A',
        inputSchema: { type: 'object', properties: {} },
      },
    ]

    const result = selectAllowedTools({
      availableTools,
      allowedToolNames: ['server__tool_a'],
      toolPreferences: {
        server__tool_a: { enabled: true, disclosureMode: 'on_demand' },
      },
      loadedToolNames: new Set(['server__tool_a']),
    })

    expect(result.deferredTools).toEqual([])
    expect(result.loadedDeferredTools.map((tool) => tool.name)).toEqual([
      'server__tool_a',
    ])
    expect(result.requestTools?.map((tool) => tool.function.name)).toEqual([
      'server__tool_a',
    ])
  })
})
