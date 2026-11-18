import React, { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Edit, Plus, Server, Trash2, X } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
  createAppServer,
  deleteAppServer,
  listAppServers,
  updateAppServer,
} from "../../api/appServers";

function errorMessage(error, fallback) {
  return error?.response?.data?.message || fallback;
}

function ServerModal({ open, onClose, onSubmit, loading, initial }) {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: "",
    base_url: "",
    is_active: true,
  });

  useEffect(() => {
    if (!open) return;
    setForm(
      initial
        ? {
            name: initial.name || "",
            base_url: initial.base_url || "",
            is_active: !!initial.is_active,
          }
        : { name: "", base_url: "", is_active: true }
    );
  }, [open, initial]);

  if (!open) return null;

  const set = (key) => (event) =>
    setForm((prev) => ({
      ...prev,
      [key]:
        event.target.type === "checkbox"
          ? event.target.checked
          : event.target.value,
    }));

  const submit = () => {
    const name = form.name.trim();
    const baseUrl = form.base_url.trim();
    if (!name || !baseUrl) {
      toast.error("Nama dan alamat server wajib diisi.");
      return;
    }
    onSubmit({
      name,
      base_url: baseUrl,
      is_active: form.is_active,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-lg mx-4 shadow-xl border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">
            {isEdit ? "Ubah Alamat Server" : "Tambah Alamat Server"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">Nama</label>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="Kasir Toko"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Base URL</label>
            <input
              value={form.base_url}
              onChange={set("base_url")}
              placeholder="192.168.1.10:8000"
              className="w-full px-3 py-2 border rounded-lg text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Boleh tanpa http://. Contoh: 10.0.2.2:8000 untuk emulator,
              atau IP komputer server untuk HP.
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.is_active}
              onChange={set("is_active")}
            />
            Tampil di aplikasi
          </label>
        </div>
        <div className="px-5 py-3 border-t flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-3 py-2 border rounded-lg text-sm"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-60"
          >
            {loading ? "Menyimpan..." : "Simpan"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AppServerPage() {
  const qc = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const { data = [], isLoading } = useQuery({
    queryKey: ["app-servers"],
    queryFn: ({ signal }) =>
      listAppServers(signal).then((response) => response.data?.data || []),
  });

  const refresh = () => qc.invalidateQueries({ queryKey: ["app-servers"] });

  const mCreate = useMutation({
    mutationFn: createAppServer,
    onSuccess: () => {
      toast.success("Alamat server ditambahkan");
      setShowAdd(false);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menambah alamat")),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }) => updateAppServer(id, payload),
    onSuccess: () => {
      toast.success("Alamat server diperbarui");
      setEditTarget(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menyimpan alamat")),
  });

  const mDelete = useMutation({
    mutationFn: (id) => deleteAppServer(id),
    onSuccess: () => {
      toast.success("Alamat server dihapus");
      setConfirmDel(null);
      refresh();
    },
    onError: (error) => toast.error(errorMessage(error, "Gagal menghapus alamat")),
  });

  const columns = [
    {
      key: "name",
      header: "Nama",
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Server className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{row.name}</span>
        </div>
      ),
    },
    {
      key: "base_url",
      header: "Base URL",
      cell: (row) => <span className="font-mono text-xs">{row.base_url}</span>,
    },
    {
      key: "is_active",
      header: "Status",
      cell: (row) => (
        <span
          className={`text-xs font-medium ${
            row.is_active ? "text-emerald-700" : "text-gray-400"
          }`}
        >
          {row.is_active ? "Tampil di aplikasi" : "Disembunyikan"}
        </span>
      ),
    },
    {
      key: "__actions",
      header: "Aksi",
      align: "center",
      cell: (row) => (
        <div className="flex justify-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditTarget(row)}
            className="inline-flex items-center justify-center h-8 px-2 bg-blue-600 text-white rounded-lg text-xs"
          >
            <Edit className="w-4 h-4 mr-1" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setConfirmDel(row)}
            className="inline-flex items-center justify-center h-8 w-8 bg-red-500 text-white rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Alamat Server</h2>
          <p className="text-sm text-gray-500">
            Daftar Server.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowAdd(true)}
          className="inline-flex items-center gap-1.5 px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
        >
          <Plus className="w-4 h-4" />
          Tambah
        </button>
      </div>

      <DataTable
        columns={columns}
        data={data}
        loading={isLoading}
        emptyText="Belum ada alamat server."
        meta={{
          current_page: 1,
          last_page: 1,
          per_page: Math.max(data.length, 1),
          total: data.length,
        }}
        getRowKey={(row) => row.id}
      />

      <ServerModal
        open={showAdd}
        loading={mCreate.isPending}
        onClose={() => !mCreate.isPending && setShowAdd(false)}
        onSubmit={(payload) => mCreate.mutate(payload)}
      />
      <ServerModal
        open={!!editTarget}
        initial={editTarget}
        loading={mUpdate.isPending}
        onClose={() => !mUpdate.isPending && setEditTarget(null)}
        onSubmit={(payload) =>
          mUpdate.mutate({ id: editTarget.id, payload })
        }
      />
      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus alamat server"
        message={
          confirmDel
            ? `Hapus "${confirmDel.name}" (${confirmDel.base_url})? Alamat ini tidak akan muncul lagi di aplikasi.`
            : ""
        }
        confirmText="Hapus"
        cancelText="Batal"
        loading={mDelete.isPending}
        onClose={() => !mDelete.isPending && setConfirmDel(null)}
        onConfirm={() => confirmDel && mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
