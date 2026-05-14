import { App } from 'obsidian'
import { useMemo, useState } from 'react'

import { PROVIDER_PRESET_INFO } from '../../../constants'
import {
  PROVIDER_CATALOG,
  PROVIDER_PICKER_CATEGORIES,
  PROVIDER_PICKER_ORDER,
  ProviderCatalogEntry,
  ProviderPickerCategory,
} from '../../../constants/provider-catalog'
import { useLanguage } from '../../../contexts/language-context'
import YoloPlugin from '../../../main'
import {
  LLMProviderPresetType,
  getDefaultApiTypeForPresetType,
} from '../../../types/provider.types'
import { ReactModal } from '../../common/ReactModal'

import { AddProviderModal } from './ProviderFormModal'

type ProviderPickerProps = {
  app: App
  plugin: YoloPlugin
}

type CategoryId = 'all' | ProviderPickerCategory
type SelectionId = LLMProviderPresetType | '__custom'

export class ProviderPickerModal extends ReactModal<ProviderPickerProps> {
  constructor(app: App, plugin: YoloPlugin) {
    super({
      app,
      Component: ProviderPickerComponent,
      props: { app, plugin },
      options: {
        title: plugin.t('settings.providers.pickerTitle', 'Add provider'),
      },
      plugin,
    })
    this.modalEl.classList.add('yolo-provider-picker-modal')
  }
}

