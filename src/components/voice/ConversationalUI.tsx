'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, X, Volume2, VolumeX, ChevronUp, Send, ShieldCheck, ArrowRight } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/contexts/I18nProvider';
import { LANGUAGES } from '@/lib/translations';
import { useActivePatient } from '@/hooks/useActivePatient';
import { parseVoiceIntent, type ParsedVoiceIntent } from '@/lib/ai/intent-parser';

type State = 'idle' | 'listening' | 'thinking' | 'speaking';

const SUGGESTIONS = [
  'What do I do next?',
  'Did I take my medicine?',
  'Show me my family',
  'Play a memory game',
  'How much water today?',
];

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}

interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

export function ConversationalUI({
  isOpen,
  onClose,
  nextItemTitle,
  nextItemTime,
  onOpenFamilyCall,
  onQuickLogWater,
}: {
  isOpen: boolean;
  onClose: () => void;
  nextItemTitle?: string | null;
  nextItemTime?: string | null;
  onOpenFamilyCall?: () => void;
  onQuickLogWater?: () => Promise<void> | void;
}) {
  const router = useRouter();
  const { lang } = useI18n();
  const { patientId } = useActivePatient();

  const [uiState, setUiState] = useState<State>('idle');
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('Hello! I am Smriti. Tap the microphone and talk to me.');
  const [responseMeta, setResponseMeta] = useState<{ source: string; factGrounded: boolean; intent?: ParsedVoiceIntent }>({
    source: 'local-fallback',
    factGrounded: true,
  });
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; text: string }[]>([]);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [typed, setTyped] = useState('');
  const [speechSupported, setSpeechSupported] = useState(false);
  const recogRef = useRef<SpeechRecognitionInstance | null>(null);

  const activeLangMeta = LANGUAGES.find((l) => l.code === lang);
  const activeSpeechCode = activeLangMeta?.speechCode || 'en-IN';
  const hasNativeVoiceSupport = Boolean(activeLangMeta?.speechCode);

  useEffect(() => {
    setSpeechSupported(
      typeof window !== 'undefined' && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    );
  }, []);

  useEffect(() => {
    if (!isOpen) {
      if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
      recogRef.current?.abort();
      setUiState('idle');
      setTranscript('');
      setHistory([]);
    }
  }, [isOpen]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
        recogRef.current?.abort();
        onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  const speak = useCallback(
    (text: string) => {
      if (!ttsEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
        setUiState('idle');
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 0.85;
      u.pitch = 1.0;
      u.lang = activeSpeechCode;
      u.onstart = () => setUiState('speaking');
      u.onend = () => setUiState('idle');
      u.onerror = () => setUiState('idle');
      window.speechSynthesis.speak(u);
    },
    [ttsEnabled, activeSpeechCode]
  );

  const executeOfflineIntent = useCallback(
    (text: string): { reply: string; intent: ParsedVoiceIntent } => {
      const parsed = parseVoiceIntent(text);
      if (parsed.intent === 'NEXT_ACTIVITY' || parsed.intent === 'READ_ROUTINE') {
        return {
          reply: nextItemTitle
            ? `Your next activity is ${nextItemTitle} at ${nextItemTime || 'soon'}.`
            : 'All scheduled tasks appear done for now. You can rest or view family memories.',
          intent: parsed,
        };
      }
      if (parsed.intent === 'SHOW_FAMILY') {
        return { reply: 'Tap below to open your Family & Memories book.', intent: parsed };
      }
      if (parsed.intent === 'PLAY_GAME') {
        return { reply: 'Tap below to open calming Brain Games.', intent: parsed };
      }
      if (parsed.intent === 'CALL_FAMILY') {
        return { reply: 'Tap below to choose who to call safely.', intent: parsed };
      }
      return {
        reply: 'I am working offline right now. Your routine, water tracker, games, and family photos stay ready.',
        intent: parsed,
      };
    },
    [nextItemTitle, nextItemTime]
  );

  const callAI = useCallback(
    async (text: string) => {
      setTranscript(text);
      setResponse('');
      setUiState('thinking');

      const currentHistory = [...history];
      setHistory([...currentHistory, { role: 'user', text }]);

      if (typeof window !== 'undefined' && !navigator.onLine) {
        const off = executeOfflineIntent(text);
        setResponse(off.reply);
        setResponseMeta({ source: 'local-fallback', factGrounded: true, intent: off.intent });
        setHistory((prev) => [...prev, { role: 'assistant', text: off.reply }]);
        speak(off.reply);
        return;
      }

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            patientId: patientId || undefined,
            lang,
            message: text,
            history: currentHistory.slice(-6),
          }),
        });
        let reply = 'I am here for you. Could you repeat that?';
        let source = 'local-fallback';
        let factGrounded = true;
        let intent: ParsedVoiceIntent | undefined = parseVoiceIntent(text);

        if (res.ok) {
          const d = await res.json();
          reply = d.reply || reply;
          source = d.source || source;
          factGrounded = Boolean(d.factGrounded);
          intent = d.intent || intent;
        }
        setResponse(reply);
        setResponseMeta({ source, factGrounded, intent });
        setHistory((prev) => [...prev, { role: 'assistant', text: reply }]);
        speak(reply);
      } catch {
        const off = executeOfflineIntent(text);
        setResponse(off.reply);
        setResponseMeta({ source: 'local-fallback', factGrounded: true, intent: off.intent });
        speak(off.reply);
      }
    },
    [speak, history, patientId, lang, executeOfflineIntent]
  );

  const buildRecognition = useCallback(() => {
    if (!speechSupported) return null;
    const win = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };
    const SR = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SR) return null;
    const r = new SR();
    r.continuous = false;
    r.interimResults = true;
    r.lang = activeSpeechCode;
    r.onresult = (e: SpeechRecognitionEventLike) => {
      let interim = '';
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const chunk = e.results[i][0].transcript;
        if (e.results[i].isFinal) final += chunk;
        else interim += chunk;
      }
      setTranscript(final || interim);
      if (final) callAI(final);
    };
    r.onerror = () => setUiState('idle');
    r.onend = () => setUiState((prev) => (prev === 'listening' ? 'idle' : prev));
    return r;
  }, [speechSupported, activeSpeechCode, callAI]);

  const startListening = () => {
    if (!speechSupported) {
      setShowKeyboard(true);
      return;
    }
    if (typeof window !== 'undefined') window.speechSynthesis?.cancel();
    setTranscript('');
    setUiState('listening');
    const r = buildRecognition();
    recogRef.current = r;
    r?.start();
  };

  const stopListening = () => {
    recogRef.current?.stop();
    setUiState('idle');
  };

  const handleTextSubmit = () => {
    if (typed.trim()) {
      callAI(typed.trim());
      setTyped('');
      setShowKeyboard(false);
    }
  };

  const handleConfirmAction = async () => {
    const intent = responseMeta.intent;
    if (!intent) return;
    if (intent.targetRoute) {
      onClose();
      router.push(intent.targetRoute);
      return;
    }
    if (intent.intent === 'CALL_FAMILY' && onOpenFamilyCall) {
      onOpenFamilyCall();
      return;
    }
    if (intent.intent === 'LOG_WATER' && onQuickLogWater) {
      await onQuickLogWater();
      setResponse('Added 1 glass (250 ml) of water to your log.');
      setResponseMeta({ source: 'verified-record', factGrounded: true });
    }
  };

  const ringSize = { idle: 1, listening: 1.12, thinking: 1.04, speaking: 1.08 };
  const ringColor: Record<State, string> = {
    idle: 'from-peach-300 to-lavender-300',
    listening: 'from-red-500 to-orange-500',
    thinking: 'from-lavender-400 to-mint-400',
    speaking: 'from-mint-400 to-sky-400',
  };
  const stateLabel: Record<State, string> = {
    idle: speechSupported ? 'Tap to speak' : 'Tap to type message',
    listening: 'Listening…',
    thinking: 'Thinking…',
    speaking: 'Speaking…',
  };

  const showActionCta =
    responseMeta.intent &&
    responseMeta.intent.intent !== 'NONE' &&
    Boolean(responseMeta.intent.actionLabel);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.97 }}
          role="dialog"
          aria-modal="true"
          aria-label="Smriti Companion Chat"
          className="fixed inset-0 z-[200] flex flex-col overflow-hidden"
          style={{ background: 'linear-gradient(160deg,#fff8f2 0%,#f5f0ff 50%,#f0faf5 100%)' }}
        >
          {/* Top bar */}
          <div className="flex items-center justify-between px-4 sm:px-5 pt-5 sm:pt-10 pb-2 sm:pb-3 flex-shrink-0 max-w-2xl w-full mx-auto">
            <div className="flex items-center gap-2">
              <div className="text-2xl">🌸</div>
              <div>
                <p className="font-black text-lg text-slate-900 leading-none">Smriti</p>
                <p className="text-xs font-bold text-amber-800 tracking-wide uppercase">Voice Companion</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                aria-label={ttsEnabled ? 'Mute voice replies' : 'Enable voice replies'}
                onClick={() => {
                  setTtsEnabled((v) => !v);
                  window.speechSynthesis?.cancel();
                }}
                className={`min-w-[52px] min-h-[52px] rounded-full border-2 flex items-center justify-center transition-colors ${
                  ttsEnabled ? 'bg-mint-50 border-mint-300 text-mint-700' : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
              >
                {ttsEnabled ? <Volume2 size={22} /> : <VolumeX size={22} />}
              </button>
              <button
                type="button"
                aria-label="Close Smriti companion"
                onClick={() => {
                  window.speechSynthesis?.cancel();
                  recogRef.current?.abort();
                  onClose();
                }}
                className="min-w-[52px] min-h-[52px] rounded-full bg-slate-100 border-2 border-slate-300 text-slate-800 hover:bg-slate-200 flex items-center justify-center"
              >
                <X size={22} />
              </button>
            </div>
          </div>

          {!hasNativeVoiceSupport && (
            <div className="px-5 max-w-2xl w-full mx-auto">
              <p className="text-xs font-bold text-slate-700 text-center bg-white/85 rounded-xl py-2 px-3 border border-slate-300">
                Live voice recognition is unavailable for {activeLangMeta?.name || 'this language'} — use large buttons or type anytime below.
              </p>
            </div>
          )}

          {/* Response card */}
          <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-6 gap-3 sm:gap-5 min-h-0 overflow-y-auto pb-3 sm:pb-4 max-w-2xl w-full mx-auto">
            {transcript && (
              <div className="w-full bg-white/90 border-2 border-peach-200 rounded-[24px] px-5 py-3 text-center shadow-sm flex-shrink-0">
                <p className="text-xs font-bold text-amber-800 uppercase tracking-widest mb-1">You asked</p>
                <p className="text-lg font-bold text-slate-800">&ldquo;{transcript}&rdquo;</p>
              </div>
            )}

            <div className="w-full text-center px-2 flex-shrink-0 max-h-[32dvh] sm:max-h-[36vh] overflow-y-auto space-y-3">
              {uiState === 'thinking' ? (
                <p className="text-xl font-bold text-slate-600 animate-pulse">Checking your care plan…</p>
              ) : (
                <>
                  <span
                    className={`inline-flex items-center gap-1.5 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full border ${
                      responseMeta.factGrounded
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300'
                        : 'bg-lavender-50 text-slate-800 border-lavender-300'
                    }`}
                  >
                    <ShieldCheck size={14} />
                    {responseMeta.factGrounded ? 'Verified from Care Plan' : 'AI Companion Suggestion'}
                  </span>
                  <p className="text-xl sm:text-2xl font-black text-slate-900 leading-snug tracking-tight">{response}</p>
                </>
              )}

              {showActionCta && responseMeta.intent?.actionLabel && (
                <button
                  type="button"
                  onClick={handleConfirmAction}
                  className="mt-2 mx-auto min-h-[56px] px-6 bg-slate-900 hover:bg-slate-800 text-white font-black text-base rounded-2xl inline-flex items-center gap-2 shadow-md"
                >
                  {responseMeta.intent.actionLabel} <ArrowRight size={18} />
                </button>
              )}
            </div>

            {/* Main Mic Button */}
            <div className="relative flex items-center justify-center flex-shrink-0 mt-1">
              <motion.button
                type="button"
                aria-label={uiState === 'listening' ? 'Stop listening' : 'Start speaking to Smriti'}
                animate={{ scale: ringSize[uiState] }}
                whileTap={{ scale: 0.92 }}
                onClick={uiState === 'listening' ? stopListening : startListening}
                className={`relative w-24 h-24 sm:w-32 sm:h-32 rounded-full flex flex-col items-center justify-center gap-1 shadow-xl border-4 border-white bg-gradient-to-br ${ringColor[uiState]}`}
              >
                {uiState === 'listening' ? (
                  <MicOff size={44} className="text-white drop-shadow" />
                ) : (
                  <Mic size={44} className="text-white drop-shadow" />
                )}
              </motion.button>
            </div>

            <p className="text-sm font-bold text-slate-700 tracking-wide uppercase flex-shrink-0">
              {stateLabel[uiState]}
            </p>
          </div>

          {/* Suggestions */}
          {uiState === 'idle' && !showKeyboard && (
            <div className="px-4 pb-3 flex flex-wrap justify-center gap-2 flex-shrink-0 max-w-2xl mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => callAI(s)}
                  className="min-h-[48px] text-sm bg-white border-2 border-peach-200 text-slate-800 rounded-full px-4 py-2 font-bold hover:bg-peach-50 active:scale-95 transition-all shadow-sm"
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Keyboard toggle & input */}
          <div className="flex-shrink-0 pb-5 sm:pb-7 pb-safe max-w-2xl w-full mx-auto">
            <div className="flex justify-center mb-2">
              <button
                type="button"
                onClick={() => setShowKeyboard((v) => !v)}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-700 hover:text-slate-900 min-h-[44px] px-4"
              >
                <ChevronUp size={16} className={`transition-transform ${showKeyboard ? 'rotate-180' : ''}`} />
                {showKeyboard ? 'Hide keyboard' : 'Type instead'}
              </button>
            </div>
            {showKeyboard && (
              <div className="px-4">
                <div className="flex items-center gap-2 bg-white border-2 border-peach-300 rounded-2xl px-4 py-2.5 shadow-sm">
                  <input
                    autoFocus
                    value={typed}
                    onChange={(e) => setTyped(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleTextSubmit();
                    }}
                    placeholder="Ask Smriti…"
                    aria-label="Message to Smriti"
                    className="flex-1 bg-transparent text-base text-slate-900 placeholder:text-slate-500 outline-none font-medium"
                  />
                  <button
                    type="button"
                    aria-label="Send message"
                    onClick={handleTextSubmit}
                    className="min-w-[44px] min-h-[44px] text-amber-800 hover:text-amber-950 flex items-center justify-center"
                  >
                    <Send size={20} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
