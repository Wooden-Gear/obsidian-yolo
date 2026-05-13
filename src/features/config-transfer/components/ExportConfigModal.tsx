import { App, Notice } from 'obsidian'
import React, { useMemo, useState } from 'react'

import { ReactModal } from '../../../components/common/ReactModal'
import { useLanguage } from '../../../contexts/language-context'
import YoloPlugin from '../../../main'
import { EXPORTABLE_CONFIG_KEYS } from '../config-keys'
import { buildExportData } from '../export-config'
import { hasNonEmptyCredentials } from '../redact'

type ExportConfigModalComponentProps = {
  plugin: YoloPlugin
}

export class ExportConfigModal extends ReactModal<ExportConfigModalComponentProps> {
  constructor(app: App, plugin: YoloPlugin) {
    super({
      app,
      Component: ExportConfigModalComponent,
      props: { plugin },
      options: {
        title: plugin.t('configTransfer.export.title', '导出配置'),
      },
      plugin,
    })
  }
}

function ExportConfigModalComponent({
  plugin,
  onClose,
}: ExportConfigModalComponentProps & { onClose: () => void }) {
  const { t } = useLanguage()
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(EXPORTABLE_CONFIG_KEYS.map((k) => k.key)),
  )
  const [redacted, setRedacted] = useState(false)

  // 基于当前实际配置探测每个顶层 key 是否含有非空凭证；
  // 取自 plugin.settings 而非懒加载 loadData()，因为 settings 已在内存且
  // 包含所有 schema 内字段，仅用于 UI 标记，不影响导出流程的真实数据来源。
  const credentialsByKey = useMemo(() => {
    const settings = plugin.settings as unknown as Record<string, unknown>
    const map: Record<string, boolean> = {}
    for (const item of EXPORTABLE_CONFIG_KEYS) {
      map[item.key] = hasNonEmptyCredentials(settings?.[item.key])
    }
    return map
  }, [plugin.settings])

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
      new Notice(
        t('configTransfer.export.noticeAtLeastOne', '请至少选择一项配置'),
      )
      return
    }

    try {
      const settingsData = (await plugin.loadData()) as Record<
        string,
        unknown
      > | null
      if (!settingsData || typeof settingsData !== 'object') {
        new Notice(
          t('configTransfer.export.noticeReadFailed', '无法读取当前配置数据'),
        )
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

      const successTemplate = t(
        'configTransfer.export.noticeSuccess',
        '配置已导出为 {fileName}',
      )
      new Notice(successTemplate.replace('{fileName}', fileName))
      onClose()
    } catch (err) {
      console.error('Failed to export config', err)
      new Notice(
        t(
          'configTransfer.export.noticeFailed',
          '配置导出失败，请检查控制台日志',
        ),
      )
    }
  }

  return (
    <div className="yolo-config-transfer-modal">
      <div className="yolo-config-transfer-toolbar">
        <div className="yolo-config-transfer-desc">
          {t('configTransfer.export.description', '选择要导出的配置项')}
        </div>
        <div className="yolo-config-transfer-toolbar-actions">
          <button onClick={selectAll}>
            {t('configTransfer.export.selectAll', '全选')}
          </button>
          <button onClick={selectNone}>
            {t('configTransfer.export.selectNone', '全不选')}
          </button>
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
              {t(`configTransfer.keyLabels.${item.key}`, item.fallbackLabel)}
              <span className="yolo-config-transfer-item-key">{item.key}</span>
            </span>
            {credentialsByKey[item.key] && (
              <span className="yolo-config-transfer-sensitive">
                {t('configTransfer.export.sensitive', '含凭证')}
              </span>
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
        {t(
          'configTransfer.export.redactedOption',
          '脱敏导出（替换 API Key / 密码 / Header / 环境变量等凭证为随机字符串）',
        )}
      </label>

      <div className="modal-button-container">
        <button className="mod-cta" onClick={() => void handleExport()}>
          {t('configTransfer.export.submit', '导出')}
        </button>
        <button className="mod-cancel" onClick={onClose}>
          {t('configTransfer.export.cancel', '取消')}
        </button>
      </div>
    </div>
  )
}
