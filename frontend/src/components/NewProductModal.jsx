import { useState } from "react";
import api from "../api/client";
import Modal from "./Modal";

export default function NewProductModal({ kategori, onClose, onCreated }) {
  const [form, setForm] = useState({
    kategoriId: kategori[0]?.id || "",
    nama: "",
    modal: "",
    stok: "",
    stokMinimum: "",
    hargaJualDefault: "",
    kondisi: "",
  });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const kategoriDipilih = kategori.find((k) => k.id === form.kategoriId);
  const isReguler = kategoriDipilih?.modeStok === "reguler";

  function update(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/produk", {
        kategoriId: form.kategoriId,
        nama: form.nama,
        modal: Number(form.modal) || 0,
        hargaJualDefault: form.hargaJualDefault ? Number(form.hargaJualDefault) : null,
        ...(isReguler
          ? { stok: Number(form.stok) || 0, stokMinimum: Number(form.stokMinimum) || 0 }
          : { kondisi: form.kondisi || null }),
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menambah produk.");
    } finally {
      setLoading(false);
    }
  }

  if (kategori.length === 0) {
    return (
      <Modal title="Tambah Produk" onClose={onClose}>
        <p className="text-sm text-slate-500">Buat kategori terlebih dahulu sebelum menambah produk.</p>
      </Modal>
    );
  }

  return (
    <Modal title="Tambah Produk Baru" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Kategori</label>
          <select
            value={form.kategoriId}
            onChange={(e) => update("kategoriId", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          >
            {kategori.map((k) => (
              <option key={k.id} value={k.id}>
                {k.nama} ({k.modeStok === "reguler" ? "Reguler" : "Unit Unik"})
              </option>
            ))}
          </select>
        </div>

        <TextField label="Nama Produk" value={form.nama} onChange={(v) => update("nama", v)} required />
        <div className="grid grid-cols-2 gap-3">
          <TextField label="Modal" type="number" value={form.modal} onChange={(v) => update("modal", v)} required />
          <TextField label="Harga Jual (opsional)" type="number" value={form.hargaJualDefault} onChange={(v) => update("hargaJualDefault", v)} />
        </div>

        {isReguler ? (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Stok Awal" type="number" value={form.stok} onChange={(v) => update("stok", v)} required />
            <TextField label="Stok Minimum" type="number" value={form.stokMinimum} onChange={(v) => update("stokMinimum", v)} />
          </div>
        ) : (
          <TextField label="Kondisi (opsional)" value={form.kondisi} onChange={(v) => update("kondisi", v)} placeholder="mis. second 80%" />
        )}

        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Menyimpan…" : "Simpan Produk"}
        </button>
      </form>
    </Modal>
  );
}

function TextField({ label, value, onChange, type = "text", required, placeholder }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700">{label}</label>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
      />
    </div>
  );
}
