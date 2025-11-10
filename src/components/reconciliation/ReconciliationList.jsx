// src/components/reconciliation/ReconciliationList.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Plus, X, Trash2, FileDown, ArrowRight, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import DataTable from "../data-table/DataTable";
import ConfirmDialog from "../common/ConfirmDialog";
import {
  listReconciliations,
  createReconciliation,
  downloadTemplate,
  deleteReconciliation,
} from "../../api/stockReconciliation";
import { listStoreLocations as listStoreOptions } from "../../api/users"; // dropdown store
import { STORAGE_KEY } from "../../api/client";
import { useNavigate } from "react-router-dom";

const PER_PAGE = 10;

/* ===== helpers ===== */
const fmtIDR = (n) =>
  (Number(n ?? 0) || 0).toLocaleString("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  });

const ymd = (s) => {
  if (!s) return "";
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? String(s).slice(0, 10) : d.toISOString().slice(0, 10);
};

const safeYMD = (s) => {
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) {
    const t = String(s).slice(0, 10);
    return t || undefined;
  }
  return d.toISOString().slice(0, 10);
};

function normalizeRow(r = {}) {
  return {
    ...r,
    __norm: {
      reference_code: r.reference_code ?? r.ref_code ?? r.code ?? "-",
      status: r.status ?? "DRAFT",
      store_location_id: r.store_location_id ?? r.store_id ?? null,
      user_id: r.user_id ?? r.created_by_id ?? r.userId ?? null,
      user_name: r.user?.name ?? r.user_name ?? null,
      date_from: r.date_from ?? r.created_at ?? null,
      date_to: r.date_to ?? r.updated_at ?? null,
      total_items: r.total_items ?? r.items_count ?? 0,
      total_value: r.total_value ?? r.value_total ?? 0,
    },
  };
}

