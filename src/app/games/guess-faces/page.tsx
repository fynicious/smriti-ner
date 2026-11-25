'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { FadeIn, Button } from '@/components/ui';
import { Smile, CheckCircle, XCircle, Image as ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { db } from '@/lib/db';
import { useActivePatient } from '@/hooks/useActivePatient';
import { logCognitiveSession } from '@/lib/cognitive-logger';
import { playClickSound, playSuccessSound, playFanfareSound } from '@/lib/sound';
import { useI18n } from '@/contexts/I18nProvider';

interface FamilyPhotoAsset {
  id: string;
  name: string;
  relation: string;
  imageBase64: string;
}

const GENERIC_NAMES = ['Suresh', 'Anita', 'Rahul', 'Priya', 'Amit', 'Sunita', 'Vikram', 'Meena', 'Rohan', 'Kavita'];

export default function GuessFacesGame() {
  const { t } = useI18n();
  const { patientId } = useActivePatient();

  const [familyMembers, setFamilyMembers] = useState<FamilyPhotoAsset[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentRound, setCurrentRound] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [gameEnded, setGameEnded] = useState(false);

  const errorCountRef = useRef(0);
  const loggedRef = useRef(false);

  const loadAssets = useCallback(async () => {
    setIsLoading(true);
    let combined: FamilyPhotoAsset[] = [];

    if (patientId) {
      try {
        const res = await fetch(`/api/patients/${patientId}/family-assets`, { cache: 'no-store' });
        if (res.ok) {
          const data = await res.json();
          const serverAssets = Array.isArray(data.assets) ? data.assets : [];
          combined = serverAssets
            .filter((a: { imageBase64?: string | null }) => Boolean(a.imageBase64))
            .map((a: { id: string; name: string; relation: string; imageBase64: string }) => ({
              id: a.id,
              name: a.name,
              relation: a.relation,
              imageBase64: a.imageBase64,
            }));
        }
      } catch {
        // Fallback to offline Dexie
      }

      if (combined.length === 0) {
        const local = await db.familyAssets.where('patientId').equals(patientId).toArray();
        combined = local
          .filter((m) => Boolean(m.imageBase64))
          .map((m, idx) => ({
            id: String(m.id || idx),
            name: m.name,
            relation: m.relation,
            imageBase64: m.imageBase64 || '',
          }));
      }
    }

    setFamilyMembers(combined);
    setIsLoading(false);
  }, [patientId]);

  useEffect(() => {
    loadAssets();
  }, [loadAssets]);

  const setupRound = useCallback(
    (roundIndex: number, members: FamilyPhotoAsset[]) => {
      const correctMember = members[roundIndex];
      if (!correctMember) return;
      const correctName = correctMember.name;

      const distractors = new Set<string>();
      members.forEach((m) => {
        if (m.name !== correctName) distractors.add(m.name);
      });

      let genericIndex = 0;
      while (distractors.size < 3 && genericIndex < GENERIC_NAMES.length) {
        if (GENERIC_NAMES[genericIndex] !== correctName) {
          distractors.add(GENERIC_NAMES[genericIndex]);
        }
        genericIndex++;
      }

      const chosenDistractors = Array.from(distractors).sort(() => 0.5 - Math.random()).slice(0, 3);
      const finalOptions = [correctName, ...chosenDistractors].sort(() => 0.5 - Math.random());

      setOptions(finalOptions);
      setSelectedOption(null);
      setIsCorrect(null);
    },
    []
  );

  useEffect(() => {
    if (familyMembers.length > 0 && currentRound < familyMembers.length) {
      setupRound(currentRound, familyMembers);
    } else if (familyMembers.length > 0 && currentRound >= familyMembers.length && !gameEnded) {
      setGameEnded(true);
      playFanfareSound();
      if (!loggedRef.current) {
        loggedRef.current = true;
        const total = familyMembers.length;
        const accuracy = total > 0 ? Math.max(0, Math.min(1, score / total)) : 1;
        logCognitiveSession({
          patientId,
          gameId: 'guess-faces',
          domain: 'MEMORY',
          moves: total,
          errors: errorCountRef.current,
          accuracy,
          difficultyLevel: 1,
        });
      }
    }
  }, [currentRound, familyMembers, gameEnded, patientId, score, setupRound]);

  const handleSelect = (option: string) => {
    if (selectedOption !== null || !familyMembers[currentRound]) return;

    const correct = option === familyMembers[currentRound].name;
    setSelectedOption(option);
    setIsCorrect(correct);
    if (correct) {
      setScore((s) => s + 1);
      playSuccessSound();
    } else {
      errorCountRef.current += 1;
      playClickSound();
    }

    setTimeout(() => {
      setCurrentRound((r) => r + 1);
    }, 2200);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center font-bold text-slate-600">
        Loading family photos...
      </div>
    );
  }

  if (familyMembers.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 p-6 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 bg-slate-200 rounded-full flex items-center justify-center text-slate-500 mb-6">
          <ImageIcon size={48} />
        </div>
        <h1 className="text-2xl font-black text-slate-900 mb-2">{t.noPhotosFound || 'No Family Photos Yet'}</h1>
        <p className="text-slate-600 font-bold mb-8 max-w-sm">
          {t.askCaregiverToUpload || 'Ask your caregiver to upload family photos in the Family Assets section to play.'}
        </p>
        <Link href="/games">
          <Button className="rounded-full px-8 bg-sky-600 text-white font-bold">{t.backToGames || 'Back to Games'}</Button>
        </Link>
      </div>
    );
  }

  if (gameEnded) {
    return (
      <div className="min-h-screen bg-lavender-50 flex flex-col items-center justify-center p-4 sm:p-6 text-center">
        <motion.div initial={{ scale: 0.85, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-white p-6 sm:p-8 rounded-[32px] sm:rounded-[40px] shadow-sm max-w-sm w-full">
          <div className="w-24 h-24 bg-lavender-100 rounded-full flex items-center justify-center text-lavender-600 mx-auto mb-6">
            <Smile size={48} />
          </div>
          <h1 className="text-3xl font-black text-slate-900 mb-2">{t.wellDone || 'Well Done!'}</h1>
          <p className="text-slate-600 font-bold text-lg mb-8">
            {t.gotScoreOutOf ? t.gotScoreOutOf(score, familyMembers.length) : `You got ${score} out of ${familyMembers.length} correct.`}
          </p>

          <div className="space-y-4">
            <button
              type="button"
              onClick={() => {
                loggedRef.current = false;
                errorCountRef.current = 0;
                setCurrentRound(0);
                setScore(0);
                setGameEnded(false);
              }}
              className="w-full py-4 bg-lavender-600 text-white font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-transform"
            >
              {t.playAgain || 'Play Again'}
            </button>
            <Link href="/games" className="block w-full py-4 bg-slate-100 text-slate-700 font-black uppercase tracking-widest rounded-2xl active:scale-95 transition-transform">
              {t.backToGames || 'Back to Games'}
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const currentMember = familyMembers[currentRound];
  if (!currentMember) return null;

  return (
    <div className="min-h-screen bg-lavender-50 pb-32 sm:pb-28">
      <div className="px-4 sm:px-6 pt-6 sm:pt-12 pb-4 sm:pb-6 flex justify-between items-center max-w-md mx-auto">
        <Link href="/games" aria-label="Close game" className="w-12 h-12 bg-white rounded-full flex items-center justify-center shadow-sm text-slate-700 active:scale-95 transition-transform">
          <span className="font-black text-xl">✕</span>
        </Link>
        <div className="bg-white px-5 py-2 rounded-full shadow-sm">
          <span className="font-black text-lavender-700 tracking-widest">{currentRound + 1} / {familyMembers.length}</span>
        </div>
      </div>

      <div className="px-4 sm:px-6 max-w-md mx-auto">
        <FadeIn key={currentRound}>
          <div className="bg-white p-4 rounded-[36px] shadow-sm mb-8 border border-white">
            <div className="aspect-square rounded-[28px] overflow-hidden bg-slate-100 mb-6 border-4 border-slate-50 relative">
              <img src={currentMember.imageBase64} alt="Family member portrait" className="w-full h-full object-cover" />

              {selectedOption && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className={`absolute inset-0 flex flex-col items-center justify-center backdrop-blur-sm ${isCorrect ? 'bg-mint-500/85' : 'bg-rose-500/85'}`}
                >
                  <motion.div initial={{ scale: 0.5 }} animate={{ scale: 1 }} transition={{ type: 'spring' }}>
                    {isCorrect ? <CheckCircle size={80} className="text-white drop-shadow-md" /> : <XCircle size={80} className="text-white drop-shadow-md" />}
                  </motion.div>
                  <p className="text-white font-black text-2xl mt-4 drop-shadow-md">
                    {isCorrect ? (t.correct || 'Correct!') : (t.thatsName ? t.thatsName(currentMember.name) : `That's ${currentMember.name}`)}
                  </p>
                </motion.div>
              )}
            </div>

            <h2 className="text-2xl font-black text-center text-slate-900 mb-6 px-4">{t.whoIsThis || 'Who is this?'}</h2>

            <div className="grid grid-cols-1 gap-3">
              {options.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => handleSelect(option)}
                  disabled={selectedOption !== null}
                  className={`py-4 px-6 rounded-2xl font-black text-lg transition-all ${
                    selectedOption === option
                      ? isCorrect
                        ? 'bg-mint-600 text-white shadow-md'
                        : 'bg-rose-600 text-white shadow-md'
                      : selectedOption !== null && option === currentMember.name
                      ? 'bg-mint-600 text-white shadow-md'
                      : 'bg-lavender-50 text-lavender-900 hover:bg-lavender-100'
                  }`}
                >
                  {option}
                </button>
              ))}
            </div>
          </div>
        </FadeIn>
      </div>
    </div>
  );
}
