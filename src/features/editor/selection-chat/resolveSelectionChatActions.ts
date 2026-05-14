import type {
  SelectionActionMode,
  SelectionActionRewriteBehavior,
} from '../../../components/selection/SelectionActionsMenu'
import type { YoloSettings } from '../../../settings/schema/setting.types'

export type ResolvedSelectionChatAction = {
  id: string
  label: string
  instruction: string
  mode: SelectionActionMode
  rewriteBehavior?: SelectionActionRewriteBehavior
}

type TranslateFn = (key: string, fallback?: string) => string

type SelectionActionPreset = {
  id: string
  label: string
  instruction: string
  mode: SelectionActionMode
  rewriteBehavior?: SelectionActionRewriteBehavior
}

const FIXED_ACTION_IDS = new Set([
  'custom-rewrite',
  'custom-ask',
  'add-to-sidebar',
])

const resolveMode = (
  id: string,
  mode?: SelectionActionMode,
): SelectionActionMode => {
  if (mode) return mode
  if (id === 'rewrite' || id === 'custom-rewrite') return 'rewrite'
  if (id === 'chat-send') return 'chat-send'
  if (id === 'chat-input' || id === 'add-to-sidebar') return 'chat-input'
  return 'ask'
}

const resolveRewriteBehavior = (
  id: string,
  mode: SelectionActionMode,
  behavior?: SelectionActionRewriteBehavior,
): SelectionActionRewriteBehavior | undefined => {
  if (mode !== 'rewrite') return undefined
  if (behavior) return behavior
  return id === 'custom-rewrite' ? 'custom' : 'preset'
}

/**
 * Reproduces the action-resolution logic of SelectionActionsMenu without React.
 * Returns the same set of actions the in-editor popup would show, so registered
 * Obsidian commands stay in sync with the menu.
 */
export function resolveSelectionChatActions(
  settings: YoloSettings,
  t: TranslateFn,
): ResolvedSelectionChatAction[] {
  const defaultActions: SelectionActionPreset[] = [
    {
      id: 'custom-rewrite',
      label: t('selection.actions.customRewrite', '自定义改写'),
      instruction: '',
      mode: 'rewrite',
      rewriteBehavior: 'custom',
    },
    {
      id: 'custom-ask',
      label: t('selection.actions.customAsk', '自定义提问'),
      instruction: '',
      mode: 'ask',
    },
    {
      id: 'add-to-sidebar',
      label: t('selection.actions.addToSidebar', '添加到侧边栏'),
      instruction: '',
      mode: 'chat-input',
    },
    {
      id: 'explain',
      label: t('selection.actions.explain', '深入解释'),
      instruction: t('selection.actions.explain', '深入解释'),
      mode: 'ask',
    },
    {
      id: 'suggest',
      label: t('selection.actions.suggest', '提供建议'),
      instruction: t('selection.actions.suggest', '提供建议'),
      mode: 'ask',
    },
    {
      id: 'translate-to-chinese',
      label: t('selection.actions.translateToChinese', '翻译成中文'),
      instruction: t('selection.actions.translateToChinese', '翻译成中文'),
      mode: 'ask',
    },
  ]

  const customActions = settings.continuationOptions?.selectionChatActions
  const resolved: SelectionActionPreset[] = customActions
    ? customActions
        .filter((action) => action.enabled)
        .map((action) => ({
          id: action.id,
          label: action.label,
          instruction: action.instruction,
          mode: resolveMode(action.id, action.mode),
          rewriteBehavior: resolveRewriteBehavior(
            action.id,
            resolveMode(action.id, action.mode),
            action.rewriteBehavior,
          ),
        }))
    : defaultActions

  const merged = defaultActions
    .filter((action) => FIXED_ACTION_IDS.has(action.id))
    .concat(resolved.filter((action) => !FIXED_ACTION_IDS.has(action.id)))

  return merged.map((action) => {
    const label = action.label?.trim() || action.id
    const mode = resolveMode(action.id, action.mode)
    const rewriteBehavior = resolveRewriteBehavior(
      action.id,
      mode,
      action.rewriteBehavior,
    )
    const rawInstruction = action.instruction?.trim() || ''
    const instruction =
      mode === 'rewrite' ||
      action.id === 'custom-ask' ||
      mode === 'chat-input' ||
      mode === 'chat-send'
        ? rawInstruction
        : rawInstruction || label || action.id
    return { id: action.id, label, instruction, mode, rewriteBehavior }
  })
}
