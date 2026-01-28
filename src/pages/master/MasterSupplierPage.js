// src/pages/master/MasterSupplierPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Calendar, Edit, Trash2, Phone, Mail } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
  listSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from "../../api/suppliers";

const PER_PAGE = 10;
const TYPE_OPTIONS = ["marketplace", "retail", "corporate", "others"];

/* Utils */
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
const badgeType = (t) => {
  const v = String(t || "").toLowerCase();
  if (v === "retail") return "bg-emerald-50 text-emerald-700";
  if (v === "marketplace") return "bg-blue-50 text-blue-700";
  if (v === "corporate") return "bg-purple-50 text-purple-700";
  if (v === "others") return "bg-amber-50 text-amber-700";
  return "bg-slate-100 text-slate-700";
};
const startCase = (s) => String(s || "")
  .replace(/[-_]+/g, " ")
  .replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());

/* ---------- Base Modal ---------- */
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

/* ---------- Add Modal ---------- */
function AddSupplierModal({ open, loading, onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: "", type: "", address: "", phone: "", email: "", pic_name: "", pic_phone: "",
  });

  useEffect(() => {
    if (open) setForm({ name: "", type: "", address: "", phone: "", email: "", pic_name: "", pic_phone: "" });
  }, [open]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <BaseModal
      open={open}
      title="Add Supplier"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit(form)}
            disabled={loading || !form.name.trim() || !form.type}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.name} onChange={set("name")} placeholder="PT Tekstil Makmur" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select className="w-full px-3 py-2 border rounded-lg" value={form.type} onChange={set("type")}>
            <option value="">Select Type</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{startCase(t)}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea rows={2} className="w-full px-3 py-2 border rounded-lg" value={form.address} onChange={set("address")} placeholder="Jl. Industri No. 123, Bandung" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.phone} onChange={set("phone")} placeholder="0221234567" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" className="w-full px-3 py-2 border rounded-lg" value={form.email} onChange={set("email")} placeholder="purchasing@contoh.co.id" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PIC Name</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.pic_name} onChange={set("pic_name")} placeholder="Rina Putri" />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PIC Phone</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.pic_phone} onChange={set("pic_phone")} placeholder="081234567890" />
        </div>
      </div>
    </BaseModal>
  );
}

/* ---------- Edit Modal ---------- */
function EditSupplierModal({ open, loading, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({
    name: "", type: "", address: "", phone: "", email: "", pic_name: "", pic_phone: "",
  });

  useEffect(() => {
    if (open && initial) {
      setForm({
        name: initial.name || "",
        type: initial.type || "",
        address: initial.address || "",
        phone: initial.phone || "",
        email: initial.email || "",
        pic_name: initial.pic_name || "",
        pic_phone: initial.pic_phone || "",
      });
    }
  }, [open, initial]);

  const set = (k) => (e) => setForm((p) => ({ ...p, [k]: e.target.value }));

  return (
    <BaseModal
      open={open}
      title="Edit Supplier"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit({ id: initial?.id, ...form })}
            disabled={loading || !form.name.trim() || !form.type}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.name} onChange={set("name")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select className="w-full px-3 py-2 border rounded-lg" value={form.type} onChange={set("type")}>
            <option value="">— Select —</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{startCase(t)}</option>)}
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea rows={2} className="w-full px-3 py-2 border rounded-lg" value={form.address} onChange={set("address")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.phone} onChange={set("phone")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Email</label>
          <input type="email" className="w-full px-3 py-2 border rounded-lg" value={form.email} onChange={set("email")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PIC Name</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.pic_name} onChange={set("pic_name")} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">PIC Phone</label>
          <input className="w-full px-3 py-2 border rounded-lg" value={form.pic_phone} onChange={set("pic_phone")} />
        </div>
      </div>
    </BaseModal>
  );
}

