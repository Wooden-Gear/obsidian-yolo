import { App, Notice, Platform } from 'obsidian'
import React, { useCallback, useState } from 'react'

import { ReactModal } from '../../../components/common/ReactModal'
import YoloPlugin from '../../../main'
import { EXCLUDED_KEYS, EXPORTABLE_CONFIG_KEYS } from '../config-keys'
import {
  applyImport,
  parseVaultData,
  validateExportFile,
} from '../import-config'
import { ConfigExportFile, MergeStrategy } from '../types'

type ImportConfigModalComponentProps = {
  plugin: YoloPlugin
}

export class ImportConfigModal extends ReactModal<ImportConfigModalComponentProps> {
  constructor(app: App, plugin: YoloPlugin) {
    super({
      app,
      Component: ImportConfigModalComponent,
      props: { plugin },
      options: { title: '导入配置' },
      plugin,
    })
  }
}

type ImportStep = 'source' | 'select'

function ImportConfigModalComponent({
  plugin,
  onClose,
}: ImportConfigModalComponentProps & { onClose: () => void }) {
  const [step, setStep] = useState<ImportStep>('source')
  const [importData, setImportData] = useState<ConfigExportFile | null>(null)
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set())
  const [mergeStrategy, setMergeStrategy] = useState<MergeStrategy>('overwrite')

  const handleFileImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return

      try {
        const text = await file.text()
        let raw: unknown
        try {
          raw = JSON.parse(text)
        } catch {
          new Notice(
            '文件不是有效的 JSON 格式，请确认选择了正确的配置文件。',
            5000,
          )
          return
        }
        const result = await validateExportFile(raw)
        if (!result.valid) {
          new Notice(result.error, 5000)
          return
        }
        setImportData(result.data)
        setSelectedKeys(new Set(result.data.keys))
        setStep('select')
        if (result.data.redacted) {
          new Notice('注意：该配置为脱敏导出，API Key 需导入后手动补填', 5000)
        }
      } catch {
        new Notice('文件读取失败，请重试。', 5000)
      }
    }
    input.click()
  }, [])

  const handleVaultImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
    input.onchange = async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (!files || files.length === 0) return

      let dataJsonFile: File | null = null
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const relativePath = file.webkitRelativePath
        // 在外部笔记库中查找 YOLO 配置文件，需要匹配常见的配置目录名
        /* eslint-disable obsidianmd/hardcoded-config-path */
        const configDirPatterns = [
          '.obsidian/plugins/yolo/data.json',
          '.obsidian/plugins/obsidian-yolo/data.json',
        ]
        /* eslint-enable obsidianmd/hardcoded-config-path */
        if (
          configDirPatterns.some((pattern) => relativePath.includes(pattern))
        ) {
          dataJsonFile = file
          break
        }
      }

      if (!dataJsonFile) {
        new Notice('未在该目录找到 YOLO 插件配置', 5000)
        return
      }

      try {
        const text = await dataJsonFile.text()
        let raw: unknown
        try {
          raw = JSON.parse(text)
        } catch {
          new Notice('配置文件不是有效的 JSON 格式', 5000)
          return
        }
        const result = parseVaultData(raw, plugin.manifest.version)
        if (!result.valid) {
          new Notice(result.error, 5000)
          return
        }
        setImportData(result.data)
        setSelectedKeys(
          new Set(result.data.keys.filter((k) => !EXCLUDED_KEYS.has(k))),
        )
        setStep('select')
      } catch {
        new Notice('配置文件读取失败', 5000)
      }
    }
    input.click()
  }, [plugin])

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
    if (importData) {
      setSelectedKeys(
        new Set(importData.keys.filter((k) => !EXCLUDED_KEYS.has(k))),
      )
    }
  }

  const selectNone = () => {
    setSelectedKeys(new Set())
  }

  const handleImport = async () => {
    if (!importData) return
    if (selectedKeys.size === 0) {
      new Notice('请至少选择一项配置')
      return
    }

    try {
      const currentSettings = plugin.settings
      const result = applyImport({
        importData,
        selectedKeys: Array.from(selectedKeys),
        currentSettings,
        mergeStrategy,
      })

      await plugin.setSettings(result)
      new Notice('配置导入成功')

      if (importData.redacted) {
        new Notice('注意：该配置为脱敏导出，API Key 需手动补填', 5000)
      }

      onClose()
    } catch (err) {
      console.error('Failed to import config', err)
      new Notice('配置导入失败，请检查控制台日志')
    }
  }

  const availableKeys = importData
    ? EXPORTABLE_CONFIG_KEYS.filter((k) => importData.keys.includes(k.key))
    : []

  const extraKeys = importData
    ? importData.keys.filter(
        (k) =>
          !EXCLUDED_KEYS.has(k) &&
          !EXPORTABLE_CONFIG_KEYS.some((ek) => ek.key === k),
      )
    : []

  if (step === 'source') {
    return (
      <div className="yolo-config-transfer-modal">
        <div className="yolo-config-transfer-source-buttons">
          <button
            className="yolo-config-transfer-source-btn"
            onClick={handleFileImport}
          >
            <strong>从配置文件导入</strong>
            <span>选择之前导出的 .json 文件</span>
          </button>

          {Platform.isDesktop && (
            <button
              className="yolo-config-transfer-source-btn"
              onClick={handleVaultImport}
            >
              <strong>从其他笔记库导入</strong>
              <span>选择已安装 YOLO 的笔记库目录</span>
            </button>
          )}
        </div>

        <div className="modal-button-container">
          <button className="mod-cancel" onClick={onClose}>
            取消
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="yolo-config-transfer-modal">
      <div className="yolo-config-transfer-toolbar">
        <div className="yolo-config-transfer-desc">选择要导入的配置项</div>
        <div className="yolo-config-transfer-toolbar-actions">
          <button onClick={selectAll}>全选</button>
          <button onClick={selectNone}>全不选</button>
        </div>
      </div>

      <div className="yolo-config-transfer-list">
        {availableKeys.map((item) => (
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
        {extraKeys.map((key) => (
          <label key={key} className="yolo-config-transfer-item">
            <input
              type="checkbox"
              checked={selectedKeys.has(key)}
              onChange={() => toggleKey(key)}
            />
            <span className="yolo-config-transfer-item-label">
              {key}
              <span className="yolo-config-transfer-item-key">{key}</span>
            </span>
          </label>
        ))}
      </div>

      <div className="yolo-config-transfer-strategy">
        <label
          className={`yolo-config-transfer-strategy-option${mergeStrategy === 'overwrite' ? ' is-selected' : ''}`}
          onClick={() => setMergeStrategy('overwrite')}
        >
          <span className="yolo-config-transfer-radio">
            {mergeStrategy === 'overwrite' && (
              <span className="yolo-config-transfer-radio-dot" />
            )}
          </span>
          <span>
            <strong>全量覆盖</strong> — 用导入的配置替换选中项
          </span>
        </label>
        <label
          className={`yolo-config-transfer-strategy-option${mergeStrategy === 'merge' ? ' is-selected' : ''}`}
          onClick={() => setMergeStrategy('merge')}
        >
          <span className="yolo-config-transfer-radio">
            {mergeStrategy === 'merge' && (
              <span className="yolo-config-transfer-radio-dot" />
            )}
          </span>
          <span>
            <strong>JSON 合并</strong> — 深度合并，保留未冲突的现有值
          </span>
        </label>
      </div>

      <div className="modal-button-container">
        <button className="mod-cta" onClick={() => void handleImport()}>
          确认导入
        </button>
        <button className="mod-cancel" onClick={() => setStep('source')}>
          返回
        </button>
        <button className="mod-cancel" onClick={onClose}>
          取消
        </button>
      </div>
    </div>
  )
}
