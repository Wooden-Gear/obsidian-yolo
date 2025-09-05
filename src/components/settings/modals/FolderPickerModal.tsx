import { App, Vault } from 'obsidian'
import React, { useMemo, useState } from 'react'

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
  const allFolders = useMemo(() => listAllFolderPaths(vault), [vault])

  const filtered = useMemo(() => {
    const lower = q.toLowerCase()
    return allFolders
      .filter((p) => !existing.includes(p))
      .filter((p) => p.toLowerCase().includes(lower))
  }, [allFolders, existing, q])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <input
        type="text"
        placeholder="搜索文件夹..."
        value={q}
        onChange={(e) => setQ(e.target.value)}
        className="svelte-obsidian-text-input"
      />

      <div style={{ maxHeight: '300px', overflow: 'auto', border: '1px solid var(--background-modifier-border)', borderRadius: '6px' }}>
        {filtered.length === 0 ? (
          <div style={{ padding: '8px', opacity: 0.7 }}>未找到匹配的文件夹</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {filtered.map((p) => (
              <li key={p}>
                <button
                  className="mod-cta"
                  style={{ width: '100%', textAlign: 'left', padding: '8px', border: 'none', background: 'transparent' }}
                  onClick={() => {
                    onPick(p)
                    onClose()
                  }}
                >
                  {p === '' ? '/' : p}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
        <button onClick={onClose} className="mod-cancel">关闭</button>
      </div>
    </div>
  )
}
