import { Edit, Trash2 } from 'lucide-react'
import { App, Notice } from 'obsidian'
import { useCallback, useEffect, useMemo, useState } from 'react'

import { useLanguage } from '../../../contexts/language-context'
import { TemplateManager } from '../../../database/json/template/TemplateManager'
import { TemplateMetadata } from '../../../database/json/template/types'
import { ObsidianButton } from '../../common/ObsidianButton'
import { ConfirmModal } from '../../modals/ConfirmModal'
import {
  CreateTemplateModal,
  EditTemplateModal,
} from '../../modals/TemplateFormModal'

type TemplateSectionProps = {
  app: App
}

export function TemplateSection({ app }: TemplateSectionProps) {
  const { t } = useLanguage()
  const templateManager = useMemo(() => new TemplateManager(app), [app])

  const [templateList, setTemplateList] = useState<TemplateMetadata[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const fetchTemplateList = useCallback(async () => {
    setIsLoading(true)
    try {
      setTemplateList(await templateManager.listMetadata())
    } catch (error) {
      console.error('Failed to fetch template list:', error)
      new Notice(
        'Failed to load templates. Please try refreshing the settings.',
      )
      setTemplateList([])
    } finally {
      setIsLoading(false)
    }
  }, [templateManager])

  const handleCreate = useCallback(() => {
    new CreateTemplateModal({
      app,
      selectedSerializedNodes: null,
      onSubmit: fetchTemplateList,
    }).open()
  }, [fetchTemplateList, app])

  const handleEdit = useCallback(
    (template: TemplateMetadata) => {
      new EditTemplateModal({
        app,
        templateId: template.id,
        onSubmit: fetchTemplateList,
      }).open()
    },
    [fetchTemplateList, app],
  )

  const handleDelete = useCallback(
    (template: TemplateMetadata) => {
      const message = `${t('settings.templates.deleteTemplateConfirm')} "${template.name}"?`
      new ConfirmModal(app, {
        title: t('settings.templates.deleteTemplate'),
        message: message,
        ctaText: t('common.delete'),
        onConfirm: async () => {
          try {
            await templateManager.deleteTemplate(template.id)
            fetchTemplateList()
          } catch (error) {
            console.error('Failed to delete template:', error)
            new Notice('Failed to delete template. Please try again.')
          }
        },
      }).open()
    },
    [templateManager, fetchTemplateList, app, t],
  )

  useEffect(() => {
    fetchTemplateList()
  }, [fetchTemplateList])

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header">{t('settings.templates.title')}</div>

      <div className="smtcmp-settings-desc smtcmp-settings-callout">
        <strong>How to use:</strong> {t('settings.templates.howToUse')}
      </div>

      <div className="smtcmp-settings-sub-header-container">
        <div className="smtcmp-settings-sub-header">{t('settings.templates.savedTemplates')}</div>
        <ObsidianButton text={t('settings.templates.addTemplate')} onClick={handleCreate} />
      </div>

      <div className="smtcmp-templates-container">
        <div className="smtcmp-templates-header">
          <div>{t('settings.templates.name')}</div>
          <div>{t('settings.templates.actions')}</div>
        </div>
        {isLoading ? (
          <div className="smtcmp-templates-empty">{t('settings.templates.loading')}</div>
        ) : templateList.length > 0 ? (
          templateList.map((template) => (
            <TemplateItem
              key={template.id}
              template={template}
              onDelete={() => {
                handleDelete(template)
              }}
              onEdit={() => {
                handleEdit(template)
              }}
            />
          ))
        ) : (
          <div className="smtcmp-templates-empty">{t('settings.templates.noTemplates')}</div>
        )}
      </div>
    </div>
  )
}

function TemplateItem({
  template,
  onEdit,
  onDelete,
}: {
  template: TemplateMetadata
  onEdit: () => void
  onDelete: () => void
}) {
  const { t } = useLanguage()
  
  return (
    <div className="smtcmp-template">
      <div className="smtcmp-template-row">
        <div className="smtcmp-template-name">{template.name}</div>
        <div className="smtcmp-template-actions">
          <button
            className="clickable-icon"
            aria-label={t('settings.templates.editTemplate')}
            onClick={onEdit}
          >
            <Edit size={16} />
          </button>
          <button
            className="clickable-icon"
            aria-label={t('settings.templates.deleteTemplate')}
            onClick={onDelete}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
