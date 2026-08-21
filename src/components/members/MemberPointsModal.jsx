import React, { useState } from "react";
import { X, History, Plus, Minus } from "lucide-react";
import toast from "react-hot-toast";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  adjustMemberPoints,
  listMemberPointHistory,
} from "../../api/members";

const fmtDateTime = (v) => {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
};

const TYPE_LABEL = {
  EARN: { text: "Dapat poin", cls: "bg-emerald-50 text-emerald-700" },
  REVOKE: { text: "Void", cls: "bg-red-50 text-red-700" },
  ADJUST: { text: "Penyesuaian", cls: "bg-amber-50 text-amber-700" },
  REDEEM: { text: "Tukar poin", cls: "bg-violet-50 text-violet-700" },
  REDEEM_VOID: { text: "Void tukar poin", cls: "bg-red-50 text-red-700" },
};

/**
 * Point balance detail: ledger history + manual correction.
 *
 * The ledger is what makes the balance explainable, so it is shown first and the
 * manual adjustment is secondary.
 */
export default function MemberPointsModal({ open, member, onClose }) {
  const qc = useQueryClient();

  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");

  const memberId = member?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["member-points", memberId],
    enabled: open && !!memberId,
    queryFn: ({ signal }) =>
      listMemberPointHistory(memberId, { per_page: 50 }, signal),
  });

  const mAdjust = useMutation({
    mutationFn: ({ points, note: n }) =>
      adjustMemberPoints(memberId, points, n),
    onSuccess: () => {
      toast.success("Poin disesuaikan");
      setDelta("");
      setNote("");
      qc.invalidateQueries({ queryKey: ["member-points", memberId] });
      qc.invalidateQueries({ queryKey: ["members"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal menyesuaikan poin"),
  });

  if (!open || !member) return null;

  const apply = (sign) => {
    const n = Math.abs(Number(delta || 0));
    if (!n) {
      toast.error("Isi jumlah poin dulu");
      return;
    }
    mAdjust.mutate({ points: sign * n, note: note.trim() || undefined });
  };

  const rows = data?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-4xl bg-white rounded-xl shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h3 className="font-semibold flex items-center gap-2">
              <History className="w-4 h-4 text-gray-400" />
              Poin — {member.name}
            </h3>
            <div className="text-xs text-gray-500 mt-0.5">
              {member.code}
              {member.phone ? ` · ${member.phone}` : ""}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Balance summary */}
        <div className="grid grid-cols-3 gap-3 px-5 py-4 border-b bg-gray-50">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Saldo Poin
            </div>
            <div className="text-2xl font-bold text-blue-700">
              {Number(member.points_balance || 0).toLocaleString("id-ID")}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Total Kunjungan
            </div>
            <div className="text-lg font-semibold">
              {Number(member.visit_count || 0).toLocaleString("id-ID")}
            </div>
          </div>
          <div>
            <div className="text-[11px] uppercase tracking-wide text-gray-500">
              Total Belanja
            </div>
            <div className="text-lg font-semibold">
              Rp {Number(member.total_spend || 0).toLocaleString("id-ID")}
            </div>
          </div>
        </div>

        {/* Manual adjustment */}
        <div className="px-5 py-3 border-b">
          <div className="text-sm font-medium mb-2">Penyesuaian Manual</div>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              value={delta}
              onChange={(e) => setDelta(e.target.value)}
              placeholder="Jumlah poin"
              className="h-9 w-32 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Alasan (opsional)"
              className="h-9 flex-1 min-w-[160px] rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={() => apply(1)}
              disabled={mAdjust.isPending}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-emerald-600 text-white text-sm disabled:opacity-50"
            >
              <Plus className="w-4 h-4" />
              Tambah
            </button>
            <button
              onClick={() => apply(-1)}
              disabled={mAdjust.isPending}
              className="inline-flex items-center gap-1 h-9 px-3 rounded-lg bg-red-500 text-white text-sm disabled:opacity-50"
            >
              <Minus className="w-4 h-4" />
              Kurangi
            </button>
          </div>
        </div>

        {/* Ledger */}
        <div className="flex-1 overflow-y-auto px-5 py-3">
          <div className="text-sm font-medium mb-2">Riwayat Poin</div>

          {isLoading ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              Memuat...
            </div>
          ) : rows.length === 0 ? (
            <div className="text-sm text-gray-500 py-6 text-center">
              Belum ada riwayat poin.
            </div>
          ) : (
            <div className="space-y-1.5">
              {rows.map((r) => {
                const meta = TYPE_LABEL[r.type] || {
                  text: r.type,
                  cls: "bg-gray-100 text-gray-700",
                };
                const pts = Number(r.points || 0);

                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-lg border px-3 py-2"
                  >
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${meta.cls}`}
                    >
                      {meta.text}
                    </span>

                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-700 truncate">
                        {r.sale?.code
                          ? `Transaksi ${r.sale.code}`
                          : r.note || "—"}
                      </div>
                      <div className="text-[11px] text-gray-400">
                        {fmtDateTime(r.created_at)}
                        {r.rate_per_point
                          ? ` · Rp ${Number(
                              r.rate_per_point
                            ).toLocaleString("id-ID")}/poin`
                          : ""}
                      </div>
                    </div>

                    <div
                      className={`text-sm font-bold ${
                        pts >= 0 ? "text-emerald-600" : "text-red-500"
                      }`}
                    >
                      {pts >= 0 ? "+" : ""}
                      {pts}
                    </div>
                    <div className="text-[11px] text-gray-400 w-14 text-right">
                      → {r.balance_after}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
