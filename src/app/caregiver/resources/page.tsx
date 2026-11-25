'use client';

import { useState, useEffect, useCallback } from 'react';
import { useActivePatient } from '@/hooks/useActivePatient';
import { CaregiverPatientBar } from '@/components/caregiver/CaregiverPatientBar';
import { ChevronLeft, MapPin, Phone, Bookmark, ShieldCheck, Search } from 'lucide-react';
import Link from 'next/link';

interface LocalResourceItem {
  id: string;
  name: string;
  category: string;
  description: string;
  state: string;
  district: string;
  locality: string;
  address: string;
  phone: string;
  emergencyPhone?: string | null;
  openingHours: string;
  verificationStatus: string;
}

const CATEGORIES = ['ALL', 'EMERGENCY', 'HOSPITAL', 'SUPPORT', 'PHARMACY', 'NGO'];

export default function CaregiverResourcesPage() {
  const { patientId, patients, setActivePatientId, isLoading } = useActivePatient();

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [resources, setResources] = useState<LocalResourceItem[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);

  const loadDirectory = useCallback(async () => {
    try {
      const qs = new URLSearchParams();
      if (patientId) qs.set('patientId', patientId);
      const res = await fetch(`/api/resources?${qs.toString()}`, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setResources(Array.isArray(data.resources) ? data.resources : []);
        setSavedIds(Array.isArray(data.savedResourceIds) ? data.savedResourceIds : []);
      }
    } catch {
      // Offline non-blocking
    }
  }, [patientId]);

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  const toggleSave = async (resourceId: string) => {
    if (!patientId) return;
    const res = await fetch('/api/resources', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patientId, resourceId }),
    });
    if (res.ok) {
      const data = await res.json();
      setSavedIds((prev) =>
        data.saved ? Array.from(new Set([...prev, resourceId])) : prev.filter((id) => id !== resourceId)
      );
    }
  };

  const normalizedQ = search.trim().toLowerCase();
  const filteredResources = resources.filter((r) => {
    if (selectedCategory !== 'ALL' && r.category !== selectedCategory) return false;
    if (!normalizedQ) return true;
    return (
      r.name.toLowerCase().includes(normalizedQ) ||
      r.district.toLowerCase().includes(normalizedQ) ||
      r.locality.toLowerCase().includes(normalizedQ) ||
      r.state.toLowerCase().includes(normalizedQ)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 pb-32 sm:pb-28 font-sans">
      <div className="bg-white pt-6 sm:pt-12 pb-4 sm:pb-5 px-4 sm:px-6 shadow-sm border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-3xl mx-auto space-y-4">
          <div className="flex items-center gap-3 sm:gap-4">
            <Link href="/caregiver" aria-label="Back to Caregiver Dashboard" className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 hover:bg-slate-200 transition-colors shrink-0">
              <ChevronLeft size={24} />
            </Link>
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">Local Resources</h1>
              <p className="text-xs sm:text-sm font-medium text-slate-600">Vetted NER care providers & emergency contacts</p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5">
              <Search size={18} className="text-slate-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search city, hospital, helpline..."
                className="w-full bg-transparent text-sm font-bold text-slate-800 outline-none"
              />
            </div>

            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-800"
            >
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c === 'ALL' ? 'All Categories' : c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="p-6 space-y-5 max-w-3xl mx-auto">
        <CaregiverPatientBar patientId={patientId} patients={patients} onSelectPatient={setActivePatientId} isLoading={isLoading} />

        {filteredResources.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-3xl border border-slate-200 text-slate-600 font-bold">
            No resources match this filter.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredResources.map((res) => {
              const isSaved = savedIds.includes(res.id);
              return (
                <div key={res.id} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-200 flex flex-col justify-between gap-4">
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h2 className="font-extrabold text-slate-900 leading-tight">{res.name}</h2>
                      <span className="text-xs font-black uppercase px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg flex-shrink-0">
                        {res.category}
                      </span>
                    </div>

                    {res.verificationStatus === 'VERIFIED' && (
                      <div className="inline-flex items-center gap-1 text-mint-800 bg-mint-50 px-2.5 py-0.5 rounded-md mb-2 text-xs font-bold">
                        <ShieldCheck size={13} /> Verified Resource
                      </div>
                    )}

                    <p className="text-sm font-medium text-slate-600 mb-3">{res.description}</p>

                    <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700">
                      <div className="flex items-start gap-2">
                        <MapPin size={14} className="mt-0.5 flex-shrink-0 text-slate-500" />
                        <span>{res.address}, {res.district}, {res.state}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Phone size={14} className="flex-shrink-0 text-slate-500" />
                        <span>{res.phone} • {res.openingHours}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {patientId && (
                      <button
                        type="button"
                        onClick={() => toggleSave(res.id)}
                        className={`flex-1 py-2.5 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border-2 transition-colors ${
                          isSaved ? 'bg-indigo-50 border-indigo-200 text-indigo-800' : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Bookmark size={14} className={isSaved ? 'fill-indigo-600 text-indigo-600' : ''} />
                        {isSaved ? 'Saved to Plan' : 'Save to Plan'}
                      </button>
                    )}
                    <a
                      href={`tel:${res.phone}`}
                      className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1.5"
                    >
                      <Phone size={14} /> Call
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
