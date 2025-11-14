import {
  ChevronDown,
  ChevronRight,
  FileText,
  Folder,
  FolderClosed,
  FolderOpen,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'

import { IndexProgress } from '../chat-view/QueryProgress'

type RAGIndexProgressProps = {
  progress: IndexProgress | null
  isIndexing: boolean
  // Optional: provide a way to list markdown files under a folder path
  getMarkdownFilesInFolder?: (folderPath: string) => string[]
}

export function RAGIndexProgress({
  progress,
  isIndexing,
  getMarkdownFilesInFolder,
}: RAGIndexProgressProps) {
  // expanded folders
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']))
  const noProgressYet = !progress

  const formatFolderName = (path: string) => {
    if (path === '') return '根目录'
    const parts = path.split('/')
    return parts[parts.length - 1]
  }

  const formatProgress = (completed: number, total: number) => {
    if (total === 0) return '0%'
    const pct = Math.round((completed / total) * 100)
    const clamped = Math.max(0, Math.min(100, pct))
    return `${clamped}%`
  }

  // 构建树形结构（跳过根目录行，只渲染其子节点）
  type TreeNode = {
    path: string
    name: string
    type: 'folder' | 'file'
    info?: { completedChunks: number; totalChunks: number }
    children: TreeNode[]
  }

  const treeRoots: TreeNode[] = useMemo(() => {
    if (!progress) return []
    const fp = progress?.folderProgress || {}
    const nodes = new Map<string, TreeNode>()

    const ensureFolder = (p: string): TreeNode => {
      const existing = nodes.get(p)
      if (existing) return existing
      const info = fp[p]
      const node: TreeNode = {
        path: p,
        name: p === '' ? '根目录' : formatFolderName(p),
        type: 'folder',
        info: {
          completedChunks: info?.completedChunks || 0,
          totalChunks: info?.totalChunks || 0,
        },
        children: [],
      }
      nodes.set(p, node)
      return node
    }

    const getParent = (p: string): string => {
      if (!p || !p.includes('/')) return ''
      return p.substring(0, p.lastIndexOf('/'))
    }

    const ensureAncestors = (p: string) => {
      let current = getParent(p)
      while (current !== '') {
        ensureFolder(current)
        current = getParent(current)
      }
      ensureFolder('')
    }

    for (const p of Object.keys(fp)) {
      ensureFolder(p)
      ensureAncestors(p)
    }
    if (!nodes.has('')) ensureFolder('')

    // 清空子节点，重新挂接
    nodes.forEach((node) => {
      if (node.type === 'folder') {
        const info = fp[node.path]
        node.info = {
          completedChunks: info?.completedChunks || 0,
          totalChunks: info?.totalChunks || 0,
        }
      }
      node.children = []
    })

    nodes.forEach((node) => {
      if (node.type !== 'folder' || node.path === '') return
      const parent = getParent(node.path)
      const parentNode = nodes.get(parent)
      if (parentNode) parentNode.children.push(node)
    })

    if (getMarkdownFilesInFolder) {
      nodes.forEach((node) => {
        if (node.type !== 'folder') return
        const files = getMarkdownFilesInFolder(node.path) || []
        for (const filePath of files) {
          node.children.push({
            path: filePath,
            name: filePath.split('/').pop() || filePath,
            type: 'file',
            children: [],
          })
        }
      })
    }

    const sortRec = (node: TreeNode) => {
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
        return a.name.localeCompare(b.name)
      })
      node.children.forEach((child) => {
        if (child.type === 'folder') sortRec(child)
      })
    }
    const root = nodes.get('')
    if (root) {
      sortRec(root)
      return [root]
    }
    return []
  }, [progress, getMarkdownFilesInFolder])

  const toggle = (path: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }

  const renderNodes = (
    nodes: TreeNode[],
    depth: number,
    ancestorLast: boolean[],
  ): React.ReactNode => {
    return nodes.map((node, index) => {
      const isFolder = node.type === 'folder'
      const hasChildren = node.children.length > 0
      const isOpen = isFolder && expanded.has(node.path)
      const isLast = index === nodes.length - 1
      const guides = ancestorLast.map((isLastAncestor, levelIdx) => (
        <span
          key={`guide-${node.path}-${levelIdx}`}
          className={`smtcmp-tree-guide ${isLastAncestor ? 'is-empty' : ''}`}
        />
      ))
      const progressPercent =
        isFolder && node.info
          ? formatProgress(node.info.completedChunks, node.info.totalChunks)
          : ''
      const folderIcon = hasChildren ? (
        isOpen ? (
          <FolderOpen size={16} />
        ) : (
          <FolderClosed size={16} />
        )
      ) : (
        <Folder size={16} />
      )
      const displayIcon =
        node.type === 'folder' ? folderIcon : <FileText size={16} />

      const rowRole = isFolder && hasChildren ? 'button' : undefined
      const rowTabIndex = isFolder && hasChildren ? 0 : -1

      return (
        <li key={node.path || `root-${index}`} className="smtcmp-tree-item">
          <div
            className={`smtcmp-provider-header smtcmp-folder-row${!isFolder ? ' is-file' : ''}`}
            onClick={() => {
              if (isFolder && hasChildren) toggle(node.path)
            }}
            role={rowRole}
            tabIndex={rowTabIndex}
            onKeyDown={(e) => {
              if (!isFolder || !hasChildren) return
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                toggle(node.path)
              }
            }}
          >
            <div className="smtcmp-tree-guides">
              {guides}
              {depth > 0 && (
                <span
                  className={`smtcmp-tree-guide smtcmp-tree-guide-branch${isLast ? ' is-last' : ''}`}
                />
              )}
            </div>
            <div
              className={`smtcmp-provider-expand-btn ${hasChildren && isFolder ? '' : 'no-children'}`}
              onClick={(e) => {
                e.stopPropagation()
                if (isFolder && hasChildren) toggle(node.path)
              }}
            >
              {isFolder && hasChildren ? (
                isOpen ? (
                  <ChevronDown size={16} />
                ) : (
                  <ChevronRight size={16} />
                )
              ) : (
                <span className="smtcmp-icon-placeholder" />
              )}
            </div>
            <div className="smtcmp-tree-icon" aria-hidden="true">
              {displayIcon}
            </div>
            <div className="smtcmp-provider-info">
              <span
                className="smtcmp-provider-id"
                title={node.path || '根目录'}
              >
                {node.name}
              </span>
              {isFolder && (
                <span className="smtcmp-provider-type">
                  {progressPercent || '--'}
                </span>
              )}
            </div>
          </div>
          {hasChildren && isOpen && (
            <ul className="smtcmp-list-reset smtcmp-tree-children">
              {renderNodes(node.children, depth + 1, [...ancestorLast, isLast])}
            </ul>
          )}
        </li>
      )
    })
  }

  return (
    <div className="smtcmp-rag-progress smtcmp-rag-minimal-root">
      {/* 文件夹进度列表（复用 Provider 行样式） */}
      {noProgressYet ? (
        isIndexing ? (
          <div className="smtcmp-rag-progress-folders-list smtcmp-text-faint-small">
            正在准备索引进度...
          </div>
        ) : null
      ) : treeRoots.length > 0 ? (
        <div className="smtcmp-rag-progress-folders-list">
          <ul className="smtcmp-list-reset smtcmp-tree-root">
            {renderNodes(treeRoots, 0, [])}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
