// src/components/reconciliation/ReconciliationDetail.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  CheckCircle2,
  FileDown,
  FileUp,
  Loader2,
  Search as SearchIcon,
  X,
} from "lucide-react";
import toast from "react-hot-toast";
import { IDR as fmtIDR } from "../../lib/fmt";
import DataTable from "../data-table/DataTable";
import {
  getReconciliation,
  uploadReconciliationExcel,
  applyReconciliation,
  bulkUpdateReconciliationItems,
  downloadTemplate, // pastikan ada; rute /{id}/template juga didukung di sisi API
} from "../../api/stockReconciliation";
import { listUnits } from "../../api/units";
import {
  compatibleUnits,
  convertQty,
  formatQtyInput,
  matchUnitId,
  unitNameById,
} from "../../lib/units";

const PER_PAGE = 10;

// simpan draft isian per-reconciliation
const DRAFT_KEY = (rid) => `recon_draft_${rid}`;
const UNIT_KEY = (rid) => `recon_units_${rid}`;
const PAGE_KEY = (rid) => `recon_page_${rid}`;

/* ===== helpers ===== */

const fmtQty = (n) =>
  Number(n ?? 0).toLocaleString("id-ID", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  });

const uomLabel = (row) => row?.unit_name ?? row?.unit?.name ?? row?.uom ?? "-";

const qtyDiff = (a, b) => Math.abs(Number(a ?? 0) - Number(b ?? 0)) > 1e-9;

const ymd = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s).slice(0, 10) : d.toISOString().slice(0, 10);
};

