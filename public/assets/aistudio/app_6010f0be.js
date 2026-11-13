'use strict';
/* ====================== 工具函式 ====================== */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const LS = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* 容量不足時忽略 */ } },
};
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const yen = (n) => '¥' + Math.round(n).toLocaleString();
const twd = (n) => 'NT$' + Math.round(n * state.rate).toLocaleString();
const CITY_JA = { tokyo: '東京', osaka: '大阪', kyoto: '京都', nara: '奈良', sapporo: '札幌', fukuoka: '福岡', okinawa: '沖縄' };
const gmap = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const gsearch = (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`;
const WEEK = ['日', '一', '二', '三', '四', '五', '六'];

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2000);
}
function ymd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(s) { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function addDays(s, n) { const d = parseDate(s); d.setDate(d.getDate() + n); return ymd(d); }
function fmtDate(s) { const d = parseDate(s); return `${d.getMonth() + 1}/${d.getDate()}（${WEEK[d.getDay()]}）`; }
function fmtTime(h) {
  const q = Math.round(h * 4) / 4;
  const hh = Math.floor(q), mm = Math.round((q - hh) * 60);
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}
function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ====================== 狀態 ====================== */
const state = {
  cities: [],
  pace: 'normal',
  interests: new Set(['culture', 'food']),
  trip: LS.get('currentTrip', null),
  rate: LS.get('fxRate', 0.21),
  mapMode: 'spots',
  mapFilter: 'all',
  transportCity: 'all',
  foodCity: 'tokyo',
  dealCat: '全部',
};

/* ====================== 路由 ====================== */
const TABS = ['plan', 'transport', 'food', 'map', 'deals', 'tools'];
function currentTab() { const h = location.hash.slice(1); return TABS.includes(h) ? h : 'plan'; }
function go(tab) {
  $$('.page').forEach((p) => p.classList.toggle('active', p.id === 'page-' + tab));
  $$('.tabbar-floating a, .tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  window.scrollTo(0, 0);
  if (tab === 'map') initMap();
  if (tab === 'tools') initTools();
}
window.addEventListener('hashchange', () => go(currentTab()));

/* ====================== 規劃表單與偏好記憶 ====================== */
const DEFAULT_PRESETS = [
  { key: 'tokyo-cherry', label: '🌸 東京 5 天潮流賞櫻', cities: ['tokyo'], days: 5, pace: 'normal', interests: ['culture', 'food', 'view'] },
  { key: 'kansai-classic', label: '⛩️ 關西 6 天古都漫遊', cities: ['osaka', 'kyoto', 'nara'], days: 6, pace: 'normal', interests: ['culture', 'food'] },
  { key: 'sapporo-snow', label: '❄️ 北海道 5 天破冰美食', cities: ['sapporo'], days: 5, pace: 'normal', interests: ['nature', 'food', 'view'] },
  { key: 'okinawa-drive', label: '🏝️ 沖繩 4 天海島自駕', cities: ['okinawa'], days: 4, pace: 'relax', interests: ['nature', 'view', 'fun'] },
];

function savePrefs() {
  LS.set('prefs', {
    cities: [...state.cities],
    days: Math.min(21, Math.max(1, +$('#days')?.value || 5)),
    pace: state.pace,
    interests: [...state.interests],
  });
}

function applyFormFromPrefs(p) {
  if (!p) return;
  if (Array.isArray(p.cities)) state.cities = p.cities.filter((c) => CITIES[c]);
  if (p.pace && PACE[p.pace]) state.pace = p.pace;
  if (Array.isArray(p.interests)) state.interests = new Set(p.interests.filter((t) => TAGS[t]));
  if (p.days) $('#days').value = Math.min(21, Math.max(1, +p.days));
  renderCityChips();
  renderInterestChips();
  $$('#paceSeg button').forEach((x) => x.classList.toggle('on', x.dataset.v === state.pace));
}

function renderPresets() {
  const wrap = $('.prompt-presets');
  if (!wrap) return;
  const pinned = LS.get('trips', []).filter((t) => t.pinned);
  const pinnedHtml = pinned.map((t) =>
    `<button type="button" class="preset-pill pinned" data-pinned="${esc(t.id)}">⭐ ${esc(t.title)}</button>`).join('');
  const defHtml = DEFAULT_PRESETS.map((p) =>
    `<button type="button" class="preset-pill" data-preset="${p.key}">${p.label}</button>`).join('');
  wrap.innerHTML = pinnedHtml + defHtml;
}

function renderCityChips() {
  $('#cityChips').innerHTML = Object.entries(CITIES).map(([id, c]) => {
    const idx = state.cities.indexOf(id);
    return `<button type="button" class="chip ${idx >= 0 ? 'on' : ''}" data-id="${id}">${c.emoji} ${c.name.replace(/（.*）/, '')}${idx >= 0 ? `<span class="ord">${idx + 1}</span>` : ''}</button>`;
  }).join('');
}
function renderInterestChips() {
  $('#interestChips').innerHTML = Object.entries(TAGS).map(([id, t]) =>
    `<button type="button" class="chip ${state.interests.has(id) ? 'on' : ''}" data-id="${id}">${t.icon} ${t.label}</button>`).join('');
}
function initPlanForm() {
  const start = new Date(); start.setDate(start.getDate() + 14);
  $('#startDate').value = ymd(start);
  applyFormFromPrefs(LS.get('prefs', null));
  renderCityChips();
  renderInterestChips();
  renderPresets();

  $('#cityChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const id = b.dataset.id, i = state.cities.indexOf(id);
    if (i >= 0) state.cities.splice(i, 1); else state.cities.push(id);
    renderCityChips();
    const rec = state.cities.reduce((s, c) => s + CITIES[c].recDays, 0);
    if (rec) $('#days').value = Math.min(21, Math.max(state.cities.length, Math.round(rec)));
    $('#formHint').textContent = '';
    savePrefs();
  });
  $('#interestChips').addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    const id = b.dataset.id;
    state.interests.has(id) ? state.interests.delete(id) : state.interests.add(id);
    renderInterestChips();
    savePrefs();
  });
  $('#paceSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    state.pace = b.dataset.v;
    $$('#paceSeg button').forEach((x) => x.classList.toggle('on', x === b));
    savePrefs();
  });
  $$('.stepper button').forEach((b) => b.addEventListener('click', () => {
    const inp = $('#days');
    inp.value = Math.min(21, Math.max(1, (+inp.value || 1) + +b.dataset.step));
    savePrefs();
  }));
  $('#days').addEventListener('change', savePrefs);

  $('.prompt-presets')?.addEventListener('click', (e) => {
    const b = e.target.closest('.preset-pill'); if (!b) return;
    if (b.dataset.pinned) {
      const saved = LS.get('trips', []).find((t) => t.id === b.dataset.pinned);
      if (!saved) { renderPresets(); return; }
      state.trip = saved;
      LS.set('currentTrip', saved);
      applyFormFromPrefs(saved.opts);
      savePrefs();
      renderTrip();
      setTimeout(() => $('#itinerary').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
      toast(`⭐ 已載入偏好行程「${saved.title}」`);
      return;
    }
    const p = DEFAULT_PRESETS.find((x) => x.key === b.dataset.preset); if (!p) return;
    applyFormFromPrefs(p);
    savePrefs();
    const start = $('#startDate').value || ymd(new Date());
    state.trip = generateTrip({ cities: [...state.cities], start, days: p.days, pace: state.pace, interests: [...state.interests], seed: Date.now() % 1e9 });
    LS.set('currentTrip', state.trip);
    renderTrip();
    setTimeout(() => $('#itinerary').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    toast(`🗾 已為您套用「${b.textContent.trim()}」行程！`);
  });
  $('#planForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if (!state.cities.length) { $('#formHint').textContent = '請至少選擇一個城市 👆'; return; }
    const days = Math.min(21, Math.max(1, +$('#days').value || 1));
    const start = $('#startDate').value || ymd(new Date());
    if (days < state.cities.length) {
      $('#formHint').textContent = `天數少於城市數，只會安排前 ${days} 個城市。`;
    } else $('#formHint').textContent = '';
    savePrefs();
    const opts = { cities: [...state.cities], start, days, pace: state.pace, interests: [...state.interests], seed: Date.now() % 1e9 };
    state.trip = generateTrip(opts);
    LS.set('currentTrip', state.trip);
    renderTrip();
    setTimeout(() => $('#itinerary').scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    toast('🎉 行程已生成！');
  });
}

/* ====================== 行程生成引擎 ====================== */
const PACE = {
  relax: { hours: 7, max: 3, label: '輕鬆' },
  normal: { hours: 8.5, max: 4, label: '標準' },
  packed: { hours: 10.5, max: 6, label: '緊湊' },
};
const TRANSFER = 0.5; // 景點間移動時間（小時）
const MEAL_COST = { lunch: 1500, dinner: 3000, snack: 600 };

function allocateDays(cities, days) {
  const n = cities.length;
  if (days <= n) return cities.map((c, i) => (i < days ? 1 : 0));
  const w = cities.map((c) => CITIES[c].recDays);
  const sum = w.reduce((a, b) => a + b, 0);
  const ideal = w.map((x) => (x / sum) * days);
  const alloc = ideal.map((x) => Math.max(1, Math.floor(x)));
  let total = alloc.reduce((a, b) => a + b, 0);
  while (total < days) {
    let bi = 0, bv = -Infinity;
    ideal.forEach((x, i) => { const v = x - alloc[i]; if (v > bv) { bv = v; bi = i; } });
    alloc[bi]++; total++;
  }
  while (total > days) {
    let bi = -1, bv = Infinity;
    ideal.forEach((x, i) => { if (alloc[i] <= 1) return; const v = x - alloc[i]; if (v < bv) { bv = v; bi = i; } });
    if (bi < 0) break;
    alloc[bi]--; total--;
  }
  return alloc;
}

function scoreSpot(s, interests) {
  const match = s.t.filter((t) => interests.includes(t)).length;
  return s.p + match * 1.6;
}

function getIntercity(a, b) {
  const key = [a, b].sort().join('-');
  return INTERCITY[key] || { mode: '🚆 交通移動', time: '請查詢', price: '-', h: 4, cost: 10000, tip: '' };
}

/** 選出一天的景點：先挑分數最高的主景點，再依距離就近擴充 */
function pickDay(pool, budget, maxN, rnd) {
  if (!pool.length || budget < 1) return [];
  const ranked = pool.map((s) => ({ s, v: s.score + rnd() * 1.8 })).sort((a, b) => b.v - a.v);
  const anchor = ranked.find((r) => r.s.d <= budget)?.s;
  if (!anchor) return [];
  const chosen = [anchor];
  let used = anchor.d;
  while (chosen.length < maxN) {
    let best = null, bv = -Infinity;
    for (const s of pool) {
      if (chosen.includes(s)) continue;
      if (used + TRANSFER + s.d > budget) continue;
      const dist = Math.min(...chosen.map((c) => km(c, s)));
      const v = s.score * 1.2 - dist * 0.7 + rnd() * 0.6;
      if (v > bv) { bv = v; best = s; }
    }
    if (!best) break;
    chosen.push(best);
    used += TRANSFER + best.d;
  }
  // 排序：白天景點用最近鄰路線，適合晚上的景點排最後
  const day = chosen.filter((s) => !s.ev), night = chosen.filter((s) => s.ev);
  const ordered = [];
  if (day.length) {
    // 起點選離其他點最遠的那個（路線的一端）
    let cur = day.reduce((a, b) => {
      const da = day.reduce((s, x) => s + km(a, x), 0), db = day.reduce((s, x) => s + km(b, x), 0);
      return db > da ? b : a;
    });
    const rest = day.filter((x) => x !== cur);
    ordered.push(cur);
    while (rest.length) {
      rest.sort((a, b) => km(cur, a) - km(cur, b));
      cur = rest.shift();
      ordered.push(cur);
    }
  }
  return ordered.concat(night);
}

function pickFood(city, near, kind, used, rnd) {
  const ok = (f) => f.m === kind || f.m === 'any';
  let cands = city.foods.filter((f) => !used.has(f.n) && ok(f));
  if (!cands.length) cands = city.foods.filter(ok);
  if (!cands.length) cands = city.foods;
  let best = null, bv = -Infinity;
  for (const f of cands) {
    const v = (near ? -km(near, f) * 0.6 : 0) + rnd() * 2 + (used.has(f.n) ? -3 : 0);
    if (v > bv) { bv = v; best = f; }
  }
  if (best) used.add(best.n);
  return best;
}

function foodItem(f, kind, t) {
  const label = { lunch: '午餐', dinner: '晚餐', snack: '點心' }[kind];
  return {
    type: 'food', icon: kind === 'snack' ? '🍡' : '🍴', time: t, dur: kind === 'snack' ? 0.5 : kind === 'dinner' ? 1.25 : 1,
    name: `${label}：${f.n}`, ja: f.ja, lat: f.lat, lng: f.lng, desc: f.desc, sub: `推薦：${f.shops}｜${f.price}`, kind, cost: MEAL_COST[kind],
  };
}

function spotItem(s, t, cityId) {
  return {
    type: 'spot', icon: TAGS[s.t[0]]?.icon || '📍', time: t, dur: s.d, name: s.n, ja: s.ja, lat: s.lat, lng: s.lng,
    desc: s.desc, sub: `${s.a}｜建議停留 ${s.d >= 8 ? '一整天' : s.d + ' 小時'}${s.fee ? '｜約 ' + yen(s.fee) : '｜免費'}`,
    tags: s.t, cost: s.fee || 0, city: cityId,
  };
}

/** 依時間把景點與三餐排進一天 */
function scheduleDay(items, chosen, t, city, cityId, used, rnd, pace) {
  let lunch = t >= 13.75, dinner = false, snack = pace === 'packed';
  let last = chosen[0] || city;
  for (const s of chosen) {
    if (!lunch && (t >= 11.25 || t + s.d > 13.5)) {
      const f = pickFood(city, last, 'lunch', used, rnd);
      if (f) { items.push(foodItem(f, 'lunch', Math.max(t, 11.5))); t = Math.max(t, 11.5) + 1; }
      lunch = true;
    }
    if (!dinner && t >= 17.5) {
      const f = pickFood(city, s, 'dinner', used, rnd);
      if (f) { items.push(foodItem(f, 'dinner', t)); t += 1.25; }
      dinner = true;
    }
    if (!snack && lunch && t >= 14.5 && t <= 16.5) {
      const near = city.foods.filter((f) => f.m === 'snack' && !used.has(f.n) && km(f, last) < 3);
      if (near.length) {
        const f = near[Math.floor(rnd() * near.length)];
        used.add(f.n);
        items.push(foodItem(f, 'snack', t)); t += 0.5;
      }
      snack = true;
    }
    items.push(spotItem(s, t, cityId));
    t += s.d + TRANSFER;
    last = s;
  }
  if (!lunch && t <= 15) {
    const f = pickFood(city, last, 'lunch', used, rnd);
    if (f) { items.push(foodItem(f, 'lunch', Math.max(t, 11.5))); t = Math.max(t, 11.5) + 1; }
  }
  return { t, last, dinner };
}

function generateTrip(opts) {
  const rnd = mulberry32(opts.seed);
  const P = PACE[opts.pace];
  const alloc = allocateDays(opts.cities, opts.days);
  const days = [];
  const cost = { transport: 0, tickets: 0, food: 0 };
  let di = 0, prev = null, railCost = 0;

  opts.cities.forEach((cid, ci) => {
    const n = alloc[ci];
    if (!n) return;
    const city = CITIES[cid];
    const pool = city.spots.filter((s) => !s.full).map((s) => ({ ...s, score: scoreSpot(s, opts.interests) }));
    const fullQ = opts.interests.includes('fun') && n >= 2
      ? city.spots.filter((s) => s.full).sort((a, b) => b.p - a.p).slice(0, Math.floor(n / 2)) : [];
    const used = new Set();
    let tripIdx = 0;

    for (let k = 0; k < n; k++, di++) {
      const isFirst = di === 0, isLast = di === opts.days - 1;
      const date = addDays(opts.start, di);
      const items = [];
      let t = 9;
      let dayEnd = 9 + P.hours;
      let travelIn = null;

      if (isFirst) {
        items.push({ type: 'move', icon: '✈️', time: 10.5, dur: 2, name: `抵達 ${city.airport.name}・前往市區`, desc: city.airport.ways.slice(0, 3).join('\n'), sub: '辦理入境（Visit Japan Web）→ 買交通卡 → 飯店寄放行李' });
        t = 13;
      } else if (k === 0 && prev) {
        travelIn = getIntercity(prev, cid);
        items.push({ type: 'move', icon: '🧳', time: 9, dur: travelIn.h, name: `${CITIES[prev].name.replace(/（.*）/, '')} → ${city.name.replace(/（.*）/, '')}`, desc: travelIn.tip, sub: `${travelIn.mode}｜${travelIn.time}｜${travelIn.price}` });
        cost.transport += travelIn.cost;
        if (/新幹線|JR/.test(travelIn.mode)) railCost += travelIn.cost;
        t = 9 + travelIn.h + 0.25;
      }
      if (isLast) dayEnd = Math.min(dayEnd, 14.5);

      let summary = '';
      if (!isFirst && !isLast && !travelIn && k > 0 && fullQ.length) {
        // 樂園一整天
        const s = fullQ.shift();
        items.push(spotItem(s, 9, cid));
        items.push({ type: 'note', icon: '🍔', time: 12.5, dur: 0, name: '園區內用餐', desc: '樂園內餐廳中午人潮多，建議錯開 11:00 或 14:00 用餐，或使用 App 行動點餐。' });
        cost.food += 3500; // 園區內午餐與點心
        summary = s.n;
        const f = pickFood(city, s, 'dinner', used, rnd);
        if (f) items.push(foodItem(f, 'dinner', 20));
      } else if (!pool.length && city.dayTrips.length && !isLast) {
        // 景點用完 → 推薦近郊一日遊
        const dt = city.dayTrips[tripIdx++ % city.dayTrips.length];
        items.push({ type: 'spot', icon: '🚞', time: t, dur: 7, name: `近郊一日遊：${dt.n}`, ja: dt.ja, lat: dt.lat, lng: dt.lng, desc: dt.desc, sub: '可參加 Klook / KKday 一日遊團', tags: ['nature'], cost: 0 });
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
        chosen.forEach((s) => pool.splice(pool.indexOf(s), 1));
        const r = scheduleDay(items, chosen, t, city, cid, used, rnd, opts.pace);
        t = r.t;
        if (!isLast && !r.dinner) {
          const f = pickFood(city, r.last, 'dinner', used, rnd);
          if (f) items.push(foodItem(f, 'dinner', Math.max(t, 18)));
        }
        summary = chosen.slice(0, 3).map((s) => s.n.split('・')[0]).join('、') || '自由活動';
      }

      if (isLast) {
        const lastT = items.length ? Math.max(...items.map((i) => i.time + (i.dur || 0))) + 0.25 : 13;
        items.push({ type: 'move', icon: '🛫', time: Math.max(lastT, 13), dur: 2, name: `前往 ${city.airport.name}・搭機返國`, desc: '國際線建議起飛前 2.5 小時抵達機場；留意退稅需於出境時辦理。', sub: city.airport.ways[0] });
      }
      if (!items.some((i) => i.type === 'spot') && !isFirst && !isLast) {
        items.push({ type: 'note', icon: '🛍️', time: Math.max(t, 14), dur: 2, name: '自由活動 / 購物', desc: '可逛附近商店街、藥妝店或回飯店休息。' });
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
    title: opts.cities.filter((c, i) => alloc[i]).map((c) => CITIES[c].name.replace(/（.*）/, '')).join('・') + ` ${opts.days} 日遊`,
    opts, days, cost, railCost,
    tips: buildTips(opts, alloc, railCost),
  };
}

function buildTips(opts, alloc, railCost) {
  const tips = [];
  const has = (c) => opts.cities.includes(c) && alloc[opts.cities.indexOf(c)] > 0;
  const months = new Set();
  for (let i = 0; i < opts.days; i++) months.add(parseDate(addDays(opts.start, i)).getMonth() + 1);
  const m = (x) => months.has(x);
  const s = parseDate(opts.start), e = parseDate(addDays(opts.start, opts.days - 1));
  const inRange = (mm, d1, d2) => {
    for (let d = new Date(s); d <= e; d.setDate(d.getDate() + 1)) if (d.getMonth() + 1 === mm && d.getDate() >= d1 && d.getDate() <= d2) return true;
    return false;
  };

  if (inRange(3, 20, 31) || inRange(4, 1, 15)) tips.push('🌸 櫻花季！熱門賞櫻點人潮多，住宿請提早預訂（北海道約 4 月底–5 月初開花）。');
  if (inRange(4, 29, 30) || inRange(5, 1, 6)) tips.push('⚠️ 黃金週（4/29–5/5）日本人出遊高峰，交通與住宿都會漲價。');
  if (m(6) || inRange(7, 1, 15)) tips.push('☔ 梅雨季，記得帶折疊傘，可多安排室內景點。');
  if (m(7) || m(8)) tips.push('☀️ 夏季炎熱（常超過 35°C），注意防曬補水；各地有花火大會與夏日祭典。');
  if (inRange(8, 10, 16)) tips.push('⚠️ 盂蘭盆節（8 月中）返鄉潮，新幹線與高速公路擁擠。');
  if ((m(7) || m(8) || m(9) || m(10)) && has('okinawa')) tips.push('🌀 7–10 月為沖繩颱風季，請留意天氣並保留彈性。');
  if (m(10) && has('sapporo')) tips.push('🍁 北海道 10 月紅葉最美（定山溪、大雪山）。');
  if (inRange(11, 10, 30) || inRange(12, 1, 7)) tips.push('🍁 紅葉季！京都、東京銀杏 11 月中下旬最美，京都寺廟有夜間點燈特別參拜。');
  if (m(12) || m(1) || m(2)) tips.push('🧥 冬季寒冷，東京約 2–10°C；北海道零下，請穿保暖衣物與防滑雪靴。');
  if (inRange(12, 29, 31) || inRange(1, 1, 3)) tips.push('🎍 年末年始（12/29–1/3）許多店家與景點休息，神社新年參拜人潮多。');
  if (inRange(2, 1, 12) && has('sapporo')) tips.push('⛄ 札幌雪祭通常在 2 月上旬舉行，住宿非常搶手！');
  if (inRange(12, 1, 31)) tips.push('🎄 12 月各地有聖誕燈飾，表參道、六本木、神戶光之饗宴值得一看。');

  if (has('tokyo')) tips.push('🎫 東京地鐵用量大建議買「Tokyo Subway Ticket」（72h ¥1,500）。');
  if (has('osaka')) tips.push('🎫 大阪景點多可考慮「大阪周遊卡」，大阪城、空中庭園等免費入場。');
  if (has('osaka') || has('kyoto') || has('nara')) tips.push('🚆 關西機場進出可買「ICOCA & HARUKA」優惠票。');
  if (has('okinawa')) tips.push('🚗 沖繩建議租車自駕，需準備台灣駕照 + 日文譯本。');
  if (railCost >= 45000) tips.push(`🚄 本行程新幹線費用約 ${yen(railCost)}，可評估購買 JR Pass 是否划算。`);
  tips.push('🧾 2026/11 起日本免稅改為「退稅制」，購物時出示護照、出境時再辦理退稅。');
  return tips;
}

/* ====================== 行程渲染 ====================== */
function renderTrip() {
  const trip = state.trip;
  const el = $('#itinerary');
  if (!trip) { el.innerHTML = ''; return; }
  const spots = trip.days.reduce((s, d) => s + d.items.filter((i) => i.type === 'spot').length, 0);
  const total = trip.cost.transport + trip.cost.tickets + trip.cost.food;
  const endDate = addDays(trip.opts.start, trip.opts.days - 1);

  el.innerHTML = `
    <div class="trip-head">
      <h2>🇯🇵 ${esc(trip.title)}</h2>
      <div class="meta">${fmtDate(trip.opts.start)} – ${fmtDate(endDate)}｜${PACE[trip.opts.pace].label}步調</div>
      <div class="stats">
        <div class="stat"><b>${trip.opts.days}</b><small>天</small></div>
        <div class="stat"><b>${spots}</b><small>個景點</small></div>
        <div class="stat"><b>${yen(total)}</b><small>預估/人 ≈ ${twd(total)}</small></div>
      </div>
      <div class="trip-actions">
        <button class="btn" data-act="save">💾 儲存</button>
        <button class="btn" data-act="pin">${trip.pinned ? '⭐ 已釘選' : '☆ 釘選偏好'}</button>
        <button class="btn" data-act="copylink">🔗 專屬連結</button>
        <button class="btn" data-act="regen">🔄 換一組</button>
        <button class="btn" data-act="share">📤 分享</button>
        <button class="btn" data-act="mapall">🗺️ 地圖</button>
        <button class="btn" data-act="print">🖨️ 列印</button>
      </div>
    </div>
    <div class="tips">${trip.tips.map((t) => `<p>${esc(t)}</p>`).join('')}
      <p class="muted" style="font-size:12px">預估花費含市內交通、城市間交通、門票、餐飲，不含住宿與購物。</p></div>
    ${trip.days.map((d, di) => renderDay(d, di)).join('')}
  `;
}

function renderDay(d, di) {
  const city = CITIES[d.city];
  return `
  <div class="day" data-day="${di}">
    <div class="day-head" data-act="toggle">
      <span class="day-no">Day ${di + 1}</span>
      <div class="day-title"><b>${city.emoji} ${esc(city.name.replace(/（.*）/, ''))}｜${esc(d.summary)}</b><small>${fmtDate(d.date)}</small></div>
      <span class="day-toggle">▾</span>
    </div>
    <div class="day-body">
      <div class="day-tools">
        <button class="btn outline" data-act="route">🧭 Google 路線</button>
        <button class="btn outline" data-act="mapday">🗺️ 地圖檢視</button>
      </div>
      <div class="tl">
        ${d.items.map((it, ii) => `
        <div class="tl-item ${it.type}">
          <div class="tl-time">${fmtTime(it.time)}</div>
          <div class="tl-dot">${it.icon}</div>
          <div class="tl-main">
            <b>${esc(it.name)}</b>
            ${it.sub ? `<div class="sub">${esc(it.sub)}</div>` : ''}
            ${it.desc ? `<div class="desc">${esc(it.desc).replace(/\n/g, '<br>')}</div>` : ''}
            <div class="tl-acts">
              ${it.lat ? `<a href="${gmap(it.ja || it.name)}" target="_blank" rel="noopener">📍 Google 地圖</a>` : ''}
              ${it.type === 'food' ? `<a href="${gsearch(it.ja + ' ' + CITY_JA[d.city] + ' 食べログ')}" target="_blank" rel="noopener">⭐ 評價</a>` : ''}
              ${it.type === 'spot' && it.tags ? `<button data-act="swap" data-i="${ii}">🔁 換一個</button>` : ''}
              ${it.type !== 'move' ? `<button data-act="del" data-i="${ii}">✕ 刪除</button>` : ''}
            </div>
          </div>
        </div>`).join('')}
      </div>
    </div>
  </div>`;
}

function tripText(trip) {
  const lines = [`🇯🇵 ${trip.title}`, `📅 ${fmtDate(trip.opts.start)} – ${fmtDate(addDays(trip.opts.start, trip.opts.days - 1))}`, ''];
  trip.days.forEach((d, i) => {
    lines.push(`【Day ${i + 1}】${fmtDate(d.date)} ${CITIES[d.city].name}`);
    d.items.forEach((it) => lines.push(`  ${fmtTime(it.time)} ${it.icon} ${it.name}`));
    lines.push('');
  });
  lines.push('— 由「旅日手帖」一鍵生成');
  return lines.join('\n');
}

function toB64Url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64Url(s) {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function encodeTripUrl(trip) {
  const payload = JSON.stringify({
    id: trip.id, title: trip.title, opts: trip.opts, days: trip.days,
    cost: trip.cost, railCost: trip.railCost, tips: trip.tips,
  });
  const raw = new TextEncoder().encode(payload);
  let code = 'j:' + toB64Url(raw);
  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('gzip');
      const w = cs.writable.getWriter();
      w.write(raw); w.close();
      const buf = await new Response(cs.readable).arrayBuffer();
      code = 'z:' + toB64Url(new Uint8Array(buf));
    } catch { /* 改用未壓縮格式 */ }
  }
  return `${location.origin}${location.pathname}?trip=${encodeURIComponent(code)}`;
}
async function decodeTripParam(code) {
  if (!code) return null;
  let bytes;
  if (code.startsWith('z:') && typeof DecompressionStream !== 'undefined') {
    const ds = new DecompressionStream('gzip');
    const w = ds.writable.getWriter();
    w.write(fromB64Url(code.slice(2))); w.close();
    bytes = new Uint8Array(await new Response(ds.readable).arrayBuffer());
  } else if (code.startsWith('j:')) {
    bytes = fromB64Url(code.slice(2));
  } else return null;
  const obj = JSON.parse(new TextDecoder().decode(bytes));
  if (!obj || !Array.isArray(obj.days) || !obj.opts) return null;
  return obj;
}
async function copyTripLink(trip) {
  try {
    const url = await encodeTripUrl(trip);
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      toast('🔗 專屬同步連結已複製！傳到 LINE 或其他手機即可打開');
    } else if (navigator.share) {
      await navigator.share({ title: trip.title, url });
    } else {
      prompt('請複製下方專屬行程連結：', url);
    }
  } catch {
    toast('無法產生連結');
  }
}

function saveTrip(trip) {
  const list = LS.get('trips', []);
  const i = list.findIndex((t) => t.id === trip.id);
  if (i >= 0) list[i] = trip; else list.unshift(trip);
  LS.set('trips', list.slice(0, 20));
}

function onItineraryClick(e) {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const act = b.dataset.act;
  const trip = state.trip; if (!trip) return;
  const dayEl = b.closest('.day');
  const di = dayEl ? +dayEl.dataset.day : -1;
  const day = trip.days[di];

  switch (act) {
    case 'toggle': dayEl.classList.toggle('collapsed'); return;
    case 'save': saveTrip(trip); toast('💾 已儲存到「我的行程」'); return;
    case 'pin': {
      trip.pinned = !trip.pinned;
      saveTrip(trip);
      LS.set('currentTrip', trip);
      renderPresets();
      renderTrip();
      toast(trip.pinned ? '⭐ 已釘選到首頁偏好膠囊！' : '已取消釘選');
      return;
    }
    case 'copylink': copyTripLink(trip); return;
    case 'regen': {
      state.trip = generateTrip({ ...trip.opts, seed: (trip.opts.seed * 7 + 13) % 1e9 });
      break;
    }
    case 'share': {
      const text = tripText(trip);
      if (navigator.share) navigator.share({ title: trip.title, text }).catch(() => {});
      else navigator.clipboard?.writeText(text).then(() => toast('📋 行程已複製'), () => toast('無法複製'));
      return;
    }
    case 'print': window.print(); return;
    case 'mapall': state.mapMode = 'trip'; location.hash = 'map'; return;
    case 'mapday': state.mapMode = 'day-' + di; location.hash = 'map'; return;
    case 'route': {
      const pts = day.items.filter((i) => i.lat).slice(0, 10);
      if (pts.length < 2) { if (pts[0]) window.open(gmap(pts[0].ja)); else toast('這天沒有可導航的地點'); return; }
      window.open('https://www.google.com/maps/dir/' + pts.map((p) => `${p.lat},${p.lng}`).join('/') + '/data=!4m2!4m1!3e3', '_blank');
      return;
    }
    case 'del': day.items.splice(+b.dataset.i, 1); toast('已刪除'); break;
    case 'swap': {
      const it = day.items[+b.dataset.i];
      const usedNames = new Set(trip.days.flatMap((d) => d.items.map((x) => x.name)));
      const cands = CITIES[day.city].spots.filter((s) => !s.full && !usedNames.has(s.n));
      if (!cands.length) { toast('這個城市沒有其他景點可換了'); return; }
      cands.sort((a, b) => km(it, a) - km(it, b));
      const pick = cands[Math.floor(Math.random() * Math.min(3, cands.length))];
      day.items[+b.dataset.i] = spotItem(pick, it.time, day.city);
      toast(`已換成「${pick.n}」`);
      break;
    }
    default: return;
  }
  LS.set('currentTrip', state.trip);
  const collapsed = $$('.day.collapsed').map((x) => x.dataset.day);
  renderTrip();
  collapsed.forEach((i) => $(`.day[data-day="${i}"]`)?.classList.add('collapsed'));
}

/* ====================== 我的行程抽屜 ====================== */
function openSheet() {
  const list = LS.get('trips', []);
  $('#tripList').innerHTML = list.length ? list.map((t) => `
    <div class="trip-row" data-id="${t.id}">
      <div class="info" data-act="load"><b>${t.pinned ? '⭐ ' : ''}${esc(t.title)}</b><br><small>${fmtDate(t.opts.start)} 出發｜${t.opts.days} 天</small></div>
      <div class="trip-row-acts">
        <button class="btn tiny" data-act="pin" title="釘選到首頁">${t.pinned ? '⭐' : '☆'}</button>
        <button class="btn tiny" data-act="link" title="複製同步連結">🔗</button>
        <button class="btn tiny" data-act="load">開啟</button>
        <button class="btn tiny" data-act="remove">刪除</button>
      </div>
    </div>`).join('') : '<p class="muted">還沒有儲存的行程，先到「規劃」一鍵生成吧！</p>';
  $('#sheetMask').classList.remove('hidden');
  $('#tripSheet').classList.add('open');
}
function closeSheet() { $('#sheetMask').classList.add('hidden'); $('#tripSheet').classList.remove('open'); }
function initSheet() {
  $('#btnTrips').addEventListener('click', openSheet);
  $('#sheetMask').addEventListener('click', closeSheet);
  $('#tripList').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    const id = b.closest('.trip-row').dataset.id;
    let list = LS.get('trips', []);
    const target = list.find((t) => t.id === id);
    if (b.dataset.act === 'load' && target) {
      state.trip = target;
      LS.set('currentTrip', state.trip);
      applyFormFromPrefs(target.opts);
      savePrefs();
      closeSheet();
      location.hash = 'plan';
      renderTrip();
      setTimeout(() => $('#itinerary').scrollIntoView({ behavior: 'smooth' }), 80);
    } else if (b.dataset.act === 'pin' && target) {
      target.pinned = !target.pinned;
      LS.set('trips', list);
      if (state.trip?.id === id) { state.trip.pinned = target.pinned; LS.set('currentTrip', state.trip); renderTrip(); }
      renderPresets();
      openSheet();
      toast(target.pinned ? '⭐ 已釘選到首頁偏好膠囊！' : '已取消釘選');
    } else if (b.dataset.act === 'link' && target) {
      copyTripLink(target);
    } else if (b.dataset.act === 'remove') {
      list = list.filter((t) => t.id !== id);
      LS.set('trips', list);
      renderPresets();
      openSheet();
    }
  });

  $('#btnExportTrips')?.addEventListener('click', () => {
    const list = LS.get('trips', []);
    if (!list.length) return toast('目前沒有可匯出的行程');
    const blob = new Blob([JSON.stringify({ version: 1, trips: list, prefs: LS.get('prefs', null) }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `japan-trips-${ymd(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast('📤 已下載備份檔');
  });

  $('#btnImportTrips')?.addEventListener('click', () => $('#importFile')?.click());
  $('#importFile')?.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : (Array.isArray(data?.trips) ? data.trips : []);
      if (!incoming.length) throw new Error();
      const cur = LS.get('trips', []);
      const ids = new Set(cur.map((t) => t.id));
      let added = 0;
      incoming.forEach((t) => { if (t?.id && t?.days && !ids.has(t.id)) { cur.unshift(t); ids.add(t.id); added++; } });
      LS.set('trips', cur.slice(0, 20));
      renderPresets();
      openSheet();
      toast(`📥 已匯入 ${added} 筆行程！`);
    } catch {
      toast('備份檔格式不正確');
    }
    e.target.value = '';
  });
}

