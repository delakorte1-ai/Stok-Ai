import prisma from "./prisma.js";

export class StokError extends Error {
  constructor(message, code = "STOK_ERROR") {
    super(message);
    this.code = code;
  }
}

/**
 * Tambah stok (barang masuk) untuk produk mode "reguler".
 * modalBaru opsional: kalau supplier kirim barang dengan modal baru, dicatat
 * sebagai modal terkini produk (dipakai untuk hitung untung transaksi keluar berikutnya).
 */
export async function tambahStokReguler({ perusahaanId, produkId, jumlah, modalBaru, userId, sumber = "manual", keterangan }) {
  return prisma.$transaction(async (tx) => {
    const produk = await tx.produk.findFirst({ where: { id: produkId, perusahaanId } });
    if (!produk) throw new StokError("Produk tidak ditemukan.", "NOT_FOUND");

    const kategori = await tx.kategoriProduk.findUnique({ where: { id: produk.kategoriId } });
    if (kategori.modeStok !== "reguler") {
      throw new StokError("Produk ini bermode unit unik, gunakan aksi tambah unit baru.", "WRONG_MODE");
    }
    if (jumlah <= 0) throw new StokError("Jumlah harus lebih dari 0.", "INVALID_QTY");

    const modalDipakai = modalBaru ?? produk.modal;

    const updated = await tx.produk.update({
      where: { id: produkId },
      data: {
        stok: (produk.stok ?? 0) + jumlah,
        modal: modalDipakai,
      },
    });

    const trx = await tx.transaksiStok.create({
      data: {
        perusahaanId,
        produkId,
        userId,
        jenisTransaksi: "masuk",
        jumlah,
        modalSaatIni: modalDipakai,
        sumber,
        keterangan,
      },
    });

    return { produk: updated, transaksi: trx };
  });
}

/**
 * Kurangi stok (barang keluar/jual) untuk produk mode "reguler".
 * hargaJual opsional: kalau tidak diisi, pakai hargaJualDefault produk.
 */
export async function kurangiStokReguler({ perusahaanId, produkId, jumlah, hargaJual, userId, sumber = "manual", keterangan }) {
  return prisma.$transaction(async (tx) => {
    const produk = await tx.produk.findFirst({ where: { id: produkId, perusahaanId } });
    if (!produk) throw new StokError("Produk tidak ditemukan.", "NOT_FOUND");

    const kategori = await tx.kategoriProduk.findUnique({ where: { id: produk.kategoriId } });
    if (kategori.modeStok !== "reguler") {
      throw new StokError("Produk ini bermode unit unik, gunakan aksi jual unit.", "WRONG_MODE");
    }
    if (jumlah <= 0) throw new StokError("Jumlah harus lebih dari 0.", "INVALID_QTY");

    const stokTersedia = produk.stok ?? 0;
    if (stokTersedia < jumlah) {
      throw new StokError(
        `Stok tidak cukup. Stok "${produk.nama}" tersisa ${stokTersedia}, diminta ${jumlah}.`,
        "INSUFFICIENT_STOCK"
      );
    }

    const hargaDipakai = hargaJual ?? produk.hargaJualDefault ?? null;

    const updated = await tx.produk.update({
      where: { id: produkId },
      data: { stok: stokTersedia - jumlah },
    });

    const trx = await tx.transaksiStok.create({
      data: {
        perusahaanId,
        produkId,
        userId,
        jenisTransaksi: "keluar",
        jumlah,
        hargaJualSaatIni: hargaDipakai,
        modalSaatIni: produk.modal,
        sumber,
        keterangan,
      },
    });

    return {
      produk: updated,
      transaksi: trx,
      untung: hargaDipakai != null ? (hargaDipakai - produk.modal) * jumlah : null,
    };
  });
}

/**
 * Jual satu unit produk unit_unik. Setelah terjual, status jadi "habis" tanpa
 * stok pengganti otomatis (sesuai spesifikasi barang second/paket).
 */
export async function jualUnitUnik({ perusahaanId, produkId, hargaJual, userId, sumber = "manual", keterangan }) {
  return prisma.$transaction(async (tx) => {
    const produk = await tx.produk.findFirst({ where: { id: produkId, perusahaanId } });
    if (!produk) throw new StokError("Produk tidak ditemukan.", "NOT_FOUND");

    const kategori = await tx.kategoriProduk.findUnique({ where: { id: produk.kategoriId } });
    if (kategori.modeStok !== "unit_unik") {
      throw new StokError("Produk ini bermode reguler, gunakan aksi kurangi stok.", "WRONG_MODE");
    }
    if (produk.statusUnitUnik === "habis") {
      throw new StokError(`Unit "${produk.nama}" sudah terjual/habis sebelumnya.`, "ALREADY_SOLD");
    }

    const hargaDipakai = hargaJual ?? produk.hargaJualDefault ?? null;

    const updated = await tx.produk.update({
      where: { id: produkId },
      data: { statusUnitUnik: "habis" },
    });

    const trx = await tx.transaksiStok.create({
      data: {
        perusahaanId,
        produkId,
        userId,
        jenisTransaksi: "keluar",
        jumlah: 1,
        hargaJualSaatIni: hargaDipakai,
        modalSaatIni: produk.modal,
        sumber,
        keterangan,
      },
    });

    return {
      produk: updated,
      transaksi: trx,
      untung: hargaDipakai != null ? hargaDipakai - produk.modal : null,
    };
  });
}

/**
 * Cek produk dengan stok menipis (mode reguler, stok <= stokMinimum) atau
 * unit unik yang belum terjual tapi sudah lama nganggur bisa dicek terpisah di laporan slow-moving.
 */
export async function getProdukStokMenipis(perusahaanId) {
  const produk = await prisma.produk.findMany({
    where: { perusahaanId },
    include: { kategori: true },
  });

  return produk.filter(
    (p) =>
      p.kategori.modeStok === "reguler" &&
      p.stok !== null &&
      p.stok <= (p.stokMinimum ?? 0)
  );
}
