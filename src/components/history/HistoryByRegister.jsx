import React, { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { listRegisterSessions, getRegisterSession } from "../../api/registerSessions";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { RegisterSummaryModal } from "../pos/RegisterModals";

function formatDateTime(s) {
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
    return String(s);
  }
}

export default function HistoryByRegister() {
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  const sessionsQ = useQuery({
    queryKey: ["register-sessions", { page }],
    queryFn: ({ signal }) =>
      listRegisterSessions({ page, per_page: 20 }, signal),
    keepPreviousData: true,
  });

  const summaryQ = useQuery({
    queryKey: ["register-session", selectedId],
    queryFn: ({ signal }) =>
      selectedId ? getRegisterSession(selectedId, signal) : null,
    enabled: !!selectedId,
  });

  useEffect(() => {
    if (sessionsQ.data?.current_page && sessionsQ.data.current_page !== page) {
      setPage(sessionsQ.data.current_page);
    }
  }, [sessionsQ.data, page]);

  const items = sessionsQ.data?.data || sessionsQ.data?.items || [];
  const meta =
    sessionsQ.data?.meta ||
    (sessionsQ.data && {
      current_page: sessionsQ.data.current_page ?? page,
      last_page: sessionsQ.data.last_page ?? page,
    }) ||
    { current_page: page, last_page: page };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-5 h-5 text-blue-600" />
          <h3 className="text-sm font-semibold text-gray-800">
            Register Sessions
          </h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <button
            type="button"
            className="h-7 w-7 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-40"
            disabled={meta.current_page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>
            Page {meta.current_page} / {meta.last_page}
          </span>
          <button
            type="button"
            className="h-7 w-7 rounded-full border border-gray-300 flex items-center justify-center disabled:opacity-40"
            disabled={meta.current_page >= meta.last_page}
            onClick={() =>
              setPage((p) => (meta.last_page ? Math.min(meta.last_page, p + 1) : p + 1))
            }
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="border rounded-xl overflow-hidden">
        <table className="min-w-full text-xs">
          <thead className="bg-gray-100 text-gray-600">
            <tr>
              <th className="px-3 py-2 text-left">Session</th>
              <th className="px-3 py-2 text-left">Opened</th>
              <th className="px-3 py-2 text-left">Closed</th>
              <th className="px-3 py-2 text-left">Cashier</th>
              <th className="px-3 py-2 text-left">Store</th>
              <th className="px-3 py-2 text-right">Total Sales</th>
              <th className="px-3 py-2 text-right">Expected Cash</th>
              <th className="px-3 py-2 text-right">Difference</th>
            </tr>
          </thead>
          <tbody>
            {items && items.length > 0 ? (
              items.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-gray-100 cursor-pointer hover:bg-blue-50/40"
                  onClick={() => setSelectedId(s.id)}
                >
                  <td className="px-3 py-2">
                    <div className="font-mono text-[11px]">#{s.id}</div>
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {formatDateTime(s.opened_at)}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {formatDateTime(s.closed_at)}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {s.cashier?.name || s.cashier_name || "-"}
                  </td>
                  <td className="px-3 py-2 text-[11px]">
                    {s.store_location?.name || s.store_name || "-"}
                  </td>
                  <td className="px-3 py-2 text-right">
                    Rp{Number(s.total_sales ?? 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    Rp{Number(s.expected_cash ?? 0).toLocaleString("id-ID")}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span
                      className={
                        "font-semibold " +
                        ((s.difference ?? 0) < 0
                          ? "text-red-600"
                          : (s.difference ?? 0) > 0
                          ? "text-emerald-600"
                          : "text-gray-700")
                      }
                    >
                      Rp{Number(s.difference ?? 0).toLocaleString("id-ID")}
                    </span>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={8}
                  className="px-3 py-4 text-center text-gray-500"
                >
                  Tidak ada data register.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedId && summaryQ.data && (
        <RegisterSummaryModal
          open={!!summaryQ.data}
          onClose={() => setSelectedId(null)}
          data={summaryQ.data}
          isClosed={true}
          closing={false}
          onCloseRegister={() => {}}
        />
      )}
    </div>
  );
}
