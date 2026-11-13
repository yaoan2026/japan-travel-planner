import React, { useEffect, useMemo, useState } from 'react';
import { Phone, Plus, RefreshCw, RotateCcw, Search, Volume2 } from 'lucide-react';
import { CHECKLIST, CITIES, EMERGENCY, PHRASES } from '../data/japanData';
import { CityId } from '../types/trip';
import { fmtDate, LS, yen } from '../utils/tripEngine';

interface ToolsPageProps {
  rate: number;
  onChangeRate: (r: number) => void;
  defaultCity: CityId;
  focusTool?: string | null;
  onNotify: (msg: string) => void;
}

interface WeatherDay {
  date: string;
  code: number;
  max: number;
  min: number;
  pop: number | null;
}

function weatherBadge(c: number): [string, string] {
  if (c === 0) return ['☀️', '晴朗'];
  if (c <= 2) return ['🌤️', '晴時多雲'];
  if (c === 3) return ['☁️', '陰天'];
  if (c <= 48) return ['🌫️', '有霧'];
  if (c <= 57) return ['🌦️', '毛毛雨'];
  if (c <= 67) return ['🌧️', '降雨'];
  if (c <= 77) return ['❄️', '降雪'];
  if (c <= 82) return ['🌧️', '陣雨'];
  if (c <= 86) return ['🌨️', '陣雪'];
  return ['⛈️', '雷雨'];
}

function wwoToWmo(code: number): number {
  if (code === 113) return 0;
  if (code === 116) return 1;
  if (code === 119 || code === 122) return 3;
  if ([143, 248, 260].includes(code)) return 45;
  if ([200, 386, 389, 392, 395].includes(code)) return 95;
  if ([179, 227, 230, 323, 326, 329, 332, 335, 338, 368, 371].includes(code)) return 71;
  if ([176, 263, 266, 281, 293, 296, 353].includes(code)) return 51;
  return 61;
}

