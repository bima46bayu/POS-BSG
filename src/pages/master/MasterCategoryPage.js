// src/pages/master/MasterCategoryPage.jsx
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, X, Calendar, Edit, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import {
  getCategories,       // (params?, signal?) ➜ { items, meta } | []
  createCategory,      // (payload, signal?)
  updateCategory,      // (id, payload, signal?)
  deleteCategory,      // (id, signal?)
} from "../../api/categories";

const PER_PAGE = 10;

/* ============== Helpers ============== */
const fmtDateTime = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
};

/* ============== Inline Modals ============== */
function BaseModal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose}><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 py-4 border-t flex justify-end gap-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

function AddCategoryModal({ open, loading, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open) { setName(""); setDescription(""); }
  }, [open]);

  return (
    <BaseModal
      open={open}
      title="Add Category"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ name: name.trim(), description: description.trim() || null })}
            disabled={loading || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Beverages"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Short description"
            className="w-full px-3 py-2 border rounded-lg resize-y"
          />
        </div>
      </div>
    </BaseModal>
  );
}

function EditCategoryModal({ open, loading, initial, onClose, onSubmit }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (open && initial) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
    }
  }, [open, initial]);

  return (
    <BaseModal
      open={open}
      title="Edit Category"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ id: initial?.id, name: name.trim(), description: (description || "").trim() || null })}
            disabled={loading || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg resize-y"
          />
        </div>
      </div>
    </BaseModal>
  );
}

/* ============== Page ============== */
export default function MasterCategoryPage() {
  const qc = useQueryClient();

  // query state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // popover filter (placeholder future)
  const [showFilters, setShowFilters] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  // dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // debounce
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // fetch categories
  const { data: catRes, isLoading } = useQuery({
    queryKey: ["categories-master", { page: currentPage, per_page: PER_PAGE, search: debouncedSearch }],
    queryFn: ({ signal }) =>
      getCategories({ page: currentPage, per_page: PER_PAGE, search: debouncedSearch }, signal),
    keepPreviousData: true,
    placeholderData: (prev) => prev,
  });

  const itemsRaw = catRes?.items ?? catRes?.data ?? (Array.isArray(catRes) ? catRes : []);
  const metaObj  = catRes?.meta ?? null;

  const items = useMemo(() => (Array.isArray(itemsRaw) ? itemsRaw : []), [itemsRaw]);
  const meta = useMemo(() => {
    if (metaObj) {
      return {
        current_page: Number(metaObj.current_page ?? currentPage),
        last_page: Number(metaObj.last_page ?? 1),
        per_page: Number(metaObj.per_page ?? PER_PAGE),
        total: Number(metaObj.total ?? (Array.isArray(items) ? items.length : 0)),
      };
    }
    const total = Array.isArray(items) ? items.length : 0;
    const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
    return { current_page: currentPage, last_page: lastPage, per_page: PER_PAGE, total };
  }, [metaObj, currentPage, items]);

  // mutations
  const mCreate = useMutation({
    mutationFn: ({ payload, signal }) => createCategory(payload, signal), // payload: { name, description? }
    onSuccess: () => {
      toast.success("Category created");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["categories-master"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload, signal }) => updateCategory(id, payload, signal), // payload: { name, description? }
    onSuccess: () => {
      toast.success("Category updated");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["categories-master"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteCategory(id, signal),
    onSuccess: () => {
      toast.success("Category deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["categories-master"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete"),
  });

  const toggleFilters = useCallback(() => {
    const el = btnRef.current;
    if (el) {
      const rect = el.getBoundingClientRect();
      const width = 360;
      const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8);
      const top = Math.min(rect.bottom + 8, window.innerHeight - 8);
      setPopoverPos({ top, left });
    }
    setShowFilters((s) => !s);
  }, []);

  /* ============== Columns ============== */
  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        width: "260px",
        sticky: "left",
        cell: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
      },
      {
        key: "description",
        header: "Description",
        width: "360px",
        cell: (r) => <span className="text-gray-700">{r.description || "-"}</span>,
      },
      {
        key: "created_at",
        header: "Created",
        width: "180px",
        cell: (r) => (
          <div className="flex items-center gap-2 text-gray-700">
            <Calendar className="w-4 h-4 text-gray-400" />
            {fmtDateTime(r.created_at)}
          </div>
        ),
      },
    ],
    []
  );

  /* ============== Render ============== */
  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Categories</h2>
        <p className="text-sm text-gray-500">Kelola kategori untuk produk.</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search category name or description…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              ref={btnRef}
              onClick={toggleFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filter
            </button>

            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Category
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div className="min-w-full inline-block align-middle">
            {isLoading ? (
              /* Skeleton */
              <div className="p-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-3 py-3 border-b last:border-0">
                    <div className="col-span-4 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-5 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-1 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 flex justify-end gap-2">
                      <div className="h-8 w-20 bg-slate-200/80 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-slate-200/80 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-slate-200/80 rounded animate-pulse" />
                    </div>
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
                    width: "220px",
                    sticky: "right",
                    align: "center",
                    cell: (r) => (
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => setEditTarget(r)}
                          className="inline-flex items-center justify-center h-8 w-20 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                          <span className="ml-1 text-xs">Edit</span>
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
                className="border-0 shadow-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* Filter Popover (placeholder) */}
      {showFilters && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
          <div
            className="fixed z-50 w-90 bg-white rounded-lg shadow-lg border"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold">Filters</h3>
              <button onClick={() => setShowFilters(false)}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 text-sm text-slate-500">
              Belum ada filter tambahan untuk kategori.
            </div>
            <div className="px-4 py-3 border-t text-right">
              <button onClick={() => setShowFilters(false)} className="px-4 py-2 bg-blue-500 text-white rounded-lg">
                Close
              </button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddCategoryModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isLoading}
        onSubmit={(payload) => mCreate.mutate({ payload })}
      />

      <EditCategoryModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isLoading}
        initial={editTarget}
        onSubmit={(payload) => mUpdate.mutate({ id: payload.id, payload })}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Category"
        message={confirmDel ? <>Yakin hapus kategori <b>{confirmDel.name}</b>?</> : null}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />
    </div>
  );
}
