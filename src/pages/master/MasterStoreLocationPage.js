// src/pages/master/MasterStoreLocationPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Search,
  X,
  Calendar,
  Edit,
  Trash2,
  Phone,
  Image as ImageIcon,
} from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import {
  listStoreLocations,
  createStoreLocation,
  updateStoreLocation,
  deleteStoreLocation,
  uploadStoreLocationLogo, // 🔥 helper baru: POST /store-locations/{id}/logo (form-data: logo)
} from "../../api/storeLocations";
import { toAbsoluteUrl } from "../../api/client";

const PER_PAGE = 10;
localStorage.setItem("POS_STORES_DIRTY", "1");

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

// potong berdasarkan jumlah kata
const truncateWords = (text, maxWords = 12) => {
  if (!text) return "-";
  const parts = String(text).trim().split(/\s+/);
  if (parts.length <= maxWords) return text;
  return parts.slice(0, maxWords).join(" ") + "…";
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

/* ===== Add/Edit Modals ===== */
function AddStoreModal({ open, loading, onClose, onSubmit }) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    address: "",
    phone: "",
    logoFile: null,
  });

  useEffect(() => {
    if (open) {
      setForm({
        code: "",
        name: "",
        address: "",
        phone: "",
        logoFile: null,
      });
    }
  }, [open]);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.value,
    }));

  const onLogoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((p) => ({ ...p, logoFile: file }));
  };

  return (
    <BaseModal
      open={open}
      title="Add Store Location"
      onClose={loading ? undefined : onClose}
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
            onClick={() => onSubmit(form)}
            disabled={loading || !form.name.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Code</label>
          <input
            value={form.code}
            onChange={set("code")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="ITF / SWG"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            value={form.name}
            onChange={set("name")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Instafactory / Suwung"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            rows={2}
            value={form.address}
            onChange={set("address")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="Alamat lengkap…"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={set("phone")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
            placeholder="081234567890"
          />
        </div>

        {/* 🔥 Logo upload */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Logo (optional)</label>
          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
              <ImageIcon className="w-4 h-4 text-gray-500" />
              <span>Pilih file logo</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoChange}
              />
            </label>
            {form.logoFile && (
              <span className="text-xs text-gray-600 truncate max-w-[220px]">
                {form.logoFile.name}
              </span>
            )}
          </div>
          <p className="mt-1 text-[11px] text-gray-500">
            Disarankan PNG/JPG, maksimal 2MB.
          </p>
        </div>
      </div>
    </BaseModal>
  );
}

function EditStoreModal({ open, loading, onClose, onSubmit, initial }) {
  const [form, setForm] = useState({
    code: "",
    name: "",
    address: "",
    phone: "",
    logoFile: null,
  });

  useEffect(() => {
    if (open && initial) {
      setForm({
        code: initial.code || "",
        name: initial.name || "",
        address: initial.address || "",
        phone: initial.phone || "",
        logoFile: null,
      });
    }
  }, [open, initial]);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.value,
    }));

  const onLogoChange = (e) => {
    const file = e.target.files?.[0] || null;
    setForm((p) => ({ ...p, logoFile: file }));
  };

  const existingLogoUrl = initial?.logo_url ? toAbsoluteUrl(initial.logo_url) : null;

  return (
    <BaseModal
      open={open}
      title="Edit Store Location"
      onClose={loading ? undefined : onClose}
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
            onClick={() => onSubmit({ id: initial?.id, ...form })}
            disabled={loading || !form.name.trim()}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50 text-sm"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium mb-1">Code</label>
          <input
            value={form.code}
            onChange={set("code")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Name</label>
          <input
            value={form.name}
            onChange={set("name")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Address</label>
          <textarea
            rows={2}
            value={form.address}
            onChange={set("address")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm font-medium mb-1">Phone</label>
          <input
            value={form.phone}
            onChange={set("phone")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>

        {/* 🔥 Logo upload & preview */}
        <div className="md:col-span-2 space-y-2">
          <label className="block text-sm font-medium mb-1">Logo</label>
          {existingLogoUrl && !form.logoFile && (
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
                <img
                  src={existingLogoUrl}
                  alt="Store Logo"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-xs text-gray-600">Logo saat ini</span>
            </div>
          )}

          <div className="flex items-center gap-3">
            <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm cursor-pointer hover:bg-gray-50">
              <ImageIcon className="w-4 h-4 text-gray-500" />
              <span>{existingLogoUrl ? "Ganti logo" : "Pilih logo"}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoChange}
              />
            </label>
            {form.logoFile && (
              <span className="text-xs text-gray-600 truncate max-w-[220px]">
                {form.logoFile.name}
              </span>
            )}
          </div>
          <p className="text-[11px] text-gray-500">
            Upload logo baru akan menggantikan logo lama.
          </p>
        </div>
      </div>
    </BaseModal>
  );
}

/* ===== Page ===== */
export default function MasterStoreLocationPage() {
  const qc = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(
      () => setDebouncedSearch(searchTerm.trim()),
      250
    );
    return () => clearTimeout(id);
  }, [searchTerm]);

  const { data: res, isLoading } = useQuery({
    queryKey: [
      "store-locations",
      { page: currentPage, per_page: PER_PAGE, search: debouncedSearch },
    ],
    queryFn: ({ signal }) =>
      listStoreLocations(
        { page: currentPage, per_page: PER_PAGE, search: debouncedSearch },
        signal
      ),
    keepPreviousData: true,
    placeholderData: (prev) => prev,
    refetchOnWindowFocus: false,
  });

  const itemsRaw = res?.items ?? res?.data ?? res ?? [];
  const items = useMemo(
    () => (Array.isArray(itemsRaw) ? itemsRaw : []),
    [itemsRaw]
  );
  const meta = useMemo(() => {
    const m = res?.meta;
    if (m)
      return {
        current_page: Number(m.current_page ?? 1),
        last_page: Number(m.last_page ?? 1),
        per_page: Number(m.per_page ?? PER_PAGE),
        total: Number(m.total ?? items.length),
      };
    const total = items.length;
    const last = Math.max(1, Math.ceil(total / PER_PAGE));
    return {
      current_page: currentPage,
      last_page: last,
      per_page: PER_PAGE,
      total,
    };
  }, [res, items.length, currentPage]);

  /* ===== Mutations (with logo) ===== */
  const mCreate = useMutation({
    mutationFn: async ({ payload, signal }) => {
      const { logoFile, ...data } = payload;
      // 1) create store
      const store = await createStoreLocation(data, signal);
      const storeId = store?.id ?? store?.data?.id;
      // 2) upload logo kalau ada
      if (storeId && logoFile) {
        try {
          await uploadStoreLocationLogo(storeId, logoFile, signal);
        } catch (e) {
          console.error(e);
          toast.error("Store dibuat, tapi gagal upload logo");
        }
      }
      return store;
    },
    onSuccess: () => {
      toast.success("Store created");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["store-locations"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const mUpdate = useMutation({
    mutationFn: async ({ id, payload, signal }) => {
      const { logoFile, ...data } = payload;
      // 1) update data store
      const store = await updateStoreLocation(id, data, signal);
      const storeId = store?.id ?? store?.data?.id ?? id;
      // 2) kalau ada file baru → upload (BE akan hapus logo lama)
      if (storeId && logoFile) {
        try {
          await uploadStoreLocationLogo(storeId, logoFile, signal);
        } catch (e) {
          console.error(e);
          toast.error("Store terupdate, tapi gagal upload logo");
        }
      }
      return store;
    },
    onSuccess: () => {
      toast.success("Store updated");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["store-locations"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteStoreLocation(id, signal),
    onSuccess: () => {
      toast.success("Store deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["store-locations"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Failed to delete"),
  });

  /* ===== Columns ===== */
  const columns = useMemo(
    () => [
      {
        key: "logo",
        header: "Logo",
        width: "72px",
        align: "center",
        cell: (r) => {
          const url = r.logo_url ? toAbsoluteUrl(r.logo_url) : null;
          return (
            <div className="flex items-center justify-center">
              <div className="w-9 h-9 rounded-lg border bg-gray-50 flex items-center justify-center overflow-hidden">
                {url ? (
                  <img
                    src={url}
                    alt={r.name}
                    className="w-full h-full object-contain"
                  />
                ) : (
                  <ImageIcon className="w-4 h-4 text-gray-300" />
                )}
              </div>
            </div>
          );
        },
      },
      {
        key: "code",
        header: "Code",
        width: "120px",
        sticky: "left",
        className: "font-medium",
        cell: (r) => (
          <span className="font-medium text-gray-900">
            {r.code || "-"}
          </span>
        ),
      },
      {
        key: "name",
        header: "Name",
        width: "220px",
        cell: (r) => (
          <span className="font-medium text-gray-900">{r.name}</span>
        ),
      },
      {
        key: "address",
        header: "Address",
        width: "380px",
        cell: (r) => (
          <span className="text-gray-700 text-xs">
            {truncateWords(r.address, 8)}
          </span>
        ),
      },
      {
        key: "phone",
        header: "Phone",
        width: "160px",
        cell: (r) => (
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-700">
            <Phone className="w-3.5 h-3.5 text-gray-400" />
            {r.phone || "-"}
          </span>
        ),
      },
      {
        key: "created_at",
        header: "Created",
        width: "160px",
        cell: (r) => (
          <div className="flex items-center gap-1.5 text-gray-700 text-xs">
            <Calendar className="w-3.5 h-3.5 text-gray-400" />
            {fmtDateTime(r.created_at)}
          </div>
        ),
      },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">
          Store Locations
        </h2>
        <p className="text-sm text-gray-500">
          Kelola lokasi toko dan logo untuk struk.
        </p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search code, name, phone, address…"
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-10 pr-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="ml-auto">
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add Store
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
                  <div
                    key={i}
                    className="grid grid-cols-12 items-center gap-2 py-2 border-b last:border-0"
                  >
                    <div className="col-span-1 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-3 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-3 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-3.5 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-1 h-3.5 bg-slate-200/80 rounded animate-pulse" />
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
                    width: "190px",
                    sticky: "right",
                    align: "center",
                    cell: (r) => (
                      <div className="flex items-center justify-center gap-1.5">
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
                getRowKey={(row, i) => row.id ?? row.code ?? i}
                className="border-0 shadow-none text-[13px] [&_th]:py-2 [&_td]:py-2 [&_th]:px-3 [&_td]:px-3"
              />
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <AddStoreModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isLoading}
        onSubmit={(payload) => mCreate.mutate({ payload })}
      />

      <EditStoreModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isLoading}
        initial={editTarget}
        onSubmit={(payload) =>
          mUpdate.mutate({ id: payload.id, payload })
        }
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Store"
        message={
          confirmDel ? (
            <>
              Yakin hapus store <b>{confirmDel.name}</b>?
            </>
          ) : null
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />
    </div>
  );
}
