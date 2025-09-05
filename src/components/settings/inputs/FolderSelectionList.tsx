import React, { useMemo, useRef, useState } from 'react'
import { App, Vault } from 'obsidian'

import { FolderPickerModal } from '../modals/FolderPickerModal'
import { useLanguage } from '../../../contexts/language-context'

export type FolderSelectionListProps = {
  app: App
  vault: Vault
  value: string[]
  onChange: (folders: string[]) => void
  title?: string
  placeholder?: string
}

/**
 * A minimal folder selection list with add/remove and drag-and-drop reordering.
 * Style aims to resemble Obsidian's file list while keeping zero external deps.
 */
export function FolderSelectionList({ app, vault, value, onChange, title, placeholder }: FolderSelectionListProps) {
  const { t } = useLanguage()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const overIndexRef = useRef<number | null>(null)

  // Normalize any incoming folder values to avoid duplicates like '/', '**', 'path/'
  const normalize = (p: string): string => {
    if (!p || p === '/' || p === '**') return ''
    // common patterns to folder path
    // <folder>/**/*, <folder>/**/*.md, <folder>/*, <folder>/*.md
    const m1 = p.match(/^(.*)\/\*\*\/(?:\*|\*\.md)$/)
    if (m1) return m1[1].replace(/^\/+/, '').replace(/\/+$/, '')
    const m2 = p.match(/^(.*)\/\*\.md$/)
    if (m2) return m2[1].replace(/^\/+/, '').replace(/\/+$/, '')
    // if contains any wildcard, treat as root
    if (p.includes('*')) return ''
    return p.replace(/^\/+/, '').replace(/\/+$/, '')
  }

  const items = useMemo(() => value.map(normalize), [value])

  const handleAdd = () => {
    new FolderPickerModal(app, vault, items, (picked) => {
      const np = normalize(picked)
      if (items.includes(np)) return
      onChange([...items, np])
    }).open()
  }

  const handleClear = () => {
    if (items.length === 0) return
    onChange([])
  }

  const handleRemove = (idx: number) => {
    const next = items.slice()
    next.splice(idx, 1)
    onChange(next)
  }

  const moveItem = (from: number, to: number) => {
    if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return
    const next = items.slice()
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onChange(next)
  }

  const onDragStart = (idx: number) => (e: React.DragEvent) => {
    setDragIndex(idx)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', String(idx))
  }
  const onDragOver = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault()
    overIndexRef.current = idx
  }
  const onDrop = (idx: number) => (e: React.DragEvent) => {
    e.preventDefault()
    const fromStr = e.dataTransfer.getData('text/plain')
    const from = fromStr ? parseInt(fromStr, 10) : dragIndex
    if (from == null) return
    moveItem(from, idx)
    setDragIndex(null)
    overIndexRef.current = null
  }
  const onDragEnd = () => {
    setDragIndex(null)
    overIndexRef.current = null
  }

  // Click handler for the container (bordered box)
  const onContainerClick = (_e: React.MouseEvent<HTMLDivElement>) => {
    // Clicking anywhere in the container opens the picker.
    handleAdd()
  }

  return (
    <div className="smtcmp-folder-selection" style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '8px',
        }}
      >
        <div style={{ fontWeight: 600, opacity: 0.8 }}>
          {title ?? t('settings.rag.selectedFolders', '已选择的文件夹')}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            aria-label={t('common.add', '添加')}
            title={t('common.add', '添加')}
            onClick={() => handleAdd()}
            style={{
              border: '1px solid var(--background-modifier-border)',
              borderRadius: '0px',
              background: 'var(--background-primary)',
              color: 'var(--text-muted)',
              padding: '0 6px',
              height: '20px',
              lineHeight: '20px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            +
          </button>
          <button
            aria-label={t('common.clear', '清空')}
            title={t('common.clear', '清空')}
            onClick={() => handleClear()}
            style={{
              border: '1px solid var(--background-modifier-border)',
              borderRadius: '0px',
              background: 'var(--background-primary)',
              color: 'var(--text-muted)',
              padding: '0 6px',
              height: '20px',
              lineHeight: '20px',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            {t('common.clear', '清空')}
          </button>
        </div>
      </div>

      <div
        onClick={onContainerClick}
        style={{
          border: '1px solid var(--background-modifier-border)',
          borderRadius: '0px',
          padding: '6px 8px',
          minHeight: '32px',
          position: 'relative',
        }}
      >
        {items.length === 0 ? (
          <div style={{ opacity: 0.7 }}>
            {placeholder ?? t('settings.rag.selectFoldersPlaceholder', '点击此处选择文件夹（留空则默认包含全部）')}
          </div>
        ) : (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '6px',
            }}
          >
            {items.map((p, idx) => (
              <div
                key={`${p}__${idx}`}
                draggable
                onDragStart={onDragStart(idx)}
                onDragOver={onDragOver(idx)}
                onDrop={onDrop(idx)}
                onDragEnd={onDragEnd}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 6px',
                  border: '1px solid var(--background-modifier-border)',
                  borderRadius: '0px',
                  background: dragIndex === idx ? 'var(--background-secondary)' : 'var(--background-secondary)',
                  cursor: 'grab',
                  userSelect: 'none',
                }}
              >
                <span style={{ opacity: 0.5, fontSize: '12px' }}>⋮⋮</span>
                <span style={{ fontFamily: 'var(--font-monospace)', fontSize: '12px' }}>{p === '' ? '/' : p}</span>
                <span
                  role="button"
                  aria-label={t('common.remove', '移除')}
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleRemove(idx)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      handleRemove(idx)
                    }
                  }}
                  style={{
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '12px',
                    lineHeight: 1,
                    userSelect: 'none',
                  }}
                >
                  ×
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
