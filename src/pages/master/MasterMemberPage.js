import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  X,
  Edit,
  Trash2,
  Users,
  Search,
  Settings,
  Sparkles,
} from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";
import StoreScopeFilter from "../../components/common/StoreScopeFilter";
import { useStoreScopeFilter } from "../../hooks/useStoreScopeFilter";
import PointSettingsModal from "../../components/members/PointSettingsModal";
import MemberPointsModal from "../../components/members/MemberPointsModal";
import { getMe } from "../../api/users";
import { listStoreLocations } from "../../api/storeLocations";

import {
  listMembers,
  createMember,
  updateMember,
  deleteMember,
  nextMemberCode,
  getPointSettings,
} from "../../api/members";

const BRANCH_STORAGE_KEY = "member_store_id";
const PARENT_STORAGE_KEY = "member_parent_store_id";

const rupiah = (n) => `Rp ${Number(n || 0).toLocaleString("id-ID")}`;

const fmtDate = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

function Toggle({ checked, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition ${
        checked ? "bg-blue-600" : "bg-gray-300"
      } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
          checked ? "translate-x-4" : "translate-x-1"
        }`}
      />
    </button>
  );
}

/* ============================================================
 * Member add / edit
 * ========================================================== */
function MemberModal({ open, onClose, onSubmit, loading, initial, storeId }) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    code: "",
    name: "",
    phone: "",
    email: "",
    birth_date: "",
    address: "",
    note: "",
    is_active: true,
    initial_points: "",
  });

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setForm({
        code: initial.code || "",
        name: initial.name || "",
        phone: initial.phone || "",
        email: initial.email || "",
        birth_date: initial.birth_date
          ? String(initial.birth_date).slice(0, 10)
          : "",
        address: initial.address || "",
        note: initial.note || "",
        is_active: initial.is_active !== false,
        initial_points: "",
      });
      return;
    }

    // New member: prefill the next card code so the cashier does not invent one.
    setForm({
      code: "",
      name: "",
      phone: "",
      email: "",
      birth_date: "",
      address: "",
      note: "",
      is_active: true,
      initial_points: "",
    });

    if (storeId != null) {
      nextMemberCode({ store_location_id: storeId })
        .then((code) => setForm((f) => ({ ...f, code })))
        .catch(() => {});
    }
  }, [open, initial, storeId]);

  if (!open) return null;

  const set = (k) => (e) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e) => {
    e.preventDefault();

    if (!form.name.trim()) {
      toast.error("Nama wajib diisi");
      return;
    }

    const payload = {
      code: form.code.trim() || undefined,
      name: form.name.trim(),
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      birth_date: form.birth_date || null,
      address: form.address.trim() || null,
      note: form.note.trim() || null,
      is_active: form.is_active,
    };

    if (!isEdit && Number(form.initial_points) > 0) {
      payload.initial_points = Number(form.initial_points);
    }

    onSubmit(payload);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl bg-white rounded-xl shadow-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b sticky top-0 bg-white">
          <h3 className="font-semibold">
            {isEdit ? "Edit Member" : "Tambah Member"}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kode Member
              </label>
              <input
                value={form.code}
                onChange={set("code")}
                placeholder="MBR-0001"
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Kosongkan untuk otomatis
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                No. HP
              </label>
              <input
                value={form.phone}
                onChange={set("phone")}
                placeholder="0812..."
                inputMode="numeric"
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Dipakai kasir untuk cari member
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Nama <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name}
              onChange={set("name")}
              placeholder="Nama pelanggan"
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tanggal Lahir
              </label>
              <input
                type="date"
                value={form.birth_date}
                onChange={set("birth_date")}
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Alamat
            </label>
            <input
              value={form.address}
              onChange={set("address")}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Catatan
            </label>
            <textarea
              value={form.note}
              onChange={set("note")}
              rows={2}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Poin Awal
              </label>
              <input
                type="number"
                min={0}
                value={form.initial_points}
                onChange={set("initial_points")}
                placeholder="0"
                className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="mt-1 text-[11px] text-gray-500">
                Isi kalau memindahkan saldo poin dari kartu lama
              </p>
            </div>
          )}

          <div className="flex items-center justify-between rounded-lg border px-3 py-2">
            <div>
              <div className="text-sm font-medium">Aktif</div>
              <div className="text-[11px] text-gray-500">
                Member non-aktif tidak bisa dipakai di kasir
              </div>
            </div>
            <Toggle
              checked={form.is_active}
              onChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
            >
              {loading ? "Menyimpan..." : "Simpan"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
 * Page
 * ========================================================== */
export default function MasterMemberPage() {
  const qc = useQueryClient();

  const [me, setMe] = useState(null);
  const [stores, setStores] = useState([]);

  const {
    parentFilterId,
    storeFilterId,
    effectiveStoreId,
    canPickStore,
    needsStoreSelection,
    activeStoreLabel,
    handleParentChange,
    handleBranchChange,
  } = useStoreScopeFilter({
    branchStorageKey: BRANCH_STORAGE_KEY,
    parentStorageKey: PARENT_STORAGE_KEY,
    me,
    stores,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await getMe();
        if (!cancelled) setMe(profile);
      } catch {
        if (!cancelled) setMe(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!canPickStore) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await listStoreLocations({ page: 1, per_page: 200 });
        if (!cancelled) setStores(res?.items || []);
      } catch {
        if (!cancelled) setStores([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canPickStore]);

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const [pointsTarget, setPointsTarget] = useState(null);
  const [showSettings, setShowSettings] = useState(false);

  const [search, setSearch] = useState("");
  const [debounced, setDebounced] = useState("");
  const [page, setPage] = useState(1);

  // Debounce so typing a phone number does not fire a request per keystroke.
  useEffect(() => {
    const t = setTimeout(() => {
      setDebounced(search.trim());
      setPage(1);
    }, 350);
    return () => clearTimeout(t);
  }, [search]);

  const { data, isLoading } = useQuery({
    queryKey: ["members", effectiveStoreId, debounced, page],
    enabled: effectiveStoreId != null,
    queryFn: ({ signal }) =>
      listMembers(
        {
          store_location_id: effectiveStoreId,
          search: debounced || undefined,
          page,
          per_page: 25,
        },
        signal
      ),
  });

  // Shown in the header so the admin always knows the active conversion rate.
  const { data: settings } = useQuery({
    queryKey: ["member-point-settings"],
    queryFn: ({ signal }) => getPointSettings(signal),
  });

  const rows = data?.items ?? [];

  const mCreate = useMutation({
    mutationFn: (payload) =>
      createMember({ ...payload, store_location_id: effectiveStoreId }),
    onSuccess: () => {
      toast.success("Member ditambahkan");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal menambah member"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }) => updateMember(id, payload),
    onSuccess: () => {
      toast.success("Member diperbarui");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal memperbarui member"),
  });

  const mDelete = useMutation({
    mutationFn: deleteMember,
    onSuccess: () => {
      toast.success("Member dihapus");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) => {
      // Backend refuses to delete members that already have sales.
      toast.error(e?.response?.data?.message || "Gagal menghapus member");
      setConfirmDel(null);
    },
  });

  const columns = useMemo(
    () => [
      {
        key: "name",
        header: "Member",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 flex items-center justify-center text-xs font-bold shrink-0">
              {String(r.name || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <div className="font-medium truncate">{r.name}</div>
              <div className="text-[11px] text-gray-500">
                {r.code}
                {r.phone ? ` · ${r.phone}` : ""}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "points_balance",
        header: "Poin",
        align: "center",
        cell: (r) => (
          <button
            onClick={() => setPointsTarget(r)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold hover:bg-amber-100"
            title="Lihat riwayat poin"
          >
            <Sparkles className="w-3 h-3" />
            {Number(r.points_balance || 0).toLocaleString("id-ID")}
          </button>
        ),
      },
      {
        key: "visit_count",
        header: "Kunjungan",
        align: "center",
        cell: (r) => (
          <span className="text-sm">
            {Number(r.visit_count || 0).toLocaleString("id-ID")}
          </span>
        ),
      },
      {
        key: "total_spend",
        header: "Total Belanja",
        align: "right",
        cell: (r) => (
          <span className="text-sm">{rupiah(r.total_spend)}</span>
        ),
      },
      {
        key: "last_transaction_at",
        header: "Terakhir",
        cell: (r) => (
          <span className="text-xs text-gray-500">
            {fmtDate(r.last_transaction_at)}
          </span>
        ),
      },
      {
        key: "is_active",
        header: "Aktif",
        align: "center",
        cell: (r) => (
          <Toggle
            checked={r.is_active !== false}
            disabled={mUpdate.isPending}
            onChange={(val) =>
              mUpdate.mutate({ id: r.id, payload: { is_active: val } })
            }
          />
        ),
      },
      {
        key: "__actions",
        header: "Action",
        align: "center",
        cell: (r) => (
          <div className="flex justify-center gap-1.5">
            <button
              onClick={() => setEditTarget(r)}
              className="inline-flex items-center justify-center h-8 px-2 bg-blue-600 text-white rounded-lg text-xs"
            >
              <Edit className="w-4 h-4 mr-1" />
              Edit
            </button>
            <button
              onClick={() => setConfirmDel(r)}
              className="inline-flex items-center justify-center h-8 w-8 bg-red-500 text-white rounded-lg"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        ),
      },
    ],
    [mUpdate.isPending, mUpdate]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Users className="w-5 h-5 text-gray-400" />
              Member & Customer
            </h2>
            <p className="text-sm text-gray-500">
              Database pelanggan + poin loyalitas. Satu kartu berlaku di semua
              cabang dalam satu parent store.
            </p>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border hover:bg-gray-50"
          >
            <Settings className="w-4 h-4" />
            Konversi Poin
            {settings?.points_per_amount ? (
              <span className="ml-1 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 text-[11px] font-semibold">
                {rupiah(settings.points_per_amount)} = 1 poin
              </span>
            ) : null}
          </button>
        </div>

        <div className="mt-3">
          <StoreScopeFilter
            stores={stores}
            me={me}
            parentId={parentFilterId}
            branchId={storeFilterId}
            onParentChange={handleParentChange}
            onBranchChange={handleBranchChange}
            canPickStore={canPickStore}
            lockedLabel={activeStoreLabel}
          />
        </div>
      </div>

      {settings && settings.enabled === false && (
        <div className="bg-gray-100 border text-gray-700 text-sm rounded-lg px-4 py-3">
          Program poin sedang <b>dimatikan</b>. Transaksi tidak menambah poin
          sampai diaktifkan lagi di <b>Konversi Poin</b>.
        </div>
      )}

      {needsStoreSelection && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg px-4 py-3">
          Pilih parent store dan cabang untuk mengelola member.
        </div>
      )}

      <div className="bg-white p-4 rounded-lg shadow-sm border flex flex-wrap items-center justify-between gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, no. HP, atau kode member"
            className="w-full h-10 rounded-lg border border-gray-300 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          onClick={() => setShowAdd(true)}
          disabled={effectiveStoreId == null}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Tambah Member
        </button>
      </div>

      <div className="bg-white border rounded-lg">
        <DataTable
          columns={columns}
          data={rows}
          loading={isLoading}
          getRowKey={(r) => r.id}
        />

        {(data?.lastPage ?? 1) > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <div className="text-xs text-gray-500">
              Total {Number(data?.total || 0).toLocaleString("id-ID")} member
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40"
              >
                Sebelumnya
              </button>
              <span className="text-xs text-gray-600">
                {page} / {data?.lastPage}
              </span>
              <button
                onClick={() =>
                  setPage((p) => Math.min(data?.lastPage ?? 1, p + 1))
                }
                disabled={page >= (data?.lastPage ?? 1)}
                className="px-3 py-1.5 text-xs rounded-lg border disabled:opacity-40"
              >
                Berikutnya
              </button>
            </div>
          </div>
        )}
      </div>

      <MemberModal
        open={showAdd}
        storeId={effectiveStoreId}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isPending}
        onSubmit={(payload) => mCreate.mutate(payload)}
      />

      <MemberModal
        open={!!editTarget}
        storeId={effectiveStoreId}
        initial={editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isPending}
        onSubmit={(payload) =>
          mUpdate.mutate({ id: editTarget.id, payload })
        }
      />

      <MemberPointsModal
        open={!!pointsTarget}
        member={pointsTarget}
        onClose={() => setPointsTarget(null)}
      />

      <PointSettingsModal
        open={showSettings}
        onClose={() => setShowSettings(false)}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Member"
        message={
          confirmDel && (
            <>
              Yakin hapus <b>{confirmDel.name}</b> ({confirmDel.code})? Member
              yang sudah punya transaksi tidak bisa dihapus — non-aktifkan saja.
            </>
          )
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
