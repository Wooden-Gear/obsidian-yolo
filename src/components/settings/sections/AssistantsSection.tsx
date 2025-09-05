import { App } from 'obsidian';
import { Plus, Trash2 } from 'lucide-react';
import React, { useState } from 'react';

import { useLanguage } from '../../../contexts/language-context';
import { useSettings } from '../../../contexts/settings-context';
import { Assistant } from '../../../types/assistant.types';
import { ObsidianSetting } from '../../common/ObsidianSetting';
import { ObsidianTextArea } from '../../common/ObsidianTextArea';
import { ObsidianTextInput } from '../../common/ObsidianTextInput';
import { ConfirmModal } from '../../modals/ConfirmModal';

type AssistantItemProps = {
  assistant: Assistant;
  onUpdate: (updatedAssistant: Assistant) => void;
  onDelete: (id: string) => void;
};

function AssistantItem({
  assistant,
  onUpdate,
  onDelete,
}: AssistantItemProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();

  const handleDeleteClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    onDelete(assistant.id);
  };

  const handleToggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  return (
    <div className="smtcmp-assistant-item" style={{
      border: '1px solid var(--background-modifier-border)',
      borderRadius: '8px',
      margin: '4px 0',
      overflow: 'hidden',
      backgroundColor: 'var(--background-secondary)',
      transition: 'all 0.2s ease'
    }}>
      <div
        className="smtcmp-assistant-header"
        onClick={handleToggleExpand}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') handleToggleExpand();
        }}
        aria-expanded={isExpanded}
        aria-controls={`assistant-details-${assistant.id}`}
        style={{
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          cursor: 'pointer',
          borderBottom: isExpanded ? '1px solid var(--background-modifier-border)' : 'none'
        }}
      >
        <div className="smtcmp-assistant-header-info" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          flex: 1
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <div className="smtcmp-assistant-name" style={{
              fontWeight: '500',
              fontSize: '14px',
              color: 'var(--text-normal)'
            }}>
              {assistant.name}
            </div>
          </div>
        </div>
        
        <div className="smtcmp-assistant-actions" style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <button 
            className="smtcmp-delete-assistant-btn" 
            aria-label={`${t('settings.assistants.deleteAssistantAria', 'Delete assistant')} ${assistant.name}`}
            onClick={handleDeleteClick}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '4px',
              borderRadius: '4px',
              color: 'var(--text-muted)',
              transition: 'all 0.2s ease'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--background-modifier-error)';
              e.currentTarget.style.color = 'var(--text-error)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
              e.currentTarget.style.color = 'var(--text-muted)';
            }}
          >
            <Trash2 size={16} />
          </button>
          
          <span style={{
            transform: `rotate(${isExpanded ? '180deg' : '0deg'})`,
            transition: 'transform 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '24px',
            height: '24px'
          }}>
            ▼
          </span>
        </div>
      </div>

      {isExpanded && (
        <div 
          className="smtcmp-assistant-details"
          id={`assistant-details-${assistant.id}`}
          style={{
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px',
            backgroundColor: 'var(--background-primary-alt)',
            borderRadius: '0 0 8px 8px'
          }}
        >
          <div className="smtcmp-assistant-field" style={{
            display: 'flex',
            flexDirection: 'column',
            gap: '4px'
          }}>
            <label style={{
              fontWeight: 'bold',
              fontSize: '14px'
            }}>{t('settings.assistants.name', 'Name')}</label>
            <ObsidianTextInput
              value={assistant.name}
              onChange={(value) => onUpdate({ ...assistant, name: value })}
              placeholder={t('settings.assistants.namePlaceholder', 'Enter assistant name')}
            />
          </div>

          <ObsidianSetting
            name={t('settings.assistants.systemPrompt', 'System Prompt')}
            desc={t('settings.assistants.systemPromptDesc', 'This prompt will be added to the beginning of every chat.')}
            className="smtcmp-settings-textarea-header"
          />
          
          <ObsidianSetting className="smtcmp-settings-textarea">
            <ObsidianTextArea
              value={assistant.systemPrompt || ''}
              onChange={(value) => onUpdate({ ...assistant, systemPrompt: value })}
              placeholder={t('settings.assistants.systemPromptPlaceholder', "Enter system prompt to define assistant's behavior and capabilities")}
            />
          </ObsidianSetting>

          <ObsidianSetting
            name={t('settings.chat.maxContextMessages', 'Max context messages')}
            desc={t('settings.assistants.maxContextMessagesDesc', 'If set, this assistant will use this number of previous chat messages, overriding the global default.')}
          >
            <ObsidianTextInput
              value={(assistant as any).maxContextMessages?.toString?.() ?? ''}
              onChange={(value) => {
                const parsed = parseInt(value)
                if (isNaN(parsed)) {
                  const { maxContextMessages, ...rest } = assistant as any
                  onUpdate(rest as Assistant)
                  return
                }
                if (parsed < 0) return
                onUpdate({ ...(assistant as any), maxContextMessages: parsed })
              }}
            />
          </ObsidianSetting>
        </div>
      )}
    </div>
  );
}

