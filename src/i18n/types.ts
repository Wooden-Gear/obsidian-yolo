export type Language = 'en' | 'zh'

export interface TranslationKeys {
  // Commands
  commands: {
    openChat: string
    addSelectionToChat: string
    rebuildVaultIndex: string
    updateVaultIndex: string
    continueWriting: string
    continueWritingSelected: string
    customContinueWriting: string
    customRewrite: string
  }
  
  // UI Common
  common: {
    save: string
    cancel: string
    delete: string
    edit: string
    add: string
    clear: string
    remove: string
    confirm: string
    close: string
    loading: string
    error: string
    success: string
    warning: string
    retry: string
    copy: string
    paste: string
    // additions
    default?: string
    on?: string
    off?: string
  }

  // Settings
  settings: {
    title: string
    supportSmartComposer: {
      name: string
      desc: string
      buyMeACoffee: string
    }
    defaults: {
      title: string
      defaultChatModel: string
      defaultChatModelDesc: string
      toolModel: string
      toolModelDesc: string
      globalSystemPrompt: string
      globalSystemPromptDesc: string
      continuationSystemPrompt: string
      continuationSystemPromptDesc: string
      chatTitlePrompt: string
      chatTitlePromptDesc: string
    }
    chatPreferences: {
      title: string
      includeCurrentFile: string
      includeCurrentFileDesc: string
      enableBruteMode?: string
      enableBruteModeDesc?: string
      enableLearningMode?: string
      enableLearningModeDesc?: string
      learningModePrompt?: string
      learningModePromptDesc?: string
      enableTools: string
      enableToolsDesc: string
      maxAutoIterations: string
      maxAutoIterationsDesc: string
      maxContextMessages: string
      maxContextMessagesDesc: string
      defaultTemperature?: string
      defaultTemperatureDesc?: string
      defaultTopP?: string
      defaultTopPDesc?: string
    }
    assistants: {
      title: string
      desc: string
      addAssistant: string
      noAssistants: string
      // existing optional keys in locales
      editAssistant?: string
      deleteAssistant?: string
      noAssistant?: string
      selectAssistant?: string
      name?: string
      description?: string
      systemPrompt?: string
      actions?: string
      // new optional helpers
      namePlaceholder?: string
      systemPromptDesc?: string
      systemPromptPlaceholder?: string
      defaultAssistantName?: string
      // Confirm modal & aria
      deleteConfirmTitle?: string
      deleteConfirmMessagePrefix?: string
      deleteConfirmMessageSuffix?: string
      addAssistantAria?: string
      deleteAssistantAria?: string
      maxContextMessagesDesc?: string
    }
    providers: {
      title: string
      desc: string
      howToGetApiKeys: string
      addProvider: string
      editProvider: string
      editProviderTitle: string
      deleteProvider: string
      deleteConfirm: string
      deleteWarning: string
      chatModels: string
      embeddingModels: string
      embeddingsWillBeDeleted: string
      addCustomProvider: string
      apiKey: string
      apiKeyDesc: string
      apiKeyPlaceholder: string
      baseUrl: string
      baseUrlDesc: string
      baseUrlPlaceholder: string
      noStainlessHeaders: string
      noStainlessHeadersDesc: string
    }
    models: {
      title: string
      chatModels: string
      embeddingModels: string
      addChatModel: string
      addEmbeddingModel: string
      addCustomChatModel: string
      addCustomEmbeddingModel: string
      editChatModel: string
      editEmbeddingModel: string
      editCustomChatModel: string
      editCustomEmbeddingModel: string
      modelId: string
      modelIdDesc: string
      modelIdPlaceholder: string
      modelName: string
      modelNamePlaceholder: string
      // auto-fetched models helper labels
      availableModelsAuto?: string
      fetchModelsFailed?: string
      embeddingModelsFirst?: string
      // reasoning UI
      reasoningType?: string
      reasoningTypeNone?: string
      reasoningTypeOpenAI?: string
      reasoningTypeGemini?: string
      openaiReasoningEffort?: string
      openaiReasoningEffortDesc?: string
      geminiThinkingBudget?: string
      geminiThinkingBudgetDesc?: string
      geminiThinkingBudgetPlaceholder?: string
      toolType?: string
      toolTypeDesc?: string
      toolTypeNone?: string
      toolTypeGemini?: string
      promptLevel: string
      promptLevelDesc: string
      promptLevelDefault: string
      promptLevelSimple: string
      dimension: string
      dimensionDesc: string
      dimensionPlaceholder: string
      noChatModelsConfigured: string
      noEmbeddingModelsConfigured: string
    }
    rag: {
      title: string
      embeddingModel: string
      embeddingModelDesc: string
      chunkSize: string
      chunkSizeDesc: string
      thresholdTokens: string
      thresholdTokensDesc: string
      minSimilarity: string
      minSimilarityDesc: string
      limit: string
      limitDesc: string
      includePatterns: string
      includePatternsDesc: string
      excludePatterns: string
      excludePatternsDesc: string
      testPatterns: string
      manageEmbeddingDatabase: string
      manage: string
      rebuildIndex: string
      // UI additions
      selectedFolders?: string
      excludedFolders?: string
      selectFoldersPlaceholder?: string
      selectExcludeFoldersPlaceholder?: string
      conflictNoteDefaultInclude?: string
      conflictExact?: string
      conflictParentExclude?: string
      conflictChildExclude?: string
      conflictRule?: string
      // Auto update additions
      autoUpdate?: string
      autoUpdateDesc?: string
      autoUpdateInterval?: string
      autoUpdateIntervalDesc?: string
      manualUpdateNow?: string
      manualUpdateNowDesc?: string
      // Index progress header/status
      indexProgressTitle?: string
      indexing?: string
      notStarted?: string
    }
    mcp: {
      title: string
      desc: string
      warning: string
      notSupportedOnMobile: string
      mcpServers: string
      addServer: string
      serverName: string
      command: string
      server: string
      status: string
      enabled: string
      actions: string
      noServersFound: string
      tools: string
      error: string
      connected: string
      connecting: string
      disconnected: string
      autoExecute: string
      deleteServer: string
      deleteServerConfirm: string
      edit: string
      delete: string
      expand: string
      collapse: string
    }
    templates: {
      title: string
      desc: string
      howToUse: string
      savedTemplates: string
      addTemplate: string
      templateName: string
      noTemplates: string
      loading: string
      deleteTemplate: string
      deleteTemplateConfirm: string
      editTemplate: string
      name: string
      actions: string
    }
    continuation: {
      title: string
      modelSource: string
      modelSourceDesc: string
      fixedModel: string
      fixedModelDesc: string
      keywordTrigger: string
      keywordTriggerDesc: string
      triggerKeyword: string
      triggerKeywordDesc: string
      floatingPanelKeywordTrigger: string
      floatingPanelKeywordTriggerDesc: string
      floatingPanelTriggerKeyword: string
      floatingPanelTriggerKeywordDesc: string
      defaultSystemPrompt: string
      defaultSystemPromptDesc: string
    }
    etc: {
      title: string
      resetSettings: string
      resetSettingsDesc: string
      resetSettingsConfirm: string
      resetSettingsSuccess: string
      reset: string
      // new actions
      clearChatHistory?: string
      clearChatHistoryDesc?: string
      clearChatHistoryConfirm?: string
      clearChatHistorySuccess?: string
      resetProviders?: string
      resetProvidersDesc?: string
      resetProvidersConfirm?: string
      resetProvidersSuccess?: string
    }
    language: {
      title: string
      select: string
    }
  }

