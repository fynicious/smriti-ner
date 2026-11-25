'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { db } from '@/lib/db';
import { useActivePatient } from '@/hooks/useActivePatient';
import { ChevronLeft, Volume2, Phone, MapPin, Bookmark, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DirectoryResource {
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
  telehealthAvailable: boolean;
  homeVisitAvailable: boolean;
}

function playTTS(text: string) {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.88;
    window.speechSynthesis.speak(utterance);
  }
}

const CATEGORIES = [
  { id: 'EMERGENCY', label: 'EMERGENCY', emoji: '🚨', color: 'bg-rose-100 text-rose-800 border-rose-300', tts: 'Emergency Services' },
  { id: 'DOCTOR', label: 'DOCTORS & CARE', emoji: '👨🏽‍⚕️', color: 'bg-sky-100 text-sky-800 border-sky-300', tts: 'Doctors and Specialists' },
  { id: 'HOSPITAL', label: 'HOSPITALS', emoji: '🏥', color: 'bg-indigo-100 text-indigo-800 border-indigo-300', tts: 'Hospitals and Clinics' },
  { id: 'PHARMACY', label: 'PHARMACIES', emoji: '💊', color: 'bg-teal-100 text-teal-800 border-teal-300', tts: 'Pharmacies and Medicine' },
  { id: 'SUPPORT', label: 'HELPLINES & SUPPORT', emoji: '🤝', color: 'bg-amber-100 text-amber-800 border-amber-300', tts: 'Helplines and Elder Support' },
  { id: 'NGO', label: 'COMMUNITY & NGOs', emoji: '🏡', color: 'bg-emerald-100 text-emerald-800 border-emerald-300', tts: 'NGOs and Community Support' },
] as const;

type Category = (typeof CATEGORIES)[number]['id'];

