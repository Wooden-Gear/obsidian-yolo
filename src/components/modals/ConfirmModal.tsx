import { App } from 'obsidian'

import { ReactModal } from '../common/ReactModal'

export type ConfirmModalOptions = {
  title: string
  message: string
  ctaText?: string
  onConfirm: () => void
  onCancel?: () => void
}

type ConfirmModalComponentProps = {
  message: string
  ctaText?: string
  onConfirm: () => void
  onCancel?: () => void
}

export class ConfirmModal extends ReactModal<ConfirmModalComponentProps> {
  constructor(app: App, options: ConfirmModalOptions) {
    super({
      app: app,
      Component: ConfirmModalComponent,
      props: {
        message: options.message,
        ctaText: options.ctaText,
        onConfirm: options.onConfirm,
        onCancel: options.onCancel,
      },
      options: {
        title: options.title,
      },
    })
  }
}

function ConfirmModalComponent({
  message,
  ctaText,
  onConfirm,
  onCancel,
  onClose,
}: ConfirmModalComponentProps & { onClose: () => void }) {
  return (
    <div>
      <div className="smtcmp-prewrap">{message}</div>
      <div className="modal-button-container">
        <button
          className="mod-warning"
          onClick={async () => {
            try {
              await onConfirm()
            } finally {
              onClose()
            }
          }}
        >
          {ctaText ?? 'Confirm'}
        </button>
        <button
          className="mod-cancel"
          onClick={async () => {
            try {
              await onCancel?.()
            } finally {
              onClose()
            }
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
