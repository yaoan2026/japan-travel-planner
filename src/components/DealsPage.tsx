import React, { useMemo, useState } from 'react';
import { ExternalLink, Search } from 'lucide-react';
import { DEALS, PASSES } from '../data/japanData';

export const DealsPage: React.FC = () => {
  const [cat, setCat] = useState('全部');
  const [query, setQuery] = useState('');

  const categories = useMemo(() => ['全部', ...new Set(DEALS.map((d) => d.cat))], []);

  const filteredDeals = useMemo(() => {
    const q = query.trim().toLowerCase();
    return DEALS.filter((d) => {
      const matchCat = cat === '全部' || d.cat === cat;
      const matchQuery =
        !q || d.title.toLowerCase().includes(q) || d.desc.toLowerCase().includes(q) || d.tag.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [cat, query]);

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-6 sm:py-8 space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-wider text-[#D93829] mb-1">聰明消費</p>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-950">外國旅客優惠與退稅情報</h1>
        <p className="mt-1 text-sm text-zinc-500">
          2026 年退稅新制重點、藥妝家電優惠券、交通票券與旅遊平台折扣彙整。
        </p>
      </div>

      {/* Category & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCat(c)}
              className={`min-h-[36px] shrink-0 rounded-lg px-3.5 py-1.5 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                cat === c
                  ? 'bg-zinc-900 text-white'
                  : 'border border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50'
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="搜尋優惠關鍵字…"
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-zinc-900 focus:outline-none"
          />
        </div>
      </div>

      {/* Deals Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredDeals.map((d) => (
          <article
            key={d.title}
            className="flex flex-col justify-between rounded-2xl border border-zinc-200 bg-white p-5 transition-colors hover:border-zinc-300"
          >
            <div>
              <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1.5">
                <span>{d.cat}</span>
                <span aria-hidden="true">·</span>
                <span className="font-medium text-[#D93829]">{d.tag}</span>
              </div>
              <h2 className="text-base font-bold text-zinc-950">
                {d.icon} {d.title}
              </h2>
              <p className="mt-2 text-xs sm:text-sm text-zinc-600 leading-relaxed">{d.desc}</p>
            </div>
            <div className="mt-4 pt-3 border-t border-zinc-100">
              <a
                href={d.link}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 hover:text-[#D93829] transition-colors"
              >
                前往查看詳情
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </article>
        ))}
      </div>

      {/* Passes Strip */}
      <section className="space-y-3 pt-2">
        <h2 className="text-base font-bold text-zinc-950">熱門交通票券一覽</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {PASSES.slice(0, 6).map((p) => (
            <div key={p.name} className="rounded-2xl border border-zinc-200 bg-white p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 text-xs text-zinc-500 mb-1">
                  <span>{p.region}</span>
                  <span className="font-mono-num font-bold text-[#D93829]">{p.price}</span>
                </div>
                <h3 className="text-sm font-bold text-zinc-950">{p.name}</h3>
                <p className="mt-1.5 text-xs text-zinc-600 leading-relaxed">{p.desc}</p>
              </div>
              <a
                href={p.link}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-zinc-800 hover:text-[#D93829]"
              >
                官方網站 <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          ))}
        </div>
      </section>

      <p className="text-center text-xs text-zinc-400 pt-2">
        優惠內容與適用門檻可能隨時變動，使用前請以各店家與官方網站公告為準。
      </p>
    </div>
  );
};
