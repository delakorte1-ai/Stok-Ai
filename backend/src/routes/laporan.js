import { Router } from "express";
import prisma from "../services/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { getProdukStokMenipis } from "../services/stokService.js";

const router = Router();
router.use(requireAuth);

function parseDateRange(query) {
  const now = new Date();
  const dari = query.dari ? new Date(query.dari) : new Date(now.getFullYear(), now.getMonth(), 1);
  const sampai = query.sampai ? new Date(query.sampai) : now;
  return { dari, sampai };
}

// Ringkasan kartu dashboard: total produk, nilai modal stok, jumlah stok menipis
router.get("/ringkasan", async (req, res) => {
  const produk = await prisma.produk.findMany({
    where: { perusahaanId: req.perusahaanId },
    include: { kategori: true },
  });

  const totalProduk = produk.length;
  const nilaiModalStok = produk.reduce((sum, p) => {
    if (p.kategori.modeStok === "reguler") return sum + p.modal * (p.stok ?? 0);
    return sum + (p.statusUnitUnik === "tersedia" ? p.modal : 0);
  }, 0);
  const stokMenipis = await getProdukStokMenipis(req.perusahaanId);

  res.json({
    totalProduk,
    nilaiModalStok,
    jumlahStokMenipis: stokMenipis.length,
    produkStokMenipis: stokMenipis.map((p) => ({ id: p.id, nama: p.nama, stok: p.stok, stokMinimum: p.stokMinimum })),
  });
});

// Laba-rugi: agregasi dari transaksi_stok jenis 'keluar' pakai snapshot modal & harga
router.get("/laba-rugi", async (req, res) => {
  const { dari, sampai } = parseDateRange(req.query);

  const transaksi = await prisma.transaksiStok.findMany({
    where: {
      perusahaanId: req.perusahaanId,
      jenisTransaksi: "keluar",
      waktu: { gte: dari, lte: sampai },
    },
    include: { produk: true },
    orderBy: { waktu: "asc" },
  });

  let totalPendapatan = 0;
  let totalModal = 0;
  const perHari = {};

  for (const t of transaksi) {
    const pendapatan = (t.hargaJualSaatIni ?? 0) * t.jumlah;
    const modal = t.modalSaatIni * t.jumlah;
    totalPendapatan += pendapatan;
    totalModal += modal;

    const hari = t.waktu.toISOString().slice(0, 10);
    if (!perHari[hari]) perHari[hari] = { tanggal: hari, pendapatan: 0, modal: 0, laba: 0 };
    perHari[hari].pendapatan += pendapatan;
    perHari[hari].modal += modal;
    perHari[hari].laba += pendapatan - modal;
  }

  res.json({
    dari: dari.toISOString(),
    sampai: sampai.toISOString(),
    totalPendapatan,
    totalModal,
    totalLaba: totalPendapatan - totalModal,
    perHari: Object.values(perHari).sort((a, b) => a.tanggal.localeCompare(b.tanggal)),
  });
});

// Produk terlaris & slow-moving berdasarkan jumlah transaksi keluar dalam rentang waktu
router.get("/produk-terlaris", async (req, res) => {
  const { dari, sampai } = parseDateRange(req.query);

  const transaksi = await prisma.transaksiStok.findMany({
    where: { perusahaanId: req.perusahaanId, jenisTransaksi: "keluar", waktu: { gte: dari, lte: sampai } },
    include: { produk: true },
  });

  const agg = {};
  for (const t of transaksi) {
    if (!agg[t.produkId]) {
      agg[t.produkId] = { produkId: t.produkId, nama: t.produk.nama, totalTerjual: 0, totalPendapatan: 0 };
    }
    agg[t.produkId].totalTerjual += t.jumlah;
    agg[t.produkId].totalPendapatan += (t.hargaJualSaatIni ?? 0) * t.jumlah;
  }

  const terlaris = Object.values(agg).sort((a, b) => b.totalTerjual - a.totalTerjual);

  // Slow-moving: semua produk aktif yang TIDAK muncul di transaksi rentang waktu ini
  const semuaProduk = await prisma.produk.findMany({
    where: { perusahaanId: req.perusahaanId },
    include: { kategori: true },
  });
  const terjualIds = new Set(Object.keys(agg));
  const slowMoving = semuaProduk
    .filter((p) => {
      const adaStok = p.kategori.modeStok === "reguler" ? (p.stok ?? 0) > 0 : p.statusUnitUnik === "tersedia";
      return adaStok && !terjualIds.has(p.id);
    })
    .map((p) => ({ id: p.id, nama: p.nama, kategori: p.kategori.nama }));

  res.json({ terlaris: terlaris.slice(0, 20), slowMoving: slowMoving.slice(0, 50) });
});

// Riwayat/log semua perubahan stok untuk audit
router.get("/audit-log", async (req, res) => {
  const { produkId, userId, limit } = req.query;
  const logs = await prisma.transaksiStok.findMany({
    where: {
      perusahaanId: req.perusahaanId,
      ...(produkId && { produkId }),
      ...(userId && { userId }),
    },
    include: { produk: true, user: true },
    orderBy: { waktu: "desc" },
    take: limit ? Number(limit) : 100,
  });
  res.json(logs);
});

export default router;
