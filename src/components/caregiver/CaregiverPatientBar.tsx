'use client';

import { useState } from 'react';
import { Users, KeyRound, CheckCircle2, Copy, UserPlus, X, QrCode } from 'lucide-react';
import { AuthorizedPatientSummary } from '@/hooks/useActivePatient';
import { NER_LANGUAGE_CATALOG } from '@/lib/i18n/metadata';

interface CaregiverPatientBarProps {
  patientId: string | null;
  patients: AuthorizedPatientSummary[];
  onSelectPatient: (id: string) => void;
  isLoading: boolean;
  onPatientCreated?: (id: string) => void;
}

interface ProvisionResult {
  patientId: string;
  fullName: string;
  loginCode: string;
  qrUrlPath: string;
  expiresAt: string;
}

export function CaregiverPatientBar({
  patientId,
  patients,
  onSelectPatient,
  isLoading,
  onPatientCreated,
}: CaregiverPatientBarProps) {
  const [inviteCode, setInviteCode] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [fullName, setFullName] = useState('');
  const [pin, setPin] = useState('');
  const [preferredLanguage, setPreferredLanguage] = useState('en');
  const [complexityMode, setComplexityMode] = useState<'SIMPLE' | 'GUIDED' | 'FULL'>('SIMPLE');
  const [scriptPreference, setScriptPreference] = useState<'bengali' | 'meetei_mayek'>('bengali');
  const [emergencyContact, setEmergencyContact] = useState('');
  const [hydrationTargetMl, setHydrationTargetMl] = useState(2000);
  const [createError, setCreateError] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const activePatient = patients.find((p) => p.id === patientId) || null;

  const handleGenerateCode = async () => {
    setIsGenerating(true);
    try {
      const res = await fetch('/api/pairing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      if (res.ok) {
        const data = await res.json();
        setInviteCode(data.code || null);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (val: string, tag: string) => {
    if (!val || typeof navigator === 'undefined') return;
    navigator.clipboard?.writeText(val);
    if (tag === 'invite') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setCopiedField(tag);
      setTimeout(() => setCopiedField(null), 2000);
    }
  };

  const handleCreatePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    if (!fullName.trim()) {
      setCreateError('Please enter your loved one’s name.');
      return;
    }
    if (!/^\d{4,6}$/.test(pin.trim())) {
      setCreateError('Please enter a 4 to 6 digit numeric PIN.');
      return;
    }

    setIsCreating(true);
    try {
      const resolvedLang =
        preferredLanguage === 'mni' && scriptPreference === 'meetei_mayek' ? 'mni-mymk' : preferredLanguage;
      const res = await fetch('/api/caregiver/patients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: fullName.trim(),
          pin: pin.trim(),
          preferredLanguage: resolvedLang,
          complexityMode,
          scriptPreference: preferredLanguage.startsWith('mni') ? scriptPreference : null,
          emergencyContact: emergencyContact.trim() || undefined,
          hydrationTargetMl: Number(hydrationTargetMl) || 2000,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create patient account.');
        return;
      }

      const newId = data.patient?.id as string;
      const loginCode = data.onboarding?.loginCode || data.patient?.loginCode || '';
      const qrUrlPath = data.onboarding?.qrUrlPath || '';
      const expiresAt = data.onboarding?.expiresAt || '';

      setProvisionResult({
        patientId: newId,
        fullName: data.patient?.fullName || fullName.trim(),
        loginCode,
        qrUrlPath,
        expiresAt,
      });

      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('smriti:patients-updated', { detail: { patientId: newId } }));
      }
      onPatientCreated?.(newId);
    } catch {
      setCreateError('Network error while creating patient.');
    } finally {
      setIsCreating(false);
    }
  };

  const openModal = () => {
    setProvisionResult(null);
    setCreateError(null);
    setFullName('');
    setPin('');
    setEmergencyContact('');
    setShowCreateModal(true);
  };

  if (isLoading) {
    return (
      <div className="bg-white/80 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-600">
        Loading paired patients...
      </div>
    );
  }

  return (
    <>
      {patients.length === 0 ? (
        <div className="bg-amber-50 border-2 border-amber-200 rounded-3xl p-5 space-y-4">
          <div className="flex items-start gap-3">
            <Users className="text-amber-700 mt-0.5 flex-shrink-0" size={22} />
            <div>
              <h3 className="font-black text-amber-950 text-base">No Patient Added Yet</h3>
              <p className="text-sm text-amber-900 font-medium mt-0.5">
                Create a PIN &amp; QR patient account for your loved one in 30 seconds — no email or password needed for them. Or generate a 6-digit pairing code to link an existing account.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openModal}
              className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm rounded-2xl flex items-center gap-2 transition-colors shadow-sm"
            >
              <UserPlus size={18} /> Create Patient Account (PIN &amp; QR)
            </button>

            {inviteCode ? (
              <div className="bg-white border border-amber-300 rounded-2xl px-4 py-2.5 flex items-center gap-3">
                <div>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">24-Hr Invite Code</p>
                  <p className="text-lg font-black tracking-[0.2em] text-indigo-700">{inviteCode}</p>
                </div>
                <button
                  type="button"
                  onClick={() => handleCopy(inviteCode, 'invite')}
                  className="px-3 py-1.5 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1 border border-indigo-200"
                >
                  {copied ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateCode}
                className="px-5 py-3 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-black text-sm rounded-2xl flex items-center justify-center gap-2 transition-colors"
              >
                <KeyRound size={18} />
                {isGenerating ? 'Generating...' : 'Generate 6-Digit Pairing Code'}
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Users size={18} className="text-indigo-600" />
            <label htmlFor="caregiver-patient-select" className="text-xs font-black text-slate-600 uppercase tracking-wider">
              Active Patient
            </label>
            <select
              id="caregiver-patient-select"
              value={patientId || ''}
              onChange={(e) => onSelectPatient(e.target.value)}
              className="w-full sm:w-auto sm:min-w-[180px] sm:max-w-xs bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2 text-sm font-bold text-slate-800"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} {p.loginCode ? `(${p.loginCode})` : ''}
                </option>
              ))}
            </select>
            {activePatient?.loginCode && (
              <span className="text-[11px] font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-2.5 py-1 rounded-full">
                Code: {activePatient.loginCode}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={openModal}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors"
            >
              <UserPlus size={15} /> + Create Patient (PIN &amp; QR)
            </button>
            {inviteCode ? (
              <button
                type="button"
                onClick={() => handleCopy(inviteCode, 'invite')}
                className="px-3 py-2 bg-indigo-50 text-indigo-700 font-bold text-xs rounded-xl flex items-center gap-1.5 border border-indigo-200"
              >
                <KeyRound size={14} /> {inviteCode} · {copied ? 'Copied' : 'Copy'}
              </button>
            ) : (
              <button
                type="button"
                disabled={isGenerating}
                onClick={handleGenerateCode}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl flex items-center gap-1.5"
              >
                <KeyRound size={14} /> {isGenerating ? '...' : 'Pairing Code'}
              </button>
            )}
          </div>
        </div>
      )}

      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
                <UserPlus size={22} className="text-emerald-600" />
                {provisionResult ? 'Patient Account Ready' : 'Create Patient Account (PIN & QR)'}
              </h2>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="p-2 text-slate-400 hover:text-slate-700 rounded-xl"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>

            {provisionResult ? (
              <div className="space-y-4">
                <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                  <p className="text-sm font-bold text-emerald-950">
                    {provisionResult.fullName} is paired and ready to sign in without an email or password.
                  </p>
                </div>

                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Elder Login Code</p>
                    <p className="text-2xl font-black tracking-widest text-indigo-700 mt-0.5">{provisionResult.loginCode}</p>
                    <p className="text-xs text-slate-500 mt-1">Share this code + the 4–6 digit PIN you set.</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(provisionResult.loginCode, 'code')}
                    className="px-3.5 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-indigo-700 flex items-center gap-1"
                  >
                    {copiedField === 'code' ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                    {copiedField === 'code' ? 'Copied' : 'Copy'}
                  </button>
                </div>

                {provisionResult.qrUrlPath && (
                  <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-4 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-900 flex items-center gap-1.5">
                        <QrCode size={15} /> Single-Use Device Pairing Link (24h)
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const fullUrl =
                            typeof window !== 'undefined'
                              ? `${window.location.origin}${provisionResult.qrUrlPath}`
                              : provisionResult.qrUrlPath;
                          handleCopy(fullUrl, 'qr');
                        }}
                        className="px-3 py-1 bg-white border border-indigo-200 rounded-lg text-xs font-bold text-indigo-700 flex items-center gap-1"
                      >
                        {copiedField === 'qr' ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                        {copiedField === 'qr' ? 'Copied Link' : 'Copy Setup Link'}
                      </button>
                    </div>
                    <p className="text-[11px] font-mono break-all text-indigo-900 bg-white/80 p-2 rounded-lg border border-indigo-100">
                      {provisionResult.qrUrlPath}
                    </p>
                  </div>
                )}

                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black rounded-2xl"
                >
                  Done &amp; Switch to {provisionResult.fullName}
                </button>
              </div>
            ) : (
              <form onSubmit={handleCreatePatient} className="space-y-4">
                {createError && (
                  <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs font-bold">
                    {createError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    Patient Full Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g. Aita Devi"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                      Elder PIN (4–6 digits) *
                    </label>
                    <input
                      type="password"
                      inputMode="numeric"
                      required
                      maxLength={6}
                      value={pin}
                      onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      placeholder="1234"
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold tracking-widest text-slate-900"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                      Patient Complexity Mode
                    </label>
                    <select
                      value={complexityMode}
                      onChange={(e) => setComplexityMode(e.target.value as 'SIMPLE' | 'GUIDED' | 'FULL')}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                    >
                      <option value="SIMPLE">Simple (1-Tap Now Card)</option>
                      <option value="GUIDED">Guided (Daily Companion)</option>
                      <option value="FULL">Full (All Features)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                      Primary Language
                    </label>
                    <select
                      value={preferredLanguage}
                      onChange={(e) => setPreferredLanguage(e.target.value)}
                      className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                    >
                      {Object.values(NER_LANGUAGE_CATALOG).filter((l) => l.code !== 'mni-mymk').map((l) => (
                        <option key={l.code} value={l.code}>
                          {l.nativeName} ({l.state})
                        </option>
                      ))}
                    </select>
                  </div>
                  {preferredLanguage === 'mni' ? (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                        Manipuri Script
                      </label>
                      <select
                        value={scriptPreference}
                        onChange={(e) => setScriptPreference(e.target.value as 'bengali' | 'meetei_mayek')}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                      >
                        <option value="bengali">Bengali Script (বাংলা)</option>
                        <option value="meetei_mayek">Meetei Mayek (ꯃꯩꯇꯩ ꯃꯌꯦꯛ)</option>
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                        Daily Hydration Target (ml)
                      </label>
                      <input
                        type="number"
                        min={500}
                        max={4000}
                        step={100}
                        value={hydrationTargetMl}
                        onChange={(e) => setHydrationTargetMl(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                      />
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-black uppercase tracking-wider text-slate-600 mb-1">
                    Emergency Family Phone
                  </label>
                  <input
                    type="tel"
                    value={emergencyContact}
                    onChange={(e) => setEmergencyContact(e.target.value)}
                    placeholder="+91 98640 XXXXX"
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isCreating}
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-black rounded-2xl text-sm"
                  >
                    {isCreating ? 'Creating...' : 'Create PIN & QR Account'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
