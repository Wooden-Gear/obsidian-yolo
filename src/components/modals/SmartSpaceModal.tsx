import { App, Editor } from 'obsidian'
import React, { useState } from 'react'

import { useLanguage } from '../../contexts/language-context'
import { usePlugin } from '../../contexts/plugin-context'
import { ObsidianButton } from '../common/ObsidianButton'
import { ObsidianSetting } from '../common/ObsidianSetting'
import { ObsidianTextArea } from '../common/ObsidianTextArea'
import { ReactModal } from '../common/ReactModal'

export type SmartSpaceModalProps = {
  editor: Editor
  onClose: () => void
}

function SmartSpaceComponent({
  editor,
  onClose,
}: SmartSpaceModalProps) {
  const plugin = usePlugin()
  const { t } = useLanguage()
  const [instruction, setInstruction] = useState('')

  const handleConfirm = async () => {
    onClose()
    await plugin.continueWriting(
      editor,
      instruction.trim().length > 0 ? instruction : undefined,
    )
  }

  return (
    <>
      <div className="smtcmp-modal-input-container">
        <ObsidianTextArea
          value={instruction}
          placeholder={t('chat.customContinuePromptPlaceholder') ?? ''}
          onChange={(v) => setInstruction(v)}
          inputClassName="smtcmp-instruction-textarea"
        />
      </div>

      <ObsidianSetting>
        <ObsidianButton
          text={t('common.confirm')}
          onClick={handleConfirm}
          cta
        />
        <ObsidianButton text={t('common.cancel')} onClick={onClose} />
      </ObsidianSetting>
    </>
  )
}

export class SmartSpaceModal extends ReactModal<SmartSpaceModalProps> {
  constructor({
    app,
    plugin,
    editor,
  }: {
    app: App
    plugin: any
    editor: Editor
  }) {
    super({
      app,
      Component: SmartSpaceComponent,
      props: { editor },
      options: { title: plugin.t('commands.customContinueWriting') },
      plugin,
    })
  }
}
