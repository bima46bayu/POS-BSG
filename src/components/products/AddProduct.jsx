// src/components/products/AddProduct.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, UploadCloud, X as XIcon } from "lucide-react";
import { getMe } from "../../api/users";
import UnitDropdown from "./UnitDropdown"; // ⬅️ PENTING

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSubmit: (payload) => Promise<void> | void
 *  - categories: [{id, name}]
 *  - subCategories: [{id, name, category_id}]
 */
export default function AddProduct({
  open,
  onClose,
  onSubmit,
  categories = [],
  subCategories = [],
}) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    category_id: "",
    sub_category_id: "",
    stock: "",
    sku: "",
    description: "",
    unit_id: "", // ⬅️ baru
  });

  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // === store user dari /api/me (auto) ===
  const [storeLocationId, setStoreLocationId] = useState(null);
  const [meLoading, setMeLoading] = useState(true);
  const [meError, setMeError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setMeLoading(true);
      setMeError("");
      try {
        const me = await getMe();
        const sid = me?.store_location?.id ?? me?.store_location_id ?? null;
        if (!cancelled) setStoreLocationId(sid);
      } catch (e) {
        if (!cancelled) {
          setStoreLocationId(null);
          setMeError("Gagal mengambil lokasi store user.");
        }
      } finally {
        if (!cancelled) setMeLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Filter subcategory berdasarkan category
  const filteredSubs = useMemo(() => {
    const list = subCategories || [];
    const cid = String(form.category_id || "");
    if (!cid) return list;
    return list.filter((s) => {
      const rel =
        s.category_id ?? s.categoryId ?? s.parent_id ?? s.parentId ?? "";
      return String(rel) === cid;
    });
  }, [form.category_id, subCategories]);

  // Reset state saat modal ditutup
  useEffect(() => {
    if (!open) {
      setForm({
        name: "",
        price: "",
        category_id: "",
        sub_category_id: "",
        stock: "",
        sku: "",
        description: "",
        unit_id: "",
      });
      setFiles([]);
      setSubmitting(false);
    }
  }, [open]);

  const onChange = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onChangeCategory = (e) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      category_id: value,
      sub_category_id: "", // reset jika category berubah
    }));
  };

  // ========= Upload helpers =========
  const readableSize = (n) => {
    const kb = n / 1024;
    if (kb < 1024) return `${Math.round(kb)}kb`;
    return `${(kb / 1024).toFixed(1)}mb`;
  };

  const addFiles = (fileList) => {
    const accepted = Array.from(fileList || []).filter((f) => {
      const okType = /image\/(jpeg|png|svg\+xml)/.test(f.type);
      const okSize = f.size <= 10 * 1024 * 1024; // 10MB
      return okType && okSize;
    });
    const mapped = accepted.map((f) => ({
      file: f,
      url: URL.createObjectURL(f),
      sizeLabel: readableSize(f.size),
    }));
    setFiles((prev) => [...prev, ...mapped]);
  };

  useEffect(() => {
    return () => files.forEach((f) => URL.revokeObjectURL(f.url));
  }, [files]);

  const onDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    addFiles(e.dataTransfer.files);
  };

  const onPickFiles = (e) => {
    addFiles(e.target.files);
    e.currentTarget.value = "";
  };

  const removeFile = (idx) =>
    setFiles((prev) => {
      const c = [...prev];
      const [sp] = c.splice(idx, 1);
      if (sp?.url) URL.revokeObjectURL(sp.url);
      return c;
    });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    if (storeLocationId == null) {
      alert(
        "Lokasi store user tidak ditemukan. Silakan relogin atau hubungi admin."
      );
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        price: form.price ? Number(form.price) : 0,
        stock: form.stock ? Number(form.stock) : 0,
        images: files.map((f) => f.file),
        store_location_id: storeLocationId,
      };

      // normalisasi unit_id: kalau string kosong → null
      if (!payload.unit_id) {
        payload.unit_id = null;
      }

      await onSubmit?.(payload);
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center">
      {/* backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* panel */}
      <form
        onSubmit={handleSubmit}
        className="relative z-[101] w-full max-w-2xl bg-white rounded-2xl shadow-xl max-h-[85vh] flex flex-col"
      >
        {/* header */}
        <div className="px-6 py-4 border-b">
          <h2 className="text-xl leading-6 font-semibold text-gray-900">
            Tambah Produk
          </h2>
          {meLoading && (
            <p className="text-xs text-gray-500 mt-1">
              Memuat store user…
            </p>
          )}
          {!meLoading && storeLocationId == null && (
            <p className="text-xs text-red-600 mt-1">
              {meError || "Store user tidak ditemukan. Produk tidak bisa disimpan."}
            </p>
          )}
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          <Field label="Product Name">
            <Input
              placeholder="Kaos Logo"
              value={form.name}
              onChange={onChange("name")}
              required
            />
          </Field>

          <Field label="Price">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="120000"
              value={form.price}
              onChange={onChange("price")}
              min="0"
              required
            />
          </Field>

          {/* Category + Subcategory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Category">
              <Select
                value={form.category_id}
                onChange={onChangeCategory}
                placeholder="Pilih kategori"
                options={categories}
              />
            </Field>
            <Field label="Sub Category">
              <Select
                value={form.sub_category_id}
                onChange={onChange("sub_category_id")}
                placeholder="Pilih sub kategori"
                options={filteredSubs}
              />
            </Field>
          </div>

          {/* Stock + Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Stock">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="10"
                value={form.stock}
                onChange={onChange("stock")}
                min="0"
              />
            </Field>

            <Field label="Unit">
              <UnitDropdown
                value={form.unit_id}
                onChange={(id) =>
                  setForm((f) => ({ ...f, unit_id: id ?? "" }))
                }
                placeholder="Pilih / kelola satuan"
              />
            </Field>
          </div>

          <Field label="SKU">
            <Input
              placeholder="SKU-041"
              value={form.sku}
              onChange={onChange("sku")}
              required
            />
          </Field>

          <Field label="Description">
            <Textarea
              placeholder="Kaos logo NU"
              value={form.description}
              onChange={onChange("description")}
            />
          </Field>

          {/* uploader */}
          <div className="mb-3">
            <label className="block text-xs font-medium text-gray-600 mb-2">
              Product Photo
            </label>

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              className={[
                "rounded-xl border-2 border-dashed transition-colors p-6 text-center select-none",
                isDragOver
                  ? "border-blue-400 bg-blue-50"
                  : "border-blue-300 bg-white",
              ].join(" ")}
            >
              <div className="mx-auto w-10 h-10 mb-2 rounded-full border border-blue-200 flex items-center justify-center">
                <UploadCloud className="w-5 h-5 text-blue-500" />
              </div>
              <p className="text-sm text-gray-800">
                Drag your photo <span className="text-gray-500">or</span>{" "}
                <label className="text-blue-600 underline cursor-pointer">
                  browse
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/svg+xml"
                    className="hidden"
                    onChange={onPickFiles}
                  />
                </label>
              </p>
              <p className="mt-2 text-xs text-gray-500 leading-relaxed">
                Max 10 MB files are allowed
                <br />
                Only support .jpg, .png and .svg
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((f, idx) => (
                <li
                  key={idx}
                  className="flex items-center gap-3 border border-gray-200 rounded-xl px-3 py-2"
                >
                  <img
                    src={f.url}
                    alt=""
                    className="w-8 h-8 rounded-md object-cover"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800 truncate">
                      {f.file.name}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {f.sizeLabel}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeFile(idx)}
                    className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
                    aria-label="Remove file"
                  >
                    <XIcon className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* footer */}
        <div className="px-6 py-4 border-t flex items-center gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full md:w-auto px-5 py-2.5 rounded-xl border border-gray-300 text-sm font-medium text-gray-700 hover:bg-gray-50"
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="w-full md:w-auto px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-60"
            disabled={submitting || meLoading || storeLocationId == null}
            title={
              storeLocationId == null ? "Store user tidak ditemukan" : undefined
            }
          >
            {submitting ? "Saving..." : "Save Product"}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------- Reusable inputs ------- */
function Field({ label, children }) {
  return (
    <div className="mb-4">
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function Input(props) {
  return (
    <input
      {...props}
      className={[
        "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Textarea(props) {
  return (
    <textarea
      rows={4}
      {...props}
      className={[
        "w-full rounded-xl border border-gray-300 px-4 py-3 text-sm",
        "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
        "resize-y",
        props.className || "",
      ].join(" ")}
    />
  );
}

function Select({ value, onChange, placeholder, options = [], disabled }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className={[
          "w-full appearance-none rounded-xl border bg-white px-4 py-3 text-sm",
          "border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500",
          disabled ? "bg-gray-50 text-gray-400 cursor-not-allowed" : "",
        ].join(" ")}
      >
        <option value="">{placeholder || "Select..."}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
    </div>
  );
}
