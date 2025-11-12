import * as DropdownMenu from '@radix-ui/react-dropdown-menu'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { forwardRef, useCallback, useEffect, useRef, useState } from 'react'

import { useSettings } from '../../../contexts/settings-context'
import { getModelDisplayName } from '../../../utils/model-id-utils'

export const ModelSelect = forwardRef<
  HTMLButtonElement,
  {
    modelId?: string
    onModelSelected?: (modelId: string) => void
    onChange?: (modelId: string) => void
    onMenuOpenChange?: (isOpen: boolean) => void
    side?: 'top' | 'bottom' | 'left' | 'right'
    sideOffset?: number
    align?: 'start' | 'center' | 'end'
    alignOffset?: number
    container?: HTMLElement
    contentClassName?: string
    onKeyDown?: (
      event: React.KeyboardEvent<HTMLButtonElement>,
      isMenuOpen: boolean,
    ) => void
  }
>(
  (
    {
      modelId: externalModelId,
      onModelSelected,
      onChange,
      onMenuOpenChange,
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
    const itemRefs = useRef<Record<string, HTMLDivElement | null>>({})
    const selectedModelId = externalModelId ?? settings.chatModelId

    const enabledModels = settings.chatModels.filter(
      ({ enable }) => enable ?? true,
    )
    const totalModels = enabledModels.length
    const providerOrder = settings.providers.map((p) => p.id)
    const providerIdsInModels = Array.from(
      new Set(enabledModels.map((m) => m.providerId)),
    )
    const orderedProviderIds = [
      ...providerOrder.filter((id) => providerIdsInModels.includes(id)),
      ...providerIdsInModels.filter((id) => !providerOrder.includes(id)),
    ]

    // Get provider name for current model
    const getCurrentModelDisplay = () => {
      const currentModel = settings.chatModels.find(
        (m) => m.id === selectedModelId,
      )
      if (currentModel) {
        // 优先显示「展示名称」，其次调用ID(model)，最后回退到内部 id
        const provider = settings.providers.find(
          (p) => p.id === currentModel.providerId,
        )
        const display =
          currentModel.name || currentModel.model || currentModel.id
        // 使用 provider 展示后缀
        const suffix = provider?.id ? ` (${provider.id})` : ''
        return `${display}${suffix}`
      }
      return selectedModelId
    }

    const focusSelectedItem = useCallback(() => {
      const target = itemRefs.current[selectedModelId]
      if (!target) return
      target.focus({ preventScroll: true })

      // 手动滚动到选中项，确保其在可视区域内
      target.scrollIntoView({
        block: 'nearest',
        inline: 'nearest',
      })
    }, [selectedModelId])

    useEffect(() => {
      if (!isOpen) return
      const rafId = window.requestAnimationFrame(() => {
        focusSelectedItem()
      })
      return () => window.cancelAnimationFrame(rafId)
    }, [isOpen, focusSelectedItem])

    const handleTriggerKeyDown = (
      event: React.KeyboardEvent<HTMLButtonElement>,
    ) => {
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

      if (isOpen && event.key === 'Escape') {
        event.preventDefault()
        handleOpenChange(false)
        return
      }

      // 调用传入的 onKeyDown 处理器来处理其他导航键
      if (onKeyDown) {
        onKeyDown(event, isOpen)
      }
    }

    const handleOpenChange = (open: boolean) => {
      setIsOpen(open)
      onMenuOpenChange?.(open)
    }

    return (
      <DropdownMenu.Root open={isOpen} onOpenChange={handleOpenChange}>
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
            className={
              contentClassName
                ? `smtcmp-popover ${contentClassName}`
                : 'smtcmp-popover'
            }
            side={side}
            sideOffset={sideOffset}
            align={align}
            alignOffset={alignOffset}
            collisionPadding={8}
            loop
            onPointerDownOutside={(e) => {
              // 阻止事件冒泡，防止关闭父容器
              e.stopPropagation()
            }}
            onCloseAutoFocus={(e) => {
              // 防止关闭后自动聚焦，保持焦点在触发器上
              e.preventDefault()
            }}
          >
            <DropdownMenu.RadioGroup
              className="smtcmp-model-select-list"
              value={selectedModelId}
              onValueChange={(modelId: string) => {
                if (onChange) {
                  onChange(modelId)
                } else {
                  void (async () => {
                    try {
                      await setSettings({
                        ...settings,
                        chatModelId: modelId,
                      })
                    } catch (error: unknown) {
                      console.error(
                        'Failed to update chat model setting',
                        error,
                      )
                    }
                  })()
                }
                onModelSelected?.(modelId)
              }}
            >
              {(() => {
                let runningIndex = 0

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

                  const items = groupModels.map((chatModelOption, index) => {
                    // 列表项名称：优先显示「展示名称」，其次调用ID(model)，最后回退到内部 id
                    const displayName =
                      chatModelOption.name ||
                      chatModelOption.model ||
                      getModelDisplayName(chatModelOption.id)
                    runningIndex += 1
                    return (
                      <DropdownMenu.RadioItem
                        key={chatModelOption.id}
                        className="smtcmp-popover-item"
                        value={chatModelOption.id}
                        ref={(element) => {
                          itemRefs.current[chatModelOption.id] = element
                        }}
                        data-first-item={
                          runningIndex === 1 && index === 0 ? 'true' : undefined
                        }
                      >
                        {displayName}
                      </DropdownMenu.RadioItem>
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
            </DropdownMenu.RadioGroup>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    )
  },
)

ModelSelect.displayName = 'ModelSelect'