  // Chat Interface
  chat: {
    placeholder: string
    sendMessage: string
    newChat: string
    continueResponse?: string
    stopGeneration?: string
    vaultSearch: string
    selectModel: string
    uploadImage: string
    addContext: string
    applyChanges: string
    copyMessage: string
    regenerate: string
    reasoning: string
    annotations: string
    modeTitle?: string
    modeRAG?: string
    modeBrute?: string
    modeLearning?: string
    customContinuePromptLabel?: string
    customContinuePromptPlaceholder?: string
    customRewritePromptPlaceholder?: string
    showMore?: string
    showLess?: string
    // conversation settings popover
    conversationSettings?: {
      openAria?: string
      chatMemory?: string
      maxContext?: string
      sampling?: string
      temperature?: string
      topP?: string
      streaming?: string
      vaultSearch?: string
      useVaultSearch?: string
      geminiTools?: string
      webSearch?: string
      urlContext?: string
    }
  }

  // Notices and Messages
  notices: {
    rebuildingIndex: string
    rebuildComplete: string
    rebuildFailed: string
    updatingIndex: string
    indexUpdated: string
    indexUpdateFailed: string
    migrationComplete: string
    migrationFailed: string
    reloadingPlugin: string
    settingsInvalid: string
  }

  // Errors
  errors: {
    providerNotFound: string
    modelNotFound: string
    invalidApiKey: string
    networkError: string
    databaseError: string
    mcpServerError: string
  }
}
