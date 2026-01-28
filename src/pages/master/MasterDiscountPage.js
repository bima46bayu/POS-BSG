// src/pages/master/MasterDiscountPage.jsx
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  X,
  Edit,
  Trash2,
  BadgePercent,
  CheckCircle2,
  XCircle,
  Filter as FilterIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import { listStoreLocations } from "../../api/storeLocations";
import {
  listDiscounts,
  createDiscount,
  updateDiscount,
  deleteDiscount,
} from "../../api/discounts";

const PER_PAGE = 10;

/* ===== Utils ===== */
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

const fmtMoney = (n) => {
  const v = Number(n || 0);
  return new Intl.NumberFormat("id-ID").format(v);
};

const discountLabel = (r) => {
  if (!r) return "-";
  if (r.kind === "PERCENT") return `${Number(r.value || 0)}%`;
  return `Rp${fmtMoney(r.value)}`;
};

const computeNominalPreview = (r, base = 100000) => {
  if (!r) return 0;
  const value = Number(r.value || 0);
  if (r.kind === "FIXED") return Math.max(0, value);

  const pct = Math.max(0, value);
  let nominal = (base * pct) / 100;
  if (r.max_amount != null && r.max_amount !== "") {
    const cap = Number(r.max_amount);
    if (!Number.isNaN(cap)) nominal = Math.min(nominal, cap);
  }
  return Math.max(0, nominal);
};

/* ===== Base Modal ===== */
function BaseModal({ open, title, onClose, children, footer, maxW = "max-w-xl" }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className={`bg-white rounded-xl w-full ${maxW} mx-4 shadow-xl border`}>
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-3">{footer}</div>
      </div>
    </div>
  );
}

