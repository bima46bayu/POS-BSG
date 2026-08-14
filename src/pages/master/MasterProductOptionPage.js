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
import { getProducts } from "../../api/products";
import { listUnits } from "../../api/units";

const BRANCH_STORAGE_KEY = "product_option_store_id";
const PARENT_STORAGE_KEY = "product_option_parent_store_id";

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

function productUnitId(product) {
  return product?.unit_id ?? product?.unit?.id ?? "";
}

function productUnit(product) {
  return (
    product?.unit_name ||
    product?.unit?.name ||
    product?.unit?.code ||
    ""
  );
}

function normalizeUnitKey(name) {
  const key = String(name || "").toLowerCase().trim();
  const map = {
    kg: "kg",
    kilogram: "kg",
    kilograms: "kg",
    g: "g",
    gr: "g",
    gram: "g",
    grams: "g",
    l: "l",
    liter: "l",
    litre: "l",
    ltr: "l",
    ml: "ml",
    milliliter: "ml",
    millilitre: "ml",
  };
  return map[key] || key;
}

function unitFamily(name) {
  const key = normalizeUnitKey(name);
  if (key === "kg" || key === "g") return "mass";
  if (key === "l" || key === "ml") return "volume";
  return "other";
}

/** Same filter as Master Recipe — only units convertible to the bahan stock unit. */
function compatibleUnits(allUnits, stockUnitName) {
  if (!stockUnitName) return allUnits;
  const family = unitFamily(stockUnitName);
  if (family === "mass") {
    return allUnits.filter((u) => unitFamily(u.name) === "mass");
  }
  if (family === "volume") {
    return allUnits.filter((u) => unitFamily(u.name) === "volume");
  }
  const stockKey = normalizeUnitKey(stockUnitName);
  return allUnits.filter((u) => normalizeUnitKey(u.name) === stockKey);
}

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

