import React, { useEffect, useState } from "react";
import { X, Sparkles } from "lucide-react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { getPointSettings, updatePointSettings } from "../../api/members";

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

/** Quick presets so the admin does not have to reason about the number. */
const PRESETS = [1000, 5000, 10000, 25000, 50000];

/**
 * Point conversion setting.
 *
 * The rate is "rupiah spent per 1 point", applied to the sale's final total and
 * floored. One global rate for the whole business.
 */
export default function PointSettingsModal({ open, onClose }) {
  const qc = useQueryClient();

  const [rate, setRate] = useState("");
  const [enabled, setEnabled] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["member-point-settings"],
    enabled: open,
    queryFn: ({ signal }) => getPointSettings(signal),
  });

  useEffect(() => {
    if (!data) return;
    setRate(String(data.points_per_amount ?? 10000));
    setEnabled(data.enabled !== false);
  }, [data]);

  const mSave = useMutation({
    mutationFn: (payload) => updatePointSettings(payload),
    onSuccess: () => {
      toast.success("Pengaturan poin disimpan");
      qc.invalidateQueries({ queryKey: ["member-point-settings"] });
      onClose?.();
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal menyimpan pengaturan"),
  });

  if (!open) return null;

  const rateNum = Number(rate || 0);
  const valid = Number.isFinite(rateNum) && rateNum >= 1;

  const submit = (e) => {
    e.preventDefault();
    if (!valid) {
      toast.error("Nilai konversi minimal 1");
      return;
    }
    mSave.mutate({ points_per_amount: Math.round(rateNum), enabled });
  };

  // Live preview: the clearest way to explain a floor division.
  const examples = [25000, 100000, 350000];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl bg-white rounded-xl shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-amber-500" />
            Pengaturan Konversi Poin
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {isLoading ? (
          <div className="p-6 text-sm text-gray-500">Memuat...</div>
        ) : (
          <form onSubmit={submit} className="p-5 space-y-4">
            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
              <div>
                <div className="text-sm font-medium">Program Poin Aktif</div>
                <div className="text-[11px] text-gray-500">
                  Kalau dimatikan, transaksi tidak menambah poin
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEnabled((v) => !v)}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
                  enabled ? "bg-blue-600" : "bg-gray-300"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    enabled ? "translate-x-4" : "translate-x-1"
                  }`}
                />
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Belanja per 1 poin
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  Rp
                </span>
                <input
                  type="number"
                  min={1}
                  value={rate}
                  onChange={(e) => setRate(e.target.value)}
                  className="w-full h-11 rounded-lg border border-gray-300 pl-10 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="mt-2 flex flex-wrap gap-1.5">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setRate(String(p))}
                    className={`px-2 py-1 rounded-full border text-[11px] ${
                      Number(rate) === p
                        ? "bg-blue-50 border-blue-300 text-blue-700"
                        : "border-gray-300 text-gray-600"
                    }`}
                  >
                    {rupiah(p)}
                  </button>
                ))}
              </div>
            </div>

            {valid && (
              <div className="rounded-lg bg-blue-50 border border-blue-200 px-3 py-2.5">
                <div className="text-[11px] font-semibold text-blue-800 uppercase tracking-wide">
                  Simulasi
                </div>
                <ul className="mt-1 space-y-0.5">
                  {examples.map((amt) => (
                    <li key={amt} className="text-xs text-blue-900">
                      Belanja {rupiah(amt)} →{" "}
                      <b>{Math.floor(amt / rateNum)} poin</b>
                    </li>
                  ))}
                </ul>
                <div className="mt-1.5 text-[11px] text-blue-700">
                  Sisa belanja yang belum genap 1 poin tidak disimpan.
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm rounded-lg border"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={mSave.isPending || !valid}
                className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
              >
                {mSave.isPending ? "Menyimpan..." : "Simpan"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
