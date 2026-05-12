import { App, Notice, normalizePath } from 'obsidian'
import { useCallback, useRef, useState } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import {
  SettingsProvider,
  useSettings,
} from '../../../contexts/settings-context'
import { getYoloSkillsDir } from '../../../core/paths/yoloPaths'
import {
  type FileEntry,
  type ValidationError,
  parseFrontmatter,
  validateDirectoryPackage,
  validateSingleFileSkill,
} from '../../../core/skills/skillValidation'
import YoloPlugin from '../../../main'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ReactModal } from '../../common/ReactModal'
import { ConfirmModal } from '../../modals/ConfirmModal'

type ImportSkillModalProps = {
  app: App
  plugin: YoloPlugin
  onImported?: () => void
}

export class ImportSkillModal extends ReactModal<ImportSkillModalProps> {
  constructor(app: App, plugin: YoloPlugin, onImported?: () => void) {
    super({
      app,
      Component: ImportSkillModalWrapper,
      props: { app, plugin, onImported },
      options: {
        title: plugin.t('settings.agent.importSkill', 'Import Skill'),
      },
      plugin,
    })
  }
}

function ImportSkillModalWrapper({
  app,
  plugin,
  onImported,
  onClose,
}: ImportSkillModalProps & { onClose: () => void }) {
  return (
    <SettingsProvider
      settings={plugin.settings}
      setSettings={(newSettings) => plugin.setSettings(newSettings)}
      addSettingsChangeListener={(listener) =>
        plugin.addSettingsChangeListener(listener)
      }
    >
      <ImportSkillModalContent
        app={app}
        plugin={plugin}
        onImported={onImported}
        onClose={onClose}
      />
    </SettingsProvider>
  )
}

// ---------------------------------------------------------------------------
// 类型定义
// ---------------------------------------------------------------------------

type SkillPackage = {
  /** 用于文件系统操作的名称（文件名或文件夹名） */
  skillName: string
  /** 从 frontmatter 中解析的 name，用于列表显示 */
  displayName: string
  /** 从 frontmatter 中解析的 description */
  description: string
  files: FileEntry[]
  isDirectory: boolean
}

// ---------------------------------------------------------------------------
// 校验错误转为通俗提示
// ---------------------------------------------------------------------------

type TranslateFn = (key: string, fallback: string) => string

function formatValidationErrors(
  errors: ValidationError[],
  skillName: string,
  t: TranslateFn,
): string {
  const reasons = errors.map((err) => {
    const key = `${err.field}:${err.message}`
    switch (key) {
      case 'SKILL.md:missing':
        return t(
          'settings.agent.importSkillErrNoSkillMd',
          'missing SKILL.md file in folder',
        )
      case 'frontmatter:missing or invalid':
        return t(
          'settings.agent.importSkillErrNoFrontmatter',
          'missing metadata header (---) at the top of the file',
        )
      case 'name:missing':
        return t(
          'settings.agent.importSkillErrNoName',
          'missing "name" field in metadata',
        )
      case 'name:exceeds 64 characters':
        return t(
          'settings.agent.importSkillErrNameTooLong',
          '"name" is too long (max 64 characters)',
        )
      case 'name:uppercase not allowed':
        return t(
          'settings.agent.importSkillErrNameUppercase',
          '"name" must be all lowercase',
        )
      case 'name:cannot start or end with hyphen':
        return t(
          'settings.agent.importSkillErrNameHyphenEdge',
          '"name" cannot start or end with a hyphen',
        )
      case 'name:consecutive hyphens not allowed':
        return t(
          'settings.agent.importSkillErrNameDoubleHyphen',
          '"name" cannot contain consecutive hyphens (--)',
        )
      case 'name:only lowercase letters, numbers, and hyphens allowed':
        return t(
          'settings.agent.importSkillErrNameInvalidChars',
          '"name" can only contain lowercase letters, numbers, and hyphens',
        )
      case 'description:missing':
        return t(
          'settings.agent.importSkillErrNoDescription',
          'missing "description" field in metadata',
        )
      case 'description:exceeds 1024 characters':
        return t(
          'settings.agent.importSkillErrDescTooLong',
          '"description" is too long (max 1024 characters)',
        )
      case 'compatibility:exceeds 500 characters':
        return t(
          'settings.agent.importSkillErrCompatTooLong',
          '"compatibility" is too long (max 500 characters)',
        )
      default:
        // name 与文件夹名不匹配
        if (
          err.field === 'name' &&
          err.message.startsWith('must match folder name')
        ) {
          return t(
            'settings.agent.importSkillErrNameMismatch',
            '"name" must match the folder name',
          )
        }
        return `${err.field}: ${err.message}`
    }
  })

  const header = t(
    'settings.agent.importSkillErrHeader',
    '"{name}" cannot be imported:',
  ).replace('{name}', skillName)

  return `${header}\n${reasons.map((r) => `• ${r}`).join('\n')}`
}

