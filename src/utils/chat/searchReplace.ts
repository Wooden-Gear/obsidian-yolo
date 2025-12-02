/**
 * SEARCH/REPLACE block parser and applier for edit mode.
 *
 * Format:
 * <<<<<<< SEARCH
 * [exact text to find]
 * =======
 * [replacement text]
 * >>>>>>> REPLACE
 */

export type SearchReplaceBlock = {
  search: string
  replace: string
}

export type ApplyResult = {
  newContent: string
  errors: string[]
  appliedCount: number
}

/**
 * Parse SEARCH/REPLACE blocks from model output.
 *
 * @param content - The raw model output containing SEARCH/REPLACE blocks
 * @returns Array of parsed blocks
 */
export function parseSearchReplaceBlocks(
  content: string,
): SearchReplaceBlock[] {
  const blocks: SearchReplaceBlock[] = []

  // Match SEARCH/REPLACE blocks
  // Pattern: <<<<<<< SEARCH\n...\n=======\n...\n>>>>>>> REPLACE
  const pattern =
    /<<<<<<< SEARCH\n([\s\S]*?)\n=======\n([\s\S]*?)\n>>>>>>> REPLACE/g

  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    const search = match[1]
    const replace = match[2]
    blocks.push({ search, replace })
  }

  return blocks
}

/**
 * Apply SEARCH/REPLACE blocks to original content.
 *
 * Blocks are applied sequentially. Each subsequent block operates on
 * the result of the previous replacement.
 *
 * @param originalContent - The original document content
 * @param blocks - Array of SEARCH/REPLACE blocks to apply
 * @returns Object containing new content, errors, and count of applied blocks
 */
export function applySearchReplaceBlocks(
  originalContent: string,
  blocks: SearchReplaceBlock[],
): ApplyResult {
  let content = originalContent
  const errors: string[] = []
  let appliedCount = 0

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i]
    const searchText = block.search

    // Check if search text exists in current content
    if (content.includes(searchText)) {
      // Replace only the first occurrence
      content = content.replace(searchText, block.replace)
      appliedCount++
    } else {
      // Try fuzzy matching by trimming whitespace
      const trimmedSearch = searchText.trim()
      const lines = content.split('\n')
      let found = false

      // Try to find a line-by-line match with trimmed content
      for (let j = 0; j < lines.length; j++) {
        if (lines[j].trim() === trimmedSearch) {
          // Found a trimmed match - use original whitespace
          const originalLine = lines[j]
          const leadingWhitespace = originalLine.match(/^(\s*)/)?.[1] ?? ''
          lines[j] = leadingWhitespace + block.replace.trim()
          content = lines.join('\n')
          appliedCount++
          found = true
          break
        }
      }

      if (!found) {
        // Record error with preview of search text
        const preview =
          searchText.length > 50
            ? searchText.substring(0, 50) + '...'
            : searchText
        errors.push(
          `Block ${i + 1}: Could not find text to replace: "${preview}"`,
        )
      }
    }
  }

  return {
    newContent: content,
    errors,
    appliedCount,
  }
}

/**
 * Validate that the model output contains valid SEARCH/REPLACE blocks.
 *
 * @param content - The raw model output
 * @returns true if at least one valid block is found
 */
export function hasValidSearchReplaceBlocks(content: string): boolean {
  return parseSearchReplaceBlocks(content).length > 0
}
