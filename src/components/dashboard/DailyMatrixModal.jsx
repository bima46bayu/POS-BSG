// src/components/dashboard/DailyMatrixModal.jsx
import React from "react";
import { X as XIcon, ChevronDown as ChevronDownIcon, ChevronRight } from "lucide-react";
import SimpleTable from "./SimpleTable";
import { IDR, N, formatDate, payBadgeClass, methodLabel, normMethodKey } from "../../lib/fmt";

export default function DailyMatrixModal({ open, onClose, dates, byDay, dailyRevenue }) {
  const [openKeys, setOpenKeys] = React.useState(() => new Set());
  React.useEffect(() => { if (!open) setOpenKeys(new Set()); }, [open]);

  const toggle = (key) => {
    setOpenKeys((prev) => {
      const n = new Set(prev);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-[201] bg-white w-full max-w-5xl rounded-2xl border border-slate-200 shadow-xl">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Matriks Harian (Periode Terpilih)</h3>
          <button onClick={onClose} className="p-2 rounded-md hover:bg-slate-100" title="Tutup">
            <XIcon className="w-5 h-5 text-slate-600" />
          </button>
        </div>

        <div className="max-h-[70vh] overflow-auto divide-y divide-slate-100">
          {dates.map((d) => {
            const list = (byDay.get(d) || []).filter(x => String(x?.status || "").toLowerCase() !== "void");
            const rev = dailyRevenue.get(d) || 0;
            const isOpen = openKeys.has(d);

            return (
              <div key={d}>
                <button onClick={() => toggle(d)} className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50">
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDownIcon className="w-4 h-4 text-slate-600" /> : <ChevronRight className="w-4 h-4 text-slate-600" />}
                    <div className="text-left">
                      <div className="text-sm font-semibold text-slate-900">
                        {formatDate(d)} <span className="text-slate-500">({d})</span>
                      </div>
                      <div className="text-xs text-slate-600">
                        Total Transaksi: <span className="font-semibold">{list.length.toLocaleString("id-ID")}</span> • Total Revenue: <span className="font-semibold">{IDR(rev)}</span>
                      </div>
                    </div>
                  </div>
                </button>

                {isOpen && (
                  <div className="px-5 pb-5">
                    <SimpleTable
                      columns={[
                        { key: "code", label: "Invoice", render: (_, row) => <span className="font-semibold text-blue-600">{row.code || row.id}</span> },
                        { key: "created_at", label: "Waktu", render: (v) => new Date(v).toLocaleString("id-ID", { hour: "2-digit", minute: "2-digit" }) },
                        { key: "status", label: "Status", render: (v) => (
                          <span className={`text-xs px-2 py-1 rounded-full border ${
                            String(v).toLowerCase() === "void"
                              ? "bg-red-50 text-red-700 border-red-200"
                              : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          }`}>
                            {String(v).toLowerCase() === "void" ? "Void" : "Completed"}
                          </span>
                        )},
                        { key: "total", label: "Total", align: "right", render: (v) => IDR(N(v)) },
                        { key: "payments", label: "Metode", render: (_, row) => {
                          const pays = Array.isArray(row?.payments) ? row.payments : [];
                          if (!pays.length) {
                            // fallback: anggap cash
                            return (
                              <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${payBadgeClass("cash")}`}>
                                Cash
                              </span>
                            );
                          }
                          const uniq = [...new Set(pays.map(p => normMethodKey(p?.method)))].filter(Boolean);
                          return (
                            <div className="flex flex-wrap gap-1">
                              {uniq.map((k, i) => (
                                <span key={`${k}-${i}`} className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${payBadgeClass(k)}`}>
                                  {methodLabel(k)}
                                </span>
                              ))}
                            </div>
                          );
                        }},
                      ]}
                      data={[...list].sort((a, b) => (a.created_at > b.created_at ? -1 : 1))}
                      emptyMessage="Tidak ada transaksi pada hari ini"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <div className="px-5 py-3 border-t text-xs text-slate-500">
          Klik baris hari untuk membuka/menutup detail transaksi.
        </div>
      </div>
    </div>
  );
}
