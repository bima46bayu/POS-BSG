// =============================
// src/components/purchase/AddPurchaseModal.jsx
// =============================
import React, { useEffect, useMemo, useRef, useState } from "react";
import { X, Plus, Trash2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createPortal } from "react-dom";
import toast from "react-hot-toast";

import { createPurchase } from "../../api/purchases";
import { listSuppliers } from "../../api/master";
import { getProducts } from "../../api/products";
import { getMyProfile } from "../../api/users";

const toNum = (v) => Number(v || 0);

export default function AddPurchaseModal({ open, onClose }) {
  const qc = useQueryClient();

  // --- header form state
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  // --- items
  const [items, setItems] = useState([
    { product_id: "", qty_order: "", unit_price: "", discount: "0", tax: "0" },
  ]);

  // --- dropdown state
  const [activeProductRow, setActiveProductRow] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [productMenuPos, setProductMenuPos] = useState(null);

  const [supplierOpen, setSupplierOpen] = useState(false);
  const [supplierSearch, setSupplierSearch] = useState("");

  // refs buat anchor tombol product
  const productBtnRefs = useRef([]);

  // reset saat open
  useEffect(() => {
    if (!open) return;
    setSupplierId("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDate("");
    setNotes("");
    setItems([
      { product_id: "", qty_order: "", unit_price: "", discount: "0", tax: "0" },
    ]);
    setActiveProductRow(null);
    setProductSearch("");
    setProductMenuPos(null);
    setSupplierOpen(false);
    setSupplierSearch("");
  }, [open]);

  // --- profile user (ambil store_location_id untuk filter produk)
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => getMyProfile(),
    staleTime: 5 * 60 * 1000,
  });

  const storeId =
    me?.store_location_id ??
    me?.storeLocation?.id ??
    me?.store_location?.id ??
    me?.store?.id ??
    null;

  // --- queries
  const { data: supResp, isLoading: supLoading } = useQuery({
    enabled: open,
    queryKey: ["suppliers"],
    queryFn: ({ signal }) =>
      listSuppliers({ page: 1, per_page: 200, search: "" }, signal),
    keepPreviousData: true,
  });

  const { data: prodResp, isLoading: prodLoading } = useQuery({
    enabled: open,
    queryKey: ["products", { storeId }],
    queryFn: ({ signal, queryKey }) => {
      const { storeId } = queryKey[1] || {};
      return getProducts(
        {
          page: 1,
          per_page: 2000,
          store_location_id: storeId || undefined, // ⬅️ filter berdasarkan store
        },
        signal
      );
    },
    keepPreviousData: true,
  });

  // unwrap
  const suppliers = supResp?.items || supResp?.data || supResp || [];
  const products = prodResp?.items || prodResp?.data || prodResp || [];

  // filter FE
  const filteredSuppliers = useMemo(() => {
    const k = supplierSearch.trim().toLowerCase();
    if (!k) return suppliers || [];
    return (suppliers || []).filter((s) => {
      const name = (s.name || "").toLowerCase();
      const code = (s.code || "").toLowerCase();
      return name.includes(k) || code.includes(k);
    });
  }, [suppliers, supplierSearch]);

  const filteredProducts = useMemo(() => {
    const k = productSearch.trim().toLowerCase();
    if (!k) return products || [];
    return (products || []).filter((p) => {
      const name = (p.name || "").toLowerCase();
      const sku = (p.sku || "").toLowerCase();
      return name.includes(k) || sku.includes(k);
    });
  }, [products, productSearch]);

  // --- items ops
  const addRow = () =>
    setItems((rows) => [
      ...rows,
      { product_id: "", qty_order: "", unit_price: "", discount: "0", tax: "0" },
    ]);

  const removeRow = (idx) =>
    setItems((rows) => rows.filter((_, i) => i !== idx));

  const changeRow = (idx, patch) =>
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const onSelectProduct = (idx, productId) => {
    const p = products.find((x) => String(x.id) === String(productId));
    setItems((rows) =>
      rows.map((r, i) =>
        i === idx
          ? {
              ...r,
              product_id: productId,
              unit_price: r.unit_price
                ? r.unit_price
                : toNum(p?.purchase_price ?? p?.price ?? 0),
            }
          : r
      )
    );
    setActiveProductRow(null);
    setProductMenuPos(null);
    setProductSearch("");
  };

  const onSelectSupplier = (s) => {
    setSupplierId(s?.id ?? "");
    setSupplierOpen(false);
    setSupplierSearch("");
  };

  // buka dropdown product → hitung posisi dari viewport
  const openProductMenu = (idx) => {
    const btn = productBtnRefs.current[idx];
    if (!btn) {
      setActiveProductRow(idx);
      return;
    }
    const rect = btn.getBoundingClientRect();
    setProductMenuPos({
      left: rect.left,
      top: rect.bottom + 4, // 4px di bawah tombol
      width: rect.width,
    });
    setActiveProductRow(idx);
    setProductSearch("");
  };

  // tutup dropdown product saat resize/scroll besar
  useEffect(() => {
    if (activeProductRow == null) return;
    const handler = () => {
      setActiveProductRow(null);
      setProductMenuPos(null);
      setProductSearch("");
    };
    window.addEventListener("resize", handler);
    window.addEventListener("scroll", handler);
    return () => {
      window.removeEventListener("resize", handler);
      window.removeEventListener("scroll", handler);
    };
  }, [activeProductRow]);

  // subtotal per item & grand total
  const subTotals = useMemo(
    () =>
      items.map((it) => {
        const base = toNum(it.qty_order) * toNum(it.unit_price);
        return base - toNum(it.discount) + toNum(it.tax);
      }),
    [items]
  );
  const grandTotal = subTotals.reduce(
    (a, b) => a + (Number.isFinite(b) ? b : 0),
    0
  );

  // --- submit
  const mutation = useMutation({
    mutationFn: (payload) => createPurchase(payload),
    onSuccess: () => {
      toast.success("Draft PO berhasil dibuat");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      onClose?.();
    },
    onError: (e) => {
      const msg =
        e?.response?.data?.message ||
        e?.response?.data?.error ||
        e?.message ||
        "Gagal membuat draft purchase";
      toast.error(msg);
    },
  });

  const validate = () => {
    if (!supplierId) return "Supplier wajib dipilih";
    if (!orderDate) return "Order date wajib diisi";
    if (!items.length) return "Tambahkan minimal 1 item";
    for (const [i, it] of items.entries()) {
      if (!it.product_id) return `Item #${i + 1}: product wajib dipilih`;
      if (!it.qty_order || Number(it.qty_order) <= 0)
        return `Item #${i + 1}: qty_order harus > 0`;
      if (!it.unit_price || Number(it.unit_price) <= 0)
        return `Item #${i + 1}: unit_price harus > 0`;
    }
    return null;
  };

  const submit = () => {
    const err = validate();
    if (err) return toast.error(err);

    const payload = {
      supplier_id: Number(supplierId),
      order_date: orderDate,
      expected_date: expectedDate || null,
      notes,
      items: items.map((it) => ({
        product_id: Number(it.product_id),
        qty_order: Number(it.qty_order),
        unit_price: Number(it.unit_price),
        discount: Number(it.discount || 0),
        tax: Number(it.tax || 0),
      })),
    };

    mutation.mutate(payload);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-2">
      <div className="bg-white rounded-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100">
          <div>
            <div className="text-lg font-semibold text-slate-900">
              Add Purchase (Draft)
            </div>
            <div className="text-xs text-slate-500">
              Buat PO draft, kemudian approve di tabel untuk membuka GR.
            </div>
            {/* {storeId && (
              <div className="mt-1 inline-flex items-center px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 text-[11px] font-medium">
                Product terfilter store: #{storeId}
              </div>
            )} */}
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-200 text-slate-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto">
          {/* Header form */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Supplier searchable dropdown */}
            <div className="flex flex-col md:col-span-2 relative">
              <label className="text-xs font-medium text-slate-600 mb-1">
                Supplier
              </label>
              <button
                type="button"
                onClick={() => {
                  setSupplierOpen((v) => !v);
                  setSupplierSearch("");
                }}
                className="w-full px-3 py-2 border rounded-lg text-sm bg-white flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              >
                <span
                  className={
                    supplierId ? "text-slate-900" : "text-slate-400"
                  }
                >
                  {supplierId
                    ? suppliers.find(
                        (s) => String(s.id) === String(supplierId)
                      )?.name || "Supplier tidak ditemukan"
                    : "-- Pilih Supplier --"}
                </span>
                <Search className="w-4 h-4 text-slate-400" />
              </button>

              {supplierOpen && (
                <div className="absolute z-40 mt-1 w-full max-h-72 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col">
                  <div className="p-2 border-b">
                    <div className="relative">
                      <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        autoFocus
                        value={supplierSearch}
                        onChange={(e) => setSupplierSearch(e.target.value)}
                        placeholder="Cari nama / kode supplier..."
                        className="w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/70"
                      />
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto text-sm">
                    {supLoading ? (
                      <div className="px-3 py-2 text-xs text-gray-500">
                        Memuat supplier...
                      </div>
                    ) : filteredSuppliers.length ? (
                      filteredSuppliers.map((s) => (
                        <button
                          key={s.id}
                          type="button"
                          onClick={() => onSelectSupplier(s)}
                          className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 ${
                            String(s.id) === String(supplierId)
                              ? "bg-blue-50"
                              : ""
                          }`}
                        >
                          <div className="text-[13px] font-medium text-slate-800">
                            {s.name}
                          </div>
                          {s.code && (
                            <div className="text-[11px] text-slate-500">
                              {s.code}
                            </div>
                          )}
                        </button>
                      ))
                    ) : (
                      <div className="px-3 py-2 text-xs text-gray-500">
                        Tidak ada supplier yang cocok.
                      </div>
                    )}
                  </div>
                  <div className="p-2 border-t flex justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        setSupplierOpen(false);
                        setSupplierSearch("");
                      }}
                      className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
                    >
                      Tutup
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600 mb-1">
                Order Date
              </label>
              <input
                type="date"
                value={orderDate}
                onChange={(e) => setOrderDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              />
            </div>

            <div className="flex flex-col">
              <label className="text-xs font-medium text-slate-600 mb-1">
                Expected Date
              </label>
              <input
                type="date"
                value={expectedDate}
                onChange={(e) => setExpectedDate(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              />
            </div>

            <div className="flex flex-col md:col-span-4">
              <label className="text-xs font-medium text-slate-600 mb-1">
                Notes
              </label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Catatan (opsional)"
                className="px-3 py-2 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/70"
              />
            </div>
          </div>

          {/* Items table */}
          <div className="border rounded-2xl overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-slate-50/80 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-800">
                Items
              </div>
              <div className="text-xs text-slate-500">
                Produk sudah difilter berdasarkan store user.
              </div>
            </div>

            {/* TIDAK pakai overflow-x-auto di sini supaya portaled dropdown tetap kelihatan */}
            <div className="w-full">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="p-2 text-left min-w-[260px]">Product</th>
                    <th className="p-2 text-right min-w-[100px]">Qty Order</th>
                    <th className="p-2 text-right min-w-[120px]">
                      Unit Price
                    </th>
                    <th className="p-2 text-right min-w-[100px]">Discount</th>
                    <th className="p-2 text-right min-w-[100px]">Tax</th>
                    <th className="p-2 text-right min-w-[140px]">
                      Line Total
                    </th>
                    <th className="p-2 text-center w-[60px]">#</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, idx) => {
                    const lt = subTotals[idx] || 0;
                    const selectedProduct =
                      products.find(
                        (p) => String(p.id) === String(it.product_id)
                      ) || null;

                    return (
                      <tr key={idx} className="hover:bg-slate-50/60">
                        {/* Product cell with searchable dropdown (portal) */}
                        <td className="p-2 align-top">
                          <button
                            type="button"
                            ref={(el) => (productBtnRefs.current[idx] = el)}
                            onClick={() =>
                              activeProductRow === idx
                                ? (setActiveProductRow(null),
                                  setProductMenuPos(null),
                                  setProductSearch(""))
                                : openProductMenu(idx)
                            }
                            className="w-full px-3 py-1.5 border rounded-lg bg-white text-left text-sm flex items-center justify-between gap-2 focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                          >
                            <span
                              className={
                                it.product_id
                                  ? "text-slate-900"
                                  : "text-slate-400"
                              }
                            >
                              {selectedProduct
                                ? `${selectedProduct.name}${
                                    selectedProduct.sku
                                      ? ` (${selectedProduct.sku})`
                                      : ""
                                  }`
                                : "-- Pilih Produk --"}
                            </span>
                            <Search className="w-4 h-4 text-slate-400" />
                          </button>
                        </td>

                        {/* Qty */}
                        <td className="p-2 text-right align-top">
                          <input
                            type="number"
                            min={1}
                            value={it.qty_order}
                            onChange={(e) =>
                              changeRow(idx, { qty_order: e.target.value })
                            }
                            className="w-24 px-2 py-1.5 border rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                          />
                        </td>

                        {/* Unit Price */}
                        <td className="p-2 text-right align-top">
                          <input
                            type="number"
                            min={0}
                            value={it.unit_price}
                            onChange={(e) =>
                              changeRow(idx, { unit_price: e.target.value })
                            }
                            className="w-28 px-2 py-1.5 border rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                          />
                        </td>

                        {/* Discount */}
                        <td className="p-2 text-right align-top">
                          <input
                            type="number"
                            min={0}
                            value={it.discount}
                            onChange={(e) =>
                              changeRow(idx, { discount: e.target.value })
                            }
                            className="w-24 px-2 py-1.5 border rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                          />
                        </td>

                        {/* Tax */}
                        <td className="p-2 text-right align-top">
                          <input
                            type="number"
                            min={0}
                            value={it.tax}
                            onChange={(e) =>
                              changeRow(idx, { tax: e.target.value })
                            }
                            className="w-24 px-2 py-1.5 border rounded-lg text-right text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/70"
                          />
                        </td>

                        {/* Line total */}
                        <td className="p-2 text-right align-top font-semibold text-slate-800">
                          {Number(lt).toLocaleString("id-ID", {
                            style: "currency",
                            currency: "IDR",
                            maximumFractionDigits: 0,
                          })}
                        </td>

                        {/* Remove row */}
                        <td className="p-2 text-center align-top">
                          <button
                            onClick={() => removeRow(idx)}
                            disabled={items.length === 1}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded-full border text-xs ${
                              items.length === 1
                                ? "border-slate-200 text-slate-300 cursor-not-allowed"
                                : "border-red-200 text-red-600 hover:bg-red-50"
                            }`}
                            title="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/80">
              <button
                onClick={addRow}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-full bg-white border border-slate-300 text-sm hover:bg-slate-100"
              >
                <Plus className="w-4 h-4" /> Tambah Item
              </button>

              <div className="text-sm md:text-base">
                <span className="text-slate-500 mr-2">Grand Total:</span>
                <span className="font-semibold text-slate-900">
                  {grandTotal.toLocaleString("id-ID", {
                    style: "currency",
                    currency: "IDR",
                    maximumFractionDigits: 0,
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t bg-slate-50 flex items-center justify-end gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border rounded-full text-sm text-slate-700 bg-white hover:bg-slate-100"
          >
            Batal
          </button>
          <button
            onClick={submit}
            disabled={mutation.isLoading}
            className="px-4 py-2 rounded-full text-sm font-semibold bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {mutation.isLoading ? "Menyimpan..." : "Simpan Draft"}
          </button>
        </div>
      </div>

      {/* === PORTAL DROPDOWN PRODUCT (di luar modal, jadi nggak pernah ke-clip) === */}
      {activeProductRow != null && productMenuPos &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: productMenuPos.left,
              top: productMenuPos.top,
              width: productMenuPos.width,
              zIndex: 99999,
            }}
            className="max-h-72 bg-white border border-slate-200 rounded-xl shadow-lg flex flex-col"
          >
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder="Cari nama / SKU..."
                  className="w-full pl-7 pr-2 py-1.5 rounded-lg border text-xs focus:outline-none focus:ring-1 focus:ring-blue-500/70"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto text-sm">
              {prodLoading ? (
                <div className="px-3 py-2 text-xs text-gray-500">
                  Memuat produk...
                </div>
              ) : filteredProducts.length ? (
                filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onSelectProduct(activeProductRow, p.id)}
                    className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 flex flex-col ${
                      String(p.id) ===
                      String(items[activeProductRow]?.product_id)
                        ? "bg-blue-50"
                        : ""
                    }`}
                  >
                    <span className="text-[13px] font-medium text-slate-800">
                      {p.name}
                    </span>
                    <span className="text-[11px] text-slate-500 flex justify-between gap-2">
                      <span>{p.sku ? `SKU: ${p.sku}` : "Tanpa SKU"}</span>
                      <span>
                        {Number(
                          p.purchase_price ?? p.price ?? 0
                        ).toLocaleString("id-ID", {
                          style: "currency",
                          currency: "IDR",
                          maximumFractionDigits: 0,
                        })}
                      </span>
                    </span>
                  </button>
                ))
              ) : (
                <div className="px-3 py-2 text-xs text-gray-500">
                  Tidak ada produk yang cocok.
                </div>
              )}
            </div>
            <div className="p-2 border-t flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setActiveProductRow(null);
                  setProductMenuPos(null);
                  setProductSearch("");
                }}
                className="text-[11px] px-2 py-1 rounded border border-slate-200 text-slate-600 hover:bg-slate-50"
              >
                Tutup
              </button>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
