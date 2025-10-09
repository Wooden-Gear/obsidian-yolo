import React from 'react'

import { useLanguage } from '../../contexts/language-context'

export function ConversationModeSelector({
  mode,
  onChange,
}: {
  mode: 'rag' | 'brute'
  onChange: (m: 'rag' | 'brute') => void
}) {
  const { t } = useLanguage()

  return (
    <div className="smtcmp-chat-mode-selector">
      <span className="smtcmp-chat-mode-label">
        {t('chat.modeTitle') ?? 'Chat Mode'}
      </span>
      <div className="smtcmp-chat-mode-selector-buttons">
        <button
          className={`clickable-icon ${mode === 'rag' ? 'is-active' : ''}`}
          onClick={() => onChange('rag')}
          aria-label={t('chat.modeRAG') ?? 'RAG'}
          title={t('chat.modeRAG') ?? 'RAG'}
        >
          {t('chat.modeRAG') ?? 'RAG'}
        </button>
        <button
          className={`clickable-icon ${mode === 'brute' ? 'is-active' : ''}`}
          onClick={() => onChange('brute')}
          aria-label={t('chat.modeBrute') ?? 'Brute'}
          title={t('chat.modeBrute') ?? 'Brute'}
        >
          {t('chat.modeBrute') ?? 'Brute'}
        </button>
      </div>
    </div>
  )
}