/* ===== Filter Popover (model kayak screenshot: panel + Apply/Clear) ===== */
function FilterPopover({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const popRef = useRef(null);

  // temp state biar bisa Apply / Clear
  const [temp, setTemp] = useState({
    scope: value.scope ?? "",
    kind: value.kind ?? "",
    active: value.active ?? "",
  });

  useEffect(() => {
    // kalau value berubah dari luar, sync temp saat popover belum dibuka
    if (!open) {
      setTemp({
        scope: value.scope ?? "",
        kind: value.kind ?? "",
        active: value.active ?? "",
      });
    }
  }, [value.scope, value.kind, value.active, open]);

  useEffect(() => {
    function onDocClick(e) {
      if (!open) return;
      const t = e.target;
      if (btnRef.current?.contains(t)) return;
      if (popRef.current?.contains(t)) return;
      setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  const hasFilter =
    (value.scope && value.scope !== "") ||
    (value.kind && value.kind !== "") ||
    (value.active && value.active !== "");

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm bg-white hover:bg-gray-50 ${
          hasFilter ? "border-blue-300" : "border-gray-200"
        }`}
        title="Filter"
      >
        <FilterIcon className="w-4 h-4 text-gray-500" />
        Filter
        {hasFilter ? (
          <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-blue-600 text-white text-[11px]">
            1
          </span>
        ) : null}
      </button>

      {open ? (
        <div
          ref={popRef}
          className="absolute right-0 mt-2 w-[320px] bg-white border border-gray-200 shadow-lg rounded-xl z-40"
        >
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <div className="font-semibold text-sm">Filter</div>
            <button onClick={() => setOpen(false)} className="p-1 rounded-full hover:bg-gray-100">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Scope</label>
              <select
                value={temp.scope}
                onChange={(e) => setTemp((p) => ({ ...p, scope: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="">All</option>
                <option value="GLOBAL">GLOBAL</option>
                <option value="ITEM">ITEM</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Kind</label>
              <select
                value={temp.kind}
                onChange={(e) => setTemp((p) => ({ ...p, kind: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="">All</option>
                <option value="PERCENT">PERCENT</option>
                <option value="FIXED">FIXED</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Active</label>
              <select
                value={temp.active}
                onChange={(e) => setTemp((p) => ({ ...p, active: e.target.value }))}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="">All</option>
                <option value="1">Active</option>
                <option value="0">Off</option>
              </select>
            </div>
          </div>

          <div className="px-4 py-3 border-t flex items-center justify-between">
            <button
              onClick={() => {
                const cleared = { scope: "", kind: "", active: "" };
                setTemp(cleared);
                onChange(cleared);
                setOpen(false);
              }}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Clear
            </button>
            <button
              onClick={() => {
                onChange(temp);
                setOpen(false);
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              Apply
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ===== Add Modal ===== */
function AddDiscountModal({ open, loading, onClose, onSubmit, stores = [] }) {
  const [form, setForm] = useState({
    name: "",
    scope: "GLOBAL",
    kind: "PERCENT",
    value: 10,
    max_amount: "",
    min_subtotal: "",
    active: true,
    store_location_id: "",
  });

  useEffect(() => {
    if (open) {
      setForm({
        name: "",
        scope: "GLOBAL",
        kind: "PERCENT",
        value: 10,
        max_amount: "",
        min_subtotal: "",
        active: true,
        store_location_id: "",
      });
    }
  }, [open]);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const preview = computeNominalPreview(form, 100000);

  return (
    <BaseModal
      open={open}
      title="Add Discount"
      onClose={loading ? () => {} : onClose}
      maxW="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-2 border rounded-lg text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={loading || !form.name.trim() || !form.store_location_id}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            value={form.name}
            onChange={set("name")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Diskon Member 10%"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Store Location</label>
          <select
            value={form.store_location_id}
            onChange={set("store_location_id")}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">Pilih store…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} - ` : ""}{s.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-[11px] text-gray-500">Diskon dibuat per store (wajib).</p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Scope</label>
          <select
            value={form.scope}
            onChange={set("scope")}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="GLOBAL">GLOBAL (diskon total)</option>
            <option value="ITEM">ITEM (diskon per item)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kind</label>
          <select
            value={form.kind}
            onChange={set("kind")}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="PERCENT">PERCENT (%)</option>
            <option value="FIXED">FIXED (nominal)</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Value {form.kind === "PERCENT" ? "(%)" : "(Rp)"}
          </label>
          <input
            type="number"
            step="0.01"
            value={form.value}
            onChange={set("value")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Max Amount (opsional, %)</label>
          <input
            type="number"
            step="0.01"
            value={form.max_amount}
            onChange={set("max_amount")}
            disabled={form.kind !== "PERCENT"}
            className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
            placeholder="contoh: 20000"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Min Amount (Min Subtotal)</label>
          <input
            type="number"
            step="0.01"
            value={form.min_subtotal}
            onChange={set("min_subtotal")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="contoh: 50000"
          />
        </div>

        <div className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={!!form.active} onChange={set("active")} />
          <span className="text-sm text-gray-700">Active</span>

          <div className="ml-auto text-xs text-gray-600">
            Preview nominal (base Rp100.000): <b>Rp{fmtMoney(preview)}</b>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

/* ===== Edit Modal ===== */
function EditDiscountModal({ open, loading, onClose, onSubmit, initial, stores = [] }) {
  const [form, setForm] = useState({
    id: null,
    name: "",
    scope: "GLOBAL",
    kind: "PERCENT",
    value: 10,
    max_amount: "",
    min_subtotal: "",
    active: true,
    store_location_id: "",
  });

  useEffect(() => {
    if (open && initial) {
      setForm({
        id: initial.id,
        name: initial.name || "",
        scope: initial.scope || "GLOBAL",
        kind: initial.kind || "PERCENT",
        value: initial.value ?? 0,
        max_amount: initial.max_amount ?? "",
        min_subtotal: initial.min_subtotal ?? "",
        active: !!initial.active,
        store_location_id: initial.store_location_id ?? "",
      });
    }
  }, [open, initial]);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  const preview = computeNominalPreview(form, 100000);

  return (
    <BaseModal
      open={open}
      title="Edit Discount"
      onClose={loading ? () => {} : onClose}
      maxW="max-w-2xl"
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-3 py-2 border rounded-lg text-sm">
            Cancel
          </button>
          <button
            onClick={() => onSubmit(form)}
            disabled={loading || !form.name.trim() || !form.store_location_id}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Name</label>
          <input value={form.name} onChange={set("name")} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Store Location</label>
          <select
            value={form.store_location_id}
            onChange={set("store_location_id")}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="">Pilih store…</option>
            {stores.map((s) => (
              <option key={s.id} value={s.id}>
                {s.code ? `${s.code} - ` : ""}{s.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Scope</label>
          <select value={form.scope} onChange={set("scope")} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="GLOBAL">GLOBAL</option>
            <option value="ITEM">ITEM</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Kind</label>
          <select value={form.kind} onChange={set("kind")} className="w-full px-3 py-2 border rounded-lg text-sm bg-white">
            <option value="PERCENT">PERCENT</option>
            <option value="FIXED">FIXED</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Value {form.kind === "PERCENT" ? "(%)" : "(Rp)"}
          </label>
          <input type="number" step="0.01" value={form.value} onChange={set("value")} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Max Amount (opsional, %)</label>
          <input
            type="number"
            step="0.01"
            value={form.max_amount}
            onChange={set("max_amount")}
            disabled={form.kind !== "PERCENT"}
            className="w-full px-3 py-2 border rounded-lg text-sm disabled:bg-gray-100"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Min Amount (Min Subtotal)</label>
          <input type="number" step="0.01" value={form.min_subtotal} onChange={set("min_subtotal")} className="w-full px-3 py-2 border rounded-lg text-sm" />
        </div>

        <div className="flex items-center gap-2 md:col-span-2">
          <input type="checkbox" checked={!!form.active} onChange={set("active")} />
          <span className="text-sm text-gray-700">Active</span>

          <div className="ml-auto text-xs text-gray-600">
            Preview nominal (base Rp100.000): <b>Rp{fmtMoney(preview)}</b>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

/* ===== Detail Modal ===== */
function DetailDiscountModal({ open, onClose, data, stores = [] }) {
  if (!open || !data) return null;

  const store = stores.find((s) => Number(s.id) === Number(data.store_location_id));
  const Row = ({ label, value }) => (
    <div className="flex items-start justify-between gap-4 py-2 border-b last:border-b-0">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-sm text-gray-900 text-right break-words max-w-[60%]">
        {value ?? "-"}
      </div>
    </div>
  );

  return (
    <BaseModal
      open={open}
      title="Discount Detail"
      onClose={onClose}
      maxW="max-w-xl"
      footer={
        <button onClick={onClose} className="px-3 py-2 border rounded-lg text-sm">
          Close
        </button>
      }
    >
      <div className="space-y-2">
        <Row label="ID" value={data.id} />
        <Row label="Name" value={data.name} />
        <Row label="Store" value={store ? `${store.code ? store.code + " - " : ""}${store.name}` : data.store_location_id} />
        <Row label="Scope" value={data.scope} />
        <Row label="Kind" value={data.kind} />
        <Row label="Value" value={discountLabel(data)} />
        <Row label="Max Amount" value={data.max_amount == null ? "-" : `Rp${fmtMoney(data.max_amount)}`} />
        <Row label="Min Amount (Min Subtotal)" value={data.min_subtotal == null ? "-" : `Rp${fmtMoney(data.min_subtotal)}`} />
        <Row label="Active" value={data.active ? "Yes" : "No"} />
        <Row label="Created At" value={fmtDateTime(data.created_at)} />
        <Row label="Updated At" value={fmtDateTime(data.updated_at)} />
        <Row label="Preview (base Rp100.000)" value={`Rp${fmtMoney(computeNominalPreview(data, 100000))}`} />
      </div>
    </BaseModal>
  );
}

/* ===== Page ===== */
export default function MasterDiscountPage() {
  const qc = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // filter state (dipakai query)
  const [filters, setFilters] = useState({ scope: "", kind: "", active: "" });

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [detailTarget, setDetailTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  // debounce search
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 250);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // store list
  const { data: storeRes } = useQuery({
    queryKey: ["store-locations", { page: 1, per_page: 500 }],
    queryFn: ({ signal }) => listStoreLocations({ page: 1, per_page: 500 }, signal),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
  const storesRaw = storeRes?.items ?? storeRes?.data ?? storeRes ?? [];
  const stores = useMemo(() => (Array.isArray(storesRaw) ? storesRaw : []), [storesRaw]);

  // discounts list
  const { data: res, isLoading } = useQuery({
    queryKey: [
      "discounts",
      {
        page: currentPage,
        per_page: PER_PAGE,
        q: debouncedSearch,
        ...filters,
      },
    ],
    queryFn: ({ signal }) =>
      listDiscounts(
        {
          page: currentPage,
          per_page: PER_PAGE,
          q: debouncedSearch, // backend pakai q
          scope: filters.scope || undefined,
          kind: filters.kind || undefined,
          active: filters.active === "" ? undefined : filters.active,
        },
        signal
      ),
    keepPreviousData: true,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const itemsRaw = res?.items ?? res?.data ?? res ?? [];
  const items = useMemo(() => (Array.isArray(itemsRaw) ? itemsRaw : []), [itemsRaw]);

  const meta = useMemo(() => {
    if (res?.meta) {
      const m = res.meta;
      return {
        current_page: Number(m.current_page ?? 1),
        last_page: Number(m.last_page ?? 1),
        per_page: Number(m.per_page ?? PER_PAGE),
        total: Number(m.total ?? items.length),
      };
    }
    const root = res?.raw ?? res;
    if (root && typeof root === "object" && "current_page" in root && "last_page" in root) {
      return {
        current_page: Number(root.current_page ?? 1),
        last_page: Number(root.last_page ?? 1),
        per_page: Number(root.per_page ?? PER_PAGE),
        total: Number(root.total ?? 0),
      };
    }
    const total = items.length;
    const last = Math.max(1, Math.ceil(total / PER_PAGE));
    return { current_page: currentPage, last_page: last, per_page: PER_PAGE, total };
  }, [res, items.length, currentPage]);

  /* ===== Mutations ===== */
  const mCreate = useMutation({
    mutationFn: async ({ payload, signal }) => {
      const body = {
        name: String(payload.name || "").trim(),
        scope: payload.scope,
        kind: payload.kind,
        value: Number(payload.value || 0),
        max_amount:
          payload.kind === "PERCENT" && payload.max_amount !== ""
            ? Number(payload.max_amount)
            : null,
        min_subtotal: payload.min_subtotal !== "" ? Number(payload.min_subtotal) : null,
        active: !!payload.active,
        store_location_id: Number(payload.store_location_id),
      };
      return createDiscount(body, signal);
    },
    onSuccess: () => {
      toast.success("Discount created");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["discounts"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const mUpdate = useMutation({
    mutationFn: async ({ id, payload, signal }) => {
      const body = {
        name: String(payload.name || "").trim(),
        scope: payload.scope,
        kind: payload.kind,
        value: Number(payload.value || 0),
        max_amount:
          payload.kind === "PERCENT" && payload.max_amount !== ""
            ? Number(payload.max_amount)
            : null,
        min_subtotal: payload.min_subtotal !== "" ? Number(payload.min_subtotal) : null,
        active: !!payload.active,
        store_location_id: Number(payload.store_location_id),
      };
      return updateDiscount(id, body, signal);
    },
    onSuccess: () => {
      toast.success("Discount updated");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["discounts"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteDiscount(id, signal),
    onSuccess: () => {
      toast.success("Discount deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["discounts"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete"),
  });

  /* ===== Columns (tambah Max & Min Amount di table) ===== */
  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Name",
        width: "280px",
        sticky: "left",
        cell: (r) => {
          const truncateWords = (text, limit = 5) => {
            if (!text) return "-";
            const words = String(text).split(" ");
            if (words.length <= limit) return text;
            return words.slice(0, limit).join(" ") + "...";
          };
          return (
            <div className="flex items-center gap-2">
              <BadgePercent className="w-4 h-4 text-gray-400" />
              <span className="font-medium text-gray-900 truncate" title={r.name}>
                {truncateWords(r.name, 5)}
              </span>
            </div>
          );
        },
      },
      { key: "scope", header: "Scope", width: "80px", cell: (r) => <span className="text-xs">{r.scope}</span> },
      { key: "kind", header: "Kind", width: "80px", cell: (r) => <span className="text-xs">{r.kind}</span> },
      {
        key: "value",
        header: "Value",
        width: "80px",
        align: "right",
        cell: (r) => <span className="font-medium">{discountLabel(r)}</span>,
      },
      {
        key: "max_amount",
        header: "Max Amount",
        width: "140px",
        align: "right",
        cell: (r) => (
          <span className="text-xs text-gray-800">
            {r.max_amount == null || r.max_amount === "" ? "-" : `Rp${fmtMoney(r.max_amount)}`}
          </span>
        ),
      },
      {
        key: "min_subtotal",
        header: "Min Amount",
        width: "140px",
        align: "right",
        cell: (r) => (
          <span className="text-xs text-gray-800">
            {r.min_subtotal == null || r.min_subtotal === "" ? "-" : `Rp${fmtMoney(r.min_subtotal)}`}
          </span>
        ),
      },
      {
        key: "active",
        header: "Active",
        width: "140px",
        align: "center",
        cell: (r) =>
          r.active ? (
            <span className="inline-flex items-center gap-1 text-xs text-green-700">
              <CheckCircle2 className="w-4 h-4" /> Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-xs text-gray-500">
              <XCircle className="w-4 h-4" /> Off
            </span>
          ),
      },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Discounts</h2>
        <p className="text-sm text-gray-500">
          Kelola master diskon (GLOBAL / ITEM) per store location.
        </p>
      </div>

      {/* Controls (filter jadi popover seperti contoh) */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <FilterPopover
            value={filters}
            onChange={(next) => {
              setFilters(next);
              setCurrentPage(1);
            }}
          />

          <div className="ml-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Discount
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
                    <div className="col-span-4 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
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
                    width: "240px",
                    sticky: "right",
                    align: "center",
                    cell: (r) => (
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => setDetailTarget(r)}
                          className="inline-flex items-center justify-center h-8 px-2 border border-blue-600 text-blue-600 bg-white rounded-lg hover:bg-blue-50 text-xs"
                          title="Detail"
                        >
                          Detail
                        </button>

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
                getRowKey={(row, i) => row.id ?? row.name ?? i}
                className="border-0 shadow-none text-[13px] [&_th]:py-2 [&_td]:py-2 [&_th]:px-3 [&_td]:px-3"
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddDiscountModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isPending}
        stores={stores}
        onSubmit={(payload) => mCreate.mutate({ payload })}
      />

      <EditDiscountModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isPending}
        stores={stores}
        initial={editTarget}
        onSubmit={(payload) => mUpdate.mutate({ id: payload.id, payload })}
      />

      <DetailDiscountModal
        open={!!detailTarget}
        onClose={() => setDetailTarget(null)}
        data={detailTarget}
        stores={stores}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Discount"
        message={
          confirmDel ? (
            <>
              Yakin hapus discount <b>{confirmDel.name}</b>?
            </>
          ) : null
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />
    </div>
  );
}
