import { useMemo } from 'react'

import { useApp } from '../contexts/app-context'
import { ChatManager } from '../database/json/chat/ChatManager'
// templates feature removed

export function useChatManager() {
  const app = useApp()
  return useMemo(() => new ChatManager(app), [app])
}
