import React, { useMemo, useState } from 'react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { Minus, Plus } from 'lucide-react';
import { Trip } from '../types/trip';
import { twd, yen } from '../utils/tripEngine';

interface BudgetChartProps {
  trip: Trip;
  rate: number;
  stayPerNight: number;
  onChangeStayPerNight: (val: number) => void;
  shopPerDay: number;
  onChangeShopPerDay: (val: number) => void;
}

interface BudgetSlice {
  key: 'stay' | 'transport' | 'food' | 'shopping';
  name: string;
  value: number;
  color: string;
  hint: string;
}

export const BudgetChart: React.FC<BudgetChartProps> = ({
  trip,
  rate,
  stayPerNight,
  onChangeStayPerNight,
  shopPerDay,
  onChangeShopPerDay,
}) => {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const nights = Math.max(0, trip.opts.days - 1);
  const stayTotal = nights * stayPerNight;
  const transportTotal = trip.cost.transport;
  const foodTotal = trip.cost.food;
  const shoppingTotal = trip.opts.days * shopPerDay + trip.cost.tickets;

  const data = useMemo<BudgetSlice[]>(() => {
    return [
      {
        key: 'stay',
        name: '住宿',
        value: stayTotal,
        color: '#18181B',
        hint: nights > 0 ? `${nights} 晚 × ${yen(stayPerNight)}` : '當日來回（0 晚）',
      },
      {
        key: 'transport',
        name: '交通',
        value: transportTotal,
        color: '#D93829',
        hint: '市內移動與跨城新幹線估算',
      },
      {
        key: 'food',
        name: '餐飲',
        value: foodTotal,
        color: '#D97706',
        hint: `${trip.opts.days} 天午晚餐與咖啡點心`,
      },
      {
        key: 'shopping',
        name: '購物',
        value: shoppingTotal,
        color: '#0D9488',
        hint: `每日購物 ${yen(shopPerDay)} + 門票 ${yen(trip.cost.tickets)}`,
      },
    ];
  }, [stayTotal, transportTotal, foodTotal, shoppingTotal, nights, stayPerNight, trip.opts.days, shopPerDay, trip.cost.tickets]);

  const grandTotal = useMemo(
    () => data.reduce((sum, item) => sum + item.value, 0),
    [data]
  );

  const chartData = useMemo(
    () => data.filter((d) => d.value > 0),
    [data]
  );

  return (
    <div className="rounded-2xl border border-zinc-200 bg-white p-5 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-zinc-100">
        <div>
          <h3 className="text-base font-bold tracking-tight text-zinc-950">
            旅遊預算分類統計
          </h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            依住宿、交通、餐飲與購物四大項目視覺化預估（每位成人）
          </p>
        </div>
        <div className="text-left sm:text-right">
          <div className="font-mono-num text-lg font-bold text-zinc-950">
            {yen(grandTotal)}
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            總預算約 {twd(grandTotal, rate)}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-[240px_1fr] gap-6 items-center">
        {/* Donut Chart */}
        <div className="relative h-[220px] w-full flex items-center justify-center">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie
                data={chartData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={62}
                outerRadius={92}
                paddingAngle={2}
                strokeWidth={0}
                onMouseEnter={(_, idx) => {
                  const item = chartData[idx];
                  if (item) setActiveKey(item.key);
                }}
                onMouseLeave={() => setActiveKey(null)}
              >
                {chartData.map((entry) => (
                  <Cell
                    key={entry.key}
                    fill={entry.color}
                    opacity={activeKey && activeKey !== entry.key ? 0.45 : 1}
                    style={{ transition: 'opacity 150ms ease', cursor: 'pointer' }}
                  />
                ))}
              </Pie>
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const item = payload[0].payload as BudgetSlice;
                  const pct = grandTotal > 0 ? Math.round((item.value / grandTotal) * 100) : 0;
                  return (
                    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2 shadow-md text-xs">
                      <div className="flex items-center gap-1.5 font-bold text-zinc-950">
                        <span
                          className="inline-block h-2 w-2 rounded-full"
                          style={{ backgroundColor: item.color }}
                        />
                        <span>{item.name}</span>
                        <span className="font-mono-num text-zinc-500">({pct}%)</span>
                      </div>
                      <div className="mt-1 font-mono-num font-semibold text-zinc-900">
                        {yen(item.value)} · {twd(item.value, rate)}
                      </div>
                    </div>
                  );
                }}
              />
            </PieChart>
          </ResponsiveContainer>

          {/* Center Summary Label */}
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <span className="text-[11px] font-medium text-zinc-400">預估總額</span>
            <span className="font-mono-num text-base font-bold text-zinc-950 mt-0.5">
              {yen(grandTotal)}
            </span>
            <span className="font-mono-num text-[11px] text-zinc-500">
              {twd(grandTotal, rate)}
            </span>
          </div>
        </div>

        {/* Category Breakdown List */}
        <div className="space-y-2.5">
          {data.map((item) => {
            const pct = grandTotal > 0 ? Math.round((item.value / grandTotal) * 100) : 0;
            const isHighlighted = activeKey === item.key;
            return (
              <div
                key={item.key}
                onMouseEnter={() => setActiveKey(item.key)}
                onMouseLeave={() => setActiveKey(null)}
                className={`rounded-xl border px-3.5 py-2.5 transition-colors ${
                  isHighlighted
                    ? 'border-zinc-900 bg-zinc-50'
                    : 'border-zinc-100 bg-zinc-50/50 hover:border-zinc-200'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: item.color }}
                    />
                    <span className="text-sm font-semibold text-zinc-900">{item.name}</span>
                    <span className="hidden sm:inline text-xs text-zinc-400 truncate">
                      {item.hint}
                    </span>
                  </div>
                  <div className="flex items-baseline gap-2.5 shrink-0 font-mono-num">
                    <span className="text-sm font-bold text-zinc-950">{yen(item.value)}</span>
                    <span className="w-9 text-right text-xs font-semibold text-zinc-500">
                      {pct}%
                    </span>
                  </div>
                </div>
                <div className="mt-1.5 flex items-center justify-between gap-3">
                  <div className="h-1 flex-1 rounded-full bg-zinc-200/70 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-300"
                      style={{ width: `${pct}%`, backgroundColor: item.color }}
                    />
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono-num shrink-0">
                    約 {twd(item.value, rate)}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Adjustable Budget Parameters */}
      <div className="mt-5 pt-4 border-t border-zinc-100 grid grid-cols-1 sm:grid-cols-2 gap-3 no-print">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2.5">
          <div>
            <div className="text-xs font-semibold text-zinc-900">住宿預算 / 晚</div>
            <div className="text-[11px] text-zinc-500 tabular-nums">共 {nights} 晚</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="減少住宿預算"
              onClick={() => onChangeStayPerNight(Math.max(0, stayPerNight - 2000))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-20 text-center font-mono-num text-xs font-bold text-zinc-950">
              {yen(stayPerNight)}
            </span>
            <button
              type="button"
              aria-label="增加住宿預算"
              onClick={() => onChangeStayPerNight(Math.min(80000, stayPerNight + 2000))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 px-3.5 py-2.5">
          <div>
            <div className="text-xs font-semibold text-zinc-900">購物預算 / 天</div>
            <div className="text-[11px] text-zinc-500 tabular-nums">含免稅伴手禮預估</div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              aria-label="減少購物預算"
              onClick={() => onChangeShopPerDay(Math.max(0, shopPerDay - 1000))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 cursor-pointer"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-20 text-center font-mono-num text-xs font-bold text-zinc-950">
              {yen(shopPerDay)}
            </span>
            <button
              type="button"
              aria-label="增加購物預算"
              onClick={() => onChangeShopPerDay(Math.min(50000, shopPerDay + 1000))}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-100 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
