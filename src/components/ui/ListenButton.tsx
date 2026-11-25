'use client';

import { Volume2 } from 'lucide-react';
import { useState } from 'react';

interface ListenButtonProps {
  textToSpeak: string;
  lang?: string;
  className?: string;
}

export function ListenButton({ textToSpeak, lang = 'en-IN', className = '' }: ListenButtonProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  const handleListen = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (typeof window === 'undefined' || !window.speechSynthesis) {
      setUnsupported(true);
      setTimeout(() => setUnsupported(false), 3000);
      return;
    }

    if (isPlaying) {
      window.speechSynthesis.cancel();
      setIsPlaying(false);
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = lang;
    utterance.rate = 0.85;

    utterance.onstart = () => setIsPlaying(true);
    utterance.onend = () => setIsPlaying(false);
    utterance.onerror = () => setIsPlaying(false);

    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleListen}
        aria-label={`Listen: ${textToSpeak}`}
        className={`flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 active:scale-95 text-slate-800 rounded-full font-bold text-sm transition-all ${
          isPlaying ? 'bg-sky-100 text-sky-800 ring-2 ring-sky-400' : ''
        } ${className}`}
      >
        <Volume2 size={18} className={isPlaying ? 'animate-pulse' : ''} />
        <span>{isPlaying ? 'Listening...' : 'Listen'}</span>
      </button>
      {unsupported && (
        <span className="text-xs font-semibold text-rose-600">Voice readout is unavailable on this browser.</span>
      )}
    </div>
  );
}
