'use client';
import { useI18n } from '@/contexts/I18nProvider';

export default function OfflinePage() {
  const { t } = useI18n();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-6 text-center">
      <div className="text-6xl mb-6">🌿</div>
      <h1 className="text-3xl font-bold text-slate-800 mb-3">{t.youAreOffline}</h1>
      <p className="text-lg text-slate-500 max-w-sm">
        {t.offlineMessage}
      </p>
    </div>
  );
}
