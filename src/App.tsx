import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DealsPage } from './components/DealsPage';
import { FoodPage } from './components/FoodPage';
import { Header } from './components/Header';
import { MapPage } from './components/MapPage';
import { PlannerPage } from './components/PlannerPage';
import { SavedTripsDrawer } from './components/SavedTripsDrawer';
import { ToolsPage } from './components/ToolsPage';
import { TransportPage } from './components/TransportPage';
import { CITIES, PACE_OPTIONS, TAGS } from './data/japanData';
import { CityId, PaceId, TabId, TagId, Trip, UserPrefs } from './types/trip';
import {
  decodeTripParam,
  encodeTripUrl,
  generateTrip,
  LS,
  ymd,
} from './utils/tripEngine';

const VALID_TABS: TabId[] = ['plan', 'transport', 'food', 'map', 'deals', 'tools'];

function getInitialTab(): TabId {
  const hash = window.location.hash.slice(1) as TabId;
  return VALID_TABS.includes(hash) ? hash : 'plan';
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return ymd(d);
}

export default function App() {
  const initialPrefs = useMemo(() => LS.get<UserPrefs | null>('prefs', null), []);

  const [activeTab, setActiveTab] = useState<TabId>(getInitialTab);
  const [cities, setCities] = useState<CityId[]>(() =>
    Array.isArray(initialPrefs?.cities)
      ? initialPrefs!.cities.filter((c) => c in CITIES)
      : []
  );
  const [startDate, setStartDate] = useState<string>(getDefaultStartDate);
  const [days, setDays] = useState<number>(() =>
    initialPrefs?.days ? Math.min(21, Math.max(1, initialPrefs.days)) : 5
  );
  const [pace, setPace] = useState<PaceId>(() =>
    initialPrefs?.pace && initialPrefs.pace in PACE_OPTIONS ? initialPrefs.pace : 'normal'
  );
  const [interests, setInterests] = useState<TagId[]>(() =>
    Array.isArray(initialPrefs?.interests)
      ? initialPrefs!.interests.filter((t) => t in TAGS)
      : ['culture', 'food']
  );

  const [trip, setTrip] = useState<Trip | null>(() => LS.get<Trip | null>('currentTrip', null));
  const [savedTrips, setSavedTrips] = useState<Trip[]>(() => LS.get<Trip[]>('trips', []));
  const [rate, setRate] = useState<number>(() => LS.get<number>('fxRate', 0.21));
  const [stayPerNight, setStayPerNight] = useState<number>(() => LS.get<number>('stayPerNight', 12000));
  const [shopPerDay, setShopPerDay] = useState<number>(() => LS.get<number>('shopPerDay', 5000));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [gmpQuotaExceeded, setGmpQuotaExceeded] = useState(false);

  const [transportCity, setTransportCity] = useState<'all' | CityId>('all');
  const [foodCity, setFoodCity] = useState<CityId>('tokyo');
  const [mapMode, setMapMode] = useState<string>('spots');
  const [focusTool, setFocusTool] = useState<string | null>(null);

  const [toast, setToast] = useState<{ msg: string; undo?: () => void } | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const showToast = useCallback((msg: string, undo?: () => void) => {
    setToast({ msg, undo });
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
    }, undo ? 4200 : 2400);
  }, []);

  // Sync user preferences
  useEffect(() => {
    LS.set('prefs', { cities, days, pace, interests });
  }, [cities, days, pace, interests]);

  // Hash navigation
  useEffect(() => {
    const onHashChange = () => {
      setActiveTab(getInitialTab());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Google Maps Platform quota-exceeded listener
  useEffect(() => {
    const handler = () => setGmpQuotaExceeded(true);
    window.addEventListener('gmp-quota-exceeded', handler);
    return () => window.removeEventListener('gmp-quota-exceeded', handler);
  }, []);

  const navigateTab = useCallback((tab: TabId, toolSection?: string) => {
    setActiveTab(tab);
    if (window.location.hash !== `#${tab}`) {
      window.location.hash = tab;
    }
    if (tab === 'tools' && toolSection) {
      setFocusTool(toolSection);
    } else {
      setFocusTool(null);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, []);

  const saveTripToList = useCallback((t: Trip) => {
    setSavedTrips((prev) => {
      const idx = prev.findIndex((x) => x.id === t.id);
      const next = [...prev];
      if (idx >= 0) next[idx] = t;
      else next.unshift(t);
      const sliced = next.slice(0, 20);
      LS.set('trips', sliced);
      return sliced;
    });
  }, []);

  // Import ?trip= URL param on load
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('trip');
    if (!code) return;
    decodeTripParam(code)
      .then((imported) => {
        if (!imported || !imported.days.length) return;
        setTrip(imported);
        LS.set('currentTrip', imported);
        saveTripToList(imported);
        if (imported.opts) {
          setCities(imported.opts.cities.filter((c) => c in CITIES));
          setDays(imported.opts.days);
          setPace(imported.opts.pace);
          setInterests(imported.opts.interests.filter((t) => t in TAGS));
        }
        window.history.replaceState({}, '', window.location.pathname + window.location.hash);
        setActiveTab('plan');
        showToast('已從專屬同步連結載入行程');
      })
      .catch(() => {
        showToast('專屬連結格式無效或已損毀');
      });
  }, [saveTripToList, showToast]);

  const handleToggleCity = (id: CityId) => {
    setCities((prev) => {
      const next = prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id];
      const rec = next.reduce((sum, c) => sum + CITIES[c].recDays, 0);
      if (rec > 0) setDays(Math.min(21, Math.max(next.length, Math.round(rec))));
      return next;
    });
  };

  const handleToggleInterest = (id: TagId) => {
    setInterests((prev) =>
      prev.includes(id) ? prev.filter((t) => t !== id) : [...prev, id]
    );
  };

  const handleGenerate = () => {
    if (!cities.length) return;
    const generated = generateTrip({
      cities: [...cities],
      start: startDate || ymd(new Date()),
      days,
      pace,
      interests: [...interests],
      seed: Date.now() % 1e9,
    });
    setTrip(generated);
    LS.set('currentTrip', generated);
    showToast('已為您編排專屬行程');
  };

  const handleApplyPreset = (
    pCities: CityId[],
    pDays: number,
    pPace: PaceId,
    pInterests: TagId[]
  ) => {
    setCities(pCities);
    setDays(pDays);
    setPace(pPace);
    setInterests(pInterests);
    const generated = generateTrip({
      cities: pCities,
      start: startDate || ymd(new Date()),
      days: pDays,
      pace: pPace,
      interests: pInterests,
      seed: Date.now() % 1e9,
    });
    setTrip(generated);
    LS.set('currentTrip', generated);
    showToast('已套用推薦行程');
  };

  const handleUpdateTrip = (nextTrip: Trip) => {
    setTrip(nextTrip);
    LS.set('currentTrip', nextTrip);
  };

  const handleSaveTrip = (t: Trip) => {
    saveTripToList(t);
    showToast('已儲存至「我的行程」');
  };

  const handleTogglePinTrip = (t: Trip) => {
    const updated: Trip = { ...t, pinned: !t.pinned };
    if (trip?.id === t.id) {
      setTrip(updated);
      LS.set('currentTrip', updated);
    }
    saveTripToList(updated);
    showToast(updated.pinned ? '已釘選至快速範本' : '已取消釘選');
  };

  const handleTogglePinById = (id: string) => {
    const target = savedTrips.find((x) => x.id === id);
    if (target) handleTogglePinTrip(target);
  };

  const handleCopyLink = async (t: Trip) => {
    try {
      const url = await encodeTripUrl(t);
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
        showToast('已複製專屬同步連結');
      } else if (navigator.share) {
        await navigator.share({ title: t.title, url });
      }
    } catch {
      showToast('無法產生同步連結');
    }
  };

  const handleRegenTrip = () => {
    if (!trip) return;
    const regenerated = generateTrip({
      ...trip.opts,
      seed: (trip.opts.seed * 7 + 13) % 1e9,
    });
    setTrip(regenerated);
    LS.set('currentTrip', regenerated);
    showToast('已重新推薦一組景點搭配');
  };

  const handleLoadTrip = (loaded: Trip) => {
    setTrip(loaded);
    LS.set('currentTrip', loaded);
    if (loaded.opts) {
      setCities(loaded.opts.cities.filter((c) => c in CITIES));
      setDays(loaded.opts.days);
      setPace(loaded.opts.pace);
      setInterests(loaded.opts.interests.filter((t) => t in TAGS));
    }
    setDrawerOpen(false);
    navigateTab('plan');
    showToast(`已載入「${loaded.title}」`);
  };

  const handleDeleteSavedTrip = (id: string) => {
    setSavedTrips((prev) => {
      const next = prev.filter((t) => t.id !== id);
      LS.set('trips', next);
      return next;
    });
    showToast('已刪除儲存的行程');
  };

  const handleImportTrips = (incoming: Trip[]) => {
    setSavedTrips((prev) => {
      const ids = new Set(prev.map((t) => t.id));
      const merged = [...prev];
      let added = 0;
      incoming.forEach((t) => {
        if (t?.id && Array.isArray(t.days) && !ids.has(t.id)) {
          merged.unshift(t);
          ids.add(t.id);
          added += 1;
        }
      });
      const sliced = merged.slice(0, 20);
      LS.set('trips', sliced);
      showToast(`已成功匯入 ${added} 筆行程`);
      return sliced;
    });
  };

  const handleRateChange = (r: number) => {
    setRate(r);
    LS.set('fxRate', r);
  };

  const handleStayPerNightChange = (val: number) => {
    setStayPerNight(val);
    LS.set('stayPerNight', val);
  };

  const handleShopPerDayChange = (val: number) => {
    setShopPerDay(val);
    LS.set('shopPerDay', val);
  };

  const pinnedTrips = useMemo(() => savedTrips.filter((t) => t.pinned), [savedTrips]);

  return (
    <div className="min-h-screen bg-[#FAFAFA] text-zinc-950 pb-20 md:pb-8">
      {gmpQuotaExceeded && (
        <div
          role="alert"
          className="sticky top-0 z-50 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 no-print"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <span>
              Google Maps API 免費額度已達上限或金鑰受限，地圖載入可能暫時受影響。請參閱{' '}
              <a
                href="https://developers.google.com/maps/ai/ai-studio?utm_campaign=gmp_mcp_codeassist_v1_aistudio#quota_exceeded_errors"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold underline hover:text-amber-800"
              >
                Google Maps 配額說明
              </a>
              。
            </span>
            <button
              type="button"
              onClick={() => setGmpQuotaExceeded(false)}
              className="shrink-0 font-semibold text-amber-800 hover:text-amber-950 cursor-pointer"
            >
              關閉
            </button>
          </div>
        </div>
      )}

      <Header
        activeTab={activeTab}
        onSelectTab={(tab) => navigateTab(tab)}
        savedCount={savedTrips.length}
        onOpenDrawer={() => setDrawerOpen(true)}
      />

      <main>
        {activeTab === 'plan' && (
          <PlannerPage
            cities={cities}
            onToggleCity={handleToggleCity}
            onClearCities={() => setCities([])}
            startDate={startDate}
            onChangeStartDate={setStartDate}
            days={days}
            onChangeDays={setDays}
            pace={pace}
            onChangePace={setPace}
            interests={interests}
            onToggleInterest={handleToggleInterest}
            trip={trip}
            pinnedTrips={pinnedTrips}
            rate={rate}
            stayPerNight={stayPerNight}
            onChangeStayPerNight={handleStayPerNightChange}
            shopPerDay={shopPerDay}
            onChangeShopPerDay={handleShopPerDayChange}
            onGenerate={handleGenerate}
            onApplyPreset={handleApplyPreset}
            onLoadPinned={handleLoadTrip}
            onUpdateTrip={handleUpdateTrip}
            onSaveTrip={handleSaveTrip}
            onTogglePin={handleTogglePinTrip}
            onCopyLink={handleCopyLink}
            onRegenTrip={handleRegenTrip}
            onOpenMapMode={(mode) => {
              setMapMode(mode);
              navigateTab('map');
            }}
            onNavigateTab={navigateTab}
            onNotify={showToast}
          />
        )}

        {activeTab === 'transport' && (
          <TransportPage selectedCity={transportCity} onSelectCity={setTransportCity} />
        )}

        {activeTab === 'food' && (
          <FoodPage selectedCity={foodCity} onSelectCity={setFoodCity} />
        )}

        {activeTab === 'map' && (
          <MapPage
            trip={trip}
            mapMode={mapMode}
            onChangeMapMode={setMapMode}
            onNotify={showToast}
          />
        )}

        {activeTab === 'deals' && <DealsPage />}

        {activeTab === 'tools' && (
          <ToolsPage
            rate={rate}
            onChangeRate={handleRateChange}
            defaultCity={trip?.days[0]?.city || 'tokyo'}
            focusTool={focusTool}
            onNotify={showToast}
          />
        )}
      </main>

      {/* Saved Trips Drawer */}
      <SavedTripsDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        trips={savedTrips}
        onLoadTrip={handleLoadTrip}
        onTogglePin={handleTogglePinById}
        onCopyLink={handleCopyLink}
        onDeleteTrip={handleDeleteSavedTrip}
        onImportTrips={handleImportTrips}
        onNotify={showToast}
      />

      {/* Minimalist Floating Toast */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-20 md:bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-xl bg-zinc-950 px-4 py-2.5 text-xs font-medium text-white shadow-lg"
        >
          <span>{toast.msg}</span>
          {toast.undo && (
            <button
              type="button"
              onClick={() => {
                const fn = toast.undo;
                setToast(null);
                fn?.();
              }}
              className="font-bold text-[#fb7185] hover:text-white transition-colors cursor-pointer"
            >
              復原
            </button>
          )}
        </div>
      )}
    </div>
  );
}
