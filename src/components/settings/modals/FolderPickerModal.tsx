import { App, Vault } from 'obsidian'
import React, { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { ReactModal } from '../../common/ReactModal'
import { listAllFolderPaths } from '../../../utils/rag-utils'

type FolderPickerModalProps = {
  vault: Vault
  existing: string[]
  onPick: (folderPath: string) => void
  onClose: () => void
}

export class FolderPickerModal extends ReactModal<FolderPickerModalProps> {
  constructor(app: App, vault: Vault, existing: string[], onPick: (folderPath: string) => void) {
    super({
      app,
      Component: FolderPickerModalComponent,
      props: { vault, existing, onPick },
      options: { title: '选择文件夹' },
    })
  }
}

function FolderPickerModalComponent({ vault, existing, onPick, onClose }: FolderPickerModalProps) {
  const [q, setQ] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(['']))
  const allFolders = useMemo(() => listAllFolderPaths(vault), [vault])

  type Node = { path: string; name: string; children: Node[] }

  const roots: Node[] = useMemo(() => {
    // build nodes
    const nodes = new Map<string, Node>()
    const ensure = (p: string): Node => {
      const norm = p
      if (nodes.has(norm)) return nodes.get(norm)!
      const name = norm === '' ? '/' : norm.split('/').pop()!
      const n: Node = { path: norm, name, children: [] }
      nodes.set(norm, n)
      return n
    }

    for (const p of allFolders) {
      ensure(p)
    }
    // attach parents
    const parentOf = (p: string) => {
      if (!p || !p.includes('/')) return ''
      return p.substring(0, p.lastIndexOf('/'))
    }
    for (const p of allFolders) {
      if (p === '') continue
      const parent = ensure(parentOf(p))
      const node = ensure(p)
      parent.children.push(node)
    }

    const sortRec = (arr: Node[]) => {
      arr.sort((a, b) => a.name.localeCompare(b.name))
      for (const n of arr) sortRec(n.children)
    }
    const r = ensure('').children
    sortRec(r)
    return r
  }, [allFolders])

  // filter tree by query (show matches and their ancestors)
  const filteredRoots: Node[] = useMemo(() => {
    const lower = q.trim().toLowerCase()
    if (!lower) return roots
    const filterRec = (node: Node): Node | null => {
      const selfMatch = node.path.toLowerCase().includes(lower) || node.name.toLowerCase().includes(lower)
      const childMatches = node.children
        .map(filterRec)
        .filter((x): x is Node => x !== null)
      if (selfMatch || childMatches.length > 0) {
        return { ...node, children: childMatches }
      }
      return null
    }
    const out = roots
      .map(filterRec)
      .filter((x): x is Node => x !== null)
    return out
  }, [q, roots])

  // auto-expand when searching so matched nodes are visible
  React.useEffect(() => {
    const lower = q.trim().toLowerCase()
    if (!lower) return
    const collect = (ns: Node[], acc: Set<string>) => {
      for (const n of ns) {
        acc.add(n.path)
        collect(n.children, acc)
      }
    }
    const next = new Set<string>(expanded)
    collect(filteredRoots, next)
    setExpanded(next)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filteredRoots])

  const toggle = (p: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(p)) next.delete(p)
      else next.add(p)
      return next
    })
  }

  const [hovered, setHovered] = useState<string | null>(null)

  const renderNode = (node: Node, depth: number) => {
    const hasChildren = node.children.length > 0
    const isOpen = expanded.has(node.path)
    const isSelected = existing.includes(node.path)
    const isCoveredByAncestor = existing.some(
      (p) => p !== node.path && (p === '' || node.path === p || node.path.startsWith(p + '/')),
    )
    const isDisabled = isSelected || isCoveredByAncestor
    return (
      <li key={node.path}>
        <div
          className="smtcmp-provider-header"
          style={{
            paddingLeft: 8 + depth * 12,
            cursor: isDisabled ? 'not-allowed' : 'pointer',
            backgroundColor: hovered === node.path ? 'var(--background-modifier-hover)' : 'transparent',
            borderRadius: 0,
            boxShadow: 'none',
            border: 0,
          }}
          onMouseEnter={() => setHovered(node.path)}
          onMouseLeave={() => setHovered((h) => (h === node.path ? null : h))}
          onClick={() => {
            if (isDisabled) return
            onPick(node.path)
            onClose()
          }}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (isDisabled) return
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onPick(node.path)
              onClose()
            }
          }}
        >
          <div
            className="smtcmp-provider-expand-btn"
            style={{ visibility: hasChildren ? 'visible' : 'hidden' }}
            onClick={(e) => {
              e.stopPropagation()
              if (hasChildren) toggle(node.path)
            }}
          >
            {hasChildren ? (isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />) : <span style={{ display: 'inline-block', width: 16 }} />}
          </div>
          <div className="smtcmp-provider-info">
            <span
              title={isSelected ? '已选择' : (isCoveredByAncestor ? '已被父级覆盖' : (node.path === '' ? '/' : node.path))}
              style={{
                outline: 'none',
                boxShadow: 'none',
                border: 'none',
                background: 'transparent',
                padding: 0,
                textAlign: 'left',
                color: isDisabled ? 'var(--text-faint)' : 'var(--text-normal)',
                borderRadius: 0,
                pointerEvents: 'none',
              }}
            >
              {node.name}
            </span>
          </div>
        </div>
        {hasChildren && isOpen && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {node.children.map((c) => renderNode(c, depth + 1))}
          </ul>
        )}
      </li>
    )
  }

  return (
    <div className="smtcmp-folder-picker" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        type="text"
        placeholder="搜索文件夹..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="svelte-obsidian-text-input"
      />

      <div style={{ maxHeight: '300px', overflow: 'auto' }}>
        {filteredRoots.length === 0 ? (
          <div style={{ padding: '8px', opacity: 0.7 }}>未找到匹配的文件夹</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filteredRoots.map((n) => renderNode(n, 0))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onClose} className="mod-cancel">关闭</button>
      </div>
    </div>
  )
}
