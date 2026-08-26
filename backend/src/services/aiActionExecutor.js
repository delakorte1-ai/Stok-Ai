import prisma from "./prisma.js";
import { findBestProductMatch } from "./fuzzyMatch.js";
import {
  tambahStokReguler,
  kurangiStokReguler,
  jualUnitUnik,
  StokError,
} from "./stokService.js";

/**
 * Eksekutor aksi yang dipanggil AI (tool use). Ini satu-satunya jembatan
 * antara "instruksi" yang dihasilkan AI dan database sungguhan.
 *
 * PENTING (keamanan data): AI TIDAK PERNAH menyentuh Prisma/DB secara langsung.
 * AI hanya menghasilkan { nama_aksi, parameter }. Fungsi-fungsi di file ini
 * yang memvalidasi (produk ada? stok cukup? data lengkap?) sebelum memanggil
 * service yang sama persis dipakai oleh endpoint REST manual (produk.js).
 * Setiap fungsi mengembalikan salah satu status:
 *   - ok                  : aksi berhasil dieksekusi
 *   - butuh_klarifikasi    : ambigu / data kurang, TIDAK ada perubahan ke DB
 *   - gagal               : error tervalidasi (mis. stok tidak cukup)
 */

async function resolveProduk({ perusahaanId, kategoriId, produkNama, produkId }) {
  if (produkId) {
    const produk = await prisma.produk.findFirst({ where: { id: produkId, perusahaanId } });
    return produk
      ? { status: "ok", produk }
      : { status: "gagal", pesan: `Produk dengan id ${produkId} tidak ditemukan.` };
  }

  if (!produkNama) {
    return { status: "butuh_klarifikasi", pesan: "Nama produk tidak disebutkan." };
  }

  const produkList = await prisma.produk.findMany({
    where: { perusahaanId, ...(kategoriId && { kategoriId }) },
  });
  const match = findBestProductMatch(produkNama, produkList);

  if (match.status === "match") {
    return { status: "ok", produk: match.match };
  }
  if (match.status === "ambiguous") {
    return {
      status: "butuh_klarifikasi",
      pesan: `Nama produk "${produkNama}" cocok dengan beberapa produk, mana yang dimaksud?`,
      kandidat: match.candidates.map((c) => ({ id: c.produk.id, nama: c.produk.nama, skor: c.score })),
    };
  }
  return {
    status: "butuh_klarifikasi",
    pesan: `Produk "${produkNama}" tidak ditemukan di data. Apakah ini produk baru yang ingin ditambahkan, atau maksud kamu produk lain?`,
  };
}

export async function actionTambahProduk({ perusahaanId, userId, args }) {
  const { kategoriNama, nama, modal, stok, stokMinimum, hargaJualDefault, kondisi, isPaket, keteranganPaket } = args;

  if (!nama || !kategoriNama) {
    return { status: "butuh_klarifikasi", pesan: "Nama produk dan kategori wajib disebutkan untuk menambah produk baru." };
  }

  const kategori = await prisma.kategoriProduk.findFirst({
    where: { perusahaanId, nama: { equals: kategoriNama } },
  });
  if (!kategori) {
    return {
      status: "butuh_klarifikasi",
      pesan: `Kategori "${kategoriNama}" belum ada. Mau dibuat kategori baru dulu (dan pilih mode stok reguler atau unit unik), atau salah ketik nama kategori?`,
    };
  }

  if (kategori.modeStok === "reguler" && (stok === undefined || stok === null)) {
    return { status: "butuh_klarifikasi", pesan: `Jumlah stok awal untuk "${nama}" belum disebutkan.` };
  }
  if (modal === undefined || modal === null) {
    return { status: "butuh_klarifikasi", pesan: `Modal/harga beli untuk "${nama}" belum disebutkan.` };
  }

  const data = {
    perusahaanId,
    kategoriId: kategori.id,
    nama,
    modal: Number(modal),
    hargaJualDefault: hargaJualDefault != null ? Number(hargaJualDefault) : null,
  };
  if (kategori.modeStok === "reguler") {
    data.stok = Number(stok);
    data.stokMinimum = stokMinimum != null ? Number(stokMinimum) : 0;
  } else {
    data.statusUnitUnik = "tersedia";
    data.kondisi = kondisi || null;
    data.isPaket = Boolean(isPaket);
    data.keteranganPaket = keteranganPaket || null;
  }

  const produk = await prisma.produk.create({ data });

  if (kategori.modeStok === "reguler" && data.stok > 0) {
    await prisma.transaksiStok.create({
      data: {
        perusahaanId,
        produkId: produk.id,
        userId,
        jenisTransaksi: "masuk",
        jumlah: data.stok,
        modalSaatIni: data.modal,
        sumber: "chat_ai",
        keterangan: "Produk baru via chat AI",
      },
    });
  }

  return { status: "ok", pesan: `Produk "${nama}" berhasil ditambahkan.`, produk };
}

