import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  FileText,
  Database,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";

import { getPaymentRequestDetail } from "../../api/paymentRequests";
import {
  createPaymentRequestItem,
  updatePaymentRequestItem,
  deletePaymentRequestItem,
} from "../../api/paymentRequestItems";
import {
  createPaymentRequestBalance,
  updatePaymentRequestBalance,
  deletePaymentRequestBalance,
} from "../../api/paymentRequestBalances";
import { fetchPaymentRequestCoas } from "../../api/paymentRequestCoa";
import { fetchPayees } from "../../api/payees";
import { fetchBankAccounts } from "../../api/bankAccounts";
import { getPaymentRequestPdfLink } from "../../api/paymentRequestPdf";

const fmtIDR = (v) => Number(v || 0).toLocaleString("id-ID");

/* ================= MODAL BASE ================= */
function Modal({ open, title, onClose, children, footer }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-xl border">
        <div className="p-4 border-b flex justify-between items-center">
          <b>{title}</b>
          <button onClick={onClose}>✕</button>
        </div>
        <div className="p-4">{children}</div>
        <div className="p-4 border-t flex justify-end gap-2">{footer}</div>
      </div>
    </div>
  );
}

/* ================= PAGE ================= */
export default function PaymentRequestDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showAddItem, setShowAddItem] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [showAddBalance, setShowAddBalance] = useState(false);
  const [editBalance, setEditBalance] = useState(null);

  const { data: pr, isLoading } = useQuery({
    queryKey: ["payment-request", id],
    queryFn: () => getPaymentRequestDetail(id),
  });

  const { data: coas = [] } = useQuery({
    queryKey: ["payment-request-coas"],
    queryFn: fetchPaymentRequestCoas,
  });

  const { data: payees = [] } = useQuery({
    queryKey: ["payees"],
    queryFn: fetchPayees,
  });

  const { data: bankAccounts = [] } = useQuery({
    queryKey: ["bank-accounts"],
    queryFn: fetchBankAccounts,
  });

  const totals = useMemo(() => {
    const items = pr?.items || [];
    return items.reduce(
      (acc, i) => {
        acc.amount += Number(i.amount || 0);
        acc.deduction += Number(i.deduction || 0);
        acc.transfer += Number(i.transfer_amount || 0);
        return acc;
      },
      { amount: 0, deduction: 0, transfer: 0 }
    );
  }, [pr]);

  const refresh = () => qc.invalidateQueries(["payment-request", id]);

  /* ===== PDF FIX ===== */
  const handleDownloadPdf = async () => {
    const toastId = toast.loading("Menyiapkan PDF...");

    try {
      const url = await getPaymentRequestPdfLink(id);
      window.open(url, "_blank");
      toast.success("PDF siap dibuka", { id: toastId });
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat PDF", { id: toastId });
    }
  };

  /* ===== Mutations ===== */
  const mCreateItem = useMutation({
    mutationFn: (payload) => createPaymentRequestItem(id, payload),
    onSuccess: () => {
      toast.success("Item ditambahkan");
      setShowAddItem(false);
      refresh();
    },
  });

  const mUpdateItem = useMutation({
    mutationFn: ({ itemId, payload }) =>
      updatePaymentRequestItem(id, itemId, payload),
    onSuccess: () => {
      toast.success("Item diupdate");
      setEditItem(null);
      refresh();
    },
  });

  const mDeleteItem = useMutation({
    mutationFn: (itemId) => deletePaymentRequestItem(id, itemId),
    onSuccess: () => {
      toast.success("Item dihapus");
      refresh();
    },
  });

  const mCreateBalance = useMutation({
    mutationFn: (payload) => createPaymentRequestBalance(id, payload),
    onSuccess: () => {
      toast.success("Rekening ditambahkan");
      setShowAddBalance(false);
      refresh();
    },
  });

  const mUpdateBalance = useMutation({
    mutationFn: ({ balanceId, payload }) =>
      updatePaymentRequestBalance(id, balanceId, payload),
    onSuccess: () => {
      toast.success("Rekening diupdate");
      setEditBalance(null);
      refresh();
    },
  });

  const mDeleteBalance = useMutation({
    mutationFn: (balanceId) => deletePaymentRequestBalance(id, balanceId),
    onSuccess: () => {
      toast.success("Rekening dihapus");
      refresh();
    },
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (!pr) return null;

  return (
    <div className="p-6 space-y-5 bg-gray-50 min-h-screen">
      {/* HEADER */}
      <div className="bg-white p-4 rounded-xl shadow border space-y-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3">
            <button onClick={() => navigate("/payment-requests")}>
              <ArrowLeft />
            </button>
            <div>
              <div className="font-semibold text-lg">
                Payment Request {pr.id}
              </div>
              <div className="text-sm text-gray-500">
                {pr.store_location?.name}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            <HeaderBtn
              icon={<Database size={16} />}
              label="Master COA"
              onClick={() => navigate("/payment-requests/coas")}
            />
            <HeaderBtn
              icon={<Users size={16} />}
              label="Master Payee"
              onClick={() => navigate("/payment-requests/payees")}
            />
            <HeaderBtn
              icon={<FileText size={16} />}
              label="PDF"
              onClick={handleDownloadPdf}
            />
          </div>
        </div>

        <div className="grid grid-cols-4 gap-4 text-sm">
          <Info label="Store" value={pr.store_location?.name} />
          <Info
            label="Bank"
            value={`${pr.bank_account?.bank_name || ""}, ${
              pr.bank_account?.account_number || ""
            }`}
          />
          <Info label="Currency" value={pr.currency} />
          <Info
            label="Tanggal"
            value={
              pr.created_at
                ? new Date(pr.created_at).toLocaleDateString("id-ID", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })
                : "-"
            }
          />
        </div>
      </div>

      <Card>
        <SectionItems
          items={pr.items}
          onAdd={() => setShowAddItem(true)}
          onEdit={setEditItem}
          onDelete={(id) => mDeleteItem.mutate(id)}
        />
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card className="col-span-1">
          <SectionBalances
            balances={pr.balances}
            onAdd={() => setShowAddBalance(true)}
            onEdit={setEditBalance}
            onDelete={(id) => mDeleteBalance.mutate(id)}
          />
        </Card>

        <Card className="col-span-1 flex justify-end items-end">
          <div className="w-96 text-sm space-y-2">
            <Row label="Total Tagihan" value={totals.amount} />
            <Row label="Total Potongan" value={totals.deduction} />
            <Row label="Total Transfer" value={totals.transfer} bold />
          </div>
        </Card>
      </div>

      <ItemModal
        open={showAddItem}
        title="Tambah Item"
        payees={payees}
        coas={coas}
        onClose={() => setShowAddItem(false)}
        onSubmit={(data) => mCreateItem.mutate(data)}
      />

      <ItemModal
        open={!!editItem}
        title="Edit Item"
        payees={payees}
        coas={coas}
        initial={editItem}
        onClose={() => setEditItem(null)}
        onSubmit={(data) =>
          mUpdateItem.mutate({ itemId: editItem.id, payload: data })
        }
      />

      <BalanceModal
        open={showAddBalance}
        title="Tambah Rekening"
        bankAccounts={bankAccounts}
        onClose={() => setShowAddBalance(false)}
        onSubmit={(data) => mCreateBalance.mutate(data)}
      />

      <BalanceModal
        open={!!editBalance}
        title="Edit Rekening"
        bankAccounts={bankAccounts}
        initial={editBalance}
        onClose={() => setEditBalance(null)}
        onSubmit={(data) =>
          mUpdateBalance.mutate({ balanceId: editBalance.id, payload: data })
        }
      />
    </div>
  );
}

