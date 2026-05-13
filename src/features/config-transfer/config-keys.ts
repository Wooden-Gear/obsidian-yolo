import { ConfigKeyMeta } from './types'

/**
 * 可导入/导出的配置 key 列表及其元信息。
 * 按 data.json 第一层级 key 划分。
 * 显示用文案优先通过 i18n key `configTransfer.keyLabels.<key>` 查找，
 * 缺失时回退到 `fallbackLabel`（避免 Italian 等未翻译语种直接显示 raw key）。
 *
 * `sensitive` 表示该 key 包含凭证（apiKey / password / headers / env / customHeaders.value），
 * UI 会提示用户，脱敏导出/导入清空也按此覆盖。
 */
export const EXPORTABLE_CONFIG_KEYS: ConfigKeyMeta[] = [
  { key: 'providers', fallbackLabel: 'AI 服务商', sensitive: true },
  { key: 'chatModels', fallbackLabel: '对话模型' },
  { key: 'embeddingModels', fallbackLabel: '嵌入模型' },
  { key: 'chatModelId', fallbackLabel: '默认对话模型' },
  { key: 'chatTitleModelId', fallbackLabel: '标题生成模型' },
  { key: 'embeddingModelId', fallbackLabel: '默认嵌入模型' },
  { key: 'systemPrompt', fallbackLabel: '系统提示词' },
  { key: 'ragOptions', fallbackLabel: '知识库设置' },
  { key: 'mcp', fallbackLabel: 'MCP 工具', sensitive: true },
  { key: 'webSearch', fallbackLabel: '联网搜索', sensitive: true },
  { key: 'skills', fallbackLabel: '技能设置' },
  { key: 'yolo', fallbackLabel: '基础设置' },
  { key: 'debug', fallbackLabel: '调试设置' },
  { key: 'chatOptions', fallbackLabel: '对话偏好' },
  { key: 'notificationOptions', fallbackLabel: '通知设置' },
  { key: 'continuationOptions', fallbackLabel: '续写与补全' },
  { key: 'assistants', fallbackLabel: 'Agent 配置' },
  { key: 'currentAssistantId', fallbackLabel: '当前 Agent' },
  { key: 'quickAskAssistantId', fallbackLabel: 'Quick Ask Agent' },
]

/**
 * 不参与导入导出的内部字段
 */
export const EXCLUDED_KEYS = new Set(['version', '__meta'])
