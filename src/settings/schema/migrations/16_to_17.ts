import { DEFAULT_ASSISTANT_ICON } from '../../../utils/assistant-icon'
import { SettingMigration } from '../setting.types'

export const migrateFrom16To17: SettingMigration['migrate'] = (data) => {
  const newData = { ...data }
  newData.version = 17

  // 为现有的助手添加默认图标
  if (Array.isArray(newData.assistants)) {
    newData.assistants = newData.assistants.map((assistant: any) => {
      // 如果助手已经有图标，保持不变
      if (assistant.icon) {
        return assistant
      }
      // 否则添加默认图标
      return {
        ...assistant,
        icon: DEFAULT_ASSISTANT_ICON,
      }
    })
  }

  return newData
}
