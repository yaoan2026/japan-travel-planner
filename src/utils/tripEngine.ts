import { CITIES, INTERCITY, PACE_OPTIONS, TAGS } from '../data/japanData';
import { CityId, FoodItem, ItineraryItem, MealKind, PaceId, Spot, Trip, TripDay, TripOptions } from '../types/trip';

const TRANSFER_HOURS = 0.5;
const MEAL_COST: Record<'lunch' | 'dinner' | 'snack', number> = { lunch: 1500, dinner: 3000, snack: 600 };
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

let uidCounter = 0;
function nextItemId() {
  uidCounter += 1;
  return `it_${Date.now().toString(36)}_${uidCounter}`;
}

export const LS = {
  get<T>(k: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(k);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  },
  set(k: string, v: unknown) {
    try {
      localStorage.setItem(k, JSON.stringify(v));
    } catch {
      // Ignore storage quota errors
    }
  },
};

export function yen(n: number) {
  return '¥' + Math.round(n).toLocaleString();
}

export function twd(n: number, rate: number) {
  return 'NT$' + Math.round(n * rate).toLocaleString();
}

export function gmap(q: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

export function gsearch(q: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(q)}`;
}

export function ymd(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function parseDate(s: string) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: string, n: number) {
  const d = parseDate(s);
  d.setDate(d.getDate() + n);
  return ymd(d);
}

export function fmtDate(s: string) {
  const d = parseDate(s);
  return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`;
}

