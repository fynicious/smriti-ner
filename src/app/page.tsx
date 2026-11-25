'use client';
import { useState, useEffect, useCallback } from 'react';
import { FadeIn, ListenButton } from '@/components/ui';
import { db } from '@/lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { NowCard } from '@/components/patient/NowCard';
import { PlannerTimeline } from '@/components/patient/PlannerTimeline';
import { TimeWeatherWidget } from '@/components/patient/TimeWeatherWidget';
import { RoutineNotification } from '@/components/patient/RoutineNotification';
import { FamilyCallModal, type ApprovedFamilyContact } from '@/components/patient/FamilyCallModal';
import { useDailyPlanner } from '@/hooks/useDailyPlanner';
import { useGeolocationEngine } from '@/hooks/useGeolocationEngine';
import { useActivePatient } from '@/hooks/useActivePatient';
import { usePatientPreferences } from '@/hooks/usePatientPreferences';
import { useSync } from '@/hooks/useSync';
import { clearOfflineEncryptionKey } from '@/lib/offline-crypto';
import { getLocalDateString, getTimeOfDayBucket } from '@/lib/dateUtils';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import {
  PhoneCall,
  Settings2,
  User,
  LogOut,
  Droplets,
  RotateCcw,
  Puzzle,
  BookOpen,
  Lock,
  HeartHandshake,
  ChevronRight,
} from 'lucide-react';
import Link from 'next/link';
import { ConversationalUI } from '@/components/voice/ConversationalUI';
import { useI18n } from '@/contexts/I18nProvider';

