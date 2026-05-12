import { ConfigKeyMeta } from './types'

/**
 * 可导入/导出的配置 key 列表及其元信息。
 * 按 data.json 第一层级 key 划分。
 */
export const EXPORTABLE_CONFIG_KEYS: ConfigKeyMeta[] = [
  { key: 'providers', label: 'AI 服务商', sensitive: true },
  { key: 'chatModels', label: '对话模型' },
  { key: 'embeddingModels', label: '嵌入模型' },
  { key: 'chatModelId', label: '默认对话模型' },
  { key: 'chatTitleModelId', label: '标题生成模型' },
  { key: 'embeddingModelId', label: '默认嵌入模型' },
  { key: 'systemPrompt', label: '系统提示词' },
  { key: 'ragOptions', label: '知识库设置' },
  { key: 'mcp', label: 'MCP 工具' },
  { key: 'webSearch', label: '联网搜索', sensitive: true },
  { key: 'skills', label: '技能设置' },
  { key: 'yolo', label: '基础设置' },
  { key: 'debug', label: '调试设置' },
  { key: 'chatOptions', label: '对话偏好' },
  { key: 'notificationOptions', label: '通知设置' },
  { key: 'continuationOptions', label: '续写与补全' },
  { key: 'assistants', label: 'Agent 配置' },
  { key: 'currentAssistantId', label: '当前 Agent' },
  { key: 'quickAskAssistantId', label: 'Quick Ask Agent' },
]

/**
 * 不参与导入导出的内部字段
 */
export const EXCLUDED_KEYS = new Set(['version', '__meta'])
