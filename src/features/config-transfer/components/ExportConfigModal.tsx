import { App, Notice } from 'obsidian'
import React, { useState } from 'react'

import { ReactModal } from '../../../components/common/ReactModal'
import YoloPlugin from '../../../main'
import { EXPORTABLE_CONFIG_KEYS } from '../config-keys'
import { buildExportData } from '../export-config'

type ExportConfigModalComponentProps = {
  plugin: YoloPlugin
}

export class ExportConfigModal extends ReactModal<ExportConfigModalComponentProps> {
  constructor(app: App, plugin: YoloPlugin) {
    super({
      app,
      Component: ExportConfigModalComponent,
      props: { plugin },
      options: { title: '导出配置' },
      plugin,
    })
  }
}

function ExportConfigModalComponent({
  plugin,
  onClose,
}: ExportConfigModalComponentProps & { onClose: () => void }) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(EXPORTABLE_CONFIG_KEYS.map((k) => k.key)),
  )
  const [redacted, setRedacted] = useState(false)

  const toggleKey = (key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedKeys(new Set(EXPORTABLE_CONFIG_KEYS.map((k) => k.key)))
  }

  const selectNone = () => {
    setSelectedKeys(new Set())
  }

  const handleExport = async () => {
    if (selectedKeys.size === 0) {
      new Notice('请至少选择一项配置')
      return
    }

    try {
      const settingsData = (await plugin.loadData()) as Record<
        string,
        unknown
      > | null
      if (!settingsData || typeof settingsData !== 'object') {
        new Notice('无法读取当前配置数据')
        return
      }

      const manifest = plugin.manifest

      const exportData = await buildExportData({
        keys: Array.from(selectedKeys),
        settingsData,
        pluginVersion: manifest.version,
        redacted,
      })

      const json = JSON.stringify(exportData, null, 2)
      const dateStr = new Date().toISOString().slice(0, 10)
      const fileName = `yolo-config-${dateStr}.json`

      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)

      new Notice(`配置已导出为 ${fileName}`)
      onClose()
    } catch (err) {
      console.error('Failed to export config', err)
      new Notice('配置导出失败，请检查控制台日志')
    }
  }

  return (
    <div className="yolo-config-transfer-modal">
      <div className="yolo-config-transfer-toolbar">
        <div className="yolo-config-transfer-desc">选择要导出的配置项</div>
        <div className="yolo-config-transfer-toolbar-actions">
          <button onClick={selectAll}>全选</button>
          <button onClick={selectNone}>全不选</button>
        </div>
      </div>

      <div className="yolo-config-transfer-list">
        {EXPORTABLE_CONFIG_KEYS.map((item) => (
          <label key={item.key} className="yolo-config-transfer-item">
            <input
              type="checkbox"
              checked={selectedKeys.has(item.key)}
              onChange={() => toggleKey(item.key)}
            />
            <span className="yolo-config-transfer-item-label">
              {item.label}
              <span className="yolo-config-transfer-item-key">{item.key}</span>
            </span>
            {item.sensitive && (
              <span className="yolo-config-transfer-sensitive">含 API Key</span>
            )}
          </label>
        ))}
      </div>

      <label className="yolo-config-transfer-option">
        <input
          type="checkbox"
          checked={redacted}
          onChange={(e) => setRedacted(e.target.checked)}
        />
        脱敏导出（将 API Key 替换为随机字符串）
      </label>

      <div className="modal-button-container">
        <button className="mod-cta" onClick={() => void handleExport()}>
          导出
        </button>
        <button className="mod-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  )
}
