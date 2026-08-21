import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gift, Sparkles } from "lucide-react";
import toast from "react-hot-toast";

import { listLoyaltyRewards, redeemLoyaltyReward } from "../api/loyaltyRewards";
import { getMe } from "../api/users";
import { toAbsoluteUrl } from "../api/client";
import MemberPicker from "../components/pos/MemberPicker";
import ConfirmDialog from "../components/common/ConfirmDialog";

function homeStoreId(me) {
  return me?.store_location_id ?? me?.store_location?.id ?? null;
}

export default function MemberStorePage() {
  const qc = useQueryClient();
  const [me, setMe] = useState(null);
  const [member, setMember] = useState(null);
  const [pending, setPending] = useState(null);

  useEffect(() => {
    getMe().then(setMe).catch(() => setMe(null));
  }, []);

  const storeId = homeStoreId(me);

  const rewardsQ = useQuery({
    queryKey: ["loyalty-rewards-store", storeId],
    queryFn: ({ signal }) =>
      listLoyaltyRewards(
        {
          ...(storeId ? { store_location_id: storeId } : {}),
          active_only: 1,
          per_page: 100,
        },
        signal
      ),
  });

  const redeem = useMutation({
    mutationFn: () =>
      redeemLoyaltyReward(pending.id, {
        member_id: member.id,
        ...(storeId ? { store_location_id: storeId } : {}),
      }),
    onSuccess: (data) => {
      toast.success(`Tukar ${pending.product?.name || pending.name} berhasil`);
      setMember(data.member || { ...member, points_balance: data.member?.points_balance });
      setPending(null);
      qc.invalidateQueries({ queryKey: ["loyalty-rewards-store"] });
    },
    onError: (e) =>
      toast.error(e?.response?.data?.message || "Gagal menukar poin"),
  });

  const rewards = rewardsQ.data?.items || [];
  const balance = Number(member?.points_balance || 0);

  const sorted = useMemo(
    () => [...rewards].sort((a, b) => Number(a.points_cost) - Number(b.points_cost)),
    [rewards]
  );

  return (
    <div className="p-4 md:p-6 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-800">Member Store</h1>
        <p className="text-sm text-gray-500">
          Tukar poin member dengan produk. Kartu, poin, dan katalog sama di
          semua cabang.
        </p>
      </div>

      <div className="max-w-md">
        <MemberPicker
          storeLocationId={storeId}
          value={member}
          total={0}
          onChange={setMember}
        />
      </div>

      {member && (
        <div className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-800">
          <Sparkles size={14} />
          Saldo {balance.toLocaleString("id-ID")} poin
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {sorted.map((r) => {
          const cost = Number(r.points_cost || 0);
          const product = r.product;
          const name = product?.name || r.name;
          const img = product?.image_url ? toAbsoluteUrl(product.image_url) : null;
          const tracked = product?.inventory_type !== "non_stock";
          const stock = Number(product?.stock ?? 0);
          const inStock = !storeId || !tracked || stock >= 1;
          const canAfford = member && balance >= cost;
          const canRedeem = canAfford && inStock;
          return (
            <div
              key={r.id}
              className="flex flex-col rounded-2xl border bg-white p-4 shadow-sm"
            >
              <div className="flex items-start gap-3">
                {img ? (
                  <img
                    src={img}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover bg-gray-100"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-violet-100 text-violet-700">
                    <Gift size={18} />
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-semibold text-gray-800">{name}</div>
                  {product?.sku && (
                    <div className="text-xs text-gray-400">SKU {product.sku}</div>
                  )}
                  {r.description && (
                    <div className="text-sm text-gray-500">{r.description}</div>
                  )}
                  {storeId && tracked && (
                    <div className={`text-xs ${inStock ? "text-gray-500" : "text-rose-600"}`}>
                      Stok {stock.toLocaleString("id-ID")}
                    </div>
                  )}
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-sm font-bold text-amber-700">
                  {cost.toLocaleString("id-ID")} poin
                </span>
                <button
                  type="button"
                  disabled={!canRedeem || redeem.isPending}
                  onClick={() => setPending(r)}
                  className="rounded-full bg-violet-600 px-3 py-1.5 text-sm text-white hover:bg-violet-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                >
                  {!member
                    ? "Pilih member"
                    : !inStock
                      ? "Stok habis"
                      : canAfford
                        ? "Tukar"
                        : "Poin kurang"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {!rewardsQ.isLoading && sorted.length === 0 && (
        <p className="text-sm text-gray-500">
          Belum ada produk redeem. Tambahkan di Setup → Point Rewards.
        </p>
      )}

      <ConfirmDialog
        open={!!pending}
        title="Tukar poin?"
        message={
          pending
            ? `Tukar ${pending.points_cost} poin milik ${member?.name || "member"} dengan “${pending.product?.name || pending.name}”?`
            : ""
        }
        confirmText="Tukar"
        variant="primary"
        loading={redeem.isPending}
        onClose={() => setPending(null)}
        onConfirm={() => redeem.mutate()}
      />
    </div>
  );
}
