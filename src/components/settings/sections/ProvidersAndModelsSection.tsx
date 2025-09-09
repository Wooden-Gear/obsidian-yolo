import { ChevronDown, ChevronRight, Settings, Trash2, Edit } from 'lucide-react'
import { App, Notice } from 'obsidian'
import React, { useState } from 'react'

import { DEFAULT_CHAT_MODELS, DEFAULT_EMBEDDING_MODELS, DEFAULT_PROVIDERS, PROVIDER_TYPES_INFO } from '../../../constants'
import { useLanguage } from '../../../contexts/language-context'
import { useSettings } from '../../../contexts/settings-context'
import { getEmbeddingModelClient } from '../../../core/rag/embedding'
import SmartComposerPlugin from '../../../main'
import { LLMProvider } from '../../../types/provider.types'
import { EmbeddingModel } from '../../../types/embedding-model.types'
import { ObsidianToggle } from '../../common/ObsidianToggle'
import { ConfirmModal } from '../../modals/ConfirmModal'
import {
  AddProviderModal,
  EditProviderModal,
} from '../modals/ProviderFormModal'
import { AddChatModelModal } from '../modals/AddChatModelModal'
import { AddEmbeddingModelModal } from '../modals/AddEmbeddingModelModal'
import { EditChatModelModal } from '../modals/EditChatModelModal'
import { EditEmbeddingModelModal } from '../modals/EditEmbeddingModelModal'
import {
  ChatModelSettingsModal,
  hasChatModelSettings,
} from './models/ChatModelSettings'

type ProvidersAndModelsSectionProps = {
  app: App
  plugin: SmartComposerPlugin
}

