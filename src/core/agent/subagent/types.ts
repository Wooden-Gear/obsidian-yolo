import type { TaskSource } from '../../../types/chat'
import type { ResponseUsage } from '../../../types/llm/response'

export type SubagentTaskStatus = 'running' | 'completed' | 'failed' | 'aborted'

export type SubagentAcceptedResult = {
  accepted: true
  taskId: string
  title: string
  status: 'running'
  note: string
}

export type SubagentResult = {
  taskId: string
  status: 'completed' | 'failed' | 'aborted'
  content: string
  durationMs: number
  toolUseCount: number
  usage?: ResponseUsage
}

export type SubagentTaskRecord = {
  taskId: string
  conversationId: string
  source: TaskSource
  title: string
  status: SubagentTaskStatus
  createdAt: number
  completedAt?: number
  prompt: string
  result?: SubagentResult
  error?: string
  abortController: AbortController
}
