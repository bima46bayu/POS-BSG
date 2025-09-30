// =============================
// src/components/purchase/AddPurchaseModal.jsx
// =============================
import React, { useEffect, useMemo, useState } from "react";
import { X, Plus, Trash2, Search } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import { createPurchase } from "../../api/purchases";
import { listSuppliers } from "../../api/master";
import { getProducts } from "../../api/products"; // <= pakai file kamu

// util kecil
const toNum = (v) => Number(v || 0);
const debounce = (fn, ms) => {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
};

export default function AddPurchaseModal({ open, onClose }) {
  const qc = useQueryClient();

  // --- header form state
  const [supplierId, setSupplierId] = useState("");
  const [orderDate, setOrderDate] = useState(new Date().toISOString().slice(0, 10));
  const [expectedDate, setExpectedDate] = useState("");
  const [notes, setNotes] = useState("");

  // --- items
  const [items, setItems] = useState([
    { product_id: "", qty_order: "", unit_price: "", discount: "0", tax: "0" },
  ]);

  // --- product search (debounced) untuk dropdown
  const [prodQuery, setProdQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");

  useEffect(() => {
    const run = debounce((v) => setDebouncedQuery(v), 300);
    run(prodQuery);
  }, [prodQuery]);

  // reset saat open
  useEffect(() => {
    if (!open) return;
    setSupplierId("");
    setOrderDate(new Date().toISOString().slice(0, 10));
    setExpectedDate("");
    setNotes("");
    setItems([{ product_id: "", qty_order: "", unit_price: "", discount: "0", tax: "0" }]);
    setProdQuery("");
    setDebouncedQuery("");
  }, [open]);

  // --- queries
  const { data: supResp } = useQuery({
    enabled: open,
    queryKey: ["suppliers", { page: 1 }],
    queryFn: ({ signal }) => listSuppliers({ page: 1, per_page: 100 }, signal),
  });

  const { data: prodResp } = useQuery({
    enabled: open,
    queryKey: ["products", { q: debouncedQuery }],
    queryFn: ({ signal }) => getProducts({ search: debouncedQuery, page: 1, per_page: 100 }, signal),
    keepPreviousData: true,
  });

  // unwrapping sesuai helper kamu (getProducts sudah kembalikan { items, meta })
  const products = prodResp?.items || [];
  const suppliers = Array.isArray(supResp) ? supResp : supResp?.data || [];

  // --- items ops
  const addRow = () =>
    setItems((rows) => [...rows, { product_id: "", qty_order: "", unit_price: "", discount: "0", tax: "0" }]);

  const removeRow = (idx) => setItems((rows) => rows.filter((_, i) => i !== idx));

  const changeRow = (idx, patch) =>
    setItems((rows) => rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  // auto-set unit_price dari product terpilih jika kosong
  const onSelectProduct = (idx, productId) => {
    const p = products.find((x) => String(x.id) === String(productId));
    setItems((rows) =>
      rows.map((r, i) =>
        i === idx
          ? {
              ...r,
              product_id: productId,
              unit_price: r.unit_price ? r.unit_price : toNum(p?.price || 0),
            }
          : r
      )
    );
  };

  // subtotal per item & grand total
  const subTotals = useMemo(
    () =>
      items.map((it) => {
        const base = toNum(it.qty_order) * toNum(it.unit_price);
        return base - toNum(it.discount) + toNum(it.tax);
      }),
    [items]
  );
  const grandTotal = subTotals.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

  // --- submit
  const mutation = useMutation({
    mutationFn: (payload) => createPurchase(payload), // POST /api/purchases (draft multi-item)
    onSuccess: () => {
      toast.success("Draft PO berhasil dibuat");
      qc.invalidateQueries({ queryKey: ["purchases"] });
      onClose?.();
    },
    onError: (e) => {
      const msg = e?.response?.data?.message || e?.message || "Gagal membuat draft purchase";
      toast.error(msg);
    },
  });

  const validate = () => {
    if (!supplierId) return "Supplier wajib dipilih";
    if (!orderDate) return "Order date wajib diisi";
    if (!items.length) return "Tambahkan minimal 1 item";
    for (const [i, it] of items.entries()) {
      if (!it.product_id) return `Item #${i + 1}: product wajib dipilih`;
      if (!it.qty_order || Number(it.qty_order) <= 0) return `Item #${i + 1}: qty_order harus > 0`;
      if (!it.unit_price || Number(it.unit_price) <= 0) return `Item #${i + 1}: unit_price harus > 0`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl w-full max-w-5xl overflow-hidden">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold">Add Purchase (Draft)</div>
            <div className="text-xs text-gray-500">Buat PO draft, kemudian approve di tabel untuk membuka GR.</div>
          </div>
          <button onClick={onClose} className="p-2 rounded hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5">
          {/* Header form */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Supplier</label>
              <select value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className="px-3 py-2 border rounded-lg">
                <option value="">-- Pilih Supplier --</option>
                {(suppliers || []).map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Order Date</label>
              <input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
            </div>

            <div className="flex flex-col">
              <label className="text-xs text-gray-600 mb-1">Expected Date</label>
              <input type="date" value={expectedDate} onChange={(e) => setExpectedDate(e.target.value)} className="px-3 py-2 border rounded-lg" />
            </div>

            <div className="flex flex-col md:col-span-1">
              <label className="text-xs text-gray-600 mb-1">Notes</label>
              <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan (opsional)" className="px-3 py-2 border rounded-lg" />
            </div>
          </div>

          {/* Product search (opsional) */}
          <div className="flex items-center gap-2">
            <div className="relative w-80">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                value={prodQuery}
                onChange={(e) => setProdQuery(e.target.value)}
                placeholder="Cari produk (nama/SKU)..."
                className="w-full pl-9 pr-3 py-2 border rounded-lg"
              />
            </div>
          </div>

          {/* Items table */}
          <div className="border rounded-xl overflow-hidden">
            <div className="p-3 bg-gray-50 text-sm font-medium">Items</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600">
                  <tr>
                    <th className="p-2 text-left min-w-[220px]">Product</th>
                    <th className="p-2 text-right min-w-[100px]">Qty Order</th>
                    <th className="p-2 text-right min-w-[120px]">Unit Price</th>
                    <th className="p-2 text-right min-w-[100px]">Discount</th>
                    <th className="p-2 text-right min-w-[100px]">Tax</th>
                    <th className="p-2 text-right min-w-[140px]">Line Total</th>
                    <th className="p-2 text-center w-[60px]">#</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((it, idx) => {
                    const lt = subTotals[idx] || 0;
                    return (
                      <tr key={idx} className="border-t">
                        <td className="p-2">
                          <select
                            value={it.product_id}
                            onChange={(e) => onSelectProduct(idx, e.target.value)}
                            className="w-full px-2 py-1 border rounded"
                          >
                            <option value="">-- Pilih Produk --</option>
                            {(products || []).map((p) => (
                              <option key={p.id} value={p.id}>
                                {p.name} {p.sku ? `(${p.sku})` : ""}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={1}
                            value={it.qty_order}
                            onChange={(e) => changeRow(idx, { qty_order: e.target.value })}
                            className="w-24 px-2 py-1 border rounded text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={it.unit_price}
                            onChange={(e) => changeRow(idx, { unit_price: e.target.value })}
                            className="w-28 px-2 py-1 border rounded text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={it.discount}
                            onChange={(e) => changeRow(idx, { discount: e.target.value })}
                            className="w-24 px-2 py-1 border rounded text-right"
                          />
                        </td>
                        <td className="p-2 text-right">
                          <input
                            type="number"
                            min={0}
                            value={it.tax}
                            onChange={(e) => changeRow(idx, { tax: e.target.value })}
                            className="w-24 px-2 py-1 border rounded text-right"
                          />
                        </td>
                        <td className="p-2 text-right font-medium">{Number(lt).toLocaleString("id-ID")}</td>
                        <td className="p-2 text-center">
                          <button
                            onClick={() => removeRow(idx)}
                            disabled={items.length === 1}
                            className={`inline-flex items-center justify-center w-8 h-8 rounded ${
                              items.length === 1 ? "bg-gray-200 text-gray-400 cursor-not-allowed" : "bg-red-50 text-red-600 hover:bg-red-100"
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

            <div className="p-3 flex items-center justify-between">
              <button onClick={addRow} className="inline-flex items-center gap-2 px-3 py-2 rounded bg-white border hover:bg-gray-50">
                <Plus className="w-4 h-4" /> Tambah Item
              </button>

              <div className="text-sm">
                <span className="text-gray-500 mr-2">Grand Total:</span>
                <span className="font-semibold">
                  {grandTotal.toLocaleString("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-5 border-t flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 border rounded">Batal</button>
          <button onClick={submit} disabled={mutation.isLoading} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60">
            {mutation.isLoading ? "Menyimpan..." : "Simpan Draft"}
          </button>
        </div>
      </div>
    </div>
  );
}
