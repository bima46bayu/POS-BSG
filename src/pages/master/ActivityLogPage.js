import React, { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { RefreshCw, ScrollText, Search } from "lucide-react";

import { listActivityLogs } from "../../api/activityLogs";

function fmtWhen(v) {
  if (!v) return "—";
  try {
    return new Date(v).toLocaleString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return String(v);
  }
}

function actorBadge(type) {
  if (type === "member") return "bg-violet-50 text-violet-700";
  if (type === "guest") return "bg-gray-100 text-gray-600";
  return "bg-blue-50 text-blue-700";
}

export default function ActivityLogPage() {
  const [search, setSearch] = useState("");
  const [actorType, setActorType] = useState("");
  const [page, setPage] = useState(1);

  const logsQ = useQuery({
    queryKey: ["activity-logs", search, actorType, page],
    queryFn: ({ signal }) =>
      listActivityLogs(
        {
          per_page: 30,
          page,
          search: search || undefined,
          actor_type: actorType || undefined,
        },
        signal
      ),
    staleTime: 0,
    refetchOnMount: "always",
    refetchInterval: 5_000,
  });

  const rows = useMemo(() => {
    const payload = logsQ.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
  }, [logsQ.data]);

  const lastPage = logsQ.data?.last_page ?? 1;
  const total = logsQ.data?.total ?? rows.length;

  const loading = logsQ.isPending || (logsQ.isFetching && rows.length === 0);

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex items-start gap-3">
          <div className="rounded-lg bg-blue-50 p-2.5 text-blue-700">
            <ScrollText className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Activity Log</h1>
            <p className="mt-1 text-sm text-gray-600">
              Jejak aktivitas staff dan member: login, penjualan, produk,
              inventory, hadiah, dan perubahan master. Hanya admin HQ yang
              dapat membuka halaman ini.
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Cari nama, aksi, atau path"
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <select
            value={actorType}
            onChange={(e) => {
              setActorType(e.target.value);
              setPage(1);
            }}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Semua actor</option>
            <option value="staff">Staff</option>
            <option value="member">Member</option>
            <option value="guest">Guest</option>
          </select>
          <button
            type="button"
            onClick={() => logsQ.refetch()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${logsQ.isFetching ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Waktu</th>
                <th className="px-4 py-3">Actor</th>
                <th className="px-4 py-3">Aksi</th>
                <th className="px-4 py-3">Path</th>
              </tr>
            </thead>
            <tbody>
              {logsQ.isError && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-red-600">
                    Gagal memuat activity log.
                  </td>
                </tr>
              )}
              {!logsQ.isError && rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                    {loading
                      ? "Memuat…"
                      : "Belum ada aktivitas tercatat."}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-gray-100 align-top">
                  <td className="whitespace-nowrap px-4 py-3 text-gray-600">
                    {fmtWhen(row.created_at)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-gray-900">
                      {row.actor_name || "—"}
                    </div>
                    <span
                      className={`mt-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${actorBadge(
                        row.actor_type
                      )}`}
                    >
                      {row.actor_role || row.actor_type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800">
                    {row.description}
                    {row.status_code && row.status_code !== 200 ? (
                      <span className="ml-2 text-xs text-gray-400">
                        {row.status_code}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-500">
                    {row.method} {row.path}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {lastPage > 1 && (
          <div className="mt-3 flex items-center justify-between text-sm text-gray-600">
            <span>{total} catatan</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-1 py-1.5">
                {page} / {lastPage}
              </span>
              <button
                type="button"
                disabled={page >= lastPage}
                onClick={() => setPage((p) => p + 1)}
                className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
