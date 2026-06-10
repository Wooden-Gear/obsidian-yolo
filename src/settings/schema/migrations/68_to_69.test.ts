import { migrateFrom68To69 } from './68_to_69'

describe('migrateFrom68To69', () => {
  it('renames legacy chat mode values to ask', () => {
    const result = migrateFrom68To69({
      version: 68,
      chatOptions: {
        chatMode: 'chat',
      },
      continuationOptions: {
        quickAskMode: 'chat',
      },
    })

    expect(result.version).toBe(69)
    expect(result.chatOptions).toEqual({ chatMode: 'ask' })
    expect(result.continuationOptions).toEqual({ quickAskMode: 'ask' })
  })
})
