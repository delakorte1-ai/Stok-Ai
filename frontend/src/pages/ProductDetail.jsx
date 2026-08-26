import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../api/client";
import { useAuth } from "../context/AuthContext";
import { formatRupiah } from "./Dashboard";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [produk, setProduk] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({});
  const [aksi, setAksi] = useState({ jumlah: "", hargaJual: "", modalBaru: "" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const res = await api.get(`/produk/${id}`);
    setProduk(res.data);
    setForm({
      modal: res.data.modal,
      hargaJualDefault: res.data.hargaJualDefault ?? "",
      stokMinimum: res.data.stokMinimum ?? "",
    });
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (!produk) return <p className="text-sm text-slate-500">Memuat…</p>;

  const isReguler = produk.stok !== null;

  async function saveEdit(e) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.patch(`/produk/${id}`, {
        modal: Number(form.modal),
        hargaJualDefault: form.hargaJualDefault === "" ? null : Number(form.hargaJualDefault),
        stokMinimum: form.stokMinimum === "" ? undefined : Number(form.stokMinimum),
      });
      setEditing(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menyimpan.");
    } finally {
      setBusy(false);
    }
  }

  async function tambahStok() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/produk/${id}/tambah-stok`, {
        jumlah: Number(aksi.jumlah),
        modalBaru: aksi.modalBaru ? Number(aksi.modalBaru) : undefined,
      });
      setAksi({ jumlah: "", hargaJual: "", modalBaru: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menambah stok.");
    } finally {
      setBusy(false);
    }
  }

  async function kurangiStok() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/produk/${id}/kurangi-stok`, {
        jumlah: Number(aksi.jumlah),
        hargaJual: aksi.hargaJual ? Number(aksi.hargaJual) : undefined,
      });
      setAksi({ jumlah: "", hargaJual: "", modalBaru: "" });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal mengurangi stok.");
    } finally {
      setBusy(false);
    }
  }

  async function jualUnit() {
    setBusy(true);
    setError(null);
    try {
      await api.post(`/produk/${id}/jual-unit`, {
        hargaJual: aksi.hargaJual ? Number(aksi.hargaJual) : undefined,
      });
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menjual unit.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-slate-500 hover:text-slate-700">
        ← Kembali
      </button>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-slate-400">{produk.kategori.nama}</p>
            <h1 className="text-lg font-semibold text-slate-900">{produk.nama}</h1>
          </div>
          {isReguler ? (
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">Stok: {produk.stok}</span>
          ) : (
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                produk.statusUnitUnik === "tersedia" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
              }`}
            >
              {produk.statusUnitUnik === "tersedia" ? "Tersedia" : "Habis"}
            </span>
          )}
        </div>

        {!editing ? (
          <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <Info label="Modal" value={formatRupiah(produk.modal)} />
            <Info label="Harga Jual Default" value={formatRupiah(produk.hargaJualDefault)} />
            {isReguler && <Info label="Stok Minimum" value={produk.stokMinimum ?? 0} />}
            {produk.kondisi && <Info label="Kondisi" value={produk.kondisi} />}
            {user?.role === "owner" && (
              <button onClick={() => setEditing(true)} className="col-span-2 mt-1 text-left text-sm font-medium text-indigo-600">
                Edit modal / harga →
              </button>
            )}
          </div>
        ) : (
          <form onSubmit={saveEdit} className="mt-3 space-y-2">
            <EditField label="Modal" value={form.modal} onChange={(v) => setForm((f) => ({ ...f, modal: v }))} />
            <EditField label="Harga Jual Default" value={form.hargaJualDefault} onChange={(v) => setForm((f) => ({ ...f, hargaJualDefault: v }))} />
            {isReguler && <EditField label="Stok Minimum" value={form.stokMinimum} onChange={(v) => setForm((f) => ({ ...f, stokMinimum: v }))} />}
            <div className="flex gap-2">
              <button disabled={busy} className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white">Simpan</button>
              <button type="button" onClick={() => setEditing(false)} className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm">Batal</button>
            </div>
          </form>
        )}
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Aksi Stok Manual</h2>
        {isReguler ? (
          <div className="space-y-2">
            <div className="flex gap-2">
              <input placeholder="Jumlah" value={aksi.jumlah} onChange={(e) => setAksi((a) => ({ ...a, jumlah: e.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input placeholder="Modal baru (opsional)" value={aksi.modalBaru} onChange={(e) => setAksi((a) => ({ ...a, modalBaru: e.target.value }))} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <button disabled={busy || !aksi.jumlah} onClick={tambahStok} className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">+ Masuk</button>
            </div>
            <div className="flex gap-2">
              <input placeholder="Jumlah" value={aksi.jumlah} onChange={(e) => setAksi((a) => ({ ...a, jumlah: e.target.value }))} className="w-24 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <input placeholder="Harga jual (opsional)" value={aksi.hargaJual} onChange={(e) => setAksi((a) => ({ ...a, hargaJual: e.target.value }))} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
              <button disabled={busy || !aksi.jumlah} onClick={kurangiStok} className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">- Keluar</button>
            </div>
          </div>
        ) : (
          <div className="flex gap-2">
            <input placeholder="Harga jual (opsional)" value={aksi.hargaJual} onChange={(e) => setAksi((a) => ({ ...a, hargaJual: e.target.value }))} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
            <button
              disabled={busy || produk.statusUnitUnik === "habis"}
              onClick={jualUnit}
              className="shrink-0 rounded-lg bg-red-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
            >
              Tandai Terjual
            </button>
          </div>
        )}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Riwayat Transaksi</h2>
        {produk.transaksiStok.length === 0 && <p className="text-sm text-slate-400">Belum ada transaksi.</p>}
        <div className="space-y-2">
          {produk.transaksiStok.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-slate-100 pb-2 text-sm last:border-0">
              <div>
                <span className={t.jenisTransaksi === "masuk" ? "text-emerald-600" : "text-red-600"}>
                  {t.jenisTransaksi === "masuk" ? "Masuk" : "Keluar"} {t.jumlah}
                </span>
                <span className="ml-2 text-xs text-slate-400">
                  {new Date(t.waktu).toLocaleString("id-ID")} · {t.sumber} {t.user ? `· ${t.user.nama}` : ""}
                </span>
              </div>
              {t.hargaJualSaatIni != null && <span className="text-xs text-slate-500">{formatRupiah(t.hargaJualSaatIni)}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div>
      <p className="text-xs text-slate-400">{label}</p>
      <p className="font-medium text-slate-800">{value}</p>
    </div>
  );
}

function EditField({ label, value, onChange }) {
  return (
    <div className="flex items-center gap-2">
      <label className="w-40 text-sm text-slate-600">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)} className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm" />
    </div>
  );
}