// ---------------------------------------------------------------------------
// 文件系统读取工具函数
// ---------------------------------------------------------------------------

async function readAllFilesFromDirectoryEntry(
  dirEntry: FileSystemDirectoryEntry,
  basePath: string,
): Promise<FileEntry[]> {
  const results: FileEntry[] = []

  const readEntries = (
    reader: FileSystemDirectoryReader,
  ): Promise<FileSystemEntry[]> => {
    return new Promise((resolve, reject) => {
      reader.readEntries(resolve, reject)
    })
  }

  const reader = dirEntry.createReader()
  let entries: FileSystemEntry[] = []
  let batch = await readEntries(reader)
  while (batch.length > 0) {
    entries = entries.concat(batch)
    batch = await readEntries(reader)
  }

  for (const entry of entries) {
    if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      const file = await new Promise<File>((resolve, reject) => {
        fileEntry.file(resolve, reject)
      })
      const content = await file.text()
      const relativePath = basePath
        ? `${basePath}/${fileEntry.name}`
        : fileEntry.name
      results.push({ relativePath, content })
    } else if (entry.isDirectory) {
      const subDirEntry = entry as FileSystemDirectoryEntry
      const subPath = basePath
        ? `${basePath}/${subDirEntry.name}`
        : subDirEntry.name
      const subResults = await readAllFilesFromDirectoryEntry(
        subDirEntry,
        subPath,
      )
      results.push(...subResults)
    }
  }

  return results
}

async function parseSkillPackagesFromDataTransfer(
  items: DataTransferItemList,
): Promise<SkillPackage[]> {
  const packages: SkillPackage[] = []

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    const entry = item.webkitGetAsEntry?.()

    if (!entry) continue

    if (entry.isDirectory) {
      const dirEntry = entry as FileSystemDirectoryEntry
      const files = await readAllFilesFromDirectoryEntry(dirEntry, '')
      packages.push({
        skillName: dirEntry.name,
        displayName: dirEntry.name,
        description: '',
        files,
        isDirectory: true,
      })
    } else if (entry.isFile) {
      const fileEntry = entry as FileSystemFileEntry
      if (
        fileEntry.name.endsWith('.md') ||
        fileEntry.name.endsWith('.markdown')
      ) {
        const file = await new Promise<File>((resolve, reject) => {
          fileEntry.file(resolve, reject)
        })
        const content = await file.text()
        packages.push({
          skillName: fileEntry.name,
          displayName: fileEntry.name,
          description: '',
          files: [{ relativePath: fileEntry.name, content }],
          isDirectory: false,
        })
      }
    }
  }

  return packages
}

