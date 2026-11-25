'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { Home, Image as ImageIcon, Grid3X3, Settings, Stethoscope, HeartPulse, type LucideIcon } from 'lucide-react';
import { useI18n } from '@/contexts/I18nProvider';

const HIDDEN_ROUTES = ['/login', '/register', '/check-in', '/offline'];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useI18n();

  if (HIDDEN_ROUTES.some((prefix) => pathname.startsWith(prefix))) {
    return null;
  }

  const isCaregiver = pathname.startsWith('/caregiver');
  const isDoctor = pathname.startsWith('/doctor');

  if (isDoctor) {
    return (
      <nav
        aria-label="Clinical Portal Navigation"
        className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t-2 border-slate-200 pb-safe pt-2 px-3 sm:px-6 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] print:hidden"
      >
        <div className="flex justify-around items-center max-w-lg md:max-w-xl mx-auto pb-2 gap-1.5 sm:gap-2">
          <NavItem href="/profile" icon={Settings} label="Account" active={pathname === '/profile'} color="slate" />
          <NavItem href="/doctor" icon={Stethoscope} label="Clinical Portal" active={pathname === '/doctor'} color="mint" />
        </div>
      </nav>
    );
  }

  if (isCaregiver) {
    return (
      <nav
        aria-label="Caregiver Portal Navigation"
        className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t-2 border-slate-200 pb-safe pt-2 px-4 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.05)] print:hidden"
      >
        <div className="flex justify-around items-center max-w-lg mx-auto pb-2 gap-2">
          <NavItem href="/caregiver" icon={HeartPulse} label="Today Care" active={pathname === '/caregiver'} color="peach" />
          <NavItem href="/caregiver/routines" icon={Home} label="Routines" active={pathname.startsWith('/caregiver/routines')} color="peach" />
          <NavItem href="/caregiver/settings" icon={Settings} label="Settings" active={pathname.startsWith('/caregiver/settings')} color="peach" />
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Patient Navigation"
      className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-xl border-t-2 border-slate-200 pb-safe pt-2 px-2 sm:px-4 z-40 shadow-[0_-8px_28px_rgba(0,0,0,0.06)] rounded-t-[28px] print:hidden"
    >
      <div className="flex justify-around items-center max-w-lg md:max-w-xl mx-auto pb-2 gap-1 sm:gap-2">
        <NavItem href="/" icon={Home} label={t.navHome || 'Today'} active={pathname === '/'} color="mint" />
        <NavItem href="/games" icon={Grid3X3} label={t.navGames || 'Play'} active={pathname.startsWith('/games')} color="mint" />
        <NavItem href="/scrapbook" icon={ImageIcon} label={t.navScrapbook || 'Family'} active={pathname.startsWith('/scrapbook')} color="mint" />
      </div>
    </nav>
  );
}

function NavItem({
  href,
  icon: Icon,
  label,
  active,
  color,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  color: 'mint' | 'peach' | 'slate';
}) {
  const colorMap = {
    mint: { text: 'text-emerald-900', bg: 'bg-emerald-100 border-emerald-400', idle: 'text-slate-700 border-transparent' },
    peach: { text: 'text-amber-950', bg: 'bg-amber-100 border-amber-400', idle: 'text-slate-700 border-transparent' },
    slate: { text: 'text-slate-950', bg: 'bg-slate-200 border-slate-500', idle: 'text-slate-700 border-transparent' },
  };

  const c = colorMap[color] || colorMap.mint;

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`flex flex-1 max-w-[140px] min-w-0 flex-col items-center justify-center min-h-[56px] px-2 sm:px-3 py-1.5 rounded-2xl border-2 transition-colors ${
        active ? `${c.bg} ${c.text}` : `${c.idle} hover:bg-slate-50`
      }`}
    >
      <Icon size={active ? 26 : 24} strokeWidth={active ? 2.5 : 2} className="shrink-0" />
      <span className={`text-[11px] sm:text-sm font-black mt-0.5 leading-tight text-center truncate max-w-full ${active ? 'underline underline-offset-4' : ''}`}>
        {label}
      </span>
    </Link>
  );
}
