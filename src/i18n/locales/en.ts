import { TranslationKeys } from '../types'

export const en: TranslationKeys = {
  commands: {
    openChat: 'Open chat',
    addSelectionToChat: 'Add selection to chat',
    rebuildVaultIndex: 'Rebuild entire vault index',
    updateVaultIndex: 'Update index for modified files',
    continueWriting: 'AI Continue Writing',
    continueWritingSelected: 'AI Continue Writing (selection)',
    customContinueWriting: 'AI Custom Continue',
    customRewrite: 'AI Custom Rewrite',
  },

  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    clear: 'Clear',
    remove: 'Remove',
    confirm: 'Confirm',
    close: 'Close',
    loading: 'Loading...',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    retry: 'Retry',
    copy: 'Copy',
    paste: 'Paste',
    default: 'Default',
    on: 'On',
    off: 'Off',
  },

  sidebar: {
    tabs: {
      chat: 'Chat',
      composer: 'Sparkle',
    },
    composer: {
      title: 'Sparkle',
      subtitle:
        'Configure continuation parameters and context before generating.',
      backToChat: 'Back to chat',
      modelSectionTitle: 'Model',
      continuationModel: 'Continuation model',
      continuationModelDesc:
        'When Super Continuation is enabled, Sparkle will use this model for continuation tasks.',
      contextSectionTitle: 'Context sources',
      ragToggle: 'Enable RAG retrieval',
      ragToggleDesc:
        'Fetch similar notes via embeddings before generating new text.',
      sections: {
        modelWithPrompt: {
          title: 'Model & Prompt',
        },
        model: {
          title: 'Model Selection',
          desc: 'Choose which model handles continuation tasks.',
        },
        parameters: {
          title: 'Parameters',
          desc: 'Core toggles that control continuation behavior.',
        },
        context: {
          title: 'Context Management',
          desc: 'Define the content sources prioritized for continuation.',
        },
      },
      continuationPrompt: 'Continuation system prompt',
      maxContinuationChars: 'Max continuation characters',
      referenceRulesTitle: 'Reference rules',
      referenceRulesPlaceholder:
        'Select folders whose content should be fully injected.',
      knowledgeBaseTitle: 'Knowledge base',
      knowledgeBasePlaceholder:
        'Select folders or files used as the retrieval scope (leave empty for all).',
      knowledgeBaseHint: 'Enable RAG search to limit the retrieval scope.',
    },
  },

  settings: {
    title: 'YOLO Settings',
    supportSmartComposer: {
      name: 'Support YOLO',
      desc: 'If you find YOLO valuable, consider supporting its development!',
      buyMeACoffee: 'Buy Me a Coffee',
    },
    defaults: {
      title: 'Default Models & Prompts',
      defaultChatModel: 'Default chat model',
      defaultChatModelDesc:
        'Choose the model you want to use for sidebar chat.',
      toolModel: 'Tool model',
      toolModelDesc:
        'Select the model used globally as the tool model (for auto conversation naming, apply operations, etc.).',
      globalSystemPrompt: 'Global system prompt',
      globalSystemPromptDesc:
        'This prompt is added to the beginning of every chat conversation.',
      continuationSystemPrompt: 'Default continuation system prompt',
      continuationSystemPromptDesc:
        'Used as the system message when generating continuation text. Leave empty to fall back to the built-in default.',
      chatTitlePrompt: 'Chat title prompt',
      chatTitlePromptDesc:
        'Prompt used when automatically generating conversation titles from the first user message.',
      baseModelSpecialPrompt: 'Base model special prompt',
      baseModelSpecialPromptDesc: 'Special prompt words used as base model.',
      tabCompletionSystemPrompt: 'Tab completion system prompt',
      tabCompletionSystemPromptDesc:
        'System message applied when generating Tab completion suggestions. Leave empty to use the built-in default.',
    },
    smartSpace: {
      quickActionsTitle: 'Smart Space Quick Actions',
      quickActionsDesc: 'Customize the quick actions and prompts displayed in Smart Space',
      addAction: 'Add Action',
      resetToDefault: 'Reset to Default',
      confirmReset: 'Are you sure you want to reset to default quick actions? This will delete all custom settings.',
      actionLabel: 'Action Label',
      actionLabelDesc: 'Text displayed in the quick action',
      actionLabelPlaceholder: 'e.g., Continue writing',
      actionInstruction: 'Prompt',
      actionInstructionDesc: 'Instruction sent to AI',
      actionInstructionPlaceholder: 'e.g., Please continue expanding the current paragraph, maintaining the original tone and style.',
      actionCategory: 'Category',
      actionCategoryDesc: 'Category this action belongs to',
      actionIcon: 'Icon',
      actionIconDesc: 'Choose an icon',
      actionEnabled: 'Enabled',
      actionEnabledDesc: 'Whether to show this action in Smart Space',
      moveUp: 'Move Up',
      moveDown: 'Move Down',
      duplicate: 'Duplicate',
      disabled: 'Disabled',
      categories: {
        suggestions: 'Suggestions',
        writing: 'Writing',
        thinking: 'Thinking · Inquiry · Dialogue',
        custom: 'Custom',
      },
      iconLabels: {
        sparkles: 'Sparkles',
        file: 'File',
        todo: 'Todo',
        workflow: 'Workflow',
        table: 'Table',
        pen: 'Pen',
        lightbulb: 'Lightbulb',
        brain: 'Brain',
        message: 'Message',
        settings: 'Settings',
      },
      copySuffix: ' (copy)',
      dragHandleAria: 'Drag to reorder',
    },
    chatPreferences: {
      title: 'Chat preferences',
      includeCurrentFile: 'Auto-include current page',
      includeCurrentFileDesc:
        'Automatically include the content of your current file in chats.',
      enableBruteMode: 'Enable Brute Mode',
      enableBruteModeDesc:
        'Show chat mode switch in chat view to include entire folders verbatim (may exceed token limits).',
      enableLearningMode: 'Learning Mode',
      enableLearningModeDesc:
        'Add tutoring rules on top of the system/assistant prompt.',
      learningModePrompt: 'Default learning prompt',
      learningModePromptDesc:
        'This text is appended when Learning Mode is enabled. View or customize as needed.',
      enableTools: 'Enable tools',
      enableToolsDesc: 'Allow the AI to use MCP tools.',
      maxAutoIterations: 'Max auto tool requests',
      maxAutoIterationsDesc:
        'Maximum number of consecutive tool calls that can be made automatically without user confirmation. Higher values can significantly increase costs as each tool call consumes additional tokens.',
      maxContextMessages: 'Max context messages',
      maxContextMessagesDesc:
        'Number of previous chat messages to include in each request (0 to include none). 32 is recommended (about 16 user-assistant turns).',
      defaultTemperature: 'Default temperature',
      defaultTemperatureDesc:
        'Default temperature for new conversations (0.0-2.0). Leave empty to use model default.',
      defaultTopP: 'Default Top P',
      defaultTopPDesc:
        'Default Top P for new conversations (0.0-1.0). Leave empty to use model default.',
    },
    assistants: {
      title: 'Assistants',
      desc: 'Create and manage custom AI assistants',
      addAssistant: 'Add Assistant',
      editAssistant: 'Edit Assistant',
      deleteAssistant: 'Delete Assistant',
      name: 'Name',
      description: 'Description',
      systemPrompt: 'System Prompt',
      systemPromptDesc:
        'This prompt will be added to the beginning of every chat.',
      systemPromptPlaceholder:
        "Enter system prompt to define assistant's behavior and capabilities",
      namePlaceholder: 'Enter assistant name',
      defaultAssistantName: 'New Assistant',
      deleteConfirmTitle: 'Confirm Delete Assistant',
      deleteConfirmMessagePrefix: 'Are you sure you want to delete assistant',
      deleteConfirmMessageSuffix: '? This action cannot be undone.',
      addAssistantAria: 'Add new assistant',
      deleteAssistantAria: 'Delete assistant',
      actions: 'Actions',
      maxContextMessagesDesc:
        'If set, this assistant will use this number of previous chat messages, overriding the global default.',
      noAssistants: 'No assistants available',
      noAssistant: 'Default',
      selectAssistant: 'Select Assistant',
    },
    providers: {
      title: 'Providers',
      desc: 'Enter your API keys for the providers you want to use',
      howToGetApiKeys: 'How to obtain API keys',
      addProvider: 'Add Provider',
      editProvider: 'Edit Provider',
      deleteProvider: 'Delete Provider',
      deleteConfirm: 'Are you sure you want to delete provider',
      deleteWarning: 'This will also delete',
      chatModels: 'chat models',
      embeddingModels: 'embedding models',
      embeddingsWillBeDeleted:
        'All embeddings generated using the related embedding models will also be deleted.',
      addCustomProvider: 'Add Custom Provider',
      editProviderTitle: 'Edit Provider',
      apiKey: 'API Key',
      apiKeyDesc: '(Leave empty if not required)',
      apiKeyPlaceholder: 'Enter your API key',
      baseUrl: 'Base URL',
      baseUrlDesc:
        'API endpoint for third-party services, e.g.: https://api.example.com/v1 or https://your-proxy.com/openai (Leave empty to use default)',
      baseUrlPlaceholder: 'https://api.example.com/v1',
      noStainlessHeaders: 'No Stainless Headers',
      noStainlessHeadersDesc:
        'Enable this if you encounter CORS errors related to Stainless headers (x-stainless-os, etc.)',
    },
    models: {
      title: 'Models',
      chatModels: 'Chat Models',
      embeddingModels: 'Embedding Models',
      addChatModel: 'Add Chat Model',
      addEmbeddingModel: 'Add Embedding Model',
      addCustomChatModel: 'Add Custom Chat Model',
      addCustomEmbeddingModel: 'Add Custom Embedding Model',
      editChatModel: 'Edit Chat Model',
      editEmbeddingModel: 'Edit Embedding Model',
      editCustomChatModel: 'Edit Custom Chat Model',
      editCustomEmbeddingModel: 'Edit Custom Embedding Model',
      modelId: 'Model ID',
      modelIdDesc:
        'API model identifier used for requests (e.g., gpt-4o-mini, claude-3-5-sonnet)',
      modelIdPlaceholder: 'gpt-4o-mini',
      modelName: 'Display name',
      modelNamePlaceholder: 'Enter a display name',
      availableModelsAuto: 'Available models (auto-fetched)',
      fetchModelsFailed: 'Failed to fetch models',
      embeddingModelsFirst: 'Embedding models are listed first',
      reasoningType: 'Model type',
      reasoningTypeNone: 'No special configuration',
      reasoningTypeOpenAI: 'OpenAI Reasoning (o3 / o4-mini / GPT-5)',
      reasoningTypeGemini: 'Gemini Reasoning (2.5 Pro / Flash / Flash-Lite)',
      reasoningTypeBase: 'Special: base model',
      baseModelWarning:
        'When enabled, no system prompts (including assistant prompts) will be injected for this model. Enable only if you understand how base models behave.',
      openaiReasoningEffort: 'Reasoning effort',
      openaiReasoningEffortDesc:
        'Choose effort: minimal (GPT-5 only) / low / medium / high',
      geminiThinkingBudget: 'Thinking budget (thinkingBudget)',
      geminiThinkingBudgetDesc:
        'Unit: thinking tokens. 0=off (Flash/Flash-Lite), -1=dynamic; ranges vary by model.',
      geminiThinkingBudgetPlaceholder: 'e.g., -1 (dynamic, 0=off)',
      toolType: 'Tool Type',
      toolTypeDesc: 'Select the tool type supported by the model',
      toolTypeNone: 'No Tools',
      toolTypeGemini: 'Gemini Tools',
      customParameters: 'Custom parameters',
      customParametersDesc:
        'Attach additional request fields. Values accept plain text or JSON (e.g., {"thinking": {"type": "enabled"}}).',
      customParametersAdd: 'Add parameter',
      customParametersKeyPlaceholder: 'Key, e.g., thinking',
      customParametersValuePlaceholder:
        'Value, plain text or JSON. Example: {"type":"enabled"} or 0.7',
      promptLevel: 'Prompt Level',
      promptLevelDesc:
        'Choose how complex the system prompt should be. Select "simple" for small models that ignore user questions and just repeat back instructions.',
      promptLevelDefault: 'default',
      promptLevelSimple: 'simple',
      dimension: 'Dimension',
      dimensionDesc: 'The dimension of the embedding model (optional)',
      dimensionPlaceholder: '1536',
      noChatModelsConfigured: 'No chat models configured',
      noEmbeddingModelsConfigured: 'No embedding models configured',
    },
    rag: {
      title: 'RAG (Retrieval Augmented Generation)',
      enableRag: 'Show RAG settings',
      enableRagDesc:
        'Toggle visibility of the retrieval-augmented generation options below.',
      embeddingModel: 'Embedding Model',
      embeddingModelDesc: 'Choose the model you want to use for embeddings',
      chunkSize: 'Chunk Size',
      chunkSizeDesc:
        "Set the chunk size for text splitting. After changing this, please re-index the vault using the 'Rebuild entire vault index' command.",
      thresholdTokens: 'Threshold Tokens',
      thresholdTokensDesc:
        'Maximum number of tokens before switching to RAG. If the total tokens from mentioned files exceed this, RAG will be used instead of including all file contents.',
      minSimilarity: 'Minimum Similarity',
      minSimilarityDesc:
        'Minimum similarity score for RAG results. Higher values return more relevant but potentially fewer results.',
      limit: 'Limit',
      limitDesc:
        'Maximum number of RAG results to include in the prompt. Higher values provide more context but increase token usage.',
      includePatterns: 'Include Patterns',
      includePatternsDesc:
        "Specify glob patterns to include files in indexing (one per line). Example: use 'notes/**' for all files in the notes folder. Leave empty to include all files. Requires 'Rebuild entire vault index' after changes.",
      excludePatterns: 'Exclude Patterns',
      excludePatternsDesc:
        "Specify glob patterns to exclude files from indexing (one per line). Example: use 'notes/**' for all files in the notes folder. Leave empty to exclude nothing. Requires 'Rebuild entire vault index' after changes.",
      testPatterns: 'Test Patterns',
      manageEmbeddingDatabase: 'Manage Embedding Database',
      manage: 'Manage',
      rebuildIndex: 'Rebuild Index',
      // UI additions
      selectedFolders: 'Selected folders',
      excludedFolders: 'Excluded folders',
      selectFoldersPlaceholder:
        'Click here to select folders (leave empty to include all)',
      selectFilesOrFoldersPlaceholder:
        'Click here to pick files or folders (leave empty for the entire vault)',
      selectExcludeFoldersPlaceholder:
        'Click here to select folders to exclude (leave empty to exclude nothing)',
      conflictNoteDefaultInclude:
        'Tip: No include folders selected, all are included by default. If exclude folders are set, exclusion takes precedence.',
      conflictExact:
        'The following folders are both included and excluded; they will be excluded:',
      conflictParentExclude:
        'The following included folders are under excluded parents and will be excluded:',
      conflictChildExclude:
        'The following excluded subfolders are under included folders (partial exclusion applies):',
      conflictRule:
        'When include and exclude overlap, exclusion takes precedence.',
      // Auto update
      autoUpdate: 'Auto update index',
      autoUpdateDesc:
        'When files within the included folders change, perform incremental updates automatically based on the minimum interval; default once per day.',
      autoUpdateInterval: 'Minimum interval (hours)',
      autoUpdateIntervalDesc:
        'Only trigger auto update after this interval to avoid frequent re-indexing.',
      manualUpdateNow: 'Update Now',
      manualUpdateNowDesc:
        'Run an incremental update immediately and record the last updated time.',
      // Index progress header/status
      indexProgressTitle: 'RAG Index Progress',
      indexing: 'In progress',
      notStarted: 'Not started',
    },
    mcp: {
      title: 'Model Context Protocol (MCP)',
      desc: 'Configure MCP servers to extend AI capabilities',
      warning:
        'When using tools, the tool response is passed to the language model (LLM). If the tool result contains a large amount of content, this can significantly increase LLM usage and associated costs. Please be mindful when enabling or using tools that may return long outputs.',
      notSupportedOnMobile: 'MCP is not supported on mobile devices',
      mcpServers: 'MCP Servers',
      addServer: 'Add MCP Server',
      serverName: 'Server Name',
      command: 'Command',
      server: 'Server',
      status: 'Status',
      enabled: 'Enabled',
      actions: 'Actions',
      noServersFound: 'No MCP servers found',
      tools: 'Tools',
      error: 'Error',
      connected: 'Connected',
      connecting: 'Connecting...',
      disconnected: 'Disconnected',
      autoExecute: 'Auto-execute',
      deleteServer: 'Delete MCP Server',
      deleteServerConfirm: 'Are you sure you want to delete MCP server',
      edit: 'Edit',
      delete: 'Delete',
      expand: 'Expand',
      collapse: 'Collapse',
    },
    templates: {
      title: 'Templates',
      desc: 'Create reusable prompt templates',
      howToUse:
        'Create templates with reusable content that you can quickly insert into your chat. Type /template-name in the chat input to trigger template insertion. You can also drag and select text in the chat input to reveal a "Create template" button for quick template creation.',
      savedTemplates: 'Saved Templates',
      addTemplate: 'Add Prompt Template',
      templateName: 'Template Name',
      noTemplates: 'No templates found',
      loading: 'Loading templates...',
      deleteTemplate: 'Delete Template',
      deleteTemplateConfirm: 'Are you sure you want to delete template',
      editTemplate: 'Edit Template',
      name: 'Name',
      actions: 'Actions',
    },
    continuation: {
      title: 'Sparkle Mode',
      aiSubsectionTitle: 'Super Continuation',
      customSubsectionTitle: 'Smart Space',
      tabSubsectionTitle: 'Tab Completion',
      superContinuation: 'Super Continuation',
      superContinuationDesc:
        'Enable to unlock the Sparkle sidebar view where you can configure dedicated continuation models, rules, and reference sources. When disabled, only the Chat view is available and continuation reuses the current chat model.',
      continuationModel: 'Sparkle continuation model',
      continuationModelDesc:
        'Select the model used for continuation while Sparkle mode is enabled.',
      smartSpaceDescription:
        'Smart Space offers a lightweight floating composer while you write. By default it appears when you press Space on an empty line. Press Enter to submit and Esc to close.',
      smartSpaceToggle: 'Enable Smart Space',
      smartSpaceToggleDesc:
        'When disabled, pressing Space will no longer summon the Smart Space floating composer.',
      keywordTrigger: 'Enable keyword trigger for AI continuation',
      keywordTriggerDesc:
        'Automatically trigger continuation when the specified keyword is detected in the editor. Recommended: cc.',
      triggerKeyword: 'Trigger keyword',
      triggerKeywordDesc:
        'Continuation is triggered when the text immediately before the cursor equals this keyword (default: cc).',
      tabCompletion: 'Enable Tab completion',
      tabCompletionDesc:
        'After a 3-second pause, request a prefix completion and show it as gray ghost text that can be accepted with Tab.',
      tabCompletionModel: 'Completion model',
      tabCompletionModelDesc:
        'Choose which model provides Tab completion suggestions.',
      tabCompletionTriggerDelay: 'Trigger delay (ms)',
      tabCompletionTriggerDelayDesc:
        'How long to wait after you stop typing before a prefix completion request is sent.',
      tabCompletionMinContextLength: 'Minimum context length',
      tabCompletionMinContextLengthDesc:
        'Skip Tab completion unless the text before the cursor contains at least this many characters.',
      tabCompletionMaxContextChars: 'Max context characters',
      tabCompletionMaxContextCharsDesc:
        'Limit how many recent characters are sent to the model for prefix completion.',
      tabCompletionMaxSuggestionLength: 'Max suggestion length',
      tabCompletionMaxSuggestionLengthDesc:
        'Cap the number of characters inserted when accepting a suggestion.',
      tabCompletionMaxTokens: 'Max tokens',
      tabCompletionMaxTokensDesc:
        'Limit the number of tokens requested from the model for each prefix completion call.',
      tabCompletionTemperature: 'Sampling temperature',
      tabCompletionTemperatureDesc:
        'Controls creativity for prefix suggestions (0 = deterministic, higher = more diverse).',
      tabCompletionRequestTimeout: 'Request timeout (ms)',
      tabCompletionRequestTimeoutDesc:
        'Abort a prefix completion request if it takes longer than this time.',
      tabCompletionMaxRetries: 'Retry count',
      tabCompletionMaxRetriesDesc:
        'Automatically retry timed-out prefix completion requests up to this many times.',
      defaultSystemPrompt: 'Default continuation system prompt',
      defaultSystemPromptDesc:
        'This prompt will be used as the system message for continuation. Leave empty to use the built-in default.',
    },
    etc: {
      title: 'Etc',
      resetSettings: 'Reset settings',
      resetSettingsDesc: 'Reset all settings to default values',
      resetSettingsConfirm:
        'Are you sure you want to reset all settings to default values? This cannot be undone.',
      resetSettingsSuccess: 'Settings have been reset to defaults',
      reset: 'Reset',
      clearChatHistory: 'Clear chat history',
      clearChatHistoryDesc: 'Delete all chat conversations and messages',
      clearChatHistoryConfirm:
        'Are you sure you want to clear all chat history? This action cannot be undone.',
      clearChatHistorySuccess: 'All chat history has been cleared',
      resetProviders: 'Reset providers and models',
      resetProvidersDesc: 'Restore default providers and model configurations',
      resetProvidersConfirm:
        'Are you sure you want to reset providers and models to defaults? This will overwrite existing configuration.',
      resetProvidersSuccess: 'Providers and models have been reset to defaults',
    },
    language: {
      title: 'Language',
      select: 'Select Language',
    },
  },

  chat: {
    placeholder: 'Ask anything about your vault...',
    sendMessage: 'Send message',
    newChat: 'New chat',
    continueResponse: 'Continue Response',
    stopGeneration: 'Stop Generation',
    vaultSearch: 'Vault search',
    selectModel: 'Select model',
    uploadImage: 'Upload image',
    addContext: 'Add context',
    applyChanges: 'Apply changes',
    copyMessage: 'Copy message',
    regenerate: 'Regenerate',
    reasoning: 'Reasoning',
    annotations: 'Annotations',
    modeTitle: 'Chat mode',
    modeRAG: 'RAG',
    modeBrute: 'Brute',
    modeLearning: 'Learning mode',
    customContinuePromptLabel: 'Continuation instruction',
    customContinuePromptPlaceholder: 'Ask AI...',
    customContinueProcessing: 'Thinking',
    customContinueError: 'Generation failed. Please try again soon.',
    customContinueSections: {
      suggestions: {
        title: 'Suggestions',
        items: {
          continue: {
            label: 'Continue writing',
            instruction:
              'Continue the current passage and keep the tone consistent.',
          },
        },
      },
      writing: {
        title: 'Writing',
        items: {
          summarize: {
            label: 'Add a summary',
            instruction: 'Write a concise summary of the current content.',
          },
          todo: {
            label: 'Add action items',
            instruction:
              'Generate a checklist of actionable next steps from the current context.',
          },
          flowchart: {
            label: 'Create a flowchart',
            instruction:
              'Turn the current points into a flowchart or ordered steps.',
          },
          table: {
            label: 'Organize into a table',
            instruction:
              'Convert the current information into a structured table with appropriate columns.',
          },
          freewrite: {
            label: 'Freewriting',
            instruction:
              'Start a fresh continuation in a creative style that fits the context.',
          },
        },
      },
      thinking: {
        title: 'Ideate & converse',
        items: {
          brainstorm: {
            label: 'Brainstorm ideas',
            instruction:
              'Suggest several fresh ideas or angles based on the current topic.',
          },
          analyze: {
            label: 'Analyze this section',
            instruction:
              'Provide a brief analysis highlighting key insights, risks, or opportunities.',
          },
          dialogue: {
            label: 'Ask follow-up questions',
            instruction:
              'Generate thoughtful questions that can deepen understanding of the topic.',
          },
        },
      },
      custom: {
        title: 'Custom',
      },
    },
    customRewritePromptPlaceholder:
      'Describe how to rewrite the selected text, e.g., "Make it concise and active voice; keep markdown structure". Press Shift+Enter to confirm, Enter for a new line, Esc to close.',
    conversationSettings: {
      openAria: 'Conversation settings',
      chatMemory: 'Chat Memory',
      maxContext: 'Max Context',
      sampling: 'Sampling Parameters',
      temperature: 'Temperature',
      topP: 'Top P',
      streaming: 'Streaming',
      vaultSearch: 'Vault Search',
      useVaultSearch: 'RAG Search',
      geminiTools: 'Gemini Tools',
      webSearch: 'Web Search',
      urlContext: 'URL Context',
    },
  },

  notices: {
    rebuildingIndex: 'Rebuilding vault index...',
    rebuildComplete: 'Rebuilding vault index complete',
    rebuildFailed: 'Rebuilding vault index failed',
    updatingIndex: 'Updating vault index...',
    indexUpdated: 'Vault index updated',
    indexUpdateFailed: 'Vault index update failed',
    migrationComplete: 'Migration to JSON storage completed successfully',
    migrationFailed:
      'Failed to migrate to JSON storage. Please check the console for details.',
    reloadingPlugin: 'Reloading "next-composer" due to migration',
    settingsInvalid: 'Invalid settings',
  },

  errors: {
    providerNotFound: 'Provider not found',
    modelNotFound: 'Model not found',
    invalidApiKey: 'Invalid API key',
    networkError: 'Network error',
    databaseError: 'Database error',
    mcpServerError: 'MCP server error',
  },
}