/* ================= UI HELPERS ================= */

function HeaderBtn({ icon, label, onClick }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-100"
    >
      {icon} {label}
    </button>
  );
}

function Card({ children, className = "" }) {
  return (
    <div className={`bg-white p-4 rounded-xl shadow border ${className}`}>
      {children}
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="font-medium">{value || "-"}</div>
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span>{label}</span>
      <span>{fmtIDR(value)}</span>
    </div>
  );
}

/* ================= SECTIONS ================= */

function SectionItems({ items, onAdd, onEdit, onDelete }) {
  return (
    <div className="space-y-3">
      <div className="flex justify-between items-center">
        <b>Items</b>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-sm"
        >
          <Plus size={16} /> Tambah Item
        </button>
      </div>

      <div className="overflow-auto">
        <table className="w-full text-sm border border-collapse">
          <thead className="bg-gray-100 text-xs uppercase">
            <tr>
              <th className="border px-2 py-2 text-left">Payee</th>
              <th className="border px-2 py-2 text-left">COA</th>
              <th className="border px-2 py-2 text-left">Sub COA</th>
              <th className="border px-2 py-2 text-right">Jumlah Tagihan</th>
              <th className="border px-2 py-2 text-right">Potongan</th>
              <th className="border px-2 py-2 text-right">Jumlah Transfer</th>
              <th className="border px-2 py-2 text-left">Keterangan</th>
              <th className="border px-2 py-2"></th>
            </tr>
          </thead>
          <tbody>
            {items.map((i) => (
              <tr key={i.id} className="hover:bg-gray-50">
                <td className="border px-2 py-1">{i.payee?.payee}</td>
                <td className="border px-2 py-1">{i.coa?.coa}</td>
                <td className="border px-2 py-1">{i.coa?.sub_coa || "-"}</td>
                <td className="border px-2 py-1 text-right">
                  {fmtIDR(i.amount)}
                </td>
                <td className="border px-2 py-1 text-right">
                  {fmtIDR(i.deduction)}
                </td>
                <td className="border px-2 py-1 text-right">
                  {fmtIDR(i.transfer_amount)}
                </td>
                <td className="border px-2 py-1 text-xs">
                  {i.remark ||
                    [i.payee?.bank_name, i.payee?.account_number, i.payee?.account_name]
                      .filter(Boolean)
                      .join(", ")}
                </td>
                <td className="border px-2 py-1">
                  <div className="flex gap-2">
                    <button onClick={() => onEdit(i)}>
                      <Edit size={14} />
                    </button>
                    <button onClick={() => onDelete(i.id)}>
                      <Trash2 size={14} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionBalances({ balances, onAdd, onEdit, onDelete }) {
  return (
    <div className="space-y-3 text-sm">
      <div className="flex justify-between items-center">
        <b>Saldo Rekening</b>
        <button
          onClick={onAdd}
          className="flex items-center gap-1 px-2 py-1 bg-blue-600 text-white rounded text-xs"
        >
          <Plus size={14} /> Tambah
        </button>
      </div>

      <table className="w-full border border-collapse">
        <thead className="bg-gray-100 text-xs">
          <tr>
            <th className="border px-2 py-2 text-left">Bank & Rekening</th>
            <th className="border px-2 py-2 text-left">Saldo</th>
            <th className="border px-2 py-2"></th>
          </tr>
        </thead>
        <tbody>
          {balances.map((b) => (
            <tr key={b.id}>
              <td className="border px-2 py-1">
                {b.bank_account?.bank_name} {b.bank_account?.account_type}, {b.bank_account?.account_number}
              </td>
              <td className="border px-2 py-1 text-right">{fmtIDR(b.saldo)}</td>
              <td className="border px-2 py-1">
                <div className="flex gap-2">
                  <button onClick={() => onEdit(b)}>
                    <Edit size={14} />
                  </button>
                  <button onClick={() => onDelete(b.id)}>
                    <Trash2 size={14} />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ================= MODALS ================= */

function ItemModal({ open, title, onClose, onSubmit, payees, coas, initial }) {
  const [form, setForm] = useState({
    payee_id: "",
    coa_id: "",
    amount: 0,
    deduction: 0,
    transfer_amount: 0,
    remark: "",
  });

  useEffect(() => {
    if (!open) return;
    if (initial) setForm(initial);
    else
      setForm({
        payee_id: "",
        coa_id: "",
        amount: 0,
        deduction: 0,
        transfer_amount: 0,
        remark: "",
      });
  }, [open, initial]);

  useEffect(() => {
    setForm((f) => ({
      ...f,
      transfer_amount: Number(f.amount) - Number(f.deduction),
    }));
  }, [form.amount, form.deduction]);

  const handlePayeeChange = (id) => {
    const p = payees.find((x) => x.id === Number(id));
    const remark = p
      ? [p.bank_name, p.account_number, p.account_name].filter(Boolean).join(" / ")
      : "";

    setForm((f) => ({
      ...f,
      payee_id: Number(id),
      remark,
    }));
  };

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1 border rounded">
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                payee_id: Number(form.payee_id),
                coa_id: Number(form.coa_id),
                amount: Number(form.amount),
                deduction: Number(form.deduction),
                transfer_amount: Number(form.transfer_amount),
                remark: form.remark,
              })
            }
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div>
          <div className="text-xs text-gray-600 mb-1">Payee</div>
          <select
            value={form.payee_id}
            onChange={(e) => handlePayeeChange(e.target.value)}
            className="w-full border p-2 rounded"
          >
            <option value="">Pilih Payee</option>
            {payees.map((p) => (
              <option key={p.id} value={p.id}>
                {p.payee}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="text-xs text-gray-600 mb-1">COA</div>
          <select
            value={form.coa_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, coa_id: Number(e.target.value) }))
            }
            className="w-full border p-2 rounded"
          >
            <option value="">Pilih COA</option>
            {coas.map((c) => (
              <option key={c.id} value={c.id}>
                {c.coa}
              </option>
            ))}
          </select>
        </div>

        <div>
          <div className="grid grid-cols-3 gap-3">
            {/* Jumlah Tagihan */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Jumlah Tagihan</div>
              <input
                type="number"
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>

            {/* Potongan */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Potongan</div>
              <input
                type="number"
                value={form.deduction}
                onChange={(e) => setForm({ ...form, deduction: e.target.value })}
                className="border p-2 rounded w-full"
              />
            </div>

            {/* Jumlah Transfer */}
            <div>
              <div className="text-xs text-gray-500 mb-1">Jumlah Transfer</div>
              <input
                readOnly
                value={form.transfer_amount}
                className="border p-2 bg-gray-100 rounded w-full"
              />
            </div>
          </div>
        </div>
        <div>
          <div className="text-xs text-gray-600 mb-1">Keterangan</div>
          <input
            value={form.remark}
            readOnly
            className="w-full border p-2 rounded bg-gray-100"
          />
        </div>
      </div>
    </Modal>
  );
}

function BalanceModal({ open, title, onClose, onSubmit, bankAccounts, initial }) {
  const [form, setForm] = useState({ bank_account_id: "", saldo: 0 });

  useEffect(() => {
    if (!open) return;
    if (initial) setForm(initial);
    else setForm({ bank_account_id: "", saldo: 0 });
  }, [open, initial]);

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <button onClick={onClose} className="px-3 py-1 border rounded">
            Cancel
          </button>
          <button
            onClick={() => onSubmit({ ...form, saldo: Number(form.saldo) })}
            className="px-3 py-1 bg-blue-600 text-white rounded"
          >
            Save
          </button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <select
          value={form.bank_account_id}
          onChange={(e) =>
            setForm({ ...form, bank_account_id: Number(e.target.value) })
          }
          className="w-full border p-2 rounded"
        >
          <option value="">Pilih Rekening</option>
          {bankAccounts.map((b) => (
            <option key={b.id} value={b.id}>
              {b.bank_name} - {b.account_number}
            </option>
          ))}
        </select>

        <input
          type="number"
          value={form.saldo}
          onChange={(e) => setForm({ ...form, saldo: e.target.value })}
          className="w-full border p-2 rounded"
        />
      </div>
    </Modal>
  );
}