function BaseModal({ open, title, onClose, children, footer, wide }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div
        className={`bg-white rounded-xl w-full ${
          wide ? "max-w-4xl" : "max-w-3xl"
        } shadow-xl border max-h-[90vh] flex flex-col`}
      >
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
function GroupModal({ open, onClose, onSubmit, loading, initial, storeLocationId }) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    name: "",
    selection_type: "SINGLE",
    is_required: false,
    is_active: true,
    sort_order: 0,
    ingredient_product_id: "",
  });
  const [values, setValues] = useState([]);
  const [hydrated, setHydrated] = useState(false);

  // Stock products = recipe ingredients (Ice, Gula, …).
  const stockQuery = useQuery({
    queryKey: ["option-ingredients", storeLocationId],
    enabled: open && storeLocationId != null,
    queryFn: ({ signal }) =>
      getProducts(
        {
          per_page: 500,
          inventory_type: "stock",
          store_location_id: storeLocationId,
        },
        signal
      ).then((res) => res?.items ?? []),
    staleTime: 60_000,
  });

  const unitsQuery = useQuery({
    queryKey: ["units-for-option-qty"],
    enabled: open,
    queryFn: () => listUnits({ per_page: 200 }),
    staleTime: 120_000,
  });

  const stockProducts = stockQuery.data ?? [];
  const units = unitsQuery.data ?? [];

  // Wait for catalogs before painting editable rows — otherwise the unit
  // <select> has no options yet and browsers flash the stock unit (L).
  const catalogsReady =
    open &&
    unitsQuery.isSuccess &&
    (storeLocationId == null || stockQuery.isSuccess);

  const selectedIngredient = useMemo(() => {
    const id = Number(form.ingredient_product_id || 0);
    if (!id) return null;
    return (
      stockProducts.find((x) => Number(x.id) === id) ??
      (Number(initial?.ingredient_product_id) === id ? initial?.ingredient : null) ??
      null
    );
  }, [form.ingredient_product_id, stockProducts, initial]);

  const stockUnitName =
    productUnit(selectedIngredient) || productUnit(initial?.ingredient) || "";
  const qtyUnits = useMemo(
    () => compatibleUnits(units, stockUnitName),
    [units, stockUnitName]
  );

  const defaultQtyUnitId = useMemo(() => {
    const fromIng =
      productUnitId(selectedIngredient) || productUnitId(initial?.ingredient);
    if (fromIng) return String(fromIng);
    return qtyUnits[0] ? String(qtyUnits[0].id) : "";
  }, [selectedIngredient, initial, qtyUnits]);

  // Reset when closed so the next open always re-hydrates from saved data.
  useEffect(() => {
    if (!open) setHydrated(false);
  }, [open]);

  // Hydrate once catalogs are ready — never before, so saved Ml is not lost.
  useEffect(() => {
    if (!open || !catalogsReady || hydrated) return;

    if (initial) {
      const ingId = initial.ingredient_product_id
        ? String(initial.ingredient_product_id)
        : "";
      const fallbackUnit = String(
        productUnitId(initial.ingredient) || defaultQtyUnitId || ""
      );
      setForm({
        name: initial.name || "",
        selection_type: initial.selection_type === "MULTI" ? "MULTI" : "SINGLE",
        is_required: !!initial.is_required,
        is_active: initial.is_active !== false,
        sort_order: Number(initial.sort_order ?? 0),
        ingredient_product_id: ingId,
      });
      setValues(
        (initial.values || []).map((v) => {
          const saved = String(
            v.qty_delta_unit_id ?? v.qty_delta_unit?.id ?? ""
          );
          return {
            id: v.id,
            name: v.name || "",
            price_delta: Number(v.price_delta ?? 0),
            qty_delta: String(v.qty_delta ?? 0),
            // Prefer the saved unit; only fall back when none was stored.
            qty_delta_unit_id: saved || fallbackUnit,
            is_active: v.is_active !== false,
          };
        })
      );
    } else {
      setForm({
        name: "",
        selection_type: "SINGLE",
        is_required: false,
        is_active: true,
        sort_order: 0,
        ingredient_product_id: "",
      });
      setValues([
        {
          name: "",
          price_delta: 0,
          qty_delta: "0",
          qty_delta_unit_id: "",
          is_active: true,
        },
      ]);
    }
    setHydrated(true);
  }, [open, catalogsReady, hydrated, initial, defaultQtyUnitId]);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const onIngredientChange = (e) => {
    const id = e.target.value;
    const product = stockProducts.find((x) => String(x.id) === String(id));
    const nextStock = productUnit(product);
    const allowed = compatibleUnits(units, nextStock);
    const nextUnitId =
      productUnitId(product) || (allowed[0] ? String(allowed[0].id) : "");

    setForm((p) => ({
      ...p,
      ingredient_product_id: id,
      name:
        p.name.trim() === "" || p.name === (initial?.ingredient?.name ?? "")
          ? product?.name || p.name
          : p.name,
    }));

    setValues((prev) =>
      prev.map((v) => ({
        ...v,
        qty_delta_unit_id: nextUnitId || v.qty_delta_unit_id,
      }))
    );
  };

  const setValue = (idx, patch) =>
    setValues((prev) =>
      prev.map((v, i) => (i === idx ? { ...v, ...patch } : v))
    );

  const addValue = () =>
    setValues((prev) => [
      ...prev,
      {
        name: "",
        price_delta: 0,
        qty_delta: "0",
        qty_delta_unit_id: defaultQtyUnitId,
        is_active: true,
      },
    ]);

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
        qty_delta: Number(v.qty_delta || 0),
        qty_delta_unit_id: v.qty_delta_unit_id
          ? Number(v.qty_delta_unit_id)
          : null,
        is_active: v.is_active !== false,
        sort_order: i,
      }))
      .filter((v) => v.name);

    if (!cleaned.length) return toast.error("Minimal 1 pilihan");

    const hasQtyAdjust = cleaned.some((v) => Number(v.qty_delta) !== 0);
    if (hasQtyAdjust && !form.ingredient_product_id) {
      return toast.error(
        "Pilih bahan inventory dulu — kolom qty mengubah resep bahan itu."
      );
    }
    if (hasQtyAdjust && cleaned.some((v) => Number(v.qty_delta) !== 0 && !v.qty_delta_unit_id)) {
      return toast.error("Pilih satuan (Unit) untuk qty, sama seperti di resep.");
    }

    onSubmit({
      name,
      selection_type: form.selection_type,
      is_required: !!form.is_required,
      is_active: !!form.is_active,
      sort_order: Number(form.sort_order || 0),
      ingredient_product_id: form.ingredient_product_id
        ? Number(form.ingredient_product_id)
        : null,
      values: cleaned,
    });
  };

  const showForm = catalogsReady && hydrated;

  return (
    <BaseModal
      open={open}
      wide
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
            disabled={loading || !showForm}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      {!showForm ? (
        <div className="py-16 text-center text-sm text-gray-500">
          Memuat data opsi…
        </div>
      ) : (
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">
            Bahan Inventory (untuk qty resep)
          </label>
          <select
            value={form.ingredient_product_id}
            onChange={onIngredientChange}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">— Tidak dihubungkan (harga saja) —</option>
            {stockProducts.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.unit_name || p.unit?.name
                  ? ` (${p.unit_name || p.unit?.name})`
                  : ""}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">
            Contoh: pilih <b>Ice</b> supaya kolom qty menambah/mengurangi es di
            resep produk.
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Nama Grup</label>
          <input
            value={form.name}
            onChange={set("name")}
            placeholder="Ice / Sugar Level"
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
              type="button"
              onClick={addValue}
              className="inline-flex items-center gap-1 text-xs px-2 py-1 border rounded-lg hover:bg-gray-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah
            </button>
          </div>

          <div className="grid grid-cols-[1fr_5rem_4.5rem_4.5rem_2.5rem] gap-2 items-center px-1 mb-1">
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Nama
            </span>
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Harga
            </span>
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Amount
            </span>
            <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">
              Unit
            </span>
            <span />
          </div>

          <div className="space-y-2">
            {values.map((v, idx) => (
              <div key={v.id ?? `new-${idx}`} className="flex gap-2 items-center">
                <input
                  value={v.name}
                  onChange={(e) => setValue(idx, { name: e.target.value })}
                  placeholder="No Ice"
                  className="flex-1 min-w-0 px-2 py-2 border rounded-lg text-sm"
                />
                <div className="relative w-[5rem] shrink-0">
                  <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[10px] text-gray-400">
                    Rp
                  </span>
                  <input
                    type="number"
                    step="0.01"
                    value={v.price_delta}
                    onChange={(e) =>
                      setValue(idx, { price_delta: e.target.value })
                    }
                    className="w-full pl-6 pr-1 py-2 border rounded-lg text-sm"
                    title="Tambahan harga"
                  />
                </div>
                <input
                  type="number"
                  step="0.0001"
                  value={v.qty_delta}
                  onChange={(e) => setValue(idx, { qty_delta: e.target.value })}
                  className="w-[4.5rem] px-2 py-2 border rounded-lg text-sm shrink-0"
                  title="Qty vs resep (+ tambah / − kurang)"
                  placeholder="0"
                />
                <select
                  value={v.qty_delta_unit_id || ""}
                  onChange={(e) =>
                    setValue(idx, { qty_delta_unit_id: e.target.value })
                  }
                  className="w-[4.5rem] px-1 py-2 border rounded-lg text-sm shrink-0 bg-white"
                  title="Satuan amount (sama seperti resep)"
                  disabled={!form.ingredient_product_id}
                >
                  <option value="">Unit</option>
                  {qtyUnits.map((u) => (
                    <option key={u.id} value={String(u.id)}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeValue(idx)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-lg shrink-0"
                  title="Hapus pilihan"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <p className="mt-2 text-[11px] text-gray-500">
            Amount + Unit sama seperti Product Recipe.{" "}
            <b>+5 Ml</b> menambah, <b>-10 Ml</b> mengurangi dari qty resep.
            {stockUnitName ? (
              <>
                {" "}
                Bahan ini stoknya dalam <b>{stockUnitName}</b>.
              </>
            ) : null}
          </p>
        </div>
      </div>
      )}
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
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
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

  // Prefetch catalogs so Edit can hydrate with the real saved units immediately.
  useQuery({
    queryKey: ["units-for-option-qty"],
    queryFn: () => listUnits({ per_page: 200 }),
    staleTime: 120_000,
  });

  useQuery({
    queryKey: ["option-ingredients", effectiveStoreId],
    enabled: effectiveStoreId != null,
    queryFn: ({ signal }) =>
      getProducts(
        {
          per_page: 500,
          inventory_type: "stock",
          store_location_id: effectiveStoreId,
        },
        signal
      ).then((res) => res?.items ?? []),
    staleTime: 60_000,
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
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
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
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
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
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
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
      qc.invalidateQueries({ queryKey: ["products"], exact: false });
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
                {r.ingredient?.name
                  ? ` · bahan: ${r.ingredient.name}`
                  : r.ingredient_product_id
                    ? " · bahan terhubung"
                    : ""}
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
                {Number(v.qty_delta) !== 0
                  ? ` ${Number(v.qty_delta) > 0 ? "+" : ""}${v.qty_delta}${
                      v.qty_delta_unit?.name
                        ? ` ${v.qty_delta_unit.name}`
                        : ""
                    }`
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
        key={editTarget ? `edit-${editTarget.id}` : "edit-closed"}
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isPending}
        initial={editTarget}
        storeLocationId={effectiveStoreId}
        onSubmit={(payload) =>
          mUpdate.mutate({ id: editTarget.id, payload })
        }
      />

      <GroupModal
        key={showAdd ? "add-open" : "add-closed"}
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isPending}
        storeLocationId={effectiveStoreId}
        onSubmit={(payload) => mCreate.mutate(payload)}
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
