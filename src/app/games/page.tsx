'use client';
import Link from 'next/link';
import { FadeIn } from '@/components/ui';
import { useI18n } from '@/contexts/I18nProvider';

export default function GamesPage() {
  const { t } = useI18n();

  const games = [
    { id: 'guess-faces', title: t.guessFaces || 'Guess the Faces', desc: t.guessFacesDesc || 'Recognize your family members', emoji: '👪', color: 'bg-lavender-200', href: '/games/guess-faces' },
    { id: 'recognize-voices', title: t.whoseVoice || 'Whose Voice?', desc: t.whoseVoiceDesc || 'Recognize voices of loved ones', emoji: '🎙️', color: 'bg-sky-200', href: '/games/recognize-voices' },
    { id: 'memory-match', title: t.memoryMatch || 'Memory Match', desc: t.memoryMatchDesc || 'Find matching cultural pairs', emoji: '🧩', color: 'bg-peach-100', href: '/games/memory-match' },
    { id: 'object-recognition', title: 'What is This?', desc: 'Identify everyday objects', emoji: '🔍', color: 'bg-mint-100', href: '/games/object-recognition' },
    { id: 'daily-routine', title: 'Daily Routine', desc: 'Order your morning tasks', emoji: '🌅', color: 'bg-orange-100', href: '/games/daily-routine' },
    { id: 'odd-one-out', title: 'Odd One Out', desc: 'Find the one that is different', emoji: '🎯', color: 'bg-lavender-100', href: '/games/odd-one-out' },
    { id: 'word-association', title: 'Word Link', desc: 'Match related words', emoji: '🔗', color: 'bg-blue-100', href: '/games/word-association' },
    { id: 'word-garden', title: 'Word Garden', desc: 'Match regional & everyday words', emoji: '🌿', color: 'bg-emerald-100', href: '/games/word-garden' },
    { id: 'emotion-recognition', title: 'Feelings', desc: 'Identify the emotion', emoji: '😊', color: 'bg-pink-100', href: '/games/emotion-recognition' },
    { id: 'shadow-match', title: 'Shadow Match', desc: 'Match objects to their shadows', emoji: '👤', color: 'bg-indigo-100', href: '/games/shadow-match' },
    { id: 'color-sequence', title: 'Color Sequence', desc: 'Remember the color pattern', emoji: '🎨', color: 'bg-yellow-100', href: '/games/color-sequence' },
    { id: 'pattern-weave', title: 'Pattern Weave', desc: 'Remember woven cultural motifs', emoji: '🧶', color: 'bg-amber-100', href: '/games/pattern-weave' },
    { id: 'find-the-item', title: 'Find It', desc: 'Spot the hidden object', emoji: '👀', color: 'bg-green-100', href: '/games/find-the-item' },
    { id: 'sorting-game', title: 'Sort It', desc: 'Sort items by category', emoji: '📦', color: 'bg-rose-100', href: '/games/sorting-game' },
  ];

  return (
    <div className="min-h-screen bg-flo-bg pb-32 sm:pb-28">
      <FadeIn>
        <div className="bg-hero-gradient px-4 sm:px-6 pt-7 sm:pt-12 pb-12 sm:pb-14 rounded-b-[36px] sm:rounded-b-[40px] shadow-soft relative border-b border-white/50">
          <div className="max-w-4xl mx-auto">
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mb-1.5 sm:mb-2">{t.activities || 'Activities'}</h1>
            <p className="text-slate-700 font-medium text-base sm:text-lg">{t.keepMindActive || 'Keep your mind active and engaged.'}</p>
          </div>
        </div>
      </FadeIn>

      <div className="px-4 sm:px-6 py-5 sm:py-6 -mt-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          {games.map((game, i) => (
            <FadeIn key={game.id} delay={0.03 * i}>
              <Link href={game.href}>
                <div className="flex items-center gap-3.5 sm:gap-5 bg-white rounded-[24px] sm:rounded-[28px] p-3.5 sm:p-4 shadow-plush border-2 border-white hover:border-mint-200 transition-all cursor-pointer">
                  <div className={`w-16 h-16 sm:w-20 sm:h-20 rounded-[18px] sm:rounded-[22px] ${game.color} flex items-center justify-center text-3xl sm:text-4xl flex-shrink-0 shadow-inner-soft`}>
                    {game.emoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 tracking-tight">{game.title}</h2>
                    <p className="text-sm sm:text-[15px] text-slate-600 mt-0.5 sm:mt-1 font-medium leading-snug">{game.desc}</p>
                  </div>
                </div>
              </Link>
            </FadeIn>
          ))}
        </div>
      </div>
    </div>
  );
}