/* ====================== 交通頁 ====================== */
const REGION = { tokyo: '東京', osaka: '關西', kyoto: '關西', nara: '關西', sapporo: '北海道', fukuoka: '九州', okinawa: '沖繩' };
function passCard(p) {
  return `<div class="item"><div class="item-head"><div><h4>${esc(p.name)}</h4><span class="ja">${esc(p.region)}</span></div></div>
    <div class="price" style="margin-top:4px">${esc(p.price)}</div><p>${esc(p.desc)}</p>
    <div class="acts"><a href="${p.link}" target="_blank" rel="noopener">🔗 官方網站</a></div></div>`;
}
function renderTransport() {
  const opts = [['all', '🇯🇵 全國'], ...Object.entries(CITIES).map(([id, c]) => [id, `${c.emoji} ${c.name.replace(/（.*）/, '')}`])];
  $('#transportCity').innerHTML = opts.map(([id, l]) => `<button class="chip ${state.transportCity === id ? 'on' : ''}" data-id="${id}">${l}</button>`).join('');
  const id = state.transportCity;
  let html = '';
  if (id === 'all') {
    html += `<div class="section-label">💳 IC 交通卡</div>` + IC_CARDS.map((c) => `<div class="item"><h4>${esc(c.name)}</h4><p>${esc(c.desc)}</p></div>`).join('');
    html += `<div class="section-label">🚄 城市間交通</div><div class="item">` + [
      'osaka-tokyo', 'kyoto-tokyo', 'kyoto-osaka', 'nara-osaka', 'kyoto-nara', 'fukuoka-osaka', 'sapporo-tokyo', 'okinawa-tokyo', 'fukuoka-tokyo',
    ].map((k) => {
      const r = INTERCITY[k];
      const [a, b] = k.split('-').map((c) => CITIES[c].name.replace(/（.*）/, ''));
      return `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>${a} ⇄ ${b}</b> <span class="price">${r.price}</span><br><small class="muted">${r.mode}｜${r.time}</small></div>`;
    }).join('') + `</div>`;
    html += `<div class="section-label">🎫 全國票券</div>` + PASSES.filter((p) => p.region === '全國').map(passCard).join('');
    html += `<div class="section-label">📱 必備 App</div><div class="item">` + APPS.map((a) => `<div style="padding:6px 0"><b>${esc(a.name)}</b><br><small class="muted">${esc(a.desc)}</small></div>`).join('') + `</div>`;
    html += `<div class="section-label">🙇 搭車禮儀</div><div class="item"><ul class="clean">
      <li>手扶梯：東京靠左站、大阪靠右站（近年推廣兩側都站立不行走）。</li>
      <li>車廂內請勿講電話，手機調成靜音（マナーモード）。</li>
      <li>排隊依月台地上標示，先下後上。</li>
      <li>部分路線有女性專用車廂（平日早上尖峰）。</li>
      <li>大型行李搭新幹線需預約「特大行李放置處座位」（三邊合計 160–250cm）。</li></ul></div>`;
  } else {
    const c = CITIES[id];
    html += `<div class="city-intro"><span class="em">${c.emoji}</span><p><b>${esc(c.name)}</b><br>${esc(c.intro)}</p></div>`;
    html += `<div class="section-label">✈️ 機場交通｜${esc(c.airport.name)}</div><div class="item"><ul class="clean">${c.airport.ways.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    html += `<div class="section-label">🚇 市內交通</div><div class="item"><ul class="clean">${c.transit.map((w) => `<li>${esc(w)}</li>`).join('')}</ul></div>`;
    const ps = PASSES.filter((p) => p.region === REGION[id]);
    if (ps.length) html += `<div class="section-label">🎫 推薦票券</div>` + ps.map(passCard).join('');
    const routes = Object.entries(INTERCITY).filter(([k]) => k.split('-').includes(id));
    html += `<div class="section-label">🧳 前往其他城市</div><div class="item">` + routes.map(([k, r]) => {
      const other = k.split('-').find((x) => x !== id);
      return `<div style="padding:8px 0;border-bottom:1px solid var(--line)"><b>→ ${CITIES[other].name.replace(/（.*）/, '')}</b> <span class="price">${r.price}</span><br><small class="muted">${r.mode}｜${r.time}</small></div>`;
    }).join('') + `</div>`;
  }
  $('#transportBody').innerHTML = html;
}

/* ====================== 美食頁 ====================== */
function renderFood() {
  $('#foodCity').innerHTML = Object.entries(CITIES).map(([id, c]) => `<button class="chip ${state.foodCity === id ? 'on' : ''}" data-id="${id}">${c.emoji} ${c.name.replace(/（.*）/, '')}</button>`).join('');
  const c = CITIES[state.foodCity];
  $('#foodBody').innerHTML = c.foods.map((f) => `
    <div class="item">
      <div class="item-head"><div><h4>${esc(f.n)}</h4><span class="ja">${esc(f.ja)}｜${esc(f.a)}</span></div><span class="price">${esc(f.price)}</span></div>
      <p>${esc(f.desc)}</p>
      <p style="font-size:13px">🏆 推薦：${esc(f.shops)}</p>
      <div class="acts">
        <a href="${gmap(f.ja + ' ' + CITY_JA[state.foodCity])}" target="_blank" rel="noopener">📍 附近店家</a>
        <a href="${gsearch(f.ja + ' ' + CITY_JA[state.foodCity] + ' 食べログ ランキング')}" target="_blank" rel="noopener">⭐ Tabelog 排行</a>
      </div>
    </div>`).join('') + `
    <div class="section-label">🍽️ 日本用餐小知識</div>
    <div class="item"><ul class="clean">
      <li>拉麵、牛丼店常用「食券機」：先買票再入座，部分僅收現金。</li>
      <li>日本不需給小費；部分居酒屋會收「お通し」小菜費（約 ¥300–500）。</li>
      <li>熱門餐廳可用 Tabelog、TableCheck、Google 地圖預約。</li>
      <li>多數店家禁止邊走邊吃，請在店門口吃完。</li>
      <li>便利商店（7-11、Lawson、全家）飯糰、甜點也是必吃！</li>
    </ul></div>`;
}

/* ====================== 優惠頁 ====================== */
function renderDeals() {
  const cats = ['全部', ...new Set(DEALS.map((d) => d.cat))];
  $('#dealCat').innerHTML = cats.map((c) => `<button class="chip ${state.dealCat === c ? 'on' : ''}" data-id="${c}">${c}</button>`).join('');
  const list = DEALS.filter((d) => state.dealCat === '全部' || d.cat === state.dealCat);
  $('#dealBody').innerHTML = list.map((d) => `
    <div class="item">
      <div class="item-head"><h4>${d.icon} ${esc(d.title)}</h4><span class="deal-tag">${esc(d.tag)}</span></div>
      <p>${esc(d.desc)}</p>
      <div class="acts"><a href="${d.link}" target="_blank" rel="noopener">🔗 前往查看</a></div>
    </div>`).join('') +
    `<div class="section-label">🎫 交通票券優惠</div>` + PASSES.slice(0, 6).map(passCard).join('') +
    `<p class="disclaimer">※ 優惠內容可能隨時變動，請以各官方網站為準。</p>`;
}

/* ====================== 地圖 ====================== */
let map = null, mapLayer = null, meMarker = null;
const DAY_COLORS = ['#e60033', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2', '#65a30d'];
function pinIcon(color, label) {
  return L.divIcon({ className: '', html: `<div class="pin" style="background:${color}"><span>${label}</span></div>`, iconSize: [30, 30], iconAnchor: [15, 34], popupAnchor: [0, -30] });
}
function populateMapSelects() {
  $('#mapCity').innerHTML = Object.entries(CITIES).map(([id, c]) => `<option value="${id}">${c.emoji} ${c.name}</option>`).join('');
  let modes = '<option value="spots">📍 景點 & 美食</option>';
  if (state.trip) {
    modes += '<option value="trip">🧭 我的行程（全部）</option>';
    modes += state.trip.days.map((d, i) => `<option value="day-${i}">Day ${i + 1}｜${fmtDate(d.date)} ${CITIES[d.city].name.replace(/（.*）/, '')}</option>`).join('');
  }
  $('#mapMode').innerHTML = modes;
  if (![...$('#mapMode').options].some((o) => o.value === state.mapMode)) state.mapMode = 'spots';
  $('#mapMode').value = state.mapMode;
  if (state.trip && state.mapMode === 'spots' && !$('#mapCity').dataset.touched) $('#mapCity').value = state.trip.days[0].city;
}
function initMap() {
  if (!window.L) { $('#mapFallback').classList.remove('hidden'); $('#map').classList.add('hidden'); return; }
  if (!map) {
    map = L.map('map', { zoomControl: true }).setView([35.68, 139.76], 12);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO', subdomains: 'abcd', maxZoom: 19,
    }).addTo(map);
    mapLayer = L.layerGroup().addTo(map);
    $('#mapCity').addEventListener('change', (e) => { e.target.dataset.touched = 1; state.mapMode = 'spots'; $('#mapMode').value = 'spots'; drawMap(); });
    $('#mapMode').addEventListener('change', (e) => { state.mapMode = e.target.value; drawMap(); });
    $('#mapFilter').addEventListener('click', (e) => {
      const b = e.target.closest('.chip'); if (!b) return;
      state.mapFilter = b.dataset.id; drawMap();
    });
    $('#btnLocate').addEventListener('click', () => {
      if (!navigator.geolocation) return toast('裝置不支援定位');
      toast('定位中…');
      navigator.geolocation.getCurrentPosition((p) => {
        const ll = [p.coords.latitude, p.coords.longitude];
        if (meMarker) meMarker.remove();
        meMarker = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#2563eb', fillOpacity: 1 }).addTo(map).bindPopup('你在這裡');
        map.setView(ll, 15);
      }, () => toast('無法取得位置（需允許定位權限 / HTTPS）'), { enableHighAccuracy: true, timeout: 10000 });
    });
  }
  populateMapSelects();
  setTimeout(() => { map.invalidateSize(); drawMap(); }, 60);
}
function popupHtml(name, desc, q, extra = '') {
  return `<b>${esc(name)}</b><br>${esc(desc || '')}${extra}<br><a href="${gmap(q)}" target="_blank" rel="noopener">📍 在 Google 地圖開啟</a>`;
}
function drawMap() {
  if (!map) return;
  mapLayer.clearLayers();
  const bounds = [];
  const mode = state.mapMode;
  $('#mapFilter').classList.toggle('hidden', mode !== 'spots');
  $('#mapCity').disabled = mode !== 'spots';

  if (mode === 'spots') {
    const cid = $('#mapCity').value;
    const c = CITIES[cid];
    const filters = [['all', '全部'], ...Object.entries(TAGS).map(([k, t]) => [k, `${t.icon} ${t.label}`]), ['eat', '🍴 餐廳'], ['trip', '🚞 近郊']];
    $('#mapFilter').innerHTML = filters.map(([k, l]) => `<button class="chip ${state.mapFilter === k ? 'on' : ''}" data-id="${k}">${l}</button>`).join('');
    const f = state.mapFilter;
    if (f !== 'eat' && f !== 'trip') {
      c.spots.filter((s) => f === 'all' || s.t.includes(f)).forEach((s) => {
        L.marker([s.lat, s.lng], { icon: pinIcon('#e60033', TAGS[s.t[0]].icon) }).addTo(mapLayer)
          .bindPopup(popupHtml(s.n, s.desc, s.ja, `<br><small>⏱ ${s.d >= 8 ? '一整天' : s.d + ' 小時'}｜${s.fee ? yen(s.fee) : '免費'}</small>`));
        bounds.push([s.lat, s.lng]);
      });
    }
    if (f === 'all' || f === 'eat' || f === 'food') {
      c.foods.forEach((fd) => {
        L.marker([fd.lat, fd.lng], { icon: pinIcon('#d97706', '🍴') }).addTo(mapLayer)
          .bindPopup(popupHtml(fd.n, fd.desc, fd.ja + ' ' + CITY_JA[cid], `<br><small>💰 ${esc(fd.price)}｜${esc(fd.shops)}</small>`));
        bounds.push([fd.lat, fd.lng]);
      });
    }
    if (f === 'trip') {
      c.dayTrips.forEach((d) => {
        L.marker([d.lat, d.lng], { icon: pinIcon('#059669', '🚞') }).addTo(mapLayer).bindPopup(popupHtml(d.n, d.desc, d.ja));
        bounds.push([d.lat, d.lng]);
      });
      bounds.push([c.lat, c.lng]);
    }
  } else if (state.trip) {
    const days = mode === 'trip' ? state.trip.days.map((d, i) => [d, i]) : [[state.trip.days[+mode.split('-')[1]], +mode.split('-')[1]]];
    days.forEach(([d, i]) => {
      if (!d) return;
      const color = DAY_COLORS[i % DAY_COLORS.length];
      const pts = d.items.filter((it) => it.lat);
      pts.forEach((it, j) => {
        const label = mode === 'trip' ? `${i + 1}` : `${j + 1}`;
        L.marker([it.lat, it.lng], { icon: pinIcon(color, it.type === 'food' ? '🍴' : label) }).addTo(mapLayer)
          .bindPopup(popupHtml(it.name, `Day ${i + 1} ${fmtTime(it.time)}`, it.ja || it.name));
        bounds.push([it.lat, it.lng]);
      });
      if (pts.length > 1) L.polyline(pts.map((p) => [p.lat, p.lng]), { color, weight: 3, opacity: 0.7, dashArray: '6 6' }).addTo(mapLayer);
    });
  }
  if (bounds.length) map.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
}

/* ====================== 工具頁 ====================== */
let toolsInited = false;
const WCODE = (c) => c === 0 ? ['☀️', '晴'] : c <= 2 ? ['🌤️', '晴時多雲'] : c === 3 ? ['☁️', '陰'] : c <= 48 ? ['🌫️', '霧'] :
  c <= 57 ? ['🌦️', '毛毛雨'] : c <= 67 ? ['🌧️', '雨'] : c <= 77 ? ['❄️', '雪'] : c <= 82 ? ['🌧️', '陣雨'] : c <= 86 ? ['🌨️', '陣雪'] : ['⛈️', '雷雨'];

function fxUpdate(from) {
  const r = +$('#fxRate').value || state.rate;
  if (from === 'jpy') $('#fxTwd').value = (+$('#fxJpy').value * r).toFixed(0);
  else $('#fxJpy').value = (+$('#fxTwd').value / r).toFixed(0);
  $('#fxQuick').innerHTML = [500, 1000, 3000, 5000, 10000, 30000].map((v) => `<div><b>${yen(v)}</b>≈ NT$${Math.round(v * r).toLocaleString()}</div>`).join('');
}
async function fxFetch() {
  $('#fxInfo').textContent = '更新匯率中…';
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/JPY');
    const j = await res.json();
    const r = j?.rates?.TWD;
    if (!r) throw new Error();
    state.rate = r;
    LS.set('fxRate', r);
    LS.set('fxTime', Date.now());
    $('#fxRate').value = r.toFixed(4);
    $('#fxInfo').textContent = `市場參考匯率，更新於 ${new Date().toLocaleString('zh-TW')}（實際換匯請看銀行牌告）`;
    fxUpdate('jpy');
    renderTrip();
  } catch {
    $('#fxInfo').textContent = '無法取得即時匯率，可手動輸入。';
  }
}
async function loadWeather() {
  const c = CITIES[$('#weatherCity').value];
  const box = $('#weatherBody');
  box.innerHTML = '<span class="muted">載入中…</span>';
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lng}&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FTokyo`;
    const j = await (await fetch(url)).json();
    const d = j.daily;
    box.innerHTML = d.time.map((t, i) => {
      const [ic, label] = WCODE(d.weathercode[i]);
      return `<div class="wday"><div>${fmtDate(t).replace(/（(.)）/, ' $1')}</div><div class="ic">${ic}</div><div>${label}</div>
        <div><b>${Math.round(d.temperature_2m_max[i])}°</b> / ${Math.round(d.temperature_2m_min[i])}°</div><div>☔ ${d.precipitation_probability_max[i] ?? '-'}%</div></div>`;
    }).join('');
  } catch {
    box.innerHTML = '<span class="muted">無法取得天氣資料，請確認網路連線。</span>';
  }
}
function speak(text) {
  if (!('speechSynthesis' in window)) return toast('此瀏覽器不支援語音');
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'ja-JP'; u.rate = 0.9;
  const v = speechSynthesis.getVoices().find((x) => x.lang?.startsWith('ja'));
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}
function renderChecklist() {
  const done = new Set(LS.get('checklist', []));
  $('#checkBody').innerHTML = CHECKLIST.map((c, i) => `<label class="check ${done.has(i) ? 'done' : ''}"><input type="checkbox" data-i="${i}" ${done.has(i) ? 'checked' : ''}><span>${esc(c)}</span></label>`).join('');
  $('#checkCount').textContent = `${done.size}/${CHECKLIST.length}`;
}
function initTools() {
  if (toolsInited) return;
  toolsInited = true;
  // 匯率
  $('#fxRate').value = (+state.rate).toFixed(4);
  $('#fxJpy').addEventListener('input', () => fxUpdate('jpy'));
  $('#fxTwd').addEventListener('input', () => fxUpdate('twd'));
  $('#fxRate').addEventListener('input', () => { state.rate = +$('#fxRate').value || state.rate; LS.set('fxRate', state.rate); fxUpdate('jpy'); });
  $('#fxRefresh').addEventListener('click', fxFetch);
  fxUpdate('jpy');
  if (Date.now() - LS.get('fxTime', 0) > 6 * 3600e3) fxFetch();
  else $('#fxInfo').textContent = '匯率已快取，可按「更新」取得最新。';
  // 天氣
  $('#weatherCity').innerHTML = Object.entries(CITIES).map(([id, c]) => `<option value="${id}">${c.emoji} ${c.name}</option>`).join('');
  if (state.trip) $('#weatherCity').value = state.trip.days[0].city;
  $('#weatherCity').addEventListener('change', loadWeather);
  loadWeather();
  // 日語
  $('#phraseBody').innerHTML = PHRASES.map((p) => `<div class="phrase" data-ja="${esc(p.ja)}"><div><div class="jp">🔊 ${esc(p.ja)}</div><div class="ro">${esc(p.ro)}</div></div><div class="zh">${esc(p.zh)}</div></div>`).join('');
  $('#phraseBody').addEventListener('click', (e) => { const p = e.target.closest('.phrase'); if (p) speak(p.dataset.ja); });
  // 緊急
  $('#sosBody').innerHTML = EMERGENCY.map((s) => `<div class="sos"><span>${esc(s.name)}</span><a href="tel:${s.tel.replace(/-/g, '')}">📞 ${esc(s.tel)}</a></div>`).join('');
  // 清單
  renderChecklist();
  $('#checkBody').addEventListener('change', (e) => {
    const i = +e.target.dataset.i;
    const done = new Set(LS.get('checklist', []));
    e.target.checked ? done.add(i) : done.delete(i);
    LS.set('checklist', [...done]);
    renderChecklist();
  });
}

