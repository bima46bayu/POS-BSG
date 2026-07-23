import React, { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Save,
  Upload,
  PenLine,
  Plus,
  Trash2,
  Edit,
  Users,
} from "lucide-react";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

import { API_BASE_URL } from "../../api/client";
import {
  getPaymentRequestSignatories,
  updatePaymentRequestSignerRoles,
  createPaymentRequestSigner,
  updatePaymentRequestSigner,
  deletePaymentRequestSigner,
  uploadPaymentRequestSignature,
} from "../../api/appSettings";
import ConfirmDialog from "../../components/common/ConfirmDialog";

const ROLE_META = [
  {
    key: "submitted",
    title: "Diajukan Oleh",
    defaultLabel: "Diajukan Oleh,",
  },
  {
    key: "acknowledged",
    title: "Diketahui Oleh",
    defaultLabel: "Diketahui Oleh,",
  },
  {
    key: "approved",
    title: "Disetujui Oleh",
    defaultLabel: "Disetujui Oleh,",
  },
];

function signaturePreviewUrl(path) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const base = (API_BASE_URL || "").replace(/\/$/, "");
  const rel = String(path).replace(/^\//, "");
  return base ? `${base}/${rel}` : `/${rel}`;
}

function SignerModal({
  open,
  title,
  initial,
  saving,
  onClose,
  onSubmit,
  onUpload,
  uploading,
}) {
  const [name, setName] = useState("");
  const [signature, setSignature] = useState(null);
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!open) return;
    setName(initial?.name || "");
    setSignature(initial?.signature || null);
    setIsActive(initial?.is_active ?? true);
  }, [open, initial]);

  if (!open) return null;

  const preview = signaturePreviewUrl(signature);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl border">
        <div className="px-5 py-4 border-b flex items-center justify-between">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={saving ? undefined : onClose} className="text-gray-400">
            ✕
          </button>
        </div>

        <div className="p-5 space-y-4">
          <label className="block space-y-1.5">
            <span className="text-sm font-medium text-gray-700">Nama</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg text-sm"
              placeholder="Nama lengkap"
            />
          </label>

          <div className="space-y-2">
            <span className="text-sm font-medium text-gray-700">Tanda tangan</span>
            <div className="h-28 border rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden">
              {preview ? (
                <img
                  src={preview}
                  alt="Signature preview"
                  className="max-h-full max-w-full object-contain"
                />
              ) : (
                <span className="text-xs text-gray-400">Belum ada gambar</span>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 px-3 py-2 border rounded-lg text-sm hover:bg-gray-50 cursor-pointer">
                <Upload className="w-4 h-4" />
                {uploading ? "Uploading..." : "Upload"}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  disabled={uploading}
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    e.target.value = "";
                    if (!file) return;
                    const path = await onUpload(file);
                    if (path) setSignature(path);
                  }}
                />
              </label>
              {signature && (
                <button
                  type="button"
                  onClick={() => setSignature(null)}
                  className="px-3 py-2 border rounded-lg text-sm text-red-600 hover:bg-red-50"
                >
                  Hapus gambar
                </button>
              )}
            </div>
          </div>

          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="rounded border-gray-300"
            />
            Aktif (bisa dipilih untuk PDF)
          </label>
        </div>

        <div className="px-5 py-4 border-t flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 border rounded-lg text-sm"
          >
            Cancel
          </button>
          <button
            onClick={() =>
              onSubmit({
                name: name.trim(),
                signature,
                is_active: isActive,
                clear_signature: !signature,
              })
            }
            disabled={saving || !name.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function PaymentRequestSignatoriesPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [rolesForm, setRolesForm] = useState(null);
  const [modal, setModal] = useState({ open: false, mode: "add", signer: null });
  const [deleteId, setDeleteId] = useState(null);
  const [uploading, setUploading] = useState(false);

  const queryKey = ["settings", "payment-request-signatories"];

  const { data, isLoading, isError, error } = useQuery({
    queryKey,
    queryFn: ({ signal }) => getPaymentRequestSignatories(signal),
  });

  const signers = data?.signers || [];
  const activeSigners = useMemo(
    () => signers.filter((s) => s.is_active),
    [signers]
  );

  useEffect(() => {
    if (!data?.roles) return;
    setRolesForm({
      submitted: {
        signer_id: data.roles.submitted?.signer_id ?? null,
        label: data.roles.submitted?.label || "Diajukan Oleh,",
      },
      acknowledged: {
        signer_id: data.roles.acknowledged?.signer_id ?? null,
        label: data.roles.acknowledged?.label || "Diketahui Oleh,",
      },
      approved: {
        signer_id: data.roles.approved?.signer_id ?? null,
        label: data.roles.approved?.label || "Disetujui Oleh,",
      },
    });
  }, [data]);

  const invalidate = () => qc.invalidateQueries({ queryKey });

  const saveRolesMutation = useMutation({
    mutationFn: (payload) => updatePaymentRequestSignerRoles(payload),
    onSuccess: () => {
      toast.success("Role assignment saved");
      invalidate();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Gagal menyimpan role"
      );
    },
  });

  const createMutation = useMutation({
    mutationFn: createPaymentRequestSigner,
    onSuccess: () => {
      toast.success("Signer added");
      setModal({ open: false, mode: "add", signer: null });
      invalidate();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Gagal menambah signer"
      );
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }) => updatePaymentRequestSigner(id, payload),
    onSuccess: () => {
      toast.success("Signer updated");
      setModal({ open: false, mode: "add", signer: null });
      invalidate();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Gagal update signer"
      );
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deletePaymentRequestSigner,
    onSuccess: () => {
      toast.success("Signer deleted");
      setDeleteId(null);
      invalidate();
    },
    onError: (err) => {
      toast.error(
        err?.response?.data?.message || err?.message || "Gagal hapus signer"
      );
    },
  });

  const rolesDirty = useMemo(() => {
    if (!rolesForm || !data?.roles) return false;
    return JSON.stringify(rolesForm) !== JSON.stringify({
      submitted: {
        signer_id: data.roles.submitted?.signer_id ?? null,
        label: data.roles.submitted?.label || "Diajukan Oleh,",
      },
      acknowledged: {
        signer_id: data.roles.acknowledged?.signer_id ?? null,
        label: data.roles.acknowledged?.label || "Diketahui Oleh,",
      },
      approved: {
        signer_id: data.roles.approved?.signer_id ?? null,
        label: data.roles.approved?.label || "Disetujui Oleh,",
      },
    });
  }, [rolesForm, data]);

  const handleModalUpload = async (file) => {
    setUploading(true);
    try {
      const res = await uploadPaymentRequestSignature(file, {
        signerId: modal.signer?.id,
      });
      toast.success("Tanda tangan diupload");
      return res.path;
    } catch (err) {
      toast.error(
        err?.response?.data?.message || err?.message || "Gagal upload"
      );
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleModalSubmit = (payload) => {
    if (modal.mode === "edit" && modal.signer?.id) {
      updateMutation.mutate({ id: modal.signer.id, payload });
    } else {
      createMutation.mutate({
        name: payload.name,
        signature: payload.signature,
        is_active: payload.is_active,
      });
    }
  };

  return (
    <div className="p-6 bg-gray-50 min-h-screen space-y-4">
      <div className="bg-white p-4 rounded-lg shadow-sm border">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/payment-requests")}
            className="inline-flex items-center justify-center w-9 h-9 rounded-lg border hover:bg-gray-100"
            title="Kembali"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-lg font-semibold">
              Payment Request Signatories
            </h2>
            <p className="text-sm text-gray-500">
              Kelola database orang tanda tangan, lalu pilih siapa yang mengisi
              tiap kolom PDF
            </p>
          </div>
        </div>
      </div>

      {isLoading && (
        <div className="bg-white border rounded-lg p-6 text-sm text-gray-500">
          Loading...
        </div>
      )}

      {isError && (
        <div className="bg-white border border-red-200 rounded-lg p-6 text-sm text-red-600">
          {error?.response?.data?.message ||
            error?.message ||
            "Gagal memuat pengaturan"}
        </div>
      )}

      {data && rolesForm && (
        <>
          {/* ===== Role assignment ===== */}
          <div className="bg-white border rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <PenLine className="w-4 h-4 text-blue-600" />
                <div>
                  <h3 className="font-semibold">PDF Role Assignment</h3>
                  <p className="text-sm text-gray-500">
                    Pilih orang dari database untuk tiap kolom
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={!rolesDirty || saveRolesMutation.isPending}
                onClick={() => saveRolesMutation.mutate(rolesForm)}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saveRolesMutation.isPending ? "Saving..." : "Save Assignment"}
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 lg:grid-cols-3 gap-4">
              {ROLE_META.map((meta) => {
                const value = rolesForm[meta.key];
                const selected = signers.find(
                  (s) => Number(s.id) === Number(value.signer_id)
                );
                return (
                  <div
                    key={meta.key}
                    className="border rounded-xl p-4 space-y-3 bg-gray-50"
                  >
                    <div className="font-medium text-gray-900">{meta.title}</div>

                    <label className="block space-y-1">
                      <span className="text-xs text-gray-500">Label di PDF</span>
                      <input
                        value={value.label || ""}
                        onChange={(e) =>
                          setRolesForm((prev) => ({
                            ...prev,
                            [meta.key]: {
                              ...prev[meta.key],
                              label: e.target.value,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      />
                    </label>

                    <label className="block space-y-1">
                      <span className="text-xs text-gray-500">Orang</span>
                      <select
                        value={value.signer_id ?? ""}
                        onChange={(e) =>
                          setRolesForm((prev) => ({
                            ...prev,
                            [meta.key]: {
                              ...prev[meta.key],
                              signer_id: e.target.value
                                ? Number(e.target.value)
                                : null,
                            },
                          }))
                        }
                        className="w-full px-3 py-2 border rounded-lg text-sm bg-white"
                      >
                        <option value="">— Pilih —</option>
                        {activeSigners.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                        {selected && !selected.is_active && (
                          <option value={selected.id}>
                            {selected.name} (nonaktif)
                          </option>
                        )}
                      </select>
                    </label>

                    <div className="h-20 border rounded-lg bg-white flex items-center justify-center overflow-hidden">
                      {selected?.signature ? (
                        <img
                          src={signaturePreviewUrl(selected.signature)}
                          alt={selected.name}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : (
                        <span className="text-xs text-gray-400">
                          {selected ? "Tanpa tanda tangan" : "Belum dipilih"}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ===== Master database ===== */}
          <div className="bg-white border rounded-xl shadow-sm">
            <div className="px-5 py-4 border-b flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-blue-600" />
                <div>
                  <h3 className="font-semibold">Signer Database</h3>
                  <p className="text-sm text-gray-500">
                    Tambah / edit orang tanpa menimpa data lama
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() =>
                  setModal({ open: true, mode: "add", signer: null })
                }
                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-white bg-blue-600 rounded-lg"
              >
                <Plus className="w-4 h-4" />
                Add Signer
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-500">
                  <tr>
                    <th className="px-5 py-3 font-medium">Name</th>
                    <th className="px-5 py-3 font-medium">Signature</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {signers.length === 0 && (
                    <tr>
                      <td
                        colSpan={4}
                        className="px-5 py-8 text-center text-gray-400"
                      >
                        Belum ada signer. Klik Add Signer.
                      </td>
                    </tr>
                  )}
                  {signers.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="px-5 py-3 font-medium text-gray-900">
                        {s.name}
                      </td>
                      <td className="px-5 py-3">
                        {s.signature ? (
                          <img
                            src={signaturePreviewUrl(s.signature)}
                            alt={s.name}
                            className="h-10 object-contain"
                          />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className={[
                            "inline-flex px-2 py-0.5 rounded-full text-xs font-medium",
                            s.is_active
                              ? "bg-green-50 text-green-700"
                              : "bg-gray-100 text-gray-500",
                          ].join(" ")}
                        >
                          {s.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              setModal({
                                open: true,
                                mode: "edit",
                                signer: s,
                              })
                            }
                            className="inline-flex items-center justify-center h-8 w-8 border rounded-lg hover:bg-gray-50"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteId(s.id)}
                            className="inline-flex items-center justify-center h-8 w-8 border rounded-lg text-red-600 hover:bg-red-50"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

        </>
      )}

      <SignerModal
        open={modal.open}
        title={modal.mode === "edit" ? "Edit Signer" : "Add Signer"}
        initial={modal.signer}
        saving={createMutation.isPending || updateMutation.isPending}
        uploading={uploading}
        onClose={() => setModal({ open: false, mode: "add", signer: null })}
        onUpload={handleModalUpload}
        onSubmit={handleModalSubmit}
      />

      <ConfirmDialog
        open={!!deleteId}
        title="Hapus signer?"
        message="Signer akan dihapus dari database. Jika sedang dipakai di PDF, assignment-nya dikosongkan."
        confirmText="Delete"
        onClose={() => setDeleteId(null)}
        onConfirm={() => deleteMutation.mutate(deleteId)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
