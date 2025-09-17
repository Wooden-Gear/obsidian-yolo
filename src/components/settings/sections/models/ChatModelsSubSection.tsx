import { Trash2, GripVertical } from 'lucide-react'
import { useRef, type DragEvent } from 'react'
import { App, Notice } from 'obsidian'
import { ObsidianToggle } from 'src/components/common/ObsidianToggle'

import { DEFAULT_CHAT_MODELS } from '../../../../constants'
import { useSettings } from '../../../../contexts/settings-context'
import SmartComposerPlugin from '../../../../main'
import { ConfirmModal } from '../../../modals/ConfirmModal'
import { AddChatModelModal } from '../../modals/AddChatModelModal'

type ChatModelsSubSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

const isEnabled = (enable: boolean | undefined | null) => enable ?? true

export function ChatModelsSubSection({
  app,
  plugin,
}: ChatModelsSubSectionProps) {
  const { settings, setSettings } = useSettings()
  const dragIndexRef = useRef<number | null>(null)

  const handleDeleteChatModel = async (modelId: string) => {
    if (modelId === settings.chatModelId || modelId === settings.applyModelId) {
      new Notice(
        'Cannot remove model that is currently selected as Chat Model or Tool Model',
      )
      return
    }

    const message = `Are you sure you want to delete model "${modelId}"?`
    new ConfirmModal(app, {
      title: 'Delete Chat Model',
      message: message,
      ctaText: 'Delete',
      onConfirm: async () => {
        await setSettings({
          ...settings,
          chatModels: [...settings.chatModels].filter((v) => v.id !== modelId),
        })
      },
    }).open()
  }

  const handleToggleEnableChatModel = async (
    modelId: string,
    value: boolean,
  ) => {
    if (
      !value &&
      (modelId === settings.chatModelId || modelId === settings.applyModelId)
    ) {
      new Notice(
        'Cannot disable model that is currently selected as Chat Model or Tool Model',
      )

      // to trigger re-render
      await setSettings({
        ...settings,
        chatModels: [...settings.chatModels].map((v) =>
          v.id === modelId ? { ...v, enable: true } : v,
        ),
      })
      return
    }

    await setSettings({
      ...settings,
      chatModels: [...settings.chatModels].map((v) =>
        v.id === modelId ? { ...v, enable: value } : v,
      ),
    })
  }

  const handleDragStart = (
    event: DragEvent<HTMLTableRowElement>,
    index: number,
  ) => {
    dragIndexRef.current = index
    event.dataTransfer?.setData('text/plain', settings.chatModels[index]?.id ?? '')
    event.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (event: DragEvent<HTMLTableRowElement>) => {
    event.preventDefault()
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
  }

  const handleDrop = async (
    event: DragEvent<HTMLTableRowElement>,
    targetIndex: number,
  ) => {
    event.preventDefault()
    const sourceIndex = dragIndexRef.current
    dragIndexRef.current = null
    if (sourceIndex === null) {
      return
    }

    const updatedChatModels = [...settings.chatModels]
    const [moved] = updatedChatModels.splice(sourceIndex, 1)
    if (!moved) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const dropAfter = event.clientY - rect.top > rect.height / 2

    let insertIndex = targetIndex + (dropAfter ? 1 : 0)
    if (sourceIndex < insertIndex) {
      insertIndex -= 1
    }
    if (insertIndex < 0) {
      insertIndex = 0
    }
    if (insertIndex > updatedChatModels.length) {
      insertIndex = updatedChatModels.length
    }
    updatedChatModels.splice(insertIndex, 0, moved)

    await setSettings({
      ...settings,
      chatModels: updatedChatModels,
    })
  }

  return (
    <div>
      <div className="smtcmp-settings-sub-header">Chat Models</div>
      <div className="smtcmp-settings-desc">Models used for chat and apply</div>

      <div className="smtcmp-settings-table-container">
        <table className="smtcmp-settings-table">
          <colgroup>
            <col width={28} />
            <col />
            <col />
            <col />
            <col width={60} />
            <col width={60} />
          </colgroup>
          <thead>
            <tr>
              <th></th>
              <th>ID</th>
              <th>Provider ID</th>
              <th>Model (calling ID)</th>
              <th>Enable</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {settings.chatModels.map((chatModel, index) => (
              <tr
                key={chatModel.id}
                draggable
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={handleDragOver}
                onDrop={(event) => void handleDrop(event, index)}
                onDragEnd={handleDragEnd}
              >
                <td>
                  <span className="smtcmp-drag-handle" aria-label="Drag to reorder">
                    <GripVertical />
                  </span>
                </td>
                <td>{chatModel.id}</td>
                <td>{chatModel.providerId}</td>
                <td>{chatModel.model || chatModel.name || chatModel.id}</td>
                <td>
                  <ObsidianToggle
                    value={isEnabled(chatModel.enable)}
                    onChange={(value) =>
                      handleToggleEnableChatModel(chatModel.id, value)
                    }
                  />
                </td>
                <td>
                  <div className="smtcmp-settings-actions">
                    {!DEFAULT_CHAT_MODELS.some(
                      (v) => v.id === chatModel.id,
                    ) && (
                      <button
                        onClick={() => handleDeleteChatModel(chatModel.id)}
                        className="clickable-icon"
                      >
                        <Trash2 />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={6}>
                <button
                  onClick={() => {
                    new AddChatModelModal(app, plugin).open()
                  }}
                >
                  Add custom model
                </button>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  )
}
