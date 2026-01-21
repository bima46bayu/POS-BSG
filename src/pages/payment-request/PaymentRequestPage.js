import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Landmark,
  Eye,
  Trash2,
  X,
  Calendar,
  ArrowLeft,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";

import DataTable from "../../components/data-table/DataTable";
import ConfirmDialog from "../../components/common/ConfirmDialog";

import {
  getPaymentRequests,
  createPaymentRequest,
  deletePaymentRequest,
} from "../../api/paymentRequests";

import { fetchBankAccounts } from "../../api/bankAccounts";

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

const fmtIDR = (v) =>
  Number(v || 0).toLocaleString("id-ID", { maximumFractionDigits: 0 });

const calcTotalsFromItems = (items = []) => {
  return items.reduce(
    (acc, i) => {
      acc.amount += Number(i.amount || 0);
      acc.discount += Number(i.deduction || 0);
      acc.transfer += Number(i.transfer_amount || 0);
      return acc;
    },
    { amount: 0, discount: 0, transfer: 0 }
  );
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

function AddPaymentRequestModal({
  open,
  loading,
  bankAccounts,
  onClose,
  onSubmit,
}) {
  const [bankId, setBankId] = useState("");

  useEffect(() => {
    if (open) setBankId("");
  }, [open]);

  const submit = () => {
    if (!bankId) return;
    onSubmit(bankId);
  };

  return (
    <BaseModal
      open={open}
      title="Pilih Rekening"
      onClose={loading ? undefined : onClose}
      footer={
        <>
          <button
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={loading || !bankId}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-50"
          >
            {loading ? "Creating..." : "Create"}
          </button>
        </>
      }
    >
      <div>
        <label className="block text-sm font-medium mb-1">Bank Account</label>
        <select
          value={bankId}
          onChange={(e) => setBankId(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg"
        >
          <option value="">-- pilih rekening --</option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bank_name} - {b.account_number} ({b.account_name})
            </option>
          ))}
        </select>
      </div>
    </BaseModal>
  );
}

/* ================= Page ================= */

export default function PaymentRequestPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [page, setPage] = useState(1);
  const [showAdd, setShowAdd] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");

  /* ===== Queries ===== */

  const { data: prRes, isLoading } = useQuery({
    queryKey: ["payment-requests", page],
    queryFn: ({ signal }) =>
      getPaymentRequests({ page, per_page: PER_PAGE }, signal),
    keepPreviousData: true,
  });

  const rawRows = Array.isArray(prRes?.data) ? prRes.data : [];

  const rows = useMemo(() => {
    if (!searchTerm) return rawRows;

    const q = searchTerm.toLowerCase();

    return rawRows.filter((r) =>
      `${r.id} ${r.bank_account?.bank_name || ""} ${
        r.bank_account?.account_number || ""
      }`
        .toLowerCase()
        .includes(q)
    );
  }, [rawRows, searchTerm]);

  const meta = prRes?.meta ?? {
    current_page: page,
    last_page: 1,
    per_page: PER_PAGE,
    total: rows.length,
  };

  const { data: bankAccRes } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: fetchBankAccounts,
  });

  const bankAccounts = Array.isArray(bankAccRes?.data)
    ? bankAccRes.data
    : Array.isArray(bankAccRes)
    ? bankAccRes
    : [];

  /* ===== Mutations ===== */

  const mCreate = useMutation({
    mutationFn: (bankId) =>
      createPaymentRequest({
        main_bank_account_id: Number(bankId),
        currency: "IDR",
      }),
    onSuccess: () => {
      toast.success("Payment request created");
      setShowAdd(false);
      qc.invalidateQueries(["payment-requests"]);
    },
    onError: () => toast.error("Gagal membuat payment request"),
  });

  const mDelete = useMutation({
    mutationFn: deletePaymentRequest,
    onSuccess: () => {
      toast.success("Payment request dihapus");
      setConfirmDel(null);
      qc.invalidateQueries(["payment-requests"]);
    },
    onError: () => toast.error("Gagal menghapus"),
  });

  /* ===== Columns ===== */

  const columns = useMemo(
    () => [
      {
        key: "id",
        header: "Payment Id",
        width: "80px",
        cell: (r) => <b>{String(r.id).padStart(4, "0")}</b>,
      },
      {
        key: "created_at",
        header: "Tanggal Dibuat",
        width: "180px",
        cell: (r) => (
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            {fmtDateTime(r.created_at)}
          </div>
        ),
      },
      {
        key: "bank",
        header: "Bank & Rekening",
        width: "180px",
        cell: (r) =>
          r.bank_account
            ? `${r.bank_account.bank_name} - ${r.bank_account.account_number}`
            : "-",
      },
      {
        key: "account_type",
        header: "Tipe Akun",
        width: "100px",
        cell: (r) => r.bank_account?.account_type || "-",
      },
      {
        key: "currency",
        header: "Curr",
        width: "10px",
        cell: (r) => r.currency,
      },
      {
        key: "total_bill",
        header: "Jumlah Tagihan",
        width: "130px",
        align: "right",
        cell: (r) => {
          const t = calcTotalsFromItems(r.items);
          return fmtIDR(r.total_bill ?? t.amount);
        },
      },
      {
        key: "total_discount",
        header: "Potongan",
        width: "130px",
        align: "right",
        cell: (r) => {
          const t = calcTotalsFromItems(r.items);
          return fmtIDR(r.total_discount ?? t.discount);
        },
      },
      {
        key: "total_transfer",
        header: "Jumlah Transfer",
        width: "130px",
        align: "right",
        cell: (r) => {
          const t = calcTotalsFromItems(r.items);
          return fmtIDR(r.total_transfer ?? t.transfer);
        },
      },
    ],
    []
  );

  /* ===== Render ===== */

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      {/* Title */}
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/home")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-gray-100"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>

          <div>
            <h2 className="text-lg font-semibold">Payment Request</h2>
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
                setPage(1);
              }}
              placeholder="Cari bank / rekening / ID..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => navigate("/payment-requests/bank-accounts")}
              className="flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-100"
            >
              <Landmark className="w-4 h-4" />
              Master Rekening
            </button>

            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg"
            >
              <Plus className="w-4 h-4" />
              Add
            </button>
          </div>
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
              width: "160px",
              sticky: "right",
              align: "center",
              cell: (r) => (
                <div className="flex justify-center gap-2">
                  <button
                    onClick={() =>
                      navigate(`/payment-requests/detail/${r.id}`)
                    }
                    className="inline-flex items-center justify-center h-8 w-20 bg-blue-500 text-white rounded-lg"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Detail
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
          data={rows}
          loading={isLoading}
          meta={meta}
          currentPage={meta.current_page}
          onPageChange={setPage}
          stickyHeader
          getRowKey={(r) => r.id}
        />
      </div>

      {/* Add Modal */}
      <AddPaymentRequestModal
        open={showAdd}
        loading={mCreate.isLoading}
        bankAccounts={bankAccounts}
        onClose={() => setShowAdd(false)}
        onSubmit={(bankId) => mCreate.mutate(bankId)}
      />

      {/* Delete confirm */}
      <ConfirmDialog
        open={!!confirmDel}
        title="Hapus Payment Request"
        message={
          confirmDel ? <>Hapus payment request #{confirmDel.id}?</> : null
        }
        onClose={() => setConfirmDel(null)}
        onConfirm={() => mDelete.mutate(confirmDel.id)}
      />
    </div>
  );
}
