import { ChevronDown, ChevronUp } from 'lucide-react'
import { memo, useEffect, useRef, useState } from 'react'

import DotLoader from '../common/DotLoader'

import { ObsidianMarkdown } from './ObsidianMarkdown'

const AssistantMessageReasoning = memo(function AssistantMessageReasoning({
  reasoning,
  content,
}: {
  reasoning: string
  content: string
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [showLoader, setShowLoader] = useState(false)
  const previousReasoning = useRef(reasoning)
  const previousContent = useRef(content)
  const hasUserInteracted = useRef(false)

  useEffect(() => {
    const reasoningChanged = previousReasoning.current !== reasoning && previousReasoning.current !== ''
    const contentChanged = previousContent.current !== content && previousContent.current !== ''
    
    // Start showing loader when reasoning starts or continues
    if (reasoningChanged) {
      setShowLoader(true)
      if (!hasUserInteracted.current) {
        setIsExpanded(true)
      }
    }
    
    // Stop showing loader only when content starts appearing (indicating reasoning is done)
    if (contentChanged && reasoning && !showLoader) {
      // Content appeared after reasoning, reasoning is likely complete
    } else if (contentChanged && showLoader) {
      // Content is being generated, reasoning phase is over
      const timer = setTimeout(() => {
        setShowLoader(false)
        // Auto-collapse after reasoning finishes if user hasn't interacted
        if (!hasUserInteracted.current) {
          setIsExpanded(false)
        }
      }, 500) // Shorter delay since we know content is flowing
      return () => clearTimeout(timer)
    }
    
    previousReasoning.current = reasoning
    previousContent.current = content
  }, [reasoning, content, showLoader])

  const handleToggle = () => {
    hasUserInteracted.current = true
    setIsExpanded(!isExpanded)
  }

  return (
    <div className="smtcmp-assistant-message-metadata">
      <div
        className="smtcmp-assistant-message-metadata-toggle"
        onClick={handleToggle}
      >
        <span>{showLoader ? 'Reasoning' : 'Reasoned'} {showLoader && <DotLoader />}</span>
        {isExpanded ? (
          <ChevronUp className="smtcmp-assistant-message-metadata-toggle-icon" />
        ) : (
          <ChevronDown className="smtcmp-assistant-message-metadata-toggle-icon" />
        )}
      </div>
      {isExpanded && (
        <div className="smtcmp-assistant-message-metadata-content">
          <ObsidianMarkdown content={reasoning} scale="xs" />
        </div>
      )}
    </div>
  )
})

export default AssistantMessageReasoning
