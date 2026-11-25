'use client';
import { ReactNode, useEffect } from 'react';
import { MotionConfig } from 'framer-motion';
import { VoiceAssistantProvider } from '@/contexts/VoiceAssistantProvider';
import { I18nProvider } from '@/contexts/I18nProvider';
import SpeakButton from '@/components/layout/SpeakButton';
import { useSync } from '@/hooks/useSync';
import { useActivePatient } from '@/hooks/useActivePatient';
import { usePatientPreferences } from '@/hooks/usePatientPreferences';
import { touchOfflineActivity, clearOfflineEncryptionKey } from '@/lib/offline-crypto';
import AuthProvider from '@/components/auth/AuthProvider';

function SyncAndAccessibilityShell({ children }: { children: ReactNode }) {
  const { patientId, role, status } = useActivePatient();
  useSync(patientId || undefined);
  const { preferences } = usePatientPreferences(role === 'PATIENT' ? patientId : null);

  useEffect(() => {
    if (status === 'unauthenticated') {
      clearOfflineEncryptionKey();
    }
  }, [status]);

  useEffect(() => {
    const onActivity = () => touchOfflineActivity();
    window.addEventListener('pointerdown', onActivity, { passive: true });
    window.addEventListener('keydown', onActivity, { passive: true });
    return () => {
      window.removeEventListener('pointerdown', onActivity);
      window.removeEventListener('keydown', onActivity);
    };
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    root.style.setProperty('--smriti-text-scale', String(role === 'PATIENT' ? preferences.textScale : 1));
    root.setAttribute('data-high-contrast', String(role === 'PATIENT' && preferences.highContrast));
    root.setAttribute('data-reduced-motion', String(role === 'PATIENT' && preferences.reducedMotion));
  }, [role, preferences]);

  return (
    <MotionConfig reducedMotion={role === 'PATIENT' && preferences.reducedMotion ? 'always' : 'user'}>
      {children}
      <SpeakButton />
    </MotionConfig>
  );
}

export default function ClientProviders({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <I18nProvider>
        <VoiceAssistantProvider>
          <SyncAndAccessibilityShell>{children}</SyncAndAccessibilityShell>
        </VoiceAssistantProvider>
      </I18nProvider>
    </AuthProvider>
  );
}