function ProviderPickerComponent({
  app,
  plugin,
  onClose,
}: ProviderPickerProps & { onClose: () => void }) {
  const { t } = useLanguage()

  const [query, setQuery] = useState('')
  const [category, setCategory] = useState<CategoryId>('all')
  const [selected, setSelected] = useState<SelectionId | null>(null)

  // Which presets the user has already configured at least one instance of.
  // Surfaced as an "已添加" badge to gently discourage duplicates without
  // blocking them — duplicate provider instances are legitimate (different
  // base URLs / keys for the same brand).
  //
  // We read `plugin.settings` directly rather than `useSettings()` because the
  // ReactModal host only wires PluginProvider + LanguageProvider, not the
  // settings context. The picker is short-lived; recomputing once on mount
  // is the right scope.
  const addedPresets = useMemo(() => {
    const presets = new Set<LLMProviderPresetType>()
    for (const provider of plugin.settings.providers) {
      presets.add(provider.presetType)
    }
    return presets
  }, [plugin])

  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return PROVIDER_PICKER_ORDER.filter((presetType) => {
      const catalog = PROVIDER_CATALOG[presetType]
      if (category !== 'all' && catalog.category !== category) return false
      if (!normalized) return true
      const info = PROVIDER_PRESET_INFO[presetType]
      const haystack = [
        info.label,
        presetType,
        catalog.monogram,
        catalog.kindFallback,
        t(`settings.providers.kind.${catalog.kindKey}`, catalog.kindFallback),
      ]
        .join(' ')
        .toLowerCase()
      return haystack.includes(normalized)
    })
  }, [query, category, t])

  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryId, number> = {
      all: PROVIDER_PICKER_ORDER.length,
      main: 0,
      cn: 0,
      gw: 0,
      cloud: 0,
      local: 0,
    }
    for (const presetType of PROVIDER_PICKER_ORDER) {
      counts[PROVIDER_CATALOG[presetType].category] += 1
    }
    return counts
  }, [])

  const customLabel = t(
    'settings.providers.pickerCustomLabel',
    'Custom provider',
  )
  const customSecondary = 'custom · OpenAI compatible'

  const customMatchesQuery = (() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return true
    if (category !== 'all') return false
    return (
      customLabel.toLowerCase().includes(normalized) ||
      customSecondary.toLowerCase().includes(normalized) ||
      'openai-compatible openai compatible'.includes(normalized)
    )
  })()

  const selectedLabel = (() => {
    if (!selected) return null
    if (selected === '__custom') return customLabel
    return PROVIDER_PRESET_INFO[selected].label
  })()

  const handleConfirm = () => {
    if (!selected) return
    const presetType: LLMProviderPresetType =
      selected === '__custom' ? 'openai-compatible' : selected
    onClose()
    new AddProviderModal(app, plugin, presetType).open()
  }

  return (
    <div className="yolo-provider-picker">
      <div className="yolo-provider-picker__sub">
        {t(
          'settings.providers.pickerSubtitle',
          'Pick a provider to continue configuration',
        )}
      </div>

      <div className="yolo-provider-picker__toolbar">
        <div className="yolo-provider-picker__search">
          <span aria-hidden className="yolo-provider-picker__search-icon">
            ⌕
          </span>
          <input
            type="text"
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t(
              'settings.providers.pickerSearchPlaceholder',
              'Search by name, protocol or description',
            )}
            className="yolo-provider-picker__search-input"
          />
        </div>
        <div className="yolo-provider-picker__count">
          {filtered.length + (customMatchesQuery ? 1 : 0)} /{' '}
          {PROVIDER_PICKER_ORDER.length + 1}
        </div>
      </div>

      <div className="yolo-provider-picker__chips">
        {PROVIDER_PICKER_CATEGORIES.map((c) => {
          const on = category === c.id
          return (
            <button
              key={c.id}
              type="button"
              className={`yolo-provider-picker__chip${
                on ? ' yolo-provider-picker__chip--on' : ''
              }`}
              onClick={() => setCategory(c.id)}
            >
              <span>
                {t(
                  `settings.providers.${c.labelKey}`,
                  c.fallback,
                )}
              </span>
              <span className="yolo-provider-picker__chip-count">
                {categoryCounts[c.id]}
              </span>
            </button>
          )
        })}
      </div>

      <div className="yolo-provider-picker__grid">
        {filtered.map((presetType) => {
          const catalog = PROVIDER_CATALOG[presetType]
          const info = PROVIDER_PRESET_INFO[presetType]
          const isSelected = selected === presetType
          const isAdded = addedPresets.has(presetType)
          const isOpenAiCompatible =
            getDefaultApiTypeForPresetType(presetType) === 'openai-compatible'
          return (
            <button
              key={presetType}
              type="button"
              className={`yolo-provider-picker__tile${
                isSelected ? ' yolo-provider-picker__tile--selected' : ''
              }`}
              data-tint={catalog.tint}
              onClick={() => setSelected(presetType)}
              onDoubleClick={() => {
                setSelected(presetType)
                handleConfirm()
              }}
            >
              <div className="yolo-provider-picker__tile-head">
                <TileIcon catalog={catalog} />
                <div className="yolo-provider-picker__tile-text">
                  <div className="yolo-provider-picker__tile-name">
                    {info.label}
                  </div>
                  <div className="yolo-provider-picker__tile-badges">
                    <span
                      className={`yolo-pp-badge yolo-pp-badge--${
                        isOpenAiCompatible ? 'mute' : 'amber'
                      }`}
                    >
                      {isOpenAiCompatible
                        ? t(
                            'settings.providers.badgeOpenAiCompatible',
                            'OpenAI compatible',
                          )
                        : t(
                            'settings.providers.badgeNative',
                            'Native protocol',
                          )}
                    </span>
                    {catalog.oauth && (
                      <span className="yolo-pp-badge yolo-pp-badge--teal">
                        {t('settings.providers.badgeOAuth', 'OAuth')}
                      </span>
                    )}
                    {isAdded && (
                      <span className="yolo-pp-badge yolo-pp-badge--purple">
                        {t('settings.providers.badgeAdded', 'Added')}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              {isSelected && (
                <span className="yolo-provider-picker__tile-check">✓</span>
              )}
            </button>
          )
        })}

        {customMatchesQuery && (
          <button
            type="button"
            className={`yolo-provider-picker__tile yolo-provider-picker__tile--custom${
              selected === '__custom'
                ? ' yolo-provider-picker__tile--selected'
                : ''
            }`}
            onClick={() => setSelected('__custom')}
            onDoubleClick={() => {
              setSelected('__custom')
              handleConfirm()
            }}
          >
            <div className="yolo-provider-picker__tile-head">
              <div className="yolo-provider-picker__tile-icon yolo-provider-picker__tile-icon--custom">
                +
              </div>
              <div className="yolo-provider-picker__tile-text">
                <div className="yolo-provider-picker__tile-name">
                  {customLabel}
                </div>
                <div className="yolo-provider-picker__tile-badges">
                  <span className="yolo-pp-badge yolo-pp-badge--mute">
                    {t(
                      'settings.providers.pickerCustomDesc',
                      'Manually enter base URL and API key',
                    )}
                  </span>
                </div>
              </div>
            </div>
          </button>
        )}
      </div>

      <div className="yolo-provider-picker__footer">
        <div className="yolo-provider-picker__footer-msg">
          {selected ? (
            <>
              {t('settings.providers.pickerSelected', 'Selected')}{' '}
              <span className="yolo-provider-picker__footer-name">
                {selectedLabel}
              </span>
              {t(
                'settings.providers.pickerSelectedTail',
                ', next opens the configuration dialog',
              )}
            </>
          ) : (
            t(
              'settings.providers.pickerEmptyHint',
              'Pick a provider to continue',
            )
          )}
        </div>
        <button
          type="button"
          className="yolo-provider-picker__btn yolo-provider-picker__btn--ghost"
          onClick={onClose}
        >
          {t('common.cancel', 'Cancel')}
        </button>
        <button
          type="button"
          className="yolo-provider-picker__btn yolo-provider-picker__btn--primary"
          disabled={!selected}
          onClick={handleConfirm}
        >
          {t('settings.providers.pickerNext', 'Next →')}
        </button>
      </div>
    </div>
  )
}

function TileIcon({ catalog }: { catalog: ProviderCatalogEntry }) {
  if (catalog.logo) {
    return (
      <div
        className="yolo-provider-picker__tile-icon yolo-provider-picker__tile-icon--logo"
        data-tint={catalog.tint}
      >
        <img src={catalog.logo} alt="" draggable={false} />
      </div>
    )
  }
  const isCJK = /[一-龥]/.test(catalog.monogram)
  return (
    <div
      className={`yolo-provider-picker__tile-icon yolo-provider-picker__tile-icon--mono${
        isCJK ? ' yolo-provider-picker__tile-icon--cjk' : ''
      }`}
      data-tint={catalog.tint}
    >
      {catalog.monogram}
    </div>
  )
}

