import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  X,
  Edit,
  Trash2,
  BadgePercent,
} from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import {
  listAdditionalCharges,
  createAdditionalCharge,
  updateAdditionalCharge,
  deleteAdditionalCharge,
} from "../../api/additionalCharges";

/* ================= TOGGLE ================= */
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

/* ================= BASE MODAL ================= */
function BaseModal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-xl border">
        <div className="px-5 py-3 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 py-3 border-t flex justify-end gap-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ================= ADD / EDIT MODAL ================= */
function ChargeModal({ open, onClose, onSubmit, loading, initial, usedTypes }) {
  const isEdit = !!initial;

  const [form, setForm] = useState({
    type: "PB1",
    calc_type: "PERCENT",
    value: 10,
    is_active: true,
  });

  useEffect(() => {
    if (!open) return;

    if (initial) {
      setForm({
        type: initial.type,
        calc_type: initial.calc_type,
        value: initial.value,
        is_active: initial.is_active,
      });
    } else {
      setForm({
        type: usedTypes.includes("PB1") ? "SERVICE" : "PB1",
        calc_type: "PERCENT",
        value: 10,
        is_active: true,
      });
    }
  }, [open, initial, usedTypes]);

  const set = (k) => (e) =>
    setForm((p) => ({
      ...p,
      [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value,
    }));

  return (
    <BaseModal
      open={open}
      title={isEdit ? `Edit ${initial.type}` : "Add Additional Charge"}
      onClose={loading ? () => {} : onClose}
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
            disabled={loading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {!isEdit && (
          <div>
            <label className="block text-sm font-medium mb-1">Type</label>
            <select
              value={form.type}
              onChange={set("type")}
              className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
            >
              {!usedTypes.includes("PB1") && <option value="PB1">PB1</option>}
              {!usedTypes.includes("SERVICE") && (
                <option value="SERVICE">Service</option>
              )}
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">Calculation</label>
          <select
            value={form.calc_type}
            onChange={set("calc_type")}
            className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
          >
            <option value="PERCENT">Percent (%)</option>
            <option value="FIXED">Nominal</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Value {form.calc_type === "PERCENT" ? "(%)" : "(Rp)"}
          </label>
          <input
            type="number"
            step="0.01"
            value={form.value}
            onChange={set("value")}
            className="w-full px-3 py-2 border rounded-lg text-sm"
          />
        </div>
      </div>
    </BaseModal>
  );
}

/* ================= PAGE ================= */
export default function AdditionalChargePage() {
  const qc = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  /* ===== LIST ===== */
  const { data = [], isLoading } = useQuery({
    queryKey: ["additional-charges"],
    queryFn: ({ signal }) =>
      listAdditionalCharges({}, signal).then((r) => r.data),
  });

  const usedTypes = useMemo(() => data.map((d) => d.type), [data]);

  /* ===== MUTATIONS ===== */
  const mCreate = useMutation({
    mutationFn: createAdditionalCharge,
    onSuccess: () => {
      toast.success("Additional charge created");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: ["additional-charges"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Failed to create"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }) => updateAdditionalCharge(id, payload),
    onSuccess: () => {
      toast.success("Additional charge updated");
      setEditTarget(null);
      qc.invalidateQueries({ queryKey: ["additional-charges"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Failed to update"),
  });

  const mToggle = useMutation({
    mutationFn: ({ id, is_active }) =>
      updateAdditionalCharge(id, { is_active }),
    onSuccess: (_, v) => {
      toast.success(v.is_active ? "Activated" : "Deactivated");
      qc.invalidateQueries({ queryKey: ["additional-charges"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Failed to update status"),
  });

  const mDelete = useMutation({
    mutationFn: deleteAdditionalCharge,
    onSuccess: () => {
      toast.success("Additional charge deleted");
      setConfirmDel(null);
      qc.invalidateQueries({ queryKey: ["additional-charges"] });
    },
  });

  /* ===== TABLE ===== */
  const columns = useMemo(
    () => [
      {
        key: "type",
        header: "Type",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <BadgePercent className="w-4 h-4 text-gray-400" />
            <span className="font-medium">{r.type}</span>
          </div>
        ),
      },
      {
        key: "calc_type",
        header: "Calc Type",
        cell: (r) => <span className="text-xs">{r.calc_type}</span>,
      },
      {
        key: "value",
        header: "Value",
        align: "right",
        cell: (r) =>
          r.calc_type === "PERCENT"
            ? `${Number(r.value)}%`
            : `Rp ${Number(r.value).toLocaleString("id-ID")}`,
      },
      {
        key: "is_active",
        header: "Active",
        align: "center",
        cell: (r) => (
          <Toggle
            checked={!!r.is_active}
            disabled={mToggle.isPending}
            onChange={(val) =>
              mToggle.mutate({ id: r.id, is_active: val })
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
    [mToggle.isPending]
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <h2 className="text-lg font-semibold">Additional Charges</h2>
        <p className="text-sm text-gray-500">
          Konfigurasi PB1 & Service Charge per store (otomatis mengikuti user)
        </p>
      </div>

      <div className="bg-white p-4 rounded-lg shadow-sm border flex justify-end">
        <button
          onClick={() => setShowAdd(true)}
          disabled={usedTypes.length >= 2}
          className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
          Add Charge
        </button>
      </div>

      <div className="bg-white border rounded-lg">
        <DataTable
          columns={columns}
          data={data}
          loading={isLoading}
          getRowKey={(r) => r.id}
        />
      </div>

      <ChargeModal
        open={showAdd}
        onClose={() => setShowAdd(false)}
        loading={mCreate.isPending}
        usedTypes={usedTypes}
        onSubmit={(payload) => mCreate.mutate(payload)}
      />

      <ChargeModal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        loading={mUpdate.isPending}
        initial={editTarget}
        usedTypes={usedTypes}
        onSubmit={(payload) =>
          mUpdate.mutate({ id: editTarget.id, payload })
        }
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Delete Additional Charge"
        message={
          confirmDel && (
            <>
              Yakin hapus <b>{confirmDel.type}</b>?
            </>
          )
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
