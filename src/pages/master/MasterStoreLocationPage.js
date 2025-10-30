// src/pages/master/MasterStoreLocationPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Calendar, Edit, Trash2, Phone } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
  listStoreLocations,
  createStoreLocation,
  updateStoreLocation,
  deleteStoreLocation,
} from "../../api/storeLocations";

const PER_PAGE = 10;

/* ===== Utils ===== */
const fmtDateTime = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
};

// potong berdasarkan jumlah kata
const truncateWords = (text, maxWords = 12) => {
  if (!text) return "-";
  const parts = String(text).trim().split(/\s+/);
  if (parts.length <= maxWords) return text;
  return parts.slice(0, maxWords).join(" ") + "…";
};

/* ===== Base Modal ===== */
function BaseModal({ open, title, onClose, children, footer, maxW = "max-w-xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className={`bg-white rounded-xl w-full ${maxW} mx-4 shadow-xl border`}>
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-3">{footer}</div>
      </div>
    </div>
  );
}

/* ===== Add/Edit Modals ===== */
function AddStoreModal({ open, loading, onClose, onSubmit }) {
  const [form, setForm] = useState({ code: "", name: "", address: "", phone: "" });
  useEffect(() => { if (open) setForm({ code: "", name: "", address: "", phone: "" }); }, [open]);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <BaseModal
      open={open}
      title="Add Store Location"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={loading || !form.name.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Code</label>
          <input value={form.code} onChange={set("code")} className="w-full px-3 py-2 border rounded-lg" placeholder="ITF / SWG" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={form.name} onChange={set("name")} className="w-full px-3 py-2 border rounded-lg" placeholder="Instafactory / Suwung" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea rows={2} value={form.address} onChange={set("address")} className="w-full px-3 py-2 border rounded-lg" placeholder="Alamat lengkap…" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input value={form.phone} onChange={set("phone")} className="w-full px-3 py-2 border rounded-lg" placeholder="081234567890" />
        </div>
      </div>
    </BaseModal>
  );
}

function EditStoreModal({ open, loading, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({ code: "", name: "", address: "", phone: "" });
  useEffect(() => {
    if (open && initial) {
      setForm({
        code: initial.code || "",
        name: initial.name || "",
        address: initial.address || "",
        phone: initial.phone || "",
      });
    }
  }, [open, initial]);
  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <BaseModal
      open={open}
      title="Edit Store Location"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit({ id: initial?.id, ...form })}
            disabled={loading || !form.name.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Code</label>
          <input value={form.code} onChange={set("code")} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={form.name} onChange={set("name")} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea rows={2} value={form.address} onChange={set("address")} className="w-full px-3 py-2 border rounded-lg" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input value={form.phone} onChange={set("phone")} className="w-full px-3 py-2 border rounded-lg" />
        </div>
      </div>
    </BaseModal>
  );
}

/* ===== Page ===== */
export default function MasterStoreLocationPage() {
  const qc = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250); return () => clearTimeout(id); }, [searchTerm]);

  const { data: res, isLoading } = useQuery({
    queryKey: ["store-locations", { page: currentPage, per_page: PER_PAGE, search: debouncedSearch }],
    queryFn: ({ signal }) => listStoreLocations({ page: currentPage, per_page: PER_PAGE, search: debouncedSearch }, signal),
    keepPreviousData: true,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const itemsRaw = res?.items ?? res?.data ?? res ?? [];
  const items = useMemo(() => (Array.isArray(itemsRaw) ? itemsRaw : []), [itemsRaw]);
  const meta = useMemo(() => {
    const m = res?.meta;
    if (m) return {
      current_page: Number(m.current_page ?? 1),
      last_page: Number(m.last_page ?? 1),
      per_page: Number(m.per_page ?? PER_PAGE),
      total: Number(m.total ?? items.length),
    };
    const total = items.length;
    const last = Math.max(1, Math.ceil(total / PER_PAGE));
    return { current_page: currentPage, last_page: last, per_page: PER_PAGE, total };
  }, [res, items.length, currentPage]);

  const mCreate = useMutation({
    mutationFn: ({ payload, signal }) => createStoreLocation(payload, signal),
    onSuccess: () => { toast.success("Store created"); setShowAdd(false); qc.invalidateQueries({ queryKey: ["store-locations"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to create"),
  });
  const mUpdate = useMutation({
    mutationFn: ({ id, payload, signal }) => updateStoreLocation(id, payload, signal),
    onSuccess: () => { toast.success("Store updated"); setEditTarget(null); qc.invalidateQueries({ queryKey: ["store-locations"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });
  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteStoreLocation(id, signal),
    onSuccess: () => { toast.success("Store deleted"); setConfirmDel(null); qc.invalidateQueries({ queryKey: ["store-locations"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete"),
  });

  /* Columns (compact & address truncated) */
  const columns = useMemo(() => [
    {
      key: "code",
      header: "Code",
      width: "120px",
      sticky: "left",
      className: "font-medium",
      cell: (r) => <span className="font-medium text-gray-900">{r.code || "-"}</span>,
    },
    {
      key: "name",
      header: "Name",
      width: "220px",
      cell: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
    },
    {
      key: "address",
      header: "Address",
      width: "380px",
      cell: (r) => <span className="text-gray-700 text-xs">{truncateWords(r.address, 12)}</span>,
    },
    {
      key: "phone",
      header: "Phone",
      width: "160px",
      cell: (r) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
          <Phone className="w-3.5 h-3.5 text-gray-400" />
          {r.phone || "-"}
        </span>
      ),
    },
    {
      key: "created_at",
      header: "Created",
      width: "160px",
      cell: (r) => (
        <div className="flex items-center gap-1.5 text-gray-700 text-xs">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {fmtDateTime(r.created_at)}
        </div>
      ),
    },
  ], []);

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Store Locations</h2>
        <p className="text-sm text-gray-500">Kelola lokasi toko.</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search code, name, phone, address…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="ml-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Store
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            {isLoading ? (
              <div className="p-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2 py-2 border-b last:border-0">
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-3 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-4 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-1 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                  </div>
                ))}
              </div>
            ) : (
              <DataTable
                columns={[
                  ...columns,
                  {
                    key: "__actions",
                    header: "Action",
                    width: "180px",
                    sticky: "right",
                    align: "center",
                    cell: (r) => (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setEditTarget(r)}
                          className="inline-flex items-center justify-center h-8 px-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-xs"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4 mr-1" />
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDel(r)}
                          className="inline-flex items-center justify-center h-8 w-8 bg-red-500 text-white rounded-lg hover:bg-red-600"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ),
                  },
                ]}
                data={items}
                loading={false}
                meta={meta}
                currentPage={meta.current_page}
                onPageChange={setCurrentPage}
                stickyHeader
                getRowKey={(row, i) => row.id ?? row.code ?? i}
                // compact
                className="border-0 shadow-none text-[13px] [&_th]:py-2 [&_td]:py-2 [&_th]:px-3 [&_td]:px-3"
              />
            )}
          </div>
        </div>
      </div>

      {/* ⛔ Pagination custom DIHAPUS sesuai request */}
      {/* (DataTable sudah meng-handle pagination lewat props meta/currentPage/onPageChange) */}

      {/* Modals */}
      <AddStoreModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isLoading}
        onSubmit={(payload) => mCreate.mutate({ payload })}
      />

      <EditStoreModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isLoading}
        initial={editTarget}
        onSubmit={(payload) => mUpdate.mutate({ id: payload.id, payload })}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Store"
        message={confirmDel ? <>Yakin hapus store <b>{confirmDel.name}</b>?</> : null}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />
    </div>
  );
}
