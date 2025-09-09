import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

import { useSettings } from '../../../contexts/settings-context'
import { getModelDisplayNameWithProvider, getModelDisplayName } from '../../../utils/model-id-utils'

export function ModelSelect() {
  const { settings, setSettings } = useSettings()
  const [isOpen, setIsOpen] = useState(false)
  
  // Get provider name for current model
  const getCurrentModelDisplay = () => {
    const currentModel = settings.chatModels.find(m => m.id === settings.chatModelId)
    if (currentModel) {
      // 优先显示调用ID(model)，其次 name，再次回退到内部 id
      const provider = settings.providers.find(p => p.id === currentModel.providerId)
      const display = currentModel.model || currentModel.name || currentModel.id
      // 使用 provider 展示后缀，但不改变主显示为调用ID
      const suffix = provider?.id ? ` (${provider.id})` : ''
      return `${display}${suffix}`
    }
    return settings.chatModelId
  }
  
  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger className="smtcmp-chat-input-model-select">
        <div className="smtcmp-chat-input-model-select__model-name">
          {getCurrentModelDisplay()}
        </div>
        <div className="smtcmp-chat-input-model-select__icon">
          {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content className="smtcmp-popover">
          <ul className="smtcmp-model-select-list">
            {(() => {
              const enabledModels = settings.chatModels.filter(({ enable }) => enable ?? true)
              const providerOrder = settings.providers.map(p => p.id)
              const providerIdsInModels = Array.from(new Set(enabledModels.map(m => m.providerId)))
              const orderedProviderIds = [
                ...providerOrder.filter(id => providerIdsInModels.includes(id)),
                ...providerIdsInModels.filter(id => !providerOrder.includes(id)),
              ]

              return orderedProviderIds.flatMap((pid, groupIndex) => {
                const groupModels = enabledModels.filter(m => m.providerId === pid)
                if (groupModels.length === 0) return []

                const groupHeader = (
                  <DropdownMenu.Label key={`label-${pid}`} className="smtcmp-popover-group-label">
                    {pid}
                  </DropdownMenu.Label>
                )

                const items = groupModels.map((chatModelOption) => {
                  // 列表项名称：优先显示调用ID(model)，其次 name，最后回退内部 id；不再仅从 id 解析
                  const displayName = chatModelOption.model || chatModelOption.name || getModelDisplayName(chatModelOption.id)
                  return (
                    <DropdownMenu.Item
                      key={chatModelOption.id}
                      onSelect={() => {
                        setSettings({
                          ...settings,
                          chatModelId: chatModelOption.id,
                        })
                      }}
                      asChild
                    >
                      <li>{displayName}</li>
                    </DropdownMenu.Item>
                  )
                })

                return [
                  groupHeader,
                  ...items,
                  ...(groupIndex < orderedProviderIds.length - 1 ? [<DropdownMenu.Separator key={`sep-${pid}`} className="smtcmp-popover-group-separator" />] : []),
                ]
              })
            })()}
          </ul>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}

