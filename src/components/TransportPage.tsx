import React from 'react';
import { ExternalLink, Train } from 'lucide-react';
import { APPS, CITIES, CITY_REGION, IC_CARDS, INTERCITY, PASSES } from '../data/japanData';
import { CityId } from '../types/trip';

interface TransportPageProps {
  selectedCity: 'all' | CityId;
  onSelectCity: (city: 'all' | CityId) => void;
}

const NATIONWIDE_ROUTES = [
  'osaka-tokyo',
  'kyoto-tokyo',
  'kyoto-osaka',
  'nara-osaka',
  'kyoto-nara',
  'fukuoka-osaka',
  'sapporo-tokyo',
  'okinawa-tokyo',
  'fukuoka-tokyo',
];

export const TransportPage: React.FC<TransportPageProps> = ({ selectedCity, onSelectCity }) => {
  const cityInfo = selectedCity === 'all' ? null : CITIES[selectedCity];
  const passes =
    selectedCity === 'all'
      ? PASSES.filter((p) => p.region === '全國')
      : PASSES.filter((p) => p.region === CITY_REGION[selectedCity]);

  const cityRoutes =
    selectedCity === 'all'
      ? []
      : Object.entries(INTERCITY).filter(([k]) => k.split('-').includes(selectedCity));

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-[#D93829] mb-1">移動與票券</p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">全日本交通攻略</h1>
        <p className="mt-1 text-sm text-zinc-500">
          機場聯外交通、新幹線跨城時刻票價、IC 交通卡與各地超值周遊券總整理。
        </p>
      </div>

      {/* City Selector */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
        <button
          type="button"
          onClick={() => onSelectCity('all')}
          className={`min-h-[38px] shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
            selectedCity === 'all'
              ? 'bg-zinc-900 text-white'
              : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
          }`}
        >
          全日本總覽
        </button>
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

      {selectedCity === 'all' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          {/* Left Column */}
          <div className="space-y-6">
            {/* IC Cards */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-zinc-950 mb-4">IC 交通卡與感應支付</h2>
              <div className="divide-y divide-zinc-100">
                {IC_CARDS.map((card) => (
                  <div key={card.name} className="py-3 first:pt-0 last:pb-0">
                    <h3 className="text-sm font-semibold text-zinc-900">{card.name}</h3>
                    <p className="mt-1 text-xs sm:text-sm text-zinc-600 leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Recommended Apps */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-zinc-950 mb-4">必備交通與旅行 App</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {APPS.map((app) => (
                  <div key={app.name} className="rounded-xl border border-zinc-100 bg-zinc-50/70 p-3.5">
                    <div className="text-sm font-semibold text-zinc-900">{app.name}</div>
                    <p className="mt-1 text-xs text-zinc-500 leading-relaxed">{app.desc}</p>
                  </div>
                ))}
              </div>
            </section>

            {/* Etiquette */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-zinc-950 mb-3">日本搭車禮儀備忘</h2>
              <ul className="space-y-2 text-xs sm:text-sm text-zinc-600 list-disc list-inside">
                <li>手扶梯：東京靠左站、大阪靠右站（近年各地積極宣導兩側站立不行走）。</li>
                <li>車廂內請將手機調至靜音模式，並避免於車廂內通話。</li>
                <li>月台依地上標示排隊，遵守先下後上原則。</li>
                <li>平日早高峰部分列車設有女性專用車廂，乘車前留意車門標示。</li>
                <li>攜帶大型行李（三邊合計 160–250cm）搭乘新幹線須事先預約「特大行李放置處座位」。</li>
              </ul>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Intercity Routes */}
            <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
              <h2 className="text-base font-bold text-zinc-950 mb-4">主要城市間移動參考</h2>
              <div className="divide-y divide-zinc-100">
                {NATIONWIDE_ROUTES.map((key) => {
                  const r = INTERCITY[key];
                  const [a, b] = key.split('-').map((c) => CITIES[c as CityId].shortName);
                  return (
                    <div key={key} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                      <div>
                        <div className="text-sm font-semibold text-zinc-900">
                          {a} ⇄ {b}
                        </div>
                        <div className="text-xs text-zinc-500 mt-0.5">
                          {r.mode} · {r.time}
                        </div>
                      </div>
                      <div className="font-mono-num text-sm font-bold text-[#D93829] whitespace-nowrap">
                        {r.price}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Nationwide Passes */}
            <section className="space-y-3">
              <h2 className="text-base font-bold text-zinc-950 px-1">全國性票券</h2>
              {passes.map((p) => (
                <div key={p.name} className="rounded-2xl border border-zinc-200 bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-xs font-medium text-zinc-500">{p.region}</span>
                      <h3 className="text-base font-bold text-zinc-950 mt-0.5">{p.name}</h3>
                    </div>
                    <span className="font-mono-num text-xs font-bold text-[#D93829] text-right shrink-0">
                      {p.price}
                    </span>
                  </div>
                  <p className="mt-2 text-xs sm:text-sm text-zinc-600 leading-relaxed">{p.desc}</p>
                  <a
                    href={p.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 hover:text-[#D93829] transition-colors"
                  >
                    前往官方網站
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ))}
            </section>
          </div>
        </div>
      ) : (
        cityInfo && (
          <div className="space-y-6">
            {/* City Banner */}
            <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6 flex items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-2xl">
                {cityInfo.emoji}
              </div>
              <div>
                <h2 className="text-lg font-bold text-zinc-950">{cityInfo.name}</h2>
                <p className="mt-1 text-sm text-zinc-600">{cityInfo.intro}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <div className="space-y-6">
                {/* Airport Transit */}
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Train className="h-4 w-4 text-[#D93829]" />
                    <h3 className="text-base font-bold text-zinc-950">
                      機場交通 · {cityInfo.airport.name}
                    </h3>
                  </div>
                  <ul className="space-y-2 text-xs sm:text-sm text-zinc-600 list-disc list-inside">
                    {cityInfo.airport.ways.map((w, i) => (
                      <li key={i} className="leading-relaxed">
                        {w}
                      </li>
                    ))}
                  </ul>
                </section>

                {/* Urban Transit */}
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                  <h3 className="text-base font-bold text-zinc-950 mb-3">市內移動須知</h3>
                  <ul className="space-y-2 text-xs sm:text-sm text-zinc-600 list-disc list-inside">
                    {cityInfo.transit.map((w, i) => (
                      <li key={i} className="leading-relaxed">
                        {w}
                      </li>
                    ))}
                  </ul>
                </section>
              </div>

              <div className="space-y-6">
                {/* Regional Passes */}
                {passes.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-base font-bold text-zinc-950 px-1">推薦地區票券</h3>
                    {passes.map((p) => (
                      <div key={p.name} className="rounded-2xl border border-zinc-200 bg-white p-5">
                        <div className="flex items-start justify-between gap-3">
                          <h4 className="text-sm font-bold text-zinc-950">{p.name}</h4>
                          <span className="font-mono-num text-xs font-bold text-[#D93829] shrink-0">
                            {p.price}
                          </span>
                        </div>
                        <p className="mt-2 text-xs sm:text-sm text-zinc-600 leading-relaxed">{p.desc}</p>
                        <a
                          href={p.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 hover:text-[#D93829] transition-colors"
                        >
                          官方資訊
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    ))}
                  </section>
                )}

                {/* Outbound Intercity */}
                <section className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
                  <h3 className="text-base font-bold text-zinc-950 mb-3">前往其他城市</h3>
                  <div className="divide-y divide-zinc-100">
                    {cityRoutes.map(([k, r]) => {
                      const other = k.split('-').find((x) => x !== selectedCity) as CityId;
                      return (
                        <div key={k} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-zinc-900">
                              → {CITIES[other].shortName}
                            </div>
                            <div className="text-xs text-zinc-500 mt-0.5">
                              {r.mode} · {r.time}
                            </div>
                          </div>
                          <span className="font-mono-num text-xs font-bold text-[#D93829] whitespace-nowrap">
                            {r.price}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </section>
              </div>
            </div>
          </div>
        )
      )}
    </div>
  );
};
