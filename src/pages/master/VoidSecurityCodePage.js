import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { KeyRound, ShieldCheck } from "lucide-react";
import toast from "react-hot-toast";

import {
  getVoidSecurityCodeStatus,
  updateVoidSecurityCode,
} from "../../api/appSettings";

export default function VoidSecurityCodePage() {
  const qc = useQueryClient();
  const [parentStoreId, setParentStoreId] = useState("");
  const [code, setCode] = useState("");
  const [confirm, setConfirm] = useState("");

  const listQ = useQuery({
    queryKey: ["void-security-code", "list"],
    queryFn: ({ signal }) => getVoidSecurityCodeStatus({}, signal),
  });

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

  const saveM = useMutation({
    mutationFn: ({ value, storeId }) => updateVoidSecurityCode(value, storeId),
    onSuccess: () => {
      toast.success("Kode keamanan void berhasil diperbarui");
      setCode("");
      setConfirm("");
      qc.invalidateQueries({ queryKey: ["void-security-code"] });
    },
    onError: (e) => {
      const msg =
        e?.response?.data?.message ||
        e?.message ||
        "Gagal menyimpan kode keamanan";
      toast.error(msg);
    },
  });

  const onSubmit = (e) => {
    e.preventDefault();
    if (!parentStoreId) {
      toast.error("Pilih parent store dulu");
      return;
    }
    const next = String(code || "").trim();
    const again = String(confirm || "").trim();
    if (next.length < 4) {
      toast.error("Kode minimal 4 karakter");
      return;
    }
    if (next !== again) {
      toast.error("Konfirmasi kode tidak sama");
      return;
    }
    saveM.mutate({ value: next, storeId: Number(parentStoreId) });
  };

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
                Setiap parent store punya 1 kode sendiri. Semua cabang di bawah
                parent itu memakai kode yang sama saat kasir void transaksi.
              </p>
            </div>
          </div>

          <form onSubmit={onSubmit} className="space-y-4">
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
                    {p.configured ? " (sudah diatur)" : " (default 2580)"}
                  </option>
                ))}
              </select>
            </div>

            {parentStoreId && (
              <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 flex items-center gap-2 text-sm">
                <ShieldCheck
                  className={`w-4 h-4 ${
                    selected?.configured ? "text-emerald-600" : "text-amber-600"
                  }`}
                />
                <span className="text-slate-700">
                  Status:{" "}
                  <span className="font-medium">
                    {selected?.configured
                      ? "Sudah dikonfigurasi"
                      : "Belum dikonfigurasi (default: 2580)"}
                  </span>
                </span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kode baru
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="Minimal 4 karakter"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Konfirmasi kode
              </label>
              <input
                type="password"
                inputMode="numeric"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Ulangi kode baru"
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={saveM.isPending || !parentStoreId}
              className="w-full px-4 py-2.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              {saveM.isPending ? "Menyimpan..." : "Simpan Kode Keamanan"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
