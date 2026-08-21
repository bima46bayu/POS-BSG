import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Plus, Pencil, Trash2, X, Search } from "lucide-react";
import toast from "react-hot-toast";

import {
  listLoyaltyRewards,
  createLoyaltyReward,
  updateLoyaltyReward,
  deleteLoyaltyReward,
} from "../../api/loyaltyRewards";
import { getProducts } from "../../api/products";
import { getMe } from "../../api/users";
import { toAbsoluteUrl } from "../../api/client";
import ConfirmDialog from "../../components/common/ConfirmDialog";

function homeStoreId(me) {
  return me?.store_location_id ?? me?.store_location?.id ?? null;
}

function productLabel(p) {
  if (!p) return "";
  return p.sku ? `${p.name} (${p.sku})` : p.name;
}

export default function MasterLoyaltyRewardPage() {
  const qc = useQueryClient();
  const [me, setMe] = useState(null);
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [productSearch, setProductSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  const storeId = homeStoreId(me);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(productSearch.trim()), 250);
    return () => clearTimeout(t);
  }, [productSearch]);

  const q = useQuery({
    queryKey: ["loyalty-rewards-master"],
    queryFn: ({ signal }) =>
      listLoyaltyRewards({ per_page: 100 }, signal),
  });

  const productsQ = useQuery({
    queryKey: ["loyalty-reward-products", storeId, debouncedSearch],
    enabled: !!form && !form.id,
    queryFn: ({ signal }) =>
      getProducts(
        {
          ...(storeId ? { store_location_id: storeId } : {}),
          search: debouncedSearch || undefined,
          per_page: 20,
        },
        signal
      ),
  });

  const save = useMutation({
    mutationFn: () => {
      const payload = {
        product_id: Number(form.product_id),
        description: form.description?.trim() || null,
        points_cost: Number(form.points_cost),
        is_active: !!form.is_active,
        ...(storeId ? { store_location_id: storeId } : {}),
      };
      return form.id
        ? updateLoyaltyReward(form.id, payload)
        : createLoyaltyReward(payload);
    },
    onSuccess: () => {
      toast.success("Produk redeem disimpan");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["loyalty-rewards-master"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gagal menyimpan"),
  });

  const remove = useMutation({
    mutationFn: (id) => deleteLoyaltyReward(id),
    onSuccess: () => {
      toast.success("Produk redeem dihapus");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["loyalty-rewards-master"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Gagal menghapus"),
  });

  const items = q.data?.items || [];
  const productHits = productsQ.data?.items || [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Point Rewards</h1>
          <p className="text-sm text-gray-500">
            Produk redeem sama di semua cabang.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setProductSearch("");
            setForm({
              product_id: "",
              product: null,
              description: "",
              points_cost: 10,
              is_active: true,
            });
          }}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} /> Tambah produk
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-4 py-2">Produk</th>
                <th className="px-4 py-2">Poin</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2 w-24" />
              </tr>
            </thead>
            <tbody>
              {items.map((r) => {
                const p = r.product;
                const img = p?.image_url ? toAbsoluteUrl(p.image_url) : null;
                return (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {img ? (
                          <img
                            src={img}
                            alt=""
                            className="h-10 w-10 rounded-lg object-cover bg-gray-100"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
                            <Gift size={16} />
                          </div>
                        )}
                        <div>
                          <div className="font-medium text-gray-800">
                            {p?.name || r.name}
                          </div>
                          <div className="text-xs text-gray-500">
                            {p?.sku ? `SKU ${p.sku}` : r.description || ""}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-700">
                      {Number(r.points_cost).toLocaleString("id-ID")}
                    </td>
                    <td className="px-4 py-3">
                      {r.is_active ? (
                        <span className="text-emerald-700">Aktif</span>
                      ) : (
                        <span className="text-gray-400">Nonaktif</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        className="p-1.5 text-gray-500 hover:text-blue-700"
                        onClick={() =>
                          setForm({
                            id: r.id,
                            product_id: r.product_id || p?.id,
                            product: p,
                            description: r.description || "",
                            points_cost: r.points_cost,
                            is_active: !!r.is_active,
                          })
                        }
                      >
                        <Pencil size={16} />
                      </button>
                      <button
                        type="button"
                        className="p-1.5 text-gray-500 hover:text-red-600"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {items.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Belum ada produk redeem. Buat produk di Catalog, lalu pilih di sini.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      {form && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setForm(null)} />
          <div className="relative z-[201] w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div className="flex items-center gap-2 font-semibold">
                <Gift size={18} /> {form.id ? "Edit produk redeem" : "Produk redeem baru"}
              </div>
              <button type="button" onClick={() => setForm(null)}>
                <X size={18} className="text-gray-400" />
              </button>
            </div>

            <label className="block text-sm font-medium">Produk</label>
            {form.id ? (
              <div className="mt-1 mb-3 rounded-lg border bg-gray-50 px-3 py-2 text-sm">
                {productLabel(form.product) || form.product_id}
              </div>
            ) : (
              <div className="relative mt-1 mb-3">
                <div className="flex items-center gap-2 rounded-lg border px-3 py-2">
                  <Search size={14} className="text-gray-400" />
                  <input
                    className="w-full text-sm outline-none"
                    placeholder="Cari nama atau SKU…"
                    value={form.product ? productLabel(form.product) : productSearch}
                    onChange={(e) => {
                      setProductSearch(e.target.value);
                      setForm({ ...form, product: null, product_id: "" });
                    }}
                  />
                </div>
                {!form.product && (
                  <div className="absolute z-10 mt-1 max-h-48 w-full overflow-auto rounded-lg border bg-white shadow">
                    {productsQ.isLoading ? (
                      <div className="px-3 py-2 text-sm text-gray-400">Memuat…</div>
                    ) : productHits.length === 0 ? (
                      <div className="px-3 py-2 text-sm text-gray-400">
                        Produk tidak ditemukan. Buat dulu di Catalog.
                      </div>
                    ) : (
                      productHits.map((p) => (
                        <button
                          type="button"
                          key={p.id}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                          onClick={() => {
                            setForm({
                              ...form,
                              product_id: p.id,
                              product: p,
                              description: form.description || p.description || "",
                            });
                            setProductSearch("");
                          }}
                        >
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs text-gray-500">
                            {p.sku ? `SKU ${p.sku}` : ""}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}

            <label className="block text-sm font-medium">Catatan (opsional)</label>
            <textarea
              className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              rows={2}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <label className="block text-sm font-medium">Poin</label>
            <input
              type="number"
              min={1}
              className="mt-1 mb-3 w-full rounded-lg border px-3 py-2 text-sm"
              value={form.points_cost}
              onChange={(e) => setForm({ ...form, points_cost: e.target.value })}
            />
            <label className="mb-4 flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Aktif di Member Store
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-2 text-sm"
                onClick={() => setForm(null)}
              >
                Batal
              </button>
              <button
                type="button"
                disabled={save.isPending || !form.product_id}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
                onClick={() => save.mutate()}
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Hapus produk redeem?"
        message={
          deleting
            ? `Hapus “${deleting.product?.name || deleting.name}” dari Member Store?`
            : ""
        }
        confirmText="Hapus"
        loading={remove.isPending}
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate(deleting.id)}
      />
    </div>
  );
}
