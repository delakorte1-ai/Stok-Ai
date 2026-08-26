import { useState } from "react";
import api from "../api/client";
import Modal from "./Modal";

export default function NewCategoryModal({ onClose, onCreated }) {
  const [nama, setNama] = useState("");
  const [modeStok, setModeStok] = useState("reguler");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await api.post("/kategori", { nama, modeStok });
      onCreated();
      onClose();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal membuat kategori.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Tambah Kategori Baru" onClose={onClose}>
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Nama Kategori</label>
          <input
            value={nama}
            onChange={(e) => setNama(e.target.value)}
            placeholder="mis. Baut, Aki, Kampas Rem"
            required
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">Mode Stok</label>
          <div className="space-y-2">
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 has-checked:border-indigo-500 has-checked:bg-indigo-50">
              <input type="radio" name="mode" checked={modeStok === "reguler"} onChange={() => setModeStok("reguler")} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Reguler</span>
                <span className="block text-xs text-slate-500">Barang seragam/identik, stok berupa angka (mis. ban baru, oli, baut).</span>
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-slate-200 p-2.5 has-checked:border-indigo-500 has-checked:bg-indigo-50">
              <input type="radio" name="mode" checked={modeStok === "unit_unik"} onChange={() => setModeStok("unit_unik")} className="mt-0.5" />
              <span>
                <span className="block text-sm font-medium">Unit Unik</span>
                <span className="block text-xs text-slate-500">Setiap unit beda (mis. barang second), dicatat per baris, habis setelah terjual.</span>
              </span>
            </label>
          </div>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-medium text-white disabled:opacity-50">
          {loading ? "Menyimpan…" : "Simpan Kategori"}
        </button>
      </form>
    </Modal>
  );
}
