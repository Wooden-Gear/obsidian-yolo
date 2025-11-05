import { Sparkles } from 'lucide-react'
import React from 'react'

interface DotLoaderProps {
  text?: string
}

export default function DotLoader({ text = 'Thinking' }: DotLoaderProps) {
  return (
    <div className="smtcmp-thinking-loader" aria-label="Loading">
      <div className="smtcmp-thinking-icon">
        <Sparkles className="smtcmp-thinking-icon-svg" size={20} />
      </div>
      <div className="smtcmp-thinking-text">{text}</div>
    </div>
  )
}