function parseSkillPackagesFromFileList(
  files: FileList,
): Promise<SkillPackage[]> {
  return (async () => {
    const fileArray = Array.from(files)
    if (fileArray.length === 0) return []

    const firstRelPath = (fileArray[0] as { webkitRelativePath?: string })
      .webkitRelativePath
    const isFolderMode = !!firstRelPath && firstRelPath.includes('/')

    if (isFolderMode) {
      const groupedByRoot = new Map<string, FileEntry[]>()

      for (const file of fileArray) {
        const relPath =
          (file as { webkitRelativePath?: string }).webkitRelativePath || ''
        if (!relPath) continue

        const slashIdx = relPath.indexOf('/')
        const rootDir = slashIdx > 0 ? relPath.slice(0, slashIdx) : relPath
        const innerPath = slashIdx > 0 ? relPath.slice(slashIdx + 1) : ''
        if (!innerPath) continue

        const content = await file.text()
        const entries = groupedByRoot.get(rootDir) ?? []
        entries.push({ relativePath: innerPath, content })
        groupedByRoot.set(rootDir, entries)
      }

      const packages: SkillPackage[] = []
      for (const [rootDir, entries] of groupedByRoot) {
        if (entries.length > 0) {
          packages.push({
            skillName: rootDir,
            displayName: rootDir,
            description: '',
            files: entries,
            isDirectory: true,
          })
        }
      }
      return packages
    } else {
      const packages: SkillPackage[] = []
      for (const file of fileArray) {
        if (file.name.endsWith('.md') || file.name.endsWith('.markdown')) {
          const content = await file.text()
          packages.push({
            skillName: file.name,
            displayName: file.name,
            description: '',
            files: [{ relativePath: file.name, content }],
            isDirectory: false,
          })
        }
      }
      return packages
    }
  })()
}

// ---------------------------------------------------------------------------
// 主组件
// ---------------------------------------------------------------------------