/* ---------- Page ---------- */
export default function MasterSupplierPage() {
  const qc = useQueryClient();

  // state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  // dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // debounce
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250); return () => clearTimeout(id); }, [searchTerm]);

  // fetch
  const { data: res, isLoading } = useQuery({
    queryKey: ["suppliers", { page: currentPage, per_page: PER_PAGE, search: debouncedSearch, type: typeFilter || undefined }],
    queryFn: ({ signal }) => listSuppliers({ page: currentPage, per_page: PER_PAGE, search: debouncedSearch, type: typeFilter || undefined }, signal),
    keepPreviousData: true,
    placeholderData: (prev) => prev,
  });

  const items = useMemo(() => res?.items || [], [res]);
  const meta = useMemo(() => res?.meta || { current_page: 1, last_page: 1, per_page: PER_PAGE, total: items.length }, [res, items.length]);

  // mutations
  const mCreate = useMutation({
    mutationFn: ({ payload, signal }) => createSupplier(payload, signal),
    onSuccess: () => { toast.success("Supplier created"); setShowAdd(false); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload, signal }) => updateSupplier(id, payload, signal),
    onSuccess: () => { toast.success("Supplier updated"); setEditTarget(null); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteSupplier(id, signal),
    onSuccess: () => { toast.success("Supplier deleted"); setConfirmDel(null); qc.invalidateQueries({ queryKey: ["suppliers"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete"),
  });

  /* Columns (compact) */
  const columns = useMemo(() => [
    {
      key: "name",
      header: "Name",
      width: "180px",
      sticky: "left",
      cell: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
    },
    {
      key: "type",
      header: "Type",
      width: "100px",
      align: "center",
      cell: (r) => (
        <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${badgeType(r.type)}`}>
          {startCase(r.type) || "-"}
        </span>
      ),
    },
    {
      key: "contact",
      header: "Contact",
      width: "180px",
      cell: (r) => (
        <div className="flex flex-col text-gray-700 text-xs">
          <span className="inline-flex items-center gap-1.5"><Phone className="w-3.5 h-3.5 text-gray-400" />{r.phone || "-"}</span>
          <span className="inline-flex items-center gap-1.5"><Mail className="w-3.5 h-3.5 text-gray-400" />{r.email || "-"}</span>
        </div>
      ),
    },
    {
      key: "pic",
      header: "PIC",
      width: "120px",
      cell: (r) => (
        <div className="flex flex-col text-gray-700 text-xs">
          <span className="font-medium">{r.pic_name || "-"}</span>
          <span>{r.pic_phone || "-"}</span>
        </div>
      ),
    },
    {
      key: "address",
      header: "Address",
      width: "200px",
      cell: (r) => <span className="text-gray-700 text-xs line-clamp-2">{truncateWords(r.address, 6) || "-"}</span>,
    },
    {
      key: "created_at",
      header: "Created",
      width: "140px",
      cell: (r) => (
        <div className="flex items-center gap-1.5 text-gray-700 text-xs">
          <Calendar className="w-3.5 h-3.5 text-gray-400" />
          {fmtDateTime(r.created_at)}
        </div>
      ),
    },
  ], []);

  /* Render */
  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Suppliers</h2>
        <p className="text-sm text-gray-500">Kelola data supplier (tipe, kontak, PIC, dan alamat).</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search supplier name, phone, email…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">All Types</option>
            {TYPE_OPTIONS.map((t) => <option key={t} value={t}>{startCase(t)}</option>)}
          </select>

          <div className="ml-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Supplier
            </button>
          </div>
        </div>
      </div>

      {/* Table (compact) */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto">
          <div className="min-w-full inline-block align-middle">
            {isLoading ? (
              <div className="p-3">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-2 py-2 border-b last:border-0">
                    <div className="col-span-3 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-1 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-3 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
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
                    width: "120px",
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
                getRowKey={(row, i) => row.id ?? i}
                // compact: kecilkan font/padding
                className="border-0 shadow-none text-[13px] [&_th]:py-2 [&_td]:py-2 [&_th]:px-3 [&_td]:px-3"
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddSupplierModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isLoading}
        onSubmit={(payload) => mCreate.mutate({ payload })}
      />

      <EditSupplierModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isLoading}
        initial={editTarget}
        onSubmit={(payload) => mUpdate.mutate({ id: payload.id, payload })}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Supplier"
        message={confirmDel ? <>Yakin hapus supplier <b>{confirmDel.name}</b>?</> : null}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />
    </div>
  );
}
