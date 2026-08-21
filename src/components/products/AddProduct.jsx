// src/components/products/AddProduct.jsx
import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, UploadCloud, X as XIcon } from "lucide-react";
import UnitDropdown from "./UnitDropdown";
import { getNextSku } from "../../api/products";
import { IDR } from "../../lib/fmt";

/**
 * Props:
 *  - open: boolean
 *  - onClose: () => void
 *  - onSubmit: (payload) => Promise<void> | void
 *  - storeLocationId: number | null (selected branch from catalog filter)
 *  - storeLabel: string
 *  - categories: [{id, name}]
 *  - subCategories: [{id, name, category_id}]
 */
export default function AddProduct({
  open,
  onClose,
  onSubmit,
  storeLocationId = null,
  storeLabel = "",
  categories = [],
  subCategories = [],
}) {
  const [form, setForm] = useState({
    name: "",
    price: "",
    cost_price: "",
    pack_size: "",
    pack_label: "",
    category_id: "",
    sub_category_id: "",
    stock: "",
    sku: "",
    description: "",
    unit_id: "",
    unit_name: "",
  });

  const [trackInventory, setTrackInventory] = useState(true); // ✅ stock / non-stock

  const packSize = Number(form.pack_size) > 1 ? Number(form.pack_size) : null;
  const packLabel = form.pack_label?.trim();

  // cost_price is per stock unit, which for a packed product IS the pack price.
  // Showing the derived per-piece cost lets the user sanity-check the split
  // without doing the division themselves.
  const packHint = useMemo(() => {
    const cost = Number(form.cost_price);
    if (!packSize || !(cost > 0)) return null;

    return `≈ ${IDR(cost / packSize)} per ${packLabel || "satuan kecil"} (isi ${packSize}).`;
  }, [packSize, packLabel, form.cost_price]);

  // Buying at or above the sell price is the fingerprint of a pack price entered
  // as a unit cost — exactly what zeroed margins across the catalogue.
  const costLooksLikePackPrice =
    Number(form.cost_price) > 0 &&
    Number(form.price) > 0 &&
    Number(form.cost_price) >= Number(form.price);

  /*
   | Deliberately NOT offering a "divide by pack size" fix any more.
   |
   | pack_size no longer rescales cost: stock is counted in packs, so the pack
   | price IS the per-stock-unit cost. Dividing it here would understate COGS by
   | pack_size× — the same 5000→50 corruption reported earlier, just relocated.
   | For a packed ingredient, cost >= sell price is also normal (it is bought by
   | the pack and rarely sold as one), so the warning is suppressed there.
   */
  const showCostWarning = costLooksLikePackPrice && !packSize;

  /*
   | Shown only when the stock unit is a container (Pack/Box/Dus), because
   | pack_size now means "how many small units are inside 1 stock unit".
   |
   | Stock and cost stay in the container unit: buy 1 Pack @5.000 → stock +1
   | Pack, cost 5.000/Pack. pack_size is NOT a cost divisor; it exists so a
   | recipe can consume fractions of a pack (1 Batang = 1/100 Pack).
   */
  const stockUnitIsPack = /^(pack|packs|pak|box|dus|karton|carton|lusin)$/i.test(
    (form.unit_name || "").trim()
  );

  const showPackFields = trackInventory && stockUnitIsPack;

  // Keep the payload in lockstep with visibility so hidden inputs can never
  // submit a stale divisor the user cannot see.
  const effectivePackSize = showPackFields ? packSize : null;

  const [files, setFiles] = useState([]);
  const [isDragOver, setIsDragOver] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [skuLoading, setSkuLoading] = useState(false);

  // Reset category picks when the selected branch changes
  useEffect(() => {
    if (!open) return;
    setForm((f) => ({ ...f, category_id: "", sub_category_id: "" }));
  }, [open, storeLocationId]);

  // Auto-generate SKU: SK-{storeCode}-001 when modal opens / branch changes
  useEffect(() => {
    if (!open || storeLocationId == null) {
      if (open) setForm((f) => ({ ...f, sku: "" }));
      return;
    }

    let cancelled = false;
    setSkuLoading(true);

    (async () => {
      try {
        const sku = await getNextSku(storeLocationId);
        if (!cancelled) {
          setForm((f) => ({ ...f, sku: sku || "" }));
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) {
          setForm((f) => ({ ...f, sku: "" }));
        }
      } finally {
        if (!cancelled) setSkuLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, storeLocationId]);

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
        cost_price: "",
        pack_size: "",
        pack_label: "",
        category_id: "",
        sub_category_id: "",
        stock: "",
        sku: "",
        description: "",
        unit_id: "",
        unit_name: "",
      });
      setTrackInventory(true);
      setSkuLoading(false);
      setFiles((prev) => {
        // revoke semua url preview
        prev.forEach((f) => f?.url && URL.revokeObjectURL(f.url));
        return [];
      });
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
      alert("Pilih cabang terlebih dahulu sebelum menambah produk.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        price: form.price ? Number(form.price) : 0,
        // Left blank → null, so inventory valuation reads "unknown" instead of
        // silently treating the sell price (or 0) as the cost.
        cost_price: form.cost_price === "" ? null : Number(form.cost_price),
        // Pack info. pack_size <= 1 is a no-op divisor, so send null and let the
        // product stay "unpacked" rather than storing a meaningless 1.
        pack_size: effectivePackSize,
        pack_label: effectivePackSize ? packLabel || null : null,
        stock: form.stock ? Number(form.stock) : 0,
        images: files.map((f) => f.file),
        store_location_id: storeLocationId,
        // ✅ flag untuk backend: 1 = produk stock, 0 = non-stock (jasa, photobooth, dll)
        is_stock_tracked: trackInventory ? 1 : 0,
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
          {storeLocationId != null && storeLabel ? (
            <p className="text-xs text-gray-500 mt-1">Cabang: {storeLabel}</p>
          ) : (
            <p className="text-xs text-red-600 mt-1">
              Pilih cabang di filter atas sebelum menambah produk.
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

          <Field label="Harga Beli (Cost)">
            <Input
              type="number"
              inputMode="numeric"
              placeholder="80000"
              value={form.cost_price}
              onChange={onChange("cost_price")}
              min="0"
            />
            <p className="mt-1 text-xs text-gray-500">
              Harga beli <strong>per 1 Unit</strong> yang dipilih di bawah. Kalau
              Unit = Pack, isi harga <strong>per pack</strong> (misal 5.000/pack)
              — sistem yang membagi per isinya. Kosongkan jika belum diketahui.
            </p>
            {packHint && <p className="mt-1 text-xs text-blue-700">{packHint}</p>}
            {showCostWarning && (
              <p className="mt-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Harga beli ({IDR(form.cost_price)}) lebih tinggi dari harga jual
                ({IDR(form.price)}), jadi margin akan minus. Kalau produk ini
                dibeli per pack, pilih <strong>Unit</strong> = Pack lalu isi
                jumlah isinya — harga beli tetap harga per pack.
              </p>
            )}
          </Field>

          {/* Jenis Produk: Stock / Non-Stock */}
          <Field label="Tipe Produk">
            <div className="flex flex-col gap-2 text-sm">
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="trackInventory"
                  className="accent-blue-600"
                  checked={trackInventory === true}
                  onChange={() => setTrackInventory(true)}
                />
                <span>
                  Produk stok{" "}
                  <span className="text-xs text-gray-500">
                    (misal: kaos, barang fisik, bisa habis stoknya)
                  </span>
                </span>
              </label>
              <label className="inline-flex items-center gap-2">
                <input
                  type="radio"
                  name="trackInventory"
                  className="accent-blue-600"
                  checked={trackInventory === false}
                  onChange={() => setTrackInventory(false)}
                />
                <span>
                  Non-stock / Jasa{" "}
                  <span className="text-xs text-gray-500">
                    (misal: Photobooth, sewa baju, make up, edit foto, cetak foto)
                  </span>
                </span>
              </label>
            </div>
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
                disabled={!trackInventory} // ✅ non-stock → stok opsional
              />
            </Field>

            <Field label="Unit">
              <UnitDropdown
                value={form.unit_id}
                onChange={(id, name) =>
                  setForm((f) => ({
                    ...f,
                    unit_id: id ?? "",
                    unit_name: name ?? "",
                  }))
                }
                placeholder="Pilih satuan"
              />
            </Field>
          </div>

          {/* Sits directly under Unit because it only becomes relevant once a
              unit is picked, and it describes that unit. */}
          {showPackFields && (
            <Field label={`Jumlah Isi per ${form.unit_name || "Pack"}`}>
              <div className="flex gap-2">
                <div className="flex-1">
                  <span className="block text-[11px] text-gray-500 mb-1">
                    Isi per {form.unit_name || "pack"} (angka)
                  </span>
                  <Input
                    type="number"
                    inputMode="decimal"
                    placeholder="100"
                    value={form.pack_size}
                    onChange={onChange("pack_size")}
                    min="0"
                    step="any"
                  />
                </div>
                <div className="flex-1">
                  <span className="block text-[11px] text-gray-500 mb-1">
                    Satuan isi (teks)
                  </span>
                  <Input
                    placeholder="Pcs / Batang / Lembar"
                    value={form.pack_label}
                    onChange={onChange("pack_label")}
                    maxLength={32}
                  />
                </div>
              </div>
              <p className="mt-1 text-xs text-gray-500">
                Stok dihitung per <strong>{form.unit_name}</strong>. Isi ini
                kalau 1 {form.unit_name} berisi beberapa satuan kecil — contoh:
                sedotan 1 Pack isi <strong>100</strong>{" "}
                <strong>Batang</strong>. Dipakai resep untuk memotong stok per
                batang.
              </p>
            </Field>
          )}

          <Field label="SKU">
            <Input
              placeholder={skuLoading ? "Generating..." : "SK-CODE-001"}
              value={form.sku}
              readOnly
              required
              className="bg-gray-50 text-gray-700 cursor-default"
            />
            <p className="mt-1 text-[11px] text-gray-500">
              Auto-generated, e.g. SK-F-CBR-001
            </p>
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
            disabled={
              submitting ||
              storeLocationId == null ||
              skuLoading ||
              !form.sku
            }
            title={
              storeLocationId == null ? "Pilih cabang terlebih dahulu" : undefined
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
