import { SETTINGS_SCHEMA_VERSION } from '../../settings/schema/migrations'

import { EXCLUDED_KEYS } from './config-keys'
import { CONFIG_EXPORT_FORMAT_VERSION, ConfigExportFile } from './types'

/**
 * 生成与原始 API Key 等长的随机字符串，用于脱敏导出。
 */
function generateRandomString(length: number): string {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

/**
 * 计算字符串的 SHA-256 哈希（hex 格式）。
 */
export async function computeChecksum(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * 递归遍历对象，将所有名为 apiKey 的字段替换为等长随机字符串。
 */
export function redactApiKeys(data: unknown): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => redactApiKeys(item))
  }

  if (typeof data === 'object' && data !== null) {
    const result: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(
      data as Record<string, unknown>,
    )) {
      if (key === 'apiKey' && typeof value === 'string') {
        result[key] = value.length > 0 ? generateRandomString(value.length) : ''
      } else {
        result[key] = redactApiKeys(value)
      }
    }
    return result
  }

  return data
}

export type ExportOptions = {
  /** 要导出的 key 列表 */
  keys: string[]
  /** 当前完整的 settings 数据（原始 data.json 内容） */
  settingsData: Record<string, unknown>
  /** 插件版本号 */
  pluginVersion: string
  /** 是否脱敏导出 */
  redacted?: boolean
}

/**
 * 根据用户选择的 key 列表，从 settings 中提取数据并生成导出文件内容。
 */
export async function buildExportData(
  options: ExportOptions,
): Promise<ConfigExportFile> {
  const { keys, settingsData, pluginVersion, redacted = false } = options

  // 提取选中的 key 对应的数据
  const data: Record<string, unknown> = {}
  for (const key of keys) {
    if (EXCLUDED_KEYS.has(key)) continue
    if (key in settingsData) {
      data[key] = settingsData[key]
    }
  }

  // 脱敏处理
  const finalData = redacted
    ? (redactApiKeys(data) as Record<string, unknown>)
    : data

  // 构建不含 checksum 的对象
  const payload = {
    $schema: 'yolo-config-export' as const,
    formatVersion: CONFIG_EXPORT_FORMAT_VERSION,
    settingsVersion: SETTINGS_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    pluginVersion,
    redacted,
    keys,
    data: finalData,
  }

  // 对完整 payload 计算 SHA-256 作为 checksum
  const checksum = await computeChecksum(JSON.stringify(payload))

  return {
    ...payload,
    checksum,
  }
}
