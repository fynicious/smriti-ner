import { motion } from 'framer-motion';
import { PlannerItem } from '@/hooks/useDailyPlanner';
import { CheckCircle2, Clock, Users } from 'lucide-react';
import { db } from '@/lib/db';

interface PlannerTimelineProps {
  items: PlannerItem[];
  nextItem: PlannerItem | null;
  nowItem: PlannerItem | null;
  onComplete?: (item: PlannerItem) => Promise<void> | void;
}

export function PlannerTimeline({ items, nextItem, nowItem, onComplete }: PlannerTimelineProps) {

  const markCompleted = async (item: PlannerItem) => {
    if (onComplete) {
      await onComplete(item);
      return;
    }
    if (item.sourceId) {
      if (item.sourceType === 'MEDICATION') {
        await db.medicationEvents.update(item.sourceId, { action: 'taken' });
      } else if (item.sourceType === 'ROUTINE') {
        await db.routineOccurrences.update(item.sourceId, { status: 'completed', completedAt: new Date().toISOString() });
      }
    }
  };

  return (
    <div className="w-full">
      <h3 className="text-xl font-black text-slate-800 tracking-wider mb-4 sm:mb-6 ml-1 sm:ml-2">TODAY</h3>
      
      <div className="space-y-4">
        {items.map((item, index) => {
          
          // Don't show the 'Now' item in the timeline list, it's already massive at the top
          if (nowItem && item.id === nowItem.id) return null;

          const isNext = nextItem && item.id === nextItem.id;
          const isCompleted = item.status === 'completed';
          const isMissed = item.status === 'missed';

          return (
            <motion.div 
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`flex items-center gap-3 sm:gap-4 p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl border-2 transition-all ${
                isNext 
                  ? 'bg-white border-slate-200 shadow-md' 
                  : isCompleted 
                    ? 'bg-slate-50 border-transparent opacity-60 grayscale-[0.2]' 
                    : isMissed
                      ? 'bg-rose-50 border-rose-100 opacity-80'
                      : 'bg-white/60 border-transparent shadow-sm'
              }`}
            >
              <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0 text-2xl sm:text-3xl">
                {item.iconEmoji}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap justify-between items-baseline gap-x-2 gap-y-0.5 mb-1">
                  <h4 className="font-extrabold text-slate-800 text-lg line-clamp-1">{item.title}</h4>
                  <span className={`text-sm font-black ${isCompleted ? 'text-slate-500' : 'text-slate-600'}`}>{item.time}</span>
                </div>
                
                {!isCompleted && item.assignedTo && (
                   <p className="text-xs font-bold text-indigo-500 mb-1 flex items-center gap-1">
                     <Users size={12} /> With {item.assignedTo}
                   </p>
                )}

                {isCompleted ? (
                  <div className="flex items-center gap-1.5 text-mint-600 font-bold text-sm">
                    <CheckCircle2 size={16} />
                    <span>Completed</span>
                  </div>
                ) : isMissed ? (
                  <div className="text-rose-500 font-bold text-sm">Missed</div>
                ) : isNext ? (
                  <div className="text-sky-500 font-bold text-sm flex items-center gap-1.5">
                    <Clock size={16} />
                    <span>Coming up</span>
                  </div>
                ) : (
                  <div className="text-slate-600 font-medium text-sm">{item.category}</div>
                )}
              </div>

              {!isCompleted && item.status !== 'missed' && (
                <button
                  type="button"
                  aria-label={`Mark ${item.title} completed`}
                  onClick={() => markCompleted(item)}
                  className="w-12 h-12 bg-slate-100 hover:bg-mint-100 text-slate-600 hover:text-mint-700 rounded-full flex items-center justify-center transition-colors flex-shrink-0"
                >
                  <CheckCircle2 size={24} />
                </button>
              )}
            </motion.div>
          );
        })}

        {items.length === 0 && (
          <div className="text-center py-12 px-6 bg-slate-100 rounded-3xl border border-slate-200 border-dashed">
            <span className="text-4xl mb-4 block">🌅</span>
            <h3 className="text-xl font-bold text-slate-600 mb-2">Let&apos;s plan your day</h3>
            <p className="text-slate-600 font-medium">Your caregiver can add your daily routines.</p>
          </div>
        )}
      </div>
    </div>
  );
}
