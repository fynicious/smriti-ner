'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { FadeIn } from '@/components/ui';
import { useActivePatient } from '@/hooks/useActivePatient';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { db } from '@/lib/db';
import { Users, UserPlus, Image as ImageIcon, Mic, Square, Play, Trash2, ChevronLeft, Save, Phone, Shield } from 'lucide-react';
import Link from 'next/link';
import { compressImageFileToDataUrl } from '@/lib/media-compress';

interface FamilyAssetItem {
  id: string;
  name: string;
  relation: string;
  phoneNumber?: string | null;
  allowCall?: boolean;
  requireCallConfirm?: boolean;
  visibilityScope?: string;
  imageBase64?: string | null;
  audioBase64?: string | null;
}

export default function FamilyManagerPage() {
  const { patientId, patients, setActivePatientId, isLoading } = useActivePatient();

  const [familyMembers, setFamilyMembers] = useState<FamilyAssetItem[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [name, setName] = useState('');
  const [relation, setRelation] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [allowCall, setAllowCall] = useState(true);
  const [requireCallConfirm, setRequireCallConfirm] = useState(true);
  const [visibilityScope, setVisibilityScope] = useState<'ALL_APPROVED' | 'PRIMARY_AND_PATIENT'>('ALL_APPROVED');
  const [imageBase64, setImageBase64] = useState('');
  const [audioBase64, setAudioBase64] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadAssets = useCallback(async () => {
    if (!patientId) {
      setFamilyMembers([]);
      return;
    }
    try {
      const res = await fetch(`/api/patients/${patientId}/family-assets`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setFamilyMembers(Array.isArray(data.assets) ? data.assets : []);
        return;
      }
    } catch {
      // Offline fallback
    }
    const local = await db.familyAssets.where('patientId').equals(patientId).toArray();
    setFamilyMembers(
      local.map((m, idx) => ({
        id: String(m.id || idx),
        name: m.name,
        relation: m.relation,
        imageBase64: m.imageBase64,
        audioBase64: m.audioBase64,
      }))
    );
  }, [patientId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFileToDataUrl(file);
    setImageBase64(compressed);
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (typeof ev.target?.result === 'string') setAudioBase64(ev.target.result);
    };
    reader.readAsDataURL(file);
  };

  const toggleRecording = async () => {
    setErrorMsg(null);
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      return;
    }
    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setErrorMsg('Audio recording is unavailable in this browser. You can upload an audio file instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      recorderRef.current = rec;
      chunksRef.current = [];
      rec.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = () => {
          if (typeof reader.result === 'string') setAudioBase64(reader.result);
        };
        reader.readAsDataURL(blob);
      };
      rec.start();
      setIsRecording(true);
    } catch {
      setErrorMsg('Microphone permission denied.');
    }
  };

  const handleSave = async () => {
    if (!patientId || !name.trim() || !relation.trim()) {
      setErrorMsg('Please enter name and relationship.');
      return;
    }
    if (!imageBase64 && !audioBase64) {
      setErrorMsg('Please add at least a photo or a voice clip.');
      return;
    }
    setErrorMsg(null);
    setIsSaving(true);
    let synced = false;
    try {
      const res = await fetch(`/api/patients/${patientId}/family-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          relation: relation.trim(),
          phoneNumber: phoneNumber.trim() || null,
          allowCall,
          requireCallConfirm,
          visibilityScope,
          imageBase64: imageBase64 || null,
          audioBase64: audioBase64 || null,
        }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setErrorMsg(d.error || 'Could not save family member');
        setIsSaving(false);
        return;
      }
      synced = true;
    } catch {
      synced = false;
    }

    await db.familyAssets.add({
      patientId,
      name: name.trim(),
      relation: relation.trim(),
      imageBase64,
      audioBase64,
      isActive: true,
      synced,
    });

    setName('');
    setRelation('');
    setPhoneNumber('');
    setAllowCall(true);
    setRequireCallConfirm(true);
    setVisibilityScope('ALL_APPROVED');
    setImageBase64('');
    setAudioBase64('');
    setIsAdding(false);
    setIsSaving(false);
    await loadAssets();
  };

  const handleToggleCallPermission = async (member: FamilyAssetItem, field: 'allowCall' | 'requireCallConfirm') => {
    if (!patientId) return;
    const nextVal = !(member[field] ?? false);
    const res = await fetch(`/api/patients/${patientId}/family-assets`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ assetId: member.id, [field]: nextVal }),
    });
    if (res.ok) {
      await loadAssets();
    }
  };

  const handleDelete = async (assetId: string) => {
    if (!patientId) return;
    await fetch(`/api/patients/${patientId}/family-assets?assetId=${encodeURIComponent(assetId)}`, {
      method: 'DELETE',
    });
    await loadAssets();
  };

  return (
    <div className="min-h-screen pb-32 sm:pb-28 bg-slate-50 font-sans">
      <div className="bg-lavender-600 px-4 sm:px-6 pt-6 sm:pt-12 pb-6 sm:pb-8 rounded-b-[36px] shadow-sm">
        <div className="max-w-3xl mx-auto">
          <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="inline-flex items-center justify-center w-10 h-10 bg-white/20 rounded-full text-white hover:bg-white/30 mb-3">
            <ChevronLeft size={24} />
          </Link>
          <div className="flex items-center gap-3 text-white">
            <Users size={28} />
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Family Assets</h1>
          </div>
          <p className="text-lavender-100 font-medium text-sm sm:text-base mt-1">Manage photos & voices for Guess the Faces and Whose Voice games.</p>
        </div>
      </div>

      <div className="px-4 sm:px-5 mt-5 sm:mt-6 space-y-5 max-w-3xl mx-auto">
        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        {patientId && (
          <>
            {!isAdding ? (
              <button
                type="button"
                onClick={() => setIsAdding(true)}
                className="w-full bg-white rounded-3xl p-6 shadow-sm border border-slate-200 flex flex-col items-center justify-center gap-3 hover:border-lavender-300 transition-colors"
              >
                <div className="w-14 h-14 rounded-full bg-lavender-100 text-lavender-700 flex items-center justify-center">
                  <UserPlus size={28} />
                </div>
                <p className="font-extrabold text-slate-800">Add Family Member Asset</p>
              </button>
            ) : (
              <FadeIn>
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-lavender-200 space-y-4">
                  <h2 className="font-black text-slate-900 text-xl">New Family Member</h2>

                  {errorMsg && <p className="text-sm font-bold text-rose-600 bg-rose-50 px-4 py-2 rounded-xl">{errorMsg}</p>}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Name</label>
                      <input type="text" placeholder="e.g., Anita Sharma" value={name} onChange={(e) => setName(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Relationship</label>
                      <input type="text" placeholder="e.g., Daughter" value={relation} onChange={(e) => setRelation(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Phone Number (for Safe Calling)</label>
                      <input type="tel" placeholder="+91 98640 XXXXX" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold" />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Visibility Scope</label>
                      <select
                        value={visibilityScope}
                        onChange={(e) => setVisibilityScope(e.target.value as 'ALL_APPROVED' | 'PRIMARY_AND_PATIENT')}
                        className="w-full px-4 py-2.5 rounded-xl border border-slate-300 font-semibold bg-white"
                      >
                        <option value="ALL_APPROVED">Visible to All Approved Circle Members</option>
                        <option value="PRIMARY_AND_PATIENT">Patient &amp; Primary Caregiver Only</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 bg-slate-50 rounded-2xl p-3 border border-slate-200">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={allowCall} onChange={(e) => setAllowCall(e.target.checked)} className="rounded" />
                      Allow Patient 1-Tap Calling
                    </label>
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
                      <input type="checkbox" checked={requireCallConfirm} onChange={(e) => setRequireCallConfirm(e.target.checked)} className="rounded" />
                      Require Confirm Before Dialing
                    </label>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <label className="border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center cursor-pointer hover:bg-slate-50">
                      <ImageIcon className="mx-auto text-slate-500 mb-1" size={24} />
                      <span className="text-sm font-bold text-slate-700 block">{imageBase64 ? 'Photo Selected ✓' : 'Upload Photo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />
                    </label>

                    <div className="border-2 border-dashed border-slate-300 rounded-2xl p-4 flex flex-col items-center justify-center gap-2">
                      <button
                        type="button"
                        onClick={toggleRecording}
                        className={`px-4 py-2 rounded-xl font-bold text-xs flex items-center gap-1.5 ${
                          isRecording ? 'bg-rose-600 text-white animate-pulse' : 'bg-sky-50 text-sky-700 border border-sky-200'
                        }`}
                      >
                        {isRecording ? <Square size={14} /> : <Mic size={14} />}
                        {isRecording ? 'Stop Recording' : audioBase64 ? 'Re-record Voice ✓' : 'Record Voice'}
                      </button>
                      <label className="text-xs font-semibold text-slate-600 underline cursor-pointer">
                        Or choose audio file
                        <input type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                      </label>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleSave}
                      className="flex-1 py-3 bg-lavender-600 hover:bg-lavender-700 text-white font-black rounded-2xl flex items-center justify-center gap-2"
                    >
                      <Save size={18} /> {isSaving ? 'Saving...' : 'Save Asset'}
                    </button>
                    <button type="button" onClick={() => setIsAdding(false)} className="px-5 py-3 bg-slate-100 text-slate-700 font-bold rounded-2xl">
                      Cancel
                    </button>
                  </div>
                </div>
              </FadeIn>
            )}

            {/* Saved Family Members */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {familyMembers.map((member) => (
                <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      {member.imageBase64 ? (
                        <img src={member.imageBase64} alt={member.name} className="w-14 h-14 rounded-xl object-cover flex-shrink-0 border border-slate-200" />
                      ) : (
                        <div className="w-14 h-14 rounded-xl bg-lavender-100 text-lavender-700 flex items-center justify-center font-black text-xl flex-shrink-0">
                          {member.name.charAt(0)}
                        </div>
                      )}
                      <div className="min-w-0">
                        <h3 className="font-extrabold text-slate-900 truncate">{member.name}</h3>
                        <p className="text-xs font-bold text-slate-600 uppercase">{member.relation}</p>
                        {member.phoneNumber && (
                          <p className="text-[11px] font-semibold text-slate-500 flex items-center gap-1 mt-0.5">
                            <Phone size={11} /> {member.phoneNumber}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5">
                      {member.audioBase64 && (
                        <button
                          type="button"
                          aria-label={`Play voice greeting for ${member.name}`}
                          onClick={() => new Audio(member.audioBase64!).play().catch(() => {})}
                          className="p-2.5 bg-sky-50 text-sky-700 rounded-xl hover:bg-sky-100"
                        >
                          <Play size={16} />
                        </button>
                      )}
                      <button
                        type="button"
                        aria-label={`Delete ${member.name}`}
                        onClick={() => handleDelete(member.id)}
                        className="p-2.5 text-rose-600 hover:bg-rose-50 rounded-xl"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 text-[11px]">
                    <span className="font-bold text-slate-500 flex items-center gap-1">
                      <Shield size={12} /> {member.visibilityScope === 'PRIMARY_AND_PATIENT' ? 'Private (Primary Only)' : 'Shared Circle'}
                    </span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleToggleCallPermission(member, 'allowCall')}
                        className={`px-2.5 py-1 rounded-full font-bold ${
                          member.allowCall ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {member.allowCall ? 'Calling Allowed' : 'Calling Off'}
                      </button>
                      {member.allowCall && (
                        <button
                          type="button"
                          onClick={() => handleToggleCallPermission(member, 'requireCallConfirm')}
                          className={`px-2.5 py-1 rounded-full font-bold ${
                            member.requireCallConfirm ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {member.requireCallConfirm ? 'Confirm Prompt On' : '1-Tap Dial'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
