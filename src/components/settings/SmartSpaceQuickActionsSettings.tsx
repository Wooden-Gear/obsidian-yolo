import {
  Brain,
  FileText,
  Lightbulb,
  ListTodo,
  MessageCircle,
  PenLine,
  Settings,
  Sparkles,
  Table,
  Workflow,
} from 'lucide-react'
import React, { useState } from 'react'

import { useLanguage } from '../../contexts/language-context'
import { useSettings } from '../../contexts/settings-context'
import { ObsidianButton } from '../common/ObsidianButton'
import { ObsidianDropdown } from '../common/ObsidianDropdown'
import { ObsidianSetting } from '../common/ObsidianSetting'
import { ObsidianTextInput } from '../common/ObsidianTextInput'
import { ObsidianTextArea } from '../common/ObsidianTextArea'
import { ObsidianToggle } from '../common/ObsidianToggle'

// Available icons mapping
const ICON_OPTIONS = {
  sparkles: { component: Sparkles, label: 'Sparkles' },
  filetext: { component: FileText, label: 'File' },
  listtodo: { component: ListTodo, label: 'Todo' },
  workflow: { component: Workflow, label: 'Workflow' },
  table: { component: Table, label: 'Table' },
  penline: { component: PenLine, label: 'Pen' },
  lightbulb: { component: Lightbulb, label: 'Lightbulb' },
  brain: { component: Brain, label: 'Brain' },
  messagecircle: { component: MessageCircle, label: 'Message' },
  settings: { component: Settings, label: 'Settings' },
}

const CATEGORY_OPTIONS = {
  suggestions: '建议',
  writing: '撰写',
  thinking: '思考 · 询问 · 对话',
  custom: '自定义',
}

type QuickAction = {
  id: string
  label: string
  instruction: string
  icon?: string
  category?: 'suggestions' | 'writing' | 'thinking' | 'custom'
  enabled: boolean
}

