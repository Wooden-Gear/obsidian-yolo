import React, { useEffect, useRef, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { IndexProgress } from '../chat-view/QueryProgress'

interface RAGIndexProgressProps {
  progress: IndexProgress | null
  isIndexing: boolean
  // Optional: provide a way to list markdown files under a folder path
  getMarkdownFilesInFolder?: (folderPath: string) => string[]
}

const LS_KEY = 'smtcmp_rag_last_progress'

export function RAGIndexProgress({ progress, isIndexing, getMarkdownFilesInFolder }: RAGIndexProgressProps) {
  // local persisted progress
  const [persistedProgress, setPersistedProgress] = useState<IndexProgress | null>(null)
  // expanded folders
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  // load last progress once when component mounts
  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY)
      if (raw) {
        const obj = JSON.parse(raw)
        setPersistedProgress(obj)
      }
    } catch (e) {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // persist current progress whenever it changes (with shallow guard)
  const lastPersistedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!progress) return
    try {
      const json = JSON.stringify(progress)
      if (lastPersistedRef.current !== json) {
        localStorage.setItem(LS_KEY, json)
        lastPersistedRef.current = json
        setPersistedProgress(progress)
      }
    } catch (e) {
      // ignore
    }
  }, [progress])

  const effectiveProgress = progress ?? persistedProgress
  const noProgressYet = !effectiveProgress

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
  type FolderNode = {
    path: string
    name: string
    info: { completedChunks: number; totalChunks: number }
    children: FolderNode[]
  }

  const treeRoots: FolderNode[] = (() => {
    const fp = effectiveProgress?.folderProgress || {}
    const entries = Object.entries(fp)
    const nodes = new Map<string, FolderNode>()

    // 确保为每个出现的路径建立节点
    for (const [p, info] of entries) {
      const name = p === '' ? '根目录' : formatFolderName(p)
      nodes.set(p, {
        path: p,
        name,
        info: { completedChunks: info.completedChunks || 0, totalChunks: info.totalChunks || 0 },
        children: [],
      })
    }

    // 确保根节点存在
    if (!nodes.has('')) {
      nodes.set('', {
        path: '',
        name: '根目录',
        info: { completedChunks: 0, totalChunks: 0 },
        children: [],
      })
    }

    // 挂接父子关系
    const getParent = (p: string): string => {
      if (!p || !p.includes('/')) return ''
      return p.substring(0, p.lastIndexOf('/'))
    }

    for (const [p] of entries) {
      if (p === '') continue
      const parent = getParent(p)
      let parentNode = nodes.get(parent)
      if (!parentNode) {
        // 父节点缺失时补齐（例如该父级仅作为聚合存在、没有直接文件）
        parentNode = {
          path: parent,
          name: parent === '' ? '根目录' : formatFolderName(parent),
          info: { completedChunks: 0, totalChunks: 0 },
          children: [],
        }
        nodes.set(parent, parentNode)
      }
      const node = nodes.get(p)!
      if (parentNode) parentNode.children.push(node)
    }

    // 排序函数：按名称排序
    const sortNodes = (arr: FolderNode[]) => {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      for (const n of arr) sortNodes(n.children)
    }

    const roots = nodes.get('')?.children ?? []
    sortNodes(roots)
    return roots
  })()

  const renderNode = (node: FolderNode, depth: number) => {
    const progressPercent = formatProgress(node.info.completedChunks, node.info.totalChunks)
    const isOpen = expanded.has(node.path)
    const files = getMarkdownFilesInFolder ? getMarkdownFilesInFolder(node.path) : []

    return (
      <div key={node.path}>
        <div
          className="smtcmp-provider-header"
          style={{ paddingLeft: depth > 0 ? 16 + depth * 12 : undefined }}
          onClick={() => {
            setExpanded((prev) => {
              const next = new Set(prev)
              if (next.has(node.path)) next.delete(node.path)
              else next.add(node.path)
              return next
            })
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setExpanded((prev) => {
                const next = new Set(prev)
                if (next.has(node.path)) next.delete(node.path)
                else next.add(node.path)
                return next
              })
            }
          }}
        >
          <div className="smtcmp-provider-expand-btn">
            {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>
          <div className="smtcmp-provider-info">
            <span className="smtcmp-provider-id" title={node.path}>
              {node.name}
            </span>
            <span className="smtcmp-provider-type">{progressPercent}</span>
          </div>
        </div>

        {isOpen && (
          <div>
            {/* 子文件夹 */}
            {node.children.map((child) => renderNode(child, depth + 1))}

            {/* 当前层级文件 */}
            {files.length > 0 ? (
              <ul className="smtcmp-rag-progress-folder-files" style={{ marginLeft: 16 + depth * 12 }}>
                {files.map((f) => (
                  <li key={f} title={f}>
                    {f.split('/').pop()}
                  </li>
                ))}
              </ul>
            ) : node.children.length === 0 ? (
              <div className="smtcmp-rag-progress-folder-files" style={{ listStyle: 'none', paddingLeft: 0, marginLeft: 16 + depth * 12 }}>
                <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>暂无 Markdown 文件（仅当前层级）</span>
              </div>
            ) : null}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="smtcmp-rag-progress smtcmp-rag-minimal-root">
      {/* 文件夹进度列表（复用 Provider 行样式） */}
      {noProgressYet ? (
        isIndexing ? (
          <div className="smtcmp-rag-progress-folders-list" style={{ color: 'var(--text-faint)', fontSize: 12 }}>
            正在准备索引进度...
          </div>
        ) : null
      ) : (
        treeRoots.length > 0 && (
          <div className="smtcmp-rag-progress-folders-list">
            {treeRoots.map((n) => renderNode(n, 0))}
          </div>
        )
      )}
    </div>
  )
}
