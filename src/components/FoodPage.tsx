import React, { useMemo, useState } from 'react';
import { ExternalLink, MapPin, Search } from 'lucide-react';
import { CITIES } from '../data/japanData';
import { CityId, MealKind } from '../types/trip';
import { gmap, gsearch } from '../utils/tripEngine';

interface FoodPageProps {
  selectedCity: CityId;
  onSelectCity: (city: CityId) => void;
}

const MEAL_FILTERS: { id: 'all' | MealKind; label: string }[] = [
  { id: 'all', label: '全部料理' },
  { id: 'lunch', label: '午間推薦' },
  { id: 'dinner', label: '晚餐必吃' },
  { id: 'snack', label: '點心小吃' },
];

export const FoodPage: React.FC<FoodPageProps> = ({ selectedCity, onSelectCity }) => {
  const [query, setQuery] = useState('');
  const [mealFilter, setMealFilter] = useState<'all' | MealKind>('all');

  const city = CITIES[selectedCity];

  const filteredFoods = useMemo(() => {
    return city.foods.filter((f) => {
      const matchMeal = mealFilter === 'all' || f.m === mealFilter || (mealFilter !== 'snack' && f.m === 'any');
      const q = query.trim().toLowerCase();
      const matchQuery =
        !q ||
        f.n.toLowerCase().includes(q) ||
        f.ja.toLowerCase().includes(q) ||
        f.shops.toLowerCase().includes(q) ||
        f.a.toLowerCase().includes(q);
      return matchMeal && matchQuery;
    });
  }, [city.foods, mealFilter, query]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-[#D93829] mb-1">在地味覺</p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">日本必吃美食指南</h1>
        <p className="mt-1 text-sm text-zinc-500">
          精選七大地區經典料理與口碑名店，支援一鍵開啟 Google 地圖與 Tabelog 評分搜尋。
        </p>
      </div>

      {/* City Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {(Object.keys(CITIES) as CityId[]).map((id) => {
          const active = selectedCity === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelectCity(id)}
              className={`min-h-[38px] shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                active
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {CITIES[id].emoji} {CITIES[id].shortName}
            </button>
          );
        })}
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg bg-zinc-100 p-1 w-fit">
          {MEAL_FILTERS.map((mf) => (
            <button
              key={mf.id}
              type="button"
              onClick={() => setMealFilter(mf.id)}
              className={`min-h-[34px] rounded-md px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                mealFilter === mf.id
                  ? 'bg-white text-zinc-950 shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900'
              }`}
            >
              {mf.label}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`搜尋${city.shortName}料理或名店…`}
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Food Grid */}
      {filteredFoods.length === 0 ? (
        <div className="rounded-2xl border border-zinc-200 bg-white p-10 text-center">
          <p className="text-sm font-medium text-zinc-700">找不到符合「{query}」的料理</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setMealFilter('all');
            }}
            className="mt-3 text-xs font-semibold text-[#D93829] hover:underline cursor-pointer"
          >
            重設篩選條件
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredFoods.map((f) => (
            <article
              key={f.n}
              className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300"
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-base font-bold text-zinc-950">{f.n}</h2>
                    <div className="mt-0.5 text-xs text-zinc-500">
                      {f.ja} · {f.a}
                    </div>
                  </div>
                  <span className="font-mono-num text-xs font-bold text-[#D93829] shrink-0">
                    {f.price}
                  </span>
                </div>

                <p className="mt-3 text-xs sm:text-sm text-zinc-600 leading-relaxed">{f.desc}</p>
                <p className="mt-2.5 text-xs text-zinc-500">
                  <span className="font-semibold text-zinc-800">代表名店：</span>
                  {f.shops}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-zinc-100 flex items-center gap-4 text-xs">
                <a
                  href={gmap(`${f.ja} ${city.jaName}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-zinc-700 hover:text-zinc-950"
                >
                  <MapPin className="h-3.5 w-3.5" />
                  附近店家
                </a>
                <a
                  href={gsearch(`${f.ja} ${city.jaName} 食べログ ランキング`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-semibold text-zinc-700 hover:text-[#D93829]"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Tabelog 排行
                </a>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Dining Etiquette */}
      <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
        <h3 className="text-base font-bold text-zinc-950 mb-3">日本用餐小知識</h3>
        <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-2 text-xs sm:text-sm text-zinc-600 list-disc list-inside">
          <li>拉麵、牛丼店多使用「食券機」先付款取票再入座，部分老店僅收現金。</li>
          <li>日本不需支付小費；居酒屋通常會收「お通し」開胃小菜費（約 ¥300–500）。</li>
          <li>熱門餐廳建議提前透過 Tabelog、TableCheck 或 Google 地圖訂位。</li>
          <li>多數商店街與神社周邊禁止邊走邊吃，請於店門口或指定區域食用完畢。</li>
        </ul>
      </section>
    </div>
  );
};
