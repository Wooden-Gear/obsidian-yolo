import { App } from 'obsidian'
import React, { useMemo, useState, useCallback } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'

import { RECOMMENDED_MODELS_FOR_EMBEDDING } from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import SmartComposerPlugin from '../../../main'
import { findFilesMatchingPatterns } from '../../../utils/glob-utils'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ObsidianDropdown } from '../../common/ObsidianDropdown'
import { ObsidianSetting } from '../../common/ObsidianSetting'
import { ObsidianTextInput } from '../../common/ObsidianTextInput'
import { EmbeddingDbManageModal } from '../modals/EmbeddingDbManageModal'
import { ExcludedFilesModal } from '../modals/ExcludedFilesModal'
import { IncludedFilesModal } from '../modals/IncludedFilesModal'
import { FolderSelectionList } from '../inputs/FolderSelectionList'
import { includePatternsToFolderPaths, folderPathsToIncludePatterns } from '../../../utils/rag-utils'
import { RAGIndexProgress } from '../RAGIndexProgress'
import { IndexProgress } from '../../chat-view/QueryProgress'
import '../RAGIndexProgress.css'

type RAGSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

export function RAGSection({ app, plugin }: RAGSectionProps) {
  const { settings, setSettings } = useSettings()
  const { t } = useLanguage()
  const [indexProgress, setIndexProgress] = useState<IndexProgress | null>(null)
  const [isIndexing, setIsIndexing] = useState(false)
  const [isProgressOpen, setIsProgressOpen] = useState(false)
  const headerPercent = useMemo(() => {
    if (indexProgress && indexProgress.totalChunks > 0) {
      const pct = Math.round((indexProgress.completedChunks / indexProgress.totalChunks) * 100)
      return Math.max(0, Math.min(100, pct))
    }
    try {
      const raw = localStorage.getItem('smtcmp_rag_last_progress')
      if (!raw) return null
      const p = JSON.parse(raw)
      if (p && typeof p.totalChunks === 'number' && p.totalChunks > 0) {
        const pct = Math.round((p.completedChunks / p.totalChunks) * 100)
        return Math.max(0, Math.min(100, pct))
      }
    } catch {}
    return null
  }, [indexProgress, isIndexing])
  
  const includeFolders = useMemo(
    () => includePatternsToFolderPaths(settings.ragOptions.includePatterns),
    [settings.ragOptions.includePatterns],
  )

  const excludeFolders = useMemo(
    () => includePatternsToFolderPaths(settings.ragOptions.excludePatterns),
    [settings.ragOptions.excludePatterns],
  )

  // 处理索引进度更新
  const handleIndexProgress = useCallback((progress: IndexProgress) => {
    setIndexProgress(progress)
  }, [])

  // Minimal conflict detection (exclude overrides include)
  const conflictInfo = useMemo(() => {
    const inc = includeFolders
    const exc = excludeFolders
    const isParentOrSame = (parent: string, child: string) => {
      if (parent === '') return true // root covers all
      if (child === parent) return true
      return child.startsWith(parent + '/')
    }
    const exactConflicts = inc.filter((f) => exc.includes(f))
    const includeUnderExcluded = inc
      .filter((f) => exc.some((e) => isParentOrSame(e, f)))
      .filter((f) => !exactConflicts.includes(f))
    const excludeWithinIncluded = exc
      .filter((e) => inc.some((f) => isParentOrSame(f, e)))
      .filter((e) => !exactConflicts.includes(e))
    return { exactConflicts, includeUnderExcluded, excludeWithinIncluded }
  }, [includeFolders, excludeFolders])

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.rag.title')}</div>

      <ObsidianSetting
        name={t('settings.rag.embeddingModel')}
        desc={t('settings.rag.embeddingModelDesc')}
      >
        <ObsidianDropdown
          value={settings.embeddingModelId}
          options={Object.fromEntries(
            settings.embeddingModels.map((embeddingModel) => [
              embeddingModel.id,
              `${embeddingModel.id}${RECOMMENDED_MODELS_FOR_EMBEDDING.includes(embeddingModel.id) ? ' (Recommended)' : ''}`,
            ]),
          )}
          onChange={async (value) => {
            await setSettings({
              ...settings,
              embeddingModelId: value,
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.rag.includePatterns')}
        desc={t('settings.rag.includePatternsDesc')}
      >
        <ObsidianButton
          text={t('settings.rag.testPatterns')}
          onClick={async () => {
            const patterns = settings.ragOptions.includePatterns
            const includedFiles = await findFilesMatchingPatterns(
              patterns,
              plugin.app.vault,
            )
            new IncludedFilesModal(app, includedFiles, patterns).open()
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting>
        <FolderSelectionList
          app={app}
          vault={plugin.app.vault}
          title={t('settings.rag.selectedFolders', '已选择的文件夹')}
          value={includeFolders}
          onChange={async (folders: string[]) => {
            const patterns = folderPathsToIncludePatterns(folders)
            await setSettings({
              ...settings,
              ragOptions: {
                ...settings.ragOptions,
                includePatterns: patterns,
              },
            })
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.rag.excludePatterns')}
        desc={t('settings.rag.excludePatternsDesc')}
      >
        <ObsidianButton
          text={t('settings.rag.testPatterns')}
          onClick={async () => {
            const patterns = settings.ragOptions.excludePatterns
            const excludedFiles = await findFilesMatchingPatterns(
              patterns,
              plugin.app.vault,
            )
            new ExcludedFilesModal(app, excludedFiles).open()
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting>
        <FolderSelectionList
          app={app}
          vault={plugin.app.vault}
          title={t('settings.rag.excludedFolders', '已排除的文件夹')}
          placeholder={t('settings.rag.selectExcludeFoldersPlaceholder', '点击此处选择要排除的文件夹（留空则不排除）')}
          value={excludeFolders}
          onChange={async (folders: string[]) => {
            const patterns = folderPathsToIncludePatterns(folders)
            await setSettings({
              ...settings,
              ragOptions: {
                ...settings.ragOptions,
                excludePatterns: patterns,
              },
            })
          }}
        />
      </ObsidianSetting>

      {(includeFolders.length === 0 || conflictInfo.exactConflicts.length > 0 || conflictInfo.includeUnderExcluded.length > 0 || conflictInfo.excludeWithinIncluded.length > 0) && (
        <div style={{ margin: '4px 0 8px 0', color: 'var(--text-muted)', fontSize: '12px', lineHeight: 1.4 }}>
          {includeFolders.length === 0 && (
            <div>
              {t('settings.rag.conflictNoteDefaultInclude', '提示：当前未选择包含文件夹，默认包含全部。若设置了排除文件夹，则排除将优先生效。')}
            </div>
          )}
          {conflictInfo.exactConflicts.length > 0 && (
            <div>
              {t('settings.rag.conflictExact', '以下文件夹同时被包含与排除，最终将被排除：')}
              {' '}
              {conflictInfo.exactConflicts.map((f) => (f === '' ? '/' : f)).join(', ')}
            </div>
          )}
          {conflictInfo.includeUnderExcluded.length > 0 && (
            <div>
              {t('settings.rag.conflictParentExclude', '以下包含的文件夹位于已排除的上级之下，最终将被排除：')}
              {' '}
              {conflictInfo.includeUnderExcluded.map((f) => (f === '' ? '/' : f)).join(', ')}
            </div>
          )}
          {conflictInfo.excludeWithinIncluded.length > 0 && (
            <div>
              {t('settings.rag.conflictChildExclude', '以下排除的子文件夹位于包含文件夹之下（局部排除将生效）：')}
              {' '}
              {conflictInfo.excludeWithinIncluded.map((f) => (f === '' ? '/' : f)).join(', ')}
            </div>
          )}
          <div>
            {t('settings.rag.conflictRule', '当包含与排除重叠时，以排除为准。')}
          </div>
        </div>
      )}

      

      <ObsidianSetting
        name={t('settings.rag.chunkSize')}
        desc={t('settings.rag.chunkSizeDesc')}
      >
        <ObsidianTextInput
          value={String(settings.ragOptions.chunkSize)}
          placeholder="1000"
          onChange={async (value) => {
            const chunkSize = parseInt(value, 10)
            if (!isNaN(chunkSize)) {
              await setSettings({
                ...settings,
                ragOptions: {
                  ...settings.ragOptions,
                  chunkSize,
                },
              })
            }
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.rag.thresholdTokens')}
        desc={t('settings.rag.thresholdTokensDesc')}
      >
        <ObsidianTextInput
          value={String(settings.ragOptions.thresholdTokens)}
          placeholder="8192"
          onChange={async (value) => {
            const thresholdTokens = parseInt(value, 10)
            if (!isNaN(thresholdTokens)) {
              await setSettings({
                ...settings,
                ragOptions: {
                  ...settings.ragOptions,
                  thresholdTokens,
                },
              })
            }
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.rag.minSimilarity')}
        desc={t('settings.rag.minSimilarityDesc')}
      >
        <ObsidianTextInput
          value={String(settings.ragOptions.minSimilarity)}
          placeholder="0.0"
          onChange={async (value) => {
            // Allow decimal point and numbers only
            if (!/^[0-9.]*$/.test(value)) return

            // Ignore typing decimal point to prevent interference with the input
            if (value === '.' || value.endsWith('.')) return

            const minSimilarity = parseFloat(value)
            if (!isNaN(minSimilarity)) {
              await setSettings({
                ...settings,
                ragOptions: {
                  ...settings.ragOptions,
                  minSimilarity,
                },
              })
            }
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting
        name={t('settings.rag.limit')}
        desc={t('settings.rag.limitDesc')}
      >
        <ObsidianTextInput
          value={String(settings.ragOptions.limit)}
          placeholder="10"
          onChange={async (value) => {
            const limit = parseInt(value, 10)
            if (!isNaN(limit)) {
              await setSettings({
                ...settings,
                ragOptions: {
                  ...settings.ragOptions,
                  limit,
                },
              })
            }
          }}
        />
      </ObsidianSetting>

      <ObsidianSetting name={t('settings.rag.manageEmbeddingDatabase')}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <ObsidianButton
            text={t('settings.rag.manage')}
            onClick={async () => {
              new EmbeddingDbManageModal(app, plugin).open()
            }}
          />
          <ObsidianButton
            text="重建索引"
            disabled={isIndexing}
            onClick={async () => {
              setIsIndexing(true)
              setIndexProgress(null)
              try {
                const ragEngine = await plugin.getRAGEngine()
                await ragEngine.updateVaultIndex(
                  { reindexAll: true },
                  (queryProgress) => {
                    if (queryProgress.type === 'indexing') {
                      handleIndexProgress(queryProgress.indexProgress)
                    }
                  }
                )
                // 显示完成通知
                plugin.app.workspace.trigger('notice', '索引重建完成')
              } catch (error) {
                console.error('Failed to rebuild index:', error)
                plugin.app.workspace.trigger('notice', '索引重建失败')
              } finally {
                setIsIndexing(false)
                // 清除进度显示
                setTimeout(() => setIndexProgress(null), 3000)
              }
            }}
          />
          <ObsidianButton
            text="更新索引"
            disabled={isIndexing}
            onClick={async () => {
              setIsIndexing(true)
              setIndexProgress(null)
              try {
                const ragEngine = await plugin.getRAGEngine()
                await ragEngine.updateVaultIndex(
                  { reindexAll: false },
                  (queryProgress) => {
                    if (queryProgress.type === 'indexing') {
                      handleIndexProgress(queryProgress.indexProgress)
                    }
                  }
                )
                // 显示完成通知
                plugin.app.workspace.trigger('notice', '索引更新完成')
              } catch (error) {
                console.error('Failed to update index:', error)
                plugin.app.workspace.trigger('notice', '索引更新失败')
              } finally {
                setIsIndexing(false)
                // 清除进度显示
                setTimeout(() => setIndexProgress(null), 3000)
              }
            }}
          />
        </div>
      </ObsidianSetting>

      {/* 折叠：RAG 索引进度（复用 Provider 折叠样式） */}
      <div className="smtcmp-provider-section">
        <div
          className="smtcmp-provider-header"
          onClick={() => setIsProgressOpen((v) => !v)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              setIsProgressOpen((v) => !v)
            }
          }}
          style={{ cursor: 'pointer' }}
        >
          <div className="smtcmp-provider-expand-btn">
            {isProgressOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
          </div>

          <div className="smtcmp-provider-info">
            <span className="smtcmp-provider-id">RAG 索引进度</span>
            {headerPercent !== null ? (
              <span className="smtcmp-provider-type">{headerPercent}%</span>
            ) : (
              <span className="smtcmp-provider-type">{isIndexing ? '进行中' : '未开始'}</span>
            )}
          </div>
        </div>

        {isProgressOpen && (
          <div className="smtcmp-provider-models">
            <RAGIndexProgress 
              progress={indexProgress} 
              isIndexing={isIndexing}
              getMarkdownFilesInFolder={(folderPath: string) => {
                const files = plugin.app.vault.getMarkdownFiles()
                const paths = files.map((f) => f.path)
                if (folderPath === '') {
                  // 根目录：只返回位于根的文件（无斜杠）
                  return paths.filter((p) => !p.includes('/'))
                }
                const prefix = folderPath + '/'
                // 仅返回该文件夹的直接子文件（非递归）
                return paths.filter((p) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
              }}
            />
          </div>
        )}
      </div>
    </div>
  )
}
