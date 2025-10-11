import {
  Brain,
  FileText,
  GripVertical,
  Lightbulb,
  ListTodo,
  MessageCircle,
  PenLine,
  Settings,
  Sparkles,
  Table,
  Workflow,
} from 'lucide-react'
import React, { useMemo, useState, useRef, type DragEvent } from 'react'

import { useLanguage } from '../../contexts/language-context'
import { useSettings } from '../../contexts/settings-context'
import { ObsidianButton } from '../common/ObsidianButton'
import { ObsidianDropdown } from '../common/ObsidianDropdown'
import { ObsidianSetting } from '../common/ObsidianSetting'
import { ObsidianTextInput } from '../common/ObsidianTextInput'
import { ObsidianTextArea } from '../common/ObsidianTextArea'

type QuickAction = {
  id: string
  label: string
  instruction: string
  icon?: string
  category?: 'suggestions' | 'writing' | 'thinking' | 'custom'
  enabled: boolean
}

// Available icons mapping
const ICON_OPTIONS = {
  sparkles: {
    component: Sparkles,
    labelKey: 'settings.smartSpace.iconLabels.sparkles',
    fallback: 'Sparkles',
  },
  filetext: {
    component: FileText,
    labelKey: 'settings.smartSpace.iconLabels.file',
    fallback: 'File',
  },
  listtodo: {
    component: ListTodo,
    labelKey: 'settings.smartSpace.iconLabels.todo',
    fallback: 'Todo',
  },
  workflow: {
    component: Workflow,
    labelKey: 'settings.smartSpace.iconLabels.workflow',
    fallback: 'Workflow',
  },
  table: {
    component: Table,
    labelKey: 'settings.smartSpace.iconLabels.table',
    fallback: 'Table',
  },
  penline: {
    component: PenLine,
    labelKey: 'settings.smartSpace.iconLabels.pen',
    fallback: 'Pen',
  },
  lightbulb: {
    component: Lightbulb,
    labelKey: 'settings.smartSpace.iconLabels.lightbulb',
    fallback: 'Lightbulb',
  },
  brain: {
    component: Brain,
    labelKey: 'settings.smartSpace.iconLabels.brain',
    fallback: 'Brain',
  },
  messagecircle: {
    component: MessageCircle,
    labelKey: 'settings.smartSpace.iconLabels.message',
    fallback: 'Message',
  },
  settings: {
    component: Settings,
    labelKey: 'settings.smartSpace.iconLabels.settings',
    fallback: 'Settings',
  },
}

type DefaultActionConfig = {
  id: string
  icon: string
  category: QuickAction['category']
  labelKey: string
  labelFallback: string
  instructionKey: string
  instructionFallback: string
}

const DEFAULT_ACTION_CONFIGS: DefaultActionConfig[] = [
  {
    id: 'continue',
    icon: 'sparkles',
    category: 'suggestions',
    labelKey: 'chat.customContinueSections.suggestions.items.continue.label',
    labelFallback: '继续编写',
    instructionKey:
      'chat.customContinueSections.suggestions.items.continue.instruction',
    instructionFallback: '请继续扩展当前段落，保持原有语气与风格。',
  },
  {
    id: 'summarize',
    icon: 'filetext',
    category: 'writing',
    labelKey: 'chat.customContinueSections.writing.items.summarize.label',
    labelFallback: '添加摘要',
    instructionKey:
      'chat.customContinueSections.writing.items.summarize.instruction',
    instructionFallback: '请为当前内容写一个简洁摘要。',
  },
  {
    id: 'todo',
    icon: 'listtodo',
    category: 'writing',
    labelKey: 'chat.customContinueSections.writing.items.todo.label',
    labelFallback: '添加待办事项',
    instructionKey:
      'chat.customContinueSections.writing.items.todo.instruction',
    instructionFallback: '请基于当前内容整理一个可执行的待办清单。',
  },
  {
    id: 'flowchart',
    icon: 'workflow',
    category: 'writing',
    labelKey: 'chat.customContinueSections.writing.items.flowchart.label',
    labelFallback: '制作流程图',
    instructionKey:
      'chat.customContinueSections.writing.items.flowchart.instruction',
    instructionFallback: '请将当前要点整理成流程图或分步骤说明。',
  },
  {
    id: 'table',
    icon: 'table',
    category: 'writing',
    labelKey: 'chat.customContinueSections.writing.items.table.label',
    labelFallback: '制作表格',
    instructionKey:
      'chat.customContinueSections.writing.items.table.instruction',
    instructionFallback: '请把当前信息整理成表格，并给出合适的列标题。',
  },
  {
    id: 'freewrite',
    icon: 'penline',
    category: 'writing',
    labelKey: 'chat.customContinueSections.writing.items.freewrite.label',
    labelFallback: '随心写作',
    instructionKey:
      'chat.customContinueSections.writing.items.freewrite.instruction',
    instructionFallback: '请结合上下文自由发挥，继续创作新的段落。',
  },
  {
    id: 'brainstorm',
    icon: 'lightbulb',
    category: 'thinking',
    labelKey: 'chat.customContinueSections.thinking.items.brainstorm.label',
    labelFallback: '头脑风暴',
    instructionKey:
      'chat.customContinueSections.thinking.items.brainstorm.instruction',
    instructionFallback: '请给出若干新的灵感或切入点。',
  },
  {
    id: 'analyze',
    icon: 'brain',
    category: 'thinking',
    labelKey: 'chat.customContinueSections.thinking.items.analyze.label',
    labelFallback: '分析重点',
    instructionKey:
      'chat.customContinueSections.thinking.items.analyze.instruction',
    instructionFallback: '请简要分析当前内容的要点、风险或机会。',
  },
  {
    id: 'dialogue',
    icon: 'messagecircle',
    category: 'thinking',
    labelKey: 'chat.customContinueSections.thinking.items.dialogue.label',
    labelFallback: '提出追问',
    instructionKey:
      'chat.customContinueSections.thinking.items.dialogue.instruction',
    instructionFallback: '请给出一些深入讨论的追问。',
  },
]

