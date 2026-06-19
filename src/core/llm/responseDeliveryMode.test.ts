import { resolveResponseExecutionMode } from './responseDeliveryMode'

describe('resolveResponseExecutionMode', () => {
  it.each([
    ['incremental', 'browser', 'incremental-streaming'],
    ['incremental', 'node', 'incremental-streaming'],
    ['buffered', 'browser', 'non-streaming'],
    ['buffered', 'node', 'non-streaming'],
    ['incremental', 'obsidian', 'buffered-streaming'],
    ['buffered', 'obsidian', 'buffered-streaming'],
  ] as const)(
    'maps %s delivery over %s transport to %s',
    (deliveryMode, transportMode, expected) => {
      expect(
        resolveResponseExecutionMode({ deliveryMode, transportMode }),
      ).toBe(expected)
    },
  )
})