interface AssistantsSectionProps {
  app: App;
}

export function AssistantsSection({ app }: AssistantsSectionProps) {
  const { settings, setSettings } = useSettings();
  const { t } = useLanguage();
  const assistants = settings.assistants || [];

  const handleAddAssistant = async () => {
    const newAssistant: Assistant = {
      id: crypto.randomUUID(),
      name: `${t('settings.assistants.defaultAssistantName', 'New Assistant')} ${assistants.length + 1}`,
      description: '',
      systemPrompt: '',
    };

    const newAssistantsList = [...assistants, newAssistant];

    await setSettings({
      ...settings,
      assistants: newAssistantsList,
    });
  };

  const handleUpdateAssistant = async (updatedAssistant: Assistant) => {
    const newAssistantsList = assistants.map((assistant: Assistant) =>
      assistant.id === updatedAssistant.id ? updatedAssistant : assistant
    );
    
    await setSettings({
      ...settings,
      assistants: newAssistantsList,
    });
  };

  const handleDeleteAssistant = async (id: string) => {
    const assistantToDelete = assistants.find((a) => a.id === id);
    if (!assistantToDelete) return;

    let confirmed = false;
    
    const modal = new ConfirmModal(
      app,
      {
        title: t('settings.assistants.deleteConfirmTitle', 'Confirm Delete Assistant'),
        message: `${t('settings.assistants.deleteConfirmMessagePrefix', 'Are you sure you want to delete assistant')} "${assistantToDelete.name}"${t('settings.assistants.deleteConfirmMessageSuffix', '? This action cannot be undone.')}`,
        ctaText: t('common.delete'),
        onConfirm: () => {
          confirmed = true;
        }
      }
    );
    
    modal.onClose = async () => {
      if (confirmed) {
        const updatedAssistants = assistants.filter((a) => a.id !== id);
        
        let newCurrentAssistantId = settings.currentAssistantId;
        if (id === settings.currentAssistantId) {
          newCurrentAssistantId = updatedAssistants.length > 0 ? updatedAssistants[0].id : undefined;
        }
        
        await setSettings({
          ...settings,
          assistants: updatedAssistants,
          currentAssistantId: newCurrentAssistantId,
        });
      }
    };
    
    modal.open();
  };

  return (
    <div className="smtcmp-settings-section">
      <div className="smtcmp-settings-header" style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '16px'
      }}>
        <div>{t('settings.assistants.title')}</div>
        <button
          onClick={handleAddAssistant}
          aria-label={t('settings.assistants.addAssistantAria', 'Add new assistant')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '4px',
            backgroundColor: 'var(--interactive-accent)',
            color: 'var(--text-on-accent)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: 'medium',
            transition: 'background-color 0.2s ease'
          }}
        >
          <Plus size={16} />
          {t('settings.assistants.addAssistant')}
        </button>
      </div>
      
      <ObsidianSetting
        desc={t('settings.assistants.desc')}
      />

      {assistants.length === 0 ? (
        <div className="smtcmp-no-assistants" style={{
          padding: '24px',
          textAlign: 'center',
          backgroundColor: 'var(--background-secondary)',
          borderRadius: '8px',
          border: '1px dashed var(--background-modifier-border)',
          color: 'var(--text-muted)',
          fontSize: '15px'
        }}>
          <p style={{ margin: 0 }}>{t('settings.assistants.noAssistants')}</p>
        </div>
      ) : (
        <div className="smtcmp-assistants-list" style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {assistants.map((assistant: Assistant) => (
            <AssistantItem
              key={assistant.id}
              assistant={assistant}
              onUpdate={handleUpdateAssistant}
              onDelete={handleDeleteAssistant}
            />
          ))}
        </div>
      )}
    </div>
  );
}