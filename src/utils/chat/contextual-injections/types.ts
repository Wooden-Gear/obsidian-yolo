import type { TFile } from 'obsidian'

import type { TodoItem } from '../../../core/agent/todos-from-messages'
import type { ActiveWebviewHandle } from '../../../core/browser/activeWebviewProbe'
import type { CurrentFileViewState } from '../../../types/mentionable'

/**
 * Pointer-style injection used by Sidebar Chat focus sync.
 * Tells the agent which file the user is viewing + position metadata,
 * but does NOT include file content. The agent decides whether to read.
 */
export type CurrentFilePointerInjection = {
  type: 'current-file-pointer'
  file: TFile
  viewState?: CurrentFileViewState
}

export type EditorSnapshotSelection = {
  content: string
  filePath: string
}

/**
 * Content-style injection used by Quick Ask.
 * Captures the editor's current scene (file path/title, surrounding cursor
 * context, optional selection) and feeds it directly to the model — Quick Ask
 * is invoked with the assumption the model must operate on what the user is
 * looking at right now.
 */
export type EditorSnapshotInjection = {
  type: 'editor-snapshot'
  filePath: string
  fileTitle: string
  /** Text around cursor; may contain `cursorMarker` at the cursor position. */
  contextText: string
  cursorMarker: string
  selection?: EditorSnapshotSelection
}

export type TodoListInjection = {
  type: 'todo-list'
  todos: ReadonlyArray<TodoItem>
}

/**
 * Browser context injection (Phase 1). Emitted when the user's active leaf
 * is a supported `<webview>` host (core Web Viewer or .url WebView Opener).
 *
 * The handle is captured synchronously at build time; the renderer reads
 * URL/title/selection from it asynchronously so the leaf state when the user
 * pressed Send is faithfully preserved.
 */
export type BrowserContextInjection = {
  type: 'browser-context'
  handle: ActiveWebviewHandle
  maxSelectionChars: number
}

export type ContextualInjection =
  | CurrentFilePointerInjection
  | EditorSnapshotInjection
  | TodoListInjection
  | BrowserContextInjection
