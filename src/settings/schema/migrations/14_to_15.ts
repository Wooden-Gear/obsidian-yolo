import {
  DEFAULT_TAB_COMPLETION_OPTIONS,
  DEFAULT_TAB_COMPLETION_SYSTEM_PROMPT,
  SmartComposerSettings,
} from '../setting.types'
import { SettingMigration } from '../setting.types'

const cloneDefaults = () => ({ ...DEFAULT_TAB_COMPLETION_OPTIONS })

export const migrateFrom14To15: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 15

  const continuationOptionsRaw = newData.continuationOptions
  const continuationOptions:
    | SmartComposerSettings['continuationOptions']
    | Record<string, unknown>
    | undefined =
    continuationOptionsRaw && typeof continuationOptionsRaw === 'object'
      ? (continuationOptionsRaw as Record<string, unknown>)
      : undefined

  if (!continuationOptions) {
    newData.continuationOptions = {
      tabCompletionOptions: cloneDefaults(),
      tabCompletionSystemPrompt: DEFAULT_TAB_COMPLETION_SYSTEM_PROMPT,
    }
    return newData
  }

  const existingOptions = continuationOptions as Record<string, unknown>

  if (typeof existingOptions.tabCompletionOptions !== 'object' || existingOptions.tabCompletionOptions === null) {
    existingOptions.tabCompletionOptions = cloneDefaults()
  } else {
    const legacy = existingOptions.tabCompletionOptions as Record<string, unknown>
    existingOptions.tabCompletionOptions = {
      ...cloneDefaults(),
      ...legacy,
      maxTokens:
        typeof legacy.maxTokens === 'number' && Number.isFinite(legacy.maxTokens)
          ? legacy.maxTokens
          : DEFAULT_TAB_COMPLETION_OPTIONS.maxTokens,
    }
  }

  if (typeof existingOptions.tabCompletionSystemPrompt !== 'string') {
    existingOptions.tabCompletionSystemPrompt = DEFAULT_TAB_COMPLETION_SYSTEM_PROMPT
  }

  newData.continuationOptions = existingOptions
  return newData
}
