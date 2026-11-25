'use client';

import { useState, useEffect, useCallback } from 'react';
import { signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Mail, ShieldCheck, LogOut, Link2, Save, CheckCircle2, Trash2, Globe } from 'lucide-react';
import Link from 'next/link';
import { useActivePatient } from '@/hooks/useActivePatient';
import { useI18n } from '@/contexts/I18nProvider';

interface PairingItem {
  id: string;
  caregiver?: { id: string; fullName: string; phoneNumber?: string | null };
  patient?: { id: string; fullName: string };
}

export default function ProfilePage() {
  const { status, role, user } = useActivePatient();
  const { lang, setLang, languages } = useI18n();
  const router = useRouter();

  const [fullName, setFullName] = useState('');
  const [loginCode, setLoginCode] = useState<string | null>(null);
  const [bloodGroup, setBloodGroup] = useState('');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [allergies, setAllergies] = useState('');
  const [diagnoses, setDiagnoses] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [hospital, setHospital] = useState('');

  const [pairings, setPairings] = useState<PairingItem[]>([]);
  const [pairingCode, setPairingCode] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isPairing, setIsPairing] = useState(false);

  const loadProfileAndPairings = useCallback(async () => {
    try {
      const [profRes, pairRes] = await Promise.all([
        fetch('/api/profile', { cache: 'no-store' }),
        fetch('/api/pairing', { cache: 'no-store' }),
      ]);

      if (profRes.ok) {
        const data = await profRes.json();
        const u = data.user;
        setLoginCode(u?.loginCode || null);
        if (u?.patientProfile) {
          setFullName(u.patientProfile.fullName || '');
          setBloodGroup(u.patientProfile.bloodGroup || '');
          setEmergencyContact(u.patientProfile.emergencyContact || '');
          setAllergies(u.patientProfile.allergies || '');
          setDiagnoses(u.patientProfile.diagnoses || '');
        } else if (u?.caregiverProfile) {
          setFullName(u.caregiverProfile.fullName || '');
          setPhoneNumber(u.caregiverProfile.phoneNumber || '');
        } else if (u?.clinicianProfile) {
          setFullName(u.clinicianProfile.fullName || '');
          setSpecialization(u.clinicianProfile.specialization || '');
          setHospital(u.clinicianProfile.hospital || '');
        }
      }

      if (pairRes.ok) {
        const pData = await pairRes.json();
        setPairings(Array.isArray(pData.pairings) ? pData.pairings : []);
      }
    } catch {
      // Non-fatal offline state
    }
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/login');
      return;
    }
    if (status === 'authenticated') {
      loadProfileAndPairings();
    }
  }, [status, router, loadProfileAndPairings]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const payload =
        role === 'PATIENT'
          ? { fullName, bloodGroup, emergencyContact, allergies, diagnoses, preferredLanguage: lang }
          : role === 'CAREGIVER'
          ? { fullName, phoneNumber }
          : { fullName, specialization, hospital };

      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Could not update profile');
      } else {
        setStatusMessage('Profile saved successfully.');
      }
    } catch {
      setErrorMessage('Network error while saving profile.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleRedeemCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsPairing(true);
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const res = await fetch('/api/pairing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: pairingCode.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Invalid pairing code');
      } else {
        setPairingCode('');
        setStatusMessage('Caregiver linked to your care profile.');
        await loadProfileAndPairings();
      }
    } catch {
      setErrorMessage('Could not connect to pairing service.');
    } finally {
      setIsPairing(false);
    }
  };

  const handleRevokePairing = async (pairingId: string) => {
    const res = await fetch(`/api/pairing?pairingId=${encodeURIComponent(pairingId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      await loadProfileAndPairings();
      setStatusMessage('Pairing removed.');
    }
  };

  if (status === 'loading') {
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">Loading profile...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans pb-28">
      {/* Header */}
      <div className="bg-white px-6 pt-14 pb-6 shadow-sm sticky top-0 z-10 flex items-center gap-4 border-b border-slate-100">
        <Link
          href={role === 'CAREGIVER' ? '/caregiver' : role === 'CLINICIAN' ? '/doctor' : '/'}
          aria-label="Back to dashboard"
          className="p-2 -ml-2 text-slate-600 hover:text-slate-900 transition-colors"
        >
          <ArrowLeft size={24} />
        </Link>
        <h1 className="text-2xl font-black text-slate-900">My Profile & Settings</h1>
      </div>

      <div className="px-6 mt-8 max-w-lg mx-auto space-y-6">
        {/* Avatar & Summary */}
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-peach-300 to-lavender-300 flex items-center justify-center shadow-lg border-4 border-white mb-3">
            <span className="text-3xl">🌸</span>
          </div>
          <h2 className="text-2xl font-black text-slate-900">{fullName || user?.name || 'User'}</h2>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest mt-1">{role || 'USER'}</p>
        </div>

        {statusMessage && (
          <div className="bg-mint-50 border border-mint-200 text-mint-800 px-4 py-3 rounded-2xl font-bold text-sm flex items-center gap-2">
            <CheckCircle2 size={18} /> {statusMessage}
          </div>
        )}
        {errorMessage && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 px-4 py-3 rounded-2xl font-bold text-sm">
            {errorMessage}
          </div>
        )}

        {/* Account Info */}
        <div className="space-y-3">
          {loginCode ? (
            <div className="bg-indigo-50 rounded-2xl p-4 shadow-sm border border-indigo-200 flex items-center gap-4">
              <div className="p-3 bg-white text-indigo-600 rounded-xl"><ShieldCheck size={20} /></div>
              <div>
                <p className="text-xs font-bold text-indigo-800 uppercase">Elder Login Code (PIN Account)</p>
                <p className="font-black text-xl tracking-widest text-indigo-950">{loginCode}</p>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
              <div className="p-3 bg-sky-50 text-sky-600 rounded-xl"><Mail size={20} /></div>
              <div>
                <p className="text-xs font-bold text-slate-600 uppercase">Email Address</p>
                <p className="font-semibold text-slate-800">{user?.email || 'Not provided'}</p>
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200 flex items-center gap-4">
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><ShieldCheck size={20} /></div>
            <div>
              <p className="text-xs font-bold text-slate-600 uppercase">Account Access</p>
              <p className="font-semibold text-slate-800">
                {role === 'PATIENT'
                  ? 'Role-Protected Session (Display, AI & Safety modes managed by Caregiver)'
                  : 'Authenticated Role-Protected Session'}
              </p>
            </div>
          </div>
        </div>

        {/* Profile Edit Form */}
        <form onSubmit={handleSaveProfile} className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="text-lg font-black text-slate-900">Personal Details</h3>

          <div>
            <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Full Name</label>
            <input
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
            />
          </div>

          {role === 'PATIENT' && (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Blood Group</label>
                  <input
                    type="text"
                    placeholder="e.g. O+"
                    value={bloodGroup}
                    onChange={(e) => setBloodGroup(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Emergency Phone</label>
                  <input
                    type="tel"
                    placeholder="+91 ..."
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Allergies</label>
                <input
                  type="text"
                  placeholder="Optional allergies"
                  value={allergies}
                  onChange={(e) => setAllergies(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Support Notes / Conditions</label>
                <input
                  type="text"
                  placeholder="Optional health notes"
                  value={diagnoses}
                  onChange={(e) => setDiagnoses(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1 flex items-center gap-1">
                  <Globe size={14} /> Preferred Language
                </label>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800 bg-white"
                >
                  {languages.map((l) => (
                    <option key={l.code} value={l.code}>
                      {l.nativeName} ({l.name})
                    </option>
                  ))}
                </select>
              </div>
            </>
          )}

          {role === 'CAREGIVER' && (
            <div>
              <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone Number</label>
              <input
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800"
              />
            </div>
          )}

          {role === 'CLINICIAN' && (
            <>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Specialization</label>
                <input
                  type="text"
                  value={specialization}
                  onChange={(e) => setSpecialization(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Hospital / Clinic</label>
                <input
                  type="text"
                  value={hospital}
                  onChange={(e) => setHospital(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold text-slate-800"
                />
              </div>
            </>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white font-black rounded-2xl flex items-center justify-center gap-2 transition-colors"
          >
            <Save size={18} /> {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </form>

        {/* Patient <-> Caregiver Pairing Section */}
        {role === 'PATIENT' && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200 space-y-4">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <Link2 size={20} className="text-indigo-600" /> Link a Caregiver
            </h3>
            <p className="text-sm text-slate-600 font-medium">
              Ask your caregiver to share their 6-digit invite code from their Care Circle dashboard.
            </p>
            <form onSubmit={handleRedeemCode} className="flex gap-2">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                placeholder="6-digit code"
                value={pairingCode}
                onChange={(e) => setPairingCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="flex-1 px-4 py-3 rounded-xl border border-slate-300 font-black tracking-widest text-center text-lg text-slate-900"
              />
              <button
                type="submit"
                disabled={isPairing || pairingCode.length !== 6}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black rounded-xl"
              >
                {isPairing ? 'Linking...' : 'Pair'}
              </button>
            </form>

            {pairings.length > 0 && (
              <div className="pt-2 space-y-2">
                <p className="text-xs font-bold text-slate-600 uppercase">Linked Caregivers</p>
                {pairings.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <div>
                      <p className="font-bold text-slate-800">{p.caregiver?.fullName || 'Caregiver'}</p>
                      {p.caregiver?.phoneNumber && (
                        <p className="text-xs text-slate-600">{p.caregiver.phoneNumber}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleRevokePairing(p.id)}
                      aria-label="Remove caregiver pairing"
                      className="p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Sign Out */}
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/login' })}
          className="w-full bg-rose-50 text-rose-600 border border-rose-200 rounded-2xl py-4 font-black flex items-center justify-center gap-2 hover:bg-rose-100 transition-colors shadow-sm"
        >
          <LogOut size={20} /> Sign Out of App
        </button>
      </div>
    </div>
  );
}
