import React, { useMemo, useState } from 'react'

import Chat, { ChatProps, ChatRef } from './Chat'
import Composer from './Composer'

type ChatSidebarTabsProps = {
  chatRef: React.RefObject<ChatRef>
  initialChatProps?: ChatProps
}

const ChatSidebarTabs: React.FC<ChatSidebarTabsProps> = ({
  chatRef,
  initialChatProps,
}) => {
  const [activeTab, setActiveTab] = useState<'chat' | 'composer'>('chat')

  // Keep the initial props stable even if parent clears them after render
  const chatProps = useMemo(() => initialChatProps, [initialChatProps])

  return (
    <div className="smtcmp-sidebar-root">
      <div className="smtcmp-sidebar-panels">
        <div
          className={`smtcmp-sidebar-pane${activeTab === 'chat' ? ' is-active' : ''}`}
          aria-hidden={activeTab !== 'chat'}
        >
          <Chat
            ref={chatRef}
            {...(chatProps ?? {})}
            activeView={activeTab}
            onChangeView={(view) => setActiveTab(view)}
          />
        </div>
        <div
          className={`smtcmp-sidebar-pane${activeTab === 'composer' ? ' is-active' : ''}`}
          aria-hidden={activeTab !== 'composer'}
        >
          <Composer onNavigateChat={() => setActiveTab('chat')} />
        </div>
      </div>
    </div>
  )
}

export default ChatSidebarTabs
