import { Bot, GripVertical } from 'lucide-react'
import { App } from 'obsidian'
import React, { type DragEvent, useRef, useState, type FC } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { Assistant } from '../../../types/assistant.types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextArea } from '../../common/ObsidianTextArea'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { ConfirmModal } from '../../modals/ConfirmModal'

type AssistantsSectionProps = {
  app: App
}

export const AssistantsSection: FC<AssistantsSectionProps> = ({ app }) => {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()
  const assistants = settings.assistants || []
  const [editingAssistant, setEditingAssistant] = useState<Assistant | null>(
    null,
  )
  const [isAddingAssistant, setIsAddingAssistant] = useState(false)
  const dragIndexRef = useRef<number | null>(null)
  const dragOverItemRef = useRef<HTMLDivElement | null>(null)
  const lastDropPosRef = useRef<'before' | 'after' | null>(null)
  const lastInsertIndexRef = useRef<number | null>(null)

  const handleSaveAssistants = async (newAssistants: Assistant[]) => {
    await setSettings({
      ...settings,
      assistants: newAssistants,
    })
  }

  const handleAddAssistant = () => {
    const newAssistant: Assistant = {
      id: crypto.randomUUID(),
      name: '',
      description: '',
      systemPrompt: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    setEditingAssistant(newAssistant)
    setIsAddingAssistant(true)
  }

  const handleSaveAssistant = async () => {
    if (
      !editingAssistant ||
      !editingAssistant.name ||
      !editingAssistant.systemPrompt
    ) {
      return
    }

    let newAssistants: Assistant[]
    if (isAddingAssistant) {
      newAssistants = [
        ...assistants,
        { ...editingAssistant, updatedAt: Date.now() },
      ]
    } else {
      newAssistants = assistants.map((a) =>
        a.id === editingAssistant.id
          ? { ...editingAssistant, updatedAt: Date.now() }
          : a,
      )
    }

    try {
      await handleSaveAssistants(newAssistants)
      setEditingAssistant(null)
      setIsAddingAssistant(false)
    } catch (error: unknown) {
      console.error('Failed to save assistant', error)
    }
  }

  const handleDeleteAssistant = (id: string) => {
    const assistantToDelete = assistants.find((a) => a.id === id)
    if (!assistantToDelete) return

    let confirmed = false

    const modal = new ConfirmModal(app, {
      title: t(
        'settings.assistants.deleteConfirmTitle',
        'Confirm delete assistant',
      ),
      message: `${t('settings.assistants.deleteConfirmMessagePrefix', 'Are you sure you want to delete assistant')} "${assistantToDelete.name}"${t('settings.assistants.deleteConfirmMessageSuffix', '? This action cannot be undone.')}`,
      ctaText: t('common.delete'),
      onConfirm: () => {
        confirmed = true
      },
    })

    modal.onClose = async () => {
      if (!confirmed) return

      try {
        const updatedAssistants = assistants.filter((a) => a.id !== id)

        let newCurrentAssistantId = settings.currentAssistantId
        if (id === settings.currentAssistantId) {
          newCurrentAssistantId =
            updatedAssistants.length > 0 ? updatedAssistants[0].id : undefined
        }

        await setSettings({
          ...settings,
          assistants: updatedAssistants,
          currentAssistantId: newCurrentAssistantId,
        })
      } catch (error: unknown) {
        console.error('Failed to delete assistant', error)
      }
    }

    modal.open()
  }

  const handleDuplicateAssistant = async (assistant: Assistant) => {
    const newAssistant: Assistant = {
      ...assistant,
      id: crypto.randomUUID(),
      name: `${assistant.name}${t('settings.assistants.copySuffix', ' (副本)')}`,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    const newAssistants = [...assistants, newAssistant]
    try {
      await handleSaveAssistants(newAssistants)
    } catch (error: unknown) {
      console.error('Failed to duplicate assistant', error)
    }
  }

  const triggerDropSuccess = (movedId: string) => {
    const tryFind = (attempt = 0) => {
      const movedItem = document.querySelector(
        `div[data-assistant-id="${movedId}"]`,
      )
      if (movedItem) {
        movedItem.classList.add('smtcmp-assistant-item-drop-success')
        window.setTimeout(() => {
          movedItem.classList.remove('smtcmp-assistant-item-drop-success')
        }, 700)
      } else if (attempt < 8) {
        window.setTimeout(() => tryFind(attempt + 1), 50)
      }
    }
    requestAnimationFrame(() => tryFind())
  }

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    globalIndex: number,
  ) => {
    dragIndexRef.current = globalIndex
    event.dataTransfer?.setData('text/plain', assistants[globalIndex]?.id ?? '')
    event.dataTransfer.effectAllowed = 'move'

    const item = event.currentTarget
    item.classList.add('smtcmp-assistant-item-dragging')
    const handle = item.querySelector('.smtcmp-drag-handle')
    if (handle) handle.classList.add('smtcmp-drag-handle--active')
  }

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    targetGlobalIndex: number,
  ) => {
    event.preventDefault()

    const item = event.currentTarget
    const rect = item.getBoundingClientRect()
    const rel = (event.clientY - rect.top) / rect.height

    if (dragIndexRef.current === targetGlobalIndex) {
      item.classList.remove(
        'smtcmp-assistant-item-drag-over-before',
        'smtcmp-assistant-item-drag-over-after',
      )
      if (dragOverItemRef.current && dragOverItemRef.current !== item) {
        dragOverItemRef.current.classList.remove(
          'smtcmp-assistant-item-drag-over-before',
          'smtcmp-assistant-item-drag-over-after',
        )
      }
      dragOverItemRef.current = item
      lastDropPosRef.current = null
      lastInsertIndexRef.current = null
      return
    }

    const HYSTERESIS = 0.05
    let dropAfter: boolean
    if (lastDropPosRef.current) {
      if (rel > 0.5 + HYSTERESIS) dropAfter = true
      else if (rel < 0.5 - HYSTERESIS) dropAfter = false
      else dropAfter = lastDropPosRef.current === 'after'
    } else {
      dropAfter = rel > 0.5
    }

    const sourceIndex = dragIndexRef.current!
    let insertIndex = targetGlobalIndex
    if (dropAfter) insertIndex += 1
    if (sourceIndex < targetGlobalIndex) insertIndex -= 1

    if (lastInsertIndexRef.current === insertIndex) {
      return
    }

    if (dragOverItemRef.current) {
      dragOverItemRef.current.classList.remove(
        'smtcmp-assistant-item-drag-over-before',
        'smtcmp-assistant-item-drag-over-after',
      )
    }

    const desiredClass = dropAfter
      ? 'smtcmp-assistant-item-drag-over-after'
      : 'smtcmp-assistant-item-drag-over-before'
    item.classList.remove(
      'smtcmp-assistant-item-drag-over-before',
      'smtcmp-assistant-item-drag-over-after',
    )
    item.classList.add(desiredClass)
    dragOverItemRef.current = item
    lastDropPosRef.current = dropAfter ? 'after' : 'before'
    lastInsertIndexRef.current = insertIndex
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    if (dragOverItemRef.current) {
      dragOverItemRef.current.classList.remove(
        'smtcmp-assistant-item-drag-over-before',
        'smtcmp-assistant-item-drag-over-after',
      )
      dragOverItemRef.current = null
    }
    lastDropPosRef.current = null
    lastInsertIndexRef.current = null
    const dragging = document.querySelector('.smtcmp-assistant-item-dragging')
    if (dragging) dragging.classList.remove('smtcmp-assistant-item-dragging')
    const activeHandle = document.querySelector(
      '.smtcmp-drag-handle.smtcmp-drag-handle--active',
    )
    if (activeHandle)
      activeHandle.classList.remove('smtcmp-drag-handle--active')
  }

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    targetGlobalIndex: number,
  ) => {
    event.preventDefault()
    const itemEl = event.currentTarget as HTMLDivElement
    const sourceIndex = dragIndexRef.current
    dragIndexRef.current = null
    if (sourceIndex === null) {
      return
    }

    const updatedAssistants = [...assistants]
    const [moved] = updatedAssistants.splice(sourceIndex, 1)
    if (!moved) {
      return
    }

    const rect = event.currentTarget.getBoundingClientRect()
    const dropAfter = event.clientY - rect.top > rect.height / 2

    let insertIndex = targetGlobalIndex + (dropAfter ? 1 : 0)
    if (sourceIndex < insertIndex) {
      insertIndex -= 1
    }
    if (insertIndex < 0) {
      insertIndex = 0
    }
    if (insertIndex > updatedAssistants.length) {
      insertIndex = updatedAssistants.length
    }

    updatedAssistants.splice(insertIndex, 0, moved)

    handleSaveAssistants(updatedAssistants)
      .then(() => {
        triggerDropSuccess(moved.id)
      })
      .catch((error: unknown) => {
        console.error('Failed to reorder assistants', error)
      })
      .finally(() => {
        itemEl?.classList.remove(
          'smtcmp-assistant-item-drag-over-before',
          'smtcmp-assistant-item-drag-over-after',
        )
        const dragging = document.querySelector(
          '.smtcmp-assistant-item-dragging',
        )
        if (dragging)
          dragging.classList.remove('smtcmp-assistant-item-dragging')
        const activeHandle = document.querySelector(
          '.smtcmp-drag-handle.smtcmp-drag-handle--active',
        )
        if (activeHandle)
          activeHandle.classList.remove('smtcmp-drag-handle--active')

        dragOverItemRef.current = null
        lastDropPosRef.current = null
        lastInsertIndexRef.current = null
      })
  }

  return (
    <div className="smtcmp-settings-section">
      <ObsidianSetting
        name={t('settings.assistants.title')}
        desc={t('settings.assistants.desc')}
      >
        <ObsidianButton
          text={t('settings.assistants.addAssistant')}
          onClick={handleAddAssistant}
        />
      </ObsidianSetting>

      {/* Add new assistant form */}
      {isAddingAssistant && editingAssistant && (
        <div className="smtcmp-assistant-editor smtcmp-assistant-editor-new">
          <ObsidianSetting
            name={t('settings.assistants.name', 'Name')}
            desc={t('settings.assistants.nameDesc', 'Assistant name')}
          >
            <ObsidianTextInput
              value={editingAssistant.name}
              placeholder={t(
                'settings.assistants.namePlaceholder',
                'Enter assistant name',
              )}
              onChange={(value) =>
                setEditingAssistant({ ...editingAssistant, name: value })
              }
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.assistants.description', 'Description')}
            desc={t(
              'settings.assistants.descriptionDesc',
              'Brief description of what this assistant does',
            )}
          >
            <ObsidianTextInput
              value={editingAssistant.description || ''}
              placeholder={t(
                'settings.assistants.descriptionPlaceholder',
                'Enter description',
              )}
              onChange={(value) =>
                setEditingAssistant({ ...editingAssistant, description: value })
              }
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.assistants.systemPrompt', 'System prompt')}
            desc={t(
              'settings.assistants.systemPromptDesc',
              'This prompt will be added to the beginning of every chat.',
            )}
            className="smtcmp-settings-textarea-header"
          />
          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={editingAssistant.systemPrompt || ''}
              onChange={(value) =>
                setEditingAssistant({
                  ...editingAssistant,
                  systemPrompt: value,
                })
              }
              placeholder={t(
                'settings.assistants.systemPromptPlaceholder',
                "Enter system prompt to define assistant's behavior and capabilities",
              )}
            />
          </ObsidianSetting>

          <div className="smtcmp-assistant-editor-buttons">
            <ObsidianButton
              text={t('common.save', 'Save')}
              onClick={() => void handleSaveAssistant()}
              cta
              disabled={
                !editingAssistant.name || !editingAssistant.systemPrompt
              }
            />
            <ObsidianButton
              text={t('common.cancel', 'Cancel')}
              onClick={() => {
                setEditingAssistant(null)
                setIsAddingAssistant(false)
              }}
            />
          </div>
        </div>
      )}

      {assistants.length === 0 ? (
        <div className="smtcmp-no-assistants">
          <p className="smtcmp-no-assistants-text">
            {t('settings.assistants.noAssistants')}
          </p>
        </div>
      ) : (
        <div className="smtcmp-assistants-list">
          {assistants.map((assistant, index) => {
            const isEditing =
              !isAddingAssistant && editingAssistant?.id === assistant.id
            const isActive = settings.currentAssistantId === assistant.id

            return (
              <React.Fragment key={assistant.id}>
                <div
                  data-assistant-id={assistant.id}
                  className={`smtcmp-assistant-item ${isEditing ? 'editing' : ''} ${isActive ? 'active' : ''}`}
                  draggable={!isEditing}
                  onDragStart={(event) => handleDragStart(event, index)}
                  onDragOver={(event) => handleDragOver(event, index)}
                  onDrop={(event) => handleDrop(event, index)}
                  onDragEnd={handleDragEnd}
                >
                  <div className="smtcmp-assistant-drag-handle">
                    <span
                      className="smtcmp-drag-handle"
                      aria-label={t(
                        'settings.assistants.dragHandleAria',
                        'Drag to reorder',
                      )}
                    >
                      <GripVertical size={16} />
                    </span>
                  </div>
                  <div className="smtcmp-assistant-content">
                    <div className="smtcmp-assistant-header">
                      <div className="smtcmp-assistant-icon">
                        <Bot size={16} />
                      </div>
                      <div className="smtcmp-assistant-info">
                        <div className="smtcmp-assistant-name">
                          {assistant.name}
                          {isActive && (
                            <span className="smtcmp-assistant-badge">
                              {t('settings.assistants.currentBadge', 'Current')}
                            </span>
                          )}
                        </div>
                        {assistant.description && (
                          <div className="smtcmp-assistant-description">
                            {assistant.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="smtcmp-assistant-controls">
                    <ObsidianButton
                      onClick={() => {
                        if (isEditing) {
                          setEditingAssistant(null)
                        } else {
                          setEditingAssistant(assistant)
                          setIsAddingAssistant(false)
                        }
                      }}
                      icon={isEditing ? 'x' : 'pencil'}
                      tooltip={
                        isEditing
                          ? t('common.cancel', 'Cancel')
                          : t('common.edit', 'Edit')
                      }
                    />
                    <ObsidianButton
                      onClick={() => void handleDuplicateAssistant(assistant)}
                      icon="copy"
                      tooltip={t('settings.assistants.duplicate', 'Duplicate')}
                    />
                    <ObsidianButton
                      onClick={() => void handleDeleteAssistant(assistant.id)}
                      icon="trash-2"
                      tooltip={t('common.delete', 'Delete')}
                    />
                  </div>
                </div>

                {/* Inline edit form */}
                {isEditing && (
                  <div className="smtcmp-assistant-editor smtcmp-assistant-editor-inline">
                    <ObsidianSetting
                      name={t('settings.assistants.name', 'Name')}
                      desc={t('settings.assistants.nameDesc', 'Assistant name')}
                    >
                      <ObsidianTextInput
                        value={editingAssistant.name}
                        placeholder={t(
                          'settings.assistants.namePlaceholder',
                          'Enter assistant name',
                        )}
                        onChange={(value) =>
                          setEditingAssistant({
                            ...editingAssistant,
                            name: value,
                          })
                        }
                      />
                    </ObsidianSetting>

                    <ObsidianSetting
                      name={t('settings.assistants.description', 'Description')}
                      desc={t(
                        'settings.assistants.descriptionDesc',
                        'Brief description of what this assistant does',
                      )}
                    >
                      <ObsidianTextInput
                        value={editingAssistant.description || ''}
                        placeholder={t(
                          'settings.assistants.descriptionPlaceholder',
                          'Enter description',
                        )}
                        onChange={(value) =>
                          setEditingAssistant({
                            ...editingAssistant,
                            description: value,
                          })
                        }
                      />
                    </ObsidianSetting>

                    <ObsidianSetting
                      name={t(
                        'settings.assistants.systemPrompt',
                        'System prompt',
                      )}
                      desc={t(
                        'settings.assistants.systemPromptDesc',
                        'This prompt will be added to the beginning of every chat.',
                      )}
                      className="smtcmp-settings-textarea-header"
                    />
                    <ObsidianSetting className="smtcmp-settings-textarea">
                      <ObsidianTextArea
                        value={editingAssistant.systemPrompt || ''}
                        onChange={(value) =>
                          setEditingAssistant({
                            ...editingAssistant,
                            systemPrompt: value,
                          })
                        }
                        placeholder={t(
                          'settings.assistants.systemPromptPlaceholder',
                          "Enter system prompt to define assistant's behavior and capabilities",
                        )}
                      />
                    </ObsidianSetting>

                    <div className="smtcmp-assistant-editor-buttons">
                      <ObsidianButton
                        text={t('common.save', 'Save')}
                        onClick={() => void handleSaveAssistant()}
                        cta
                        disabled={
                          !editingAssistant.name ||
                          !editingAssistant.systemPrompt
                        }
                      />
                      <ObsidianButton
                        text={t('common.cancel', 'Cancel')}
                        onClick={() => {
                          setEditingAssistant(null)
                        }}
                      />
                    </div>
                  </div>
                )}
              </React.Fragment>
            )
          })}
        </div>
      )}
    </div>
  )
}
