import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, X, Edit, Trash2, Calendar, ArrowLeft } from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import {
  fetchBankAccounts,
  createBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../../api/bankAccounts";

const PER_PAGE = 10;

/* ================= Helpers ================= */
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
  const [form, setForm] = useState({
    bank_name: "",
    account_number: "",
    account_name: "",
    account_type: "",
    currency: "IDR",
  });

  useEffect(() => {
    if (open) {
      setForm({
        bank_name: "",
        account_number: "",
        account_name: "",
        account_type: "",
        currency: "IDR",
      });
    }
  }, [open]);

  const submit = () => {
    if (!form.bank_name || !form.account_number) return;
    onSubmit(form);
  };

  return (
    <BaseModal
      open={open}
      title="Add Bank Account"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.bank_name || !form.account_number}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {[
          ["Nama Bank", "bank_name"],
          ["Nomor Rekening", "account_number"],
          ["Nama Rekening", "account_name"],
          ["Tipe Rekening", "account_type"],
          ["Currency", "currency"],
        ].map(([label, key]) => (
          <div key={key}>
            <label className="block text-sm font-medium mb-1">{label}</label>
            <input
              value={form[key]}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        ))}
      </div>
    </BaseModal>
  );
}

/* ================= Edit Modal ================= */
function EditModal({ open, loading, initial, onClose, onSubmit }) {
  const [form, setForm] = useState(null);

  useEffect(() => {
    if (open && initial) {
      setForm({ ...initial });
    }
  }, [open, initial]);

  if (!form) return null;

  const submit = () => {
    onSubmit(form.id, form);
  };

  return (
    <BaseModal
      open={open}
      title="Edit Bank Account"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button onClick={onClose} disabled={loading} className="px-4 py-2 border rounded-lg">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !form.bank_name || !form.account_number}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Saving..." : "Save Changes"}
          </button>
        </>
      }
    >
      <div className="space-y-3">
        {[
          ["Nama Bank", "bank_name"],
          ["Nomor Rekening", "account_number"],
          ["Nama Rekening", "account_name"],
          ["Tipe Rekening", "account_type"],
          ["Currency", "currency"],
        ].map(([label, key]) => (
          <div key={key}>
            <label className="block text-sm font-medium mb-1">{label}</label>
            <input
              value={form[key] || ""}
              onChange={(e) => setForm({ ...form, [key]: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        ))}
      </div>
    </BaseModal>
  );
}

/* ================= Page ================= */
export default function PaymentRequestBankAccountPage() {
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
    queryKey: ["bank-accounts"],
    queryFn: fetchBankAccounts,
  });

  const filtered = useMemo(() => {
    if (!debouncedSearch) return rows;
    return rows.filter((r) =>
      `${r.bank_name} ${r.account_number} ${r.account_name}`.toLowerCase().includes(debouncedSearch.toLowerCase())
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
    mutationFn: createBankAccount,
    onSuccess: () => {
      toast.success("Rekening berhasil dibuat");
      setShowAdd(false);
      qc.invalidateQueries(["bank-accounts"]);
    },
    onError: () => toast.error("Gagal membuat rekening"),
  });

  const mUpdate = useMutation({
    mutationFn: ({ id, payload }) => updateBankAccount(id, payload),
    onSuccess: () => {
      toast.success("Rekening berhasil diupdate");
      setEditTarget(null);
      qc.invalidateQueries(["bank-accounts"]);
    },
    onError: () => toast.error("Gagal update rekening"),
  });

  const mDelete = useMutation({
    mutationFn: (id) => deleteBankAccount(id),
    onSuccess: () => {
      toast.success("Rekening berhasil dihapus");
      setConfirmDel(null);
      qc.invalidateQueries(["bank-accounts"]);
    },
    onError: () => toast.error("Gagal menghapus rekening"),
  });

  const columns = useMemo(
    () => [
      { key: "bank_name", header: "Bank", width: "180px" },
      { key: "account_number", header: "No Rekening", width: "200px" },
      { key: "account_name", header: "Nama Rekening", width: "200px" },
      { key: "account_type", header: "Tipe", width: "160px" },
      { key: "currency", header: "Currency", width: "100px" },
      {
        key: "updated_at",
        header: "Updated",
        width: "180px",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            {fmtDateTime(r.updated_at)}
          </div>
        ),
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
            onClick={() => navigate("/payment-requests")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-gray-100"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h2 className="text-lg font-semibold">Master Rekening</h2>
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
              placeholder="Cari bank / rekening..."
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
        title="Hapus Rekening"
        message={confirmDel ? <>Yakin hapus rekening <b>{confirmDel.bank_name}</b>?</> : null}
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