// Generate unique ID
const generateId = () => {
  return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

const getDefaultQuickActions = (t: any): QuickAction[] => {
    return [
      {
        id: 'continue',
        label: t('chat.customContinueSections.suggestions.items.continue.label', '继续编写'),
        instruction: t('chat.customContinueSections.suggestions.items.continue.instruction', '请继续扩展当前段落，保持原有语气与风格。'),
        icon: 'sparkles',
        category: 'suggestions',
        enabled: true,
      },
      {
        id: 'summarize',
        label: t('chat.customContinueSections.writing.items.summarize.label', '添加摘要'),
        instruction: t('chat.customContinueSections.writing.items.summarize.instruction', '请为当前内容写一个简洁摘要。'),
        icon: 'filetext',
        category: 'writing',
        enabled: true,
      },
      {
        id: 'todo',
        label: t('chat.customContinueSections.writing.items.todo.label', '添加待办事项'),
        instruction: t('chat.customContinueSections.writing.items.todo.instruction', '请基于当前内容整理一个可执行的待办清单。'),
        icon: 'listtodo',
        category: 'writing',
        enabled: true,
      },
      {
        id: 'flowchart',
        label: t('chat.customContinueSections.writing.items.flowchart.label', '制作流程图'),
        instruction: t('chat.customContinueSections.writing.items.flowchart.instruction', '请将当前要点整理成流程图或分步骤说明。'),
        icon: 'workflow',
        category: 'writing',
        enabled: true,
      },
      {
        id: 'table',
        label: t('chat.customContinueSections.writing.items.table.label', '制作表格'),
        instruction: t('chat.customContinueSections.writing.items.table.instruction', '请把当前信息整理成表格，并给出合适的列标题。'),
        icon: 'table',
        category: 'writing',
        enabled: true,
      },
      {
        id: 'freewrite',
        label: t('chat.customContinueSections.writing.items.freewrite.label', '随心写作'),
        instruction: t('chat.customContinueSections.writing.items.freewrite.instruction', '请结合上下文自由发挥，继续创作新的段落。'),
        icon: 'penline',
        category: 'writing',
        enabled: true,
      },
      {
        id: 'brainstorm',
        label: t('chat.customContinueSections.thinking.items.brainstorm.label', '头脑风暴'),
        instruction: t('chat.customContinueSections.thinking.items.brainstorm.instruction', '请给出若干新的灵感或切入点。'),
        icon: 'lightbulb',
        category: 'thinking',
        enabled: true,
      },
      {
        id: 'analyze',
        label: t('chat.customContinueSections.thinking.items.analyze.label', '分析重点'),
        instruction: t('chat.customContinueSections.thinking.items.analyze.instruction', '请简要分析当前内容的要点、风险或机会。'),
        icon: 'brain',
        category: 'thinking',
        enabled: true,
      },
      {
        id: 'dialogue',
        label: t('chat.customContinueSections.thinking.items.dialogue.label', '提出追问'),
        instruction: t('chat.customContinueSections.thinking.items.dialogue.instruction', '请给出一些深入讨论的追问。'),
        icon: 'messagecircle',
        category: 'thinking',
        enabled: true,
      },
    ]
  }

export function SmartSpaceQuickActionsSettings() {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()
  const [editingAction, setEditingAction] = useState<QuickAction | null>(null)
  const [isAddingAction, setIsAddingAction] = useState(false)

  // Get current quick actions, or use default ones if not customized
  const quickActions = settings.continuationOptions.smartSpaceQuickActions || getDefaultQuickActions(t)

  const handleSaveActions = async (newActions: QuickAction[]) => {
    await setSettings({
      ...settings,
      continuationOptions: {
        ...settings.continuationOptions,
        smartSpaceQuickActions: newActions,
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
      newActions = [...quickActions, editingAction]
    } else {
      newActions = quickActions.map(action =>
        action.id === editingAction.id ? editingAction : action
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
      label: `${action.label} (副本)`,
    }
    const newActions = [...quickActions, newAction]
    await handleSaveActions(newActions)
  }

  const handleMoveAction = async (id: string, direction: 'up' | 'down') => {
    const index = quickActions.findIndex(action => action.id === id)
    if (index === -1) return

    const newActions = [...quickActions]
    if (direction === 'up' && index > 0) {
      ;[newActions[index], newActions[index - 1]] = [newActions[index - 1], newActions[index]]
    } else if (direction === 'down' && index < newActions.length - 1) {
      ;[newActions[index], newActions[index + 1]] = [newActions[index + 1], newActions[index]]
    }

    await handleSaveActions(newActions)
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

      {/* Edit/Add Dialog */}
      {editingAction && (
        <div className="smtcmp-quick-action-editor">
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
              options={CATEGORY_OPTIONS}
              onChange={(value) => setEditingAction({ ...editingAction, category: value as any })}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.smartSpace.actionIcon', '图标')}
            desc={t('settings.smartSpace.actionIconDesc', '选择一个图标')}
          >
            <ObsidianDropdown
              value={editingAction.icon || 'sparkles'}
              options={Object.fromEntries(
                Object.entries(ICON_OPTIONS).map(([key, value]) => [key, value.label])
              )}
              onChange={(value) => setEditingAction({ ...editingAction, icon: value })}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.smartSpace.actionEnabled', '启用')}
            desc={t('settings.smartSpace.actionEnabledDesc', '是否在 Smart Space 中显示此选项')}
          >
            <ObsidianToggle
              value={editingAction.enabled}
              onChange={(value) => setEditingAction({ ...editingAction, enabled: value })}
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

          return (
            <div
              key={action.id}
              className={`smtcmp-quick-action-item ${!action.enabled ? 'disabled' : ''}`}
            >
              <div className="smtcmp-quick-action-content">
                <div className="smtcmp-quick-action-header">
                  <IconComponent size={16} className="smtcmp-quick-action-icon" />
                  <span className="smtcmp-quick-action-label">{action.label}</span>
                  <span className={`smtcmp-quick-action-category category-${action.category}`}>
                    {CATEGORY_OPTIONS[action.category || 'custom']}
                  </span>
                  {!action.enabled && (
                    <span className="smtcmp-quick-action-disabled-badge">
                      {t('settings.smartSpace.disabled', '已禁用')}
                    </span>
                  )}
                </div>
                <div className="smtcmp-quick-action-instruction">
                  {action.instruction}
                </div>
              </div>
              <div className="smtcmp-quick-action-controls">
                <ObsidianButton
                  onClick={() => handleMoveAction(action.id, 'up')}
                  disabled={index === 0}
                  icon="chevron-up"
                  tooltip={t('settings.smartSpace.moveUp', '上移')}
                />
                <ObsidianButton
                  onClick={() => handleMoveAction(action.id, 'down')}
                  disabled={index === quickActions.length - 1}
                  icon="chevron-down"
                  tooltip={t('settings.smartSpace.moveDown', '下移')}
                />
                <ObsidianButton
                  onClick={() => setEditingAction(action)}
                  icon="pencil"
                  tooltip={t('common.edit', '编辑')}
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
          )
        })}
      </div>
    </div>
  )
}