function ImportSkillModalContent({
  app,
  plugin: _plugin,
  onImported,
  onClose,
}: ImportSkillModalProps & { onClose: () => void }) {
  const { t } = useLanguage()
  const { settings } = useSettings()
  const skillsDir = getYoloSkillsDir(settings)

  const [skillPackages, setSkillPackages] = useState<SkillPackage[]>([])
  const [isDragOver, setIsDragOver] = useState(false)
  const [isImporting, setIsImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const addPackages = useCallback(
    (newPackages: SkillPackage[]) => {
      if (newPackages.length === 0) {
        new Notice(
          t(
            'settings.agent.importSkillInvalidFile',
            'No valid skill files or packages found.',
          ),
        )
        return
      }

      const validPackages: SkillPackage[] = []

      for (const pkg of newPackages) {
        const errors = pkg.isDirectory
          ? validateDirectoryPackage(pkg.skillName, pkg.files)
          : validateSingleFileSkill(pkg.files[0]?.content ?? '')

        if (errors.length > 0) {
          new Notice(formatValidationErrors(errors, pkg.skillName, t))
        } else {
          // 从 frontmatter 中提取 displayName 和 description
          const skillMdContent = pkg.isDirectory
            ? (pkg.files.find((f) => f.relativePath === 'SKILL.md')?.content ??
              '')
            : (pkg.files[0]?.content ?? '')
          const fm = parseFrontmatter(skillMdContent)
          const displayName =
            (typeof fm?.name === 'string' && fm.name.trim()) || pkg.skillName
          const description =
            (typeof fm?.description === 'string' && fm.description.trim()) || ''

          validPackages.push({ ...pkg, displayName, description })
        }
      }

      if (validPackages.length === 0) return

      // 检查是否与 vault 中已有的 skill 重名
      const conflictPackages: SkillPackage[] = []
      const newOnlyPackages: SkillPackage[] = []

      for (const pkg of validPackages) {
        const targetPath = normalizePath(`${skillsDir}/${pkg.skillName}`)
        if (app.vault.getAbstractFileByPath(targetPath)) {
          conflictPackages.push(pkg)
        } else {
          newOnlyPackages.push(pkg)
        }
      }

      if (conflictPackages.length > 0) {
        // 有冲突，弹出确认框
        const modal = new ConfirmModal(app, {
          title: t(
            'settings.agent.importSkillConflictTitle',
            'Skill already exists',
          ),
          message: t(
            'settings.agent.importSkillConflictMessage',
            'A skill with the same name already exists. Do you want to overwrite it?',
          ),
          ctaText: t(
            'settings.agent.importSkillConflictOverwrite',
            'Overwrite',
          ),
          onConfirm: () => {
            // 用户选择覆盖：全部加入列表
            setSkillPackages((prev) => {
              const existingNames = new Set(prev.map((p) => p.skillName))
              const deduped = validPackages.filter(
                (p) => !existingNames.has(p.skillName),
              )
              return [...prev, ...deduped]
            })
          },
          onCancel: () => {
            // 用户选择放弃：只加入无冲突的
            if (newOnlyPackages.length > 0) {
              setSkillPackages((prev) => {
                const existingNames = new Set(prev.map((p) => p.skillName))
                const deduped = newOnlyPackages.filter(
                  (p) => !existingNames.has(p.skillName),
                )
                return [...prev, ...deduped]
              })
            }
          },
        })
        modal.open()
      } else {
        // 无冲突，直接加入列表
        setSkillPackages((prev) => {
          const existingNames = new Set(prev.map((p) => p.skillName))
          const deduped = validPackages.filter(
            (p) => !existingNames.has(p.skillName),
          )
          return [...prev, ...deduped]
        })
      }
    },
    [app, skillsDir, t],
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files
      if (!files || files.length === 0) return

      try {
        const packages = await parseSkillPackagesFromFileList(files)
        addPackages(packages)
      } catch {
        new Notice(
          t('settings.agent.importSkillReadError', 'Failed to read files.'),
        )
      }
      e.target.value = ''
    },
    [addPackages, t],
  )

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(false)

      const items = e.dataTransfer.items
      if (items && items.length > 0) {
        try {
          const packages = await parseSkillPackagesFromDataTransfer(items)
          addPackages(packages)
        } catch {
          new Notice(
            t('settings.agent.importSkillReadError', 'Failed to read files.'),
          )
        }
      }
    },
    [addPackages, t],
  )

  const handleRemovePackage = useCallback((skillName: string) => {
    setSkillPackages((prev) => prev.filter((p) => p.skillName !== skillName))
  }, [])

  const handleImport = useCallback(async () => {
    if (skillPackages.length === 0) return

    setIsImporting(true)
    let successCount = 0

    try {
      // 确保 skills 根目录存在
      if (!app.vault.getAbstractFileByPath(skillsDir)) {
        await app.vault.createFolder(skillsDir)
      }

      for (const pkg of skillPackages) {
        try {
          if (pkg.isDirectory) {
            const pkgDir = normalizePath(`${skillsDir}/${pkg.skillName}`)
            if (!app.vault.getAbstractFileByPath(pkgDir)) {
              await app.vault.createFolder(pkgDir)
            }

            for (const file of pkg.files) {
              const targetPath = normalizePath(`${pkgDir}/${file.relativePath}`)
              const parentDir = targetPath.substring(
                0,
                targetPath.lastIndexOf('/'),
              )
              if (parentDir && !app.vault.getAbstractFileByPath(parentDir)) {
                await app.vault.createFolder(parentDir)
              }

              const existing = app.vault.getAbstractFileByPath(targetPath)
              if (existing) {
                await app.vault.modify(
                  existing as import('obsidian').TFile,
                  file.content,
                )
              } else {
                await app.vault.create(targetPath, file.content)
              }
            }
          } else {
            const targetPath = normalizePath(`${skillsDir}/${pkg.skillName}`)
            const existing = app.vault.getAbstractFileByPath(targetPath)
            if (existing) {
              await app.vault.modify(
                existing as import('obsidian').TFile,
                pkg.files[0].content,
              )
            } else {
              await app.vault.create(targetPath, pkg.files[0].content)
            }
          }
          successCount++
        } catch (err) {
          const message = err instanceof Error ? err.message : 'Unknown error'
          new Notice(
            t(
              'settings.agent.importSkillWriteError',
              'Failed to import {name}: {error}',
            )
              .replace('{name}', pkg.skillName)
              .replace('{error}', message),
          )
        }
      }

      if (successCount > 0) {
        new Notice(
          t(
            'settings.agent.importSkillSuccess',
            'Successfully imported {count} skill(s).',
          ).replace('{count}', String(successCount)),
        )
        onImported?.()
        onClose()
      }
    } finally {
      setIsImporting(false)
    }
  }, [app, skillPackages, skillsDir, t, onImported, onClose])

  const totalFileCount = skillPackages.reduce(
    (sum, pkg) => sum + pkg.files.length,
    0,
  )

  return (
    <div className="yolo-import-skill-modal">
      <div className="yolo-settings-desc yolo-settings-callout">
        {t(
          'settings.agent.importSkillDesc',
          'Import skill packages into {path}. Supports single .md files or Agent Skills standard folders (containing SKILL.md, scripts/, references/, etc.).',
        ).replace('{path}', skillsDir)}
      </div>

      {/* 拖拽区域 */}
      <div
        className={`yolo-import-skill-dropzone ${isDragOver ? 'is-drag-over' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={(e) => void handleDrop(e)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            fileInputRef.current?.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".md,.markdown"
          multiple
          onChange={(e) => void handleFileSelect(e)}
          style={{ display: 'none' }}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error -- webkitdirectory 是非标准属性但广泛支持
          webkitdirectory=""
          multiple
          onChange={(e) => void handleFileSelect(e)}
          style={{ display: 'none' }}
        />
        <div className="yolo-import-skill-dropzone-text">
          {t(
            'settings.agent.importSkillDropzoneText',
            'Drag & drop skill files or folders here',
          )}
        </div>
        <div className="yolo-import-skill-dropzone-buttons">
          <button
            type="button"
            className="yolo-import-skill-browse-btn"
            onClick={(e) => {
              e.stopPropagation()
              fileInputRef.current?.click()
            }}
          >
            {t('settings.agent.importSkillBrowseFiles', 'Browse Files')}
          </button>
          <button
            type="button"
            className="yolo-import-skill-browse-btn"
            onClick={(e) => {
              e.stopPropagation()
              folderInputRef.current?.click()
            }}
          >
            {t('settings.agent.importSkillBrowseFolder', 'Browse Folder')}
          </button>
        </div>
      </div>

      {/* 已选 skill 包列表 */}
      {skillPackages.length > 0 && (
        <div className="yolo-import-skill-file-list">
          <div className="yolo-import-skill-file-list-title">
            {t(
              'settings.agent.importSkillFileCount',
              '{count} skill(s) selected ({files} files total)',
            )
              .replace('{count}', String(skillPackages.length))
              .replace('{files}', String(totalFileCount))}
          </div>
          {skillPackages.map((pkg) => (
            <div key={pkg.skillName} className="yolo-import-skill-file-item">
              <div className="yolo-import-skill-file-info">
                <span className="yolo-import-skill-file-name">
                  {pkg.displayName}
                </span>
                {pkg.description && (
                  <span className="yolo-import-skill-file-desc">
                    {pkg.description}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="yolo-import-skill-file-remove"
                onClick={() => handleRemovePackage(pkg.skillName)}
                aria-label={t('settings.agent.importSkillRemoveFile', 'Remove')}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 操作按钮 */}
      <div className="yolo-import-skill-actions">
        <ObsidianButton
          text={t('settings.agent.importSkillConfirm', 'Import')}
          cta
          disabled={skillPackages.length === 0 || isImporting}
          onClick={() => void handleImport()}
        />
      </div>
    </div>
  )
}
