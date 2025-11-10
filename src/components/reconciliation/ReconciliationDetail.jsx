// src/components/reconciliation/ReconciliationDetail.jsx
import React, { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, FileUp, Loader2 } from "lucide-react";
import toast from "react-hot-toast";
import {
  getReconciliation,
  uploadReconciliationFile,
  applyReconciliation,
} from "../../api/stockReconciliation";

const fmtIDR = (n) =>
  (Number(n ?? 0) || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const ymd = (s) => {
  if (!s) return "-";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s).slice(0, 10) : d.toISOString().slice(0, 10);
};

export default function ReconciliationDetail({ id, onBack }) {
  const qc = useQueryClient();
  const inputRef = useRef(null);
  const [fileName, setFileName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["recon:detail", id],
    queryFn: () => getReconciliation(id),
    enabled: !!id,
  });

  const uploadMut = useMutation({
    mutationFn: ({ file }) => uploadReconciliationFile(id, file),
    onSuccess: () => {
      toast.success("File berhasil diunggah");
      qc.invalidateQueries({ queryKey: ["recon:detail", id] });
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Gagal upload"),
  });

  const applyMut = useMutation({
    mutationFn: () => applyReconciliation(id),
    onSuccess: () => {
      toast.success("Rekonsiliasi diterapkan (stok terupdate)");
      qc.invalidateQueries({ queryKey: ["recon:detail", id] });
      qc.invalidateQueries({ queryKey: ["recon:list"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Gagal apply"),
  });

  // Normalisasi respons BE: { reconciliation, items }
  const recRaw = data?.reconciliation ?? data?.data?.reconciliation ?? data ?? {};
  const items = data?.items ?? data?.data?.items ?? [];

  const rec = useMemo(() => {
    const status = (recRaw.status ?? "DRAFT").toUpperCase();
    return {
      id: recRaw.id,
      reference_code: recRaw.reference_code ?? recRaw.ref_code ?? recRaw.code ?? "-",
      status,
      store_name: recRaw.store?.name ?? recRaw.store_name ?? recRaw.store_id ?? recRaw.store_location_id ?? "-",
      user_name: recRaw.user?.name ?? recRaw.user_name ?? (recRaw.user_id ? `User #${recRaw.user_id}` : "-"),
      date_from: recRaw.date_from,
      date_to: recRaw.date_to,
      total_items: recRaw.total_items ?? items?.length ?? 0,
      total_value: recRaw.total_value ?? 0,
    };
  }, [recRaw, items]);

  const statusClass =
    rec.status === "APPLIED"
      ? "bg-green-100 text-green-700"
      : "bg-yellow-100 text-yellow-700";

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header card: Back + Title + Actions */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-gray-50"
          >
            <ArrowLeft size={16} /> Back
          </button>
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Stock Reconciliation Detail</h2>
            <p className="text-sm text-gray-500">Ref: {rec.reference_code}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 border hover:bg-gray-50 disabled:opacity-60"
            disabled={uploadMut.isLoading || isLoading || rec.status !== "DRAFT"}
            title={rec.status !== "DRAFT" ? "Hanya DRAFT yang dapat diunggah" : "Upload XLSX"}
          >
            {uploadMut.isLoading ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
            Upload XLSX
          </button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                setFileName(f.name);
                uploadMut.mutate({ file: f });
                e.target.value = ""; // reset agar bisa pilih file sama lagi
              }
            }}
          />

          <button
            disabled={applyMut.isLoading || isLoading || rec.status !== "DRAFT"}
            onClick={() => applyMut.mutate()}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50"
            title={rec.status !== "DRAFT" ? "Hanya DRAFT yang bisa di-apply" : "Apply"}
          >
            {applyMut.isLoading ? (
              <Loader2 className="animate-spin" size={16} />
            ) : (
              <CheckCircle2 size={16} />
            )}
            Apply
          </button>
        </div>
      </div>

      {/* Info ringkas (card) */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
        {isLoading ? (
          <div className="text-sm text-gray-500">Loading...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            <Info label="Ref Code" value={rec.reference_code} />
            <Info
              label="Status"
              value={
                <span className={`px-2 py-1 rounded-lg text-xs ${statusClass}`}>
                  {rec.status}
                </span>
              }
            />
            <Info label="Rekonsiliator" value={rec.user_name ?? "-"} />
            <Info label="Store" value={rec.store_name ?? "-"} />
            <Info label="Periode" value={`${ymd(rec.date_from)} – ${ymd(rec.date_to)}`} />
            <Info
              label="Ringkasan"
              value={
                <div className="flex flex-col">
                  <span className="text-sm">
                    Total Item: <span className="font-medium">{rec.total_items ?? 0}</span>
                  </span>
                  <span className="text-sm">
                    Total Value: <span className="font-medium">{fmtIDR(rec.total_value)}</span>
                  </span>
                </div>
              }
            />
          </div>
        )}

        {fileName && !isLoading && (
          <div className="mt-3 text-xs text-gray-500">
            File terakhir diunggah: <span className="font-medium">{fileName}</span>
          </div>
        )}
      </div>

      {/* Tabel detail item */}
      <div className="bg-white border border-gray-200 rounded-lg mt-4">
        <div className="relative w-full overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-600">
              <tr>
                <th className="text-left px-4 py-3">SKU</th>
                <th className="text-left px-4 py-3">Product</th>
                <th className="text-right px-4 py-3">System Stock</th>
                <th className="text-right px-4 py-3">Real Stock</th>
                <th className="text-right px-4 py-3">Diff</th>
                <th className="text-right px-4 py-3">Avg Cost</th>
                <th className="text-right px-4 py-3">Impact Value</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center">
                    Loading...
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-gray-500">
                    Belum ada detail item. Unggah file Excel hasil pengisian untuk mengisi Real Stock.
                  </td>
                </tr>
              ) : (
                items.map((it) => {
                  const sys = Number(it.system_stock ?? 0);
                  const real = it.real_stock == null ? null : Number(it.real_stock);
                  const diff = real == null ? 0 : real - sys;
                  const avg = Number(it.avg_cost ?? 0);
                  const impact = Math.abs(diff) * avg;
                  return (
                    <tr key={it.id ?? `${it.product_id}-${it.sku}`} className="border-t">
                      <td className="px-4 py-2">{it.sku ?? ""}</td>
                      <td className="px-4 py-2">{it.name ?? "-"}</td>
                      <td className="px-4 py-2 text-right">{sys}</td>
                      <td className="px-4 py-2 text-right">{real == null ? "-" : real}</td>
                      <td className="px-4 py-2 text-right">{real == null ? "-" : diff}</td>
                      <td className="px-4 py-2 text-right">{fmtIDR(avg)}</td>
                      <td className="px-4 py-2 text-right">{real == null ? "-" : fmtIDR(impact)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}
