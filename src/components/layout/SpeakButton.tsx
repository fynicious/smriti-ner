'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Globe, X, AlertCircle } from 'lucide-react';
import { useVoiceAssistant } from '@/contexts/VoiceAssistantProvider';
import { useI18n } from '@/contexts/I18nProvider';
import { getLanguageCapabilities } from '@/lib/i18n/metadata';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';

const HIDDEN_SPEAK_ROUTES = ['/login', '/register', '/check-in', '/offline', '/doctor'];

const STATUS_BADGE: Record<string, { label: string; style: string }> = {
  VERIFIED_BASELINE: { label: 'Verified Baseline', style: 'bg-mint-100 text-mint-900' },
  NEEDS_NATIVE_REVIEW: { label: 'Needs Native Review', style: 'bg-sky-100 text-sky-900' },
  PARTIAL_STARTER: { label: 'Starter Pack', style: 'bg-amber-100 text-amber-900' },
  UNTRANSLATED_PLACEHOLDER: { label: 'English Fallback Only', style: 'bg-slate-200 text-slate-800' },
};

export default function SpeakButton() {
  const pathname = usePathname();
  const { isSpeaking, speak, stop, setLocale } = useVoiceAssistant();
  const { lang, setLang, languages, capabilities } = useI18n();
  const [showLangPicker, setShowLangPicker] = useState(false);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowLangPicker(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  if (HIDDEN_SPEAK_ROUTES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const handleLangChange = (code: string) => {
    setLang(code);
    const language = languages.find((l) => l.code === code);
    if (language?.speechCode) {
      setLocale(language.speechCode);
    }
    setShowLangPicker(false);
  };

  return (
    <>
      <AnimatePresence>
        {showLangPicker && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="lang-picker-title"
            className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
            onClick={() => setShowLangPicker(false)}
          >
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg max-h-[85dvh] overflow-hidden shadow-2xl pb-safe flex flex-col"
            >
              <div className="p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 id="lang-picker-title" className="text-xl font-bold text-slate-900">
                    🌐 Select Language &amp; Script
                  </h2>
                  <p className="text-xs font-medium text-slate-600 mt-0.5">
                    Coverage &amp; voice capabilities shown transparently per NER state
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close language picker"
                  onClick={() => setShowLangPicker(false)}
                  className="p-2.5 rounded-full text-slate-700 hover:bg-slate-100"
                >
                  <X size={20} />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[62vh] p-4 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {languages.map((language) => {
                    const meta = getLanguageCapabilities(language.code);
                    const badge = STATUS_BADGE[meta.verificationStatus];
                    return (
                      <button
                        key={language.code}
                        type="button"
                        onClick={() => handleLangChange(language.code)}
                        className={`flex flex-col items-start p-3.5 rounded-2xl text-left transition-colors border-2 ${
                          lang === language.code
                            ? 'bg-peach-100 border-peach-400 ring-2 ring-peach-300'
                            : 'bg-slate-50 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full gap-1">
                          <span className="text-sm font-black text-slate-900">{language.nativeName}</span>
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${badge.style}`}>
                            {badge.label}
                          </span>
                        </div>
                        <span className="text-xs font-bold text-slate-700 mt-0.5">{language.name}</span>
                        <span className="text-[11px] font-medium text-slate-600 mt-0.5">
                          {meta.state} • {meta.browserTtsSupported ? 'Voice TTS' : 'Caregiver Audio / Visual'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-[88px] right-3 sm:bottom-24 sm:right-5 z-30 flex items-center gap-1.5 sm:gap-2 print:hidden">
        {!capabilities.browserTtsSupported && (
          <span
            title={capabilities.note}
            className="hidden sm:inline-flex items-center gap-1 bg-white/95 border border-amber-300 text-amber-900 text-xs font-bold px-3 py-1.5 rounded-full shadow-sm"
          >
            <AlertCircle size={14} /> Visual / Recorded Audio
          </span>
        )}
        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={() => setShowLangPicker(true)}
          aria-label="Select display language"
          className="w-12 h-12 min-w-[48px] min-h-[48px] sm:w-[52px] sm:h-[52px] sm:min-w-[52px] sm:min-h-[52px] rounded-full bg-white shadow-md border-2 border-slate-200 flex items-center justify-center text-slate-800 hover:text-slate-950"
        >
          <Globe size={22} />
        </motion.button>

        <motion.button
          type="button"
          whileTap={{ scale: 0.9 }}
          onClick={isSpeaking ? stop : () => speak()}
          aria-label={isSpeaking ? 'Stop reading screen aloud' : 'Read screen aloud'}
          className={`w-14 h-14 min-w-[56px] min-h-[56px] rounded-full shadow-lg border-2 border-white flex items-center justify-center transition-colors duration-200 ${
            isSpeaking ? 'bg-rose-600 text-white' : 'bg-amber-400 text-slate-950 hover:bg-amber-500'
          }`}
        >
          {isSpeaking ? <VolumeX size={24} /> : <Volume2 size={24} />}
        </motion.button>
      </div>
    </>
  );
}
