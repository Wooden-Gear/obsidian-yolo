import { memo } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import {
  oneDark,
  oneLight,
} from 'react-syntax-highlighter/dist/esm/styles/prism'

function SyntaxHighlighterWrapper({
  isDarkMode,
  language,
  hasFilename,
  wrapLines,
  children,
}: {
  isDarkMode: boolean
  language: string | undefined
  hasFilename: boolean
  wrapLines: boolean
  children: string
}) {
  const className = [
    'smtcmp-syntax-highlighter',
    hasFilename
      ? 'smtcmp-syntax-highlighter--with-filename'
      : 'smtcmp-syntax-highlighter--standalone',
    language === 'markdown' ? 'smtcmp-syntax-highlighter--markdown' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <SyntaxHighlighter
      language={language}
      style={isDarkMode ? oneDark : oneLight}
      className={className}
      wrapLines={wrapLines}
      lineProps={
        wrapLines
          ? {
              className: 'smtcmp-syntax-highlighter-line-wrap',
            }
          : undefined
      }
    >
      {children}
    </SyntaxHighlighter>
  )
}

export const MemoizedSyntaxHighlighterWrapper = memo(SyntaxHighlighterWrapper)
