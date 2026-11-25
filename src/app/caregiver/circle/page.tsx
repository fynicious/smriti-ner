'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActivePatient } from '@/hooks/useActivePatient';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { ChevronLeft, Users, Plus, MessageSquare, Clock, Copy, CheckCircle2, X } from 'lucide-react';
import Link from 'next/link';

interface CircleMember {
  id: string;
  role: string;
  permissions?: string;
  caregiver?: { id: string; fullName: string; phoneNumber?: string | null } | null;
  clinician?: { id: string; fullName: string; specialization?: string | null; hospital?: string | null } | null;
}

const PERMISSION_OPTIONS = [
  { id: 'view_clinical', label: 'View Clinical & Vitals' },
  { id: 'view_routines', label: 'View Daily Routines' },
  { id: 'edit_routines', label: 'Edit Routines' },
  { id: 'view_location', label: 'View Safety Location' },
  { id: 'contribute_memories', label: 'Add Scrapbook Photos' },
  { id: 'view_memories', label: 'View Scrapbook' },
  { id: 'view_updates', label: 'View Updates' },
  { id: 'manage_settings', label: 'Manage Caregiver Settings' },
] as const;

const ROLE_DEFAULT_PERMS: Record<string, string[]> = {
  FAMILY: ['contribute_memories', 'view_memories', 'view_updates'],
  SECONDARY: ['view_routines', 'edit_routines', 'contribute_memories', 'view_memories', 'view_updates'],
  PRIMARY_CAREGIVER: [
    'view_clinical',
    'view_routines',
    'edit_routines',
    'view_location',
    'contribute_memories',
    'view_memories',
    'view_updates',
    'manage_settings',
  ],
};

function parsePermissions(raw?: string): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

interface CareUpdateItem {
  id: string;
  authorName: string;
  content: string;
  type: string;
  timestamp: string;
}