export default function HomePage() {
  const [isClient, setIsClient] = useState(false);
  const [showVoiceCompanion, setShowVoiceCompanion] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showLockPrompt, setShowLockPrompt] = useState(false);
  const [lockPinInput, setLockPinInput] = useState('');
  const [lockError, setLockError] = useState('');

  const [showHelpModal, setShowHelpModal] = useState(false);
  const [dismissedVoiceId, setDismissedVoiceId] = useState<string | null>(null);

  const [hydrationMl, setHydrationMl] = useState(0);
  const [hydrationTargetMl, setHydrationTargetMl] = useState(2000);
  const [lastHydrationEventId, setLastHydrationEventId] = useState<string | null>(null);
  const [isUpdatingWater, setIsUpdatingWater] = useState(false);
  const [serverCheckedInToday, setServerCheckedInToday] = useState(false);
  const [familyContacts, setFamilyContacts] = useState<ApprovedFamilyContact[]>([]);

  const { patientId, user, status, role } = useActivePatient();
  const { preferences } = usePatientPreferences(role === 'PATIENT' ? patientId : null);
  useSync(patientId || undefined);

  const router = useRouter();
  const { t, setLang } = useI18n();

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (preferences.preferredLanguage && role === 'PATIENT') {
      setLang(preferences.preferredLanguage);
    }
  }, [preferences.preferredLanguage, role, setLang]);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
    } else if (status === 'authenticated') {
      if (role === 'CAREGIVER') {
        router.push('/caregiver');
      } else if (role === 'CLINICIAN') {
        router.push('/doctor');
      }
    }
  }, [status, role, router]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMenuOpen(false);
        setShowHelpModal(false);
        setShowLockPrompt(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const { nowItem, nextItem, todayItems, completeItem, snoozeItem } = useDailyPlanner(patientId);
  const { trackingState, hasConsent, requestConsent } = useGeolocationEngine(
    preferences.complexityMode === 'FULL' ? patientId : null
  );

  const todayStr = getLocalDateString();
  const localCheckedInToday = useLiveQuery(async () => {
    if (!patientId) return false;
    const count = await db.wellbeingEntries
      .where('patientId')
      .equals(patientId)
      .filter((entry) => entry.date === todayStr)
      .count();
    return count > 0;
  }, [patientId, todayStr]);

  const hasCheckedInToday = serverCheckedInToday || Boolean(localCheckedInToday);

  const loadPatientContext = useCallback(async () => {
    if (status !== 'authenticated' || !patientId) return;
    try {
      const [hydRes, wbRes, famRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/hydration`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/wellbeing`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/family-assets?context=MEMORIES`, { cache: 'no-store' }),
      ]);

      if (hydRes.ok) {
        const hData = await hydRes.json();
        setHydrationMl(Number(hData.totalMl) || 0);
        setHydrationTargetMl(Number(hData.targetMl) || preferences.hydrationTargetMl || 2000);
        const activeEvents = Array.isArray(hData.events) ? hData.events : [];
        setLastHydrationEventId(activeEvents[0]?.id || null);
      }

      if (wbRes.ok) {
        const wData = await wbRes.json();
        const entries = Array.isArray(wData.entries) ? wData.entries : [];
        setServerCheckedInToday(entries.some((e: { date?: string }) => e.date === todayStr));
      }

      if (famRes.ok) {
        const fData = await famRes.json();
        setFamilyContacts(Array.isArray(fData.assets) ? fData.assets : []);
      }
    } catch {
      // Offline Dexie state stays active
    }
  }, [status, patientId, todayStr, preferences.hydrationTargetMl]);

  useEffect(() => {
    loadPatientContext();
  }, [loadPatientContext]);

  const handleAddWater = async (amountMl = 250) => {
    if (!patientId || isUpdatingWater) return;
    setIsUpdatingWater(true);
    const nowIso = new Date().toISOString();

    try {
      const res = await fetch(`/api/patients/${patientId}/hydration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amountMl, timestamp: nowIso }),
      });

      if (res.ok) {
        await db.hydrationEvents.add({
          patientId,
          amountMl,
          timestamp: nowIso,
          status: 'active',
          synced: true,
        });
        await loadPatientContext();
      } else {
        throw new Error('Deferred offline');
      }
    } catch {
      await db.hydrationEvents.add({
        patientId,
        amountMl,
        timestamp: nowIso,
        status: 'active',
        synced: false,
      });
      setHydrationMl((prev) => prev + amountMl);
    } finally {
      setIsUpdatingWater(false);
    }
  };

  const handleUndoWater = async () => {
    if (!patientId || !lastHydrationEventId || isUpdatingWater) return;
    setIsUpdatingWater(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/hydration`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UNDO', eventId: lastHydrationEventId }),
      });
      if (res.ok) {
        await loadPatientContext();
      }
    } finally {
      setIsUpdatingWater(false);
    }
  };

  const handleOpenSettingsMenu = () => {
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    if (preferences.caregiverLockEnabled && preferences.hasCaregiverLockPin) {
      setLockError('');
      setLockPinInput('');
      setShowLockPrompt(true);
      return;
    }
    setMenuOpen(true);
  };

  const handleVerifyCaregiverPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId) return;
    setLockError('');
    const res = await fetch(`/api/patients/${patientId}/preferences`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verifyCaregiverLockPin: lockPinInput }),
    });
    if (res.ok) {
      setShowLockPrompt(false);
      setMenuOpen(true);
    } else {
      setLockError('Incorrect Caregiver PIN');
    }
  };

  const handleSignOut = () => {
    clearOfflineEncryptionKey();
    signOut({ callbackUrl: '/login' });
  };

  if (status === 'loading' || status === 'unauthenticated' || (role && role !== 'PATIENT')) {
    return (
      <div className="min-h-screen bg-[#FDFBF7] pb-20 flex flex-col items-center justify-center font-bold text-slate-600 gap-4">
        <span className="animate-pulse">{t.loadingProfile || 'Loading profile...'}</span>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="mt-2 px-8 min-h-[56px] bg-white rounded-full shadow-md text-slate-800 border-2 border-slate-200"
        >
          {t.tapToRefresh || 'Tap to Refresh'}
        </button>
      </div>
    );
  }

  if (!isClient) return <div className="min-h-screen bg-[#FDFBF7] pb-20" />;

  const bucket = getTimeOfDayBucket();
  const greetingText =
    bucket === 'morning'
      ? (t.goodMorning?.replace('☀️', '').trim() || 'Good Morning')
      : bucket === 'afternoon'
      ? (t.goodAfternoon?.replace('🌤️', '').trim() || 'Good Afternoon')
      : (t.goodEvening?.replace('🌙', '').trim() || 'Good Evening');

  const firstName = user?.name?.split(' ')[0] || 'Friend';
  const targetMl = hydrationTargetMl || preferences.hydrationTargetMl || 2000;
  const hydrationPct = Math.min(100, Math.round((hydrationMl / Math.max(250, targetMl)) * 100));
  const glassesCount = Math.round(hydrationMl / 250);
  const mode = preferences.complexityMode || 'GUIDED';

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-36 sm:pb-32 relative font-sans">
      {/* Top Bar Controls (>=56px touch targets) */}
      <div className="absolute top-5 left-5 z-50">
        <button
          type="button"
          onClick={handleOpenSettingsMenu}
          aria-expanded={menuOpen}
          aria-label="Open settings and profile menu"
          className="w-14 h-14 text-slate-700 hover:text-slate-900 bg-white rounded-full shadow-sm border-2 border-slate-200 flex items-center justify-center"
        >
          {preferences.caregiverLockEnabled ? <Lock size={24} /> : <Settings2 size={26} strokeWidth={2.3} />}
        </button>

        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-2xl shadow-xl border-2 border-slate-200 z-50 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
                <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">Mode: {mode}</p>
                <p className="text-sm font-black text-slate-900 truncate mt-0.5">{user?.name || 'Patient'}</p>
              </div>

              <Link
                href="/profile"
                onClick={() => setMenuOpen(false)}
                className="px-4 min-h-[56px] text-base font-bold text-slate-800 hover:bg-slate-50 flex items-center gap-3 border-b border-slate-100"
              >
                <User size={20} className="text-slate-600" /> My Profile
              </Link>

              <button
                type="button"
                onClick={handleSignOut}
                className="px-4 min-h-[56px] text-base font-bold text-rose-700 hover:bg-rose-50 flex items-center gap-3 text-left"
              >
                <LogOut size={20} className="text-rose-600" /> Sign Out
              </button>
            </div>
          </>
        )}
      </div>

      {/* Top Right Urgent Help Button */}
      <button
        type="button"
        onClick={() => setShowHelpModal(true)}
        className="absolute top-4 right-4 sm:top-5 sm:right-5 z-50 w-14 h-14 sm:w-16 sm:h-16 bg-rose-600 hover:bg-rose-700 active:scale-95 rounded-full flex items-center justify-center text-white shadow-lg border-4 border-white transition-transform"
        aria-label={t.emergencyCall || 'Family and Emergency Help'}
      >
        <PhoneCall size={28} fill="currentColor" />
      </button>

      {/* Friendly Greeting & Voice Companion Header */}
      <div className="pt-20 sm:pt-24 pb-5 sm:pb-6 px-4 sm:px-5 text-center bg-gradient-to-b from-peach-50 to-[#FDFBF7]">
        <FadeIn className="max-w-xl mx-auto">
          <p className="text-lg font-bold text-slate-700 uppercase tracking-wider">{greetingText}</p>
          <h1 className="text-4xl sm:text-5xl font-black text-slate-900 tracking-tight mt-1">{firstName}</h1>

          {preferences.voiceEnabled && (
            <div className="mt-3 flex justify-center">
              <ListenButton
                textToSpeak={`${greetingText} ${firstName}. ${t.subtitleGreeting || 'Have a calm day.'}`}
                className="min-h-[56px] px-6 text-lg bg-white border-2 border-slate-200 shadow-sm"
              />
            </div>
          )}

          {preferences.aiEnabled && (
            <button
              type="button"
              onClick={() => setShowVoiceCompanion(true)}
              className="mt-5 w-full min-h-[68px] flex items-center gap-4 bg-white border-2 border-peach-300 rounded-[24px] px-5 py-3 shadow-sm hover:shadow-md active:scale-[0.99] transition-all text-left"
            >
              <div className="w-12 h-12 rounded-full bg-peach-100 border border-peach-300 flex items-center justify-center text-2xl shrink-0">
                🌸
              </div>
              <div className="flex-1">
                <p className="text-xs font-black text-amber-900 uppercase tracking-widest">Smriti Voice Companion</p>
                <p className="text-base font-bold text-slate-800">Tap &amp; ask: &ldquo;What do I do next?&rdquo;</p>
              </div>
              <span className="w-12 h-12 rounded-full bg-peach-500 text-white flex items-center justify-center text-xl shrink-0">
                🎙️
              </span>
            </button>
          )}
        </FadeIn>
      </div>

      {/* Main Content Scaled Cleanly by Caregiver-Selected Complexity Mode */}
      <div className="px-5 space-y-6 max-w-xl mx-auto pb-8">
        {/* 1. Prominent RIGHT NOW Card (Shared across SIMPLE, GUIDED, FULL) */}
        <FadeIn delay={0.04}>
          {nowItem ? (
            <NowCard item={nowItem} onComplete={completeItem} onSnooze={snoozeItem} compact={mode === 'SIMPLE'} />
          ) : (
            <div className="bg-mint-50 border-3 border-mint-300 rounded-[32px] p-7 text-center flex flex-col items-center justify-center">
              <span className="text-5xl mb-2">🌟</span>
              <h2 className="text-2xl font-black text-slate-900">{t.youAreAllCaughtUp || "You're all caught up!"}</h2>
              <p className="text-base font-bold text-slate-700 mt-1">{t.enjoyYourDay || 'Enjoy your calm day.'}</p>
            </div>
          )}
        </FadeIn>

        {/* 2. Four Primary Visual Actions (SIMPLE 2x2 Squircles, or Expanded Cards in GUIDED/FULL) */}
        <FadeIn delay={0.08}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4">
            {/* Tile 1: Drink Water (+1 Glass on tap) */}
            <div className="bg-sky-50 border-3 border-sky-200 rounded-[28px] p-4 flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <span className="w-12 h-12 rounded-2xl bg-sky-600 text-white flex items-center justify-center">
                  <Droplets size={26} />
                </span>
                <span className="text-lg font-black text-sky-900">{hydrationPct}%</span>
              </div>
              <div className="mb-3">
                <p className="text-lg font-black text-slate-900 leading-tight">{t.drinkWater || 'Drink Water'}</p>
                <p className="text-sm font-bold text-slate-700 mt-0.5">
                  {glassesCount} {glassesCount === 1 ? 'glass' : 'glasses'} ({hydrationMl} ml)
                </p>
                <div className="w-full h-2.5 bg-sky-200 rounded-full overflow-hidden mt-2">
                  <div className="h-full bg-sky-600 rounded-full transition-all" style={{ width: `${hydrationPct}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={isUpdatingWater}
                  onClick={() => handleAddWater(250)}
                  className="flex-1 min-h-[56px] bg-sky-600 hover:bg-sky-700 active:scale-95 text-white font-black text-sm sm:text-base rounded-2xl px-2 disabled:opacity-50"
                >
                  +1 Glass
                </button>
                {lastHydrationEventId && (
                  <button
                    type="button"
                    disabled={isUpdatingWater}
                    onClick={handleUndoWater}
                    aria-label="Undo last water glass"
                    className="w-12 sm:w-14 min-h-[56px] bg-white border-2 border-slate-300 text-slate-800 rounded-2xl flex items-center justify-center shrink-0"
                  >
                    <RotateCcw size={20} />
                  </button>
                )}
              </div>
            </div>

            {/* Tile 2: Play */}
            <Link
              href={mode === 'SIMPLE' ? '/games/memory-match' : '/games'}
              className="bg-indigo-50 border-3 border-indigo-200 rounded-[28px] p-3.5 sm:p-4 flex flex-col justify-between shadow-sm hover:shadow-md active:scale-[0.98] transition-all min-h-[156px] sm:min-h-[175px]"
            >
              <span className="w-12 h-12 rounded-2xl bg-indigo-600 text-white flex items-center justify-center">
                <Puzzle size={26} />
              </span>
              <div>
                <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">
                  {mode === 'SIMPLE' ? 'Play Game' : 'Play'}
                </p>
                <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1">
                  {mode === 'SIMPLE' ? 'Gentle matching' : '14 calming games'}
                </p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-black text-indigo-800">
                Start <ChevronRight size={16} />
              </span>
            </Link>

            {/* Tile 3: Family Memories */}
            <Link
              href="/scrapbook"
              className="bg-amber-50 border-3 border-amber-200 rounded-[28px] p-3.5 sm:p-4 flex flex-col justify-between shadow-sm hover:shadow-md active:scale-[0.98] transition-all min-h-[156px] sm:min-h-[165px]"
            >
              <span className="w-12 h-12 rounded-2xl bg-amber-600 text-white flex items-center justify-center">
                <BookOpen size={26} />
              </span>
              <div>
                <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">Family</p>
                <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1">Photos &amp; voices</p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-black text-amber-900">
                Open <ChevronRight size={16} />
              </span>
            </Link>

            {/* Tile 4: Call Family / Get Help */}
            <button
              type="button"
              onClick={() => setShowHelpModal(true)}
              className="bg-rose-50 border-3 border-rose-200 rounded-[28px] p-3.5 sm:p-4 flex flex-col justify-between shadow-sm hover:shadow-md active:scale-[0.98] transition-all text-left min-h-[156px] sm:min-h-[165px]"
            >
              <span className="w-12 h-12 rounded-2xl bg-rose-600 text-white flex items-center justify-center">
                <PhoneCall size={24} />
              </span>
              <div>
                <p className="text-lg sm:text-xl font-black text-slate-900 leading-tight">Get Help</p>
                <p className="text-xs sm:text-sm font-bold text-slate-700 mt-1">Call family or 112</p>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-black text-rose-800">
                Call <ChevronRight size={16} />
              </span>
            </button>
          </div>
        </FadeIn>

        {/* GUIDED & FULL MODES: Daily Schedule Timeline & Optional Check-in */}
        {mode !== 'SIMPLE' && (
          <>
            {!hasCheckedInToday && (
              <FadeIn delay={0.1}>
                <div className="bg-white border-2 border-amber-300 rounded-[28px] p-4 sm:p-5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 shadow-sm">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-amber-800">Optional Check-In</p>
                    <h2 className="text-xl font-black text-slate-900 mt-0.5">
                      {t.howAreYouToday || 'How are you feeling today?'}
                    </h2>
                  </div>
                  <Link
                    href="/check-in"
                    className="min-h-[56px] px-5 bg-amber-500 hover:bg-amber-600 text-white font-black rounded-2xl flex items-center justify-center whitespace-nowrap"
                  >
                    Start
                  </Link>
                </div>
              </FadeIn>
            )}

            <FadeIn delay={0.12}>
              <PlannerTimeline items={todayItems} nowItem={nowItem} nextItem={nextItem} onComplete={completeItem} />
            </FadeIn>

            <FadeIn delay={0.15}>
              <Link
                href="/help-near-me"
                className="min-h-[72px] bg-white border-2 border-sky-200 p-5 rounded-[28px] shadow-sm flex items-center justify-between gap-4 hover:bg-sky-50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="w-12 h-12 rounded-2xl bg-sky-100 text-sky-700 flex items-center justify-center">
                    <HeartHandshake size={26} />
                  </span>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{t.helpNearMe || 'Help Near Me'}</h3>
                    <p className="text-sm font-semibold text-slate-600">Verified hospitals, pharmacies &amp; support</p>
                  </div>
                </div>
                <ChevronRight className="text-slate-500" />
              </Link>
            </FadeIn>
          </>
        )}

        {/* FULL MODE ONLY: Time, Weather & Optional Opt-In Safety Location Banner */}
        {mode === 'FULL' && (
          <FadeIn delay={0.18}>
            <div className="space-y-4">
              <TimeWeatherWidget />
              {!hasConsent && trackingState === 'IDLE' && (
                <div className="bg-sky-50 border-2 border-sky-200 rounded-[24px] p-5 text-center">
                  <h3 className="text-lg font-black text-sky-900">{t.locationSharing || 'Optional Location Sharing'}</h3>
                  <p className="text-sm font-medium text-sky-800 mt-1 mb-3">
                    {t.locationSharingDesc || 'Your caregiver can see your safe-zone status when enabled.'}
                  </p>
                  <button
                    type="button"
                    onClick={requestConsent}
                    className="min-h-[56px] px-6 bg-sky-600 text-white font-black rounded-2xl w-full"
                  >
                    {t.allowTracking || 'Allow Location Sharing'}
                  </button>
                </div>
              )}
            </div>
          </FadeIn>
        )}
      </div>

      {/* Automatic Voice Reminder Popup */}
      {nowItem?.voiceReminder && dismissedVoiceId !== nowItem.id && (
        <RoutineNotification
          reminder={nowItem.voiceReminder}
          onComplete={async () => {
            setDismissedVoiceId(nowItem.id);
            await completeItem(nowItem);
          }}
          onSnooze={async () => {
            setDismissedVoiceId(nowItem.id);
            await snoozeItem(nowItem);
          }}
        />
      )}

      {/* Caregiver Lock Verification Dialog */}
      {showLockPrompt && (
        <div className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
              <Lock size={20} /> Caregiver Lock
            </h2>
            <p className="text-sm font-medium text-slate-600">Enter the 4–6 digit caregiver lock PIN to open settings.</p>
            {lockError && <p className="text-sm font-bold text-rose-600">{lockError}</p>}
            <form onSubmit={handleVerifyCaregiverPin} className="space-y-3">
              <input
                type="password"
                inputMode="numeric"
                value={lockPinInput}
                onChange={(e) => setLockPinInput(e.target.value)}
                required
                className="w-full px-4 py-3 rounded-xl border-2 border-slate-300 text-center text-2xl font-black tracking-widest"
                placeholder="••••"
              />
              <div className="flex gap-2">
                <button type="submit" className="flex-1 min-h-[52px] bg-slate-900 text-white font-black rounded-xl">
                  Unlock
                </button>
                <button
                  type="button"
                  onClick={() => setShowLockPrompt(false)}
                  className="px-5 min-h-[52px] bg-slate-100 text-slate-700 font-bold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <FamilyCallModal
        isOpen={showHelpModal}
        onClose={() => setShowHelpModal(false)}
        patientId={patientId}
        contacts={familyContacts}
      />

      <ConversationalUI
        isOpen={showVoiceCompanion}
        onClose={() => setShowVoiceCompanion(false)}
        nextItemTitle={nowItem?.title || null}
        nextItemTime={nowItem?.time || null}
        onOpenFamilyCall={() => {
          setShowVoiceCompanion(false);
          setShowHelpModal(true);
        }}
        onQuickLogWater={() => handleAddWater(250)}
      />
    </div>
  );
}
