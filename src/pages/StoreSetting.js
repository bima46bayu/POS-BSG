// src/pages/StoreSettings.jsx
import React, { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getMyProfile, updateMyStore } from "../api/users";
import toast from "react-hot-toast";

export default function StoreSettings() {
  const qc = useQueryClient();
  const { data: me, isLoading } = useQuery({ queryKey: ["me-store"], queryFn: getMyProfile });

  const [form, setForm] = useState({ name: "", address: "", phone: "" });
  React.useEffect(() => {
    if (me?.store) setForm({ name: me.store.name || "", address: me.store.address || "", phone: me.store.phone || "" });
  }, [me]);

  const { mutate, isPending } = useMutation({
    mutationFn: updateMyStore,
    onSuccess: () => {
      toast.success("Store updated");
      qc.invalidateQueries({ queryKey: ["me-store"] });
    },
    onError: () => toast.error("Gagal update store"),
  });

  if (isLoading) return <div className="p-4">Memuat…</div>;

  return (
    <div className="p-6">
      <h1 className="text-lg font-semibold mb-4">Store Settings</h1>
      <div className="grid gap-3 max-w-lg">
        <input className="border rounded-lg px-3 py-2" placeholder="Nama Toko"
          value={form.name} onChange={(e)=>setForm(s=>({...s,name:e.target.value}))} />
        <textarea className="border rounded-lg px-3 py-2" rows={3} placeholder="Alamat"
          value={form.address} onChange={(e)=>setForm(s=>({...s,address:e.target.value}))} />
        <input className="border rounded-lg px-3 py-2" placeholder="No. Telepon"
          value={form.phone} onChange={(e)=>setForm(s=>({...s,phone:e.target.value}))} />
        <button
          onClick={()=>mutate({ name: form.name, address: form.address, phone: form.phone })}
          disabled={isPending}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg disabled:opacity-60"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}
