import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Edit, Trash2, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import {
  fetchPaymentRequestCoas,
  createPaymentRequestCoa,
  updatePaymentRequestCoa,
  deletePaymentRequestCoa,
} from "../../api/paymentRequestCoa";

const PER_PAGE = 10;

/* ================= Base Modal ================= */
function BaseModal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl w-full max-w-md mx-4 shadow-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-5">{children}</div>
        <div className="px-5 py-4 border-t flex justify-end gap-3">
          {footer}
        </div>
      </div>
    </div>
  );
}

/* ================= Add Modal ================= */
function AddModal({ open, loading, onClose, onSubmit }) {
  const [form, setForm] = useState({ sub_coa: "", coa: "", keterangan: "" });

  useEffect(() => {
    if (open) setForm({ sub_coa: "", coa: "", keterangan: "" });
  }, [open]);

  const submit = () => {
    if (!form.sub_coa || !form.coa) return;
    onSubmit(form);
  };

  return (
    <BaseModal
      open={open}
      title="Add COA"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.sub_coa || !form.coa}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Sub COA</label>
          <input
            value={form.sub_coa}
            onChange={(e) => setForm({ ...form, sub_coa: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">COA</label>
          <input
            value={form.coa}
            onChange={(e) => setForm({ ...form, coa: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Keterangan</label>
          <input
            value={form.keterangan}
            onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>
    </BaseModal>
  );
}

/* ================= Edit Modal ================= */
function EditModal({ open, loading, initial, onClose, onSubmit }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (open && initial) setForm({ ...initial });
  }, [open, initial]);

  if (!form) return null;

  const submit = () => {
    if (!form.sub_coa || !form.coa) return;
    onSubmit(form.id, form);
  };

  return (
    <BaseModal
      open={open}
      title="Edit COA"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.sub_coa || !form.coa}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium mb-1">Sub COA</label>
          <input
            value={form.sub_coa || ""}
            onChange={(e) => setForm({ ...form, sub_coa: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">COA</label>
          <input
            value={form.coa || ""}
            onChange={(e) => setForm({ ...form, coa: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Keterangan</label>
          <input
            value={form.keterangan || ""}
            onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            className="w-full px-3 py-2 border rounded-lg"
          />
        </div>
      </div>
    </BaseModal>
  );
}

/* ================= Page ================= */
export default function PaymentRequestCoaPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const [showAdd, setShowAdd] = useState(false);
  const [editTarget, setEditTarget] = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchTerm.trim()), 300);
    return () => clearTimeout(id);
  }, [searchTerm]);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["coas"],
    queryFn: fetchPaymentRequestCoas,
  });

  const filtered = useMemo(() => {
    if (!debouncedSearch) return rows;
    return rows.filter((r) =>
      `${r.sub_coa} ${r.coa}`.toLowerCase().includes(debouncedSearch.toLowerCase())
    );
  }, [rows, debouncedSearch]);

  const pageItems = useMemo(() => {
    const start = (currentPage - 1) * PER_PAGE;
    return filtered.slice(start, start + PER_PAGE);
  }, [filtered, currentPage]);

  const meta = useMemo(() => {
    const total = filtered.length;
    return {
      current_page: currentPage,
      last_page: Math.max(1, Math.ceil(total / PER_PAGE)),
      per_page: PER_PAGE,
      total,
    };
  }, [filtered, currentPage]);

  const mCreate = useMutation({
    mutationFn: createPaymentRequestCoa,
    onSuccess: () => {
      toast.success("COA berhasil dibuat");
      setShowAdd(false);
      qc.invalidateQueries(["coas"]);
    },
    onError: (e) => {
      console.error(e.response?.data || e);
      toast.error("Gagal membuat COA");
    },
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }) => updatePaymentRequestCoa(id, payload),
    onSuccess: () => {
      toast.success("COA berhasil diupdate");
      setEditTarget(null);
      qc.invalidateQueries(["coas"]);
    },
    onError: () => toast.error("Gagal update COA"),
  });

  const mDelete = useMutation({
    mutationFn: deletePaymentRequestCoa,
    onSuccess: () => {
      toast.success("COA berhasil dihapus");
      setConfirmDel(null);
      qc.invalidateQueries(["coas"]);
    },
    onError: () => toast.error("Gagal menghapus COA"),
  });

  const fmtDateTime = (value) => {
    if (!value) return "-";
    const d = new Date(value);
    if (isNaN(d)) return value;

    return d.toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const columns = useMemo(
    () => [
      { key: "id", header: "ID", width: "80px" },
      { key: "sub_coa", header: "Sub COA", width: "160px" },
      { key: "coa", header: "COA", width: "160px" },
      { key: "keterangan", header: "Keterangan", width: "260px" },
      {
        key: "updated_at",
        header: "Updated",
        width: "180px",
        cell: (r) => fmtDateTime(r.updated_at),
      },
    ],
    []
  );

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-gray-100"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">Master COA</h2>
            <p className="text-sm text-gray-500">Payment Request</p>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Cari sub coa / coa..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>

          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg"
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border rounded-lg">
        <DataTable
          columns={[
            ...columns,
            {
              key: "__actions",
              header: "Action",
              width: "180px",
              sticky: "right",
              align: "center",
              cell: (r) => (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() => setEditTarget(r)}
                    className="inline-flex items-center justify-center h-8 w-20 bg-blue-500 text-white rounded-lg"
                  >
                    <Edit className="w-4 h-4 mr-1" /> Edit
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
          ]}
          data={pageItems}
          loading={isLoading}
          meta={meta}
          currentPage={meta.current_page}
          onPageChange={setCurrentPage}
          stickyHeader
          getRowKey={(r) => r.id}
        />
      </div>

      {/* Modals */}
      <AddModal
        open={showAdd}
        loading={mCreate.isLoading}
        onClose={() => setShowAdd(false)}
        onSubmit={(payload) => mCreate.mutate(payload)}
      />

      <EditModal
        open={!!editTarget}
        loading={mUpdate.isLoading}
        initial={editTarget}
        onClose={() => setEditTarget(null)}
        onSubmit={(id, payload) => mUpdate.mutate({ id, payload })}
      />

      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus COA"
        message={
          confirmDel ? <>Yakin hapus COA <b>{confirmDel.sub_coa}</b>?</> : null
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
