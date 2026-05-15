import { parseSnippets } from './snippetsManager'

describe('parseSnippets', () => {
  it('parses a single snippet without description', () => {
    const content = `## translate

请把下面翻译成中文：
`
    const entries = parseSnippets(content)
    expect(entries).toEqual([
      {
        id: 'translate',
        trigger: 'translate',
        description: undefined,
        content: '请把下面翻译成中文：',
      },
    ])
  })

  it('parses multiple snippets with descriptions', () => {
    const content = `## translate
> 翻译选中文本到中文

请把下面翻译成中文：

## review
> 代码评审

请评审：
- 边界条件
- 错误处理
`
    const entries = parseSnippets(content)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toMatchObject({
      trigger: 'translate',
      description: '翻译选中文本到中文',
      content: '请把下面翻译成中文：',
    })
    expect(entries[1]).toMatchObject({
      trigger: 'review',
      description: '代码评审',
      content: '请评审：\n- 边界条件\n- 错误处理',
    })
  })

  it('filters out snippets with empty body', () => {
    const content = `## empty
> only description

## valid

real body
`
    const entries = parseSnippets(content)
    expect(entries.map((entry) => entry.trigger)).toEqual(['valid'])
  })

  it('keeps the first occurrence on duplicate triggers', () => {
    const content = `## same

first body

## same

second body
`
    const entries = parseSnippets(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].content).toBe('first body')
  })

  it('ignores leading YAML frontmatter', () => {
    const content = `---
title: Snippets
---
## hello

world
`
    const entries = parseSnippets(content)
    expect(entries).toEqual([
      {
        id: 'hello',
        trigger: 'hello',
        description: undefined,
        content: 'world',
      },
    ])
  })

  it('does not treat ### as a snippet boundary', () => {
    const content = `## outer

### nested heading

inner body
`
    const entries = parseSnippets(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].trigger).toBe('outer')
    expect(entries[0].content).toBe('### nested heading\n\ninner body')
  })

  it('does not treat a non-blockquote first line as description', () => {
    const content = `## tip

just plain text on the first line
more lines
`
    const entries = parseSnippets(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].description).toBeUndefined()
    expect(entries[0].content).toBe(
      'just plain text on the first line\nmore lines',
    )
  })

  it('preserves inner formatting verbatim while trimming outer blank lines', () => {
    const content = `## fmt


line1

line2


`
    const entries = parseSnippets(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].content).toBe('line1\n\nline2')
  })

  it('returns an empty array for empty input', () => {
    expect(parseSnippets('')).toEqual([])
    expect(parseSnippets('no headings at all\njust text')).toEqual([])
  })

  it('handles description with no body following it as empty body (filtered)', () => {
    const content = `## a
> just description
## b

body
`
    const entries = parseSnippets(content)
    expect(entries.map((entry) => entry.trigger)).toEqual(['b'])
  })

  it('does not treat a blockquote as description when separated from heading by a blank line', () => {
    const content = `## quoted

> 这是用户想保留在正文里的引用
正文继续
`
    const entries = parseSnippets(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].description).toBeUndefined()
    expect(entries[0].content).toBe(
      '> 这是用户想保留在正文里的引用\n正文继续',
    )
  })

  it('treats heading with trailing spaces correctly', () => {
    const content = `##   spaced trigger

body`
    const entries = parseSnippets(content)
    expect(entries).toHaveLength(1)
    expect(entries[0].trigger).toBe('spaced trigger')
  })
})
