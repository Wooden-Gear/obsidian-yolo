import { App, TFile } from 'obsidian'

import { getYoloSnippetsPath } from '../paths/yoloPaths'

export type SnippetEntry = {
  id: string
  trigger: string
  description?: string
  content: string
}

type YoloSettingsLike = {
  yolo?: {
    baseDir?: string
  }
}

/**
 * Strip a leading YAML frontmatter block (`---\n...\n---\n`) if present.
 * Only the very first block at the top of the file is stripped — anything else
 * is treated as snippet content.
 */
const stripLeadingFrontmatter = (content: string): string => {
  if (!content.startsWith('---\n')) {
    return content
  }
  const closingIndex = content.indexOf('\n---\n', 4)
  if (closingIndex === -1) {
    return content
  }
  return content.slice(closingIndex + '\n---\n'.length)
}

const trimSurroundingBlankLines = (value: string): string => {
  return value.replace(/^(?:[ \t]*\r?\n)+/, '').replace(/(?:\r?\n[ \t]*)+$/, '')
}

/**
 * Parse a snippets.md file into SnippetEntry list.
 *
 * Rules:
 * - Only `## ` headings (exactly two `#`) are recognized as snippet triggers.
 * - The trigger text is the heading content after `## `, trimmed.
 * - If the first non-empty line after the heading is a single-line blockquote
 *   (`> ...`), it becomes `description`. Other forms are NOT a description.
 * - Everything from that point until the next `## ` heading (or EOF) is the
 *   body (with surrounding blank lines trimmed). Empty body -> filtered out.
 * - Duplicate triggers: the first wins, later ones are silently skipped.
 * - A leading YAML frontmatter block is ignored.
 */
export function parseSnippets(content: string): SnippetEntry[] {
  const stripped = stripLeadingFrontmatter(content)
  const lines = stripped.split(/\r?\n/)

  type RawBlock = { trigger: string; bodyLines: string[] }
  const blocks: RawBlock[] = []
  let current: RawBlock | null = null

  for (const line of lines) {
    const headingMatch = /^##[ \t]+(.+?)\s*$/.exec(line)
    // Reject `### ...` etc. — only exactly two `#`.
    const isExactlyH2 = headingMatch && !line.startsWith('###')
    if (isExactlyH2) {
      if (current) blocks.push(current)
      current = { trigger: headingMatch[1].trim(), bodyLines: [] }
      continue
    }
    if (current) {
      current.bodyLines.push(line)
    }
  }
  if (current) blocks.push(current)

  const entries: SnippetEntry[] = []
  const seenTriggers = new Set<string>()

  for (const block of blocks) {
    const trigger = block.trigger
    if (!trigger) continue
    if (seenTriggers.has(trigger)) continue

    let bodyLines = block.bodyLines
    let description: string | undefined

    // Description must be on the line IMMEDIATELY following the heading.
    // Any blank line between the heading and a `> ...` line means the
    // blockquote is body content, not a description.
    if (bodyLines.length > 0) {
      const candidate = bodyLines[0]
      const blockquoteMatch = /^>\s?(.*)$/.exec(candidate)
      if (blockquoteMatch) {
        description = blockquoteMatch[1].trim() || undefined
        bodyLines = bodyLines.slice(1)
      }
    }

    const body = trimSurroundingBlankLines(bodyLines.join('\n'))
    if (body.length === 0) continue

    seenTriggers.add(trigger)
    entries.push({
      id: trigger,
      trigger,
      description,
      content: body,
    })
  }

  return entries
}

/**
 * Async load of snippets from the vault's `YOLO/snippets.md`.
 * Returns `[]` when the file does not exist.
 * Parsing errors propagate to the caller.
 */
export async function loadSnippetEntries(
  app: App,
  options?: { settings?: YoloSettingsLike },
): Promise<SnippetEntry[]> {
  const path = getYoloSnippetsPath(options?.settings)
  const file = app.vault.getAbstractFileByPath(path)
  if (!(file instanceof TFile)) {
    return []
  }
  const content = await app.vault.cachedRead(file)
  return parseSnippets(content)
}
