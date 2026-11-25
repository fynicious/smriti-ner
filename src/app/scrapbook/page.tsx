'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, ChevronLeft, Mic, Square, Disc3, BookOpen, Plus, X, Trash2, PhoneCall, MapPin, Calendar } from 'lucide-react';
import { ListenButton } from '@/components/ui';
import { NER_ASSAM_PACK } from '@/lib/regional-content';
import { useActivePatient } from '@/hooks/useActivePatient';
import { compressImageFileToDataUrl } from '@/lib/media-compress';
import { FamilyCallModal, type ApprovedFamilyContact } from '@/components/patient/FamilyCallModal';
import { db } from '@/lib/db';
import Link from 'next/link';

interface MemoryPageData {
  id: string;
  isServerEntry?: boolean;
  type: 'regional' | 'personal' | 'music';
  category: string;
  imageUrl?: string;
  audioBase64?: string | null;
  title: string;
  audioPrompt: string;
  contributorName?: string | null;
  eventDateLabel?: string | null;
  locationLabel?: string | null;
}

const CURATED_REGIONAL_PAGES: MemoryPageData[] = [
  {
    id: 'curated-family',
    type: 'regional',
    category: 'Family',
    imageUrl: '/assets/ner/family.svg',
    title: 'A Warm Gathering',
    audioPrompt: 'Look at this family picture. Who comes to mind when you see loved ones together?',
  },
  {
    id: 'curated-river',
    type: 'regional',
    category: 'Places I Remember',
    imageUrl: NER_ASSAM_PACK.environments.hydration,
    title: 'By the River',
    audioPrompt: 'Look at this river scene. Does it remind you of a river or boat ride from home?',
  },
  {
    id: 'curated-music',
    type: 'music',
    category: 'Songs From Home',
    title: 'Folk Melody',
    audioPrompt: 'What traditional song or festival melody do you enjoy humming with family?',
  },
  {
    id: 'curated-festival',
    type: 'regional',
    category: 'Festivals',
    imageUrl: '/assets/ner/festival.svg',
    title: 'Festival of Lights',
    audioPrompt: 'Do you remember lighting lamps during festivals? What sweets did your household prepare?',
  },
];

