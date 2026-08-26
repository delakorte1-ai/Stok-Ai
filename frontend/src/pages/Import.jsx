import { useState } from "react";
import api from "../api/client";

const TABS = [
  { id: "teks", label: "Paste Teks" },
  { id: "excel", label: "Excel/CSV" },
  { id: "foto", label: "Foto" },
];

export default function Import() {
  const [tab, setTab] = useState("teks");
  const [teks, setTeks] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasilKomit, setHasilKomit] = useState(null);

  async function prosesTeks() {
    if (!teks.trim()) return;
    setLoading(true);
    setError(null);
    setHasilKomit(null);
    try {
      const res = await api.post("/import/teks", { teks });
      setItems(res.data.items);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal memproses teks.");
    } finally {
      setLoading(false);
    }
  }

  async function prosesExcel(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setHasilKomit(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await api.post("/import/excel", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setItems(res.data.items);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal membaca file.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  async function prosesFoto(e) {
    const file = e.target.files[0];
    if (!file) return;
    setLoading(true);
    setError(null);
    setHasilKomit(null);
    try {
      const fd = new FormData();
      fd.append("foto", file);
      const res = await api.post("/import/foto", fd, { headers: { "Content-Type": "multipart/form-data" } });
      setItems(res.data.items);
    } catch (err) {
      setError(err.response?.data?.error || "Gagal memproses foto.");
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  function updateItem(idx, field, value) {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, [field]: value } : it)));
  }

  async function komit() {
    const siapDikirim = items.filter((it) => it.lengkap);
    if (siapDikirim.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await api.post("/import/komit", { items: siapDikirim });
      setHasilKomit(res.data);
      setItems((prev) => prev.filter((it) => !it.lengkap));
    } catch (err) {
      setError(err.response?.data?.error || "Gagal menyimpan data.");
    } finally {
      setLoading(false);
    }
  }

  const jumlahLengkap = items.filter((it) => it.lengkap).length;
  const jumlahBermasalah = items.length - jumlahLengkap;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Import Data Massal</h1>
        <a href="/api/import/template" className="text-sm font-medium text-indigo-600 hover:underline">
          ⬇ Download Template Excel
        </a>
      </div>

      <div className="flex gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${tab === t.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        {tab === "teks" && (
          <div className="space-y-2">
            <textarea
              value={teks}
              onChange={(e) => setTeks(e.target.value)}
              rows={6}
              placeholder={"Paste daftar bebas, misal:\nBan GT 70/90 350rb stok 10\nVelg racing 17 800rb 4pcs\n..."}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-indigo-500"
            />
            <button onClick={prosesTeks} disabled={loading || !teks.trim()} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">
              {loading ? "Memproses…" : "Proses dengan AI"}
            </button>
          </div>
        )}
        {tab === "excel" && (
          <div>
            <p className="mb-2 text-sm text-slate-500">Upload file .xlsx/.csv dengan header: nama, kategori, modal, stok, hargaJualDefault, kondisi.</p>
            <input type="file" accept=".xlsx,.xls,.csv" onChange={prosesExcel} disabled={loading} className="text-sm" />
          </div>
        )}
        {tab === "foto" && (
          <div>
            <p className="mb-2 text-sm text-slate-500">Upload foto daftar produk (mis. foto catatan atau pesan supplier), AI akan membaca isinya.</p>
            <input type="file" accept="image/*" onChange={prosesFoto} disabled={loading} className="text-sm" />
          </div>
        )}
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>

      {hasilKomit && (
        <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800">
          ✓ {hasilKomit.berhasil.length} produk berhasil disimpan.
          {hasilKomit.gagal.length > 0 && ` ${hasilKomit.gagal.length} baris gagal disimpan.`}
        </div>
      )}

      {items.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-700">
              Preview ({jumlahLengkap} siap disimpan{jumlahBermasalah > 0 ? `, ${jumlahBermasalah} perlu dilengkapi` : ""})
            </h2>
            <button onClick={komit} disabled={loading || jumlahLengkap === 0} className="rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50">
              Simpan {jumlahLengkap} Produk
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                  <th className="py-1.5 pr-2">Nama</th>
                  <th className="py-1.5 pr-2">Kategori</th>
                  <th className="py-1.5 pr-2">Modal</th>
                  <th className="py-1.5 pr-2">Stok</th>
                  <th className="py-1.5 pr-2">Harga Jual</th>
                  <th className="py-1.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={idx} className={`border-b border-slate-100 ${!it.lengkap ? "bg-amber-50" : ""}`}>
                    <td className="py-1.5 pr-2">
                      <input value={it.nama || ""} onChange={(e) => updateItem(idx, "nama", e.target.value)} className="w-32 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input value={it.kategoriNama || ""} onChange={(e) => updateItem(idx, "kategoriNama", e.target.value)} className="w-24 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                      {it.kategoriBaru && (
                        <select
                          value={it.modeStokBaru || ""}
                          onChange={(e) => updateItem(idx, "modeStokBaru", e.target.value)}
                          className="mt-1 block w-24 rounded border border-amber-300 px-1 py-0.5 text-[11px]"
                        >
                          <option value="">Mode kategori baru…</option>
                          <option value="reguler">Reguler</option>
                          <option value="unit_unik">Unit Unik</option>
                        </select>
                      )}
                    </td>
                    <td className="py-1.5 pr-2">
                      <input value={it.modal ?? ""} onChange={(e) => updateItem(idx, "modal", e.target.value === "" ? null : Number(e.target.value))} className="w-20 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input value={it.stok ?? ""} onChange={(e) => updateItem(idx, "stok", e.target.value === "" ? null : Number(e.target.value))} className="w-16 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                    </td>
                    <td className="py-1.5 pr-2">
                      <input value={it.hargaJualDefault ?? ""} onChange={(e) => updateItem(idx, "hargaJualDefault", e.target.value === "" ? null : Number(e.target.value))} className="w-20 rounded border border-slate-200 px-1.5 py-1 text-xs" />
                    </td>
                    <td className="py-1.5 text-xs">
                      {it.lengkap ? (
                        <span className="text-emerald-600">✓ Siap</span>
                      ) : (
                        <span className="text-amber-600" title={it.alasanTidakLengkap || ""}>⚠ Lengkapi data</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
