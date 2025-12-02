// src/components/products/UnitDropdown.jsx
import React, { useEffect, useState, useRef } from "react";
import {
  ChevronDown,
  Loader2,
  Plus,
  Trash2,
  Check,
  Pencil,
  X,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  listUnits,
  createUnit,
  updateUnit,
  deleteUnit,
} from "../../api/units";

/**
 * Props:
 *  - value: unit_id (number | string | null)
 *  - onChange: (unitId) => void
 *  - placeholder?: string
 */
export default function UnitDropdown({ value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [units, setUnits] = useState([]); // {id, name}
  const [loading, setLoading] = useState(false);
  const [savingRow, setSavingRow] = useState(null); // id atau "new"
  const [newName, setNewName] = useState("");

  // state untuk edit rename
  const [editingUnitId, setEditingUnitId] = useState(null);
  const [editName, setEditName] = useState("");

  // state untuk confirm delete modal
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [unitToDelete, setUnitToDelete] = useState(null);

  const containerRef = useRef(null);

  const selectedUnit = units.find((u) => String(u.id) === String(value));

  // load units saat dropdown pertama kali dibuka
  useEffect(() => {
    if (!open || units.length) return;

    let cancelled = false;
    (async () => {
      try {
        setLoading(true);
        const data = await listUnits({ per_page: 100 });
        if (!cancelled) setUnits(data);
      } catch (e) {
        console.error(e);
        if (!cancelled) toast.error("Gagal memuat satuan");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [open, units.length]);

  // click outside dropdown → tutup
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSelect = (u) => {
    onChange?.(u.id);
    setOpen(false);
  };

  // ==== EDIT MODE ====
  const startEdit = (unit) => {
    setEditingUnitId(unit.id);
    setEditName(unit.name ?? "");
  };

  const cancelEdit = () => {
    setEditingUnitId(null);
    setEditName("");
  };

  const handleSaveEdit = async () => {
    const id = editingUnitId;
    if (!id) {
      toast.error("ID satuan tidak valid");
      return;
    }

    const trimmed = editName.trim();
    if (!trimmed) {
      toast.error("Nama satuan tidak boleh kosong");
      return;
    }

    try {
      setSavingRow(id);
      const updated = await updateUnit(id, { name: trimmed });
      setUnits((prev) =>
        prev.map((u) =>
          u.id === id ? { ...u, name: updated?.name ?? trimmed } : u
        )
      );
      toast.success("Satuan diperbarui");
      setEditingUnitId(null);
      setEditName("");
    } catch (e) {
      console.error(e);
      toast.error("Gagal memperbarui satuan");
    } finally {
      setSavingRow(null);
    }
  };

  // ==== DELETE ====

  const openConfirmDelete = (unit) => {
    setUnitToDelete(unit);
    setConfirmOpen(true);
    setOpen(false); // tutup dropdown biar fokus ke modal
  };

  const closeConfirmDelete = () => {
    setConfirmOpen(false);
    setUnitToDelete(null);
  };

  const handleDelete = async () => {
    if (!unitToDelete?.id) {
      toast.error("ID satuan tidak valid");
      return;
    }

    const id = unitToDelete.id;

    try {
      setSavingRow(id);
      await deleteUnit(id);
      setUnits((prev) => prev.filter((u) => u.id !== id));
      if (String(value) === String(id)) {
        onChange?.(null);
      }
      toast.success("Satuan dihapus");
    } catch (e) {
      console.error(e);
      toast.error("Gagal menghapus satuan");
    } finally {
      setSavingRow(null);
      closeConfirmDelete();
    }
  };

  // ==== CREATE ====

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;

    try {
      setSavingRow("new");
      const created = await createUnit({ name: trimmed });
      const newUnit = {
        id: created?.id,
        name: created?.name ?? trimmed,
      };
      setUnits((prev) => [...prev, newUnit]);
      setNewName("");
      onChange?.(newUnit.id);
      toast.success("Satuan ditambahkan");
    } catch (e) {
      console.error(e);
      toast.error("Gagal menambah satuan");
    } finally {
      setSavingRow(null);
    }
  };

  return (
    <>
      {/* DROPDOWN */}
      <div className="relative" ref={containerRef}>
        {/* Trigger */}
        <button
          type="button"
          onClick={() => setOpen((s) => !s)}
          className="w-full flex items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm text-left hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        >
          <span className={selectedUnit ? "text-gray-900" : "text-gray-400"}>
            {selectedUnit?.name || placeholder || "Pilih satuan"}
          </span>
          <ChevronDown className="w-4 h-4 text-gray-500 ml-2" />
        </button>

        {/* Panel */}
        {open && (
          <div className="absolute z-40 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg max-h-80 overflow-y-auto">
            <div className="p-2">
              <p className="text-[11px] text-gray-500 mb-2 px-1">
                Pilih satuan, atau edit / tambah langsung di sini.
              </p>

              {loading && (
                <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Memuat satuan...
                </div>
              )}

              {!loading && units.length === 0 && (
                <div className="text-xs text-gray-500 px-1 py-2">
                  Belum ada satuan. Tambah baru di bawah.
                </div>
              )}

              {/* Daftar unit */}
              {units.map((u, index) => {
                const isSelected = String(value) === String(u.id);
                const isEditing = editingUnitId === u.id;

                return (
                  <div
                    key={u.id ?? `unit-${index}`} // jaga-jaga kalau id belum ada
                    className="flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-gray-50 group"
                  >
                    {!isEditing ? (
                      <>
                        {/* pilih */}
                        <button
                          type="button"
                          onClick={() => handleSelect(u)}
                          className="flex-1 text-left flex items-center justify-between gap-2 mr-1"
                        >
                          <span className="text-xs text-gray-800 truncate">
                            {u.name}
                          </span>
                          {isSelected && (
                            <Check className="w-3 h-3 text-green-500" />
                          )}
                        </button>

                        {/* Edit */}
                        <button
                          type="button"
                          onClick={() => startEdit(u)}
                          className="p-1 rounded-full text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                          disabled={savingRow === u.id}
                        >
                          <Pencil className="w-3 h-3" />
                        </button>

                        {/* Delete → buka modal */}
                        <button
                          type="button"
                          onClick={() => openConfirmDelete(u)}
                          className="p-1 rounded-full text-gray-400 hover:text-red-600 hover:bg-red-50"
                          disabled={savingRow === u.id}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <>
                        <input
                          className="flex-1 px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 bg-white"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleSaveEdit();
                            }
                            if (e.key === "Escape") {
                              e.preventDefault();
                              cancelEdit();
                            }
                          }}
                          autoFocus
                        />

                        {/* Save */}
                        <button
                          type="button"
                          onClick={handleSaveEdit}
                          disabled={savingRow === u.id || !editName.trim()}
                          className="p-1 rounded-full text-emerald-600 hover:bg-emerald-50 disabled:opacity-60"
                        >
                          {savingRow === u.id ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                          ) : (
                            <Check className="w-3 h-3" />
                          )}
                        </button>

                        {/* Cancel */}
                        <button
                          type="button"
                          onClick={cancelEdit}
                          disabled={savingRow === u.id}
                          className="p-1 rounded-full text-gray-400 hover:bg-gray-100 disabled:opacity-60"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    )}
                  </div>
                );
              })}

              {/* Tambah baru */}
              <div className="mt-2 border-t pt-2">
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Tambah satuan baru (ex: pcs, box)"
                    className="flex-1 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={!newName.trim() || savingRow === "new"}
                    className="inline-flex items-center gap-1 px-2 py-1.5 text-xs rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
                  >
                    {savingRow === "new" ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Plus className="w-3 h-3" />
                    )}
                    Tambah
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* MODAL CONFIRM DELETE */}
      {confirmOpen && unitToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 max-w-sm w-full mx-4 p-4">
            <div className="flex items-start gap-3">
              <div className="mt-0.5">
                <AlertTriangle className="w-5 h-5 text-amber-500" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-900 mb-1">
                  Hapus satuan?
                </h3>
                <p className="text-xs text-gray-600 mb-3">
                  Kamu akan menghapus satuan{" "}
                  <span className="font-semibold">
                    &quot;{unitToDelete.name}&quot;
                  </span>
                  . Tindakan ini tidak dapat dibatalkan.
                </p>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeConfirmDelete}
                    className="px-3 py-1.5 rounded-lg text-xs border border-gray-300 text-gray-700 hover:bg-gray-50"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={savingRow === unitToDelete.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-red-600 text-white hover:bg-red-700 disabled:opacity-60"
                  >
                    {savingRow === unitToDelete.id ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Trash2 className="w-3 h-3" />
                    )}
                    Hapus
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
