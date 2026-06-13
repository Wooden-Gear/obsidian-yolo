import { X } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Root, createRoot } from 'react-dom/client'

import { LanguageProvider, useLanguage } from '../contexts/language-context'
import { PluginProvider, usePlugin } from '../contexts/plugin-context'
import { parseChangelog } from '../core/update/updateChecker'
import { openCommunityPluginsSettings } from '../core/update/openCommunityPluginsSettings'
import { usePluginUpdate } from '../hooks/usePluginUpdate'
import { useUpdateCheck } from '../hooks/useUpdateCheck'
import type YoloPlugin from '../main'

import { UpdateHistoryModal } from './modals/UpdateHistoryModal'
import { UpdateChangelogSections } from './update/UpdateChangelogSections'
import {
  type ReleaseLanguage,
  hasBilingualReleaseNotes,
  resolveDefaultLanguage,
} from './update/updateReleaseLanguage'

function UpdateToast() {
  const { language, t } = useLanguage()
  const plugin = usePlugin()
  const { app } = plugin
  const { result, dismissVersion } = useUpdateCheck()
  const { state: updateState, canSelfUpdate, startDownload, applyUpdate } =
    usePluginUpdate()

  const [exiting, setExiting] = useState(false)
  const [hiddenForSession, setHiddenForSession] = useState(false)
  const [lang, setLang] = useState<ReleaseLanguage>('en')

  // Reset transient view state whenever a different version surfaces.
  const latestVersion = result?.latestVersion ?? null
  useEffect(() => {
    if (result) {
      setExiting(false)
      setHiddenForSession(false)
      setLang(resolveDefaultLanguage(result.releaseNotes, language))
    }
  }, [latestVersion, language, result])

  // Closing plays the exit animation first, then persists the dismissal state
  // (which unmounts the card). Timer-driven rather than onAnimationEnd so it still fires under
  // prefers-reduced-motion (where the animation is disabled). Keep in sync with
  // the 160ms exit duration in input.css.
  useEffect(() => {
    if (!exiting || !result) return
    const id = window.setTimeout(
      () => dismissVersion(result.latestVersion),
      160,
    )
    return () => window.clearTimeout(id)
  }, [dismissVersion, exiting, result])

  const releaseNotes = result?.releaseNotes
  // The header (title + subtitle) tracks the UI's default language; only the
  // body changelog follows the 中文/EN toggle.
  const headerLang = releaseNotes
    ? resolveDefaultLanguage(releaseNotes, language)
    : 'en'
  const headerNotes = releaseNotes ? (releaseNotes[headerLang] ?? '') : ''
  const bodyLang = releaseNotes
    ? resolveDefaultLanguage(releaseNotes, lang)
    : 'en'
  const bodyNotes = releaseNotes ? (releaseNotes[bodyLang] ?? '') : ''
  const subtitle = useMemo(
    () => parseChangelog(headerNotes).subtitle,
    [headerNotes],
  )
  const sections = useMemo(
    () => parseChangelog(bodyNotes).sections,
    [bodyNotes],
  )

  if (!result?.hasUpdate || !releaseNotes || hiddenForSession) {
    return null
  }

  const hasBilingual = hasBilingualReleaseNotes(releaseNotes)
  const separator = lang === 'zh' ? '：' : ': '

  const hasSelfUpdate =
    canSelfUpdate && Boolean(result?.assets) && Boolean(result?.hasUpdate)

  const resolvePrimaryCta = (): {
    label: string
    disabled: boolean
    onClick: () => void
  } => {
    if (!hasSelfUpdate) {
      return {
        label: t('update.updateInCommunityPlugins', 'Update in community plugins'),
        disabled: false,
        onClick: () => {
          openCommunityPluginsSettings(app)
          setHiddenForSession(true)
        },
      }
    }

    const version = result!.latestVersion
    const isSameVersion =
      updateState.status !== 'idle' && updateState.version === version

    if (updateState.status === 'ready' && isSameVersion) {
      return {
        label: t('update.installAndReload', 'Install and reload'),
        disabled: false,
        onClick: () => {
          applyUpdate()
        },
      }
    }

    if (updateState.status === 'downloading' && isSameVersion) {
      return {
        label: t('update.downloading', 'Downloading {{progress}}%').replace(
          '{{progress}}',
          String(Math.round(updateState.progress)),
        ),
        disabled: true,
        onClick: () => {},
      }
    }

    if (updateState.status === 'applying' && isSameVersion) {
      return {
        label: t('update.applying', 'Installing…'),
        disabled: true,
        onClick: () => {},
      }
    }

    if (updateState.status === 'error' && isSameVersion) {
      return {
        label: t('update.downloadUpdate', 'Download update'),
        disabled: false,
        onClick: () => {
          startDownload()
        },
      }
    }

    return {
      label: t('update.downloadUpdate', 'Download update'),
      disabled: false,
      onClick: () => {
        startDownload()
      },
    }
  }

  const primaryCta = resolvePrimaryCta()
  const isSelfUpdateError =
    hasSelfUpdate &&
    updateState.status === 'error' &&
    updateState.version === result.latestVersion
  const showCommunityPluginsFallback = !hasSelfUpdate || isSelfUpdateError
  const showDownloadProgress =
    hasSelfUpdate &&
    updateState.status === 'downloading' &&
    updateState.version === result.latestVersion

  const closeLabel = plugin.isUpdateVersionSoftDismissed(result.latestVersion)
    ? t('update.muteThisVersion', "Don't notify for this version")
    : t('update.dismiss', 'Dismiss')

  const langToggle = hasBilingual ? (
    <div
      className="yolo-update-toast-lang"
      role="group"
      aria-label="Release notes language"
    >
      <button
        type="button"
        className={`yolo-update-toast-lang-option${lang === 'zh' ? ' is-active' : ''}`}
        onClick={() => setLang('zh')}
      >
        {t('update.languageChinese', '中文')}
      </button>
      <button
        type="button"
        className={`yolo-update-toast-lang-option${lang === 'en' ? ' is-active' : ''}`}
        onClick={() => setLang('en')}
      >
        {t('update.languageEnglish', 'EN')}
      </button>
    </div>
  ) : null

  return (
    <div
      className={`yolo-update-toast${exiting ? ' yolo-update-toast--exiting' : ''}`}
    >
      <div className="yolo-update-toast-header">
        <div className="yolo-update-toast-heading">
          <div className="yolo-update-toast-titlerow">
            <span className="yolo-update-toast-title">
              {t('update.toastTitle', 'YOLO update available')}
            </span>
            <span className="yolo-update-toast-version">
              {result.latestVersion}
            </span>
          </div>
          {subtitle ? (
            <div className="yolo-update-toast-subtitle">{subtitle}</div>
          ) : null}
        </div>
        {langToggle}
        <button
          type="button"
          className="yolo-update-toast-icon-button"
          onClick={() => setExiting(true)}
          aria-label={closeLabel}
          title={closeLabel}
        >
          <X size={14} strokeWidth={1.8} />
        </button>
      </div>

      <div className="yolo-update-toast-divider" />

      <div className="yolo-update-toast-body">
        <UpdateChangelogSections sections={sections} separator={separator} />
      </div>

      {showDownloadProgress ? (
        <div className="yolo-update-toast-progress" aria-hidden="true">
          <div
            className="yolo-update-toast-progress-fill"
            style={{ width: `${updateState.progress}%` }}
          />
        </div>
      ) : null}

      <div className="yolo-update-toast-footer">
        <button
          type="button"
          className="yolo-update-toast-history-btn"
          title={t('update.viewHistory', 'View release history')}
          onClick={() => {
            setHiddenForSession(true)
            new UpdateHistoryModal(
              app,
              plugin,
              t('update.historyTitle', 'Release history'),
            ).open()
          }}
        >
          {t('update.viewHistory', 'View release history')}
        </button>
        {showCommunityPluginsFallback && hasSelfUpdate ? (
          <button
            type="button"
            className="yolo-update-toast-secondary-btn"
            title={t(
              'update.updateInCommunityPlugins',
              'Update in community plugins',
            )}
            onClick={() => {
              openCommunityPluginsSettings(app)
              setHiddenForSession(true)
            }}
          >
            {t('update.updateInCommunityPlugins', 'Update in community plugins')}
          </button>
        ) : null}
        <button
          type="button"
          className={`yolo-update-toast-cta${primaryCta.disabled ? ' is-disabled' : ''}`}
          title={primaryCta.label}
          disabled={primaryCta.disabled}
          onClick={primaryCta.onClick}
        >
          {primaryCta.label}
        </button>
      </div>
      {isSelfUpdateError && result.releaseUrl ? (
        <button
          type="button"
          className="yolo-update-toast-manual-link"
          onClick={() => {
            window.open(result.releaseUrl)
          }}
        >
          {t(
            'update.manualInstallOnGitHub',
            "Can't update? Install manually from GitHub",
          )}
        </button>
      ) : null}
    </div>
  )
}

/**
 * Mounts the update toast as a standalone React root anchored to the bottom-left
 * of the Obsidian window (independent of any chat view). Returns a cleanup that
 * unmounts the root and removes its host element.
 */
export function mountUpdateToast(plugin: YoloPlugin): () => void {
  const container = document.createElement('div')
  container.className = 'yolo-update-toast-root'
  document.body.appendChild(container)
  const root: Root = createRoot(container)
  root.render(
    <PluginProvider plugin={plugin}>
      <LanguageProvider>
        <UpdateToast />
      </LanguageProvider>
    </PluginProvider>,
  )

  return () => {
    root.unmount()
    container.remove()
  }
}
