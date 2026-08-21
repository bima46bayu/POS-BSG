import React, { useEffect, useMemo, useRef, useState } from "react";
import { rupiah } from "../../lib/fmt";
import { useQuery } from "@tanstack/react-query";
import { UserPlus, X, Search, Sparkles, Loader2 } from "lucide-react";

import { lookupMembers, pointsForAmount } from "../../api/members";


/**
 * Member picker for the POS checkout.
 *
 * Search covers phone, name and member code. Once a member is attached we show
 * the points this basket will earn, computed with the same floor-division the
 * server uses so the cashier is never shown a number that later changes.
 */
export default function MemberPicker({
  storeLocationId,
  value, // selected member object (or null)
  onChange,
  total = 0,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState("");
  const [debounced, setDebounced] = useState("");
  const boxRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => setDebounced(term.trim()), 300);
    return () => clearTimeout(t);
  }, [term]);

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setTerm("");
    }
  }, [disabled]);

  // Close the dropdown when clicking elsewhere.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const { data, isFetching } = useQuery({
    queryKey: ["member-lookup", storeLocationId, debounced],
    enabled: !disabled && open,
    queryFn: ({ signal }) =>
      lookupMembers(
        {
          ...(storeLocationId != null
            ? { store_location_id: storeLocationId }
            : {}),
          search: debounced || undefined,
        },
        signal
      ),
    staleTime: 15_000,
  });

  const items = data?.items ?? [];
  const rate = data?.rate ?? 0;
  const loyaltyOn = data?.enabled !== false;

  // Points the current basket would earn for the attached member.
  const earning = useMemo(() => {
    if (!value || !loyaltyOn || !rate) return 0;
    return pointsForAmount(total, rate);
  }, [value, loyaltyOn, rate, total]);

  const pick = (m) => {
    onChange?.(m);
    setOpen(false);
    setTerm("");
  };

  /* ---------- attached state ---------- */
  if (value) {
    return (
      <div className="mt-3">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Member
        </label>

        <div className="rounded-2xl border border-blue-200 bg-blue-50 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
              {String(value.name || "?").charAt(0).toUpperCase()}
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-blue-900 truncate">
                {value.name}
              </div>
              <div className="text-[11px] text-blue-700">
                {value.code}
                {value.phone ? ` · ${value.phone}` : ""}
              </div>
            </div>

            <div className="text-right shrink-0">
              <div className="inline-flex items-center gap-1 text-xs font-bold text-amber-700">
                <Sparkles className="w-3 h-3" />
                {Number(value.points_balance || 0).toLocaleString("id-ID")}
              </div>
              <div className="text-[10px] text-blue-600">poin</div>
            </div>

            <button
              type="button"
              onClick={() => onChange?.(null)}
              title="Lepas member"
              disabled={disabled}
              className="ml-1 p-1 rounded-full text-blue-400 hover:text-blue-700 hover:bg-blue-100 shrink-0 disabled:opacity-40 disabled:pointer-events-none"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {loyaltyOn && rate > 0 && (
            <div className="mt-2 pt-2 border-t border-blue-200 text-[11px] text-blue-800">
              {earning > 0 ? (
                <>
                  Transaksi ini menambah <b>{earning} poin</b>{" "}
                  <span className="text-blue-600">
                    ({rupiah(rate)} = 1 poin)
                  </span>
                </>
              ) : (
                <>
                  Belum genap 1 poin — minimal belanja {rupiah(rate)}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  /* ---------- search state ---------- */
  return (
    <div className="mt-3" ref={boxRef}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        Member (opsional)
      </label>

      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          disabled={disabled || storeLocationId == null}
          className="w-full h-11 flex items-center justify-center gap-2 rounded-full border border-dashed border-gray-300 text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 disabled:bg-gray-100 disabled:text-gray-400 disabled:hover:border-gray-300 disabled:hover:text-gray-400 disabled:cursor-not-allowed disabled:opacity-100"
        >
          <UserPlus className="w-4 h-4" />
          Pasang Member
        </button>
      ) : (
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              autoFocus
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="No. HP / nama / kode member"
              className="w-full h-11 rounded-full border border-gray-300 pl-9 pr-9 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {isFetching ? (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
            ) : (
              <button
                type="button"
                onClick={() => {
                  setOpen(false);
                  setTerm("");
                }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border bg-white shadow-lg">
            {items.length === 0 ? (
              <div className="px-3 py-4 text-center text-xs text-gray-500">
                {isFetching
                  ? "Mencari..."
                  : debounced
                  ? "Member tidak ditemukan. Daftarkan dulu di Master → Member & Customer."
                  : "Belum ada member."}
              </div>
            ) : (
              <>
                {!debounced && (
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                    Pelanggan terakhir
                  </div>
                )}
                {items.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => pick(m)}
                    className="w-full flex items-center gap-2 px-3 py-2 hover:bg-blue-50 text-left"
                  >
                    <div className="w-7 h-7 rounded-full bg-gray-100 text-gray-600 flex items-center justify-center text-[11px] font-bold shrink-0">
                      {String(m.name || "?").charAt(0).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">
                        {m.name}
                      </div>
                      <div className="text-[11px] text-gray-500">
                        {m.code}
                        {m.phone ? ` · ${m.phone}` : ""}
                      </div>
                    </div>
                    <div className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 shrink-0">
                      <Sparkles className="w-3 h-3" />
                      {Number(m.points_balance || 0).toLocaleString("id-ID")}
                    </div>
                  </button>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
