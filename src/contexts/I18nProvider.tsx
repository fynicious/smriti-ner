'use client';
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { getTranslation, LANGUAGES, type TranslationStrings, type Language } from '@/lib/translations';
import { getLanguageCapabilities, type LanguageCapabilityMeta } from '@/lib/i18n/metadata';

interface I18nContextType {
  lang: string;
  scriptPreference: string | null;
  setScriptPreference: (script: string | null) => void;
  t: TranslationStrings;
  setLang: (code: string) => void;
  languages: Language[];
  capabilities: LanguageCapabilityMeta;
}

const I18nContext = createContext<I18nContextType | null>(null);

const STORAGE_KEY = 'ner-app-language';
const SCRIPT_STORAGE_KEY = 'ner-app-script';

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState('en');
  const [scriptPreference, setScriptState] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) setLangState(saved);
      const savedScript = localStorage.getItem(SCRIPT_STORAGE_KEY);
      if (savedScript) setScriptState(savedScript);
    }
  }, []);

  const setLang = useCallback((code: string) => {
    setLangState(code);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, code);
    }
  }, []);

  const setScriptPreference = useCallback((script: string | null) => {
    setScriptState(script);
    if (typeof window !== 'undefined') {
      if (script) localStorage.setItem(SCRIPT_STORAGE_KEY, script);
      else localStorage.removeItem(SCRIPT_STORAGE_KEY);
    }
  }, []);

  // Automatically honor Manipur dual script selection when language is mni
  const effectiveLang =
    lang === 'mni' && (scriptPreference === 'meetei_mayek' || scriptPreference === 'mymk')
      ? 'mni-mymk'
      : lang === 'mni-mymk' && (scriptPreference === 'bengali' || scriptPreference === 'beng')
      ? 'mni'
      : lang;

  const t = getTranslation(effectiveLang);
  const capabilities = getLanguageCapabilities(effectiveLang);

  return (
    <I18nContext.Provider
      value={{
        lang: effectiveLang,
        scriptPreference,
        setScriptPreference,
        t,
        setLang,
        languages: LANGUAGES,
        capabilities,
      }}
    >
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
