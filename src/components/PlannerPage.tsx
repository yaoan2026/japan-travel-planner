import React, { useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Bookmark,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Link2,
  Map as MapIcon,
  MapPin,
  Minus,
  Navigation,
  Pin,
  Plus,
  Printer,
  RefreshCw,
  Shuffle,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { CITIES, DEFAULT_PRESETS, PACE_OPTIONS, TAGS } from '../data/japanData';
import { CityId, ItineraryItem, PaceId, TabId, TagId, Trip } from '../types/trip';
import { addDays, fmtDate, fmtTime, gmap, gsearch, km, spotToItem, tripText, twd, yen } from '../utils/tripEngine';
import { BudgetChart } from './BudgetChart';

interface PlannerPageProps {
  cities: CityId[];
  onToggleCity: (id: CityId) => void;
  onClearCities: () => void;
  startDate: string;
  onChangeStartDate: (d: string) => void;
  days: number;
  onChangeDays: (n: number) => void;
  pace: PaceId;
  onChangePace: (p: PaceId) => void;
  interests: TagId[];
  onToggleInterest: (id: TagId) => void;
  trip: Trip | null;
  pinnedTrips: Trip[];
  rate: number;
  stayPerNight: number;
  onChangeStayPerNight: (val: number) => void;
  shopPerDay: number;
  onChangeShopPerDay: (val: number) => void;
  onGenerate: () => void;
  onApplyPreset: (cities: CityId[], days: number, pace: PaceId, interests: TagId[]) => void;
  onLoadPinned: (t: Trip) => void;
  onUpdateTrip: (t: Trip) => void;
  onSaveTrip: (t: Trip) => void;
  onTogglePin: (t: Trip) => void;
  onCopyLink: (t: Trip) => void;
  onRegenTrip: () => void;
  onOpenMapMode: (mode: string) => void;
  onNavigateTab: (tab: TabId, toolSection?: string) => void;
  onNotify: (msg: string, undoFn?: () => void) => void;
}

export const PlannerPage: React.FC<PlannerPageProps> = ({
  cities,
  onToggleCity,
  onClearCities,
  startDate,
  onChangeStartDate,
  days,
  onChangeDays,
  pace,
  onChangePace,
  interests,
  onToggleInterest,
  trip,
  pinnedTrips,
  rate,
  stayPerNight,
  onChangeStayPerNight,
  shopPerDay,
  onChangeShopPerDay,
  onGenerate,
  onApplyPreset,
  onLoadPinned,
  onUpdateTrip,
  onSaveTrip,
  onTogglePin,
  onCopyLink,
  onRegenTrip,
  onOpenMapMode,
  onNavigateTab,
  onNotify,
}) => {
  const [formHint, setFormHint] = useState('');
  const [activeDayFilter, setActiveDayFilter] = useState<'all' | number>('all');
  const [collapsedDays, setCollapsedDays] = useState<Record<number, boolean>>({});
  const [showTips, setShowTips] = useState(true);
  const [swapTarget, setSwapTarget] = useState<{ dayIndex: number; itemIndex: number } | null>(null);
  const [addTargetDay, setAddTargetDay] = useState<number | null>(null);
  const [customName, setCustomName] = useState('');
  const [customTime, setCustomTime] = useState('15:00');
  const [customNote, setCustomNote] = useState('');
  const itineraryRef = useRef<HTMLDivElement>(null);

  const scrollToItinerary = () => {
    setTimeout(() => {
      itineraryRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!cities.length) {
      setFormHint('請至少選擇一個目的地城市');
      return;
    }
    if (days < cities.length) {
      setFormHint(`天數少於城市數，系統將優先安排前 ${days} 個城市`);
    } else {
      setFormHint('');
    }
    setActiveDayFilter('all');
    setCollapsedDays({});
    onGenerate();
    scrollToItinerary();
  };

  const toggleDayCollapse = (di: number) => {
    setCollapsedDays((prev) => ({ ...prev, [di]: !prev[di] }));
  };

  const handleDeleteItem = (di: number, ii: number) => {
    if (!trip) return;
    const prevTrip = structuredClone(trip);
    const nextTrip = structuredClone(trip);
    const [removed] = nextTrip.days[di].items.splice(ii, 1);
    onUpdateTrip(nextTrip);
    onNotify(`已移除「${removed.name}」`, () => {
      onUpdateTrip(prevTrip);
      onNotify('已復原行程項目');
    });
  };

  const handleMoveItem = (di: number, ii: number, dir: -1 | 1) => {
    if (!trip) return;
    const nextTrip = structuredClone(trip);
    const list = nextTrip.days[di].items;
    const targetIdx = ii + dir;
    if (targetIdx < 0 || targetIdx >= list.length) return;
    const a = list[ii];
    const b = list[targetIdx];
    // Swap their scheduled time slots so chronological labels stay natural
    const tmpTime = a.time;
    a.time = b.time;
    b.time = tmpTime;
    list[ii] = b;
    list[targetIdx] = a;
    onUpdateTrip(nextTrip);
  };

  const swapCandidates = useMemo(() => {
    if (!trip || !swapTarget) return [];
    const day = trip.days[swapTarget.dayIndex];
    const currentItem = day?.items[swapTarget.itemIndex];
    if (!day || !currentItem) return [];
    const usedNames = new Set(trip.days.flatMap((d) => d.items.map((x) => x.name)));
    const cands = CITIES[day.city].spots.filter((s) => !s.full && !usedNames.has(s.n));
    if (currentItem.lat != null && currentItem.lng != null) {
      cands.sort((a, b) => km({ lat: currentItem.lat!, lng: currentItem.lng! }, a) - km({ lat: currentItem.lat!, lng: currentItem.lng! }, b));
    }
    return cands;
  }, [trip, swapTarget]);

  const handleConfirmSwap = (spotIdx: number) => {
    if (!trip || !swapTarget) return;
    const spot = swapCandidates[spotIdx];
    if (!spot) return;
    const nextTrip = structuredClone(trip);
    const day = nextTrip.days[swapTarget.dayIndex];
    const oldItem = day.items[swapTarget.itemIndex];
    day.items[swapTarget.itemIndex] = spotToItem(spot, oldItem.time, day.city);
    onUpdateTrip(nextTrip);
    setSwapTarget(null);
    onNotify(`已替換為「${spot.n}」`);
  };

  const handleAddCustomItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trip || addTargetDay === null || !customName.trim()) return;
    const [hh, mm] = customTime.split(':').map(Number);
    const timeDecimal = (hh || 12) + (mm || 0) / 60;
    const nextTrip = structuredClone(trip);
    const newItem: ItineraryItem = {
      id: `custom_${Date.now()}`,
      type: 'note',
      icon: '📌',
      time: timeDecimal,
      dur: 1,
      name: customName.trim(),
      desc: customNote.trim() || undefined,
      sub: '自訂行程項目',
    };
    nextTrip.days[addTargetDay].items.push(newItem);
    nextTrip.days[addTargetDay].items.sort((a, b) => a.time - b.time);
    onUpdateTrip(nextTrip);
    setCustomName('');
    setCustomNote('');
    setAddTargetDay(null);
    onNotify(`已加入「${newItem.name}」`);
  };

  const handleCopyText = () => {
    if (!trip) return;
    const text = tripText(trip);
    if (navigator.share) {
      navigator.share({ title: trip.title, text }).catch(() => {});
    } else if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => onNotify('已複製純文字行程表'),
        () => onNotify('無法複製文字')
      );
    }
  };

  const totalSpots = trip
    ? trip.days.reduce((s, d) => s + d.items.filter((i) => i.type === 'spot').length, 0)
    : 0;
  const totalCost = trip ? trip.cost.transport + trip.cost.tickets + trip.cost.food : 0;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8">
      {/* Minimalist Editorial Intro */}
      <div className="mb-6 sm:mb-8 no-print">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <p className="text-xs font-semibold tracking-wider text-[#D93829] mb-1.5">
              日本自由行智慧編排
            </p>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-zinc-950 text-balance">
              打造剛剛好節奏的日本旅程
            </h1>
          </div>
          <p className="text-sm text-zinc-500 max-w-md">
            選擇城市與天數，系統依據地理距離、停留時間與餐飲時段自動編排路線，並支援隨時微調順序。
          </p>
        </div>
      </div>

      {/* Two-Column Responsive Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 lg:gap-8 items-start">
        {/* Left Column: Configurator */}
        <aside className="no-print lg:sticky lg:top-20 space-y-4">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 shadow-xs"
          >
            {/* Presets & Pinned Trips */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-zinc-500">快速範本</span>
                {pinnedTrips.length > 0 && (
                  <span className="text-xs text-[#D93829] font-medium">含已釘選行程</span>
                )}
              </div>
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {pinnedTrips.map((pt) => (
                  <button
                    key={pt.id}
                    type="button"
                    onClick={() => {
                      onLoadPinned(pt);
                      scrollToItinerary();
                    }}
                    className="inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-lg border border-[#D93829]/30 bg-[#D93829]/5 px-3 py-1.5 text-xs font-semibold text-[#D93829] hover:bg-[#D93829]/10 transition-colors cursor-pointer"
                  >
                    <Pin className="h-3 w-3 fill-current" />
                    <span className="whitespace-nowrap">{pt.title}</span>
                  </button>
                ))}
                {DEFAULT_PRESETS.map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      onApplyPreset(p.cities, p.days, p.pace, p.interests);
                      setFormHint('');
                      setActiveDayFilter('all');
                      scrollToItinerary();
                    }}
                    className="inline-flex min-h-[36px] shrink-0 items-center rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:border-zinc-300 hover:bg-zinc-100 hover:text-zinc-950 transition-colors cursor-pointer whitespace-nowrap"
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="border-t border-zinc-100 pt-5 space-y-5">
              {/* Destination Cities */}
              <div>
                <div className="flex items-center justify-between mb-2.5">
                  <label className="text-sm font-semibold text-zinc-900">目的地城市</label>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500">依點選順序串聯</span>
                    {cities.length > 0 && (
                      <button
                        type="button"
                        onClick={onClearCities}
                        className="text-xs font-medium text-zinc-400 hover:text-zinc-700 cursor-pointer"
                      >
                        清除
                      </button>
                    )}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(Object.keys(CITIES) as CityId[]).map((id) => {
                    const c = CITIES[id];
                    const orderIdx = cities.indexOf(id);
                    const selected = orderIdx >= 0;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => {
                          onToggleCity(id);
                          setFormHint('');
                        }}
                        className={`relative inline-flex min-h-[40px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-all duration-150 cursor-pointer active:scale-[0.97] ${
                          selected
                            ? 'border-zinc-900 bg-zinc-900 text-white shadow-xs'
                            : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50'
                        }`}
                      >
                        <span aria-hidden="true">{c.emoji}</span>
                        <span className="whitespace-nowrap">{c.shortName}</span>
                        {selected && (
                          <span className="ml-0.5 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#D93829] text-[10px] font-bold text-white tabular-nums">
                            {orderIdx + 1}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Start Date & Days */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="startDate" className="block text-sm font-semibold text-zinc-900 mb-2">
                    出發日期
                  </label>
                  <input
                    id="startDate"
                    type="date"
                    value={startDate}
                    onChange={(e) => onChangeStartDate(e.target.value)}
                    required
                    className="h-11 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 tabular-nums focus:border-zinc-900 focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
                  />
                </div>
                <div>
                  <label htmlFor="daysInput" className="block text-sm font-semibold text-zinc-900 mb-2">
                    旅程天數
                  </label>
                  <div className="flex h-11 items-center rounded-lg border border-zinc-200 bg-white overflow-hidden">
                    <button
                      type="button"
                      onClick={() => onChangeDays(Math.max(1, days - 1))}
                      aria-label="減少一天"
                      className="flex h-full w-11 items-center justify-center text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 transition-colors cursor-pointer"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                    <input
                      id="daysInput"
                      type="number"
                      min={1}
                      max={21}
                      value={days}
                      onChange={(e) => onChangeDays(Math.min(21, Math.max(1, Number(e.target.value) || 1)))}
                      className="w-full border-0 bg-transparent text-center text-sm font-bold text-zinc-900 tabular-nums focus:outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    />
                    <button
                      type="button"
                      onClick={() => onChangeDays(Math.min(21, days + 1))}
                      aria-label="增加一天"
                      className="flex h-full w-11 items-center justify-center text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200 transition-colors cursor-pointer"
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Pace Segmented Control */}
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">旅行步調</label>
                <div className="grid grid-cols-3 gap-1 rounded-lg bg-zinc-100 p-1">
                  {(Object.keys(PACE_OPTIONS) as PaceId[]).map((pid) => {
                    const active = pace === pid;
                    return (
                      <button
                        key={pid}
                        type="button"
                        onClick={() => onChangePace(pid)}
                        className={`min-h-[38px] rounded-md px-2 py-1.5 text-xs font-semibold transition-all duration-150 cursor-pointer whitespace-nowrap ${
                          active
                            ? 'bg-white text-zinc-950 shadow-xs'
                            : 'text-zinc-500 hover:text-zinc-900'
                        }`}
                      >
                        {PACE_OPTIONS[pid].label}
                      </button>
                    );
                  })}
                </div>
                <p className="mt-1.5 text-xs text-zinc-500">{PACE_OPTIONS[pace].desc}</p>
              </div>

              {/* Interest Tags */}
              <div>
                <label className="block text-sm font-semibold text-zinc-900 mb-2">探索偏好</label>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(TAGS) as TagId[]).map((tid) => {
                    const active = interests.includes(tid);
                    return (
                      <button
                        key={tid}
                        type="button"
                        onClick={() => onToggleInterest(tid)}
                        className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-medium transition-all duration-150 cursor-pointer ${
                          active
                            ? 'border-[#D93829]/40 bg-[#D93829]/8 text-[#D93829] font-semibold'
                            : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300 hover:text-zinc-900'
                        }`}
                      >
                        {active && <Check className="h-3 w-3" />}
                        <span className="whitespace-nowrap">{TAGS[tid].label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <div className="pt-1">
                <button
                  type="submit"
                  className="w-full min-h-[48px] inline-flex items-center justify-center gap-2 rounded-xl bg-zinc-950 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-150 hover:bg-zinc-800 active:scale-[0.99] cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 text-[#D93829]" />
                  <span>生成專屬行程</span>
                </button>
                {formHint && (
                  <p className="mt-2.5 text-center text-xs font-medium text-[#D93829]">{formHint}</p>
                )}
              </div>
            </div>
          </form>
        </aside>

        {/* Right Column: Itinerary Workspace or Empty Starter State */}
        <section ref={itineraryRef} className="print-full min-w-0 space-y-5">
          {!trip ? (
            <div className="space-y-6">
              {/* Clean Starter Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6 sm:p-8">
                <p className="text-xs font-semibold text-zinc-400 mb-2">開始規劃</p>
                <h2 className="text-xl font-bold text-zinc-950 mb-2">
                  選擇左側條件，或直接套用經典路線
                </h2>
                <p className="text-sm text-zinc-500 mb-6">
                  所有行程皆可於生成後自由調整順序、替換鄰近景點、加入個人備忘，並支援一鍵同步連結與離線列印。
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEFAULT_PRESETS.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      onClick={() => {
                        onApplyPreset(p.cities, p.days, p.pace, p.interests);
                      }}
                      className="group flex flex-col justify-between rounded-xl border border-zinc-200 bg-zinc-50/50 p-4 text-left transition-all duration-150 hover:border-zinc-900 hover:bg-white cursor-pointer"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-bold text-zinc-900 group-hover:text-[#D93829] transition-colors">
                            {p.label}
                          </span>
                          <span className="text-xs font-mono-num text-zinc-400">{p.days}D</span>
                        </div>
                        <p className="mt-1 text-xs text-zinc-500">{p.subtitle}</p>
                      </div>
                      <span className="mt-3 text-xs font-semibold text-zinc-700 group-hover:text-zinc-950">
                        立即套用 →
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Clean Module Entry Grid */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-6">
                <h3 className="text-sm font-bold text-zinc-900 mb-4">隨行實用工具</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { tab: 'transport' as TabId, title: '交通攻略', desc: '新幹線 · 周遊券' },
                    { tab: 'food' as TabId, title: '必吃美食', desc: '在地老店 · 評價' },
                    { tab: 'map' as TabId, title: '動態地圖', desc: '景點分布 · 路線' },
                    { tab: 'deals' as TabId, title: '優惠情報', desc: '退稅新制 · 折價' },
                    { tab: 'tools' as TabId, tool: 'fx', title: '即時匯率', desc: 'JPY / TWD 試算' },
                    { tab: 'tools' as TabId, tool: 'weather', title: '一週天氣', desc: '氣溫與降雨率' },
                    { tab: 'tools' as TabId, tool: 'phrase', title: '日語發音', desc: '真人語音朗讀' },
                    { tab: 'tools' as TabId, tool: 'sos', title: '緊急求助', desc: '24h 中文專線' },
                  ].map((item) => (
                    <button
                      key={item.title}
                      type="button"
                      onClick={() => onNavigateTab(item.tab, item.tool)}
                      className="rounded-xl border border-zinc-200 bg-white p-3.5 text-left transition-all duration-150 hover:border-zinc-400 hover:bg-zinc-50 cursor-pointer"
                    >
                      <div className="text-sm font-semibold text-zinc-900">{item.title}</div>
                      <div className="mt-0.5 text-xs text-zinc-500">{item.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Trip Summary Card */}
              <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-zinc-500 tabular-nums">
                      <span>{fmtDate(trip.opts.start)} – {fmtDate(addDays(trip.opts.start, trip.opts.days - 1))}</span>
                      <span aria-hidden="true">·</span>
                      <span>{PACE_OPTIONS[trip.opts.pace].label}</span>
                    </div>
                    <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-zinc-950">
                      {trip.title}
                    </h2>
                  </div>

                  {/* Clean Action Toolbar */}
                  <div className="flex flex-wrap items-center gap-1.5 no-print">
                    <button
                      type="button"
                      onClick={() => onSaveTrip(trip)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    >
                      <Bookmark className="h-3.5 w-3.5" />
                      儲存
                    </button>
                    <button
                      type="button"
                      onClick={() => onTogglePin(trip)}
                      className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer ${
                        trip.pinned
                          ? 'border-[#D93829]/40 bg-[#D93829]/8 text-[#D93829]'
                          : 'border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50'
                      }`}
                    >
                      <Pin className={`h-3.5 w-3.5 ${trip.pinned ? 'fill-current' : ''}`} />
                      {trip.pinned ? '已釘選' : '釘選'}
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyLink(trip)}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                      同步連結
                    </button>
                    <button
                      type="button"
                      onClick={onRegenTrip}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      換一組
                    </button>
                    <button
                      type="button"
                      onClick={handleCopyText}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    >
                      <Copy className="h-3.5 w-3.5" />
                      分享
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenMapMode('trip')}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    >
                      <MapIcon className="h-3.5 w-3.5" />
                      地圖
                    </button>
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="inline-flex min-h-[36px] items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
                    >
                      <Printer className="h-3.5 w-3.5" />
                      列印
                    </button>
                  </div>
                </div>

                {/* Tabular Key Metrics */}
                <div className="mt-5 grid grid-cols-3 divide-x divide-zinc-200 rounded-xl border border-zinc-200 bg-zinc-50/60 py-3.5">
                  <div className="px-4 text-center">
                    <div className="font-mono-num text-xl sm:text-2xl font-bold text-zinc-950">
                      {trip.opts.days}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">總天數</div>
                  </div>
                  <div className="px-4 text-center">
                    <div className="font-mono-num text-xl sm:text-2xl font-bold text-zinc-950">
                      {totalSpots}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500">精選景點</div>
                  </div>
                  <div className="px-4 text-center">
                    <div className="font-mono-num text-xl sm:text-2xl font-bold text-zinc-950">
                      {yen(totalCost)}
                    </div>
                    <div className="mt-0.5 text-xs text-zinc-500 tabular-nums">
                      預估/人 · 約 {twd(totalCost, rate)}
                    </div>
                  </div>
                </div>
                <p className="mt-2.5 text-xs text-zinc-400">
                  下方圖表已將住宿、交通、餐飲與購物（含門票）支出整合分類，並支援微調單日預算。
                </p>
              </div>

              {/* Categorized Budget Analysis Donut Chart */}
              <BudgetChart
                trip={trip}
                rate={rate}
                stayPerNight={stayPerNight}
                onChangeStayPerNight={onChangeStayPerNight}
                shopPerDay={shopPerDay}
                onChangeShopPerDay={onChangeShopPerDay}
              />

              {/* Smart Seasonal & Transit Tips (Clean hairline container, no thick left bar) */}
              {trip.tips.length > 0 && (
                <div className="rounded-2xl border border-zinc-200 bg-white">
                  <button
                    type="button"
                    onClick={() => setShowTips(!showTips)}
                    className="flex w-full items-center justify-between px-5 py-3.5 text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">季節與票券提醒</span>
                      <span className="text-xs text-zinc-400 tabular-nums">· {trip.tips.length} 項</span>
                    </div>
                    {showTips ? (
                      <ChevronUp className="h-4 w-4 text-zinc-400" />
                    ) : (
                      <ChevronDown className="h-4 w-4 text-zinc-400" />
                    )}
                  </button>
                  {showTips && (
                    <ul className="border-t border-zinc-100 px-5 py-3.5 space-y-2 text-xs sm:text-sm text-zinc-600 list-disc list-inside">
                      {trip.tips.map((tip, i) => (
                        <li key={i} className="leading-relaxed">
                          {tip}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Day Jump Filter Bar */}
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1 no-print">
                <button
                  type="button"
                  onClick={() => setActiveDayFilter('all')}
                  className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                    activeDayFilter === 'all'
                      ? 'bg-zinc-900 text-white'
                      : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  全部天數
                </button>
                {trip.days.map((d, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveDayFilter(idx)}
                    className={`min-h-[36px] shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap tabular-nums ${
                      activeDayFilter === idx
                        ? 'bg-zinc-900 text-white'
                        : 'bg-white border border-zinc-200 text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    Day {idx + 1} · {CITIES[d.city].shortName}
                  </button>
                ))}
              </div>

              {/* Day Cards */}
              <div className="space-y-4">
                {trip.days.map((d, di) => {
                  if (activeDayFilter !== 'all' && activeDayFilter !== di) return null;
                  const city = CITIES[d.city];
                  const isCollapsed = !!collapsedDays[di];
                  const pts = d.items.filter((i) => i.lat != null && i.lng != null).slice(0, 10);

                  return (
                    <article
                      key={di}
                      className="rounded-2xl border border-zinc-200 bg-white overflow-hidden"
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-5 py-4">
                        <button
                          type="button"
                          onClick={() => toggleDayCollapse(di)}
                          className="flex flex-1 min-w-0 items-center gap-3 text-left cursor-pointer"
                        >
                          <span className="shrink-0 rounded-md bg-zinc-950 px-2.5 py-1 font-mono-num text-xs font-bold text-white">
                            D{di + 1}
                          </span>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm sm:text-base font-bold text-zinc-950">
                              {city.shortName} · {d.summary}
                            </h3>
                            <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                              {fmtDate(d.date)}
                            </p>
                          </div>
                        </button>

                        <div className="flex shrink-0 items-center gap-1.5 no-print">
                          {pts.length > 0 && (
                            <button
                              type="button"
                              onClick={() => {
                                if (pts.length < 2) {
                                  window.open(gmap(pts[0].ja || pts[0].name), '_blank', 'noopener');
                                } else {
                                  window.open(
                                    'https://www.google.com/maps/dir/' +
                                      pts.map((p) => `${p.lat},${p.lng}`).join('/') +
                                      '/data=!4m2!4m1!3e3',
                                    '_blank',
                                    'noopener'
                                  );
                                }
                              }}
                              className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                            >
                              <Navigation className="h-3 w-3" />
                              <span className="hidden sm:inline">路線</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => onOpenMapMode(`day-${di}`)}
                            className="inline-flex min-h-[34px] items-center gap-1 rounded-lg border border-zinc-200 px-2.5 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer"
                          >
                            <MapPin className="h-3 w-3" />
                            <span className="hidden sm:inline">地圖</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleDayCollapse(di)}
                            aria-label={isCollapsed ? '展開當日行程' : '收合當日行程'}
                            className="flex h-[34px] w-[34px] items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"
                          >
                            {isCollapsed ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronUp className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Day Timeline */}
                      {!isCollapsed && (
                        <div className="px-5 py-4">
                          <div className="space-y-4">
                            {d.items.map((it, ii) => {
                              const isSwapping =
                                swapTarget?.dayIndex === di && swapTarget?.itemIndex === ii;

                              return (
                                <div key={it.id} className="relative flex gap-3.5 sm:gap-4">
                                  {/* Vertical connector */}
                                  {ii < d.items.length - 1 && (
                                    <div
                                      className="absolute left-[58px] sm:left-[64px] top-8 bottom-[-16px] w-px bg-zinc-200"
                                      aria-hidden="true"
                                    />
                                  )}

                                  {/* Timestamp */}
                                  <div className="w-11 sm:w-12 shrink-0 pt-1.5 text-right font-mono-num text-xs font-medium text-zinc-400">
                                    {fmtTime(it.time)}
                                  </div>

                                  {/* Node Dot */}
                                  <div
                                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs ${
                                      it.type === 'spot'
                                        ? 'border-[#D93829]/30 bg-[#D93829]/10'
                                        : it.type === 'food'
                                        ? 'border-amber-200 bg-amber-50'
                                        : it.type === 'move'
                                        ? 'border-zinc-300 bg-zinc-100'
                                        : 'border-emerald-200 bg-emerald-50'
                                    }`}
                                  >
                                    {it.icon}
                                  </div>

                                  {/* Item Content */}
                                  <div className="flex-1 min-w-0 pb-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <div>
                                        <h4 className="text-sm font-semibold text-zinc-950">
                                          {it.name}
                                        </h4>
                                        {it.sub && (
                                          <p className="mt-0.5 text-xs text-zinc-500">{it.sub}</p>
                                        )}
                                      </div>

                                      {/* Reorder Controls */}
                                      <div className="flex items-center gap-0.5 shrink-0 no-print">
                                        <button
                                          type="button"
                                          disabled={ii === 0}
                                          onClick={() => handleMoveItem(di, ii, -1)}
                                          title="往上移動"
                                          className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                                        >
                                          <ArrowUp className="h-3.5 w-3.5" />
                                        </button>
                                        <button
                                          type="button"
                                          disabled={ii === d.items.length - 1}
                                          onClick={() => handleMoveItem(di, ii, 1)}
                                          title="往下移動"
                                          className="flex h-7 w-7 items-center justify-center rounded text-zinc-400 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-25 disabled:pointer-events-none cursor-pointer"
                                        >
                                          <ArrowDown className="h-3.5 w-3.5" />
                                        </button>
                                      </div>
                                    </div>

                                    {it.desc && (
                                      <p className="mt-1.5 text-xs sm:text-[13px] text-zinc-600 leading-relaxed whitespace-pre-line">
                                        {it.desc}
                                      </p>
                                    )}

                                    {/* Item Quick Actions */}
                                    <div className="mt-2.5 flex flex-wrap items-center gap-3 text-xs no-print">
                                      {it.lat != null && (
                                        <a
                                          href={gmap(it.ja || it.name)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 font-medium text-zinc-500 hover:text-zinc-950 transition-colors"
                                        >
                                          <MapPin className="h-3 w-3" />
                                          Google 地圖
                                        </a>
                                      )}
                                      {it.type === 'food' && it.ja && (
                                        <a
                                          href={gsearch(`${it.ja} ${city.jaName} 食べログ`)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 font-medium text-zinc-500 hover:text-zinc-950 transition-colors"
                                        >
                                          <ExternalLink className="h-3 w-3" />
                                          Tabelog 評價
                                        </a>
                                      )}
                                      {it.type === 'spot' && it.tags && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setSwapTarget(
                                              isSwapping ? null : { dayIndex: di, itemIndex: ii }
                                            )
                                          }
                                          className={`inline-flex items-center gap-1 font-medium transition-colors cursor-pointer ${
                                            isSwapping
                                              ? 'text-[#D93829]'
                                              : 'text-zinc-500 hover:text-zinc-950'
                                          }`}
                                        >
                                          <Shuffle className="h-3 w-3" />
                                          {isSwapping ? '收起替換' : '替換景點'}
                                        </button>
                                      )}
                                      {it.type !== 'move' && (
                                        <button
                                          type="button"
                                          onClick={() => handleDeleteItem(di, ii)}
                                          className="inline-flex items-center gap-1 font-medium text-zinc-400 hover:text-red-600 transition-colors cursor-pointer"
                                        >
                                          <Trash2 className="h-3 w-3" />
                                          刪除
                                        </button>
                                      )}
                                    </div>

                                    {/* Interactive Swap Picker Drawer */}
                                    {isSwapping && (
                                      <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3 no-print">
                                        <div className="flex items-center justify-between mb-2">
                                          <span className="text-xs font-semibold text-zinc-800">
                                            選擇{city.shortName}鄰近替代景點
                                          </span>
                                          <button
                                            type="button"
                                            onClick={() => setSwapTarget(null)}
                                            className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                                          >
                                            <X className="h-3.5 w-3.5" />
                                          </button>
                                        </div>
                                        {swapCandidates.length === 0 ? (
                                          <p className="text-xs text-zinc-500">
                                            此城市沒有其他未排入的景點可替換了。
                                          </p>
                                        ) : (
                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                                            {swapCandidates.map((cand, cIdx) => (
                                              <button
                                                key={cand.n}
                                                type="button"
                                                onClick={() => handleConfirmSwap(cIdx)}
                                                className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2 text-left text-xs hover:border-zinc-900 transition-colors cursor-pointer"
                                              >
                                                <div className="font-semibold text-zinc-900 truncate">
                                                  {cand.n}
                                                </div>
                                                <div className="text-[11px] text-zinc-500 mt-0.5">
                                                  {cand.a} · {cand.d} 小時 · {cand.fee ? yen(cand.fee) : '免費'}
                                                </div>
                                              </button>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          {/* Add Custom Activity to Day */}
                          <div className="mt-4 pt-3 border-t border-zinc-100 no-print">
                            {addTargetDay === di ? (
                              <form
                                onSubmit={handleAddCustomItem}
                                className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 space-y-2.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-zinc-800">
                                    新增自訂行程至 Day {di + 1}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setAddTargetDay(null)}
                                    className="text-zinc-400 hover:text-zinc-700 cursor-pointer"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="grid grid-cols-[100px_1fr] gap-2">
                                  <input
                                    type="time"
                                    value={customTime}
                                    onChange={(e) => setCustomTime(e.target.value)}
                                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2 text-xs font-mono-num"
                                  />
                                  <input
                                    type="text"
                                    placeholder="行程名稱（如：飯店 Check-in、預約咖啡廳）"
                                    value={customName}
                                    onChange={(e) => setCustomName(e.target.value)}
                                    required
                                    className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs"
                                  />
                                </div>
                                <div className="flex gap-2">
                                  <input
                                    type="text"
                                    placeholder="備註（選填）"
                                    value={customNote}
                                    onChange={(e) => setCustomNote(e.target.value)}
                                    className="h-9 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs"
                                  />
                                  <button
                                    type="submit"
                                    className="h-9 rounded-lg bg-zinc-900 px-3.5 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
                                  >
                                    加入
                                  </button>
                                </div>
                              </form>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setAddTargetDay(di)}
                                className="inline-flex items-center gap-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-950 transition-colors cursor-pointer"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                加入自訂項目或備忘
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
