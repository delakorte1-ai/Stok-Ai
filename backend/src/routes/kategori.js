import { Router } from "express";
import prisma from "../services/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
router.use(requireAuth);

// Daftar semua kategori milik perusahaan (custom, tidak hardcode)
router.get("/", async (req, res) => {
  const kategori = await prisma.kategoriProduk.findMany({
    where: { perusahaanId: req.perusahaanId },
    include: { _count: { select: { produk: true } } },
    orderBy: { createdAt: "asc" },
  });
  res.json(kategori);
});

// Tambah kategori baru kapan saja lewat UI, dengan mode stok reguler/unit_unik
router.post("/", async (req, res) => {
  const { nama, modeStok } = req.body;
  if (!nama) return res.status(400).json({ error: "Nama kategori wajib diisi." });
  if (!["reguler", "unit_unik"].includes(modeStok)) {
    return res.status(400).json({ error: "modeStok harus 'reguler' atau 'unit_unik'." });
  }

  const existing = await prisma.kategoriProduk.findFirst({
    where: { perusahaanId: req.perusahaanId, nama: { equals: nama } },
  });
  if (existing) return res.status(409).json({ error: "Kategori dengan nama ini sudah ada." });

  const kategori = await prisma.kategoriProduk.create({
    data: { perusahaanId: req.perusahaanId, nama, modeStok },
  });
  res.status(201).json(kategori);
});

router.patch("/:id", async (req, res) => {
  const { nama } = req.body; // modeStok sengaja tidak boleh diubah setelah ada produk, untuk konsistensi data
  const kategori = await prisma.kategoriProduk.findFirst({
    where: { id: req.params.id, perusahaanId: req.perusahaanId },
  });
  if (!kategori) return res.status(404).json({ error: "Kategori tidak ditemukan." });

  const updated = await prisma.kategoriProduk.update({
    where: { id: kategori.id },
    data: { ...(nama !== undefined && { nama }) },
  });
  res.json(updated);
});

router.delete("/:id", async (req, res) => {
  const kategori = await prisma.kategoriProduk.findFirst({
    where: { id: req.params.id, perusahaanId: req.perusahaanId },
    include: { _count: { select: { produk: true } } },
  });
  if (!kategori) return res.status(404).json({ error: "Kategori tidak ditemukan." });
  if (kategori._count.produk > 0) {
    return res.status(400).json({ error: "Kategori masih punya produk, tidak bisa dihapus." });
  }
  await prisma.kategoriProduk.delete({ where: { id: kategori.id } });
  res.status(204).end();
});

export default router;