export async function actionTambahKategori({ perusahaanId, args }) {
  const { nama, modeStok } = args;
  if (!nama) return { status: "butuh_klarifikasi", pesan: "Nama kategori belum disebutkan." };
  if (!["reguler", "unit_unik"].includes(modeStok)) {
    return {
      status: "butuh_klarifikasi",
      pesan: `Kategori "${nama}" mode stoknya reguler (barang seragam) atau unit unik (setiap barang beda, misal second)?`,
    };
  }
  const existing = await prisma.kategoriProduk.findFirst({ where: { perusahaanId, nama: { equals: nama } } });
  if (existing) return { status: "gagal", pesan: `Kategori "${nama}" sudah ada.` };

  const kategori = await prisma.kategoriProduk.create({ data: { perusahaanId, nama, modeStok } });
  return { status: "ok", pesan: `Kategori "${nama}" (${modeStok}) berhasil dibuat.`, kategori };
}

export async function actionTambahStok({ perusahaanId, userId, args }) {
  const { produkNama, produkId, jumlah, modalBaru, keterangan } = args;
  if (jumlah === undefined || jumlah === null || Number(jumlah) <= 0) {
    return { status: "butuh_klarifikasi", pesan: `Jumlah stok masuk untuk "${produkNama || produkId}" belum jelas.` };
  }

  const resolved = await resolveProduk({ perusahaanId, produkNama, produkId });
  if (resolved.status !== "ok") return resolved;

  try {
    const result = await tambahStokReguler({
      perusahaanId,
      produkId: resolved.produk.id,
      jumlah: Number(jumlah),
      modalBaru: modalBaru != null ? Number(modalBaru) : undefined,
      userId,
      sumber: "chat_ai",
      keterangan,
    });
    return {
      status: "ok",
      pesan: `Stok "${resolved.produk.nama}" bertambah ${jumlah}, sekarang ${result.produk.stok}.`,
      data: result,
    };
  } catch (err) {
    if (err instanceof StokError) return { status: "gagal", pesan: err.message };
    throw err;
  }
}

export async function actionKurangiStok({ perusahaanId, userId, args }) {
  const { produkNama, produkId, jumlah, hargaJual, keterangan } = args;
  if (jumlah === undefined || jumlah === null || Number(jumlah) <= 0) {
    return { status: "butuh_klarifikasi", pesan: `Jumlah yang terjual/keluar untuk "${produkNama || produkId}" belum jelas.` };
  }

  const resolved = await resolveProduk({ perusahaanId, produkNama, produkId });
  if (resolved.status !== "ok") return resolved;

  // Kalau produk yang cocok ternyata mode unit_unik, arahkan ke aksi jual_unit
  const kategori = await prisma.kategoriProduk.findUnique({ where: { id: resolved.produk.kategoriId } });
  if (kategori.modeStok === "unit_unik") {
    return actionJualUnit({ perusahaanId, userId, args: { produkId: resolved.produk.id, hargaJual, keterangan } });
  }

  try {
    const result = await kurangiStokReguler({
      perusahaanId,
      produkId: resolved.produk.id,
      jumlah: Number(jumlah),
      hargaJual: hargaJual != null ? Number(hargaJual) : undefined,
      userId,
      sumber: "chat_ai",
      keterangan,
    });
    const untungText = result.untung != null ? ` Untung: Rp${result.untung.toLocaleString("id-ID")}.` : "";
    return {
      status: "ok",
      pesan: `"${resolved.produk.nama}" terjual ${jumlah}, sisa stok ${result.produk.stok}.${untungText}`,
      data: result,
    };
  } catch (err) {
    if (err instanceof StokError) return { status: "gagal", pesan: err.message };
    throw err;
  }
}

