import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { forwardRef, useState } from 'react'

import { useSettings } from '../../../contexts/settings-context'
import { getModelDisplayName } from '../../../utils/model-id-utils'

export const ModelSelect = forwardRef<
  HTMLButtonElement,
  {
    modelId?: string
    onChange?: (modelId: string) => void
    onModelSelected?: (modelId: string) => void
    side?: 'top' | 'bottom' | 'left' | 'right'
    sideOffset?: number
    align?: 'start' | 'center' | 'end'
    alignOffset?: number
    container?: HTMLElement
    contentClassName?: string
    onKeyDown?: (event: React.KeyboardEvent<HTMLButtonElement>, isMenuOpen: boolean) => void
  }
>(
  (
    {
      modelId: externalModelId,
      onChange,
      onModelSelected,
      side = 'bottom',
      sideOffset = 4,
      align = 'end',
      alignOffset = 0,
      container,
      contentClassName,
      onKeyDown,
    } = {},
    ref,
  ) => {
  const { settings, setSettings } = useSettings()
  const [isOpen, setIsOpen] = useState(false)

  // Get provider name for current model
  const getCurrentModelDisplay = () => {
    const effectiveModelId = externalModelId ?? settings.chatModelId
    const currentModel = settings.chatModels.find(
      (m) => m.id === effectiveModelId,
    )
    if (currentModel) {
      // 优先显示「展示名称」，其次调用ID(model)，最后回退到内部 id
      const provider = settings.providers.find(
        (p) => p.id === currentModel.providerId,
      )
      const display = currentModel.name || currentModel.model || currentModel.id
      // 使用 provider 展示后缀
      const suffix = provider?.id ? ` (${provider.id})` : ''
      return `${display}${suffix}`
    }
    return effectiveModelId
  }

  const handleTriggerKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    // 处理键盘导航
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      // 如果下拉菜单未打开，按上下方向键时打开它
      if (!isOpen) {
        event.preventDefault()
        setIsOpen(true)
        return
      }
      // 如果菜单已打开，不要阻止事件，让 Radix UI 接管
      return
    }
    
    // 调用传入的 onKeyDown 处理器来处理其他导航键
    if (onKeyDown) {
      onKeyDown(event, isOpen)
    }
  }

  return (
    <DropdownMenu.Root open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenu.Trigger
        ref={ref}
        className="smtcmp-chat-input-model-select"
        onKeyDown={handleTriggerKeyDown}
      >
        <div className="smtcmp-chat-input-model-select__model-name">
          {getCurrentModelDisplay()}
        </div>
        <div className="smtcmp-chat-input-model-select__icon">
          {isOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
        </div>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal container={container}>
        <DropdownMenu.Content
          className={contentClassName || 'smtcmp-popover'}
          side={side}
          sideOffset={sideOffset}
          align={align}
          alignOffset={alignOffset}
          collisionPadding={8}
          onPointerDownOutside={(e) => {
            // 阻止事件冒泡，防止关闭父容器
            e.stopPropagation()
          }}
          onCloseAutoFocus={(e) => {
            // 防止关闭后自动聚焦，保持焦点在触发器上
            e.preventDefault()
          }}
        >
          <div className="smtcmp-model-select-list">
            {(() => {
              const enabledModels = settings.chatModels.filter(
                ({ enable }) => enable ?? true,
              )
              const providerOrder = settings.providers.map((p) => p.id)
              const providerIdsInModels = Array.from(
                new Set(enabledModels.map((m) => m.providerId)),
              )
              const orderedProviderIds = [
                ...providerOrder.filter((id) =>
                  providerIdsInModels.includes(id),
                ),
                ...providerIdsInModels.filter(
                  (id) => !providerOrder.includes(id),
                ),
              ]

              return orderedProviderIds.flatMap((pid, groupIndex) => {
                const groupModels = enabledModels.filter(
                  (m) => m.providerId === pid,
                )
                if (groupModels.length === 0) return []

                const groupHeader = (
                  <DropdownMenu.Label
                    key={`label-${pid}`}
                    className="smtcmp-popover-group-label"
                  >
                    {pid}
                  </DropdownMenu.Label>
                )

                const items = groupModels.map((chatModelOption) => {
                  // 列表项名称：优先显示「展示名称」，其次调用ID(model)，最后回退到内部 id
                  const displayName =
                    chatModelOption.name ||
                    chatModelOption.model ||
                    getModelDisplayName(chatModelOption.id)
                  return (
                    <DropdownMenu.Item
                      key={chatModelOption.id}
                      className="smtcmp-popover-item"
                      onSelect={() => {
                        if (onChange) {
                          onChange(chatModelOption.id)
                        } else {
                          setSettings({
                            ...settings,
                            chatModelId: chatModelOption.id,
                          })
                        }
                        onModelSelected?.(chatModelOption.id)
                      }}
                    >
                      {displayName}
                    </DropdownMenu.Item>
                  )
                })

                return [
                  groupHeader,
                  ...items,
                  ...(groupIndex < orderedProviderIds.length - 1
                    ? [
                        <DropdownMenu.Separator
                          key={`sep-${pid}`}
                          className="smtcmp-popover-group-separator"
                        />,
                      ]
                    : []),
                ]
              })
            })()}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
})

ModelSelect.displayName = 'ModelSelect'
