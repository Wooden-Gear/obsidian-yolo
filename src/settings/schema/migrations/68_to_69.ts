import type { SettingMigration } from '../setting.types'

/**
 * v68→v69: rename legacy chat mode values to ask / agent / agent-full.
 */
export const migrateFrom68To69: SettingMigration['migrate'] = (data) => {
  const next: Record<string, unknown> = { ...data, version: 69 }

  if (
    next.chatOptions &&
    typeof next.chatOptions === 'object' &&
    (next.chatOptions as Record<string, unknown>).chatMode === 'chat'
  ) {
    next.chatOptions = {
      ...(next.chatOptions as Record<string, unknown>),
      chatMode: 'ask',
    }
  }

  if (
    next.continuationOptions &&
    typeof next.continuationOptions === 'object' &&
    (next.continuationOptions as Record<string, unknown>).quickAskMode ===
      'chat'
  ) {
    next.continuationOptions = {
      ...(next.continuationOptions as Record<string, unknown>),
      quickAskMode: 'ask',
    }
  }

  return next
}
