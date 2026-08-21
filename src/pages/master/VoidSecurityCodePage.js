import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock3, Copy, KeyRound, RefreshCw } from "lucide-react";
import toast from "react-hot-toast";

import {
  getVoidSecurityCodeStatus,
  rotateVoidSecurityCode,
} from "../../api/appSettings";

function formatCountdown(validUntil) {
  if (!validUntil) return "—";
  const end = new Date(validUntil).getTime();
  const totalSec = Math.max(0, Math.ceil((end - Date.now()) / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function VoidSecurityCodePage() {
  const queryClient = useQueryClient();
  const [parentStoreId, setParentStoreId] = useState("");
  const [nowTick, setNowTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const listQ = useQuery({
    queryKey: ["void-security-code", "list"],
    queryFn: ({ signal }) => getVoidSecurityCodeStatus({}, signal),
    refetchInterval: 30_000,
    staleTime: 0,
  });

  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const parentOptions = useMemo(
    () => (Array.isArray(listQ.data?.items) ? listQ.data.items : []),
    [listQ.data]
  );

  const selected = useMemo(
    () =>
      parentOptions.find((p) => String(p.owner_store_id) === String(parentStoreId)) ||
      null,
    [parentOptions, parentStoreId]
  );

  const validUntil = selected?.valid_until ?? parentOptions[0]?.valid_until;

  useEffect(() => {
    if (!validUntil) return undefined;
    const ms = new Date(validUntil).getTime() - Date.now() + 800;
    if (ms <= 0) {
      listQ.refetch();
      return undefined;
    }
    const t = setTimeout(() => listQ.refetch(), Math.min(ms, 10 * 60 * 1000));
    return () => clearTimeout(t);
  }, [validUntil, listQ.refetch]);

  useEffect(() => {
    if (!parentStoreId && parentOptions.length === 1) {
      setParentStoreId(String(parentOptions[0].owner_store_id));
    }
  }, [parentStoreId, parentOptions]);

  const copyCode = async () => {
    const code = selected?.security_code;
    if (!code) return;
    try {
      await navigator.clipboard.writeText(String(code));
      toast.success("Kode disalin");
    } catch {
      toast.error("Gagal menyalin kode");
    }
  };

  const handleRefresh = async () => {
    if (refreshing || !parentStoreId) return;
    setRefreshing(true);
    try {
      await rotateVoidSecurityCode(Number(parentStoreId));
      await queryClient.invalidateQueries({
        queryKey: ["void-security-code"],
      });
      const result = await listQ.refetch({ cancelRefetch: false });
      if (result.error) {
        toast.error("Gagal mengganti kode void");
        return;
      }
      toast.success("Kode void diganti");
    } catch {
      toast.error("Gagal mengganti kode void");
    } finally {
      setRefreshing(false);
    }
  };

  const isBusy = refreshing || listQ.isFetching;

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-xl mx-auto">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-start gap-3 mb-6">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-700">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                Kode Keamanan Void
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Kode diganti otomatis setiap 10 menit (Asia/Jakarta). Tekan
                Refresh untuk mengganti kode sekarang. Setiap parent store punya
                kode sendiri — semua cabang di bawahnya memakai kode yang sama.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Parent Store
              </label>
              <select
                value={parentStoreId}
                onChange={(e) => setParentStoreId(e.target.value)}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none bg-white"
              >
                <option value="">Pilih parent store</option>
                {parentOptions.map((p) => (
                  <option key={p.owner_store_id} value={p.owner_store_id}>
                    {p.owner_store_name}
                  </option>
                ))}
              </select>
            </div>

            {listQ.isError && (
              <p className="text-sm text-red-600">
                Gagal memuat kode. Coba Refresh atau muat ulang halaman.
              </p>
            )}

            {parentStoreId && selected && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
                <div className="text-xs uppercase tracking-wide text-slate-500 font-medium">
                  Kode aktif saat ini
                </div>
                <div className="flex items-center justify-between gap-3">
                  <div className="text-4xl font-bold tracking-[0.35em] text-slate-900 font-mono pl-1">
                    {selected.security_code || "————"}
                  </div>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-sm text-slate-700 hover:bg-slate-100"
                  >
                    <Copy className="w-4 h-4" />
                    Salin
                  </button>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="w-4 h-4 text-slate-400" />
                    Ganti dalam {formatCountdown(selected.valid_until)}
                    <span className="sr-only">{nowTick}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={isBusy}
                    className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isBusy ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>
                </div>
              </div>
            )}

            {!parentStoreId && (
              <p className="text-sm text-slate-500">
                Pilih parent store untuk melihat kode void saat ini.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
