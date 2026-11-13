/// <reference types="google.maps" />
import React, { useEffect, useMemo, useState } from 'react';
import {
  APIProvider,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  useAdvancedMarkerRef,
  useMap,
} from '@vis.gl/react-google-maps';
import { LocateFixed, MapPin } from 'lucide-react';
import { CITIES, TAGS } from '../data/japanData';
import { CityId, TagId, Trip } from '../types/trip';
import { fmtDate, fmtTime, gmap, yen } from '../utils/tripEngine';

interface MapPageProps {
  trip: Trip | null;
  mapMode: string;
  onChangeMapMode: (mode: string) => void;
  onNotify: (msg: string) => void;
}

interface MapEntry {
  id: string;
  name: string;
  subtitle: string;
  desc: string;
  lat: number;
  lng: number;
  query: string;
  color: string;
  label: string;
}

interface RouteSegment {
  key: string;
  color: string;
  path: google.maps.LatLngLiteral[];
}

const DAY_COLORS = ['#D93829', '#18181B', '#2563EB', '#059669', '#D97706', '#7C3AED', '#0891B2'];
const DEFAULT_CENTER: google.maps.LatLngLiteral = { lat: 35.6812, lng: 139.7671 };

const SpotAdvancedMarker: React.FC<{
  entry: MapEntry;
  isSelected: boolean;
  onSelect: () => void;
  onClose: () => void;
}> = ({ entry, isSelected, onSelect, onClose }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={{ lat: entry.lat, lng: entry.lng }}
        title={entry.name}
        zIndex={isSelected ? 50 : 10}
        onClick={onSelect}
      >
        <div
          className={`flex h-7 w-7 items-center justify-center rounded-full border-2 border-white font-mono-num text-[11px] font-bold text-white shadow-md transition-transform duration-150 ${
            isSelected ? 'scale-125 ring-2 ring-zinc-950/30' : 'hover:scale-110'
          }`}
          style={{ backgroundColor: entry.color }}
        >
          {entry.label}
        </div>
      </AdvancedMarker>

      {isSelected && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={260}
          onCloseClick={onClose}
        >
          <div className="min-w-[180px] p-0.5 text-zinc-900">
            <div className="text-sm font-bold leading-snug">{entry.name}</div>
            <div className="mt-0.5 text-xs text-zinc-500">{entry.subtitle}</div>
            {entry.desc && (
              <p className="mt-1.5 text-xs text-zinc-700 leading-relaxed line-clamp-3">
                {entry.desc}
              </p>
            )}
            <a
              href={gmap(entry.query)}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#D93829] hover:underline"
            >
              在 Google 地圖開啟 →
            </a>
          </div>
        </InfoWindow>
      )}
    </>
  );
};

const UserLocationMarker: React.FC<{
  position: google.maps.LatLngLiteral;
}> = ({ position }) => {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(true);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        title="你的目前位置"
        zIndex={60}
        onClick={() => setOpen(true)}
      >
        <div className="h-4 w-4 rounded-full border-2 border-white bg-blue-600 shadow-md ring-4 ring-blue-600/20" />
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow anchor={marker} onCloseClick={() => setOpen(false)}>
          <div className="text-xs font-semibold text-zinc-900">你的目前位置</div>
        </InfoWindow>
      )}
    </>
  );
};

