import { SETTINGS_SCHEMA_VERSION } from '../../settings/schema/migrations'
import { parseYoloSettings } from '../../settings/schema/settings'

import { buildExportData, computeChecksum } from './export-config'
import {
  applyImport,
  parseVaultData,
  validateExportFile,
} from './import-config'
import { CONFIG_EXPORT_FORMAT_VERSION, ConfigExportFile } from './types'

describe('validateExportFile', () => {
  // 不含 checksum 的基础文件（跳过 checksum 校验）
  const validFile = {
    $schema: 'yolo-config-export',
    formatVersion: CONFIG_EXPORT_FORMAT_VERSION,
    settingsVersion: SETTINGS_SCHEMA_VERSION,
    exportedAt: '2026-05-11T10:00:00.000Z',
    pluginVersion: '1.5.7.5',
    redacted: false,
    keys: ['providers', 'chatModelId'],
    data: {
      providers: [],
      chatModelId: 'test/model',
    },
  }

  it('should accept a valid export file without checksum', async () => {
    const result = await validateExportFile(validFile)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.$schema).toBe('yolo-config-export')
    }
  })

  it('should accept a valid export file with correct checksum', async () => {
    const { checksum, ...payload } = validFile as Record<string, unknown>
    void checksum
    const correctChecksum = await computeChecksum(JSON.stringify(payload))
    const fileWithChecksum = { ...validFile, checksum: correctChecksum }
    const result = await validateExportFile(fileWithChecksum)
    expect(result.valid).toBe(true)
  })

  it('should reject a file with incorrect checksum (tampered content)', async () => {
    const fileWithBadChecksum = {
      ...validFile,
      checksum:
        'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    }
    const result = await validateExportFile(fileWithBadChecksum)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('完整性校验失败')
    }
  })

  it('should reject null input', async () => {
    const result = await validateExportFile(null)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('JSON 对象')
    }
  })

  it('should reject non-object input', async () => {
    const result = await validateExportFile('not an object')
    expect(result.valid).toBe(false)
  })

  it('should reject missing $schema', async () => {
    const result = await validateExportFile({
      ...validFile,
      $schema: undefined,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('不是 YOLO 插件的配置导出文件')
    }
  })

  it('should reject wrong $schema value', async () => {
    const result = await validateExportFile({ ...validFile, $schema: 'wrong' })
    expect(result.valid).toBe(false)
  })

  it('should reject invalid formatVersion', async () => {
    const result = await validateExportFile({ ...validFile, formatVersion: 0 })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('格式版本')
    }
  })

  it('should reject invalid settingsVersion', async () => {
    const result = await validateExportFile({
      ...validFile,
      settingsVersion: -1,
    })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('设置版本号')
    }
  })

  it('should reject empty keys array', async () => {
    const result = await validateExportFile({ ...validFile, keys: [] })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('没有包含任何配置项')
    }
  })

  it('should reject missing data field', async () => {
    const result = await validateExportFile({ ...validFile, data: undefined })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('数据字段')
    }
  })

  it('should reject when data contains keys not declared in keys array', async () => {
    const tampered = {
      ...validFile,
      keys: ['providers'],
      data: {
        providers: [],
        systemPrompt: 'injected',
      },
    }
    const result = await validateExportFile(tampered)
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('篡改')
      expect(result.error).toContain('systemPrompt')
    }
  })

  it('should accept when keys is a superset of data keys (some keys have no data)', async () => {
    const sparse = {
      ...validFile,
      keys: ['providers', 'chatModelId', 'ragOptions'],
      data: {
        providers: [],
        chatModelId: 'test/model',
      },
    }
    const result = await validateExportFile(sparse)
    expect(result.valid).toBe(true)
  })

  it('should accept a file with higher formatVersion (forward compatible)', async () => {
    const futureFile = {
      ...validFile,
      formatVersion: 99,
    }
    const result = await validateExportFile(futureFile)
    expect(result.valid).toBe(true)
  })

  it('should validate checksum end-to-end with buildExportData', async () => {
    const exported = await buildExportData({
      keys: ['providers', 'chatModelId'],
      settingsData: {
        providers: [{ id: 'test', apiKey: 'key' }],
        chatModelId: 'test/model',
      },
      pluginVersion: '1.5.7.5',
    })

    // 正常导出的文件应该通过校验
    const result = await validateExportFile(exported)
    expect(result.valid).toBe(true)

    // 篡改后应该失败
    const tampered = { ...exported, redacted: true }
    const tamperedResult = await validateExportFile(tampered)
    expect(tamperedResult.valid).toBe(false)
    if (!tamperedResult.valid) {
      expect(tamperedResult.error).toContain('完整性校验失败')
    }
  })
})

