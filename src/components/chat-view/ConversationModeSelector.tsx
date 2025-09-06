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
    <div className="smtcmp-chat-mode-selector" style={{ display: 'flex', gap: 6 }}>
      <span style={{ fontSize: '12px', opacity: 0.8 }}>{t('chat.modeTitle') ?? 'Chat Mode'}</span>
      <div className="smtcmp-chat-mode-selector-buttons" style={{ display: 'flex', gap: 4 }}>
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

