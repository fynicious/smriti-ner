'use client';

import { useState, useEffect } from 'react';
import { Volume2, Cloud } from 'lucide-react';
import { useI18n } from '@/contexts/I18nProvider';
import { formatLocalizedDate, formatLocalizedTime } from '@/lib/locale-format';

interface WeatherData {
  temperature: number;
  condition: string;
}

function weatherCodeLabel(code: number): string {
  if (code === 0) return 'Clear Sky';
  if (code <= 3) return 'Partly Cloudy';
  if (code <= 48) return 'Misty';
  if (code <= 67) return 'Rainy';
  if (code <= 99) return 'Stormy';
  return 'Mild';
}

export function TimeWeatherWidget() {
  const { lang } = useI18n();
  const [time, setTime] = useState<Date | null>(null);
  const [weather, setWeather] = useState<WeatherData | null>(null);

  useEffect(() => {
    setTime(new Date());
    const timer = setInterval(() => setTime(new Date()), 60000);

    if (typeof navigator !== 'undefined' && navigator.onLine) {
      fetch('https://api.open-meteo.com/v1/forecast?latitude=26.1445&longitude=91.7362&current=temperature_2m,weather_code')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          const tVal = data?.current?.temperature_2m;
          const code = data?.current?.weather_code;
          if (typeof tVal === 'number') {
            setWeather({
              temperature: Math.round(tVal),
              condition: typeof code === 'number' ? weatherCodeLabel(code) : 'Mild',
            });
          }
        })
        .catch(() => {});
    }

    return () => clearInterval(timer);
  }, []);

  const handleListen = () => {
    if (!time || typeof window === 'undefined' || !('speechSynthesis' in window)) return;

    const timeString = time.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    const dateString = time.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
    const weatherPart = weather ? ` The temperature is ${weather.temperature} degrees Celsius, ${weather.condition}.` : '';
    const text = `Today is ${dateString}. The time is ${timeString}.${weatherPart}`;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  };

  if (!time) return null;

  return (
    <div className="bg-white px-4 sm:px-6 py-4 sm:py-5 rounded-[24px] sm:rounded-[32px] shadow-sm border border-slate-200 flex flex-wrap items-center justify-between gap-3 mt-4 sm:mt-6 w-full max-w-2xl mx-auto relative z-10">
      <div className="flex flex-col">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none mb-1">
          {formatLocalizedTime(time, lang)}
        </h2>
        <p className="text-sm font-bold text-slate-600">
          {formatLocalizedDate(time, lang)}
        </p>
      </div>

      <div className="flex items-center gap-3">
        {weather && (
          <div className="flex items-center gap-2 text-sky-800 bg-sky-50 border border-sky-200 px-3 py-1.5 rounded-2xl">
            <Cloud size={22} />
            <span className="font-black text-lg">{weather.temperature}°C</span>
          </div>
        )}
        <button
          type="button"
          onClick={handleListen}
          aria-label="Read date and time aloud"
          className="w-12 h-12 bg-indigo-100 text-indigo-800 hover:bg-indigo-200 active:scale-95 rounded-full flex items-center justify-center transition-all"
        >
          <Volume2 size={24} />
        </button>
      </div>
    </div>
  );
}
