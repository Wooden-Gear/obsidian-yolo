import {
  DEFAULT_YOLO_BASE_DIR,
  YOLO_SNIPPETS_FILE_NAME,
} from '../paths/yoloPaths'

export const YOLO_SNIPPETS_PATH = `${DEFAULT_YOLO_BASE_DIR}/${YOLO_SNIPPETS_FILE_NAME}`

export const getSnippetsPathAwareTemplate = (
  template: string,
  snippetsPath: string = YOLO_SNIPPETS_PATH,
): string => {
  return template.split(YOLO_SNIPPETS_PATH).join(snippetsPath)
}

/**
 * Default content for a freshly created `YOLO/snippets.md`.
 * Provides two ready-to-use examples plus a short format reminder.
 */
export const DEFAULT_SNIPPETS_TEMPLATE = `<!--
YOLO 快捷指令 / Snippets
- 每个 \`## xxx\` 是一个 snippet，标题作为触发词。
- 标题下方紧跟的一行 \`> ...\` 会被识别为描述（可选）。
- 之后的内容为 snippet 正文，会被原样插入到聊天输入框。
- 重复触发词只保留第一个；正文为空的 snippet 会被忽略。
- 不要在本文件中使用 YAML frontmatter。
-->

## translate
> 翻译选中文本到中文

请把下面的内容翻译成中文，保持原有语气：

## review
> 代码评审

请帮我评审下面这段代码，关注：
- 边界条件
- 错误处理
- 命名与可读性
`

export const YOLO_SNIPPET_CREATOR_TEMPLATE = `---
id: snippet-creator
name: Snippet Creator
description: Guide for creating YOLO chat snippets (slash-command shortcuts) stored in YOLO/snippets.md. Use when users want to add, edit, or organize prompt snippets that can be triggered from the chat input's "/" menu.
---

# Snippet Creator

This skill helps users curate the slash-command snippet library at \`YOLO/snippets.md\`.

## About Snippets

Snippets are short prompt fragments that the user can insert into the chat input by typing \`/\` and choosing the snippet from the "快捷指令 / Snippets" category. Selecting a snippet replaces the typed \`/xxx\` with the snippet body as plain text — the user can then edit or send it.

Snippets are NOT skills. They never go through the agent loader. They are pure text shortcuts owned by the user.

## File Location

All snippets live in a single Markdown file: \`YOLO/snippets.md\`.

Do not split snippets across multiple files. Do not place this file inside the \`skills/\` subfolder.

## File Format

\`\`\`md
## translate
> 翻译选中文本到中文

请把下面的内容翻译成中文，保持原有语气：

## review
> 代码评审

请帮我评审下面这段代码，关注：
- 边界条件
- 错误处理
\`\`\`

Rules:

1. Each snippet starts with a level-2 heading \`## <trigger>\`. The heading text is both the trigger and the display name (Chinese / spaces / punctuation allowed).
2. The line immediately following the heading MAY be a single-line blockquote \`> description\`. If present, it is shown as the menu subtitle. Any other style (paragraph, italics, bullet list…) is NOT recognized as a description and will be treated as body content.
3. Everything between the description (or the heading, if no description) and the next \`## \` heading is the snippet body. Leading/trailing blank lines are trimmed; inner formatting is preserved verbatim.
4. Deeper headings (\`### \`, \`#### \`, …) are NOT snippet boundaries — they are part of the body.
5. Duplicate triggers: the first occurrence wins; subsequent ones are silently skipped. Pick distinct trigger names.
6. A snippet with an empty body is filtered out (does not appear in the menu).
7. Do NOT add YAML frontmatter to \`YOLO/snippets.md\`. Unlike skills, snippets do not use frontmatter.

## Workflow

When the user wants to add or modify snippets:

1. Read \`YOLO/snippets.md\` with \`fs_read\` to see current entries (create it with \`fs_create_file\` if missing).
2. Draft the new snippet content following the format above. Choose a short, memorable trigger.
3. Apply changes with \`fs_edit\` (append or insert a new \`## <trigger>\` block). Avoid rewriting the entire file unless the user asks for a restructure.
4. After saving, mention the new trigger so the user knows what to type.

## Quality Checklist

- [ ] Trigger is unique within the file.
- [ ] Trigger is short and meaningful (kebab-case or single word recommended, but any text works).
- [ ] Description (if any) is one line and starts with \`> \`.
- [ ] Body is non-empty and represents the actual prompt text the user wants inserted.
- [ ] No YAML frontmatter added to the file.
`