const DEFAULT_ACTION_LOOKUP: Record<string, DefaultActionConfig> =
  Object.fromEntries(DEFAULT_ACTION_CONFIGS.map((config) => [config.id, config]))

// Generate unique ID
const generateId = () => {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const getDefaultQuickActions = (t: any): QuickAction[] => {
  return DEFAULT_ACTION_CONFIGS.map((config) => ({
    id: config.id,
    label: t(config.labelKey, config.labelFallback),
    instruction: t(config.instructionKey, config.instructionFallback),
    icon: config.icon,
    category: config.category,
    enabled: true,
  }))
}

export function SmartSpaceQuickActionsSettings() {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()
  const categoryOptions = useMemo(
    () => ({
      suggestions: t('settings.smartSpace.categories.suggestions', '建议'),
      writing: t('settings.smartSpace.categories.writing', '撰写'),
      thinking: t(
        'settings.smartSpace.categories.thinking',
        '思考 · 询问 · 对话',
      ),
      custom: t('settings.smartSpace.categories.custom', '自定义'),
    }),
    [t],
  )
  const iconOptions = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(ICON_OPTIONS).map(([key, value]) => [
          key,
          t(value.labelKey, value.fallback),
        ]),
      ),
    [t],
  )
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null)
  const [isAddingAction, setIsAddingAction] = useState(false)
  const dragIndexRef = useRef<number | null>(null)
  const dragOverItemRef = useRef<HTMLDivElement | null>(null)
  const lastDropPosRef = useRef<'before' | 'after' | null>(null)
  const lastInsertIndexRef = useRef<number | null>(null)

  // Get current quick actions, or use default ones if not customized
  const quickActions = (
    settings.continuationOptions.smartSpaceQuickActions ||
    getDefaultQuickActions(t)
  ).map((action) => {
    const config = DEFAULT_ACTION_LOOKUP[action.id]
    let label = action.label
    let instruction = action.instruction

    if (config) {
      const localizedLabel = t(config.labelKey, config.labelFallback)
      const localizedInstruction = t(
        config.instructionKey,
        config.instructionFallback,
      )

      if (
        label === config.labelFallback ||
        label === localizedLabel ||
        !label
      ) {
        label = localizedLabel
      }

      if (
        instruction === config.instructionFallback ||
        instruction === localizedInstruction ||
        !instruction
      ) {
        instruction = localizedInstruction
      }
    }

    return {
      ...action,
      label,
      instruction,
      enabled: true,
    }
  })

  const handleSaveActions = async (newActions: QuickAction[]) => {
    await setSettings({
      ...settings,
      continuationOptions: {
        ...settings.continuationOptions,
        smartSpaceQuickActions: newActions.map((action) => ({
          ...action,
          enabled: true,
        })),
      },
    })
  }

  const handleAddAction = () => {
    const newAction: QuickAction = {
      id: generateId(),
      label: '',
      instruction: '',
      icon: 'sparkles',
      category: 'custom',
      enabled: true,
    }
    setEditingAction(newAction)
    setIsAddingAction(true)
  }

  const handleSaveAction = async () => {
    if (!editingAction || !editingAction.label || !editingAction.instruction) {
      return
    }

    let newActions: QuickAction[]
    if (isAddingAction) {
      newActions = [...quickActions, { ...editingAction, enabled: true }]
    } else {
      newActions = quickActions.map(action =>
        action.id === editingAction.id
          ? { ...editingAction, enabled: true }
          : { ...action, enabled: true }
      )
    }

    await handleSaveActions(newActions)
    setEditingAction(null)
    setIsAddingAction(false)
  }

  const handleDeleteAction = async (id: string) => {
    const newActions = quickActions.filter(action => action.id !== id)
    await handleSaveActions(newActions)
  }

  const handleDuplicateAction = async (action: QuickAction) => {
    const newAction = {
      ...action,
      id: generateId(),
      label: `${action.label}${t('settings.smartSpace.copySuffix', ' (副本)')}`,
      enabled: true,
    }
    const newActions = [...quickActions, newAction]
    await handleSaveActions(newActions)
  }

  const triggerDropSuccess = (movedId: string) => {
    const tryFind = (attempt = 0) => {
      const movedItem = document.querySelector(`div[data-action-id="${movedId}"]`)
      if (movedItem) {
        movedItem.classList.add('smtcmp-quick-action-drop-success')
        window.setTimeout(() => {
          movedItem.classList.remove('smtcmp-quick-action-drop-success')
        }, 700)
      } else if (attempt < 8) {
        window.setTimeout(() => tryFind(attempt + 1), 50)
      }
    }
    requestAnimationFrame(() => tryFind())
  }

  const handleDragStart = (event: DragEvent<HTMLDivElement>, index: number) => {
    dragIndexRef.current = index
    event.dataTransfer?.setData('text/plain', quickActions[index]?.id ?? '')
    event.dataTransfer.effectAllowed = 'move'

    const item = event.currentTarget
    item.classList.add('smtcmp-quick-action-dragging')
    const handle = item.querySelector('.smtcmp-drag-handle')
    if (handle) handle.classList.add('smtcmp-drag-handle--active')
  }

  const handleDragOver = (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault()

    const item = event.currentTarget
    const rect = item.getBoundingClientRect()
    const rel = (event.clientY - rect.top) / rect.height

    if (dragIndexRef.current === targetIndex) {
      item.classList.remove('smtcmp-quick-action-drag-over-before', 'smtcmp-quick-action-drag-over-after')
      if (dragOverItemRef.current && dragOverItemRef.current !== item) {
        dragOverItemRef.current.classList.remove('smtcmp-quick-action-drag-over-before', 'smtcmp-quick-action-drag-over-after')
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
    let insertIndex = targetIndex
    if (dropAfter) insertIndex += 1
    if (sourceIndex < targetIndex) insertIndex -= 1

    if (lastInsertIndexRef.current === insertIndex) {
      return
    }

    if (dragOverItemRef.current) {
      dragOverItemRef.current.classList.remove('smtcmp-quick-action-drag-over-before', 'smtcmp-quick-action-drag-over-after')
    }

    const desiredClass = dropAfter ? 'smtcmp-quick-action-drag-over-after' : 'smtcmp-quick-action-drag-over-before'
    item.classList.remove('smtcmp-quick-action-drag-over-before', 'smtcmp-quick-action-drag-over-after')
    item.classList.add(desiredClass)
    dragOverItemRef.current = item
    lastDropPosRef.current = dropAfter ? 'after' : 'before'
    lastInsertIndexRef.current = insertIndex
  }

  const handleDragEnd = () => {
    dragIndexRef.current = null
    if (dragOverItemRef.current) {
      dragOverItemRef.current.classList.remove('smtcmp-quick-action-drag-over-before', 'smtcmp-quick-action-drag-over-after')
      dragOverItemRef.current = null
    }
    lastDropPosRef.current = null
    lastInsertIndexRef.current = null
    const dragging = document.querySelector('.smtcmp-quick-action-dragging')
    if (dragging) dragging.classList.remove('smtcmp-quick-action-dragging')
    const activeHandle = document.querySelector('.smtcmp-drag-handle.smtcmp-drag-handle--active')
    if (activeHandle) activeHandle.classList.remove('smtcmp-drag-handle--active')
  }

  const handleDrop = async (event: DragEvent<HTMLDivElement>, targetIndex: number) => {
    event.preventDefault()
    const itemEl = event.currentTarget as HTMLDivElement
    const sourceIndex = dragIndexRef.current
    dragIndexRef.current = null
    if (sourceIndex === null) {
      return
    }

    const updatedActions = [...quickActions]
    const [moved] = updatedActions.splice(sourceIndex, 1)
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
    if (insertIndex > updatedActions.length) {
      insertIndex = updatedActions.length
    }
    updatedActions.splice(insertIndex, 0, moved)

    await handleSaveActions(updatedActions)

    itemEl?.classList.remove('smtcmp-quick-action-drag-over-before', 'smtcmp-quick-action-drag-over-after')
    const dragging = document.querySelector('.smtcmp-quick-action-dragging')
    if (dragging) dragging.classList.remove('smtcmp-quick-action-dragging')
    const activeHandle = document.querySelector('.smtcmp-drag-handle.smtcmp-drag-handle--active')
    if (activeHandle) activeHandle.classList.remove('smtcmp-drag-handle--active')

    dragOverItemRef.current = null
    lastDropPosRef.current = null
    lastInsertIndexRef.current = null

    triggerDropSuccess(moved.id)
  }

  const handleResetToDefault = async () => {
    if (confirm(t('settings.smartSpace.confirmReset', '确定要恢复默认的快捷选项吗？这将删除所有自定义设置。'))) {
      await setSettings({
        ...settings,
        continuationOptions: {
          ...settings.continuationOptions,
          smartSpaceQuickActions: undefined,
        },
      })
    }
  }

  return (
    <div className="smtcmp-smart-space-settings">
      <ObsidianSetting
        name={t('settings.smartSpace.quickActionsTitle', 'Smart Space 快捷选项')}
        desc={t('settings.smartSpace.quickActionsDesc', '自定义 Smart Space 中显示的快捷选项和提示词')}
      >
        <ObsidianButton
          text={t('settings.smartSpace.addAction', '添加选项')}
          onClick={handleAddAction}
        />
        <ObsidianButton
          text={t('settings.smartSpace.resetToDefault', '恢复默认')}
          onClick={handleResetToDefault}
        />
      </ObsidianSetting>

      {/* Add new action form (shown at top when adding) */}
      {isAddingAction && editingAction && (
        <div className="smtcmp-quick-action-editor smtcmp-quick-action-editor-new">
          <ObsidianSetting
            name={t('settings.smartSpace.actionLabel', '选项名称')}
            desc={t('settings.smartSpace.actionLabelDesc', '显示在快捷选项中的文本')}
          >
            <ObsidianTextInput
              value={editingAction.label}
              placeholder={t('settings.smartSpace.actionLabelPlaceholder', '例如：继续编写')}
              onChange={(value) => setEditingAction({ ...editingAction, label: value })}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.smartSpace.actionInstruction', '提示词')}
            desc={t('settings.smartSpace.actionInstructionDesc', '发送给 AI 的指令')}
            className="smtcmp-settings-textarea-header"
          />
          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={editingAction.instruction}
              placeholder={t('settings.smartSpace.actionInstructionPlaceholder', '例如：请继续扩展当前段落，保持原有语气与风格。')}
              onChange={(value) => setEditingAction({ ...editingAction, instruction: value })}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.smartSpace.actionCategory', '分类')}
            desc={t('settings.smartSpace.actionCategoryDesc', '选项所属的分类')}
          >
            <ObsidianDropdown
              value={editingAction.category || 'custom'}
              options={categoryOptions}
              onChange={(value) => setEditingAction({ ...editingAction, category: value as any })}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.smartSpace.actionIcon', '图标')}
            desc={t('settings.smartSpace.actionIconDesc', '选择一个图标')}
          >
            <ObsidianDropdown
              value={editingAction.icon || 'sparkles'}
              options={iconOptions}
              onChange={(value) => setEditingAction({ ...editingAction, icon: value })}
            />
          </ObsidianSetting>

          <div className="smtcmp-quick-action-editor-buttons">
            <ObsidianButton
              text={t('common.save', '保存')}
              onClick={handleSaveAction}
              cta
              disabled={!editingAction.label || !editingAction.instruction}
            />
            <ObsidianButton
              text={t('common.cancel', '取消')}
              onClick={() => {
                setEditingAction(null)
                setIsAddingAction(false)
              }}
            />
          </div>
        </div>
      )}

      {/* Quick Actions List */}
      <div className="smtcmp-quick-actions-list">
        {quickActions.map((action, index) => {
          const IconComponent = ICON_OPTIONS[action.icon as keyof typeof ICON_OPTIONS]?.component || Sparkles

          const isEditing = !isAddingAction && editingAction?.id === action.id

          return (
            <React.Fragment key={action.id}>
              <div
                data-action-id={action.id}
                className={`smtcmp-quick-action-item ${isEditing ? 'editing' : ''}`}
                draggable={!isEditing}
                onDragStart={(event) => handleDragStart(event, index)}
                onDragOver={(event) => handleDragOver(event, index)}
                onDrop={(event) => void handleDrop(event, index)}
                onDragEnd={handleDragEnd}
              >
                <div className="smtcmp-quick-action-drag-handle">
                  <span
                    className="smtcmp-drag-handle"
                    aria-label={t('settings.smartSpace.dragHandleAria', '拖拽排序')}
                  >
                    <GripVertical size={16} />
                  </span>
                </div>
                <div className="smtcmp-quick-action-content">
                  <div className="smtcmp-quick-action-header">
                    <IconComponent size={16} className="smtcmp-quick-action-icon" />
                    <span className="smtcmp-quick-action-label">{action.label}</span>
                    <span className={`smtcmp-quick-action-category category-${action.category}`}>
                      {categoryOptions[action.category || 'custom']}
                    </span>
                  </div>
                </div>
                <div className="smtcmp-quick-action-controls">
                  <ObsidianButton
                    onClick={() => {
                      if (isEditing) {
                        setEditingAction(null)
                      } else {
                        setEditingAction(action)
                        setIsAddingAction(false)
                      }
                    }}
                    icon={isEditing ? 'x' : 'pencil'}
                    tooltip={isEditing ? t('common.cancel', '取消') : t('common.edit', '编辑')}
                  />
                  <ObsidianButton
                    onClick={() => handleDuplicateAction(action)}
                    icon="copy"
                    tooltip={t('settings.smartSpace.duplicate', '复制')}
                  />
                  <ObsidianButton
                    onClick={() => handleDeleteAction(action.id)}
                    icon="trash-2"
                    tooltip={t('common.delete', '删除')}
                  />
                </div>
              </div>

              {/* Inline edit form */}
              {isEditing && (
                <div className="smtcmp-quick-action-editor smtcmp-quick-action-editor-inline">
                  <ObsidianSetting
                    name={t('settings.smartSpace.actionLabel', '选项名称')}
                    desc={t('settings.smartSpace.actionLabelDesc', '显示在快捷选项中的文本')}
                  >
                    <ObsidianTextInput
                      value={editingAction.label}
                      placeholder={t('settings.smartSpace.actionLabelPlaceholder', '例如：继续编写')}
                      onChange={(value) => setEditingAction({ ...editingAction, label: value })}
                    />
                  </ObsidianSetting>

                  <ObsidianSetting
                    name={t('settings.smartSpace.actionInstruction', '提示词')}
                    desc={t('settings.smartSpace.actionInstructionDesc', '发送给 AI 的指令')}
                    className="smtcmp-settings-textarea-header"
                  />
                  <ObsidianSetting className="smtcmp-settings-textarea">
                    <ObsidianTextArea
                      value={editingAction.instruction}
                      placeholder={t('settings.smartSpace.actionInstructionPlaceholder', '例如：请继续扩展当前段落，保持原有语气与风格。')}
                      onChange={(value) => setEditingAction({ ...editingAction, instruction: value })}
                    />
                  </ObsidianSetting>

                  <ObsidianSetting
                    name={t('settings.smartSpace.actionCategory', '分类')}
                    desc={t('settings.smartSpace.actionCategoryDesc', '选项所属的分类')}
                  >
                    <ObsidianDropdown
                      value={editingAction.category || 'custom'}
                      options={categoryOptions}
                      onChange={(value) => setEditingAction({ ...editingAction, category: value as any })}
                    />
                  </ObsidianSetting>

                  <ObsidianSetting
                    name={t('settings.smartSpace.actionIcon', '图标')}
                    desc={t('settings.smartSpace.actionIconDesc', '选择一个图标')}
                  >
                    <ObsidianDropdown
                      value={editingAction.icon || 'sparkles'}
                      options={iconOptions}
                      onChange={(value) => setEditingAction({ ...editingAction, icon: value })}
                    />
                  </ObsidianSetting>

                  <div className="smtcmp-quick-action-editor-buttons">
                    <ObsidianButton
                      text={t('common.save', '保存')}
                      onClick={handleSaveAction}
                      cta
                      disabled={!editingAction.label || !editingAction.instruction}
                    />
                    <ObsidianButton
                      text={t('common.cancel', '取消')}
                      onClick={() => {
                        setEditingAction(null)
                      }}
                    />
                  </div>
                </div>
              )}
            </React.Fragment>
          )
        })}
      </div>
    </div>
  )
}