describe('parseVaultData', () => {
  it('should parse valid vault data.json content', () => {
    const vaultData = {
      version: 45,
      __meta: { deviceId: 'other-device' },
      providers: [{ id: 'openai', apiKey: 'sk-xxx' }],
      chatModels: [
        { id: 'openai/gpt-4', model: 'gpt-4', providerId: 'openai' },
      ],
      chatModelId: 'openai/gpt-4',
    }

    const result = parseVaultData(vaultData, '1.5.0')
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.settingsVersion).toBe(45)
      expect(result.data.keys).toContain('providers')
      expect(result.data.keys).toContain('chatModels')
      expect(result.data.keys).toContain('chatModelId')
      expect(result.data.keys).not.toContain('version')
      expect(result.data.keys).not.toContain('__meta')
      expect(result.data.data).not.toHaveProperty('version')
      expect(result.data.data).not.toHaveProperty('__meta')
    }
  })

  it('should reject null input', () => {
    const result = parseVaultData(null)
    expect(result.valid).toBe(false)
  })

  it('should reject empty object (no exportable keys)', () => {
    const result = parseVaultData({ version: 51, __meta: {} })
    expect(result.valid).toBe(false)
    if (!result.valid) {
      expect(result.error).toContain('为空')
    }
  })

  it('should default settingsVersion to 0 if version field is missing', () => {
    const result = parseVaultData({ providers: [] })
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.settingsVersion).toBe(0)
    }
  })

  it('should include unknown keys from vault data (future settings fields)', () => {
    const vaultData = {
      version: 51,
      providers: [],
      futureFeature: { enabled: true },
    }
    const result = parseVaultData(vaultData)
    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.data.keys).toContain('futureFeature')
      expect(result.data.data).toHaveProperty('futureFeature')
    }
  })
})

