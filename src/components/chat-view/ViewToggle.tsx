import React from 'react'

import { useLanguage } from '../../contexts/language-context'

type ViewToggleProps = {
  activeView: 'chat' | 'composer'
  onChangeView: (view: 'chat' | 'composer') => void
  disabled?: boolean
}

const ViewToggle: React.FC<ViewToggleProps> = ({
  activeView,
  onChangeView,
  disabled = false,
}) => {
  const { t } = useLanguage()

  const chatLabel = t('sidebar.tabs.chat', 'Chat')
  const composerLabel = t('sidebar.tabs.composer', 'Composer')

  return (
    <div className="smtcmp-view-toggle">
      <button
        className={`smtcmp-view-toggle-button ${
          activeView === 'chat' ? 'smtcmp-view-toggle-button--active' : ''
        }`}
        onClick={() => onChangeView('chat')}
        disabled={disabled}
        aria-pressed={activeView === 'chat'}
      >
        {chatLabel}
      </button>
      <button
        className={`smtcmp-view-toggle-button ${
          activeView === 'composer' ? 'smtcmp-view-toggle-button--active' : ''
        }`}
        onClick={() => onChangeView('composer')}
        disabled={disabled}
        aria-pressed={activeView === 'composer'}
      >
        {composerLabel}
      </button>
      <div
        className="smtcmp-view-toggle-indicator"
        data-active-view={activeView}
      />
    </div>
  )
}

export default ViewToggle
