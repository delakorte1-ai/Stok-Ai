import { Router } from "express";
import prisma from "../services/prisma.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { findBestProductMatch } from "../services/fuzzyMatch.js";
import {
  tambahStokReguler,
  kurangiStokReguler,
  jualUnitUnik,
  StokError,
} from "../services/stokService.js";

const router = Router();
router.use(requireAuth);

// Daftar produk, dikelompokkan siap pakai per kategori di response
router.get("/", async (req, res) => {
  const { kategoriId, q } = req.query;
  const produk = await prisma.produk.findMany({
    where: {
      perusahaanId: req.perusahaanId,
      ...(kategoriId && { kategoriId }),
      ...(q && { nama: { contains: q } }),
    },
    include: { kategori: true },
    orderBy: { nama: "asc" },
  });
  res.json(produk);
});

router.get("/:id", async (req, res) => {
  const produk = await prisma.produk.findFirst({
    where: { id: req.params.id, perusahaanId: req.perusahaanId },
    include: {
      kategori: true,
      transaksiStok: { orderBy: { waktu: "desc" }, take: 50, include: { user: true } },
    },
  });
  if (!produk) return res.status(404).json({ error: "Produk tidak ditemukan." });
  res.json(produk);
});

// Tambah produk baru (reguler atau unit unik, tergantung mode kategorinya)
router.post("/", async (req, res) => {
  const {
    kategoriId,
    nama,
    modal,
    stok,
    stokMinimum,
    hargaJualDefault,
    kondisi,
    isPaket,
    keteranganPaket,
  } = req.body;

  if (!kategoriId || !nama) {
    return res.status(400).json({ error: "kategoriId dan nama wajib diisi." });
  }

  const kategori = await prisma.kategoriProduk.findFirst({
    where: { id: kategoriId, perusahaanId: req.perusahaanId },
  });
  if (!kategori) return res.status(404).json({ error: "Kategori tidak ditemukan." });

  const data = {
    perusahaanId: req.perusahaanId,
    kategoriId,
    nama,
    modal: modal ?? 0,
    hargaJualDefault: hargaJualDefault ?? null,
  };

  if (kategori.modeStok === "reguler") {
    data.stok = stok ?? 0;
    data.stokMinimum = stokMinimum ?? 0;
  } else {
    data.statusUnitUnik = "tersedia";
    data.kondisi = kondisi || null; // opsional, boleh kosong
    data.isPaket = Boolean(isPaket);
    data.keteranganPaket = keteranganPaket || null;
  }

  const produk = await prisma.produk.create({ data, include: { kategori: true } });

  // Catat sebagai transaksi "masuk" awal supaya riwayat konsisten
  if (kategori.modeStok === "reguler" && data.stok > 0) {
    await prisma.transaksiStok.create({
      data: {
        perusahaanId: req.perusahaanId,
        produkId: produk.id,
        userId: req.user.id,
        jenisTransaksi: "masuk",
        jumlah: data.stok,
        modalSaatIni: data.modal,
        sumber: "manual",
        keterangan: "Stok awal saat produk dibuat",
      },
    });
  }

  res.status(201).json(produk);
});

// Edit modal/harga/threshold — hanya owner yang boleh ubah modal & harga
router.patch("/:id", async (req, res) => {
  const produk = await prisma.produk.findFirst({
    where: { id: req.params.id, perusahaanId: req.perusahaanId },
  });
  if (!produk) return res.status(404).json({ error: "Produk tidak ditemukan." });

  const { nama, modal, hargaJualDefault, stokMinimum, kondisi } = req.body;

  if ((modal !== undefined || hargaJualDefault !== undefined) && req.user.role !== "owner") {
    return res.status(403).json({ error: "Hanya owner yang boleh mengubah modal/harga." });
  }

  const updated = await prisma.produk.update({
    where: { id: produk.id },
    data: {
      ...(nama !== undefined && { nama }),
      ...(modal !== undefined && { modal }),
      ...(hargaJualDefault !== undefined && { hargaJualDefault }),
      ...(stokMinimum !== undefined && { stokMinimum }),
      ...(kondisi !== undefined && { kondisi }),
    },
  });
  res.json(updated);
});

router.delete("/:id", requireRole("owner"), async (req, res) => {
  const produk = await prisma.produk.findFirst({
    where: { id: req.params.id, perusahaanId: req.perusahaanId },
  });
  if (!produk) return res.status(404).json({ error: "Produk tidak ditemukan." });
  await prisma.produk.delete({ where: { id: produk.id } });
  res.status(204).end();
});

// Endpoint pencarian fuzzy — dipakai AI layer & bisa juga dipakai UI pencarian cepat
router.get("/cari/fuzzy", async (req, res) => {
  const { q, kategoriId } = req.query;
  if (!q) return res.status(400).json({ error: "Parameter q wajib diisi." });

  const produkList = await prisma.produk.findMany({
    where: { perusahaanId: req.perusahaanId, ...(kategoriId && { kategoriId }) },
  });
  const result = findBestProductMatch(q, produkList);
  res.json(result);
});

// ---------------------------------------------------------------------------
// Aksi stok manual (dipakai form UI). AI layer memanggil endpoint yang SAMA
// via service function di bawah supaya tidak ada duplikasi logic.
// ---------------------------------------------------------------------------

router.post("/:id/tambah-stok", async (req, res) => {
  try {
    const { jumlah, modalBaru, keterangan } = req.body;
    const result = await tambahStokReguler({
      perusahaanId: req.perusahaanId,
      produkId: req.params.id,
      jumlah: Number(jumlah),
      modalBaru: modalBaru != null ? Number(modalBaru) : undefined,
      userId: req.user.id,
      sumber: "manual",
      keterangan,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof StokError) return res.status(400).json({ error: err.message, code: err.code });
    console.error(err);
    res.status(500).json({ error: "Gagal menambah stok." });
  }
});

router.post("/:id/kurangi-stok", async (req, res) => {
  try {
    const { jumlah, hargaJual, keterangan } = req.body;
    const result = await kurangiStokReguler({
      perusahaanId: req.perusahaanId,
      produkId: req.params.id,
      jumlah: Number(jumlah),
      hargaJual: hargaJual != null ? Number(hargaJual) : undefined,
      userId: req.user.id,
      sumber: "manual",
      keterangan,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof StokError) return res.status(400).json({ error: err.message, code: err.code });
    console.error(err);
    res.status(500).json({ error: "Gagal mengurangi stok." });
  }
});

router.post("/:id/jual-unit", async (req, res) => {
  try {
    const { hargaJual, keterangan } = req.body;
    const result = await jualUnitUnik({
      perusahaanId: req.perusahaanId,
      produkId: req.params.id,
      hargaJual: hargaJual != null ? Number(hargaJual) : undefined,
      userId: req.user.id,
      sumber: "manual",
      keterangan,
    });
    res.json(result);
  } catch (err) {
    if (err instanceof StokError) return res.status(400).json({ error: err.message, code: err.code });
    console.error(err);
    res.status(500).json({ error: "Gagal menjual unit." });
  }
});

export default router;
