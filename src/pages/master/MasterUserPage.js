// src/pages/MasterUserPage.jsx
import React, { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, Loader2, Calendar } from "lucide-react";
import toast from "react-hot-toast";

import {
  listUsers,
  createUser,
  updateUser,
  deleteUser,
  updateUserRole,
  resetUserPassword,
  fetchRoleOptions,
  listStoreLocations,
} from "../../api/users";

import ConfirmDialog from "../../components/common/ConfirmDialog";
import AddUserModal from "../../components/users/AddUserModal";
import EditUserModal from "../../components/users/EditUserModal";

/* ---------- helpers ---------- */
const toLower = (v) => String(v ?? "").toLowerCase();
const isAdminRole = (r) => toLower(r) === "admin";
const fallbackRoleLabel = (r) => (isAdminRole(r) ? "Admin" : "Kasir");
const fmtDateTime = (s) => {
  if (!s) return "-";
  try {
    const d = new Date(s);
    return d.toLocaleString("id-ID", {
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

/* ---------- UI ---------- */
function Card({ title, children }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200">
      <div className="px-4 md:px-5 py-3 border-b">
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      <div className="p-4 md:p-5">{children}</div>
    </div>
  );
}

function TableSkeleton({ rows = 8 }) {
  return (
    <div className="border rounded-xl overflow-hidden">
      <div className="grid grid-cols-6 bg-gray-50 px-4 py-3 text-xs md:text-sm font-medium text-gray-600">
        <div>NAME</div>
        <div>EMAIL</div>
        <div>ROLE</div>
        <div>STORE</div>
        <div>CREATED</div>
        <div className="text-right">ACTION</div>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="grid grid-cols-6 items-center px-4 py-3 border-t">
          {[...Array(5)].map((__, j) => (
            <div key={j} className="h-4 rounded bg-gray-200 animate-pulse" />
          ))}
          <div className="flex justify-end gap-2">
            <div className="h-8 w-8 rounded bg-gray-200 animate-pulse" />
            <div className="h-8 w-8 rounded bg-gray-200 animate-pulse" />
            <div className="h-8 w-8 rounded bg-gray-200 animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function MasterUserPage() {
  const qc = useQueryClient();

  /* ---------- params ---------- */
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("");        // value: "admin" | "kasir" | ""
  const [storeId, setStoreId] = useState("");  // value: "" | "1" | "2" ...

  /* ---------- modal/dialog ---------- */
  const [confirmDel, setConfirmDel] = useState(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [editData, setEditData] = useState(null);

  /* ---------- dropdown options ---------- */
  // Role options: [{value:'admin',label:'Admin'}, {value:'kasir',label:'Kasir'}]
  const { data: rolesOpt } = useQuery({
    queryKey: ["user-roles"],
    queryFn: ({ signal }) => fetchRoleOptions(signal),
    initialData: [
      { value: "admin", label: "Admin" },
      { value: "kasir", label: "Kasir" },
    ],
  });

  // Buat map value->label untuk render badge tabel
  const roleMap = useMemo(() => {
    const m = new Map();
    (rolesOpt || []).forEach((o) => m.set(toLower(o.value), o.label || fallbackRoleLabel(o.value)));
    return m;
  }, [rolesOpt]);

  // Store locations untuk filter & modal
  const { data: storesData } = useQuery({
    queryKey: ["store-locations"],
    queryFn: ({ signal }) => listStoreLocations(undefined, signal),
    initialData: [],
  });
  const storeOptions = useMemo(
    () =>
      (storesData || []).map((s) => ({
        value: s.id,
        label: s.name ?? s.store_name ?? `Store #${s.id}`,
      })),
    [storesData]
  );

  /* ---------- list users (Laravel paginator) ---------- */
  // Response contoh kamu:
  // { current_page, data: [...], last_page, per_page, total, ... }
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["users", { page, search, role, storeId }],
    queryFn: ({ signal }) =>
      listUsers(
        {
          page,
          per_page: 10,
          search,
          role: role || undefined,
          store_location_id: storeId === "" ? undefined : Number(storeId),
        },
        signal
      ),
    placeholderData: (prev) => prev,
    keepPreviousData: true,
  });

  const items = data?.data ?? [];
  const meta = {
    current_page: data?.current_page ?? page,
    last_page: data?.last_page ?? 1,
    per_page: data?.per_page ?? 10,
    total: data?.total ?? items.length,
  };

  /* ---------- mutations ---------- */
  const mCreate = useMutation({
    mutationFn: ({ payload, signal }) => createUser(payload, signal),
    onSuccess: () => {
      toast.success("User created");
      setOpenAdd(false);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload, signal }) => updateUser(id, payload, signal),
    onSuccess: () => {
      toast.success("User updated");
      setEditData(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteUser(id, signal),
    onSuccess: () => {
      toast.success("User deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete"),
  });

  const mToggleRole = useMutation({
    mutationFn: ({ id, role, signal }) => updateUserRole(id, role, signal),
    onSuccess: () => {
      toast.success("Role updated");
      qc.invalidateQueries({ queryKey: ["users"] });
    },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update role"),
  });

  const mResetPwd = useMutation({
    mutationFn: ({ id, password, signal }) => resetUserPassword(id, password, signal),
    onSuccess: (res) => toast.success(res?.message || "Password reset"),
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to reset password"),
  });

  /* ---------- forms ---------- */
  const [addForm, setAddForm] = useState({
    name: "",
    email: "",
    password: "",
    password_confirmation: "",
    role: "kasir",
    store_location_id: "",
  });

  const [editForm, setEditForm] = useState({
    id: null,
    name: "",
    email: "",
    role: "kasir",
    store_location_id: "",
  });

  const openEdit = (u) => {
    setEditData(u);
    setEditForm({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      role: toLower(u.role) || "kasir",
      // BE: { store_location_id, store_location: {...} }
      store_location_id: u.store_location_id ?? u.store_location?.id ?? "",
    });
  };

  /* =================================== */
  return (
    <div className="p-4 md:p-6">
      <h1 className="text-xl font-semibold mb-3">Master · Users</h1>
      <p className="text-sm text-gray-500 mb-5">Halaman manajemen user.</p>

      <Card title="Users">
        {/* header controls */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
          <div className="flex-1">
            <div className="relative">
              <input
                value={search}
                onChange={(e) => {
                  setPage(1);
                  setSearch(e.target.value);
                }}
                placeholder="Search name or email…"
                className="w-full rounded-xl border border-gray-300 pl-12 pr-3 py-2.5 outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => toast("Gunakan dropdown filter di bawah.")}
              className="inline-flex items-center gap-2 rounded-xl border px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              <Filter size={16} /> Filter
            </button>
            <button
              onClick={() => setOpenAdd(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
            >
              <Plus size={16} /> Add User
            </button>
          </div>
        </div>

        {/* filters */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3 mb-4">
          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Role</span>
            <select
              value={role}
              onChange={(e) => {
                setPage(1);
                setRole(e.target.value);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Role</option>
              {(rolesOpt || []).map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label || fallbackRoleLabel(o.value)}
                </option>
              ))}
            </select>
          </label>

          <label className="block">
            <span className="block text-sm font-medium text-gray-700 mb-1">Store</span>
            <select
              value={storeId}
              onChange={(e) => {
                setPage(1);
                setStoreId(e.target.value);
              }}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Semua Store</option>
              {storeOptions.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {/* table */}
        {isLoading ? (
          <TableSkeleton />
        ) : (
          <div className="border rounded-xl overflow-hidden">
            {/* header */}
            <div className="grid grid-cols-6 bg-gray-50 px-4 py-3 text-xs md:text-sm font-medium text-gray-600">
              <div>NAME</div>
              <div>EMAIL</div>
              <div>ROLE</div>
              <div>STORE</div>
              <div>CREATED</div>
              <div className="text-right">ACTION</div>
            </div>

            {/* rows */}
            {items.length === 0 ? (
              <div className="px-4 py-10 text-center text-gray-500">Tidak ada data.</div>
            ) : (
              items.map((u) => {
                const admin = isAdminRole(u.role);
                const roleText = roleMap.get(toLower(u.role)) || fallbackRoleLabel(u.role);
                return (
                  <div key={u.id} className="grid grid-cols-6 items-center px-4 py-3 border-t">
                    <div className="font-medium">{u.name}</div>
                    <div className="text-gray-600">{u.email}</div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          admin ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {roleText}
                      </span>
                    </div>
                    <div className="text-gray-600">
                      {u.store_location?.name || "-"}
                    </div>
                    <div className="flex items-center gap-2 text-gray-600">
                      <Calendar size={16} className="opacity-70" />
                      <span className="text-sm">{fmtDateTime(u.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-gray-50"
                        onClick={() =>
                          mToggleRole.mutate({ id: u.id, role: admin ? "kasir" : "admin" })
                        }
                        title="Toggle Role"
                      >
                        {admin ? "Make Kasir" : "Make Admin"}
                      </button>
                      <button
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs hover:bg-gray-50"
                        onClick={() => mResetPwd.mutate({ id: u.id })}
                        title="Reset Password"
                      >
                        {mResetPwd.isLoading ? <Loader2 size={14} className="animate-spin" /> : null}
                        Reset
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded-lg bg-blue-600 hover:bg-blue-700 text-white w-8 h-8"
                        onClick={() => openEdit(u)}
                        title="Edit"
                      >
                        ✎
                      </button>
                      <button
                        className="inline-flex items-center justify-center rounded-lg bg-red-600 hover:bg-red-700 text-white w-8 h-8"
                        onClick={() => setConfirmDel(u)}
                        title="Delete"
                      >
                        ⨯
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* footer / pagination */}
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            Page {meta.current_page} / {meta.last_page}
            {isFetching && (
              <span className="ml-2 inline-flex items-center">
                <Loader2 size={14} className="animate-spin mr-1" />
                updating…
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <button
              disabled={meta.current_page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border px-3 py-1.5 disabled:opacity-50"
            >
              Prev
            </button>
            <button
              disabled={meta.current_page >= meta.last_page}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-xl border px-3 py-1.5 disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* Add Modal */}
      <AddUserModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        form={addForm}
        setForm={setAddForm}
        roleOptions={rolesOpt || []}
        storeOptions={storeOptions}
        loading={mCreate.isLoading}
        onSubmit={() =>
          mCreate.mutate({
            payload: addForm,
          })
        }
      />

      {/* Edit Modal */}
      <EditUserModal
        open={!!editData}
        onClose={() => setEditData(null)}
        form={editForm}
        setForm={setEditForm}
        roleOptions={rolesOpt || []}
        storeOptions={storeOptions}
        loading={mUpdate.isLoading}
        onSubmit={() =>
          mUpdate.mutate({
            id: editForm.id,
            payload: {
              name: editForm.name,
              email: editForm.email,
              role: editForm.role,
              store_location_id: editForm.store_location_id || null,
            },
          })
        }
      />

      {/* Confirm Delete */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus User"
        message={
          confirmDel ? (
            <>Yakin hapus user <b>{confirmDel.name}</b>?</>
          ) : null
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />
    </div>
  );
}