async function fetchJsonWithTimeout(url: string, ms = 6000) {
  const ctrl = new AbortController();
  const timer = window.setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

export const ToolsPage: React.FC<ToolsPageProps> = ({
  rate,
  onChangeRate,
  defaultCity,
  focusTool,
  onNotify,
}) => {
  // FX state
  const [jpyVal, setJpyVal] = useState<string>('1000');
  const [twdVal, setTwdVal] = useState<string>(() => Math.round(1000 * rate).toString());
  const [fxStatus, setFxStatus] = useState<string>('參考匯率已載入');
  const [fxLoading, setFxLoading] = useState(false);

  // Weather state
  const [weatherCity, setWeatherCity] = useState<CityId>(() =>
    defaultCity in CITIES ? defaultCity : 'tokyo'
  );
  const [weatherDays, setWeatherDays] = useState<WeatherDay[]>([]);
  const [weatherSource, setWeatherSource] = useState<string>('Open-Meteo（日本時間）');
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState(false);

  // Phrasebook state
  const [phraseQuery, setPhraseQuery] = useState('');
  const [phraseCat, setPhraseCat] = useState('全部');
  const [speakingJa, setSpeakingJa] = useState<string | null>(null);

  // Checklist state
  const [customItems, setCustomItems] = useState<string[]>(() => LS.get('customChecklist', []));
  const [doneItems, setDoneItems] = useState<string[]>(() => {
    const legacy = LS.get<(number | string)[]>('checklist', []);
    // Migrate legacy index-based checklist safely
    return legacy.map((x) => (typeof x === 'number' ? CHECKLIST[x] : x)).filter(Boolean) as string[];
  });
  const [newCheckItem, setNewCheckItem] = useState('');

  useEffect(() => {
    if (focusTool) {
      const el = document.getElementById(`tool-${focusTool}`);
      el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [focusTool]);

  const fetchFx = async () => {
    setFxLoading(true);
    setFxStatus('更新匯率中…');
    try {
      const res = await fetch('https://open.er-api.com/v6/latest/JPY');
      const j = await res.json();
      const r = j?.rates?.TWD;
      if (!r) throw new Error('no rate');
      onChangeRate(r);
      LS.set('fxTime', Date.now());
      setTwdVal(Math.round((Number(jpyVal) || 0) * r).toString());
      setFxStatus(`市場參考匯率 · 更新於 ${new Date().toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' })}`);
    } catch {
      setFxStatus('無法取得即時匯率，可手動輸入調整');
    } finally {
      setFxLoading(false);
    }
  };

  useEffect(() => {
    const lastFetch = LS.get<number>('fxTime', 0);
    if (Date.now() - lastFetch > 6 * 3600e3) {
      fetchFx();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadWeather = async (cid: CityId) => {
    const c = CITIES[cid] || CITIES.tokyo;
    const cacheKey = `weather_${cid}`;
    const cached = LS.get<{ ts: number; source: string; days: WeatherDay[] } | null>(cacheKey, null);
    if (cached?.days?.length && Date.now() - cached.ts < 30 * 60 * 1000) {
      setWeatherDays(cached.days);
      setWeatherSource(cached.source);
      setWeatherError(false);
      setWeatherLoading(false);
      return;
    }

    setWeatherLoading(true);
    setWeatherError(false);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo`;
      const j = await fetchJsonWithTimeout(url, 6000);
      const d = j?.daily;
      if (!Array.isArray(d?.time) || !d.time.length) throw new Error('Invalid Open-Meteo data');
      const nextDays: WeatherDay[] = d.time.map((t: string, i: number) => ({
        date: t,
        code: d.weathercode[i],
        max: d.temperature_2m_max[i],
        min: d.temperature_2m_min[i],
        pop: d.precipitation_probability_max[i] ?? null,
      }));
      setWeatherDays(nextDays);
      setWeatherSource('Open-Meteo（日本時間）');
      LS.set(cacheKey, { ts: Date.now(), source: 'Open-Meteo（日本時間）', days: nextDays });
    } catch {
      try {
        const wttrUrl = `https://wttr.in/${c.lat},${c.lng}?format=j1`;
        const w = await fetchJsonWithTimeout(wttrUrl, 6000);
        if (!Array.isArray(w?.weather) || !w.weather.length) throw new Error('Invalid wttr data');
        const nextDays: WeatherDay[] = w.weather.map((item: {
          date: string;
          maxtempC: string;
          mintempC: string;
          hourly?: Array<{ weatherCode?: string; chanceofrain?: string }>;
        }) => {
          const mid = item.hourly?.[4] || item.hourly?.[0] || {};
          return {
            date: item.date,
            code: wwoToWmo(Number(mid.weatherCode) || 116),
            max: Number(item.maxtempC) || 0,
            min: Number(item.mintempC) || 0,
            pop: mid.chanceofrain != null ? Number(mid.chanceofrain) : null,
          };
        });
        setWeatherDays(nextDays);
        setWeatherSource('wttr.in（即時備援預報）');
        LS.set(cacheKey, { ts: Date.now(), source: 'wttr.in（即時備援預報）', days: nextDays });
      } catch {
        if (cached?.days?.length) {
          setWeatherDays(cached.days);
          setWeatherSource(`${cached.source} · 離線快取`);
        } else {
          setWeatherError(true);
        }
      }
    } finally {
      setWeatherLoading(false);
    }
  };

  useEffect(() => {
    loadWeather(weatherCity);
  }, [weatherCity]);

  const handleJpyChange = (v: string) => {
    setJpyVal(v);
    const num = Number(v);
    setTwdVal(Number.isFinite(num) && v !== '' ? Math.round(num * rate).toString() : '');
  };

  const handleTwdChange = (v: string) => {
    setTwdVal(v);
    const num = Number(v);
    setJpyVal(Number.isFinite(num) && v !== '' && rate > 0 ? Math.round(num / rate).toString() : '');
  };

  const handleRateOverride = (v: string) => {
    const r = Number(v);
    if (r > 0) {
      onChangeRate(r);
      setTwdVal(Math.round((Number(jpyVal) || 0) * r).toString());
    }
  };

  const speakPhrase = (ja: string) => {
    if (!('speechSynthesis' in window)) {
      onNotify('此瀏覽器不支援語音朗讀');
      return;
    }
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(ja);
    u.lang = 'ja-JP';
    u.rate = 0.9;
    const voice = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('ja'));
    if (voice) u.voice = voice;
    setSpeakingJa(ja);
    u.onend = () => setSpeakingJa(null);
    u.onerror = () => setSpeakingJa(null);
    speechSynthesis.speak(u);
  };

  const phraseCategories = useMemo(() => ['全部', ...new Set(PHRASES.map((p) => p.cat))], []);
  const filteredPhrases = useMemo(() => {
    const q = phraseQuery.trim().toLowerCase();
    return PHRASES.filter((p) => {
      const okCat = phraseCat === '全部' || p.cat === phraseCat;
      const okQ = !q || p.zh.includes(q) || p.ja.includes(q) || p.ro.toLowerCase().includes(q);
      return okCat && okQ;
    });
  }, [phraseCat, phraseQuery]);

  const allChecklist = useMemo(() => [...CHECKLIST, ...customItems], [customItems]);
  const doneSet = useMemo(() => new Set(doneItems), [doneItems]);

  const toggleCheck = (item: string) => {
    const next = doneSet.has(item)
      ? doneItems.filter((x) => x !== item)
      : [...doneItems, item];
    setDoneItems(next);
    LS.set('checklist', next);
  };

  const addCustomCheck = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newCheckItem.trim();
    if (!trimmed || allChecklist.includes(trimmed)) return;
    const nextCustom = [...customItems, trimmed];
    setCustomItems(nextCustom);
    LS.set('customChecklist', nextCustom);
    setNewCheckItem('');
  };

  const resetChecklist = () => {
    setDoneItems([]);
    LS.set('checklist', []);
    onNotify('已重置行前清單勾選狀態');
  };

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-[#D93829] mb-1">旅途支援</p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">隨身旅行工具箱</h1>
        <p className="mt-1 text-sm text-zinc-500">
          即時匯率試算、7 日天氣預報、日語語音對話、緊急求助電話與行前準備清單。
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Left Column */}
        <div className="space-y-6 min-w-0">
          {/* Currency Converter */}
          <section id="tool-fx" className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950">即時匯率換算</h2>
                <p className="text-xs text-zinc-500 mt-0.5">{fxStatus}</p>
              </div>
              <button
                type="button"
                onClick={fetchFx}
                disabled={fxLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${fxLoading ? 'animate-spin' : ''}`} />
                更新
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">日幣 (JPY)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-num text-xs font-bold text-zinc-400">
                    ¥
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={jpyVal}
                    onChange={(e) => handleJpyChange(e.target.value)}
                    className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 pl-7 pr-3 font-mono-num text-base font-bold text-zinc-950 focus:border-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-zinc-500 mb-1.5">新台幣 (TWD)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-mono-num text-xs font-bold text-zinc-400">
                    NT$
                  </span>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={twdVal}
                    onChange={(e) => handleTwdChange(e.target.value)}
                    className="h-11 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 pl-10 pr-3 font-mono-num text-base font-bold text-zinc-950 focus:border-zinc-900 focus:bg-white focus:outline-none"
                  />
                </div>
              </div>
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
              <span>參考匯率：1 JPY =</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  step="0.0001"
                  value={rate.toFixed(4)}
                  onChange={(e) => handleRateOverride(e.target.value)}
                  className="h-8 w-24 rounded-md border border-zinc-200 px-2 text-center font-mono-num text-xs font-semibold text-zinc-900"
                />
                <span>TWD</span>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[500, 1000, 3000, 5000, 10000, 30000].map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => handleJpyChange(String(v))}
                  className="rounded-lg border border-zinc-200 bg-zinc-50/70 px-2.5 py-2 text-center hover:border-zinc-400 hover:bg-white transition-colors cursor-pointer"
                >
                  <div className="font-mono-num text-xs font-bold text-zinc-900">{yen(v)}</div>
                  <div className="font-mono-num text-[11px] text-zinc-500 mt-0.5">
                    NT${Math.round(v * rate).toLocaleString()}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Weather */}
          <section id="tool-weather" className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h2 className="text-base font-bold text-zinc-950">7 天天氣預報</h2>
                <p className="text-xs text-zinc-500 mt-0.5">資料來源 {weatherSource}</p>
              </div>
              <select
                aria-label="選擇天氣城市"
                value={weatherCity}
                onChange={(e) => setWeatherCity(e.target.value as CityId)}
                className="h-9 rounded-lg border border-zinc-200 bg-white px-2.5 text-xs font-semibold text-zinc-900"
              >
                {(Object.keys(CITIES) as CityId[]).map((id) => (
                  <option key={id} value={id}>
                    {CITIES[id].emoji} {CITIES[id].shortName}
                  </option>
                ))}
              </select>
            </div>

            {weatherLoading ? (
              <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                {Array.from({ length: 7 }).map((_, i) => (
                  <div key={i} className="h-24 rounded-xl bg-zinc-100 animate-pulse" />
                ))}
              </div>
            ) : weatherError ? (
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-center">
                <p className="text-xs text-zinc-600">無法取得天氣資料，請確認網路連線。</p>
                <button
                  type="button"
                  onClick={() => loadWeather(weatherCity)}
                  className="mt-2 text-xs font-semibold text-[#D93829] hover:underline cursor-pointer"
                >
                  重新載入
                </button>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                {weatherDays.map((d) => {
                  const [ic, label] = weatherBadge(d.code);
                  return (
                    <div
                      key={d.date}
                      className="min-w-[82px] flex-1 rounded-xl border border-zinc-200 bg-zinc-50/70 p-2.5 text-center"
                    >
                      <div className="text-[11px] font-medium text-zinc-500 tabular-nums">
                        {fmtDate(d.date).replace(/（(.)）/, ' $1')}
                      </div>
                      <div className="my-1.5 text-2xl">{ic}</div>
                      <div className="text-[11px] text-zinc-600">{label}</div>
                      <div className="mt-1 font-mono-num text-xs font-bold text-zinc-950">
                        {Math.round(d.max)}°
                        <span className="font-normal text-zinc-400"> / {Math.round(d.min)}°</span>
                      </div>
                      <div className="mt-0.5 font-mono-num text-[11px] text-zinc-500">
                        {d.pop ?? '-'}% 降雨
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* Emergency SOS */}
          <section id="tool-sos" className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <h2 className="text-base font-bold text-zinc-950 mb-1">緊急聯絡電話</h2>
            <p className="text-xs text-zinc-500 mb-4">點擊電話號碼可直接撥打求助</p>
            <div className="divide-y divide-zinc-100">
              {EMERGENCY.map((s) => (
                <div key={s.name} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-zinc-900">{s.name}</div>
                    <div className="text-xs text-zinc-500 mt-0.5">{s.desc}</div>
                  </div>
                  <a
                    href={`tel:${s.tel.replace(/-/g, '')}`}
                    className="inline-flex min-h-[38px] shrink-0 items-center gap-1.5 rounded-lg bg-[#D93829] px-3 py-1.5 font-mono-num text-xs font-bold text-white hover:bg-[#b92b1e] transition-colors"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    {s.tel}
                  </a>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="space-y-6 min-w-0">
          {/* Japanese Phrases */}
          <section id="tool-phrase" className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="mb-4">
              <h2 className="text-base font-bold text-zinc-950">實用日語發音卡</h2>
              <p className="text-xs text-zinc-500 mt-0.5">點擊任一句子即可透過語音朗讀日文發音</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 mb-4">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
                <input
                  type="search"
                  value={phraseQuery}
                  onChange={(e) => setPhraseQuery(e.target.value)}
                  placeholder="搜尋中文或日文…"
                  className="h-9 w-full rounded-lg border border-zinc-200 bg-zinc-50/50 pl-8 pr-3 text-xs focus:border-zinc-900 focus:bg-white focus:outline-none"
                />
              </div>
              <div className="flex gap-1 overflow-x-auto no-scrollbar">
                {phraseCategories.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setPhraseCat(c)}
                    className={`h-9 shrink-0 rounded-lg px-2.5 text-xs font-medium cursor-pointer ${
                      phraseCat === c
                        ? 'bg-zinc-900 text-white'
                        : 'border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            <div className="divide-y divide-zinc-100 max-h-[420px] overflow-y-auto pr-1">
              {filteredPhrases.map((p) => {
                const isSpeaking = speakingJa === p.ja;
                return (
                  <button
                    key={p.ja}
                    type="button"
                    onClick={() => speakPhrase(p.ja)}
                    className={`w-full py-3 px-2 rounded-lg flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${
                      isSpeaking ? 'bg-[#D93829]/8' : 'hover:bg-zinc-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <Volume2
                          className={`h-4 w-4 shrink-0 ${
                            isSpeaking ? 'text-[#D93829]' : 'text-zinc-400'
                          }`}
                        />
                        <span className="text-sm font-bold text-zinc-950">{p.ja}</span>
                      </div>
                      <div className="ml-6 text-xs text-zinc-400 mt-0.5">{p.ro}</div>
                    </div>
                    <span className="text-xs font-medium text-zinc-600 text-right shrink-0">
                      {p.zh}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Packing Checklist */}
          <section id="tool-check" className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-base font-bold text-zinc-950">出發前檢查清單</h2>
                <p className="text-xs text-zinc-500 mt-0.5 tabular-nums">
                  已完成 {doneSet.size} / {allChecklist.length} 項
                </p>
              </div>
              {doneSet.size > 0 && (
                <button
                  type="button"
                  onClick={resetChecklist}
                  className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-900 cursor-pointer"
                >
                  <RotateCcw className="h-3 w-3" />
                  重置
                </button>
              )}
            </div>

            {/* Progress bar */}
            <div className="h-1.5 w-full rounded-full bg-zinc-100 overflow-hidden mb-4">
              <div
                className="h-full bg-[#D93829] transition-all duration-200"
                style={{
                  width: `${allChecklist.length ? Math.round((doneSet.size / allChecklist.length) * 100) : 0}%`,
                }}
              />
            </div>

            <form onSubmit={addCustomCheck} className="flex gap-2 mb-4">
              <input
                type="text"
                value={newCheckItem}
                onChange={(e) => setNewCheckItem(e.target.value)}
                placeholder="新增自訂攜帶物品…"
                className="h-9 flex-1 rounded-lg border border-zinc-200 bg-zinc-50/50 px-3 text-xs focus:border-zinc-900 focus:bg-white focus:outline-none"
              />
              <button
                type="submit"
                className="inline-flex h-9 items-center gap-1 rounded-lg bg-zinc-900 px-3 text-xs font-semibold text-white hover:bg-zinc-800 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                新增
              </button>
            </form>

            <div className="divide-y divide-zinc-100 max-h-[380px] overflow-y-auto">
              {allChecklist.map((item) => {
                const checked = doneSet.has(item);
                return (
                  <label
                    key={item}
                    className="flex items-center gap-3 py-2.5 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleCheck(item)}
                      className="h-4 w-4 rounded border-zinc-300 accent-zinc-950 cursor-pointer"
                    />
                    <span
                      className={`text-sm transition-colors ${
                        checked ? 'line-through text-zinc-400' : 'text-zinc-800'
                      }`}
                    >
                      {item}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};