export function fmtTime(h: number) {
  const q = Math.round(h * 4) / 4;
  const hh = Math.floor(q);
  const mm = Math.round((q - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

export function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function allocateDays(cities: CityId[], days: number): number[] {
  const n = cities.length;
  if (days <= n) return cities.map((_, i) => (i < days ? 1 : 0));
  const w = cities.map((c) => CITIES[c].recDays);
  const sum = w.reduce((a, b) => a + b, 0);
  const ideal = w.map((x) => (x / sum) * days);
  const alloc = ideal.map((x) => Math.max(1, Math.floor(x)));
  let total = alloc.reduce((a, b) => a + b, 0);
  while (total < days) {
    let bi = 0;
    let bv = -Infinity;
    ideal.forEach((x, i) => {
      const v = x - alloc[i];
      if (v > bv) {
        bv = v;
        bi = i;
      }
    });
    alloc[bi]++;
    total++;
  }
  while (total > days) {
    let bi = -1;
    let bv = Infinity;
    ideal.forEach((x, i) => {
      if (alloc[i] <= 1) return;
      const v = x - alloc[i];
      if (v < bv) {
        bv = v;
        bi = i;
      }
    });
    if (bi < 0) break;
    alloc[bi]--;
    total--;
  }
  return alloc;
}

function scoreSpot(s: Spot, interests: string[]) {
  const match = s.t.filter((t) => interests.includes(t)).length;
  return s.p + match * 1.6;
}

export function getIntercity(a: CityId, b: CityId) {
  const key = [a, b].sort().join('-');
  return INTERCITY[key] || { mode: '交通移動', time: '請查詢', price: '-', h: 4, cost: 10000, tip: '' };
}

type ScoredSpot = Spot & { score: number };

function pickDay(pool: ScoredSpot[], budget: number, maxN: number, rnd: () => number): ScoredSpot[] {
  if (!pool.length || budget < 1) return [];
  const ranked = pool.map((s) => ({ s, v: s.score + rnd() * 1.8 })).sort((a, b) => b.v - a.v);
  const anchor = ranked.find((r) => r.s.d <= budget)?.s;
  if (!anchor) return [];
  const chosen: ScoredSpot[] = [anchor];
  let used = anchor.d;
  while (chosen.length < maxN) {
    let best: ScoredSpot | null = null;
    let bv = -Infinity;
    for (const s of pool) {
      if (chosen.includes(s)) continue;
      if (used + TRANSFER_HOURS + s.d > budget) continue;
      const dist = Math.min(...chosen.map((c) => km(c, s)));
      const v = s.score * 1.2 - dist * 0.7 + rnd() * 0.6;
      if (v > bv) {
        bv = v;
        best = s;
      }
    }
    if (!best) break;
    chosen.push(best);
    used += TRANSFER_HOURS + best.d;
  }
  const day = chosen.filter((s) => !s.ev);
  const night = chosen.filter((s) => s.ev);
  const ordered: ScoredSpot[] = [];
  if (day.length) {
    let cur = day.reduce((a, b) => {
      const da = day.reduce((s, x) => s + km(a, x), 0);
      const db = day.reduce((s, x) => s + km(b, x), 0);
      return db > da ? b : a;
    });
    const rest = day.filter((x) => x !== cur);
    ordered.push(cur);
    while (rest.length) {
      rest.sort((a, b) => km(cur, a) - km(cur, b));
      cur = rest.shift()!;
      ordered.push(cur);
    }
  }
  return ordered.concat(night);
}

function pickFood(city: (typeof CITIES)[CityId], near: { lat: number; lng: number } | null, kind: MealKind, used: Set<string>, rnd: () => number): FoodItem | null {
  const ok = (f: FoodItem) => f.m === kind || f.m === 'any';
  let cands = city.foods.filter((f) => !used.has(f.n) && ok(f));
  if (!cands.length) cands = city.foods.filter(ok);
  if (!cands.length) cands = city.foods;
  let best: FoodItem | null = null;
  let bv = -Infinity;
  for (const f of cands) {
    const v = (near ? -km(near, f) * 0.6 : 0) + rnd() * 2 + (used.has(f.n) ? -3 : 0);
    if (v > bv) {
      bv = v;
      best = f;
    }
  }
  if (best) used.add(best.n);
  return best;
}

function foodItem(f: FoodItem, kind: 'lunch' | 'dinner' | 'snack', t: number): ItineraryItem {
  const label = { lunch: '午餐', dinner: '晚餐', snack: '點心' }[kind];
  return {
    id: nextItemId(),
    type: 'food',
    icon: kind === 'snack' ? '🍡' : '🍴',
    time: t,
    dur: kind === 'snack' ? 0.5 : kind === 'dinner' ? 1.25 : 1,
    name: `${label}：${f.n}`,
    ja: f.ja,
    lat: f.lat,
    lng: f.lng,
    desc: f.desc,
    sub: `推薦：${f.shops} · ${f.price}`,
    kind,
    cost: MEAL_COST[kind],
  };
}

export function spotToItem(s: Spot, t: number, cityId: CityId): ItineraryItem {
  const firstTag = s.t[0];
  const tagIcon = firstTag && firstTag !== 'night' ? TAGS[firstTag]?.icon : '📍';
  return {
    id: nextItemId(),
    type: 'spot',
    icon: tagIcon || '📍',
    time: t,
    dur: s.d,
    name: s.n,
    ja: s.ja,
    lat: s.lat,
    lng: s.lng,
    desc: s.desc,
    sub: `${s.a} · 建議停留 ${s.d >= 8 ? '一整天' : `${s.d} 小時`} · ${s.fee ? yen(s.fee) : '免費'}`,
    tags: s.t,
    cost: s.fee || 0,
    city: cityId,
  };
}

function scheduleDay(
  items: ItineraryItem[],
  chosen: ScoredSpot[],
  t: number,
  city: (typeof CITIES)[CityId],
  cityId: CityId,
  used: Set<string>,
  rnd: () => number,
  pace: PaceId
) {
  let lunch = t >= 13.75;
  let dinner = false;
  let snack = pace === 'packed';
  let last: { lat: number; lng: number } = chosen[0] || city;

  for (const s of chosen) {
    if (!lunch && (t >= 11.25 || t + s.d > 13.5)) {
      const f = pickFood(city, last, 'lunch', used, rnd);
      if (f) {
        const lt = Math.max(t, 11.5);
        items.push(foodItem(f, 'lunch', lt));
        t = lt + 1;
      }
      lunch = true;
    }
    if (!dinner && t >= 17.5) {
      const f = pickFood(city, s, 'dinner', used, rnd);
      if (f) {
        items.push(foodItem(f, 'dinner', t));
        t += 1.25;
      }
      dinner = true;
    }
    if (!snack && lunch && t >= 14.5 && t <= 16.5) {
      const near = city.foods.filter((f) => f.m === 'snack' && !used.has(f.n) && km(f, last) < 3);
      if (near.length) {
        const f = near[Math.floor(rnd() * near.length)];
        used.add(f.n);
        items.push(foodItem(f, 'snack', t));
        t += 0.5;
      }
      snack = true;
    }
    items.push(spotToItem(s, t, cityId));
    t += s.d + TRANSFER_HOURS;
    last = s;
  }

  if (!lunch && t <= 15) {
    const f = pickFood(city, last, 'lunch', used, rnd);
    if (f) {
      const lt = Math.max(t, 11.5);
      items.push(foodItem(f, 'lunch', lt));
      t = lt + 1;
    }
  }
  return { t, last, dinner };
}

function buildTips(opts: TripOptions, alloc: number[], railCost: number): string[] {
  const tips: string[] = [];
  const has = (c: CityId) => opts.cities.includes(c) && alloc[opts.cities.indexOf(c)] > 0;
  const months = new Set<number>();
  for (let i = 0; i < opts.days; i++) months.add(parseDate(addDays(opts.start, i)).getMonth() + 1);
  const m = (x: number) => months.has(x);
  const s = parseDate(opts.start);
  const e = parseDate(addDays(opts.start, opts.days - 1));
  const inRange = (mm: number, d1: number, d2: number) => {
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) {
      if (d.getMonth() + 1 === mm && d.getDate() >= d1 && d.getDate() <= d2) return true;
    }
    return false;
  };

  if (inRange(3, 20, 31) || inRange(4, 1, 15)) tips.push('櫻花季期間熱門賞櫻點人潮眾多，建議提早預訂住宿與早晨出門（北海道約 4 月底–5 月初開花）。');
  if (inRange(4, 29, 30) || inRange(5, 1, 6)) tips.push('正值日本黃金週（4/29–5/5）出遊高峰，交通指定席與住宿建議提早預訂。');
  if (m(6) || inRange(7, 1, 15)) tips.push('梅雨季節建議隨身攜帶折疊傘，可適度穿插百貨或美術館等室內景點。');
  if (m(7) || m(8)) tips.push('夏季氣溫常超過 35°C，請注意防曬與水分補充；各地晚間常有花火大會與祭典。');
  if (inRange(8, 10, 16)) tips.push('日本盂蘭盆節（8 月中）返鄉潮，新幹線與高速公路較擁擠。');
  if ((m(7) || m(8) || m(9) || m(10)) && has('okinawa')) tips.push('7–10 月為沖繩颱風季，建議保留戶外行程彈性並留意航班動態。');
  if (m(10) && has('sapporo')) tips.push('北海道 10 月紅葉正盛（定山溪、大雪山），早晚偏涼建議採洋蔥式穿搭。');
  if (inRange(11, 10, 30) || inRange(12, 1, 7)) tips.push('紅葉旺季期間京都寺院常有夜間點燈特別參拜，東京銀杏大道 11 月中下旬最美。');
  if (m(12) || m(1) || m(2)) tips.push('冬季氣溫低（東京約 2–10°C；北海道零下），請備妥保暖衣物與防滑鞋履。');
  if (inRange(12, 29, 31) || inRange(1, 1, 3)) tips.push('年末年始（12/29–1/3）部分店家與景點休息，神社新年參拜人潮較多。');
  if (inRange(2, 1, 12) && has('sapporo')) tips.push('札幌雪祭通常於 2 月上旬舉辦，飯店與機票極為搶手。');
  if (inRange(12, 1, 31)) tips.push('12 月各地有冬季聖誕燈飾，表參道、六本木、神戶光之饗宴值得夜訪。');

  if (has('tokyo')) tips.push('東京地鐵轉乘頻繁可購買「Tokyo Subway Ticket」（72h ¥1,500）省下不少車資。');
  if (has('osaka')) tips.push('大阪景點集中且多含門票，可搭配「大阪周遊卡」免費暢遊大阪城、空中庭園等。');
  if (has('osaka') || has('kyoto') || has('nara')) tips.push('關西機場進出可購買「ICOCA & HARUKA」套票節省特急車資。');
  if (has('okinawa')) tips.push('沖繩大眾運輸有限，建議租車自駕（需備妥台灣駕照 + 日文譯本）。');
  if (railCost >= 45000) tips.push(`本行程新幹線跨城車資約 ${yen(railCost)}，可評估購買 JR Pass 是否划算。`);
  tips.push('2026 年 11 月起日本免稅改為「退稅制」，購物時出示護照登記，離境時於機場海關辦理退稅。');
  return tips;
}

export function generateTrip(opts: TripOptions): Trip {
  const rnd = mulberry32(opts.seed);
  const P = PACE_OPTIONS[opts.pace];
  const alloc = allocateDays(opts.cities, opts.days);
  const days: TripDay[] = [];
  const cost = { transport: 0, tickets: 0, food: 0 };
  let di = 0;
  let prev: CityId | null = null;
  let railCost = 0;

  opts.cities.forEach((cid, ci) => {
    const n = alloc[ci];
    if (!n) return;
    const city = CITIES[cid];
    const pool: ScoredSpot[] = city.spots.filter((s) => !s.full).map((s) => ({ ...s, score: scoreSpot(s, opts.interests) }));
    const fullQ = opts.interests.includes('fun') && n >= 2
      ? city.spots.filter((s) => s.full).sort((a, b) => b.p - a.p).slice(0, Math.floor(n / 2))
      : [];
    const used = new Set<string>();
    let tripIdx = 0;

    for (let k = 0; k < n; k++, di++) {
      const isFirst = di === 0;
      const isLast = di === opts.days - 1;
      const date = addDays(opts.start, di);
      const items: ItineraryItem[] = [];
      let t = 9;
      let dayEnd = 9 + P.hours;
      let travelIn = null;

      if (isFirst) {
        items.push({
          id: nextItemId(),
          type: 'move',
          icon: '✈️',
          time: 10.5,
          dur: 2,
          name: `抵達 ${city.airport.name}・前往市區`,
          desc: city.airport.ways.slice(0, 3).join('\n'),
          sub: '辦理入境（Visit Japan Web）· 領取交通卡 · 飯店寄放行李',
        });
        t = 13;
      } else if (k === 0 && prev) {
        travelIn = getIntercity(prev, cid);
        items.push({
          id: nextItemId(),
          type: 'move',
          icon: '🚄',
          time: 9,
          dur: travelIn.h,
          name: `${CITIES[prev].shortName} → ${city.shortName}`,
          desc: travelIn.tip,
          sub: `${travelIn.mode} · ${travelIn.time} · ${travelIn.price}`,
        });
        cost.transport += travelIn.cost;
        if (/新幹線|JR/.test(travelIn.mode)) railCost += travelIn.cost;
        t = 9 + travelIn.h + 0.25;
      }
      if (isLast) dayEnd = Math.min(dayEnd, 14.5);

      let summary = '';
      if (!isFirst && !isLast && !travelIn && k > 0 && fullQ.length) {
        const s = fullQ.shift()!;
        items.push(spotToItem(s, 9, cid));
        items.push({
          id: nextItemId(),
          type: 'note',
          icon: '🍔',
          time: 12.5,
          dur: 0,
          name: '園區內彈性用餐',
          desc: '樂園內餐廳中午尖峰人潮較多，建議錯開 11:00 或 14:00 用餐，或善用官方 App 行動點餐。',
        });
        cost.food += 3500;
        summary = s.n;
        const f = pickFood(city, s, 'dinner', used, rnd);
        if (f) items.push(foodItem(f, 'dinner', 20));
      } else if (!pool.length && city.dayTrips.length && !isLast) {
        const dt = city.dayTrips[tripIdx++ % city.dayTrips.length];
        items.push({
          id: nextItemId(),
          type: 'spot',
          icon: '🚞',
          time: t,
          dur: 7,
          name: `近郊一日遊：${dt.n}`,
          ja: dt.ja,
          lat: dt.lat,
          lng: dt.lng,
          desc: dt.desc,
          sub: '建議搭乘特急或預約一日遊專車',
          tags: ['nature'],
          cost: 0,
        });
        summary = dt.n;
        t += 7.5;
        const f = pickFood(city, city, 'dinner', used, rnd);
        if (f) items.push(foodItem(f, 'dinner', Math.max(t, 18)));
        cost.food += MEAL_COST.lunch;
        cost.transport += 3000;
      } else {
        const budget = dayEnd - t;
        const maxN = Math.max(1, Math.round(P.max * Math.min(1, budget / P.hours + 0.15)));
        const chosen = pickDay(pool, budget, maxN, rnd);
        chosen.forEach((s) => {
          const idx = pool.indexOf(s);
          if (idx >= 0) pool.splice(idx, 1);
        });
        const r = scheduleDay(items, chosen, t, city, cid, used, rnd, opts.pace);
        t = r.t;
        if (!isLast && !r.dinner) {
          const f = pickFood(city, r.last, 'dinner', used, rnd);
          if (f) items.push(foodItem(f, 'dinner', Math.max(t, 18)));
        }
        summary = chosen.slice(0, 3).map((s) => s.n.split('・')[0]).join('、') || '城市漫步與自由購物';
      }

      if (isLast) {
        const lastT = items.length ? Math.max(...items.map((i) => i.time + (i.dur || 0))) + 0.25 : 13;
        items.push({
          id: nextItemId(),
          type: 'move',
          icon: '🛫',
          time: Math.max(lastT, 13),
          dur: 2,
          name: `前往 ${city.airport.name}・搭機返國`,
          desc: '國際線建議起飛前 2.5 小時抵達機場；離境時留意隨身與託運退稅規定。',
          sub: city.airport.ways[0],
        });
      }

      if (!items.some((i) => i.type === 'spot') && !isFirst && !isLast) {
        items.push({
          id: nextItemId(),
          type: 'note',
          icon: '🛍️',
          time: Math.max(t, 14),
          dur: 2,
          name: '自由活動 / 商店街採買',
          desc: '可依當日體力逛逛周邊商店街、百貨公司或回飯店休憩。',
        });
      }

      items.forEach((i) => {
        if (i.type === 'spot') cost.tickets += i.cost || 0;
        if (i.type === 'food') cost.food += i.cost || 0;
      });
      cost.transport += cid === 'okinawa' ? 2500 : 1000;
      items.sort((a, b) => a.time - b.time);
      days.push({ date, city: cid, items, summary });
    }
    prev = cid;
  });

  return {
    id: 't' + Date.now(),
    created: Date.now(),
    title: opts.cities.filter((_, i) => alloc[i]).map((c) => CITIES[c].shortName).join('・') + ` ${opts.days} 日遊`,
    opts,
    days,
    cost,
    railCost,
    tips: buildTips(opts, alloc, railCost),
  };
}

export function tripText(trip: Trip) {
  const lines = [
    `🇯🇵 ${trip.title}`,
    `${fmtDate(trip.opts.start)} – ${fmtDate(addDays(trip.opts.start, trip.opts.days - 1))}`,
    '',
  ];
  trip.days.forEach((d, i) => {
    lines.push(`【Day ${i + 1}】${fmtDate(d.date)} ${CITIES[d.city].shortName}`);
    d.items.forEach((it) => lines.push(`  ${fmtTime(it.time)} ${it.icon} ${it.name}`));
    lines.push('');
  });
  lines.push('— 由「旅日手帖」編排');
  return lines.join('\n');
}

function toB64Url(bytes: Uint8Array) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(s: string) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function encodeTripUrl(trip: Trip): Promise<string> {
  const payload = JSON.stringify({
    id: trip.id,
    title: trip.title,
    opts: trip.opts,
    days: trip.days,
    cost: trip.cost,
    railCost: trip.railCost,
    tips: trip.tips,
  });
  const raw = new TextEncoder().encode(payload);
  let code = 'j:' + toB64Url(raw);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const w = cs.writable.getWriter();
      w.write(raw);
      w.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      code = 'z:' + toB64Url(new Uint8Array(buf));
    } catch {
      // Fallback to raw JSON encoding
    }
  }
  return `${location.origin}${location.pathname}?trip=${encodeURIComponent(code)}`;
}

export async function decodeTripParam(code: string | null): Promise<Trip | null> {
  if (!code) return null;
  let bytes: Uint8Array;
  if (code.startsWith('z:') && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const w = ds.writable.getWriter();
    w.write(fromB64Url(code.slice(2)) as unknown as BufferSource);
    w.close();
    bytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
  } else if (code.startsWith('j:')) {
    bytes = fromB64Url(code.slice(2));
  } else {
    return null;
  }
  const obj = JSON.parse(new TextDecoder().decode(bytes)) as Trip;
  if (!obj || !Array.isArray(obj.days) || !obj.opts) return null;
  // Ensure every item has a stable id
  obj.days.forEach((d) => {
    d.items.forEach((it) => {
      if (!it.id) it.id = nextItemId();
    });
  });
  return obj;
}