export function ProvidersAndModelsSection({ app, plugin }: ProvidersAndModelsSectionProps) {
  const { settings, setSettings } = useSettings()
  const { t, language } = useLanguage()
  const [expandedProviders, setExpandedProviders] = useState<Set<string>>(new Set())
  

  const toggleProvider = (providerId: string) => {
    const newExpanded = new Set(expandedProviders)
    if (newExpanded.has(providerId)) {
      newExpanded.delete(providerId)
    } else {
      newExpanded.add(providerId)
    }
    setExpandedProviders(newExpanded)
  }

  const handleDeleteProvider = async (provider: LLMProvider) => {
    const associatedChatModels = settings.chatModels.filter(
      (m) => m.providerId === provider.id,
    )
    const associatedEmbeddingModels = settings.embeddingModels.filter(
      (m) => m.providerId === provider.id,
    )

    const message =
      `Are you sure you want to delete provider "${provider.id}"?\n\n` +
      `This will also delete:\n` +
      `- ${associatedChatModels.length} chat model(s)\n` +
      `- ${associatedEmbeddingModels.length} embedding model(s)\n\n` +
      `All embeddings generated using the associated embedding models will also be deleted.`

    new ConfirmModal(app, {
      title: 'Delete Provider',
      message: message,
      ctaText: 'Delete',
      onConfirm: async () => {
        const vectorManager = (await plugin.getDbManager()).getVectorManager()
        const embeddingStats = await vectorManager.getEmbeddingStats()

        for (const embeddingModel of associatedEmbeddingModels) {
          const embeddingStat = embeddingStats.find(
            (v) => v.model === embeddingModel.id,
          )

          if (embeddingStat?.rowCount && embeddingStat.rowCount > 0) {
            const embeddingModelClient = getEmbeddingModelClient({
              settings,
              embeddingModelId: embeddingModel.id,
            })
            await vectorManager.clearAllVectors(embeddingModelClient)
          }
        }

        await setSettings({
          ...settings,
          providers: settings.providers.filter(v => v.id !== provider.id),
          chatModels: settings.chatModels.filter(v => v.providerId !== provider.id),
          embeddingModels: settings.embeddingModels.filter(v => v.providerId !== provider.id),
        })
      },
    }).open()
  }

  const handleDeleteChatModel = async (modelId: string) => {
    if (modelId === settings.chatModelId || modelId === settings.applyModelId) {
      new Notice(
        'Cannot remove model that is currently selected as Chat Model or Apply Model',
      )
      return
    }

    const message = `Are you sure you want to delete model "${modelId}"?`
    new ConfirmModal(app, {
      title: 'Delete Chat Model',
      message: message,
      ctaText: 'Delete',
      onConfirm: async () => {
        await setSettings({
          ...settings,
          chatModels: settings.chatModels.filter((v) => v.id !== modelId),
        })
      },
    }).open()
  }

  const handleDeleteEmbeddingModel = async (modelId: string) => {
    if (modelId === settings.embeddingModelId) {
      new Notice('Cannot remove model that is currently selected as Embedding Model')
      return
    }

    const vectorManager = (await plugin.getDbManager()).getVectorManager()
    const embeddingStats = await vectorManager.getEmbeddingStats()
    const embeddingStat = embeddingStats.find((v) => v.model === modelId)
    const rowCount = embeddingStat?.rowCount || 0

    const message = 
      `Are you sure you want to delete embedding model "${modelId}"?\n\n` +
      `This will also delete ${rowCount} embeddings generated using this model.`

    new ConfirmModal(app, {
      title: 'Delete Embedding Model',
      message: message,
      ctaText: 'Delete',
      onConfirm: async () => {
        if (rowCount > 0) {
          const embeddingModelClient = getEmbeddingModelClient({
            settings,
            embeddingModelId: modelId,
          })
          await vectorManager.clearAllVectors(embeddingModelClient)
        }
        await setSettings({
          ...settings,
          embeddingModels: settings.embeddingModels.filter((v) => v.id !== modelId),
        })
      },
    }).open()
  }

  const handleToggleEnableChatModel = async (modelId: string, value: boolean) => {
    if (!value && (modelId === settings.chatModelId || modelId === settings.applyModelId)) {
      new Notice(
        'Cannot disable model that is currently selected as Chat Model or Apply Model',
      )
      await setSettings({
        ...settings,
        chatModels: settings.chatModels.map((v) =>
          v.id === modelId ? { ...v, enable: true } : v,
        ),
      })
      return
    }

    await setSettings({
      ...settings,
      chatModels: settings.chatModels.map((v) =>
        v.id === modelId ? { ...v, enable: value } : v,
      ),
    })
  }


  const isEnabled = (enable: boolean | undefined | null) => enable ?? true

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.providers.title')}</div>
      
      <div className="smtcmp-settings-desc">
        <span>{t('settings.providers.desc')}</span>
        <br />
        <a
          href="https://github.com/glowingjade/obsidian-smart-composer/wiki/1.2-Initial-Setup#getting-your-api-key"
          target="_blank"
          rel="noopener noreferrer"
        >
          {t('settings.providers.howToGetApiKeys')}
        </a>
      </div>

      <div className="smtcmp-providers-models-container">
        {settings.providers.map((provider) => {
          const isExpanded = expandedProviders.has(provider.id)
          const chatModels = settings.chatModels.filter(m => m.providerId === provider.id)
          const embeddingModels = settings.embeddingModels.filter(m => m.providerId === provider.id)

          return (
            <div key={provider.id} className="smtcmp-provider-section">
              <div 
                className="smtcmp-provider-header smtcmp-clickable"
                onClick={() => toggleProvider(provider.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    toggleProvider(provider.id);
                  }
                }}
              >
                <div className="smtcmp-provider-expand-btn">
                  {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                
                <div className="smtcmp-provider-info">
                  <span className="smtcmp-provider-id">{provider.id}</span>
                  <span className="smtcmp-provider-type">{PROVIDER_TYPES_INFO[provider.type].label}</span>
                  <span 
                    className="smtcmp-provider-api-key"
                    onClick={(e) => {
                      e.stopPropagation();
                      new EditProviderModal(app, plugin, provider).open();
                    }}
                  >
                    {provider.apiKey ? '••••••••' : 'Set API key'}
                  </span>
                </div>

                <div className="smtcmp-provider-actions">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      new EditProviderModal(app, plugin, provider).open();
                    }}
                    className="clickable-icon"
                  >
                    <Settings />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteProvider(provider);
                    }}
                    className="clickable-icon"
                  >
                    <Trash2 />
                  </button>
                </div>
              </div>

              {isExpanded && (
                <div className="smtcmp-provider-models">
                  {/* Chat Models Section */}
                  <div className="smtcmp-models-subsection">
                    <div className="smtcmp-models-subsection-header">
                      <span>{t('settings.models.chatModels')}</span>
                      <button 
                        className="smtcmp-add-model-btn"
                        onClick={() => {
                          const modal = new AddChatModelModal(app, plugin, provider)
                          modal.open()
                        }}
                      >
                        + {t('settings.models.addChatModel')}
                      </button>
                    </div>
                    
                    {chatModels.length > 0 ? (
                      <table className="smtcmp-models-table">
                        <thead>
                          <tr>
                            <th>{t('settings.models.modelName')}</th>
                            <th>Model (calling ID)</th>
                            <th>Enable</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {chatModels.map((model) => (
                            <tr key={model.id}>
                              <td title={model.id}>{model.name || model.model || model.id}</td>
                              <td>{model.model || model.id}</td>
                              <td>
                                <ObsidianToggle
                                  value={isEnabled(model.enable)}
                                  onChange={(value) => handleToggleEnableChatModel(model.id, value)}
                                />
                              </td>
                              <td>
                                <div className="smtcmp-settings-actions">
                                  {hasChatModelSettings(model) && (
                                    <button
                                      onClick={() => new ChatModelSettingsModal(model, app, plugin).open()}
                                      className="clickable-icon"
                                    >
                                      <Settings />
                                    </button>
                                  )}
                                  {!DEFAULT_CHAT_MODELS.some(v => v.id === model.id && v.providerId === model.providerId) && (
                                    <>
                                      <button
                                        onClick={() => new EditChatModelModal(app, plugin, model).open()}
                                        className="clickable-icon"
                                        title="Edit model"
                                      >
                                        <Edit />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteChatModel(model.id)}
                                        className="clickable-icon"
                                      >
                                        <Trash2 />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="smtcmp-no-models">{t('settings.models.noChatModelsConfigured')}</div>
                    )}
                  </div>

                  {/* Embedding Models Section */}
                  <div className="smtcmp-models-subsection">
                    <div className="smtcmp-models-subsection-header">
                      <span>{t('settings.models.embeddingModels')}</span>
                      <button 
                        className="smtcmp-add-model-btn"
                        onClick={() => {
                          const modal = new AddEmbeddingModelModal(app, plugin, provider)
                          modal.open()
                        }}
                      >
                        + {t('settings.models.addEmbeddingModel')}
                      </button>
                    </div>
                    
                    {embeddingModels.length > 0 ? (
                      <table className="smtcmp-models-table">
                        <thead>
                          <tr>
                            <th>Model ID</th>
                            <th>Model Name</th>
                            <th>Dimension</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {embeddingModels.map((model) => (
                            <tr key={model.id}>
                              <td>{model.id}</td>
                              <td>{model.model}</td>
                              <td>{model.dimension}</td>
                              <td>
                                <div className="smtcmp-settings-actions">
                                  {!DEFAULT_EMBEDDING_MODELS.some(v => v.id === model.id && v.providerId === model.providerId) && (
                                    <>
                                      <button
                                        onClick={() => new EditEmbeddingModelModal(app, plugin, model).open()}
                                        className="clickable-icon"
                                        title="Edit model"
                                      >
                                        <Edit />
                                      </button>
                                      <button
                                        onClick={() => handleDeleteEmbeddingModel(model.id)}
                                        className="clickable-icon"
                                      >
                                        <Trash2 />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    ) : (
                      <div className="smtcmp-no-models">{t('settings.models.noEmbeddingModelsConfigured')}</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        <button 
          className="smtcmp-add-provider-btn"
          onClick={() => new AddProviderModal(app, plugin).open()}
        >
          {t('settings.providers.addCustomProvider')}
        </button>
      </div>
    </div>
  )
}
