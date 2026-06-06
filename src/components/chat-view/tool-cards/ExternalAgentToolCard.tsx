import type { ToolCallResponse } from '../../../types/tool-call.types'

import { LiveTaskCard } from './LiveTaskCard'
import type { LiveTaskArgs } from './LiveTaskCard'

type ExternalAgentCardProps = {
  toolCallId: string
  response: ToolCallResponse
  args?: Pick<LiveTaskArgs, 'provider' | 'model' | 'workingDirectory'>
  onAbort?: () => void
}

export function ExternalAgentToolCard({
  toolCallId,
  response,
  args,
  onAbort,
}: ExternalAgentCardProps) {
  return (
    <LiveTaskCard
      toolCallId={toolCallId}
      response={response}
      variant="external-agent"
      args={args}
      onAbort={onAbort}
    />
  )
}