export default function HelpNearMePage() {
  const router = useRouter();
  const { patientId } = useActivePatient();

  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [resources, setResources] = useState<DirectoryResource[]>([]);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadResources = useCallback(async () => {
    setIsLoading(true);
    try {
      const qs = new URLSearchParams();
      if (patientId) qs.set('patientId', patientId);
      const res = await fetch(`/api/resources?${qs.toString()}`, { cache: 'no-store' });

      if (res.ok) {
        const data = await res.json();
        const serverItems: DirectoryResource[] = Array.isArray(data.resources) ? data.resources : [];
        setResources(serverItems);
        setSavedIds(Array.isArray(data.savedResourceIds) ? data.savedResourceIds : []);

        // Cache locally for offline resilience (replace cached entries cleanly without duplicating)
        await db.transaction('rw', db.localResources, async () => {
          await db.localResources.clear();
          if (serverItems.length > 0) {
            await db.localResources.bulkAdd(
              serverItems.map((r) => ({
                name: r.name,
                category: (['HOSPITAL', 'DOCTOR', 'PHARMACY', 'NGO', 'SUPPORT', 'EMERGENCY'].includes(r.category)
                  ? r.category
                  : 'SUPPORT') as 'HOSPITAL' | 'DOCTOR' | 'PHARMACY' | 'NGO' | 'SUPPORT' | 'EMERGENCY',
                description: r.description,
                state: r.state,
                district: r.district,
                locality: r.locality,
                address: r.address,
                phone: r.phone,
                emergencyPhone: r.emergencyPhone || undefined,
                openingHours: r.openingHours,
                verificationStatus: (r.verificationStatus === 'VERIFIED' ? 'VERIFIED' : 'UNVERIFIED') as 'VERIFIED' | 'UNVERIFIED' | 'PENDING',
                telehealthAvailable: r.telehealthAvailable,
                homeVisitAvailable: r.homeVisitAvailable,
                synced: true,
              }))
            );
          }
        });
        setIsLoading(false);
        return;
      }
    } catch {
      // Fallback to offline Dexie cache
    }

    const cached = await db.localResources.toArray();
    setResources(
      cached.map((r, idx) => ({
        id: String(r.id || idx),
        name: r.name,
        category: r.category,
        description: r.description,
        state: r.state,
        district: r.district,
        locality: r.locality,
        address: r.address,
        phone: r.phone,
        emergencyPhone: r.emergencyPhone,
        openingHours: r.openingHours,
        verificationStatus: r.verificationStatus,
        telehealthAvailable: r.telehealthAvailable,
        homeVisitAvailable: r.homeVisitAvailable,
      }))
    );
    setIsLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadResources();
  }, [loadResources]);

  const handleToggleSave = async (resourceId: string) => {
    if (!patientId) return;
    try {
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
    } catch {
      // Offline bookmark skipped
    }
  };

  const normalizedQ = searchQuery.trim().toLowerCase();
  const filteredResources = resources.filter((r) => {
    if (selectedCategory && r.category !== selectedCategory) return false;
    if (!normalizedQ) return true;
    return (
      r.name.toLowerCase().includes(normalizedQ) ||
      r.locality.toLowerCase().includes(normalizedQ) ||
      r.district.toLowerCase().includes(normalizedQ) ||
      r.state.toLowerCase().includes(normalizedQ) ||
      r.description.toLowerCase().includes(normalizedQ)
    );
  });

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans pb-28">
      {/* Header */}
      <div className="pt-12 pb-4 px-6 flex items-center gap-4 bg-white shadow-sm border-b border-slate-200 sticky top-0 z-10">
        <button
          type="button"
          onClick={() => (selectedCategory ? setSelectedCategory(null) : router.push('/'))}
          aria-label={selectedCategory ? 'Back to categories' : 'Back home'}
          className="w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center text-slate-700 active:scale-95 transition-transform"
        >
          <ChevronLeft size={28} />
        </button>
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Help Near Me</h1>
          <p className="text-sm font-bold text-slate-600">Trusted North East India & national resources</p>
        </div>
      </div>

      <div className="flex-1 p-6 max-w-2xl mx-auto w-full">
        {/* Quick Search */}
        <div className="relative mb-6">
          <Search size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Search by town, city, or service (e.g., Guwahati, 108, Tezpur)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3.5 bg-white rounded-2xl border border-slate-300 font-semibold text-slate-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>

        <AnimatePresence mode="wait">
          {!selectedCategory && !normalizedQ ? (
            <motion.div
              key="categories"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 16 }}
              className="space-y-4"
            >
              <h2 className="text-2xl font-black text-slate-900 mb-4 text-center">What support do you need?</h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => {
                      playTTS(cat.tts);
                      setSelectedCategory(cat.id);
                    }}
                    className={`w-full p-6 rounded-[28px] border-4 flex items-center gap-4 active:scale-[0.98] transition-transform ${cat.color} shadow-sm text-left`}
                  >
                    <span className="text-4xl">{cat.emoji}</span>
                    <span className="text-lg font-black tracking-wide flex-1">{cat.label}</span>
                  </button>
                ))}
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="results"
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              className="space-y-4"
            >
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-black text-slate-900">
                  {selectedCategory
                    ? CATEGORIES.find((c) => c.id === selectedCategory)?.label
                    : `Search Results (${filteredResources.length})`}
                </h2>
                {selectedCategory && (
                  <button
                    type="button"
                    onClick={() => setSelectedCategory(null)}
                    className="text-sm font-bold text-sky-700 bg-sky-50 px-4 py-2 rounded-full border border-sky-200"
                  >
                    All Categories
                  </button>
                )}
              </div>

              {isLoading ? (
                <div className="p-8 text-center bg-white rounded-3xl border border-slate-200 font-bold text-slate-600">
                  Loading directory...
                </div>
              ) : filteredResources.length === 0 ? (
                <div className="text-center p-8 bg-white rounded-3xl border-2 border-slate-200 shadow-sm">
                  <p className="text-slate-700 font-bold text-lg mb-2">No verified resources matched that filter.</p>
                  <p className="text-slate-600 text-sm">Try another category or clear your search text.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredResources.map((res) => {
                    const isSaved = savedIds.includes(res.id);
                    return (
                      <div key={res.id} className="bg-white p-6 rounded-[28px] border-2 border-slate-200 shadow-sm">
                        <div className="flex justify-between items-start gap-3 mb-2">
                          <h3 className="text-xl font-black text-slate-900 leading-tight">{res.name}</h3>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span
                              className={`px-2.5 py-1 rounded-md text-xs font-black uppercase tracking-wider ${
                                res.verificationStatus === 'VERIFIED'
                                  ? 'bg-mint-100 text-mint-800'
                                  : 'bg-amber-100 text-amber-800'
                              }`}
                            >
                              {res.verificationStatus === 'VERIFIED' ? 'Verified' : 'Community'}
                            </span>
                            {patientId && (
                              <button
                                type="button"
                                onClick={() => handleToggleSave(res.id)}
                                aria-label={isSaved ? 'Remove bookmark' : 'Save resource'}
                                className={`p-2 rounded-xl border ${
                                  isSaved ? 'bg-sky-50 border-sky-300 text-sky-700' : 'bg-slate-50 border-slate-200 text-slate-500'
                                }`}
                              >
                                <Bookmark size={18} fill={isSaved ? 'currentColor' : 'none'} />
                              </button>
                            )}
                          </div>
                        </div>

                        <p className="text-slate-700 font-medium text-sm mb-4">{res.description}</p>

                        <div className="flex items-center gap-2 text-slate-700 text-sm font-semibold mb-4 bg-slate-50 p-3 rounded-xl border border-slate-200">
                          <MapPin size={18} className="text-slate-500 flex-shrink-0" />
                          <span>
                            {res.locality}, {res.district}, {res.state} • {res.openingHours}
                          </span>
                        </div>

                        <div className="flex flex-wrap gap-3">
                          <a
                            href={`tel:${res.phone}`}
                            className="flex-1 min-w-[140px] bg-sky-600 hover:bg-sky-700 text-white py-3.5 px-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-colors shadow-sm"
                          >
                            <Phone size={20} /> Call {res.phone}
                          </a>

                          {res.emergencyPhone && res.emergencyPhone !== res.phone && (
                            <a
                              href={`tel:${res.emergencyPhone}`}
                              className="bg-rose-600 hover:bg-rose-700 text-white py-3.5 px-4 rounded-2xl font-black text-base flex items-center justify-center gap-2 transition-colors shadow-sm"
                            >
                              SOS {res.emergencyPhone}
                            </a>
                          )}

                          <button
                            type="button"
                            aria-label={`Read details for ${res.name}`}
                            onClick={() =>
                              playTTS(`${res.name}. ${res.description}. Located in ${res.locality}. Call ${res.phone}`)
                            }
                            className="w-14 bg-sky-100 text-sky-800 hover:bg-sky-200 rounded-2xl flex items-center justify-center transition-colors"
                          >
                            <Volume2 size={22} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
