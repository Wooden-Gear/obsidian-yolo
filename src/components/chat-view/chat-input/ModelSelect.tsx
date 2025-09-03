import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { useState } from 'react'

import { useSettings } from '../../../contexts/settings-context'
import { getModelDisplayNameWithProvider } from '../../../utils/model-id-utils'

export function ModelSelect() {
  const { settings, setSettings } = useSettings()
  const [isOpen, setIsOpen] = useState(false)
  
  // Get provider name for current model
  const getCurrentModelDisplay = () => {
    const currentModel = settings.chatModels.find(m => m.id === settings.chatModelId)
    if (currentModel) {
      const provider = settings.providers.find(p => p.id === currentModel.providerId)
      return getModelDisplayNameWithProvider(currentModel.id, provider?.id)
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
          <ul>
            {settings.chatModels
              .filter(({ enable }) => enable ?? true)
              .map((chatModelOption) => {
                const provider = settings.providers.find(p => p.id === chatModelOption.providerId)
                const displayName = getModelDisplayNameWithProvider(chatModelOption.id, provider?.id)
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
              })}
          </ul>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
