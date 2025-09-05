import React, { useEffect, useMemo, useRef, useState } from 'react'
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
  if (!effectiveProgress) {
    // 索引启动瞬间进度尚未到达时，给出占位，避免“展开后空白”
    return isIndexing ? (
      <div className="smtcmp-rag-progress smtcmp-rag-minimal-root">
        <div className="smtcmp-rag-progress-folders-list" style={{ color: 'var(--text-faint)', fontSize: 12 }}>
          正在准备索引进度...
        </div>
      </div>
    ) : null
  }

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

  // 获取文件夹列表并排序
  const folders = effectiveProgress.folderProgress
    ? Object.entries(effectiveProgress.folderProgress).sort(([a], [b]) => {
        if (a === '') return -1 // 根目录优先
        if (b === '') return 1
        return a.localeCompare(b)
      })
    : []

  return (
    <div className="smtcmp-rag-progress smtcmp-rag-minimal-root">
      {/* 文件夹进度列表（复用 Provider 行样式） */}
      {folders.length > 0 && (
        <div className="smtcmp-rag-progress-folders-list">
          {folders.map(([folderPath, folderInfo]) => {
            const progressPercent = formatProgress(folderInfo.completedChunks, folderInfo.totalChunks)
            const isOpen = expanded.has(folderPath)
            const files = getMarkdownFilesInFolder ? getMarkdownFilesInFolder(folderPath) : []

            return (
              <div key={folderPath}>
                <div
                  className="smtcmp-provider-header"
                  onClick={() => {
                    setExpanded((prev) => {
                      const next = new Set(prev)
                      if (next.has(folderPath)) next.delete(folderPath)
                      else next.add(folderPath)
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
                        if (next.has(folderPath)) next.delete(folderPath)
                        else next.add(folderPath)
                        return next
                      })
                    }
                  }}
                >
                  <div className="smtcmp-provider-expand-btn">
                    {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  </div>
                  <div className="smtcmp-provider-info">
                    <span className="smtcmp-provider-id" title={folderPath}>
                      {formatFolderName(folderPath)}
                    </span>
                    <span className="smtcmp-provider-type">{progressPercent}</span>
                  </div>
                </div>
                {isOpen && (
                  files.length > 0 ? (
                    <ul className="smtcmp-rag-progress-folder-files">
                      {files.map((f) => (
                        <li key={f} title={f}>
                          {f.split('/').pop()}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className="smtcmp-rag-progress-folder-files" style={{ listStyle: 'none', paddingLeft: 0 }}>
                      <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>暂无 Markdown 文件（仅当前层级）</span>
                    </div>
                  )
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
