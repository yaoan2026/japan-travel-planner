import React from 'react';
import { BookMarked, Compass, Gift, Map as MapIcon, Train, Utensils, Wrench } from 'lucide-react';
import { TabId } from '../types/trip';

interface HeaderProps {
  activeTab: TabId;
  onSelectTab: (tab: TabId) => void;
  savedCount: number;
  onOpenDrawer: () => void;
}

const NAV_ITEMS: { id: TabId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'plan', label: '規劃', icon: Compass },
  { id: 'transport', label: '交通', icon: Train },
  { id: 'food', label: '美食', icon: Utensils },
  { id: 'map', label: '地圖', icon: MapIcon },
  { id: 'deals', label: '優惠', icon: Gift },
  { id: 'tools', label: '工具', icon: Wrench },
];

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  savedCount,
  onOpenDrawer,
}) => {
  return (
    <>
      {/* Desktop & Mobile Top Bar (Strict 3-zone contract) */}
      <header className="sticky top-0 z-40 border-b border-zinc-200/80 bg-[#FAFAFA]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-8 px-4 sm:px-6">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#plan"
            onClick={(e) => {
              e.preventDefault();
              onSelectTab('plan');
            }}
            className="flex shrink-0 items-center gap-2.5 whitespace-nowrap text-zinc-950 transition-opacity hover:opacity-80"
          >
            <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <circle cx="17.5" cy="6.5" r="2.5" fill="#D93829" />
              <path
                d="M3 19.5L9.4 8.6C9.9 7.7 10.8 7 12 7C13.2 7 14.1 7.7 14.6 8.6L21 19.5H3Z"
                fill="#18181B"
              />
              <path
                d="M8.5 12.2L9.4 8.6C9.9 7.7 10.8 7 12 7C13.2 7 14.1 7.7 14.6 8.6L15.5 12.2L13.7 11.2L12 12.5L10.3 11.2L8.5 12.2Z"
                fill="#FAFAFA"
              />
            </svg>
            <span className="text-base font-bold tracking-tight">旅日手帖</span>
          </a>

          {/* Zone 2: Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7" aria-label="主導航">
            {NAV_ITEMS.map(({ id, label }) => {
              const active = activeTab === id;
              return (
                <a
                  key={id}
                  href={`#${id}`}
                  onClick={(e) => {
                    e.preventDefault();
                    onSelectTab(id);
                  }}
                  className={`relative py-4 text-sm font-medium whitespace-nowrap shrink-0 transition-colors duration-150 ${
                    active ? 'text-zinc-950 font-semibold' : 'text-zinc-500 hover:text-zinc-900'
                  }`}
                >
                  {label}
                  {active && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[#D93829] rounded-full" />
                  )}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Single Primary Action */}
          <div className="flex shrink-0 items-center">
            <button
              type="button"
              onClick={onOpenDrawer}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-xs font-semibold text-zinc-900 shadow-xs transition-all duration-150 hover:border-zinc-300 hover:bg-zinc-50 active:scale-[0.98] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <BookMarked className="h-4 w-4 text-[#D93829]" />
              <span>我的行程</span>
              {savedCount > 0 && (
                <span className="tabular-nums text-zinc-500 font-medium">· {savedCount}</span>
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Fixed Bottom Navigation (Thumb-Zone Ergonomics, <= 15% height) */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-zinc-200 bg-white/95 backdrop-blur-md pb-[env(safe-area-inset-bottom)]"
        aria-label="行動版導航"
      >
        <div className="grid grid-cols-6 h-14">
          {NAV_ITEMS.map(({ id, label, icon: Icon }) => {
            const active = activeTab === id;
            return (
              <a
                key={id}
                href={`#${id}`}
                onClick={(e) => {
                  e.preventDefault();
                  onSelectTab(id);
                }}
                className={`relative flex flex-col items-center justify-center gap-0.5 text-[11px] font-medium transition-colors duration-150 ${
                  active ? 'text-[#D93829] font-semibold' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                {active && (
                  <span className="absolute top-0 left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-b-full bg-[#D93829]" />
                )}
                <Icon className="h-[18px] w-[18px]" />
                <span className="whitespace-nowrap">{label}</span>
              </a>
            );
          })}
        </div>
      </nav>
    </>
  );
};
