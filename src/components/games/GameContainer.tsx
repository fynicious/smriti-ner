'use client';

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronLeft } from 'lucide-react';
import { useActivePatient } from '@/hooks/useActivePatient';
import { logCognitiveSession, getDomainForGame } from '@/lib/cognitive-logger';
import { playFanfareSound } from '@/lib/sound';

interface GameContainerProps {
  title: string;
  subtitle: string;
  isWon: boolean;
  onRestart: () => void;
  skipAutoLog?: boolean;
  gameId?: string;
  domain?: string;
  children: React.ReactNode;
}

export function GameContainer({
  title,
  subtitle,
  isWon,
  onRestart,
  skipAutoLog = false,
  gameId,
  domain,
  children,
}: GameContainerProps) {
  const pathname = usePathname();
  const { patientId } = useActivePatient();
  const prevWonRef = useRef(false);

  useEffect(() => {
    if (isWon && !prevWonRef.current) {
      playFanfareSound();
      if (!skipAutoLog) {
        const inferredSlug = gameId || pathname.split('/').filter(Boolean).pop() || 'cognitive-activity';
        logCognitiveSession({
          patientId,
          gameId: inferredSlug,
          domain: domain || getDomainForGame(inferredSlug),
          moves: 4,
          errors: 0,
          accuracy: 1,
          difficultyLevel: 1,
        });
      }
    }
    prevWonRef.current = isWon;
  }, [isWon, skipAutoLog, gameId, domain, pathname, patientId]);

  return (
    <div className="min-h-screen bg-slate-50 px-3.5 sm:px-4 py-5 sm:py-6 pb-32 sm:pb-28 relative">
      <Link
        href="/games"
        aria-label="Back to activities"
        className="absolute top-5 sm:top-6 left-3.5 sm:left-4 z-50 flex items-center justify-center w-12 h-12 bg-white rounded-full shadow-sm border border-slate-200 text-slate-700 hover:text-slate-900 transition-colors"
      >
        <ChevronLeft size={24} />
      </Link>

      <div className="text-center mb-5 sm:mb-8 mt-2 sm:mt-4 px-14">
        <h1 className="text-xl sm:text-2xl font-black text-slate-900">{title}</h1>
        <p className="text-sm sm:text-base text-slate-600 mt-1 font-medium">{subtitle}</p>
      </div>

      {children}

      <AnimatePresence>
        {isWon && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 sm:p-6"
          >
            <motion.div
              initial={{ y: 30 }}
              animate={{ y: 0 }}
              className="bg-white rounded-3xl p-6 sm:p-8 text-center shadow-2xl max-w-sm w-full space-y-4"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                transition={{ duration: 0.6, delay: 0.2 }}
                className="text-6xl"
              >
                🎉
              </motion.div>
              <h2 className="text-3xl font-black text-slate-900">Wonderful!</h2>
              <p className="text-slate-600 font-medium">You did a great job.</p>
              <div className="pt-2 space-y-3">
                <Button variant="peach" size="lg" onClick={onRestart} className="w-full">
                  Play Again
                </Button>
                <Link
                  href="/games"
                  className="block w-full py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-2xl transition-colors"
                >
                  Back to Activities
                </Link>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
