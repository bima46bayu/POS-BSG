import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, X, Calendar, Edit, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import {
  getCategories,                // untuk opsi parent
  listSubCategories,
  createSubCategory,
  updateSubCategory,
  deleteSubCategory,
} from "../../api/categories";

const PER_PAGE = 10;

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

/* ---------- Modals ---------- */
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
        <div className="px-5 py-4 border-t flex justify-end gap-3">{footer}</div>
      </div>
    </div>
  );
}

function AddSubModal({ open, loading, onClose, onSubmit, categories }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (open) { setName(""); setDescription(""); setCategoryId(""); }
  }, [open]);

  return (
    <BaseModal
      open={open}
      title="Add Subcategory"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit({
              name: name.trim(),
              description: (description || "").trim() || null,
              category_id: categoryId ? Number(categoryId) : null,
            })}
            disabled={loading || !name.trim() || !categoryId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Parent Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Soda"
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea
            rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg resize-y"
          />
        </div>
      </div>
    </BaseModal>
  );
}

function EditSubModal({ open, loading, onClose, onSubmit, categories, initial }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");

  useEffect(() => {
    if (open && initial) {
      setName(initial?.name || "");
      setDescription(initial?.description || "");
      const cid =
        initial?.category_id ??
        initial?.categoryId ??
        initial?.category?.id ?? "";
      setCategoryId(cid ? String(cid) : "");
    }
  }, [open, initial]);

  return (
    <BaseModal
      open={open}
      title="Edit Subcategory"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">Cancel</button>
          <button
            onClick={() => onSubmit({
              id: initial?.id,
              name: name.trim(),
              description: (description || "").trim() || null,
              category_id: categoryId ? Number(categoryId) : null,
            })}
            disabled={loading || !name.trim() || !categoryId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Parent Category</label>
          <select
            value={categoryId}
            onChange={(e) => setCategoryId(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          >
            <option value="">Select Category</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Description (optional)</label>
          <textarea
            rows={3} value={description} onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 border rounded-lg resize-y"
          />
        </div>
      </div>
    </BaseModal>
  );
}

/* ---------- Page ---------- */
export default function MasterSubCategoryPage() {
  const qc = useQueryClient();

  // query state
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // popover (placeholder)
  const [showFilters, setShowFilters] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  // dialogs
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // categories for options
  const { data: rawCats = [] } = useQuery({
    queryKey: ["subcat-parent-categories"],
    queryFn: ({ signal }) => getCategories({}, signal),
    staleTime: 5 * 60_000,
  });
  const categories = useMemo(() => {
    const arr = Array.isArray(rawCats?.items) ? rawCats.items : Array.isArray(rawCats?.data) ? rawCats.data : Array.isArray(rawCats) ? rawCats : [];
    return arr.map((c) => ({ id: c.id, name: c.name }));
  }, [rawCats]);

  // debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // fetch subcategories
  const { data: res, isLoading } = useQuery({
    queryKey: ["sub-categories-master", { page: currentPage, per_page: PER_PAGE, search: debouncedSearch, category_id: categoryFilter || undefined }],
    queryFn: ({ signal }) =>
      listSubCategories({ page: currentPage, per_page: PER_PAGE, search: debouncedSearch, category_id: categoryFilter || undefined }, signal),
    keepPreviousData: true,
    placeholderData: (prev) => prev,
  });

  const items = useMemo(() => res?.items || [], [res]);
  const meta = useMemo(() => res?.meta || { current_page: 1, last_page: 1, per_page: PER_PAGE, total: items.length }, [res, items.length]);

  // mutations
  const mCreate = useMutation({
    mutationFn: ({ payload, signal }) => createSubCategory(payload, signal),
    onSuccess: () => {
      toast.success("Subcategory created");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["sub-categories-master"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload, signal }) => updateSubCategory(id, payload, signal),
    onSuccess: () => {
      toast.success("Subcategory updated");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["sub-categories-master"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteSubCategory(id, signal),
    onSuccess: () => {
      toast.success("Subcategory deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["sub-categories-master"] });
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

  /* Columns */
  const columns = useMemo(() => [
    {
      key: "name",
      header: "Name",
      width: "260px",
      sticky: "left",
      cell: (r) => <span className="font-medium text-gray-900">{r.name}</span>,
    },
    {
      key: "category",
      header: "Category",
      width: "240px",
      cell: (r) => <span className="text-gray-700">{r?.category?.name || r?.category_name || "-"}</span>,
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
  ], []);

  /* Render */
  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Subcategories</h2>
        <p className="text-sm text-gray-500">Kelola sub-kategori & relasinya dengan kategori.</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search subcategory name or description…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <select
            value={categoryFilter}
            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            <option value="">All Categories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>

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
              Add Subcategory
            </button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div className="min-w-full inline-block align-middle">
            {isLoading ? (
              <div className="p-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-3 py-3 border-b last:border-0">
                    <div className="col-span-3 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-3 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-4 h-4 bg-slate-200/80 rounded animate-pulse" />
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

      {/* Filters popover (placeholder future) */}
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
              Tambahkan filter tambahan bila diperlukan (tanggal dibuat, dsb).
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
      <AddSubModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isLoading}
        onSubmit={(payload) => mCreate.mutate({ payload })}
        categories={categories}
      />

      <EditSubModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isLoading}
        initial={editTarget}
        onSubmit={(payload) => mUpdate.mutate({ id: payload.id, payload })}
        categories={categories}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Subcategory"
        message={confirmDel ? <>Yakin hapus sub-kategori <b>{confirmDel.name}</b>?</> : null}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />
    </div>
  );
}
