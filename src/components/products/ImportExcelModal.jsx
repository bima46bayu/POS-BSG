import React, { useEffect, useRef, useState } from "react";
import {
  X,
  Loader2,
  ChevronDown,
  Check,
  FileUp,
  FileSpreadsheet,
  AlertCircle,
  Download,
} from "lucide-react";
import toast from "react-hot-toast";
import { importProductsExcel } from "../../api/products";

/* ========================= ModeSelect (dropdown kustom) ========================= */
function ModeSelect({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef(null);
  const menuRef = useRef(null);

  const options = [
    { value: "upsert", label: "Upsert (update jika SKU ada)" },
    { value: "create-only", label: "Create only (abaikan SKU existing)" },
  ];

  useEffect(() => {
    function onDocClick(e) {
      if (
        !btnRef.current?.contains(e.target) &&
        !menuRef.current?.contains(e.target)
      ) {
        setOpen(false);
      }
    }
    function onEsc(e) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onEsc);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onEsc);
    };
  }, []);

  const current = options.find((o) => o.value === value) || options[0];

  return (
    <div className="relative">
      <button
        ref={btnRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen((s) => !s)}
        className="w-full inline-flex items-center justify-between gap-2 rounded-xl border px-3 py-2 hover:bg-gray-50 disabled:opacity-60"
      >
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={18} />
          <span className="text-sm">{current.label}</span>
        </div>
        <ChevronDown size={18} />
      </button>

      {open && (
        <div
          ref={menuRef}
          className="absolute z-10 mt-2 w-full rounded-xl border bg-white shadow-lg overflow-hidden"
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-gray-50 ${
                  active ? "bg-blue-50" : ""
                }`}
              >
                <span>{opt.label}</span>
                {active && <Check size={16} className="text-blue-600" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================= Dropzone sederhana ========================= */
function FileDropzone({ onFile, accept = ".xlsx", disabled, file }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function onClick() {
    if (!disabled) inputRef.current?.click();
  }
  function onChange(e) {
    const f = e.target.files?.[0];
    if (f) onFile?.(f);
  }
  function onDrop(e) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    if (disabled) return;
    const f = e.dataTransfer.files?.[0];
    if (!f) return;
    if (accept && !f.name.toLowerCase().endsWith(".xlsx")) {
      toast.error("Hanya menerima file .xlsx");
      return;
    }
    onFile?.(f);
  }

  return (
    <div
      onClick={onClick}
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={onDrop}
      className={`rounded-2xl border-2 border-dashed p-5 cursor-pointer transition ${
        dragOver ? "border-blue-400 bg-blue-50/40" : "border-gray-300"
      } ${disabled ? "opacity-60 cursor-not-allowed" : "hover:bg-gray-50"}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onChange}
        disabled={disabled}
      />
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-gray-100 p-3">
          <FileUp size={22} />
        </div>
        <div className="flex-1">
          <div className="text-sm font-medium">
            {file ? file.name : "Tarik & letakkan file .xlsx di sini, atau klik untuk memilih"}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            Maks 10 MB. Format yang didukung: .xlsx
          </div>
        </div>
        {file && (
          <div className="text-xs text-gray-500">
            {(file.size / 1024 / 1024).toFixed(2)} MB
          </div>
        )}
      </div>
    </div>
  );
}

/* ========================= Modal Utama ========================= */
export default function ImportExcelModal({
  onClose,
  onImported,
  onDownloadTemplate, // optional: () => void
}) {
  const [file, setFile] = useState(null);
  const [mode, setMode] = useState("upsert");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!file) {
      toast.error("Pilih file .xlsx terlebih dahulu");
      return;
    }
    setLoading(true);
    try {
      const res = await importProductsExcel({ file, mode });
      if (res.status !== "ok") {
        toast.error(res.message || "Import gagal");
        setResult(res);
      } else {
        setResult(res.summary || null);
        onImported?.(res.summary);
        toast.success("Import berhasil diproses");
      }
    } catch (err) {
      console.error(err);
      toast.error("Terjadi kesalahan saat import");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-blue-600/10 text-blue-700 p-2">
              <FileSpreadsheet size={20} />
            </div>
            <h3 className="text-lg font-semibold">Import Products (Excel)</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={onSubmit} className="px-6 py-5 space-y-5">
          {/* Row: file & template */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">File (.xlsx)</label>
            <FileDropzone file={file} onFile={setFile} disabled={loading} />
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-500">
                Disarankan memakai template agar Category &amp; Subcategory valid.
              </p>
              <button
                type="button"
                onClick={() => {
                  if (onDownloadTemplate) onDownloadTemplate();
                  else toast("Hubungkan handler onDownloadTemplate untuk mengunduh template.");
                }}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border hover:bg-gray-50 text-sm"
              >
                <Download size={16} />
                Download Template
              </button>
            </div>
          </div>

          {/* Row: Mode (dropdown kustom) */}
          <div className="space-y-2">
            <label className="block text-sm font-medium">Mode</label>
            <ModeSelect value={mode} onChange={setMode} disabled={loading} />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-2 rounded-xl border hover:bg-gray-50"
              disabled={loading}
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading && <Loader2 className="animate-spin" size={16} />}
              Proses
            </button>
          </div>
        </form>

        {/* Footer (Result) */}
        {result && (
          <div className="px-6 pb-6">
            <div className="mt-3 rounded-2xl border bg-gray-50">
              <div className="px-4 py-3 border-b flex items-center gap-2">
                <div className="rounded-lg bg-gray-200 p-1.5">
                  <AlertCircle size={18} />
                </div>
                <h4 className="font-semibold">Hasil Import</h4>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 gap-3 text-sm">
                  <div className="rounded-xl bg-white border p-3">
                    <div className="text-gray-600">Created</div>
                    <div className="text-lg font-semibold">{result.created ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-white border p-3">
                    <div className="text-gray-600">Updated</div>
                    <div className="text-lg font-semibold">{result.updated ?? 0}</div>
                  </div>
                  <div className="rounded-xl bg-white border p-3">
                    <div className="text-gray-600">Processed</div>
                    <div className="text-lg font-semibold">
                      {result.total_rows_processed ?? 0}
                    </div>
                  </div>
                </div>

                {(result.errors?.length ?? 0) > 0 && (
                  <div className="mt-4">
                    <div className="text-red-600 font-medium mb-2">
                      Errors ({result.errors.length})
                    </div>
                    <div className="max-h-48 overflow-auto bg-white border rounded-xl">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="text-left p-2 border-b w-20">Row</th>
                            <th className="text-left p-2 border-b">Message</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.errors.map((e, i) => (
                            <tr key={i} className="odd:bg-white even:bg-gray-50">
                              <td className="p-2 border-b">{e.row}</td>
                              <td className="p-2 border-b whitespace-pre-wrap">
                                {e.message}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Perbaiki baris yang error di Excel, lalu jalankan import ulang.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
