import React, { useState } from 'react'
import { Editor } from 'obsidian'

import { useLanguage } from '../../contexts/language-context'
import { usePlugin } from '../../contexts/plugin-context'
import { ObsidianButton } from '../common/ObsidianButton'
import { ObsidianSetting } from '../common/ObsidianSetting'
import { ObsidianTextArea } from '../common/ObsidianTextArea'
import { ReactFloatingPanel } from '../common/ReactFloatingPanel'

export type CustomContinuePanelProps = {
  editor: Editor
  onClose: () => void
}

function CustomContinuePanelBody({ editor, onClose }: CustomContinuePanelProps) {
  const plugin = usePlugin()
  const { t } = useLanguage()
  const [instruction, setInstruction] = useState('')

  const handleConfirm = async () => {
    onClose()
    await plugin.continueWriting(editor, instruction.trim().length > 0 ? instruction : undefined)
  }

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      // Enter 作为确定
      void handleConfirm()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
      return
    }
    // Shift+Enter 默认换行，保持原行为（不拦截）
  }

  return (
    <>
      {/* 输入区占满剩余空间 */}
      <div style={{ width: '100%', flex: 1, minHeight: 0, display: 'flex' }}>
        <ObsidianTextArea
          value={instruction}
          placeholder={t('chat.customContinuePromptPlaceholder') ?? ''}
          onChange={(v) => setInstruction(v)}
          style={{ width: '100%', height: '100%', minHeight: '160px', resize: 'none' }}
          autoFocus
          onKeyDown={handleKeyDown}
        />
      </div>

      {/* 底部轻量工具条 */}
      <ObsidianSetting>
        <ObsidianButton text={t('common.confirm')} onClick={handleConfirm} cta />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}

export class CustomContinuePanel {
  private panel: ReactFloatingPanel<CustomContinuePanelProps>

  constructor({ plugin, editor, position }: { plugin: any; editor: Editor; position?: { x: number; y: number } }) {
    this.panel = new ReactFloatingPanel<CustomContinuePanelProps>({
      Component: CustomContinuePanelBody,
      props: { editor },
      plugin,
      options: {
        title: plugin.t('commands.customContinueWriting'),
        initialPosition: position,
        closeOnEscape: true,
        closeOnOutsideClick: true,
        width: 420,
        height: 260,
        minimal: true,
      },
    })
  }

  open() {
    this.panel.open()
  }

  close() {
    this.panel.close()
  }
}