/* ================= Modal: Add ================= */
function AddReconciliationModal({ open, onClose, onCreated }) {
  const [stores, setStores] = useState([]);
  const [loadingOpt, setLoadingOpt] = useState(true);

  const getUserDefaultStore = () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      return parsed?.user?.store_location_id ?? parsed?.store_location_id ?? null;
    } catch {
      return null;
    }
  };

  const [storeId, setStoreId] = useState("");
  const [dateFrom, setDateFrom] = useState(() => new Date().toISOString().slice(0, 10));
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    setLoadingOpt(true);
    (async () => {
      try {
        const opts = await listStoreOptions({ per_page: 200 }); // => [{id,name}]
        if (cancel) return;
        setStores(opts || []);
        const def = getUserDefaultStore();
        if (def && opts?.some((s) => String(s.id) === String(def))) setStoreId(String(def));
        else if (opts?.length) setStoreId(String(opts[0].id));
      } catch {
        setStores([]);
      } finally {
        if (!cancel) setLoadingOpt(false);
      }
    })();
    return () => {
      cancel = true;
    };
  }, [open]);

  const submit = async (e) => {
    e.preventDefault();
    if (!storeId) return toast.error("Store wajib diisi");
    try {
      setSubmitting(true);
      const res = await createReconciliation({
        store_location_id: Number(storeId),
        date_from: dateFrom,
        date_to: dateTo,
        note: note || undefined,
      });
      const id = res?.id ?? res?.data?.id;
      toast.success("Rekonsiliasi dibuat");

      // Auto-download Excel untuk periode & store yang dipilih
      try {
        const blob = await downloadTemplate({
          store_id: Number(storeId),
          date_from: dateFrom,
          date_to: dateTo,
          recon_id: id, // opsional untuk BE
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `reconciliation-${storeId}-${dateFrom}_${dateTo}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        toast.error("Gagal mengunduh Excel template");
      }

      onCreated?.(id);
      onClose?.();
    } catch (e2) {
      toast.error(e2?.response?.data?.message ?? "Gagal membuat rekonsiliasi");
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative bg-white w-full max-w-md rounded-2xl shadow-xl border border-gray-200">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="font-semibold">Add Reconciliation</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={submit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Store</label>
            <select
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              disabled={loadingOpt}
              required
            >
              {(stores || []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name ?? `Store #${s.id}`}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-1">Date From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Date To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Note (opsional)</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg"
              rows={3}
              placeholder="Keterangan…"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg border">
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-lg text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50"
            >
              {submitting ? "Membuat…" : "Buat & Download Excel"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ================= List ================= */
export default function ReconciliationList({ onOpenDetail }) {
  const qc = useQueryClient();
  const navigate = useNavigate();

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [perPage] = useState(PER_PAGE);
  const [showAdd, setShowAdd] = useState(false);

  // ConfirmDialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [targetDelete, setTargetDelete] = useState(null); // { id, ref, status }
  const [downloadingId, setDownloadingId] = useState(null); // untuk loading tombol download per-baris

  const { data, isLoading } = useQuery({
    queryKey: ["recon:list", { q, page, perPage }],
    queryFn: () => listReconciliations({ q: q || undefined, page, per_page: perPage }),
    keepPreviousData: true,
  });

  const delMut = useMutation({
    mutationFn: (id) => deleteReconciliation(id),
    onSuccess: () => {
      toast.success("Rekonsiliasi dihapus");
      qc.invalidateQueries({ queryKey: ["recon:list"] });
      setConfirmOpen(false);
      setTargetDelete(null);
    },
    onError: (e) => toast.error(e?.response?.data?.message ?? "Gagal menghapus"),
  });

  const rows = useMemo(() => (data?.items ?? []).map(normalizeRow), [data?.items]);
  const meta =
    data?.meta ?? { current_page: page, last_page: 1, per_page: perPage, total: (rows || []).length };

  const handleRowDownload = async (row) => {
    try {
      const sid =
        row.__norm.store_location_id ?? row.store_location_id ?? row.store_id ?? null;
      const df = safeYMD(row.__norm.date_from);
      const dt = safeYMD(row.__norm.date_to);

      if (!sid) {
        toast.error("Store tidak diketahui untuk baris ini");
        return;
      }
      const dlId = row.id || row.__norm.reference_code || "x";
      setDownloadingId(dlId);

      const blob = await downloadTemplate({
        store_id: Number(sid),
        ...(df ? { date_from: df } : {}),
        ...(dt ? { date_to: dt } : {}),
        // recon_id: row.id, // opsional jika BE ingin
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ref = row.__norm.reference_code || `recon-${sid}`;
      a.download = `${ref}-${df || "from"}_${dt || "to"}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Gagal mengunduh Excel");
    } finally {
      setDownloadingId(null);
    }
  };

  const columns = [
    {
      key: "reference_code",
      header: "Ref Code",
      sticky: "left",
      width: "220px",
      className: "font-medium",
      cell: (row) => <span className="text-gray-900">{row.__norm.reference_code}</span>,
    },
    {
      key: "status",
      header: "Status",
      width: "120px",
      cell: (row) => {
        const applied = (row.__norm.status || "").toUpperCase() === "APPLIED";
        return (
          <span
            className={`px-2 py-1 rounded-lg text-xs ${
              applied ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {row.__norm.status}
          </span>
        );
      },
    },
    {
      key: "user_id",
      header: "Rekonsiliator",
      width: "220px",
      cell: (row) => (
        <span className="text-gray-700">
          {row.__norm.user_name ?? row.user?.name ?? `User #${row.__norm.user_id ?? "-"}`}
        </span>
      ),
    },
    {
      key: "date_range",
      header: "Tanggal Rekonsiliasi",
      width: "260px",
      cell: (row) => (
        <span className="text-gray-700">
          {ymd(row.__norm.date_from)} – {ymd(row.__norm.date_to)}
        </span>
      ),
    },
    {
      key: "total_items",
      header: "Total Item",
      align: "right",
      width: "140px",
      cell: (row) => <span>{row.__norm.total_items ?? 0}</span>,
    },
    {
      key: "total_value",
      header: "Total Value",
      align: "right",
      width: "160px",
      className: "hidden sm:table-cell",
      cell: (row) => <span className="font-medium">{fmtIDR(row.__norm.total_value)}</span>,
    },
    {
      key: "__actions",
      header: "Actions",
      sticky: "right",
      className: "sticky right-0 z-20 bg-white w-[260px]",
      cell: (row) => {
        const isDraft = (row.__norm.status || "").toUpperCase() === "DRAFT";
        const isLoadingDl = downloadingId === (row.id || row.__norm.reference_code || "x");
        return (
          <div
            className="sticky right-0 z-20 bg-white flex items-center justify-end gap-2 pr-2"
            style={{ boxShadow: "-6px 0 6px -6px rgba(0,0,0,.12)" }}
          >
            <button
              onClick={() => onOpenDetail?.(row.id)}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1"
              title="Detail"
            >
              Detail <ArrowRight size={14} />
            </button>

            <button
              onClick={() => handleRowDownload(row)}
              disabled={isLoadingDl}
              className="px-3 py-1.5 text-xs rounded-md border border-gray-300 hover:bg-gray-50 inline-flex items-center gap-1 disabled:opacity-50"
              title="Download Excel"
            >
              <FileDown size={14} /> {isLoadingDl ? "Downloading..." : "Download"}
            </button>

            <button
              onClick={() => {
                if (!row.id || !isDraft) return;
                setTargetDelete({
                  id: row.id,
                  ref: row.__norm.reference_code,
                  status: row.__norm.status,
                });
                setConfirmOpen(true);
              }}
              disabled={!isDraft}
              className={`px-3 py-1.5 text-xs rounded-md border inline-flex items-center gap-1 ${
                isDraft
                  ? "border-red-200 text-red-600 hover:bg-red-50"
                  : "border-gray-200 text-gray-400 cursor-not-allowed"
              }`}
              title={isDraft ? "Hapus" : "Hanya DRAFT yang bisa dihapus"}
            >
              <Trash2 size={14} /> Hapus
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-gray-800">Stock Reconciliation</h2>
          <p className="text-sm text-gray-500">Daftar rekonsiliasi stok.</p>
        </div>
        <button
          onClick={() => navigate("/inventory/products")}
          className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium border rounded-lg hover:bg-gray-50"
          title="Kembali ke Inventory"
        >
          <ArrowLeft size={16} /> Back
        </button>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200 mt-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Cari ref code / user…"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(1);
              }}
              className="w-full pl-10 pr-9 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
            />
            {q && (
              <button
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                onClick={() => {
                  setQ("");
                  setPage(1);
                }}
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-violet-600 rounded-lg hover:bg-violet-700"
            title="Add Reconciliation"
          >
            <Plus className="w-4 h-4" />
            Add Reconciliation
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg mt-4">
        <div className="relative w-full overflow-x-auto">
          <div className="inline-block align-middle w-full">
            <DataTable
              columns={columns}
              data={rows}
              loading={isLoading}
              meta={meta}
              currentPage={meta?.current_page ?? page}
              onPageChange={(p) => setPage(p)}
              stickyHeader
              getRowKey={(row, i) => row.id ?? row.__norm.reference_code ?? i}
              className="border-0 shadow-none w-full"
            />
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddReconciliationModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        onCreated={() => qc.invalidateQueries({ queryKey: ["recon:list"] })}
      />

      <ConfirmDialog
        open={confirmOpen}
        title="Hapus Rekonsiliasi"
        message={
          <div className="text-sm">
            Hapus rekonsiliasi <span className="font-medium">{targetDelete?.ref}</span>?<br />
            <span className="text-gray-500">Hanya status DRAFT yang dapat dihapus.</span>
          </div>
        }
        confirmText="Hapus"
        cancelText="Batal"
        variant="danger"
        loading={delMut.isPending}
        onConfirm={() => targetDelete?.id && delMut.mutate(targetDelete.id)}
        onClose={() => {
          if (!delMut.isPending) {
            setConfirmOpen(false);
            setTargetDelete(null);
          }
        }}
      />
    </div>
  );
}
