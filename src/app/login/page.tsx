'use client';

import { useState, useEffect, Suspense } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FadeIn } from '@/components/ui';
import Link from 'next/link';
import { KeyRound, QrCode, UserCheck, Delete } from 'lucide-react';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qrFromUrl = searchParams.get('qr') || '';

  const [tab, setTab] = useState<'PATIENT_PIN' | 'PASSWORD'>(qrFromUrl ? 'PATIENT_PIN' : 'PATIENT_PIN');
  const [loginCode, setLoginCode] = useState('');
  const [pin, setPin] = useState('');
  const [qrToken, setQrToken] = useState(qrFromUrl);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (qrFromUrl) {
      setQrToken(qrFromUrl);
      setTab('PATIENT_PIN');
    }
  }, [qrFromUrl]);

  const appendDigit = (digit: string) => {
    setError('');
    setPin((prev) => (prev.length < 6 ? prev + digit : prev));
  };

  const handlePinOrQrLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = qrToken
        ? await signIn('credentials', {
            redirect: false,
            mode: 'QR_TOKEN',
            qrToken,
            pin,
          })
        : await signIn('credentials', {
            redirect: false,
            mode: 'PATIENT_PIN',
            loginCode: loginCode.trim().toUpperCase(),
            pin,
          });

      if (res?.error) {
        setError(res.error === 'CredentialsSignin' ? 'Invalid code or PIN' : res.error);
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await signIn('credentials', {
        redirect: false,
        mode: 'PASSWORD',
        email,
        password,
      });

      if (res?.error) {
        setError('Invalid email or password');
      } else {
        router.push('/');
        router.refresh();
      }
    } catch {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-4 sm:p-6 pb-28 sm:pb-12">
      <FadeIn>
        <div className="w-full max-w-md bg-white rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 shadow-plush border-2 border-peach-100">
          <div className="text-center mb-5 sm:mb-6">
            <span className="inline-block px-4 py-1 rounded-full bg-peach-100 text-amber-900 font-bold text-xs uppercase tracking-widest mb-2">
              Smriti Care Companion
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">Welcome Back</h1>
          </div>

          <div className="grid grid-cols-2 gap-1.5 sm:gap-2 p-1.5 bg-slate-100 rounded-2xl mb-5 sm:mb-6" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'PATIENT_PIN'}
              onClick={() => {
                setTab('PATIENT_PIN');
                setError('');
              }}
              className={`min-h-[48px] px-2 rounded-xl font-bold text-xs sm:text-sm leading-tight text-center flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                tab === 'PATIENT_PIN' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <KeyRound size={16} className="shrink-0" /> <span>Elder PIN / QR</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'PASSWORD'}
              onClick={() => {
                setTab('PASSWORD');
                setError('');
              }}
              className={`min-h-[48px] px-2 rounded-xl font-bold text-xs sm:text-sm leading-tight text-center flex items-center justify-center gap-1.5 sm:gap-2 transition-all ${
                tab === 'PASSWORD' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
              }`}
            >
              <UserCheck size={16} className="shrink-0" /> <span>Caregiver / Doctor</span>
            </button>
          </div>

          {error && (
            <div className="mb-4 bg-rose-50 text-rose-700 p-4 rounded-2xl text-sm font-bold text-center border border-rose-200">
              {error}
            </div>
          )}

          {tab === 'PATIENT_PIN' ? (
            <form onSubmit={handlePinOrQrLogin} className="space-y-4">
              {qrToken ? (
                <div className="bg-mint-50 border-2 border-mint-200 rounded-2xl p-4 text-center">
                  <QrCode className="mx-auto mb-2 text-mint-700" size={28} />
                  <p className="font-bold text-mint-900 text-sm">Caregiver QR Pairing Link Active</p>
                  <p className="text-xs text-mint-800 mt-1">Tap Continue below to connect this device cleanly.</p>
                </div>
              ) : (
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-1.5">
                    Caregiver-Provided Code (e.g. SMR-123456)
                  </label>
                  <input
                    type="text"
                    value={loginCode}
                    onChange={(e) => setLoginCode(e.target.value.toUpperCase())}
                    required
                    className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-lg font-extrabold tracking-widest text-slate-900 uppercase focus:outline-none focus:border-peach-400 focus:bg-white"
                    placeholder="SMR-000000"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">
                  {qrToken ? 'Optional Security PIN (if set)' : '4 to 6 Digit PIN'}
                </label>
                <div className="bg-slate-50 border-2 border-slate-200 rounded-2xl px-4 py-3 text-center text-2xl font-black tracking-[0.4em] text-slate-900 min-h-[56px] flex items-center justify-center">
                  {pin ? '•'.repeat(pin.length) : <span className="text-sm font-medium tracking-normal text-slate-400">Tap numbers below</span>}
                </div>

                <div className="grid grid-cols-3 gap-2.5 mt-3">
                  {['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Clear', '0', 'Back'].map((key) => {
                    if (key === 'Clear') {
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setPin('')}
                          className="min-h-[56px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-sm"
                        >
                          Clear
                        </button>
                      );
                    }
                    if (key === 'Back') {
                      return (
                        <button
                          key={key}
                          type="button"
                          aria-label="Delete last PIN digit"
                          onClick={() => setPin((p) => p.slice(0, -1))}
                          className="min-h-[56px] rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold flex items-center justify-center"
                        >
                          <Delete size={20} />
                        </button>
                      );
                    }
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => appendDigit(key)}
                        className="min-h-[56px] rounded-2xl bg-peach-50 hover:bg-peach-100 active:scale-95 border border-peach-200 text-slate-900 font-black text-2xl transition-transform"
                      >
                        {key}
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || (!qrToken && (!loginCode.trim() || pin.length < 4))}
                className="w-full min-h-[58px] bg-peach-500 hover:bg-peach-600 text-white font-black text-lg rounded-2xl shadow-sm disabled:opacity-50 transition-colors"
              >
                {loading ? 'Opening Smriti...' : qrToken ? 'Connect Device' : 'Open My Smriti'}
              </button>

              {qrToken && (
                <button
                  type="button"
                  onClick={() => setQrToken('')}
                  className="w-full py-2 text-xs font-bold text-slate-500 underline"
                >
                  Enter Patient Code & PIN manually instead
                </button>
              )}
            </form>
          ) : (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:border-peach-400 focus:bg-white font-medium"
                  placeholder="caregiver@example.com"
                />
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-4 text-slate-900 focus:outline-none focus:border-peach-400 focus:bg-white font-medium"
                  placeholder="••••••••"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full min-h-[56px] bg-slate-900 hover:bg-slate-800 text-white font-black rounded-2xl shadow-sm disabled:opacity-50 transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          <div className="mt-6 text-center space-y-1">
            <p className="text-slate-600 text-sm font-medium">
              Family caregiver or clinician?{' '}
              <Link href="/register" className="text-peach-600 font-bold hover:underline">
                Create Caregiver / Clinician Account
              </Link>
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#FDFBF7]" />}>
      <LoginContent />
    </Suspense>
  );
}
