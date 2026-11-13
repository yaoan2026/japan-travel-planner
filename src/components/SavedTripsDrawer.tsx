import React, { useRef } from 'react';
import { Download, Link2, Pin, Trash2, Upload, X } from 'lucide-react';
import { Trip } from '../types/trip';
import { fmtDate, ymd } from '../utils/tripEngine';

interface SavedTripsDrawerProps {
  open: boolean;
  onClose: () => void;
  trips: Trip[];
  onLoadTrip: (trip: Trip) => void;
  onTogglePin: (id: string) => void;
  onCopyLink: (trip: Trip) => void;
  onDeleteTrip: (id: string) => void;
  onImportTrips: (trips: Trip[]) => void;
  onNotify: (msg: string) => void;
}

export const SavedTripsDrawer: React.FC<SavedTripsDrawerProps> = ({
  open,
  onClose,
  trips,
  onLoadTrip,
  onTogglePin,
  onCopyLink,
  onDeleteTrip,
  onImportTrips,
  onNotify,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!open) return null;

  const handleExport = () => {
    if (!trips.length) {
      onNotify('目前沒有可匯出的儲存行程');
      return;
    }
    const blob = new Blob([JSON.stringify({ version: 1, trips }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `japan-trips-${ymd(new Date())}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    onNotify('已下載行程備份檔');
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      const incoming = Array.isArray(data) ? data : Array.isArray(data?.trips) ? data.trips : [];
      if (!incoming.length) throw new Error('empty');
      onImportTrips(incoming);
    } catch {
      onNotify('備份檔格式不正確');
    }
    e.target.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end items-end md:items-stretch">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-zinc-950/30 backdrop-blur-[2px] transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer / Sheet */}
      <aside
        role="dialog"
        aria-label="我的儲存行程"
        className="relative z-10 flex w-full max-h-[85vh] md:max-h-full md:max-w-md flex-col rounded-t-2xl md:rounded-none border-t md:border-t-0 md:border-l border-zinc-200 bg-white shadow-2xl"
      >
        {/* Mobile grab handle */}
        <div className="md:hidden pt-3 pb-1 flex justify-center">
          <div className="h-1 w-10 rounded-full bg-zinc-300" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
          <div>
            <h2 className="text-base font-bold text-zinc-950">我的儲存行程</h2>
            <p className="text-xs text-zinc-500 mt-0.5">儲存於本機瀏覽器，支援離線查閱與連結分享</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 transition-colors cursor-pointer"
            aria-label="關閉"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          {trips.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-sm font-medium text-zinc-700">尚無儲存的行程</p>
              <p className="mt-1 text-xs text-zinc-500">生成行程後點擊「儲存」，即可在此快速開啟與備份。</p>
            </div>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {trips.map((t) => (
                <li key={t.id} className="py-3.5 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    onClick={() => onLoadTrip(t)}
                    className="flex-1 min-w-0 text-left group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      {t.pinned && <Pin className="h-3.5 w-3.5 shrink-0 text-[#D93829] fill-[#D93829]" />}
                      <span className="truncate text-sm font-semibold text-zinc-900 group-hover:text-[#D93829] transition-colors">
                        {t.title}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-500 tabular-nums">
                      <span>{fmtDate(t.opts.start)} 出發</span>
                      <span aria-hidden="true">·</span>
                      <span>{t.opts.days} 天</span>
                    </div>
                  </button>

                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => onTogglePin(t.id)}
                      title={t.pinned ? '取消釘選' : '釘選至規劃頁'}
                      className={`flex h-9 w-9 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                        t.pinned
                          ? 'border-[#D93829]/30 bg-[#D93829]/5 text-[#D93829]'
                          : 'border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
                      }`}
                    >
                      <Pin className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onCopyLink(t)}
                      title="複製專屬同步連結"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900 transition-colors cursor-pointer"
                    >
                      <Link2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteTrip(t.id)}
                      title="刪除行程"
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 hover:border-red-200 hover:bg-red-50 hover:text-red-600 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer Backup Actions */}
        <div className="border-t border-zinc-200 bg-zinc-50/70 px-5 py-3.5 pb-[calc(14px+env(safe-area-inset-bottom))] flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleExport}
            className="flex-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            匯出備份
          </button>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs font-semibold text-zinc-800 hover:bg-zinc-100 transition-colors cursor-pointer"
          >
            <Upload className="h-3.5 w-3.5" />
            匯入備份
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      </aside>
    </div>
  );
};
