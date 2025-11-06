import clsx from 'clsx'
import { Eye, EyeOff, Wrench } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'

import { useApp } from '../../../contexts/app-context'
import { useMcp } from '../../../contexts/mcp-context'
import { usePlugin } from '../../../contexts/plugin-context'
import { useSettings } from '../../../contexts/settings-context'
import { McpManager } from '../../../core/mcp/mcpManager'
import { McpSectionModal } from '../../modals/McpSectionModal'

export default function ToolBadge() {
  const plugin = usePlugin()
  const app = useApp()
  const { settings, setSettings } = useSettings()
  const { getMcpManager } = useMcp()

  const [mcpManager, setMcpManager] = useState<McpManager | null>(null)
  const [toolCount, setToolCount] = useState(0)

  const handleBadgeClick = useCallback(() => {
    new McpSectionModal(app, plugin).open()
  }, [plugin, app])

  const handleToolToggle = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      e.stopPropagation()
      void setSettings({
        ...settings,
        chatOptions: {
          ...settings.chatOptions,
          enableTools: !settings.chatOptions.enableTools,
        },
      }).catch((error) => {
        console.error('Failed to toggle tool usage', error)
      })
    },
    [settings, setSettings],
  )

  useEffect(() => {
    let isMounted = true
    void getMcpManager()
      .then((manager) => {
        if (!isMounted) {
          return
        }
        setMcpManager(manager)
        return manager.listAvailableTools().then((tools) => {
          if (isMounted) {
            setToolCount(tools.length)
          }
        })
      })
      .catch((error) => {
        console.error('Failed to initialize MCP manager', error)
      })
    return () => {
      isMounted = false
    }
  }, [getMcpManager])

  useEffect(() => {
    if (mcpManager) {
      const unsubscribe = mcpManager.subscribeServersChange((_servers) => {
        void mcpManager
          .listAvailableTools()
          .then((tools) => {
            setToolCount(tools.length)
          })
          .catch((error) => {
            console.error('Failed to refresh tool list count', error)
          })
      })
      return () => {
        unsubscribe()
      }
    }
  }, [mcpManager])

  return (
    <div
      className="smtcmp-chat-user-input-file-badge"
      onClick={handleBadgeClick}
    >
      <div className="smtcmp-chat-user-input-file-badge-name">
        <Wrench
          size={12}
          className="smtcmp-chat-user-input-file-badge-name-icon"
        />
        <span
          className={clsx(
            !settings.chatOptions.enableTools && 'smtcmp-excluded-content',
          )}
        >
          Tools ({toolCount})
        </span>
      </div>
      <div
        className="smtcmp-chat-user-input-file-badge-eye"
        onClick={handleToolToggle}
      >
        {settings.chatOptions.enableTools ? (
          <Eye size={12} />
        ) : (
          <EyeOff size={12} />
        )}
      </div>
    </div>
  )
}