/* ====================== 啟動 ====================== */
function bindChipPage(sel, key, render) {
  $(sel).addEventListener('click', (e) => {
    const b = e.target.closest('.chip'); if (!b) return;
    state[key] = b.dataset.id; render();
  });
}
async function importTripFromUrl() {
  const code = new URLSearchParams(location.search).get('trip');
  if (!code) return;
  try {
    const imported = await decodeTripParam(code);
    if (!imported || !Array.isArray(imported.days) || !imported.days.length) return;
    state.trip = imported;
    LS.set('currentTrip', imported);
    saveTrip(imported);
    if (imported.opts) {
      applyFormFromPrefs(imported.opts);
      savePrefs();
    }
    renderPresets();
    renderTrip();
    history.replaceState({}, '', location.pathname + location.hash);
    if (currentTab() !== 'plan') location.hash = 'plan';
    setTimeout(() => $('#itinerary')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 150);
    toast('📥 已從專屬連結載入行程！');
  } catch {
    toast('專屬連結格式無效或已損毀');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  initPlanForm();
  initSheet();
  renderTrip();
  renderTransport();
  renderFood();
  renderDeals();
  bindChipPage('#transportCity', 'transportCity', renderTransport);
  bindChipPage('#foodCity', 'foodCity', renderFood);
  bindChipPage('#dealCat', 'dealCat', renderDeals);
  $('#itinerary').addEventListener('click', onItineraryClick);

  // 快速入口：工具卡片直接捲動到指定區塊
  $$('.quick-grid a[data-tool], .bento-card[data-tool]').forEach((a) => a.addEventListener('click', (e) => {
    e.preventDefault();
    if (location.hash !== '#tools') location.hash = 'tools'; else go('tools');
    setTimeout(() => $('#tool-' + a.dataset.tool)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
  }));

  go(currentTab());
  await importTripFromUrl();

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
});