export async function actionJualUnit({ perusahaanId, userId, args }) {
  const { produkNama, produkId, hargaJual, keterangan } = args;
  const resolved = await resolveProduk({ perusahaanId, produkNama, produkId });
  if (resolved.status !== "ok") return resolved;

  try {
    const result = await jualUnitUnik({
      perusahaanId,
      produkId: resolved.produk.id,
      hargaJual: hargaJual != null ? Number(hargaJual) : undefined,
      userId,
      sumber: "chat_ai",
      keterangan,
    });
    const untungText = result.untung != null ? ` Untung: Rp${result.untung.toLocaleString("id-ID")}.` : "";
    return { status: "ok", pesan: `"${resolved.produk.nama}" terjual.${untungText}`, data: result };
  } catch (err) {
    if (err instanceof StokError) return { status: "gagal", pesan: err.message };
    throw err;
  }
}

export async function actionQueryAnalitik({ perusahaanId, args }) {
  const { jenis, dari, sampai } = args;
  const dariDate = dari ? new Date(dari) : new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const sampaiDate = sampai ? new Date(sampai) : new Date();

  if (jenis === "stok_menipis") {
    const produk = await prisma.produk.findMany({ where: { perusahaanId }, include: { kategori: true } });
    const menipis = produk.filter((p) => p.kategori.modeStok === "reguler" && p.stok !== null && p.stok <= (p.stokMinimum ?? 0));
    return { status: "ok", data: menipis.map((p) => ({ nama: p.nama, stok: p.stok, stokMinimum: p.stokMinimum })) };
  }

  const transaksi = await prisma.transaksiStok.findMany({
    where: { perusahaanId, jenisTransaksi: "keluar", waktu: { gte: dariDate, lte: sampaiDate } },
    include: { produk: true },
  });

  if (jenis === "produk_terlaris") {
    const agg = {};
    for (const t of transaksi) {
      agg[t.produkId] = agg[t.produkId] || { nama: t.produk.nama, totalTerjual: 0 };
      agg[t.produkId].totalTerjual += t.jumlah;
    }
    const hasil = Object.values(agg).sort((a, b) => b.totalTerjual - a.totalTerjual).slice(0, 10);
    return { status: "ok", data: hasil };
  }

  // default: laba_rugi
  let totalPendapatan = 0;
  let totalModal = 0;
  for (const t of transaksi) {
    totalPendapatan += (t.hargaJualSaatIni ?? 0) * t.jumlah;
    totalModal += t.modalSaatIni * t.jumlah;
  }
  return {
    status: "ok",
    data: {
      dari: dariDate.toISOString().slice(0, 10),
      sampai: sampaiDate.toISOString().slice(0, 10),
      totalPendapatan,
      totalModal,
      totalLaba: totalPendapatan - totalModal,
      jumlahTransaksi: transaksi.length,
    },
  };
}

const ACTION_HANDLERS = {
  tambah_produk: actionTambahProduk,
  tambah_kategori: actionTambahKategori,
  tambah_stok: actionTambahStok,
  kurangi_stok: actionKurangiStok,
  jual_unit: actionJualUnit,
  query_analitik: actionQueryAnalitik,
};

export async function executeAiAction(actionName, args, { perusahaanId, userId }) {
  const handler = ACTION_HANDLERS[actionName];
  if (!handler) {
    return { status: "gagal", pesan: `Aksi "${actionName}" tidak dikenal.` };
  }
  try {
    return await handler({ perusahaanId, userId, args });
  } catch (err) {
    console.error(`Error menjalankan aksi ${actionName}:`, err);
    return { status: "gagal", pesan: "Terjadi kesalahan internal saat menjalankan aksi." };
  }
}