/* ================= Modal: Import Excel ================= */
function ImportReconciliationModal({ open, onClose, onImported }) {
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!file) return toast.error("Pilih file Excel terlebih dahulu");
    try {
      setSubmitting(true);
      await onImported?.(file);
      onClose?.();
      setFile(null);
    } catch {
      // toast ditangani di parent (mutation)
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    if (!open) setFile(null);
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold">Import Reconciliation</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Pilih File (.xlsx / .xls)</label>
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-3 py-2 border rounded-lg"
            />
            {file ? (
              <p className="mt-1 text-xs text-gray-500">
                Terpilih: <span className="font-medium">{file.name}</span>
              </p>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting || !file}
              className="px-4 py-2 rounded-lg text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting ? "Mengunggah…" : "Import"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= Detail ================= */
export default function ReconciliationDetail({ id, onBack }) {
  const qc = useQueryClient();

  // search + edit + paging
  const [q, setQ] = useState("");
  const [draft, setDraft] = useState({}); // { rowKey: qty in selected unit }
  const [unitByRow, setUnitByRow] = useState({}); // { rowKey: unitId }
  const [dirty, setDirty] = useState(false);
  const [page, setPage] = useState(1);
  const [perPage] = useState(PER_PAGE);

  // modal import
  const [showImport, setShowImport] = useState(false);

  /* ============== FETCH ============== */
  const { data, isLoading } = useQuery({
    queryKey: ["recon:detail", id],
    queryFn: () => getReconciliation(id),
    enabled: !!id,
  });

  const { data: units = [] } = useQuery({
    queryKey: ["units-for-reconciliation"],
    queryFn: () => listUnits({ per_page: 200 }),
    staleTime: 120_000,
  });

  // normalisasi respons
  const recRaw = data?.header ?? data?.reconciliation ?? data?.data?.header ?? data ?? {};
  const rawItems = data?.items ?? data?.data?.items ?? [];

  const rec = useMemo(() => {
    const status = (recRaw.status ?? "DRAFT").toUpperCase();
    return {
      id: recRaw.id,
      reference_code: recRaw.reference_code ?? recRaw.ref_code ?? recRaw.code ?? "-",
      status,
      store_name:
        recRaw.store?.name ??
        recRaw.store_name ??
        recRaw.store_id ??
        recRaw.store_location_id ??
        "-",
      user_name:
        recRaw.user?.name ??
        recRaw.user_name ??
        (recRaw.user_id ? `User #${recRaw.user_id}` : "-"),
      date_from: recRaw.date_from,
      date_to: recRaw.date_to,
      total_items: recRaw.total_items ?? rawItems?.length ?? 0,
      total_value: recRaw.total_value ?? 0,
    };
  }, [recRaw, rawItems]);

  // siapkan draft dari server + merge dengan draft tersimpan + pulihkan halaman
  useEffect(() => {
    if (!isLoading && rawItems?.length) {
      let saved = {};
      let savedUnits = {};
      try {
        const raw = localStorage.getItem(DRAFT_KEY(id));
        saved = raw ? JSON.parse(raw) : {};
      } catch {}
      try {
        const rawU = localStorage.getItem(UNIT_KEY(id));
        savedUnits = rawU ? JSON.parse(rawU) : {};
      } catch {}

      const init = {};
      const initUnits = {};
      for (const it of rawItems) {
        const key = it.id ?? `${it.product_id}-${it.sku}`;
        const stockUom = uomLabel(it);
        if (savedUnits[key]) initUnits[key] = String(savedUnits[key]);

        if (saved[key] != null && saved[key] !== "") {
          const raw = saved[key];
          if (raw && typeof raw === "object") {
            init[key] = raw.qty ?? "";
            if (raw.unitId) initUnits[key] = String(raw.unitId);
          } else {
            init[key] = raw;
          }
        } else {
          const v =
            it.physical_qty != null
              ? Number(it.physical_qty)
              : it.real_stock != null
              ? Number(it.real_stock)
              : null;
          init[key] = Number.isFinite(v) ? formatQtyInput(v) : "";
        }
      }

      setDraft(init);
      setUnitByRow((prev) => ({ ...initUnits, ...prev }));
      setDirty(false);

      try {
        const last = Number(localStorage.getItem(PAGE_KEY(id)) || "1");
        setPage(Number.isFinite(last) && last > 0 ? last : 1);
      } catch {
        setPage(1);
      }
    }
  }, [isLoading, rawItems, id]);

  // Default UOM dropdown to the product stock unit once the unit list is ready.
  useEffect(() => {
    if (!units.length || !rawItems?.length) return;
    setUnitByRow((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const it of rawItems) {
        const key = it.id ?? `${it.product_id}-${it.sku}`;
        if (next[key]) continue;
        const stockUom = uomLabel(it);
        const allowed = compatibleUnits(units, stockUom === "-" ? "" : stockUom);
        const def = matchUnitId(allowed, stockUom);
        if (def) {
          next[key] = def;
          changed = true;
        }
      }
      if (changed) persistUnits(next);
      return changed ? next : prev;
    });
  }, [units, rawItems, id]);

  // jika status sudah APPLIED saat load → hapus draft local
  useEffect(() => {
    if ((rec.status || "").toUpperCase() === "APPLIED") {
      try {
        localStorage.removeItem(DRAFT_KEY(id));
        localStorage.removeItem(UNIT_KEY(id));
      } catch {}
      setDirty(false);
    }
  }, [rec.status, id]);

  const persistUnits = (next) => {
    try {
      localStorage.setItem(UNIT_KEY(id), JSON.stringify(next));
    } catch {}
  };

  const persistDraft = (next) => {
    try {
      localStorage.setItem(DRAFT_KEY(id), JSON.stringify(next));
    } catch {}
  };

  // filter by search + normalisasi untuk tabel
  const rowsAll = useMemo(() => {
    const base = (rawItems || []).map((r) => {
      const stockUom = uomLabel(r);
      const allowed = compatibleUnits(units, stockUom === "-" ? "" : stockUom);
      return {
        ...r,
        _rid: r.id ?? `${r.product_id}-${r.sku ?? ""}`,
        _sku: r.sku ?? "",
        _name: r.product_name ?? r.name ?? "-",
        _uom: stockUom,
        _units: allowed,
        _sys: Number(r.system_qty ?? r.system_stock ?? 0),
        _avg: Number(r.avg_cost ?? 0),
      };
    });
    if (!q) return base;
    const s = q.toLowerCase();
    return base.filter((it) => it._sku.toLowerCase().includes(s) || it._name.toLowerCase().includes(s));
  }, [rawItems, q, units]);

  const rowUnitId = (row) => {
    const fallback = matchUnitId(row._units, row._uom);
    return unitByRow[row._rid] ? String(unitByRow[row._rid]) : fallback;
  };

  const rowUnitName = (row) =>
    unitNameById(row._units, rowUnitId(row)) || row._uom;

  // pagination client-side
  const lastPage = Math.max(1, Math.ceil(rowsAll.length / perPage));
  const safePage = Math.min(page, lastPage);
  const start = (safePage - 1) * perPage;
  const rows = rowsAll.slice(start, start + perPage);

  /* ============== handlers: edit + pagination (persist) ============== */
  const handleEditQty = (rowKey, value) => {
    setDraft((prev) => {
      const next = { ...prev, [rowKey]: value };
      persistDraft(next);
      return next;
    });
    setDirty(true);
  };

  const handleUnitChange = (row, nextUnitId) => {
    const prevId = rowUnitId(row);
    const prevName = unitNameById(row._units, prevId) || row._uom;
    const nextName = unitNameById(row._units, nextUnitId) || row._uom;
    const raw = draft[row._rid];
    const n = raw === "" || raw == null ? NaN : Number(raw);
    const converted = Number.isFinite(n) ? convertQty(n, prevName, nextName) : raw;

    setUnitByRow((prev) => {
      const next = { ...prev, [row._rid]: String(nextUnitId) };
      persistUnits(next);
      return next;
    });
    setDraft((prev) => {
      const next = {
        ...prev,
        [row._rid]: Number.isFinite(converted) ? formatQtyInput(converted) : converted ?? "",
      };
      persistDraft(next);
      return next;
    });
    setDirty(true);
  };

  const handlePageChange = (p) => {
    setPage(p);
    try {
      localStorage.setItem(PAGE_KEY(id), String(p));
    } catch {}
  };

  /* ============== MUTATIONS ============== */
  const uploadMut = useMutation({
    mutationFn: ({ file }) => uploadReconciliationExcel(id, file),
    onSuccess: (res) => {
      toast.success(`File berhasil diunggah${typeof res?.updated === "number" ? ` (${res.updated} baris)` : ""}`);
      qc.invalidateQueries({ queryKey: ["recon:detail", id] });
      setShowImport(false);
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Gagal upload file Excel"),
  });

  const bulkMut = useMutation({
    mutationFn: (payload) => bulkUpdateReconciliationItems(id, payload),
    onSuccess: () => {
      setDirty(false);
      qc.invalidateQueries({ queryKey: ["recon:detail", id] });
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Gagal menyimpan perubahan"),
  });

  const applyMut = useMutation({
    mutationFn: () => applyReconciliation(id),
    onSuccess: () => {
      toast.success("Rekonsiliasi berhasil diproses & stok terupdate");
      // bersihkan draft + flag dirty
      try {
        localStorage.removeItem(DRAFT_KEY(id));
        localStorage.removeItem(UNIT_KEY(id));
      } catch {}
      setDirty(false);

      qc.invalidateQueries({ queryKey: ["recon:detail", id] });
      qc.invalidateQueries({ queryKey: ["recon:list"] });
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
      qc.invalidateQueries({ queryKey: ["inventory-products"], exact: false });
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Gagal apply rekonsiliasi"),
  });

  const handleProcess = async () => {
    if (rec.status !== "DRAFT") {
      toast.error("Hanya DRAFT yang bisa diproses");
      return;
    }
    try {
      const payload = [];
      for (const it of rowsAll) {
        const editedRaw = draft[it._rid];
        const entered =
          editedRaw === "" || editedRaw == null ? null : Number(editedRaw);
        const selectedName = rowUnitName(it);
        const edited =
          entered == null || !Number.isFinite(entered)
            ? null
            : convertQty(entered, selectedName, it._uom);
        const current =
          it.physical_qty != null
            ? Number(it.physical_qty)
            : it.real_stock != null
            ? Number(it.real_stock)
            : null;

        if (qtyDiff(edited, current) && (edited === null || Number.isFinite(edited))) {
          payload.push({ id: it.id, physical_qty: edited });
        }
      }

      if (payload.length) {
        await bulkMut.mutateAsync({ items: payload });
      }
      await applyMut.mutateAsync();
    } catch {
      /* toast handled in mutation */
    }
  };

  const handleDownload = async () => {
    try {
      // gunakan recon_id dan periode dari header
      const blob = await downloadTemplate({
        recon_id: rec.id,
        date_from: rec.date_from ? ymd(rec.date_from) : undefined,
        date_to: rec.date_to ? ymd(rec.date_to) : undefined,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const df = ymd(rec.date_from) || "from";
      const dt = ymd(rec.date_to) || "to";
      a.download = `reconciliation-${rec.reference_code}-${df}_${dt}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh Excel");
    }
  };

  const disabledActions =
    isLoading || rec.status !== "DRAFT" || uploadMut.isLoading || bulkMut.isLoading || applyMut.isLoading;

  const statusBadge =
    (rec.status || "").toUpperCase() === "APPLIED"
      ? "bg-green-100 text-green-700"
      : "bg-yellow-100 text-yellow-700";

  /* ============== COLUMNS (pedoman DataTable) ============== */
  const columns = [
    {
      key: "_sku",
      header: "SKU",
      sticky: "left",
      width: "160px",
      className: "font-medium",
      cell: (row) => <span className="text-gray-900">{row._sku || "-"}</span>,
    },
    {
      key: "_name",
      header: "Nama Produk",
      width: "280px",
      cell: (row) => (
        <div className="flex flex-col">
          <span className="text-gray-800">{row._name}</span>
          <span className="text-xs text-gray-400">ID: {row.product_id ?? "-"}</span>
        </div>
      ),
    },
    {
      key: "_uom",
      header: "UOM",
      width: "90px",
      cell: (row) => (
        <span className="text-gray-700">{rowUnitName(row) || row._uom}</span>
      ),
    },
    {
      key: "_sys",
      header: "System Stock",
      width: "140px",
      align: "right",
      cell: (row) => {
        const selectedName = rowUnitName(row);
        const shown = convertQty(row._sys, row._uom, selectedName);
        return (
          <span>
            {fmtQty(shown)}
            {selectedName && selectedName !== "-" ? ` ${selectedName}` : ""}
          </span>
        );
      },
    },
    {
      key: "_total",
      header: "Total Cost",
      width: "160px",
      align: "right",
      cell: (row) => <span className="font-medium">{fmtIDR(row._sys * row._avg)}</span>,
    },
    {
      key: "_avg",
      header: "Avg Cost / Unit",
      width: "160px",
      align: "right",
      cell: (row) => <span>{fmtIDR(row._avg)}</span>,
    },
    {
      key: "__form",
      header: "Form Real Stock",
      width: "240px",
      sticky: "right",
      className: "sticky right-0 z-20 bg-white",
      cell: (row) => {
        const value = draft[row._rid] ?? "";
        const selectedName = rowUnitName(row);
        const allowed = row._units || [];
        return (
          <div className="sticky right-0 z-20 bg-white pr-2">
            <div className="flex items-center justify-end gap-2">
              <input
                type="number"
                inputMode="decimal"
                step="any"
                min={0}
                className="w-24 px-3 py-2 rounded-lg border border-gray-200 text-right focus:outline-none focus:ring-1 focus:ring-blue-600"
                placeholder="0.05"
                value={value ?? ""}
                onChange={(e) => handleEditQty(row._rid, e.target.value)}
                disabled={rec.status !== "DRAFT"}
              />
              {allowed.length ? (
                <select
                  value={rowUnitId(row)}
                  onChange={(e) => handleUnitChange(row, e.target.value)}
                  disabled={rec.status !== "DRAFT"}
                  className="w-[5.5rem] px-1.5 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none disabled:bg-gray-50"
                >
                  {allowed.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}
                    </option>
                  ))}
                </select>
              ) : selectedName && selectedName !== "-" ? (
                <span className="text-xs text-gray-500 w-8">{selectedName}</span>
              ) : null}
            </div>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
            title="Kembali"
          >
            <ArrowLeft size={16} />
          </button>
        </div>

        <div className="flex-1">
          <h2 className="text-lg font-semibold text-gray-800">Stock Reconciliation</h2>
          <div className="text-sm text-gray-500">
            Ref: <span className="font-medium">{rec.reference_code}</span> •{" "}
            Store: <span className="font-medium">{rec.store_name}</span> •{" "}
            Periode: <span className="font-medium">{ymd(rec.date_from)} – {ymd(rec.date_to)}</span>
          </div>
        </div>

        <span className={`px-2 py-1 rounded-lg text-xs ${statusBadge}`}>{rec.status}</span>
      </div>

      {/* Controls: search + download + import + proses */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari SKU / nama produk…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                handlePageChange(1);
              }}
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {q && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setQ("");
                  handlePageChange(1);
                }}
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Download Template */}
          <button
            onClick={handleDownload}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            title="Download Excel Template"
          >
            <FileDown className="w-4 h-4" />
            Download
          </button>

          {/* Import (modal) */}
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 disabled:opacity-60"
            disabled={rec.status !== "DRAFT" || uploadMut.isLoading}
            title={rec.status !== "DRAFT" ? "Hanya DRAFT yang dapat diimpor" : "Import Excel"}
          >
            {uploadMut.isLoading ? <Loader2 className="animate-spin w-4 h-4" /> : <FileUp className="w-4 h-4" />}
            Import
          </button>

          {/* Proses */}
          <button
            onClick={handleProcess}
            disabled={disabledActions}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            title="Proses: simpan perubahan lalu adjust stok/ledger"
          >
            {applyMut.isLoading || bulkMut.isLoading ? (
              <Loader2 className="animate-spin w-4 h-4" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            Proses
          </button>

          {dirty ? (
            <span className="text-xs px-2 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200">
              Ada perubahan belum diproses
            </span>
          ) : null}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg mt-4">
        {isLoading ? (
          <div className="py-16 text-center text-gray-500">
            <Loader2 className="inline-block animate-spin mr-2" /> Loading…
          </div>
        ) : rowsAll.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            List product diambil dari data produk. Isi kolom <b>Form Real Stock</b> manual
            atau gunakan <b>Download</b> / <b>Import</b>. Klik <b>Proses</b> untuk menyimpan & menyesuaikan stok.
          </div>
        ) : (
          <div className="relative w-full overflow-x-auto">
            <div className="inline-block align-middle w-full">
              <DataTable
                columns={columns}
                data={rows}
                loading={false}
                stickyHeader
                getRowKey={(row) => row._rid}
                className="border-0 shadow-none w-full"
                // Pagination ala pedoman (client-side)
                meta={{
                  current_page: safePage,
                  last_page: lastPage,
                  per_page: perPage,
                  total: rowsAll.length,
                }}
                currentPage={safePage}
                onPageChange={handlePageChange}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footnote */}
      <div className="mt-3 text-xs text-gray-500">
        * Data belum disimpan sampai Anda menekan <b>Proses</b>. Tombol tersebut akan menyimpan perubahan
        kolom <i>Form Real Stock</i> sekaligus melakukan penyesuaian stok (layers & ledger).
        Untuk Kg/L, pilih satuan <b>g</b> atau <b>Ml</b> seperti di Waste — nilai dikonversi ke satuan stok saat Proses.
      </div>

      {/* Modal Import */}
      <ImportReconciliationModal
        open={showImport}
        onClose={() => setShowImport(false)}
        onImported={(file) => uploadMut.mutate({ file })}
      />
    </div>
  );
}
