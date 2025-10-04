import { DEFAULT_TAB_COMPLETION_OPTIONS } from '../setting.types'
import { SettingMigration } from '../setting.types'

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null

const normalizeNumber = (
  value: unknown,
  fallback: number,
): number => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value)
    if (!Number.isNaN(parsed)) {
      return parsed
    }
  }
  return fallback
}

export const migrateFrom13To14: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 14

  if (!isRecord(newData.continuationOptions)) {
    newData.continuationOptions = {}
  }

  const continuationOptions = newData.continuationOptions as Record<string, unknown>

  if (!isRecord(continuationOptions.tabCompletionOptions)) {
    continuationOptions.tabCompletionOptions = { ...DEFAULT_TAB_COMPLETION_OPTIONS }
  } else {
    const options = { ...DEFAULT_TAB_COMPLETION_OPTIONS }
    const legacy = continuationOptions.tabCompletionOptions as Record<string, unknown>

    options.triggerDelayMs = normalizeNumber(
      legacy.triggerDelayMs,
      options.triggerDelayMs,
    )
    options.minContextLength = normalizeNumber(
      legacy.minContextLength,
      options.minContextLength,
    )
    options.maxContextChars = normalizeNumber(
      legacy.maxContextChars,
      options.maxContextChars,
    )
    options.maxSuggestionLength = normalizeNumber(
      legacy.maxSuggestionLength,
      options.maxSuggestionLength,
    )
    options.temperature = normalizeNumber(
      legacy.temperature,
      options.temperature,
    )
    options.requestTimeoutMs = normalizeNumber(
      legacy.requestTimeoutMs,
      options.requestTimeoutMs,
    )
    options.maxRetries = Math.max(
      0,
      Math.min(5, Math.round(normalizeNumber(legacy.maxRetries, options.maxRetries))),
    )

    continuationOptions.tabCompletionOptions = options
  }

  newData.continuationOptions = continuationOptions

  return newData
}

