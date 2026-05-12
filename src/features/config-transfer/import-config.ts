import {
  SETTINGS_SCHEMA_VERSION,
  SETTING_MIGRATIONS,
} from '../../settings/schema/migrations'
import { YoloSettings } from '../../settings/schema/setting.types'
import { parseYoloSettings } from '../../settings/schema/settings'

import { EXCLUDED_KEYS } from './config-keys'
import { computeChecksum } from './export-config'
import { deepMerge } from './merge-utils'
import { ConfigExportFile, MergeStrategy } from './types'

export type ValidationResult =
  | { valid: true; data: ConfigExportFile }
  | { valid: false; error: string }

/**
 * 校验导出文件格式是否合法。
 */
export async function validateExportFile(
  raw: unknown,
): Promise<ValidationResult> {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: '文件内容不是有效的 JSON 对象' }
  }

  const obj = raw as Record<string, unknown>

  if (obj.$schema !== 'yolo-config-export') {
    return {
      valid: false,
      error:
        '该文件不是 YOLO 插件的配置导出文件，请选择通过「导出配置」功能生成的 .json 文件。',
    }
  }

  if (typeof obj.formatVersion !== 'number' || obj.formatVersion < 1) {
    return { valid: false, error: '配置文件格式版本不合法，可能已损坏。' }
  }

  if (typeof obj.settingsVersion !== 'number' || obj.settingsVersion < 0) {
    return { valid: false, error: '配置文件中的设置版本号不合法，可能已损坏。' }
  }

  if (!Array.isArray(obj.keys) || obj.keys.length === 0) {
    return { valid: false, error: '配置文件中没有包含任何配置项。' }
  }

  if (!obj.data || typeof obj.data !== 'object') {
    return { valid: false, error: '配置文件中的数据字段缺失或不合法。' }
  }

  // 校验 keys 与 data 的一致性
  const dataKeys = Object.keys(obj.data as Record<string, unknown>)
  const declaredKeys = new Set(obj.keys as string[])
  const undeclaredKeys = dataKeys.filter((k) => !declaredKeys.has(k))
  if (undeclaredKeys.length > 0) {
    return {
      valid: false,
      error: `配置文件数据与声明不一致：data 中包含未在 keys 中声明的字段（${undeclaredKeys.join(', ')}），文件可能已被篡改。`,
    }
  }

  // 校验 checksum 完整性
  if (typeof obj.checksum === 'string' && obj.checksum.length > 0) {
    const { checksum, ...payload } = obj
    const expectedChecksum = await computeChecksum(JSON.stringify(payload))
    if (checksum !== expectedChecksum) {
      return {
        valid: false,
        error: '配置文件完整性校验失败，文件内容可能已被修改。',
      }
    }
  }

  return { valid: true, data: obj as unknown as ConfigExportFile }
}

/**
 * 从另一个笔记库的 data.json 原始数据中提取可导入的配置。
 * 返回一个类似 ConfigExportFile 的结构，方便后续统一处理。
 */
export function parseVaultData(
  raw: unknown,
  pluginVersion?: string,
): ValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, error: '无法解析目标笔记库的配置数据' }
  }

  const obj = raw as Record<string, unknown>
  const settingsVersion = (obj.version as number) ?? 0

  // 提取所有非排除字段作为可导入数据
  const data: Record<string, unknown> = {}
  const keys: string[] = []
  for (const [key, value] of Object.entries(obj)) {
    if (!EXCLUDED_KEYS.has(key)) {
      data[key] = value
      keys.push(key)
    }
  }

  if (keys.length === 0) {
    return { valid: false, error: '目标笔记库的配置数据为空' }
  }

  const exportFile: ConfigExportFile = {
    $schema: 'yolo-config-export',
    formatVersion: 1,
    settingsVersion,
    exportedAt: new Date().toISOString(),
    pluginVersion: pluginVersion ?? 'unknown',
    redacted: false,
    keys,
    data,
    checksum: '',
  }

  return { valid: true, data: exportFile }
}

export type ImportOptions = {
  /** 导入的配置数据（已校验） */
  importData: ConfigExportFile
  /** 用户选择要导入的 key 列表 */
  selectedKeys: string[]
  /** 当前完整的 settings */
  currentSettings: YoloSettings
  /** 合并策略 */
  mergeStrategy: MergeStrategy
}

/**
 * 对导入数据执行迁移链（不做 schema parse 和默认值填充）。
 * 仅升级数据结构到当前版本。
 */
function migrateImportData(
  data: Record<string, unknown>,
  fromVersion: number,
): Record<string, unknown> {
  let currentData: Record<string, unknown> = { ...data, version: fromVersion }
  let currentVersion = fromVersion

  for (const migration of SETTING_MIGRATIONS) {
    if (
      currentVersion >= migration.fromVersion &&
      currentVersion < migration.toVersion &&
      migration.toVersion <= SETTINGS_SCHEMA_VERSION
    ) {
      currentData = migration.migrate(currentData)
      currentVersion = migration.toVersion
    }
  }

  return currentData
}

/**
 * 执行配置导入，返回合并后的完整 settings。
 *
 * 流程：
 * 1. 将导入数据通过迁移链升级到当前版本（不填充默认值）
 * 2. 根据合并策略将迁移后的数据合并到当前配置
 * 3. 通过 parseYoloSettings 进行 schema 校验和引用规范化
 */
export function applyImport(options: ImportOptions): YoloSettings {
  const { importData, selectedKeys, currentSettings, mergeStrategy } = options

  // 1. 迁移导入数据到当前版本（仅结构升级，不填充默认值）
  const migratedData = migrateImportData(
    importData.data,
    importData.settingsVersion,
  )

  // 2. 根据合并策略合并到当前配置
  const currentRaw = currentSettings as unknown as Record<string, unknown>
  const merged: Record<string, unknown> = { ...currentRaw }

  for (const key of selectedKeys) {
    if (EXCLUDED_KEYS.has(key)) continue

    const importedValue = migratedData[key]
    if (importedValue === undefined) continue

    if (mergeStrategy === 'overwrite') {
      merged[key] = importedValue
    } else {
      // JSON merge
      const currentValue = merged[key]
      if (
        typeof currentValue === 'object' &&
        currentValue !== null &&
        !Array.isArray(currentValue) &&
        typeof importedValue === 'object' &&
        importedValue !== null &&
        !Array.isArray(importedValue)
      ) {
        merged[key] = deepMerge(
          currentValue as Record<string, unknown>,
          importedValue as Record<string, unknown>,
        )
      } else {
        // 非对象类型（数组、基本类型）直接覆盖
        merged[key] = importedValue
      }
    }
  }

  // 3. 通过 parseYoloSettings 校验和规范化最终结果
  merged.version = SETTINGS_SCHEMA_VERSION
  return parseYoloSettings(merged)
}
