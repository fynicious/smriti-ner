'use client';
import { createContext, useContext, useState, useCallback, ReactNode } from 'react';

interface VoiceAssistantContextType {
  isSpeaking: boolean;
  locale: string;
  setLocale: (locale: string) => void;
  speak: (text?: string) => void;
  stop: () => void;
  availableLocales: { code: string; label: string }[];
}

const availableLocales = [
  { code: 'en-IN', label: 'English' },
  { code: 'as-IN', label: 'অসমীয়া (Assamese)' },
  { code: 'bn-IN', label: 'বাংলা (Bengali)' },
];

const VoiceAssistantContext = createContext<VoiceAssistantContextType | null>(null);

export function VoiceAssistantProvider({ children }: { children: ReactNode }) {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [locale, setLocale] = useState('en-IN');

  const speak = useCallback(
    (text?: string) => {
      if (typeof window === 'undefined' || !window.speechSynthesis) return;

      // Stop any ongoing speech
      window.speechSynthesis.cancel();

      const textToSpeak =
        text || document.querySelector('main')?.innerText || '';

      if (!textToSpeak.trim()) return;

      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = locale;
      utterance.rate = 0.8; // Slower, calmer pace for elderly
      utterance.pitch = 1.0;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
    },
    [locale]
  );

  const stop = useCallback(() => {
    if (typeof window === 'undefined') return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, []);

  return (
    <VoiceAssistantContext.Provider
      value={{ isSpeaking, locale, setLocale, speak, stop, availableLocales }}
    >
      {children}
    </VoiceAssistantContext.Provider>
  );
}

export function useVoiceAssistant() {
  const context = useContext(VoiceAssistantContext);
  if (!context) {
    throw new Error('useVoiceAssistant must be used within a VoiceAssistantProvider');
  }
  return context;
}
