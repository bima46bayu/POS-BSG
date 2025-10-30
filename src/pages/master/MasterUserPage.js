// src/pages/master/MasterUserPage.js
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Filter, X, Calendar, Loader2, Edit, Trash2, RotateCcw } from "lucide-react";
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
import DataTable from "../../components/data-table/DataTable";

/* ===================== helpers & formatters ===================== */
const toLower = (v) => String(v ?? "").toLowerCase();
const isAdminRole = (r) => toLower(r) === "admin";
const fallbackRoleLabel = (r) => (isAdminRole(r) ? "Admin" : "Kasir");
const fmtDateTime = (s) => {
  if (!s) return "-";
  try {
    return new Date(s).toLocaleString("id-ID", {
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });
  } catch { return s; }
};

const PER_PAGE = 10;

export default function MasterUserPage() {
  const qc = useQueryClient();

  // ====== query state ======
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");

  // filter yang diterapkan
  const [role, setRole] = useState("");
  const [storeId, setStoreId] = useState(""); // string → dinormalisasi di API layer

  // filter popover
  const [showFilters, setShowFilters] = useState(false);
  const [popoverPos, setPopoverPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef(null);

  // draft filter (di popover)
  const [draftRole, setDraftRole] = useState("");
  const [draftStoreId, setDraftStoreId] = useState("");

  // dialogs & forms
  const [confirmDel, setConfirmDel] = useState(null);
  const [resetTarget, setResetTarget] = useState(null);
  const [openAdd, setOpenAdd] = useState(false);
  const [editData, setEditData] = useState(null);

  const [addForm, setAddForm] = useState({
    name: "", email: "", password: "",
    password_confirmation: "", role: "kasir", store_location_id: ""
  });
  const [editForm, setEditForm] = useState({
    id: null, name: "", email: "", role: "kasir", store_location_id: ""
  });

  // ====== roles ======
  const { data: rolesOpt } = useQuery({
    queryKey: ["user-roles"],
    queryFn: () => fetchRoleOptions(),
    initialData: [
      { value: "admin", label: "Admin" },
      { value: "kasir", label: "Kasir" },
    ],
    staleTime: 5 * 60_000,
  });

  const roleMap = useMemo(() => {
    const m = new Map();
    (rolesOpt || []).forEach((o) => m.set(toLower(o.value), o.label || fallbackRoleLabel(o.value)));
    return m;
  }, [rolesOpt]);

  // ====== stores dari API (sudah dinormalisasi ke [{id,name}]) ======
  const {
    data: storeOptionsRaw = [],
    isFetching: isFetchingStores,
  } = useQuery({
    queryKey: ["stores", { per_page: 500 }],
    queryFn: ({ signal }) => listStoreLocations({ per_page: 500 }, signal),
    initialData: [],
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });

  // ====== debounce search ======
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  // ====== users fetch ======
  const { data: usersRes, isLoading, isFetching } = useQuery({
    queryKey: ["users", { page: currentPage, per_page: PER_PAGE, search: debouncedSearch, role, storeId }],
    queryFn: ({ signal }) =>
      listUsers(
        {
          page: currentPage,
          per_page: PER_PAGE,
          search: debouncedSearch,
          role: role,
          store_location_id: storeId,
        },
        signal
      ),
    keepPreviousData: true,
    placeholderData: (prev) => prev,
  });

  // Bentuk respons users fleksibel
  const itemsRaw = usersRes?.items ?? usersRes?.data ?? usersRes?.users ?? [];
  const metaObj  = usersRes?.meta ?? null;

  const meta = useMemo(() => {
    if (metaObj) {
      return {
        current_page: Number(metaObj.current_page ?? metaObj.currentPage ?? currentPage),
        last_page: Number(metaObj.last_page ?? metaObj.lastPage ?? 1),
        per_page: Number(metaObj.per_page ?? metaObj.perPage ?? PER_PAGE),
        total: Number(metaObj.total ?? (Array.isArray(itemsRaw) ? itemsRaw.length : 0)),
      };
    }
    return {
      current_page: Number(usersRes?.current_page ?? currentPage),
      last_page: Number(usersRes?.last_page ?? 1),
      per_page: Number(usersRes?.per_page ?? PER_PAGE),
      total: Number(usersRes?.total ?? (Array.isArray(itemsRaw) ? itemsRaw.length : 0)),
    };
  }, [metaObj, usersRes, itemsRaw, currentPage]);

  const items = useMemo(() => (Array.isArray(itemsRaw) ? itemsRaw : []), [itemsRaw]);

  // ====== derive store pairs dari data user (fallback kalau API stores kosong) ======
  const derivedStorePairs = useMemo(() => {
    const pairs = [];
    for (const u of items) {
      const sid =
        u?.store_location_id ??
        u?.store_id ??
        u?.storeLocationId ??
        u?.store_location?.id ??
        u?.store?.id ??
        null;

      if (sid == null) continue;

      const nameDirect =
        u?.store_location?.name ??
        u?.store?.name ??
        u?.storeLocation?.name ??
        u?.store_location_name ??
        u?.store_name ??
        null;

      if (nameDirect && String(nameDirect).trim()) {
        pairs.push({ id: sid, name: String(nameDirect) });
      }
    }
    const seen = new Set();
    return pairs.filter(p => {
      const k = String(p.id);
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  }, [items]);

  // ====== gabungkan: stores dari API + turunan dari users ======
  const storeOptions = useMemo(() => {
    const map = new Map();
    (storeOptionsRaw || []).forEach(s => map.set(String(s.id), { id: s.id, name: s.name }));
    derivedStorePairs.forEach(s => {
      const k = String(s.id);
      if (!map.has(k)) map.set(k, { id: s.id, name: s.name });
    });
    return Array.from(map.values());
  }, [storeOptionsRaw, derivedStorePairs]);

  // Peta id→name untuk lookup cepat
  const storeNameById = useMemo(() => {
    const m = new Map();
    storeOptions.forEach((s) => m.set(String(s.id), s.name));
    return m;
  }, [storeOptions]);

  // ====== mutations ======
  const mCreate = useMutation({
    mutationFn: ({ payload, signal }) => createUser(payload, signal),
    onSuccess: () => { toast.success("User created"); setOpenAdd(false); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to create"),
  });
  const mUpdate = useMutation({
    mutationFn: ({ id, payload, signal }) => updateUser(id, payload, signal),
    onSuccess: () => { toast.success("User updated"); setEditData(null); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update"),
  });
  const mDelete = useMutation({
    mutationFn: ({ id, signal }) => deleteUser(id, signal),
    onSuccess: () => { toast.success("User deleted"); setConfirmDel(null); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to delete"),
  });
  const mToggleRole = useMutation({
    mutationFn: ({ id, role, signal }) => updateUserRole(id, role, signal),
    onSuccess: () => { toast.success("Role updated"); qc.invalidateQueries({ queryKey: ["users"] }); },
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to update role"),
  });
  const mResetPwd = useMutation({
    mutationFn: ({ id, password, signal }) => resetUserPassword(id, password, signal),
    onSuccess: (res) => toast.success(res?.message || "Password reset"),
    onError: (e) => toast.error(e?.response?.data?.message || "Failed to reset password"),
  });

  // ====== open edit helper ======
  const openEdit = (u) => {
    const sid =
      u.store_location_id ??
      u.store_id ??
      u.store_location?.id ??
      u.store?.id ??
      "";
    setEditData(u);
    setEditForm({
      id: u.id,
      name: u.name || "",
      email: u.email || "",
      role: toLower(u.role) || "kasir",
      store_location_id: sid ?? "",
    });
  };

  // ====== filter popover ======
  const toggleFilters = useCallback(() => {
    if (!showFilters) {
      setDraftRole(role);
      setDraftStoreId(storeId);
      const el = btnRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        const width = 384;
        const left = Math.min(Math.max(rect.right - width, 8), window.innerWidth - width - 8);
        const top = Math.min(rect.bottom + 8, window.innerHeight - 8);
        setPopoverPos({ top, left });
      }
    }
    setShowFilters((s) => !s);
  }, [showFilters, role, storeId]);

  const applyFilters = useCallback(() => {
    setRole(draftRole ? String(draftRole).toLowerCase() : "");
    setStoreId(draftStoreId === "" ? "" : String(draftStoreId));
    setCurrentPage(1);
    setShowFilters(false);
  }, [draftRole, draftStoreId]);

  const clearAllFilters = useCallback(() => {
    setDraftRole("");
    setDraftStoreId("");
    setRole("");
    setStoreId("");
    setCurrentPage(1);
  }, []);

  const appliedFilterCount = useMemo(() => {
    let c = 0;
    if (role) c += 1;
    if (storeId) c += 1;
    return c;
  }, [role, storeId]);

  // ====== resolver nama store (pakai peta gabungan) ======
  const resolveUserStoreName = useCallback((u) => {
    const direct =
      u?.store_location?.name ??
      u?.store?.name ??
      u?.storeLocation?.name ??
      u?.store_name ??
      u?.store_location_name ??
      null;
    if (direct && String(direct).trim()) return direct;

    const sid =
      u?.store_location_id ??
      u?.store_id ??
      u?.storeLocationId ??
      u?.store_location?.id ??
      u?.store?.id ??
      null;

    if (sid != null) {
      const name = storeNameById.get(String(sid));
      if (name) return name;
    }
    return "-";
  }, [storeNameById]);

  /* ====================== COLUMNS ====================== */
  const columns = useMemo(() => [
    {
      key: "name",
      header: "Name",
      width: "220px",
      sticky: "left",
      cell: (u) => <span className="font-medium text-gray-900">{u.name}</span>,
    },
    {
      key: "email",
      header: "Email",
      width: "260px",
      cell: (u) => <span className="text-gray-700">{u.email}</span>,
    },
    {
      key: "role",
      header: "Role",
      width: "140px",
      align: "center",
      cell: (u) => {
        const admin = isAdminRole(u.role);
        const roleText = roleMap.get(toLower(u.role)) || fallbackRoleLabel(u.role);
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${admin ? "bg-blue-50 text-blue-700" : "bg-emerald-50 text-emerald-700"}`}>
            {roleText}
          </span>
        );
      },
    },
    {
      key: "store",
      header: "Store",
      width: "220px",
      cell: (u) => <span className="text-gray-700">{resolveUserStoreName(u)}</span>,
    },
    {
      key: "created_at",
      header: "Created",
      width: "180px",
      cell: (u) => (
        <div className="flex items-center gap-2 text-gray-700">
          <Calendar className="w-4 h-4 text-gray-400" />
          {fmtDateTime(u.created_at)}
        </div>
      ),
    },
  ], [resolveUserStoreName, roleMap]);

  /* ---------------- render ---------------- */
  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-800">Users</h2>
        <p className="text-sm text-gray-500">Kelola akun pengguna berdasarkan role dan lokasi toko.</p>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search name or email…"
              value={searchTerm}
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              ref={btnRef}
              onClick={toggleFilters}
              className="flex items-center gap-2 px-4 py-2 text-sm border rounded-lg hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filter
              {appliedFilterCount > 0 && (
                <span className="ml-1 px-2 py-0.5 text-xs bg-blue-500 text-white rounded-full">
                  {appliedFilterCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setOpenAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg hover:bg-blue-700"
            >
              <Plus className="w-4 h-4" />
              Add User
            </button>
          </div>
        </div>
      </div>

      {/* Table (pakai DataTable seperti ProductPage) */}
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="w-full overflow-x-auto overscroll-x-contain">
          <div className="min-w-full inline-block align-middle">

            {/* Skeleton loading */}
            {isLoading ? (
              <div className="p-4">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="grid grid-cols-12 items-center gap-3 py-3 border-b last:border-0">
                    <div className="col-span-3 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-3 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 h-4 bg-slate-200/80 rounded animate-pulse" />
                    <div className="col-span-2 flex justify-end gap-2">
                      <div className="h-8 w-28 bg-slate-200/80 rounded animate-pulse" />
                      <div className="h-8 w-20 bg-slate-200/80 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-slate-200/80 rounded animate-pulse" />
                      <div className="h-8 w-8 bg-slate-200/80 rounded animate-pulse" />
                    </div>
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
                    width: "340px",
                    sticky: "right",
                    align: "center",
                    cell: (u) => {
                      const admin = isAdminRole(u.role);
                      return (
                        <div className="flex items-center justify-center gap-2">
                          {/* Make Admin/Kasir — fixed width */}
                          <button
                            onClick={() => mToggleRole.mutate({ id: u.id, role: admin ? "kasir" : "admin" })}
                            className="inline-flex items-center justify-center h-8 px-3 min-w-[128px] text-xs rounded-lg border border-slate-300 hover:bg-slate-50"
                            title={admin ? "Make Kasir" : "Make Admin"}
                          >
                            {admin ? "Make Kasir" : "Make Admin"}
                          </button>

                          {/* Reset Password — jelas & kontras */}
                          <button
                            onClick={() => setResetTarget(u)}
                            className="inline-flex items-center justify-center h-8 px-3 min-w-[100px] text-xs rounded-lg bg-amber-500 text-white hover:bg-amber-600"
                            title="Reset Password"
                          >
                            <RotateCcw className="w-4 h-4 mr-1.5" />
                            Reset
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => openEdit(u)}
                            className="w-8 h-8 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center justify-center"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>

                          {/* Delete */}
                          <button
                            onClick={() => setConfirmDel(u)}
                            className="w-8 h-8 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center justify-center"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    },
                  },
                ]}
                data={items}
                loading={false}
                meta={meta}
                currentPage={meta.current_page}
                onPageChange={setCurrentPage}
                stickyHeader
                getRowKey={(row, i) => row.id ?? row.email ?? i}
                className="border-0 shadow-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* Filter Popover */}
      {showFilters && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowFilters(false)} />
          <div
            className="fixed z-50 w-96 bg-white rounded-lg shadow-lg border"
            style={{ top: popoverPos.top, left: popoverPos.left }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b flex justify-between items-center">
              <h3 className="font-semibold">Filters</h3>
              <button onClick={() => setShowFilters(false)}><X className="w-5 h-5" /></button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Role</label>
                <select
                  value={draftRole}
                  onChange={(e) => setDraftRole(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All</option>
                  {(rolesOpt || []).map((o) => (
                    <option key={o.value} value={o.value}>{o.label || fallbackRoleLabel(o.value)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Store Location</label>
                <select
                  value={draftStoreId}
                  onChange={(e) => setDraftStoreId(e.target.value)}
                  className="w-full px-3 py-2 border rounded-lg"
                >
                  <option value="">All</option>
                  {storeOptions.map((s) => (
                    <option key={String(s.id)} value={String(s.id)}>{s.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="px-4 py-3 border-t flex justify-between">
              <button onClick={clearAllFilters} className="text-sm text-gray-600">Clear All</button>
              <button onClick={applyFilters} className="px-4 py-2 bg-blue-500 text-white text-sm rounded-lg">Apply</button>
            </div>
          </div>
        </>
      )}

      {/* Modals */}
      <AddUserModal
        open={openAdd}
        onClose={() => setOpenAdd(false)}
        form={addForm}
        setForm={setAddForm}
        roleOptions={rolesOpt || []}
        storeOptions={storeOptions.map((s) => ({ value: s.id, label: s.name }))}
        loading={mCreate.isLoading}
        onSubmit={() => mCreate.mutate({
          payload: {
            ...addForm,
            store_location_id: addForm.store_location_id === "" ? null : Number(addForm.store_location_id),
          }
        })}
      />

      <EditUserModal
        open={!!editData}
        onClose={() => setEditData(null)}
        form={editForm}
        setForm={setEditForm}
        roleOptions={rolesOpt || []}
        storeOptions={storeOptions.map((s) => ({ value: s.id, label: s.name }))}
        loading={mUpdate.isLoading}
        onSubmit={() =>
          mUpdate.mutate({
            id: editForm.id,
            payload: {
              name: editForm.name,
              email: editForm.email,
              role: editForm.role,
              store_location_id:
                editForm.store_location_id === "" ? null :
                (Number.isFinite(Number(editForm.store_location_id)) ? Number(editForm.store_location_id) : null),
            },
          })
        }
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus User"
        message={confirmDel ? <>Yakin hapus user <b>{confirmDel.name}</b>?</> : null}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate({ id: confirmDel.id })}
      />

      <ConfirmDialog
        open={!!resetTarget}
        title="Reset Password"
        message={resetTarget ? (
          <>
            Password untuk user <b>{resetTarget.name}</b> ({resetTarget.email}) akan direset.
            <br />Lanjutkan?
          </>
        ) : null}
        confirmText={mResetPwd.isLoading ? "Processing..." : "Reset"}
        cancelText="Cancel"
        variant="warning"
        loading={mResetPwd.isLoading}
        onConfirm={async () => {
          if (!resetTarget) return;
          try {
            await mResetPwd.mutateAsync({ id: resetTarget.id });
            setResetTarget(null);
          } catch {
            // toast sudah dihandle di mutation onError
          }
        }}
        onClose={() => { if (!mResetPwd.isLoading) setResetTarget(null); }}
      />

    </div>
  );
}
