import React from "react";

const roleLabel = (r) => (String(r ?? "").toLowerCase() === "admin" ? "Admin" : "Kasir");

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

export default function EditUserModal({
  open,
  onClose,
  onSubmit,          // () => void  (mUpdate.mutate({ id, payload }))
  loading = false,
  form,              // { id, name, email, role, store_location_id }
  setForm,
  roleOptions = [],
  storeOptions = [],
  title = "Edit User",
}) {
  if (!open) return null;

  const set = (patch) => setForm({ ...form, ...patch });

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute left-1/2 top-1/2 w-[560px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2 rounded-xl bg-white shadow-xl">
        <div className="px-5 py-4 border-b">
          <h3 className="text-lg font-semibold">{title}</h3>
        </div>

        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Name">
              <input
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={form.name || ""}
                onChange={(e) => set({ name: e.target.value })}
                placeholder="Nama lengkap"
              />
            </Field>

            <Field label="Email">
              <input
                type="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-500"
                value={form.email || ""}
                onChange={(e) => set({ email: e.target.value })}
                placeholder="email@domain.com"
              />
            </Field>

            <Field label="Role">
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none bg-white focus:ring-2 focus:ring-blue-500"
                value={form.role || "kasir"}
                onChange={(e) => set({ role: e.target.value })}
              >
                {(roleOptions.length ? roleOptions : [{value:"admin",label:"Admin"},{value:"kasir",label:"Kasir"}])
                  .map((o) => <option key={o.value} value={o.value}>{roleLabel(o.value)}</option>)}
              </select>
            </Field>

            <Field label="Store">
              <select
                className="w-full rounded-lg border border-gray-300 px-3 py-2 outline-none bg-white focus:ring-2 focus:ring-blue-500"
                value={form.store_location_id ?? ""}
                onChange={(e) => {
                  const v = e.target.value;
                  set({ store_location_id: v === "" ? "" : Number(v) });
                }}
              >
                <option value="">-</option>
                {storeOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </Field>
          </div>
        </div>

        <div className="px-5 py-4 border-t bg-gray-50 rounded-b-xl flex justify-end gap-2">
          <button className="px-4 py-2 rounded-lg border" onClick={onClose} disabled={loading}>Cancel</button>
          <button
            className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={onSubmit}
            disabled={loading}
          >
            {loading ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
