import { Router } from "express";
import multer from "multer";
import xlsx from "xlsx";
import prisma from "../services/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { extractProductsFromText, extractProductsFromImage } from "../services/aiService.js";

const router = Router();
router.use(requireAuth);

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

/**
 * POST /api/import/teks
 * body: { teks: string }
 * Paste bebas ala pesan WhatsApp supplier -> AI ekstrak jadi array baris (preview, belum disimpan).
 */
router.post("/teks", async (req, res) => {
  try {
    const { teks } = req.body;
    if (!teks || !teks.trim()) return res.status(400).json({ error: "Teks tidak boleh kosong." });

    const items = await extractProductsFromText({ perusahaanId: req.perusahaanId, teks });
    res.json({ items: await enrichPreview(req.perusahaanId, items) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message?.includes("GROQ_API_KEY") ? err.message : "Gagal memproses teks." });
  }
});

/**
 * POST /api/import/foto  (multipart, field 'foto')
 * Upload foto daftar produk -> AI vision ekstrak jadi array baris (preview).
 */
router.post("/foto", upload.single("foto"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File foto wajib diupload." });
    const imageBase64 = req.file.buffer.toString("base64");
    const items = await extractProductsFromImage({
      perusahaanId: req.perusahaanId,
      imageBase64,
      mimeType: req.file.mimetype,
    });
    res.json({ items: await enrichPreview(req.perusahaanId, items) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message?.includes("GROQ_API_KEY") ? err.message : "Gagal memproses foto." });
  }
});

/**
 * POST /api/import/excel (multipart, field 'file')
 * Parse Excel/CSV murni (tanpa AI, header baku) -> preview.
 * Header yang didukung: nama, kategori, modal, stok, hargaJualDefault, kondisi
 */
router.post("/excel", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File Excel/CSV wajib diupload." });
    const workbook = xlsx.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet, { defval: null });

    const items = rows.map((r) => ({
      nama: r.nama ?? r.Nama ?? null,
      kategoriNama: r.kategori ?? r.Kategori ?? null,
      modal: r.modal ?? r.Modal ?? null,
      stok: r.stok ?? r.Stok ?? null,
      hargaJualDefault: r.hargaJualDefault ?? r.harga_jual ?? r.HargaJual ?? null,
      kondisi: r.kondisi ?? r.Kondisi ?? null,
      lengkap: Boolean((r.nama ?? r.Nama) && (r.kategori ?? r.Kategori) && (r.modal ?? r.Modal) != null),
      alasanTidakLengkap: null,
    }));

    res.json({ items: await enrichPreview(req.perusahaanId, items) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal membaca file Excel/CSV. Pastikan formatnya sesuai template." });
  }
});

/**
 * GET /api/import/template -> download template Excel kosong dengan header baku.
 */
router.get("/template", (req, res) => {
  const wb = xlsx.utils.book_new();
  const ws = xlsx.utils.aoa_to_sheet([
    ["nama", "kategori", "modal", "stok", "hargaJualDefault", "kondisi"],
    ["Ban GT Radial 70/90", "Ban", 350000, 10, 420000, ""],
    ["Velg Racing 17in", "Velg", 800000, 4, 950000, ""],
  ]);
  xlsx.utils.book_append_sheet(wb, ws, "Template");
  const buffer = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

  res.setHeader("Content-Disposition", "attachment; filename=template_import_produk.xlsx");
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.send(buffer);
});

/**
 * POST /api/import/komit
 * body: { items: [{ nama, kategoriNama, modeStokBaru?, modal, stok, hargaJualDefault, kondisi }, ...] }
 * Hanya baris yang sudah lengkap & sudah dikonfirmasi user di preview yang boleh dikirim ke sini.
 * Kategori yang belum ada akan dibuat otomatis (modeStokBaru wajib diisi untuk kategori baru).
 */
router.post("/komit", async (req, res) => {
  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Tidak ada item untuk disimpan." });
  }

  const hasil = { berhasil: [], gagal: [] };

  for (const item of items) {
    try {
      if (!item.nama || !item.kategoriNama || item.modal == null) {
        hasil.gagal.push({ item, alasan: "Data tidak lengkap (nama/kategori/modal wajib)." });
        continue;
      }

      let kategori = await prisma.kategoriProduk.findFirst({
        where: { perusahaanId: req.perusahaanId, nama: { equals: item.kategoriNama } },
      });
      if (!kategori) {
        if (!item.modeStokBaru || !["reguler", "unit_unik"].includes(item.modeStokBaru)) {
          hasil.gagal.push({ item, alasan: `Kategori "${item.kategoriNama}" belum ada dan modeStokBaru tidak valid.` });
          continue;
        }
        kategori = await prisma.kategoriProduk.create({
          data: { perusahaanId: req.perusahaanId, nama: item.kategoriNama, modeStok: item.modeStokBaru },
        });
      }

      const data = {
        perusahaanId: req.perusahaanId,
        kategoriId: kategori.id,
        nama: item.nama,
        modal: Number(item.modal),
        hargaJualDefault: item.hargaJualDefault != null ? Number(item.hargaJualDefault) : null,
      };
      if (kategori.modeStok === "reguler") {
        if (item.stok == null) {
          hasil.gagal.push({ item, alasan: "Stok wajib diisi untuk kategori mode reguler." });
          continue;
        }
        data.stok = Number(item.stok);
        data.stokMinimum = 0;
      } else {
        data.statusUnitUnik = "tersedia";
        data.kondisi = item.kondisi || null;
      }

      const produk = await prisma.produk.create({ data });

      if (kategori.modeStok === "reguler" && data.stok > 0) {
        await prisma.transaksiStok.create({
          data: {
            perusahaanId: req.perusahaanId,
            produkId: produk.id,
            userId: req.user.id,
            jenisTransaksi: "masuk",
            jumlah: data.stok,
            modalSaatIni: data.modal,
            sumber: "import_massal",
            keterangan: "Import massal",
          },
        });
      }

      hasil.berhasil.push(produk);
    } catch (err) {
      console.error(err);
      hasil.gagal.push({ item, alasan: "Kesalahan internal saat menyimpan." });
    }
  }

  res.json(hasil);
});

/**
 * Tambahkan info kelengkapan & kategori yang belum dikenal ke setiap baris preview,
 * supaya UI bisa menandai baris yang perlu klarifikasi user sebelum commit.
 */
async function enrichPreview(perusahaanId, items) {
  const kategoriList = await prisma.kategoriProduk.findMany({ where: { perusahaanId } });
  const kategoriNames = new Set(kategoriList.map((k) => k.nama.toLowerCase()));

  return items.map((item) => {
    const kategoriBaru = item.kategoriNama && !kategoriNames.has(String(item.kategoriNama).toLowerCase());
    const lengkap = Boolean(item.nama) && Boolean(item.kategoriNama) && item.modal != null && (!kategoriBaru || item.modeStokBaru);
    return {
      ...item,
      kategoriBaru,
      lengkap: item.lengkap === false ? false : lengkap,
    };
  });
}

export default router;
