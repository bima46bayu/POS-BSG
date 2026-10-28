import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
  createHomePromo,
  deleteHomePromo,
  listHomePromos,
  updateHomePromo,
} from "../../api/homePromos";

const emptyForm = {
  title: "",
  badge: "Promo",
  description: "",
  image_url: "",
  starts_at: "",
  ends_at: "",
  is_active: true,
};

function toInput(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function payloadOf(form) {
  return {
    title: form.title.trim(),
    badge: form.badge.trim() || null,
    description: form.description.trim() || null,
    image_url: form.image_url.trim() || null,
    starts_at: form.starts_at || null,
    ends_at: form.ends_at || null,
    is_active: !!form.is_active,
  };
}

export default function MasterHomePromoPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const q = useQuery({
    queryKey: ["home-promos"],
    queryFn: ({ signal }) => listHomePromos(signal),
  });

  const save = useMutation({
    mutationFn: () =>
      form.id ? updateHomePromo(form.id, payloadOf(form)) : createHomePromo(payloadOf(form)),
    onSuccess: () => {
      toast.success("Promo disimpan. Muncul di Home aplikasi member.");
      setForm(null);
      qc.invalidateQueries({ queryKey: ["home-promos"] });
    },
    onError: (err) => {
      const errors = err?.response?.data?.errors;
      const first = errors ? Object.values(errors)[0]?.[0] : null;
      toast.error(first || "Gagal menyimpan promo");
    },
  });

  const remove = useMutation({
    mutationFn: () => deleteHomePromo(deleting.id),
    onSuccess: () => {
      toast.success("Promo dihapus");
      setDeleting(null);
      qc.invalidateQueries({ queryKey: ["home-promos"] });
    },
    onError: () => toast.error("Gagal menghapus promo"),
  });

  const items = q.data ?? [];

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-800">Promo Beranda</h1>
          <p className="text-sm text-gray-500">
            Iklan diskon dan promo di Home aplikasi member. Yang aktif dan masih dalam tanggalnya yang tampil.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setForm({ ...emptyForm })}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm text-white hover:bg-blue-700"
        >
          <Plus size={16} /> Tambah promo
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-gray-500">
            <tr>
              <th className="px-4 py-2">Promo</th>
              <th className="px-4 py-2">Label</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2 w-24" />
            </tr>
          </thead>
          <tbody>
            {items.map((promo) => (
              <tr key={promo.id} className="border-t">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 text-emerald-800">
                      <Megaphone size={16} />
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">{promo.title}</div>
                      <div className="text-xs text-gray-500">{promo.description || "Tanpa deskripsi"}</div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">{promo.badge || "—"}</td>
                <td className="px-4 py-3">
                  {promo.is_active ? (
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
                        id: promo.id,
                        title: promo.title || "",
                        badge: promo.badge || "",
                        description: promo.description || "",
                        image_url: promo.image_url || "",
                        starts_at: toInput(promo.starts_at),
                        ends_at: toInput(promo.ends_at),
                        is_active: !!promo.is_active,
                      })
                    }
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    type="button"
                    className="p-1.5 text-gray-500 hover:text-red-600"
                    onClick={() => setDeleting(promo)}
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Belum ada promo. Tambah diskon atau penawaran untuk Home aplikasi member.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {form && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setForm(null)} />
          <form
            className="relative z-[201] w-full max-w-md rounded-2xl bg-white p-5 shadow-xl space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <div className="font-semibold">{form.id ? "Edit promo" : "Promo baru"}</div>
            <label className="block text-sm">
              <span className="text-gray-600">Judul</span>
              <input
                required
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Es kopi 20% off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Label</span>
              <input
                value={form.badge}
                onChange={(e) => setForm({ ...form, badge: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="Diskon atau Promo"
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">Deskripsi</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                rows={3}
                placeholder="Syarat, cabang, atau masa berlaku."
              />
            </label>
            <label className="block text-sm">
              <span className="text-gray-600">URL gambar</span>
              <input
                value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })}
                className="mt-1 w-full rounded-lg border px-3 py-2"
                placeholder="https://"
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm">
                <span className="text-gray-600">Mulai</span>
                <input
                  type="datetime-local"
                  value={form.starts_at}
                  onChange={(e) => setForm({ ...form, starts_at: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
              <label className="block text-sm">
                <span className="text-gray-600">Berakhir</span>
                <input
                  type="datetime-local"
                  value={form.ends_at}
                  onChange={(e) => setForm({ ...form, ends_at: e.target.value })}
                  className="mt-1 w-full rounded-lg border px-3 py-2"
                />
              </label>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
              />
              Tampilkan di aplikasi
            </label>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="rounded-lg px-3 py-2 text-sm" onClick={() => setForm(null)}>
                Batal
              </button>
              <button
                type="submit"
                disabled={save.isPending}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm text-white disabled:opacity-50"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}

      <ConfirmDialog
        open={!!deleting}
        title="Hapus promo"
        message={deleting ? `Hapus "${deleting.title}" dari Home aplikasi member?` : ""}
        confirmText="Hapus"
        onClose={() => setDeleting(null)}
        onConfirm={() => remove.mutate()}
        loading={remove.isPending}
      />
    </div>
  );
}
