import { SETTINGS_SCHEMA_VERSION } from '../../settings/schema/migrations'

import {
  buildExportData,
  computeChecksum,
  redactApiKeys,
} from './export-config'
import { CONFIG_EXPORT_FORMAT_VERSION } from './types'

describe('redactApiKeys', () => {
  it('should replace apiKey string values with random strings of same length', () => {
    const data = {
      id: 'provider-1',
      apiKey: 'sk-1234567890abcdef',
      baseUrl: 'https://api.example.com',
    }
    const result = redactApiKeys(data) as Record<string, unknown>
    expect(result.id).toBe('provider-1')
    expect(result.baseUrl).toBe('https://api.example.com')
    expect(result.apiKey).not.toBe('sk-1234567890abcdef')
    expect((result.apiKey as string).length).toBe('sk-1234567890abcdef'.length)
  })

  it('should handle empty apiKey', () => {
    const data = { apiKey: '' }
    const result = redactApiKeys(data) as Record<string, unknown>
    expect(result.apiKey).toBe('')
  })

  it('should recursively redact apiKey in nested objects', () => {
    const data = {
      providers: [
        { id: 'a', apiKey: 'key-aaa' },
        { id: 'b', apiKey: 'key-bbb' },
      ],
      webSearch: {
        providers: [{ id: 'c', apiKey: 'key-ccc' }],
      },
    }
    const result = redactApiKeys(data) as Record<string, unknown>
    const providers = result.providers as Array<Record<string, unknown>>
    expect(providers[0].apiKey).not.toBe('key-aaa')
    expect((providers[0].apiKey as string).length).toBe('key-aaa'.length)
    expect(providers[1].apiKey).not.toBe('key-bbb')

    const webSearch = result.webSearch as Record<string, unknown>
    const wsProviders = webSearch.providers as Array<Record<string, unknown>>
    expect(wsProviders[0].apiKey).not.toBe('key-ccc')
    expect((wsProviders[0].apiKey as string).length).toBe('key-ccc'.length)
  })

  it('should not modify non-apiKey fields', () => {
    const data = {
      name: 'test',
      key: 'not-an-api-key',
      nested: { value: 123 },
    }
    const result = redactApiKeys(data)
    expect(result).toEqual(data)
  })

  it('should handle null and primitive values', () => {
    expect(redactApiKeys(null)).toBeNull()
    expect(redactApiKeys(42)).toBe(42)
    expect(redactApiKeys('hello')).toBe('hello')
    expect(redactApiKeys(undefined)).toBeUndefined()
  })
})

describe('computeChecksum', () => {
  it('should produce a hex string of 64 characters (SHA-256)', async () => {
    const hash = await computeChecksum('hello world')
    expect(hash).toHaveLength(64)
    expect(hash).toMatch(/^[0-9a-f]+$/)
  })

  it('should produce different hashes for different inputs', async () => {
    const hash1 = await computeChecksum('hello')
    const hash2 = await computeChecksum('world')
    expect(hash1).not.toBe(hash2)
  })

  it('should produce the same hash for the same input', async () => {
    const hash1 = await computeChecksum('test content')
    const hash2 = await computeChecksum('test content')
    expect(hash1).toBe(hash2)
  })
})

describe('buildExportData', () => {
  const mockSettings: Record<string, unknown> = {
    version: 51,
    __meta: { deviceId: 'test-device', updatedAt: 123456 },
    providers: [
      { id: 'ds', apiKey: 'sk-secret', baseUrl: 'https://api.deepseek.com' },
    ],
    chatModels: [{ id: 'ds/model', model: 'model', providerId: 'ds' }],
    chatModelId: 'ds/model',
    ragOptions: { enabled: true, chunkSize: 1000 },
    systemPrompt: 'hello',
  }

  it('should export only selected keys', async () => {
    const result = await buildExportData({
      keys: ['providers', 'chatModelId'],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
    })

    expect(result.$schema).toBe('yolo-config-export')
    expect(result.formatVersion).toBe(CONFIG_EXPORT_FORMAT_VERSION)
    expect(result.settingsVersion).toBe(SETTINGS_SCHEMA_VERSION)
    expect(result.pluginVersion).toBe('1.5.7.5')
    expect(result.redacted).toBe(false)
    expect(result.keys).toEqual(['providers', 'chatModelId'])
    expect(result.data).toHaveProperty('providers')
    expect(result.data).toHaveProperty('chatModelId')
    expect(result.data).not.toHaveProperty('ragOptions')
    expect(result.data).not.toHaveProperty('chatModels')
  })

  it('should exclude internal keys (version, __meta) even if selected', async () => {
    const result = await buildExportData({
      keys: ['version', '__meta', 'providers'],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
    })

    expect(result.data).not.toHaveProperty('version')
    expect(result.data).not.toHaveProperty('__meta')
    expect(result.data).toHaveProperty('providers')
  })

  it('should redact API keys when redacted option is true', async () => {
    const result = await buildExportData({
      keys: ['providers'],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
      redacted: true,
    })

    expect(result.redacted).toBe(true)
    const providers = result.data.providers as Array<Record<string, unknown>>
    expect(providers[0].apiKey).not.toBe('sk-secret')
    expect((providers[0].apiKey as string).length).toBe('sk-secret'.length)
    expect(providers[0].baseUrl).toBe('https://api.deepseek.com')
  })

  it('should not redact API keys when redacted option is false', async () => {
    const result = await buildExportData({
      keys: ['providers'],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
      redacted: false,
    })

    expect(result.redacted).toBe(false)
    const providers = result.data.providers as Array<Record<string, unknown>>
    expect(providers[0].apiKey).toBe('sk-secret')
  })

  it('should include a valid checksum', async () => {
    const result = await buildExportData({
      keys: ['chatModelId'],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
    })

    expect(result.checksum).toHaveLength(64)
    expect(result.checksum).toMatch(/^[0-9a-f]+$/)

    // Verify checksum matches payload without checksum field
    const { checksum, ...payload } = result
    const expectedChecksum = await computeChecksum(JSON.stringify(payload))
    expect(checksum).toBe(expectedChecksum)
  })

  it('should handle keys that do not exist in settings', async () => {
    const result = await buildExportData({
      keys: ['nonExistentKey', 'chatModelId'],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
    })

    expect(result.data).not.toHaveProperty('nonExistentKey')
    expect(result.data).toHaveProperty('chatModelId')
  })

  it('should produce empty data when all selected keys are missing from settings', async () => {
    const result = await buildExportData({
      keys: ['nonExistent1', 'nonExistent2'],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
    })

    expect(result.keys).toEqual(['nonExistent1', 'nonExistent2'])
    expect(Object.keys(result.data)).toHaveLength(0)
  })

  it('should handle empty keys array', async () => {
    const result = await buildExportData({
      keys: [],
      settingsData: mockSettings,
      pluginVersion: '1.5.7.5',
    })

    expect(result.keys).toEqual([])
    expect(Object.keys(result.data)).toHaveLength(0)
  })
})
