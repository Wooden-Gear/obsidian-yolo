import { useLiveTaskStream } from './useLiveTaskStream'
import type { LiveTaskViewSnapshot } from './useLiveTaskStream'

export type ExternalCliViewSnapshot = LiveTaskViewSnapshot

export function useExternalCliStream(
  toolCallId: string,
  opts: Parameters<typeof useLiveTaskStream>[1],
): ExternalCliViewSnapshot | null {
  return useLiveTaskStream(toolCallId, { ...opts, kind: 'external-agent' })
}
