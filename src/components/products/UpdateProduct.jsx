// src/components/products/UpdateProduct.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, UploadCloud, X as XIcon } from "lucide-react";
import { toAbsoluteUrl } from "../../api/client";
import UnitDropdown from "./UnitDropdown";

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSubmit: (payload) => Promise<void> | void
 *  - categories: [{id, name}]
 *  - subCategories: [{id, name, category_id}]
 *  - product: {id, name, price, category_id, sub_category_id, stock, sku, description, image_url?, unit_id?, inventory_type?, is_stock_tracked?}
 */
export default function UpdateProduct({
  open,
  onClose,
  onSubmit,
  categories = [],
  subCategories = [],
  product = null,
}) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    category_id: "",
    sub_category_id: "",
    stock: "",
    sku: "",
    description: "",
    unit_id: "",
  });

  // ✅ sama seperti AddProduct: stock / non-stock
  const [trackInventory, setTrackInventory] = useState(true);

  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // ===== Prefill dari product saat modal dibuka / reset saat tutup =====
  useEffect(() => {
    if (open && product) {
      // tentukan default trackInventory dari inventory_type / is_stock_tracked
      let tracked = true;
      if (product.inventory_type) {
        // misal 'stock' / 'non_stock'
        tracked = String(product.inventory_type).toLowerCase() !== "non_stock";
      } else if (product.is_stock_tracked !== undefined && product.is_stock_tracked !== null) {
        tracked = !!Number(product.is_stock_tracked);
      }

      setForm({
        name: product.name ?? "",
        price: product.price ?? "",
        category_id: product.category_id ?? "",
        sub_category_id: product.sub_category_id ?? "",
        stock: product.stock ?? "",
        sku: product.sku ?? "",
        description: product.description ?? "",
        unit_id:
          product.unit_id === null || product.unit_id === undefined
            ? ""
            : String(product.unit_id),
      });
      setTrackInventory(tracked);
      setFiles([]);
      setSubmitting(false);
      return;
    }

    if (!open) {
      // reset saat modal ditutup
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
      setTrackInventory(true);
      setFiles((prev) => {
        prev.forEach((f) => f?.url && URL.revokeObjectURL(f.url));
        return [];
      });
      setSubmitting(false);
    }
  }, [open, product]);

  // ===== Filter subcategory berdasarkan category =====
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

  const onChange = (key) => (e) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const onChangeCategory = (e) => {
    const value = e.target.value;
    setForm((f) => ({
      ...f,
      category_id: value,
      sub_category_id: "",
    }));
  };

  // 🔑 UnitDropdown: sama seperti AddProduct → simpan string / ""
  const onChangeUnit = (unitId) => {
    setForm((f) => ({
      ...f,
      unit_id: unitId ?? "",
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
    return () => {
      // cleanup global kalau komponen unmount
      setFiles((prev) => {
        prev.forEach((f) => f?.url && URL.revokeObjectURL(f.url));
        return [];
      });
    };
  }, []);

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

  // ========= Submit =========
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting || !product?.id) return;

    setSubmitting(true);
    try {
      const payload = {
        id: product.id,
        name: form.name,
        price: form.price ? Number(form.price) : 0,
        stock: form.stock ? Number(form.stock) : 0,
        sku: form.sku,
        description: form.description || null,
        category_id: form.category_id || null,
        sub_category_id: form.sub_category_id || null,
        unit_id: form.unit_id || null,
        images: files.map((f) => f.file),
        // ✅ sama persis dengan AddProduct
        is_stock_tracked: trackInventory ? 1 : 0,
      };

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
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-xl leading-6 font-semibold text-gray-900">
            Ubah Produk
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-500"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-3">
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

          {/* Jenis Produk: Stock / Non-Stock */}
          <Field label="Tipe Produk">
            <div className="flex flex-col gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="trackInventoryUpdate"
                  className="accent-blue-600"
                  checked={trackInventory === true}
                  onChange={() => setTrackInventory(true)}
                />
                <span>
                  Produk stok{" "}
                  <span className="text-xs text-gray-500">
                    (barang fisik, stok bisa habis)
                  </span>
                </span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="trackInventoryUpdate"
                  className="accent-blue-600"
                  checked={trackInventory === false}
                  onChange={() => setTrackInventory(false)}
                />
                <span>
                  Non-stock / Jasa{" "}
                  <span className="text-xs text-gray-500">
                    (photobooth, jasa editing, dll)
                  </span>
                </span>
              </label>
            </div>
          </Field>

          {/* Category & Subcategory */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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

          {/* Stock & Unit */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Stock">
              <Input
                type="number"
                inputMode="numeric"
                placeholder="10"
                value={form.stock}
                onChange={onChange("stock")}
                min="0"
                disabled={!trackInventory} // ✅ non-stock → stok opsional
              />
            </Field>
            <Field label="Unit">
              <UnitDropdown
                value={form.unit_id}
                onChange={onChangeUnit}
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
              rows={3}
              placeholder="Kaos logo NU"
              value={form.description}
              onChange={onChange("description")}
            />
          </Field>

          {/* uploader */}
          <div className="space-y-2">
            <label className="block text-xs font-medium text-gray-600">
              Product Photo
            </label>

            {product?.image_url && files.length === 0 && (
              <div>
                <img
                  src={toAbsoluteUrl(product.image_url)}
                  alt="current"
                  className="w-20 h-20 rounded-lg object-cover border"
                />
                <p className="text-[11px] text-gray-500 mt-1">
                  Biarkan kosong jika tidak mengganti foto.
                </p>
              </div>
            )}

            <div
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragOver(true);
              }}
              onDragLeave={() => setIsDragOver(false)}
              onDrop={onDrop}
              className={[
                "rounded-xl border-2 border-dashed transition-colors p-5 text-center select-none",
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
              <p className="mt-1 text-xs text-gray-500 leading-relaxed">
                Max 10 MB files are allowed
                <br />
                Only support .jpg, .png and .svg
              </p>
            </div>
          </div>

          {files.length > 0 && (
            <ul className="space-y-2 pt-1">
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
            disabled={submitting}
          >
            {submitting ? "Updating..." : "Update Product"}
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
