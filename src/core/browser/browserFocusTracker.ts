/**
 * Tracks the most-recently focused supported webview leaf across the user's
 * workspace navigation. Fed by an existing `active-leaf-change` listener
 * (see `main.ts`); read by the chat injection and the `browser_read_page`
 * tool when the user has enabled the "include last viewed web page even when
 * switched away" setting.
 *
 * Rationale: `getMostRecentLeaf(rootSplit)` only returns the single most
 * recent root-split leaf, which is null/non-webview the moment the user
 * focuses any other tab. `iterateAllLeaves` returns leaves in workspace
 * tree order, not by recency — useless as a "what was the user just
 * looking at" signal. This tracker bridges that gap with a single
 * remembered reference.
 */
import type { App, WorkspaceLeaf } from 'obsidian'

import { SUPPORTED_WEBVIEW_VIEW_TYPES } from './activeWebviewProbe'

const isSupportedWebviewLeaf = (leaf: WorkspaceLeaf): boolean => {
  const view = leaf.view
  const viewType =
    typeof view?.getViewType === 'function' ? view.getViewType() : ''
  return (SUPPORTED_WEBVIEW_VIEW_TYPES as readonly string[]).includes(viewType)
}

export class BrowserFocusTracker {
  private lastViewedWebviewLeaf: WorkspaceLeaf | null = null

  /**
   * Call from the `active-leaf-change` listener. Only updates when the new
   * leaf is itself a supported webview, so focusing a note/log/canvas
   * preserves the previously remembered webview.
   */
  noteActiveLeaf(leaf: WorkspaceLeaf | null): void {
    if (!leaf) return
    if (isSupportedWebviewLeaf(leaf)) {
      this.lastViewedWebviewLeaf = leaf
    }
  }

  /**
   * Returns the most-recently focused webview leaf if it is still part of
   * the workspace. If the user has closed that tab, the stored reference is
   * pruned and null is returned.
   */
  getLastViewedWebviewLeaf(app: App): WorkspaceLeaf | null {
    const candidate = this.lastViewedWebviewLeaf
    if (!candidate) return null
    if (typeof app.workspace.iterateAllLeaves !== 'function') {
      // Test/legacy environments without the API: trust the reference.
      return candidate
    }
    let alive = false
    app.workspace.iterateAllLeaves((leaf) => {
      if (leaf === candidate) alive = true
    })
    if (!alive) {
      this.lastViewedWebviewLeaf = null
      return null
    }
    return candidate
  }

  /** Clear the tracker (e.g. when the plugin unloads). */
  reset(): void {
    this.lastViewedWebviewLeaf = null
  }
}
