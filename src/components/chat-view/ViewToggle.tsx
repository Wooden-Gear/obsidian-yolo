import React, { useState } from 'react'

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
  const [hoveredView, setHoveredView] = useState<'chat' | 'composer' | null>(null)

  const chatLabel = t('sidebar.tabs.chat', 'Chat')
  const composerLabel = t('sidebar.tabs.composer', 'Composer')

  // Determine which view should be expanded based on hover or active state
  const expandedView = hoveredView || activeView
  const isActiveExpanded = expandedView === activeView

  return (
    <div
      className="smtcmp-view-toggle"
      data-expanded-view={expandedView}
      data-active-expanded={isActiveExpanded ? 'true' : 'false'}
    >
      <button
        className={`smtcmp-view-toggle-button ${
          activeView === 'chat' ? 'smtcmp-view-toggle-button--active' : ''
        } ${expandedView === 'chat' ? 'smtcmp-view-toggle-button--expanded' : ''}`}
        onClick={() => onChangeView('chat')}
        onMouseEnter={() => !disabled && setHoveredView('chat')}
        onMouseLeave={() => setHoveredView(null)}
        disabled={disabled}
        aria-pressed={activeView === 'chat'}
      >
        <span className="smtcmp-view-toggle-button-label">{chatLabel}</span>
      </button>
      <button
        className={`smtcmp-view-toggle-button ${
          activeView === 'composer' ? 'smtcmp-view-toggle-button--active' : ''
        } ${expandedView === 'composer' ? 'smtcmp-view-toggle-button--expanded' : ''}`}
        onClick={() => onChangeView('composer')}
        onMouseEnter={() => !disabled && setHoveredView('composer')}
        onMouseLeave={() => setHoveredView(null)}
        disabled={disabled}
        aria-pressed={activeView === 'composer'}
      >
        <span className="smtcmp-view-toggle-button-label">{composerLabel}</span>
      </button>
      <div
        className="smtcmp-view-toggle-indicator"
        data-active-view={activeView}
      />
    </div>
  )
}

export default ViewToggle
