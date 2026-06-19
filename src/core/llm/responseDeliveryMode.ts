import type { RequestTransportMode } from '../../types/provider.types'

export type ResponseDeliveryMode = 'incremental' | 'buffered'

export type ResponseExecutionMode =
  | 'incremental-streaming'
  | 'buffered-streaming'
  | 'non-streaming'

export const resolveResponseExecutionMode = ({
  deliveryMode,
  transportMode,
}: {
  deliveryMode: ResponseDeliveryMode
  transportMode?: RequestTransportMode
}): ResponseExecutionMode => {
  if (transportMode === 'obsidian') {
    return 'buffered-streaming'
  }

  return deliveryMode === 'incremental'
    ? 'incremental-streaming'
    : 'non-streaming'
}