export default function MemoryBookPage() {
  const { patientId } = useActivePatient();

  const [serverPages, setServerPages] = useState<MemoryPageData[]>([]);
  const [familyContacts, setFamilyContacts] = useState<ApprovedFamilyContact[]>([]);
  const [showCallModal, setShowCallModal] = useState(false);

  const [currentPage, setCurrentPage] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioUrl, setRecordedAudioUrl] = useState<string | null>(null);
  const [micError, setMicError] = useState<string | null>(null);

  const [showAddModal, setShowAddModal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newPrompt, setNewPrompt] = useState('');
  const [newLocationLabel, setNewLocationLabel] = useState('');
  const [newDateLabel, setNewDateLabel] = useState('');
  const [newImageBase64, setNewImageBase64] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const loadMemories = useCallback(async () => {
    if (!patientId) return;
    try {
      const [scrapRes, famRes] = await Promise.all([
        fetch(`/api/patients/${patientId}/scrapbook`, { cache: 'no-store' }),
        fetch(`/api/patients/${patientId}/family-assets?context=MEMORIES`, { cache: 'no-store' }),
      ]);

      if (famRes.ok) {
        const famData = await famRes.json();
        setFamilyContacts(Array.isArray(famData.assets) ? famData.assets : []);
      }

      if (scrapRes.ok) {
        const data = await scrapRes.json();
        const entries = Array.isArray(data.entries) ? data.entries : [];
        const mapped: MemoryPageData[] = entries.map(
          (e: {
            id: string;
            title: string;
            description: string;
            imageBase64?: string | null;
            audioBase64?: string | null;
            contributorName?: string | null;
            eventDateLabel?: string | null;
            locationLabel?: string | null;
          }) => ({
            id: e.id,
            isServerEntry: true,
            type: 'personal',
            category: 'Personal Memory',
            imageUrl: e.imageBase64 || '/assets/ner/family.svg',
            audioBase64: e.audioBase64,
            title: e.title,
            audioPrompt: e.description,
            contributorName: e.contributorName,
            eventDateLabel: e.eventDateLabel,
            locationLabel: e.locationLabel,
          })
        );
        setServerPages(mapped);
        return;
      }
    } catch {
      // Offline Dexie fallback below
    }

    const localEntries = await db.scrapbook.toArray();
    setServerPages(
      localEntries.map((e, i) => ({
        id: String(e.id || i),
        type: 'personal',
        category: 'Saved Memory',
        imageUrl: e.imageBase64 || '/assets/ner/family.svg',
        audioBase64: e.audioBase64,
        title: e.title,
        audioPrompt: e.description,
      }))
    );
  }, [patientId]);

  useEffect(() => {
    loadMemories();
  }, [loadMemories]);

  const pages = [...serverPages, ...CURATED_REGIONAL_PAGES];
  const safeIndex = Math.min(currentPage, Math.max(0, pages.length - 1));
  const currentMemory = pages[safeIndex];
  const callableCount = familyContacts.filter((c) => c.allowCall && c.phoneNumber).length;

  const handleNext = () => {
    if (safeIndex < pages.length - 1) {
      setCurrentPage(safeIndex + 1);
      setRecordedAudioUrl(null);
      setMicError(null);
    }
  };

  const handlePrev = () => {
    if (safeIndex > 0) {
      setCurrentPage(safeIndex - 1);
      setRecordedAudioUrl(null);
      setMicError(null);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const compressed = await compressImageFileToDataUrl(file);
    setNewImageBase64(compressed);
  };

  const handleToggleRecording = async () => {
    setMicError(null);
    if (isRecording && recorderRef.current) {
      recorderRef.current.stop();
      setIsRecording(false);
      return;
    }

    if (typeof window === 'undefined' || !navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError('Audio recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const base64 = typeof reader.result === 'string' ? reader.result : null;
          if (!base64) return;
          setRecordedAudioUrl(base64);

          if (patientId && currentMemory.isServerEntry) {
            await fetch(`/api/patients/${patientId}/scrapbook`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ entryId: currentMemory.id, audioBase64: base64 }),
            });
            await loadMemories();
          }
        };
        reader.readAsDataURL(blob);
      };

      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setMicError('Microphone permission is required to record your voice response.');
      setIsRecording(false);
    }
  };

  const handleCreateMemory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientId || !newTitle.trim() || !newPrompt.trim()) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/patients/${patientId}/scrapbook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle.trim(),
          description: newPrompt.trim(),
          locationLabel: newLocationLabel.trim() || undefined,
          eventDateLabel: newDateLabel.trim() || undefined,
          imageBase64: newImageBase64 || null,
        }),
      });
      if (res.ok) {
        await db.scrapbook.add({
          title: newTitle.trim(),
          description: newPrompt.trim(),
          imageBase64: newImageBase64 || '/assets/ner/family.svg',
          dateAdded: new Date().toISOString(),
          synced: true,
        });
        setNewTitle('');
        setNewPrompt('');
        setNewLocationLabel('');
        setNewDateLabel('');
        setNewImageBase64('');
        setShowAddModal(false);
        setCurrentPage(0);
        await loadMemories();
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteMemory = async () => {
    if (!patientId || !currentMemory?.isServerEntry) return;
    const res = await fetch(`/api/patients/${patientId}/scrapbook?entryId=${encodeURIComponent(currentMemory.id)}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      setCurrentPage(0);
      await loadMemories();
    }
  };

  const activeAudio = recordedAudioUrl || currentMemory?.audioBase64 || null;

  return (
    <div className="min-h-screen bg-[#FDFBF7] pb-36 sm:pb-32 relative overflow-hidden font-serif">
      {/* Header */}
      <div className="pt-6 sm:pt-10 pb-3 sm:pb-4 px-4 sm:px-5 flex items-center justify-between relative z-10 max-w-xl md:max-w-2xl mx-auto gap-2">
        <Link
          href="/"
          className="text-slate-800 font-sans font-bold flex items-center gap-1 sm:gap-2 px-3 sm:px-4 min-h-[48px] sm:min-h-[56px] bg-white rounded-full shadow-sm border-2 border-slate-200 shrink-0 text-sm sm:text-base"
        >
          <ChevronLeft size={20} /> Home
        </Link>
        <div className="flex items-center gap-1.5 sm:gap-2 text-slate-900 min-w-0">
          <BookOpen size={20} className="text-amber-700 shrink-0" />
          <h1 className="text-base sm:text-xl font-bold font-sans tracking-tight truncate">Family &amp; Memories</h1>
        </div>
        <div className="flex items-center gap-2 font-sans">
          {callableCount > 0 && (
            <button
              type="button"
              onClick={() => setShowCallModal(true)}
              aria-label="Call family"
              className="min-w-[56px] min-h-[56px] px-3 rounded-full bg-emerald-600 text-white font-bold flex items-center justify-center gap-1.5 shadow-sm"
            >
              <PhoneCall size={20} />
            </button>
          )}
          {patientId && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              aria-label="Add new memory"
              className="w-14 h-14 rounded-full bg-amber-600 text-white flex items-center justify-center shadow-sm hover:bg-amber-700"
            >
              <Plus size={24} />
            </button>
          )}
        </div>
      </div>

      {/* Approved Family Quick Faces */}
      {familyContacts.length > 0 && (
        <div className="px-4 sm:px-5 max-w-xl md:max-w-2xl mx-auto mb-3 font-sans">
          <div className="flex gap-3 overflow-x-auto pb-2">
            {familyContacts.slice(0, 8).map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => (person.allowCall && person.phoneNumber ? setShowCallModal(true) : undefined)}
                className="flex-shrink-0 bg-white rounded-2xl p-2.5 border border-amber-200 shadow-sm flex items-center gap-2.5 min-h-[56px]"
              >
                <img
                  src={person.imageUrl || person.imageBase64 || '/assets/ner/family.svg'}
                  alt={person.name}
                  className="w-11 h-11 rounded-full object-cover border border-slate-200"
                />
                <div className="text-left pr-1">
                  <p className="text-sm font-black text-slate-900 leading-none">{person.name}</p>
                  <p className="text-xs font-semibold text-amber-800 mt-1">{person.relation}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Album Card */}
      <div className="px-4 sm:px-5 mt-2 relative z-10 max-w-xl md:max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentMemory.id}
            initial={{ opacity: 0, x: 18 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -18 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="bg-white rounded-[28px] sm:rounded-[36px] p-4 sm:p-6 shadow-md border-2 border-amber-200"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex-1 text-center">
                <span className="inline-block px-4 py-1.5 bg-amber-100 text-amber-950 font-sans font-black text-xs uppercase tracking-widest rounded-full mb-2">
                  {currentMemory.category}
                </span>
                <h2 className="text-3xl font-bold text-slate-900 leading-tight">{currentMemory.title}</h2>
                {(currentMemory.contributorName || currentMemory.locationLabel || currentMemory.eventDateLabel) && (
                  <div className="flex flex-wrap justify-center gap-3 mt-2 text-xs font-sans font-bold text-slate-600">
                    {currentMemory.contributorName && <span>Shared by {currentMemory.contributorName}</span>}
                    {currentMemory.locationLabel && (
                      <span className="flex items-center gap-1">
                        <MapPin size={12} /> {currentMemory.locationLabel}
                      </span>
                    )}
                    {currentMemory.eventDateLabel && (
                      <span className="flex items-center gap-1">
                        <Calendar size={12} /> {currentMemory.eventDateLabel}
                      </span>
                    )}
                  </div>
                )}
              </div>
              {currentMemory.isServerEntry && (
                <button
                  type="button"
                  onClick={handleDeleteMemory}
                  aria-label="Delete memory"
                  className="p-3 text-rose-600 hover:bg-rose-50 rounded-xl font-sans"
                >
                  <Trash2 size={20} />
                </button>
              )}
            </div>

            <div className="w-full aspect-square max-h-[260px] sm:max-h-[320px] mx-auto rounded-[24px] sm:rounded-[28px] overflow-hidden bg-slate-50 shadow-inner relative mb-4 sm:mb-5 flex items-center justify-center border-2 border-slate-100">
              {currentMemory.type === 'music' ? (
                <div className="w-full h-full flex flex-col items-center justify-center bg-amber-100 text-amber-700">
                  <Disc3 size={100} strokeWidth={1.3} />
                </div>
              ) : (
                <img
                  src={currentMemory.imageUrl || '/assets/ner/family.svg'}
                  alt={currentMemory.title}
                  className="w-full h-full object-cover"
                />
              )}
            </div>

            <div className="bg-slate-50 rounded-3xl p-5 border border-slate-200 text-center space-y-4">
              <p className="text-xl text-slate-800 font-medium leading-relaxed">
                &ldquo;{currentMemory.audioPrompt}&rdquo;
              </p>
              <ListenButton
                textToSpeak={currentMemory.audioPrompt}
                className="w-full min-h-[56px] text-lg justify-center bg-white shadow-sm border border-slate-200"
              />
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 font-sans">
              <p className="text-slate-700 font-bold text-sm uppercase tracking-wider">
                {isRecording ? 'Recording... Tap to stop' : activeAudio ? 'Voice memory attached' : 'Record your story'}
              </p>

              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={handleToggleRecording}
                aria-label={isRecording ? 'Stop recording voice memory' : 'Start recording voice memory'}
                className={`w-20 h-20 rounded-full flex items-center justify-center shadow-lg transition-colors border-4 ${
                  isRecording
                    ? 'bg-rose-600 border-rose-200 text-white animate-pulse'
                    : 'bg-rose-100 border-white text-rose-700 hover:bg-rose-200'
                }`}
              >
                {isRecording ? <Square size={30} /> : <Mic size={34} />}
              </motion.button>

              {micError && <p className="text-sm font-bold text-rose-600 text-center">{micError}</p>}
              {activeAudio && <audio controls src={activeAudio} className="w-full max-w-xs mt-2" />}
            </div>
          </motion.div>
        </AnimatePresence>

        {/* Pagination Controls */}
        <div className="flex justify-between items-center mt-5 sm:mt-6 px-1 sm:px-4 pb-8 font-sans">
          <button
            type="button"
            onClick={handlePrev}
            disabled={safeIndex === 0}
            aria-label="Previous memory"
            className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center text-slate-800 border-2 border-slate-200 disabled:opacity-40"
          >
            <ChevronLeft size={30} />
          </button>

          <div className="flex gap-2">
            {pages.map((p, idx) => (
              <div
                key={p.id}
                className={`w-3 h-3 rounded-full transition-colors ${idx === safeIndex ? 'bg-amber-600' : 'bg-slate-300'}`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleNext}
            disabled={safeIndex === pages.length - 1}
            aria-label="Next memory"
            className="w-16 h-16 bg-white rounded-full shadow-md flex items-center justify-center text-slate-900 border-2 border-slate-200 disabled:opacity-40"
          >
            <ChevronRight size={30} />
          </button>
        </div>
      </div>

      {showAddModal && (
        <div
          className="fixed inset-0 z-[100] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-5 font-sans"
          role="dialog"
          aria-modal="true"
        >
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-xl font-black text-slate-900">Add a Memory Page</h3>
              <button type="button" onClick={() => setShowAddModal(false)} aria-label="Close modal" className="p-2 text-slate-500">
                <X size={22} />
              </button>
            </div>
            <form onSubmit={handleCreateMemory} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Memory Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Sunday Tea in Jorhat"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-semibold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Story or Prompt</label>
                <textarea
                  required
                  rows={3}
                  placeholder="Write a warm story or question..."
                  value={newPrompt}
                  onChange={(e) => setNewPrompt(e.target.value)}
                  className="w-full px-4 py-3 rounded-xl border border-slate-300 font-medium"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="text"
                  placeholder="Place (optional)"
                  value={newLocationLabel}
                  onChange={(e) => setNewLocationLabel(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
                />
                <input
                  type="text"
                  placeholder="Year/Date (optional)"
                  value={newDateLabel}
                  onChange={(e) => setNewDateLabel(e.target.value)}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-600 uppercase mb-1">Photo (Compressed Automatically)</label>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="w-full text-sm text-slate-600" />
              </div>
              <button
                type="submit"
                disabled={isSaving}
                className="w-full min-h-[56px] bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white font-black rounded-2xl"
              >
                {isSaving ? 'Saving Memory...' : 'Save to Memory Book'}
              </button>
            </form>
          </div>
        </div>
      )}

      <FamilyCallModal
        isOpen={showCallModal}
        onClose={() => setShowCallModal(false)}
        patientId={patientId}
        contacts={familyContacts}
      />
    </div>
  );
}