const MapViewportAndRoutes: React.FC<{
  entries: MapEntry[];
  routes: RouteSegment[];
  focusTarget: { lat: number; lng: number; seq: number } | null;
  viewportKey: string;
}> = ({ entries, routes, focusTarget, viewportKey }) => {
  const map = useMap();

  // Fit bounds when mode, city, or filter changes
  useEffect(() => {
    if (!map || entries.length === 0) return;

    if (entries.length === 1) {
      map.panTo({ lat: entries[0].lat, lng: entries[0].lng });
      map.setZoom(14);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    entries.forEach((e) => bounds.extend({ lat: e.lat, lng: e.lng }));
    map.fitBounds(bounds, { top: 44, right: 44, bottom: 44, left: 44 });
  }, [map, entries, viewportKey]);

  // Pan to specific spot or user location when clicked
  useEffect(() => {
    if (!map || !focusTarget) return;
    map.panTo({ lat: focusTarget.lat, lng: focusTarget.lng });
    const currentZoom = map.getZoom() ?? 12;
    if (currentZoom < 15) {
      map.setZoom(15);
    }
  }, [map, focusTarget]);

  // Draw dashed route polylines for trip / day modes
  useEffect(() => {
    if (!map || routes.length === 0) return;

    const polylines = routes.map(
      (seg) =>
        new google.maps.Polyline({
          map,
          path: seg.path,
          geodesic: true,
          strokeColor: seg.color,
          strokeOpacity: 0,
          strokeWeight: 2.5,
          icons: [
            {
              icon: {
                path: 'M 0,-1 0,1',
                strokeOpacity: 0.85,
                strokeWeight: 2.5,
                scale: 3,
              },
              offset: '0',
              repeat: '14px',
            },
          ],
        })
    );

    return () => {
      polylines.forEach((p) => p.setMap(null));
    };
  }, [map, routes]);

  return null;
};

export const MapPage: React.FC<MapPageProps> = ({
  trip,
  mapMode,
  onChangeMapMode,
  onNotify,
}) => {
  const [selectedCity, setSelectedCity] = useState<CityId>(
    trip?.days[0]?.city || 'tokyo'
  );
  const [spotFilter, setSpotFilter] = useState<string>('all');
  const [activePlaceId, setActivePlaceId] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<google.maps.LatLngLiteral | null>(null);
  const [focusTarget, setFocusTarget] = useState<{ lat: number; lng: number; seq: number } | null>(null);
  const [mapsLoadError, setMapsLoadError] = useState(false);

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

  const effectiveMode = useMemo(() => {
    if (mapMode === 'spots') return 'spots';
    if (!trip) return 'spots';
    if (mapMode === 'trip') return 'trip';
    if (mapMode.startsWith('day-')) {
      const idx = Number(mapMode.split('-')[1]);
      if (trip.days[idx]) return mapMode;
    }
    return 'spots';
  }, [mapMode, trip]);

  const entries = useMemo<MapEntry[]>(() => {
    const list: MapEntry[] = [];
    if (effectiveMode === 'spots') {
      const c = CITIES[selectedCity];
      if (spotFilter !== 'eat' && spotFilter !== 'trip') {
        c.spots
          .filter((s) => spotFilter === 'all' || s.t.includes(spotFilter as TagId))
          .forEach((s, idx) => {
            list.push({
              id: `spot_${s.n}`,
              name: s.n,
              subtitle: `${s.a} · ${s.d >= 8 ? '一整天' : `${s.d} 小時`} · ${s.fee ? yen(s.fee) : '免費'}`,
              desc: s.desc,
              lat: s.lat,
              lng: s.lng,
              query: s.ja,
              color: '#D93829',
              label: String(idx + 1),
            });
          });
      }
      if (spotFilter === 'all' || spotFilter === 'eat' || spotFilter === 'food') {
        c.foods.forEach((fd) => {
          list.push({
            id: `food_${fd.n}`,
            name: fd.n,
            subtitle: `${fd.a} · ${fd.price} · ${fd.shops}`,
            desc: fd.desc,
            lat: fd.lat,
            lng: fd.lng,
            query: `${fd.ja} ${c.jaName}`,
            color: '#D97706',
            label: '食',
          });
        });
      }
      if (spotFilter === 'trip') {
        c.dayTrips.forEach((dt, idx) => {
          list.push({
            id: `dt_${dt.n}`,
            name: dt.n,
            subtitle: '近郊推薦',
            desc: dt.desc,
            lat: dt.lat,
            lng: dt.lng,
            query: dt.ja,
            color: '#059669',
            label: `郊${idx + 1}`,
          });
        });
      }
    } else if (trip) {
      const targetDays =
        effectiveMode === 'trip'
          ? trip.days.map((d, i) => ({ d, i }))
          : [{ d: trip.days[Number(effectiveMode.split('-')[1])], i: Number(effectiveMode.split('-')[1]) }];

      targetDays.forEach(({ d, i }) => {
        if (!d) return;
        const color = DAY_COLORS[i % DAY_COLORS.length];
        const pts = d.items.filter((it) => it.lat != null && it.lng != null);
        pts.forEach((it, j) => {
          list.push({
            id: it.id,
            name: it.name,
            subtitle: `Day ${i + 1} · ${fmtTime(it.time)} · ${CITIES[d.city].shortName}`,
            desc: it.desc || it.sub || '',
            lat: it.lat!,
            lng: it.lng!,
            query: it.ja || it.name,
            color,
            label: effectiveMode === 'trip' ? `D${i + 1}` : `${j + 1}`,
          });
        });
      });
    }
    return list;
  }, [effectiveMode, selectedCity, spotFilter, trip]);

  const routeSegments = useMemo<RouteSegment[]>(() => {
    if (effectiveMode === 'spots' || !trip) return [];
    const targetDays =
      effectiveMode === 'trip'
        ? trip.days.map((d, i) => ({ d, i }))
        : [{ d: trip.days[Number(effectiveMode.split('-')[1])], i: Number(effectiveMode.split('-')[1]) }];

    const segs: RouteSegment[] = [];
    targetDays.forEach(({ d, i }) => {
      if (!d) return;
      const pts = d.items.filter((it) => it.lat != null && it.lng != null);
      if (pts.length > 1) {
        segs.push({
          key: `day-route-${i}`,
          color: DAY_COLORS[i % DAY_COLORS.length],
          path: pts.map((p) => ({ lat: p.lat!, lng: p.lng! })),
        });
      }
    });
    return segs;
  }, [effectiveMode, trip]);

  const handleFocusPlace = (entry: MapEntry) => {
    setActivePlaceId(entry.id);
    setFocusTarget((prev) => ({
      lat: entry.lat,
      lng: entry.lng,
      seq: (prev?.seq ?? 0) + 1,
    }));
  };

  const handleLocate = () => {
    if (!navigator.geolocation) {
      onNotify('您的裝置不支援地理定位');
      return;
    }
    onNotify('正在取得目前位置…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const ll = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(ll);
        setFocusTarget((prev) => ({
          ...ll,
          seq: (prev?.seq ?? 0) + 1,
        }));
      },
      () => onNotify('無法取得位置（請確認瀏覽器定位權限）'),
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const viewportKey = `${effectiveMode}|${selectedCity}|${spotFilter}|${trip?.id ?? ''}`;

  return (
    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-5 sm:py-6">
      {/* Controls Bar */}
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 mb-4 space-y-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <select
            aria-label="選擇城市"
            value={selectedCity}
            disabled={effectiveMode !== 'spots'}
            onChange={(e) => {
              setSelectedCity(e.target.value as CityId);
              setActivePlaceId(null);
              onChangeMapMode('spots');
            }}
            className="h-10 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900 disabled:opacity-45"
          >
            {(Object.keys(CITIES) as CityId[]).map((id) => (
              <option key={id} value={id}>
                {CITIES[id].emoji} {CITIES[id].name}
              </option>
            ))}
          </select>

          <select
            aria-label="檢視模式"
            value={effectiveMode}
            onChange={(e) => {
              setActivePlaceId(null);
              onChangeMapMode(e.target.value);
            }}
            className="h-10 flex-1 min-w-[180px] rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-900"
          >
            <option value="spots">探索景點與美食</option>
            {trip && <option value="trip">我的行程（全部路線）</option>}
            {trip &&
              trip.days.map((d, i) => (
                <option key={i} value={`day-${i}`}>
                  Day {i + 1} · {fmtDate(d.date)} {CITIES[d.city].shortName}
                </option>
              ))}
          </select>

          <button
            type="button"
            onClick={handleLocate}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-xs font-semibold text-zinc-800 hover:bg-zinc-50 cursor-pointer"
          >
            <LocateFixed className="h-4 w-4 text-[#D93829]" />
            <span className="hidden sm:inline">目前位置</span>
          </button>
        </div>

        {effectiveMode === 'spots' && (
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-0.5">
            {[
              ['all', '全部'],
              ...(Object.keys(TAGS) as TagId[]).map((k) => [k, TAGS[k].label]),
              ['eat', '在地美食'],
              ['trip', '近郊推薦'],
            ].map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  setActivePlaceId(null);
                  setSpotFilter(k);
                }}
                className={`min-h-[34px] shrink-0 rounded-lg px-3 py-1 text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap ${
                  spotFilter === k
                    ? 'bg-zinc-900 text-white'
                    : 'border border-zinc-200 bg-zinc-50 text-zinc-600 hover:text-zinc-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Synchronized Google Map + Place List */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-stretch">
        <div className="h-[420px] lg:h-[600px] w-full rounded-2xl border border-zinc-200 bg-zinc-100 overflow-hidden relative">
          {!apiKey || mapsLoadError ? (
            <div className="flex h-full w-full flex-col items-center justify-center p-6 text-center bg-zinc-50">
              <MapPin className="h-8 w-8 text-zinc-400 mb-3" />
              <p className="text-sm font-semibold text-zinc-900">
                無法載入互動式 Google 地圖
              </p>
              <p className="mt-1.5 max-w-sm text-xs text-zinc-500 leading-relaxed">
                {mapsLoadError
                  ? 'Google Maps 載入時發生異常或配額限制，您仍可從右側地點列表直接開啟 Google 地圖導航。'
                  : '目前環境尚未注入地圖金鑰，您仍可從右側地點列表點擊任一景點開啟 Google 地圖導航。'}
              </p>
            </div>
          ) : (
            <APIProvider
              apiKey={apiKey}
              libraries={['marker']}
              language="zh-TW"
              region="JP"
              onError={() => setMapsLoadError(true)}
            >
              <GoogleMap
                mapId="DEMO_MAP_ID"
                defaultCenter={DEFAULT_CENTER}
                defaultZoom={12}
                gestureHandling="greedy"
                mapTypeControl={false}
                streetViewControl={false}
                fullscreenControl={true}
                internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                className="h-full w-full"
              >
                <MapViewportAndRoutes
                  entries={entries}
                  routes={routeSegments}
                  focusTarget={focusTarget}
                  viewportKey={viewportKey}
                />

                {entries.map((entry) => (
                  <SpotAdvancedMarker
                    key={entry.id}
                    entry={entry}
                    isSelected={activePlaceId === entry.id}
                    onSelect={() => setActivePlaceId(entry.id)}
                    onClose={() => setActivePlaceId(null)}
                  />
                ))}

                {userLocation && <UserLocationMarker position={userLocation} />}
              </GoogleMap>
            </APIProvider>
          )}
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-white flex flex-col max-h-[360px] lg:max-h-[600px]">
          <div className="border-b border-zinc-100 px-4 py-3 flex items-center justify-between">
            <span className="text-sm font-bold text-zinc-950">地點列表</span>
            <span className="text-xs text-zinc-400 tabular-nums">{entries.length} 處</span>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-zinc-100">
            {entries.length === 0 ? (
              <div className="p-6 text-center text-xs text-zinc-500">目前篩選條件下無標記地點</div>
            ) : (
              entries.map((entry) => {
                const isSelected = activePlaceId === entry.id;
                return (
                  <div
                    key={entry.id}
                    className={`p-3.5 transition-colors cursor-pointer ${
                      isSelected ? 'bg-zinc-50' : 'hover:bg-zinc-50/70'
                    }`}
                    onClick={() => handleFocusPlace(entry)}
                  >
                    <div className="flex items-start gap-2.5">
                      <span
                        className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white font-mono-num"
                        style={{ backgroundColor: entry.color }}
                      >
                        {entry.label}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-semibold text-zinc-900 truncate">{entry.name}</div>
                        <div className="text-xs text-zinc-500 mt-0.5 truncate">{entry.subtitle}</div>
                        <a
                          href={gmap(entry.query)}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-semibold text-[#D93829] hover:underline"
                        >
                          <MapPin className="h-3 w-3" />
                          開啟導航
                        </a>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
