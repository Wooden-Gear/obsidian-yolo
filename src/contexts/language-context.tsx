import React, { createContext, useContext, ReactNode, useState, useEffect } from 'react'

import { Language, createTranslationFunction } from '../i18n'
import { usePlugin } from './plugin-context'

interface LanguageContextType {
  language: Language
  t: (keyPath: string, fallback?: string) => string
  setLanguage: (language: Language) => void
}

const LanguageContext = createContext<LanguageContextType | null>(null)

interface LanguageProviderProps {
  children: ReactNode
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const plugin = usePlugin()
  const [language, setLanguageState] = useState<Language>(plugin.settings.language as Language || 'en')
  
  // Listen for settings changes
  useEffect(() => {
    const unsubscribe = plugin.addSettingsChangeListener((newSettings) => {
      setLanguageState(newSettings.language as Language || 'en')
    })
    return unsubscribe
  }, [plugin])
  
  const t = createTranslationFunction(language)
  
  const setLanguage = async (newLanguage: Language) => {
    await plugin.setSettings({
      ...plugin.settings,
      language: newLanguage,
    })
  }

  return (
    <LanguageContext.Provider
      value={{
        language,
        t,
        setLanguage,
      }}
    >
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext)
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider')
  }
  return context
}