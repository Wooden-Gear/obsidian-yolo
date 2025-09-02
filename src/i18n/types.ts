export type Language = 'en' | 'zh'

export interface TranslationKeys {
  // Commands
  commands: {
    openChat: string
    addSelectionToChat: string
    rebuildVaultIndex: string
    updateVaultIndex: string
  }
  
  // UI Common
  common: {
    save: string
    cancel: string
    delete: string
    edit: string
    add: string
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
  }

  // Settings
  settings: {
    title: string
    supportSmartComposer: {
      name: string
      desc: string
      buyMeACoffee: string
    }
    chat: {
      title: string
      defaultModel: string
      applyModel: string
      systemPrompt: string
      includeCurrentFile: string
      enableTools: string
      maxAutoIterations: string
    }
    assistants: {
      title: string
      addAssistant: string
      editAssistant: string
      deleteAssistant: string
      name: string
      systemPrompt: string
      model: string
    }
    providers: {
      title: string
      addProvider: string
      editProvider: string
      deleteProvider: string
    }
    models: {
      title: string
      chatModels: string
      embeddingModels: string
      addChatModel: string
      addEmbeddingModel: string
    }
    rag: {
      title: string
      embeddingModel: string
      chunkSize: string
      thresholdTokens: string
      minSimilarity: string
      limit: string
      includePatterns: string
      excludePatterns: string
      rebuildIndex: string
    }
    mcp: {
      title: string
      addServer: string
      serverName: string
      command: string
    }
    templates: {
      title: string
      addTemplate: string
      templateName: string
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
    vaultSearch: string
    selectModel: string
    uploadImage: string
    addContext: string
    applyChanges: string
    copyMessage: string
    regenerate: string
    reasoning: string
    annotations: string
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