'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { FadeIn } from '@/components/ui';
import Link from 'next/link';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState('CAREGIVER');
  const [clinicianInviteCode, setClinicianInviteCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName,
          role,
          ...(role === 'CLINICIAN' ? { clinicianInviteCode } : {}),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      router.push('/login');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] flex flex-col justify-center items-center p-4 sm:p-6 pb-28 sm:pb-12">
      <FadeIn>
        <div className="w-full max-w-md bg-white rounded-[28px] sm:rounded-[32px] p-5 sm:p-8 shadow-plush border-2 border-lavender-100">
          <div className="text-center mb-5 sm:mb-6">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-2">Create Account</h1>
            <p className="text-slate-600 font-medium text-sm">Caregiver & Clinician Onboarding</p>
          </div>

          <div className="mb-5 bg-sky-50 border border-sky-200 rounded-2xl p-4 text-xs font-semibold text-sky-900 leading-relaxed">
            Setting up Smriti for an elderly family member? Create your <strong>Caregiver</strong> account first — you can generate a simple <strong>PIN &amp; QR Code</strong> for your loved one inside the Caregiver portal so they never need an email or password.
          </div>

          <form onSubmit={handleRegister} className="space-y-4">
            {error && (
              <div className="bg-rose-50 text-rose-700 p-4 rounded-2xl text-sm font-bold text-center border border-rose-200">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Full Name</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 focus:outline-none focus:border-lavender-400 focus:bg-white font-medium"
                placeholder="Rina Devi"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 focus:outline-none focus:border-lavender-400 focus:bg-white font-medium"
                placeholder="caregiver@example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">Password (min 8 chars)</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 focus:outline-none focus:border-lavender-400 focus:bg-white font-medium"
                placeholder="••••••••"
              />
            </div>

            <div>
              <label className="block text-sm font-bold text-slate-700 mb-1.5">I am a...</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 focus:outline-none focus:border-lavender-400 focus:bg-white font-bold"
              >
                <option value="CAREGIVER">Family / Professional Caregiver</option>
                <option value="CLINICIAN">Clinician (Doctor)</option>
              </select>
            </div>

            {role === 'CLINICIAN' && (
              <div>
                <label className="block text-sm font-bold text-slate-700 mb-1.5">Clinic Verification Code</label>
                <input
                  type="password"
                  value={clinicianInviteCode}
                  onChange={(e) => setClinicianInviteCode(e.target.value)}
                  required
                  className="w-full bg-slate-50 border-2 border-slate-200 rounded-2xl px-5 py-3.5 text-slate-900 focus:outline-none focus:border-lavender-400 focus:bg-white font-medium"
                  placeholder="Enter authorized clinic code"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full min-h-[56px] bg-lavender-500 text-white font-black py-4 rounded-2xl hover:bg-lavender-600 transition-colors shadow-sm disabled:opacity-50 mt-2"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-slate-600 text-sm font-medium">
              Already have an account?{' '}
              <Link href="/login" className="text-lavender-600 font-bold hover:underline">
                Sign in here
              </Link>
            </p>
          </div>
        </div>
      </FadeIn>
    </div>
  );
}
