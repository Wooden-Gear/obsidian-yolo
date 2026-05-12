/**
 * Agent Skills 开放标准校验模块。
 * 参考规范：https://agentskills.io/specification
 */

export type ValidationError = {
  field: string
  message: string
}

// ---------------------------------------------------------------------------
// name 字段校验
// ---------------------------------------------------------------------------

/**
 * Agent Skills 标准 name 规则：
 * - 1-64 字符
 * - 仅允许小写字母 (a-z)、数字 (0-9)、连字符 (-)
 * - 不能以连字符开头或结尾
 * - 不能包含连续连字符 (--)
 */
const SKILL_NAME_CHARS_PATTERN = /^[a-z0-9-]+$/

export function validateSkillName(name: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'missing' })
    return errors
  }

  const trimmed = name.trim()

  if (trimmed.length > 64) {
    errors.push({ field: 'name', message: 'exceeds 64 characters' })
  }

  if (/[A-Z]/.test(trimmed)) {
    errors.push({ field: 'name', message: 'uppercase not allowed' })
  } else if (!SKILL_NAME_CHARS_PATTERN.test(trimmed)) {
    errors.push({
      field: 'name',
      message: 'only lowercase letters, numbers, and hyphens allowed',
    })
  } else if (trimmed.startsWith('-') || trimmed.endsWith('-')) {
    errors.push({
      field: 'name',
      message: 'cannot start or end with hyphen',
    })
  } else if (trimmed.includes('--')) {
    errors.push({
      field: 'name',
      message: 'consecutive hyphens not allowed',
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// description 字段校验
// ---------------------------------------------------------------------------

export function validateDescription(description: unknown): ValidationError[] {
  const errors: ValidationError[] = []

  if (typeof description !== 'string' || description.trim().length === 0) {
    errors.push({ field: 'description', message: 'missing' })
    return errors
  }

  if (description.trim().length > 1024) {
    errors.push({
      field: 'description',
      message: 'exceeds 1024 characters',
    })
  }

  return errors
}

// ---------------------------------------------------------------------------
// compatibility 字段校验（可选）
// ---------------------------------------------------------------------------

export function validateCompatibility(
  compatibility: unknown,
): ValidationError[] {
  if (compatibility === undefined || compatibility === null) return []
  if (typeof compatibility === 'string' && compatibility.trim().length > 500) {
    return [{ field: 'compatibility', message: 'exceeds 500 characters' }]
  }
  return []
}

// ---------------------------------------------------------------------------
// Frontmatter 解析
// ---------------------------------------------------------------------------

function stripQuotes(value: string): string {
  const trimmed = value.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

/**
 * 从 Markdown 内容中解析 YAML frontmatter。
 * 返回 null 表示没有 frontmatter。
 */
export function parseFrontmatter(
  content: string,
): Record<string, unknown> | null {
  if (!content.startsWith('---\n') && !content.startsWith('---\r\n')) {
    return null
  }

  // 找到 frontmatter 开始后的第一个换行位置
  const firstNewline = content.indexOf('\n')
  const searchStart = firstNewline

  const endMarkerIdx = content.indexOf('\n---', searchStart)
  if (endMarkerIdx === -1) return null

  const yamlText = content.slice(firstNewline + 1, endMarkerIdx)
  const result: Record<string, unknown> = {}

  let currentMultilineKey: string | null = null
  let multilineLines: string[] = []
  let currentMapKey: string | null = null
  let currentMap: Record<string, string> | null = null

  const flushMultiline = () => {
    if (currentMultilineKey) {
      result[currentMultilineKey] = multilineLines.join(' ').trim()
      currentMultilineKey = null
      multilineLines = []
    }
  }

  const flushMap = () => {
    if (currentMapKey && currentMap) {
      result[currentMapKey] = currentMap
      currentMapKey = null
      currentMap = null
    }
  }

  for (const line of yamlText.split('\n')) {
    const trimmed = line.replace(/\r$/, '')

    // 多行文本的续行（缩进行）
    if (currentMultilineKey && /^\s+\S/.test(trimmed)) {
      multilineLines.push(trimmed.trim())
      continue
    }

    // 结束多行文本
    if (currentMultilineKey) {
      flushMultiline()
    }

    // 嵌套 map 的值行
    if (currentMapKey && currentMap && /^\s+\S/.test(trimmed)) {
      const nestedMatch = trimmed.match(/^\s+([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
      if (nestedMatch) {
        currentMap[nestedMatch[1]] = stripQuotes(nestedMatch[2])
      }
      continue
    }

    // 结束当前 map
    flushMap()

    const match = trimmed.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/)
    if (!match) continue

    const key = match[1]
    const value = match[2].trim()

    if (value === '|' || value === '>' || value === '|-' || value === '>-') {
      // 多行文本标记
      currentMultilineKey = key
      multilineLines = []
    } else if (value === '') {
      // 空值：可能是嵌套 map
      currentMapKey = key
      currentMap = {}
    } else {
      result[key] = stripQuotes(value)
    }
  }

  // 处理最后的多行文本或 map
  flushMultiline()
  flushMap()

  return result
}

// ---------------------------------------------------------------------------
// 包级别校验
// ---------------------------------------------------------------------------

export type FileEntry = {
  relativePath: string
  content: string
}

/**
 * 对文件夹格式的 skill 包进行完整校验（Agent Skills 标准）。
 */
export function validateDirectoryPackage(
  dirName: string,
  files: FileEntry[],
): ValidationError[] {
  const errors: ValidationError[] = []

  // 1. 必须包含 SKILL.md
  const skillMdEntry = files.find((f) => f.relativePath === 'SKILL.md')
  if (!skillMdEntry) {
    errors.push({ field: 'SKILL.md', message: 'missing' })
    return errors
  }

  // 2. SKILL.md 必须包含有效的 frontmatter
  const frontmatter = parseFrontmatter(skillMdEntry.content)
  if (!frontmatter) {
    errors.push({ field: 'frontmatter', message: 'missing or invalid' })
    return errors
  }

  // 3. 校验 name 字段
  const nameErrors = validateSkillName(frontmatter.name)
  errors.push(...nameErrors)

  // 4. 校验 description 字段
  errors.push(...validateDescription(frontmatter.description))

  // 4. 校验可选字段
  errors.push(...validateCompatibility(frontmatter.compatibility))

  return errors
}

/**
 * 对单文件格式的 skill 进行校验（Legacy 格式）。
 * 要求有 frontmatter 且包含 name 字段。
 */
export function validateSingleFileSkill(content: string): ValidationError[] {
  const errors: ValidationError[] = []

  const frontmatter = parseFrontmatter(content)
  if (!frontmatter) {
    errors.push({ field: 'frontmatter', message: 'missing or invalid' })
    return errors
  }

  if (
    typeof frontmatter.name !== 'string' ||
    frontmatter.name.trim().length === 0
  ) {
    errors.push({ field: 'name', message: 'missing' })
  }

  return errors
}
