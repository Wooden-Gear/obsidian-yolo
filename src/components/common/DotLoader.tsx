import { Sparkles } from 'lucide-react'
import React from 'react'

type DotLoaderProps = {
  text?: string
  variant?: 'sparkles' | 'dots'
  className?: string
}

export default function DotLoader({
  text = 'Thinking',
  variant = 'sparkles',
  className = '',
}: DotLoaderProps) {
  if (variant === 'dots') {
    return (
      <span
        className={`smtcmp-dot-loader-minimal ${className}`.trim()}
        aria-label="Loading"
      >
        <span />
        <span />
        <span />
      </span>
    )
  }

  return (
    <div
      className={`smtcmp-thinking-loader ${className}`.trim()}
      aria-label="Loading"
    >
      <div className="smtcmp-thinking-icon">
        <Sparkles className="smtcmp-thinking-icon-svg" size={20} />
      </div>
      <div className="smtcmp-thinking-text">{text}</div>
    </div>
  )
}
