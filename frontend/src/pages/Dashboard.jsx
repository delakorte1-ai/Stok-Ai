import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import NewCategoryModal from "../components/NewCategoryModal";
import NewProductModal from "../components/NewProductModal";

export default function Dashboard() {
  const [ringkasan, setRingkasan] = useState(null);
  const [kategori, setKategori] = useState([]);
  const [produk, setProduk] = useState([]);
  const [activeKategori, setActiveKategori] = useState("semua");
  const [showNewCategory, setShowNewCategory] = useState(false);
  const [showNewProduct, setShowNewProduct] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [r1, r2, r3] = await Promise.all([
      api.get("/laporan/ringkasan"),
      api.get("/kategori"),
      api.get("/produk"),
    ]);
    setRingkasan(r1.data);
    setKategori(r2.data);
    setProduk(r3.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const produkTampil =
    activeKategori === "semua" ? produk : produk.filter((p) => p.kategoriId === activeKategori);

  const grouped = kategori
    .filter((k) => activeKategori === "semua" || k.id === activeKategori)
    .map((k) => ({ kategori: k, produk: produkTampil.filter((p) => p.kategoriId === k.id) }))
    .filter((g) => g.produk.length > 0);

  if (loading) return <p className="text-sm text-slate-500">Memuat data…</p>;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Kartu label="Total Produk" value={ringkasan.totalProduk} />
        <Kartu label="Nilai Modal Stok" value={formatRupiah(ringkasan.nilaiModalStok)} />
        <Kartu
          label="Stok Menipis"
          value={ringkasan.jumlahStokMenipis}
          warn={ringkasan.jumlahStokMenipis > 0}
        />
        <Kartu label="Kategori" value={kategori.length} />
      </div>

      {ringkasan.jumlahStokMenipis > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
          ⚠️ Stok menipis: {ringkasan.produkStokMenipis.map((p) => `${p.nama} (${p.stok})`).join(", ")}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5 overflow-x-auto scrollbar-thin pb-1">
          <TabButton active={activeKategori === "semua"} onClick={() => setActiveKategori("semua")}>
            Semua
          </TabButton>
          {kategori.map((k) => (
            <TabButton key={k.id} active={activeKategori === k.id} onClick={() => setActiveKategori(k.id)}>
              {k.nama} <span className="text-[10px] opacity-70">({k._count?.produk ?? 0})</span>
            </TabButton>
          ))}
          <button
            onClick={() => setShowNewCategory(true)}
            className="shrink-0 rounded-full border border-dashed border-slate-300 px-3 py-1.5 text-sm text-slate-500 hover:bg-slate-50"
          >
            + Kategori
          </button>
        </div>
        <button
          onClick={() => setShowNewProduct(true)}
          className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          + Produk
        </button>
      </div>

      {grouped.length === 0 && (
        <p className="rounded-xl border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          Belum ada produk di kategori ini. Tambah lewat tombol di atas atau chat AI.
        </p>
      )}

      {grouped.map((g) => (
        <div key={g.kategori.id}>
          <h2 className="mb-2 text-sm font-semibold text-slate-700">
            {g.kategori.nama} <span className="font-normal text-slate-400">({g.kategori.modeStok === "reguler" ? "Reguler" : "Unit Unik"})</span>
          </h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {g.produk.map((p) => (
              <ProdukCard key={p.id} produk={p} />
            ))}
          </div>
        </div>
      ))}

      {showNewCategory && (
        <NewCategoryModal onClose={() => setShowNewCategory(false)} onCreated={load} />
      )}
      {showNewProduct && (
        <NewProductModal kategori={kategori} onClose={() => setShowNewProduct(false)} onCreated={load} />
      )}
    </div>
  );
}

function Kartu({ label, value, warn }) {
  return (
    <div className={`rounded-xl border p-3.5 ${warn ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`mt-1 text-lg font-semibold ${warn ? "text-amber-700" : "text-slate-900"}`}>{value}</p>
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium transition-colors ${
        active ? "bg-indigo-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {children}
    </button>
  );
}

function ProdukCard({ produk }) {
  const isUnitUnik = produk.stok === null;
  return (
    <Link
      to={`/produk/${produk.id}`}
      className="block rounded-xl border border-slate-200 bg-white p-3.5 hover:border-indigo-300 hover:shadow-sm"
    >
      <p className="truncate text-sm font-medium text-slate-900">{produk.nama}</p>
      <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
        <span>Modal: {formatRupiah(produk.modal)}</span>
        {isUnitUnik ? (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              produk.statusUnitUnik === "tersedia" ? "bg-emerald-100 text-emerald-700" : "bg-slate-200 text-slate-500"
            }`}
          >
            {produk.statusUnitUnik === "tersedia" ? "Tersedia" : "Habis"}
          </span>
        ) : (
          <span
            className={`rounded-full px-2 py-0.5 font-medium ${
              produk.stok <= (produk.stokMinimum ?? 0) ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-600"
            }`}
          >
            Stok: {produk.stok}
          </span>
        )}
      </div>
      {produk.kondisi && <p className="mt-1 text-[11px] text-slate-400">Kondisi: {produk.kondisi}</p>}
    </Link>
  );
}

export function formatRupiah(n) {
  if (n == null) return "-";
  return "Rp" + Number(n).toLocaleString("id-ID");
}