export default function CareCirclePage() {
  const { patientId, patients, setActivePatientId, isLoading, user } = useActivePatient();

  const [members, setMembers] = useState<CircleMember[]>([]);
  const [updates, setUpdates] = useState<CareUpdateItem[]>([]);
  const [newUpdateText, setNewUpdateText] = useState('');
  const [editingMember, setEditingMember] = useState<CircleMember | null>(null);
  const [editRole, setEditRole] = useState('SECONDARY');
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [inviteModalCode, setInviteModalCode] = useState<string | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [memberEmail, setMemberEmail] = useState('');
  const [memberRole, setMemberRole] = useState<'FAMILY' | 'SECONDARY' | 'PRIMARY_CAREGIVER'>('FAMILY');
  const [memberPerms, setMemberPerms] = useState<string[]>(ROLE_DEFAULT_PERMS.FAMILY);
  const [memberFeedback, setMemberFeedback] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const loadCircleData = useCallback(async () => {
    if (!patientId) {
      setMembers([]);
      setUpdates([]);
      return;
    }
    try {
      const res = await fetch(`/api/patients/${patientId}/care-updates`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setMembers(Array.isArray(data.careCircle) ? data.careCircle : []);
        setUpdates(Array.isArray(data.updates) ? data.updates : []);
      }
    } catch {
      // Offline non-blocking
    }
  }, [patientId]);

  useEffect(() => {
    loadCircleData();
  }, [loadCircleData]);

  const handleGenerateInvite = async () => {
    const res = await fetch('/api/pairing', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    if (res.ok) {
      const data = await res.json();
      setInviteModalCode(data.code || null);
    }
  };

  const postUpdate = async () => {
    if (!patientId || !newUpdateText.trim()) return;
    const res = await fetch(`/api/patients/${patientId}/care-updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: newUpdateText.trim(), type: 'TEXT' }),
    });
    if (res.ok) {
      setNewUpdateText('');
      await loadCircleData();
    }
  };

  const handleSaveMemberEdit = async () => {
    if (!patientId || !editingMember) return;
    const res = await fetch('/api/care-circle', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        memberId: editingMember.id,
        role: editRole,
        permissions: editPermissions,
      }),
    });
    if (res.ok) {
      setEditingMember(null);
      await loadCircleData();
    }
  };

  const handleAddMemberByEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !memberEmail.trim()) return;
    setMemberFeedback(null);
    const res = await fetch('/api/care-circle', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        patientId,
        memberEmail: memberEmail.trim(),
        role: memberRole,
        permissions: memberPerms,
      }),
    });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMemberFeedback(d.error || 'Could not add circle member');
      return;
    }
    setMemberEmail('');
    setShowAddMember(false);
    setMemberFeedback('Family / caregiver member added with scoped permissions.');
    await loadCircleData();
  };

  const handleRevokeMember = async (memberId: string) => {
    if (!patientId) return;
    const res = await fetch(`/api/care-circle?memberId=${encodeURIComponent(memberId)}&patientId=${encodeURIComponent(patientId)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setEditingMember(null);
      await loadCircleData();
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-32 sm:pb-28 font-sans">
      <div className="bg-white pt-6 sm:pt-12 pb-4 sm:pb-5 px-4 sm:px-6 shadow-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto flex items-center gap-3 sm:gap-4">
          <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors shrink-0">
            <ChevronLeft size={24} />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Care Circle</h1>
            <p className="text-xs sm:text-sm font-medium text-slate-600">Shared family & clinician coordination</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-6 space-y-5 sm:space-y-6 max-w-3xl mx-auto">
        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        {patientId && (
          <>
            {/* Members */}
            <div>
              <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
                <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2">
                  <Users size={20} className="text-indigo-600" /> Circle Members
                </h2>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddMember(!showAddMember)}
                    className="text-emerald-800 font-bold text-xs bg-emerald-50 border border-emerald-200 px-3.5 py-2 rounded-full flex items-center gap-1 hover:bg-emerald-100"
                  >
                    <Plus size={15} /> Add Scoped Member
                  </button>
                  <button
                    type="button"
                    onClick={handleGenerateInvite}
                    className="text-indigo-700 font-bold text-xs bg-indigo-50 border border-indigo-200 px-3.5 py-2 rounded-full flex items-center gap-1 hover:bg-indigo-100"
                  >
                    <Plus size={15} /> 6-Digit Invite
                  </button>
                </div>
              </div>

              {memberFeedback && (
                <div className="mb-3 p-3 rounded-2xl bg-indigo-50 border border-indigo-200 text-xs font-bold text-indigo-900">
                  {memberFeedback}
                </div>
              )}

              {showAddMember && (
                <form onSubmit={handleAddMemberByEmail} className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm mb-4 space-y-4">
                  <h3 className="font-black text-slate-900 text-sm uppercase tracking-wider">Add Registered Family / Secondary Member</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      type="email"
                      required
                      placeholder="Registered caregiver/family email"
                      value={memberEmail}
                      onChange={(e) => setMemberEmail(e.target.value)}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-semibold"
                    />
                    <select
                      value={memberRole}
                      onChange={(e) => {
                        const nextRole = e.target.value as 'FAMILY' | 'SECONDARY' | 'PRIMARY_CAREGIVER';
                        setMemberRole(nextRole);
                        setMemberPerms(ROLE_DEFAULT_PERMS[nextRole] || ROLE_DEFAULT_PERMS.FAMILY);
                      }}
                      className="px-4 py-2.5 rounded-xl border border-slate-300 text-sm font-bold bg-white"
                    >
                      <option value="FAMILY">FAMILY (Photos &amp; Updates Only)</option>
                      <option value="SECONDARY">SECONDARY CAREGIVER</option>
                      <option value="PRIMARY_CAREGIVER">PRIMARY CAREGIVER</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-50 p-3 rounded-2xl border border-slate-200">
                    {PERMISSION_OPTIONS.map((opt) => (
                      <label key={opt.id} className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={memberPerms.includes(opt.id)}
                          onChange={(e) =>
                            setMemberPerms((prev) =>
                              e.target.checked ? [...prev, opt.id] : prev.filter((p) => p !== opt.id)
                            )
                          }
                          className="rounded"
                        />
                        {opt.label}
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl">
                      Grant Scoped Access
                    </button>
                    <button type="button" onClick={() => setShowAddMember(false)} className="px-4 py-2.5 bg-slate-100 text-slate-700 font-bold text-xs rounded-xl">
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {members.length === 0 ? (
                <div className="bg-white p-6 rounded-2xl border border-slate-200 text-sm font-medium text-slate-600 text-center">
                  Only primary pairing active. Generate an invite code or add a scoped family member above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {members.map((member) => {
                    const displayName = member.caregiver?.fullName || member.clinician?.fullName || 'Authorized Member';
                    const perms = parsePermissions(member.permissions);
                    return (
                      <div key={member.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 space-y-2.5">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
                              {displayName.charAt(0)}
                            </div>
                            <div className="min-w-0">
                              <h3 className="font-extrabold text-slate-900 text-sm truncate">{displayName}</h3>
                              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{member.role.replace(/_/g, ' ')}</p>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingMember(member);
                              setEditRole(member.role);
                              setEditPermissions(perms);
                            }}
                            className="text-xs font-bold text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg hover:bg-indigo-100"
                          >
                            Edit
                          </button>
                        </div>
                        {perms.length > 0 && (
                          <div className="flex flex-wrap gap-1 pt-1 border-t border-slate-100">
                            {perms.map((p) => (
                              <span key={p} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">
                                {p.replace(/_/g, ' ')}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Care Updates Feed */}
            <div>
              <h2 className="font-extrabold text-lg text-slate-900 flex items-center gap-2 mb-4">
                <MessageSquare size={20} className="text-mint-600" /> Shared Care Updates
              </h2>

              <div className="bg-white p-4 rounded-3xl shadow-sm border border-slate-200 mb-5 flex gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-full flex-shrink-0 flex items-center justify-center font-bold text-slate-700">
                  {user?.name?.charAt(0) || 'C'}
                </div>
                <div className="flex-1">
                  <textarea
                    value={newUpdateText}
                    onChange={(e) => setNewUpdateText(e.target.value)}
                    placeholder="Share a note with family members or clinicians..."
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-sm text-slate-800 font-medium resize-none focus:outline-none focus:ring-2 focus:ring-mint-400"
                    rows={2}
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="button"
                      onClick={postUpdate}
                      disabled={!newUpdateText.trim()}
                      className="px-5 py-2 bg-mint-600 hover:bg-mint-700 disabled:bg-slate-200 text-white font-bold text-sm rounded-full transition-colors"
                    >
                      Post Update
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                {updates.length === 0 ? (
                  <div className="text-center py-6 text-slate-600 font-medium text-sm bg-white rounded-2xl border border-slate-200">
                    No updates shared yet.
                  </div>
                ) : (
                  updates.map((update) => (
                    <div key={update.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-extrabold text-sm text-slate-900">{update.authorName}</span>
                        <span className="text-xs font-bold text-slate-600 flex items-center gap-1">
                          <Clock size={12} />
                          {new Date(update.timestamp).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 font-medium">{update.content}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Invite Modal */}
      {inviteModalCode && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4 text-center">
            <div className="flex justify-end">
              <button type="button" onClick={() => setInviteModalCode(null)} aria-label="Close invite modal" className="p-1 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <h3 className="text-xl font-black text-slate-900">Caregiver & Clinician Invite Code</h3>
            <p className="text-sm text-slate-600 font-medium">
              Share this 6-digit code with the patient (under Profile) or clinician (to assign patient access). Valid for 24 hours.
            </p>
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl py-4 text-3xl font-black tracking-[0.25em] text-indigo-800">
              {inviteModalCode}
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(inviteModalCode);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="w-full py-3 bg-indigo-600 text-white font-black rounded-2xl flex items-center justify-center gap-2"
            >
              {copied ? <CheckCircle2 size={18} /> : <Copy size={18} />} {copied ? 'Copied Code' : 'Copy Code'}
            </button>
          </div>
        </div>
      )}

      {/* Edit Member Modal */}
      {editingMember && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-5" role="dialog" aria-modal="true">
          <div className="bg-white rounded-3xl p-6 max-w-sm w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-black text-slate-900">Update Member Role</h3>
              <button type="button" onClick={() => setEditingMember(null)} aria-label="Close role dialog" className="p-1 text-slate-500">
                <X size={20} />
              </button>
            </div>
            <select
              value={editRole}
              onChange={(e) => {
                const r = e.target.value;
                setEditRole(r);
                if (ROLE_DEFAULT_PERMS[r]) setEditPermissions(ROLE_DEFAULT_PERMS[r]);
              }}
              className="w-full px-4 py-3 rounded-xl border border-slate-300 font-bold text-slate-800 bg-white"
            >
              <option value="PRIMARY_CAREGIVER">PRIMARY CAREGIVER</option>
              <option value="SECONDARY">SECONDARY CAREGIVER</option>
              <option value="FAMILY">FAMILY MEMBER</option>
              <option value="CLINICIAN">CLINICIAN</option>
            </select>
            <div className="grid grid-cols-1 gap-1.5 max-h-40 overflow-y-auto bg-slate-50 p-3 rounded-xl border border-slate-200">
              {PERMISSION_OPTIONS.map((opt) => (
                <label key={opt.id} className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editPermissions.includes(opt.id)}
                    onChange={(e) =>
                      setEditPermissions((prev) =>
                        e.target.checked ? [...prev, opt.id] : prev.filter((p) => p !== opt.id)
                      )
                    }
                    className="rounded"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={handleSaveMemberEdit} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl">
                Save Role
              </button>
              <button type="button" onClick={() => handleRevokeMember(editingMember.id)} className="px-4 py-3 bg-rose-50 text-rose-700 font-bold rounded-xl border border-rose-200">
                Revoke
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
