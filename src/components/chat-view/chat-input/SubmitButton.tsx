import { ArrowUp, Square } from 'lucide-react'

import { useLanguage } from '../../../contexts/language-context'

type SubmitButtonProps = {
  onClick: () => void
  /**
   * When true, the button switches into a "stop generation" affordance and
   * clicking it triggers `onAbort` instead of `onClick`. This unifies the
   * send/stop control so it never overlaps with the floating todo panel.
   */
  isGenerating?: boolean
  onAbort?: () => void
  /**
   * When true (and not generating), the button is rendered in a faded,
   * non-interactive state — used to hint "no content to send yet". Ignored
   * while `isGenerating` is true, since stopping is always allowed.
   */
  disabled?: boolean
}

export function SubmitButton({
  onClick,
  isGenerating = false,
  onAbort,
  disabled = false,
}: SubmitButtonProps) {
  const { t } = useLanguage()
  const sendLabel = t('chat.sendMessage', 'Chat')
  const stopLabel = t('chat.stopGeneration', 'Stop generation')
  const label = isGenerating ? stopLabel : sendLabel
  const isDisabled = !isGenerating && disabled

  const handleClick = () => {
    if (isGenerating) {
      onAbort?.()
      return
    }
    if (isDisabled) return
    onClick()
  }

  return (
    <button
      type="button"
      className={`yolo-chat-user-input-submit-button-circle${
        isGenerating ? ' is-generating' : ''
      }`}
      disabled={isDisabled}
      onClick={handleClick}
      aria-label={label}
      title={label}
    >
      {isGenerating ? (
        <Square size={12} fill="currentColor" strokeWidth={0} />
      ) : (
        <ArrowUp size={16} strokeWidth={2.5} />
      )}
    </button>
  )
}
