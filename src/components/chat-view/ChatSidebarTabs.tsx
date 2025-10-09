import React, { useEffect, useMemo, useState } from 'react'

import { useSettings } from '../../contexts/settings-context'

import Chat, { ChatProps, ChatRef } from './Chat'

type ChatSidebarTabsProps = {
  chatRef: React.RefObject<ChatRef>
  initialChatProps?: ChatProps
}

const ChatSidebarTabs: React.FC<ChatSidebarTabsProps> = ({
  chatRef,
  initialChatProps,
}) => {
  const { settings } = useSettings()
  const superContinuationEnabled = Boolean(
    settings.continuationOptions.enableSuperContinuation,
  )
  const [activeTab, setActiveTab] = useState<'chat' | 'composer'>('chat')

  // Keep the initial props stable even if parent clears them after render
  const chatProps = useMemo(() => initialChatProps, [initialChatProps])

  useEffect(() => {
    if (!superContinuationEnabled && activeTab !== 'chat') {
      setActiveTab('chat')
    }
  }, [superContinuationEnabled, activeTab])

  return (
    <div className="smtcmp-sidebar-root">
      <div className="smtcmp-sidebar-panels">
        <div className="smtcmp-sidebar-pane is-active" aria-hidden={false}>
          <Chat
            ref={chatRef}
            {...(chatProps ?? {})}
            activeView={superContinuationEnabled ? activeTab : 'chat'}
            onChangeView={
              superContinuationEnabled
                ? (view) => setActiveTab(view)
                : undefined
            }
          />
        </div>
      </div>
    </div>
  )
}

export default ChatSidebarTabs
