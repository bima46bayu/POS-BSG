import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Edit, Trash2, SlidersHorizontal, Package } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StoreScopeFilter from "../../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../../hooks/useStoreScopeFilter";
import { getMe } from "../../api/users";
import { listStoreLocations } from "../../api/storeLocations";

import {
  listProductOptionGroups,
  createProductOptionGroup,
  updateProductOptionGroup,
  deleteProductOptionGroup,
  listOptionGroupProducts,
  syncOptionGroupProducts,
} from "../../api/productOptions";

const BRANCH_STORAGE_KEY = "product_option_store_id";
const PARENT_STORAGE_KEY = "product_option_parent_store_id";

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
        checked ? "bg-blue-600" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

function BaseModal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl border max-h-[90vh] flex flex-col">
        <div className="px-5 py-3 border-b flex items-center justify-between shrink-0">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-3 shrink-0">
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ================= ADD / EDIT GROUP ================= */
function GroupModal({ open, onClose, onSubmit, loading, initial }) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: "",
    selection_type: "SINGLE",
    is_required: false,
    is_active: true,
    sort_order: 0,
  });
  const [values, setValues] = useState([]);

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setForm({
        name: initial.name || "",
        selection_type: initial.selection_type === "MULTI" ? "MULTI" : "SINGLE",
        is_required: !!initial.is_required,
        is_active: initial.is_active !== false,
        sort_order: Number(initial.sort_order ?? 0),
      });
      setValues(
        (initial.values || []).map((v) => ({
          id: v.id,
          name: v.name || "",
          price_delta: Number(v.price_delta ?? 0),
          is_active: v.is_active !== false,
        }))
      );
    } else {
      setForm({
        name: "",
        selection_type: "SINGLE",
        is_required: false,
        is_active: true,
        sort_order: 0,
      });
      setValues([{ name: "", price_delta: 0, is_active: true }]);
    }
  }, [open, initial]);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const setValue = (idx, patch) =>
    setValues((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))
    );

  const addValue = () =>
    setValues((prev) => [...prev, { name: "", price_delta: 0, is_active: true }]);

  const removeValue = (idx) =>
    setValues((prev) => prev.filter((_, i) => i !== idx));

  const submit = () => {
    const name = form.name.trim();
    if (!name) return toast.error("Nama grup wajib diisi");

    const cleaned = values
      .map((v, i) => ({
        ...(v.id ? { id: v.id } : {}),
        name: (v.name || "").trim(),
        price_delta: Number(v.price_delta || 0),
        is_active: v.is_active !== false,
        sort_order: i,
      }))
      .filter((v) => v.name);

    if (!cleaned.length) return toast.error("Minimal 1 pilihan");

    onSubmit({
      name,
      selection_type: form.selection_type,
      is_required: !!form.is_required,
      is_active: !!form.is_active,
      sort_order: Number(form.sort_order || 0),
      values: cleaned,
    });
  };

  return (
    <BaseModal
      open={open}
      title={isEdit ? `Edit ${initial.name}` : "Tambah Grup Opsi"}
      onClose={loading ? () => {} : onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Nama Grup</label>
          <input
            value={form.name}
            onChange={set("name")}
            placeholder="Sugar Level"
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium mb-1">Tipe Pilihan</label>
            <select
              value={form.selection_type}
              onChange={set("selection_type")}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              <option value="SINGLE">Pilih 1 (radio)</option>
              <option value="MULTI">Pilih banyak (checkbox)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Urutan</label>
            <input
              type="number"
              value={form.sort_order}
              onChange={set("sort_order")}
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.is_required}
            onChange={set("is_required")}
            className="w-4 h-4"
          />
          Wajib dipilih kasir
        </label>

        <div className="border-t pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium">Pilihan</span>
            <button
              onClick={addValue}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah
            </button>
          </div>

          <div className="space-y-2">
            {values.map((v, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <input
                  value={v.name}
                  onChange={(e) => setValue(idx, { name: e.target.value })}
                  placeholder="No Sugar"
                  className="flex-1 px-3 py-2 border rounded-lg text-sm"
                />
                <div className="relative w-32">
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={v.price_delta}
                    onChange={(e) =>
                      setValue(idx, { price_delta: e.target.value })
                    }
                    className="w-full pl-7 pr-2 py-2 border rounded-lg text-sm"
                  />
                </div>
                <button
                  onClick={() => removeValue(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                  title="Hapus pilihan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            Isi Rp 0 kalau pilihan tidak menambah harga.
          </p>
        </div>
      </div>
    </BaseModal>
  );
}

/* ================= ASSIGN PRODUCTS ================= */
function AssignProductsModal({ open, group, onClose }) {
  const qc = useQueryClient();
  const groupId = group?.id ?? null;

  const [search, setSearch] = useState("");
  const [checked, setChecked] = useState(() => new Set());
  const [dirty, setDirty] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["option-group-products", groupId],
    enabled: open && groupId != null,
    queryFn: ({ signal }) => listOptionGroupProducts(groupId, {}, signal),
  });

  // Seed centang dari server, tapi jangan timpa editan user.
  useEffect(() => {
    if (!open) {
      setSearch("");
      setDirty(false);
      setChecked(new Set());
      return;
    }
    if (data?.attachedIds && !dirty) {
      setChecked(new Set(data.attachedIds.map(Number)));
    }
  }, [open, data?.attachedIds, dirty]);

  const items = data?.items ?? [];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (p) =>
        (p.name || "").toLowerCase().includes(q) ||
        (p.sku || "").toLowerCase().includes(q)
    );
  }, [items, search]);

  const toggle = (id) => {
    setDirty(true);
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const allFilteredChecked =
    filtered.length > 0 && filtered.every((p) => checked.has(p.id));

  const toggleAllFiltered = () => {
    setDirty(true);
    setChecked((prev) => {
      const next = new Set(prev);
      if (allFilteredChecked) {
        filtered.forEach((p) => next.delete(p.id));
      } else {
        filtered.forEach((p) => next.add(p.id));
      }
      return next;
    });
  };

  const mSync = useMutation({
    mutationFn: (ids) => syncOptionGroupProducts(groupId, ids),
    onSuccess: (res) => {
      toast.success(`Terpasang di ${res?.count ?? 0} produk`);
      qc.invalidateQueries({ queryKey: ["product-option-groups"] });
      qc.invalidateQueries({ queryKey: ["option-group-products", groupId] });
      onClose();
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal menyimpan produk"),
  });

  return (
    <BaseModal
      open={open}
      title={group ? `Produk untuk ${group.name}` : "Pilih Produk"}
      onClose={mSync.isPending ? () => {} : onClose}
      footer={
        <>
          <span className="mr-auto text-xs text-gray-500">
            {checked.size} produk dipilih
          </span>
          <button
            onClick={onClose}
            disabled={mSync.isPending}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() => mSync.mutate([...checked])}
            disabled={mSync.isPending || isLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {mSync.isPending ? "Saving..." : "Simpan"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama produk / SKU..."
          className="w-full px-3 py-2 border rounded-lg text-sm"
        />

        {filtered.length > 0 && (
          <button
            onClick={toggleAllFiltered}
            className="text-xs text-blue-600 hover:underline"
          >
            {allFilteredChecked
              ? "Hapus centang semua"
              : `Centang semua (${filtered.length})`}
          </button>
        )}

        <div className="border rounded-lg divide-y max-h-[45vh] overflow-y-auto">
          {isLoading && (
            <div className="p-4 text-sm text-gray-500">Memuat produk...</div>
          )}

          {!isLoading && filtered.length === 0 && (
            <div className="p-4 text-sm text-gray-500">
              {items.length === 0
                ? "Belum ada produk di cabang ini."
                : "Tidak ada produk yang cocok."}
            </div>
          )}

          {filtered.map((p) => (
            <label
              key={p.id}
              className="flex items-center gap-3 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              <input
                type="checkbox"
                checked={checked.has(p.id)}
                onChange={() => toggle(p.id)}
                className="w-4 h-4"
              />
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium truncate">{p.name}</div>
                <div className="text-[11px] text-gray-500">
                  {p.sku || "tanpa SKU"}
                  {p.store_location_id == null ? " · global" : ""}
                </div>
              </div>
              <span className="text-xs text-gray-600 shrink-0">
                {rupiah(p.price)}
              </span>
            </label>
          ))}
        </div>

        <p className="text-[11px] text-gray-500">
          Produk yang dicentang akan meminta kasir memilih opsi ini di POS.
          Produk yang dihapus centangnya akan dilepas dari grup.
        </p>
      </div>
    </BaseModal>
  );
}

/* ================= PAGE ================= */
export default function MasterProductOptionPage() {
  const qc = useQueryClient();

  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);

  const {
    parentFilterId,
    storeFilterId,
    effectiveStoreId,
    canPickStore,
    needsStoreSelection,
    activeStoreLabel,
    handleParentChange,
    handleBranchChange,
  } = useStoreScopeFilter({
    branchStorageKey: BRANCH_STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMe();
        if (!cancelled) setMe(profile);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPickStore) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listStoreLocations({ page: 1, per_page: 200 });
        if (!cancelled) setStores(res?.items || []);
      } catch {
        if (!cancelled) setStores([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickStore]);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [assignTarget, setAssignTarget] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["product-option-groups", effectiveStoreId],
    enabled: effectiveStoreId != null,
    queryFn: ({ signal }) =>
      listProductOptionGroups({ store_location_id: effectiveStoreId }, signal),
  });

  const mCreate = useMutation({
    mutationFn: (payload) =>
      createProductOptionGroup({
        ...payload,
        store_location_id: effectiveStoreId,
      }),
    onSuccess: () => {
      toast.success("Grup opsi dibuat");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["product-option-groups"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal membuat grup opsi"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }) => updateProductOptionGroup(id, payload),
    onSuccess: () => {
      toast.success("Grup opsi diperbarui");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["product-option-groups"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal memperbarui"),
  });

  const mToggle = useMutation({
    mutationFn: ({ id, is_active }) =>
      updateProductOptionGroup(id, { is_active }),
    onSuccess: (_, v) => {
      toast.success(v.is_active ? "Diaktifkan" : "Dimatikan");
      qc.invalidateQueries({ queryKey: ["product-option-groups"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal ubah status"),
  });

  const mDelete = useMutation({
    mutationFn: deleteProductOptionGroup,
    onSuccess: () => {
      toast.success("Grup opsi dihapus");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["product-option-groups"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gagal hapus"),
  });

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Grup",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-gray-400" />
            <div>
              <div className="font-medium">{r.name}</div>
              <div className="text-[11px] text-gray-500">
                {r.selection_type === "MULTI" ? "Pilih banyak" : "Pilih 1"}
                {r.is_required ? " · wajib" : ""}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "values",
        header: "Pilihan",
        cell: (r) => (
          <div className="flex flex-wrap gap-1">
            {(r.values || []).map((v) => (
              <span
                key={v.id}
                className={`text-[11px] px-2 py-0.5 rounded-full border ${
                  v.is_active === false
                    ? "bg-gray-100 text-gray-400 line-through"
                    : "bg-blue-50 text-blue-700 border-blue-100"
                }`}
              >
                {v.name}
                {Number(v.price_delta) > 0
                  ? ` +${rupiah(v.price_delta)}`
                  : ""}
              </span>
            ))}
            {!(r.values || []).length && (
              <span className="text-xs text-gray-400">—</span>
            )}
          </div>
        ),
      },
      {
        key: "products_count",
        header: "Produk",
        align: "center",
        cell: (r) => {
          const count = Number(r.products_count ?? 0);
          return (
            <button
              onClick={() => setAssignTarget(r)}
              className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-xs border transition ${
                count > 0
                  ? "bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100"
                  : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
              }`}
              title="Atur produk yang memakai grup ini"
            >
              <Package className="w-3.5 h-3.5" />
              {count > 0 ? `${count} produk` : "Belum dipasang"}
            </button>
          );
        },
      },
      {
        key: "is_active",
        header: "Aktif",
        align: "center",
        cell: (r) => (
          <Toggle
            checked={r.is_active !== false}
            disabled={mToggle.isPending}
            onChange={(val) => mToggle.mutate({ id: r.id, is_active: val })}
          />
        ),
      },
      {
        key: "__actions",
        header: "Action",
        align: "center",
        cell: (r) => (
          <div className="flex justify-center gap-1.5">
            <button
              onClick={() => setEditTarget(r)}
              className="inline-flex items-center justify-center h-8 px-2 bg-blue-600 text-white rounded-lg text-xs"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </button>
            <button
              onClick={() => setConfirmDel(r)}
              className="inline-flex items-center justify-center h-8 w-8 bg-red-500 text-white rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [mToggle.isPending]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold">Product Options</h2>
        <p className="text-sm text-gray-500">
          Grup opsi item seperti Sugar Level / Ice Level per cabang
        </p>
        <div className="mt-3">
          <StoreScopeFilter
            stores={stores}
            me={me}
            parentId={parentFilterId}
            branchId={storeFilterId}
            onParentChange={handleParentChange}
            onBranchChange={handleBranchChange}
            canPickStore={canPickStore}
            lockedLabel={activeStoreLabel}
          />
        </div>
      </div>

      {needsStoreSelection && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Pilih parent store dan cabang untuk mengatur opsi item.
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          disabled={effectiveStoreId == null}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Tambah Grup Opsi
        </button>
      </div>

      <div className="bg-white border rounded-lg">
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          getRowKey={(r) => r.id}
        />
      </div>

      <GroupModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isPending}
        onSubmit={(payload) => mCreate.mutate(payload)}
      />

      <GroupModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isPending}
        initial={editTarget}
        onSubmit={(payload) =>
          mUpdate.mutate({ id: editTarget.id, payload })
        }
      />

      <AssignProductsModal
        open={!!assignTarget}
        group={assignTarget}
        onClose={() => setAssignTarget(null)}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Grup Opsi"
        message={
          confirmDel && (
            <>
              Yakin hapus <b>{confirmDel.name}</b>? Semua pilihan di dalamnya
              ikut terhapus.
            </>
          )
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