describe('applyImport', () => {
  const currentSettings = parseYoloSettings({
    version: SETTINGS_SCHEMA_VERSION,
    providers: [
      { id: 'existing', presetType: 'openai', apiKey: 'existing-key' },
    ],
    chatModels: [
      {
        providerId: 'existing',
        id: 'existing/gpt-4',
        model: 'gpt-4',
        enable: true,
      },
    ],
    chatModelId: 'existing/gpt-4',
    ragOptions: {
      enabled: true,
      chunkSize: 1000,
      limit: 10,
      excludePatterns: ['*.tmp'],
    },
  })

  const makeImportData = (
    overrides: Partial<ConfigExportFile>,
  ): ConfigExportFile => ({
    $schema: 'yolo-config-export',
    formatVersion: 1,
    settingsVersion: SETTINGS_SCHEMA_VERSION,
    exportedAt: '2026-05-11T10:00:00.000Z',
    pluginVersion: '1.5.7.5',
    redacted: false,
    checksum: '',
    keys: [],
    data: {},
    ...overrides,
  })

  it('should overwrite selected keys in overwrite mode', () => {
    const importData = makeImportData({
      keys: ['ragOptions'],
      data: { ragOptions: { enabled: false, chunkSize: 500, limit: 5 } },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['ragOptions'],
      currentSettings,
      mergeStrategy: 'overwrite',
    })

    expect(result.ragOptions.enabled).toBe(false)
    expect(result.ragOptions.chunkSize).toBe(500)
    expect(result.ragOptions.limit).toBe(5)
    expect(result.providers).toEqual(currentSettings.providers)
  })

  it('should deep merge in merge mode, preserving current-only fields', () => {
    const importData = makeImportData({
      keys: ['ragOptions'],
      data: { ragOptions: { chunkSize: 800, limit: 20 } },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['ragOptions'],
      currentSettings,
      mergeStrategy: 'merge',
    })

    expect(result.ragOptions.chunkSize).toBe(800)
    expect(result.ragOptions.limit).toBe(20)
    expect(result.ragOptions.enabled).toBe(true)
    expect(result.ragOptions.excludePatterns).toEqual(['*.tmp'])
  })

  it('should only import selected keys, ignoring unselected ones', () => {
    const importData = makeImportData({
      keys: ['ragOptions', 'systemPrompt'],
      data: { ragOptions: { chunkSize: 500 }, systemPrompt: 'imported prompt' },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['systemPrompt'],
      currentSettings,
      mergeStrategy: 'overwrite',
    })

    expect(result.systemPrompt).toBe('imported prompt')
    expect(result.ragOptions.chunkSize).toBe(1000)
  })

  it('should run migration for older settings versions', () => {
    const importData = makeImportData({
      settingsVersion: 38,
      pluginVersion: '1.4.0',
      keys: ['chatModelId'],
      data: { chatModelId: 'existing/gpt-4' },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['chatModelId'],
      currentSettings,
      mergeStrategy: 'overwrite',
    })

    expect(result.version).toBe(SETTINGS_SCHEMA_VERSION)
  })

  it('should normalize references after import (orphan model references)', () => {
    const importData = makeImportData({
      keys: ['chatModelId'],
      data: { chatModelId: 'nonexistent/model' },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['chatModelId'],
      currentSettings,
      mergeStrategy: 'overwrite',
    })

    expect(result.chatModelId).not.toBe('nonexistent/model')
  })

  it('should handle primitive value import in merge mode (direct overwrite)', () => {
    const importData = makeImportData({
      keys: ['systemPrompt'],
      data: { systemPrompt: 'new prompt' },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['systemPrompt'],
      currentSettings,
      mergeStrategy: 'merge',
    })

    expect(result.systemPrompt).toBe('new prompt')
  })

  it('should ignore EXCLUDED_KEYS in selectedKeys', () => {
    const importData = makeImportData({
      keys: ['systemPrompt', 'version'],
      data: { systemPrompt: 'imported', version: 999 },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['systemPrompt', 'version', '__meta'],
      currentSettings,
      mergeStrategy: 'overwrite',
    })

    expect(result.systemPrompt).toBe('imported')
    // version 应该是当前 SETTINGS_SCHEMA_VERSION，不被导入覆盖
    expect(result.version).toBe(SETTINGS_SCHEMA_VERSION)
  })

  it('should replace arrays in merge mode (providers list)', () => {
    const importData = makeImportData({
      keys: ['providers'],
      data: {
        providers: [
          { id: 'new-provider', presetType: 'openai', apiKey: 'new-key' },
        ],
      },
    })

    const result = applyImport({
      importData,
      selectedKeys: ['providers'],
      currentSettings,
      mergeStrategy: 'merge',
    })

    // 数组在 merge 模式下是直接覆盖，不是追加
    expect(result.providers).toHaveLength(1)
    expect(result.providers[0].id).toBe('new-provider')
  })

  it('should skip keys whose imported value is undefined', () => {
    const importData = makeImportData({
      keys: ['systemPrompt', 'chatModelId'],
      data: { chatModelId: 'existing/gpt-4' },
      // systemPrompt 在 keys 中声明但 data 中没有
    })

    const result = applyImport({
      importData,
      selectedKeys: ['systemPrompt', 'chatModelId'],
      currentSettings,
      mergeStrategy: 'overwrite',
    })

    // systemPrompt 不在 migratedData 中，应保持当前值
    expect(result.systemPrompt).toBe(currentSettings.systemPrompt)
    expect(result.chatModelId).toBe('existing/gpt-4')
  })
})
