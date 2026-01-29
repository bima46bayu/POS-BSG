import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Calendar, Check, Loader2 } from "lucide-react";
import { getSubcategoryMonthlyReport } from "../../api/categories";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const rupiah = (n) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  }).format(n || 0);

function calcTotal(rows) {
  return rows.reduce(
    (acc, r) => {
      acc.products += r.products;
      acc.revenue += r.revenue;
      return acc;
    },
    { products: 0, revenue: 0 }
  );
}

export default function HistoryBySubcategoryMonth() {
  const [openMonths, setOpenMonths] = useState([]);

  const [availableYears, setAvailableYears] = useState([]);
  const [year, setYear] = useState(null);
  const [yearOpen, setYearOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [grouped, setGrouped] = useState({});

  // ===== load report from backend (aggregated) =====
  useEffect(() => {
    let ignore = false;

    async function load() {
      try {
        setLoading(true);

        const res = await getSubcategoryMonthlyReport(year ? { year } : {});
        if (ignore) return;

        const reportYear = res?.year ?? null;
        const data = res?.data || {};
        const yearsFromBE = Array.isArray(res?.available_years)
          ? res.available_years
          : [];

        // set available years from backend
        if (yearsFromBE.length) {
          setAvailableYears(yearsFromBE);

          // auto select first year if not selected yet
          if (!year) {
            setYear(yearsFromBE[0]);
            return; // tunggu reload effect
          }
        } else if (reportYear && availableYears.length === 0) {
          // fallback kalau backend belum kirim available_years
          setAvailableYears([reportYear]);
          if (!year) {
            setYear(reportYear);
            return;
          }
        }

        // normalize missing months
        const normalized = {};
        MONTHS.forEach((m) => {
          normalized[m] = Array.isArray(data[m]) ? data[m] : [];
        });

        setGrouped(normalized);
      } catch (e) {
        console.error("Load subcategory monthly failed", e);
      } finally {
        if (!ignore) setLoading(false);
      }
    }

    load();
    return () => {
      ignore = true;
    };
  }, [year]);

  const overallTotal = useMemo(() => {
    return MONTHS.reduce(
      (acc, m) => {
        const rows = grouped[m] || [];
        const t = calcTotal(rows);
        acc.products += t.products;
        acc.revenue += t.revenue;
        return acc;
      },
      { products: 0, revenue: 0 }
    );
  }, [grouped]);

  const toggleMonth = (month) => {
    setOpenMonths((prev) =>
      prev.includes(month) ? prev.filter((m) => m !== month) : [...prev, month]
    );
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-xl font-semibold text-gray-800">Matriks Subcategory Bulanan</h3>
          <p className="text-sm text-gray-500">Ringkasan penjualan per kategori & subkategori setiap bulan</p>
        </div>

        {/* Year dropdown */}
        <div className="relative">
          <button
            onClick={() => setYearOpen((v) => !v)}
            className="flex items-center gap-2 border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white hover:bg-gray-50"
            disabled={!availableYears.length}
          >
            <Calendar className="w-4 h-4 text-gray-500" />
            <span className="font-medium">{year || "-"}</span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition ${yearOpen ? "rotate-180" : ""}`} />
          </button>

          {yearOpen && (
            <div className="absolute right-0 mt-2 w-36 bg-white border border-gray-200 rounded-lg shadow-lg z-10 overflow-hidden">
              {availableYears.map((y) => (
                <button
                  key={y}
                  onClick={() => {
                    setYear(y);
                    setYearOpen(false);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 ${y === year ? "bg-blue-50 text-blue-700" : ""}`}
                >
                  <span>{y}</span>
                  {y === year && <Check className="w-4 h-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" /> Memuat data...
        </div>
      )}

      {!loading && (
        <div className="space-y-3">
          {MONTHS.map((month) => {
            const rows = grouped[month] || [];
            const total = calcTotal(rows);
            const isOpen = openMonths.includes(month);

            return (
              <div key={month} className="rounded-xl border border-gray-200 overflow-hidden">
                <button
                  onClick={() => toggleMonth(month)}
                  className={`w-full px-5 py-4 flex items-center justify-between transition ${isOpen ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100"}`}
                >
                  <div className="flex flex-col text-left">
                    <span className="text-base font-semibold text-gray-800">{month}</span>
                    <span className="text-xs text-gray-500 mt-0.5">{total.products} produk · {rupiah(total.revenue)}</span>
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {isOpen && (
                  <div className="px-5 py-4 bg-white">
                    {rows.length === 0 ? (
                      <div className="text-sm text-gray-400 text-center py-6">Tidak ada data pada bulan ini</div>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-gray-500 border-b">
                              <th className="text-left py-2">Category</th>
                              <th className="text-left py-2">Subcategory</th>
                              <th className="text-right py-2">Produk Terjual</th>
                              <th className="text-right py-2">Pendapatan</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r, idx) => (
                              <tr key={idx} className="border-b last:border-b-0 hover:bg-gray-50">
                                <td className="py-2 text-gray-700">{r.category}</td>
                                <td className="py-2 font-medium text-gray-800">{r.subcategory}</td>
                                <td className="py-2 text-right">{r.products}</td>
                                <td className="py-2 text-right font-semibold">{rupiah(r.revenue)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr className="bg-gray-50 font-semibold border-t">
                              <td className="py-2" colSpan={2}>Total Bulan Ini</td>
                              <td className="py-2 text-right">{total.products}</td>
                              <td className="py-2 text-right text-blue-600">{rupiah(total.revenue)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Overall total */}
      <div className="mt-8 rounded-xl border border-blue-100 bg-blue-50 p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <div className="text-sm text-blue-700">Grand Total {year}</div>
            <div className="text-lg font-semibold text-blue-900">{rupiah(overallTotal.revenue)}</div>
          </div>

          <div className="flex gap-6 text-sm text-blue-800">
            <div>
              <div className="text-xs text-blue-600">Produk</div>
              <div className="font-semibold">{overallTotal.products}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
