import { useEffect, useState } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import api from "../api/client";
import { formatRupiah } from "./Dashboard";

export default function Laporan() {
  const [labaRugi, setLabaRugi] = useState(null);
  const [terlarisData, setTerlarisData] = useState(null);
  const [auditLog, setAuditLog] = useState([]);
  const [dari, setDari] = useState(() => firstOfMonth());
  const [sampai, setSampai] = useState(() => today());

  useEffect(() => {
    load();
  }, [dari, sampai]);

  async function load() {
    const [r1, r2, r3] = await Promise.all([
      api.get("/laporan/laba-rugi", { params: { dari, sampai } }),
      api.get("/laporan/produk-terlaris", { params: { dari, sampai } }),
      api.get("/laporan/audit-log", { params: { limit: 30 } }),
    ]);
    setLabaRugi(r1.data);
    setTerlarisData(r2.data);
    setAuditLog(r3.data);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end gap-3">
        <DateField label="Dari" value={dari} onChange={setDari} />
        <DateField label="Sampai" value={sampai} onChange={setSampai} />
      </div>

      {labaRugi && (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <Kartu label="Total Pendapatan" value={formatRupiah(labaRugi.totalPendapatan)} />
          <Kartu label="Total Modal Terjual" value={formatRupiah(labaRugi.totalModal)} />
          <Kartu label="Total Laba" value={formatRupiah(labaRugi.totalLaba)} highlight />
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Grafik Laba per Hari</h2>
        {labaRugi?.perHari?.length ? (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={labaRugi.perHari}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="tanggal" fontSize={11} />
                <YAxis fontSize={11} width={70} tickFormatter={(v) => formatRupiah(v)} />
                <Tooltip formatter={(v) => formatRupiah(v)} />
                <Line type="monotone" dataKey="laba" stroke="#4f46e5" strokeWidth={2} dot={false} name="Laba" />
                <Line type="monotone" dataKey="pendapatan" stroke="#10b981" strokeWidth={1.5} dot={false} name="Pendapatan" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm text-slate-400">Belum ada transaksi di rentang tanggal ini.</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Produk Terlaris</h2>
          {terlarisData?.terlaris?.length ? (
            <ol className="space-y-1.5 text-sm">
              {terlarisData.terlaris.map((p, i) => (
                <li key={p.produkId} className="flex justify-between">
                  <span>{i + 1}. {p.nama}</span>
                  <span className="text-slate-500">{p.totalTerjual} terjual</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="text-sm text-slate-400">Belum ada penjualan di rentang ini.</p>
          )}
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-700">Slow-Moving Stock</h2>
          {terlarisData?.slowMoving?.length ? (
            <ul className="space-y-1.5 text-sm text-slate-600">
              {terlarisData.slowMoving.map((p) => (
                <li key={p.id} className="flex justify-between">
                  <span>{p.nama}</span>
                  <span className="text-xs text-slate-400">{p.kategori}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400">Semua produk laku di rentang ini. 🎉</p>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Riwayat / Audit Log Terbaru</h2>
        <div className="max-h-80 space-y-2 overflow-y-auto">
          {auditLog.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-slate-100 pb-1.5 text-xs last:border-0">
              <span>
                <span className={t.jenisTransaksi === "masuk" ? "text-emerald-600" : "text-red-600"}>
                  {t.jenisTransaksi === "masuk" ? "▲" : "▼"} {t.produk.nama}
                </span>{" "}
                x{t.jumlah}
              </span>
              <span className="text-slate-400">
                {new Date(t.waktu).toLocaleString("id-ID")} · {t.sumber} {t.user ? `· ${t.user.nama}` : ""}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Kartu({ label, value, highlight }) {
  return (
    <div className={`rounded-xl border p-3.5 ${highlight ? "border-indigo-300 bg-indigo-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${highlight ? "text-indigo-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function DateField({ label, value, onChange }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-slate-600">{label}</label>
      <input type="date" value={value} onChange={(e) => onChange(e.target.value)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm" />
    </div>
  );
}

function firstOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}
