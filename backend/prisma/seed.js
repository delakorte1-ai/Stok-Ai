// Seed data contoh: Toko Ban & Velg "Jaya Motor"
// Jalankan: npm run prisma:seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding data contoh toko ban & velg...");

  const perusahaan = await prisma.perusahaan.create({
    data: { nama: "Jaya Motor Ban & Velg", jenisUsaha: "Toko Ban & Velg" },
  });

  const passwordHash = await bcrypt.hash("password123", 10);
  await prisma.user.create({
    data: {
      perusahaanId: perusahaan.id,
      nama: "Pak Jaya (Owner)",
      email: "owner@jayamotor.test",
      passwordHash,
      role: "owner",
    },
  });
  await prisma.user.create({
    data: {
      perusahaanId: perusahaan.id,
      nama: "Budi (Kasir)",
      email: "kasir@jayamotor.test",
      passwordHash,
      role: "karyawan",
    },
  });

  const kategoriBan = await prisma.kategoriProduk.create({
    data: { perusahaanId: perusahaan.id, nama: "Ban", modeStok: "reguler" },
  });
  const kategoriVelg = await prisma.kategoriProduk.create({
    data: { perusahaanId: perusahaan.id, nama: "Velg", modeStok: "reguler" },
  });
  const kategoriBanSecond = await prisma.kategoriProduk.create({
    data: { perusahaanId: perusahaan.id, nama: "Ban Second", modeStok: "unit_unik" },
  });
  const kategoriPaketSecond = await prisma.kategoriProduk.create({
    data: { perusahaanId: perusahaan.id, nama: "Velg + Ban Second", modeStok: "unit_unik" },
  });
  const kategoriOli = await prisma.kategoriProduk.create({
    data: { perusahaanId: perusahaan.id, nama: "Oli", modeStok: "reguler" },
  });

  // Ban baru (reguler)
  await prisma.produk.createMany({
    data: [
      { perusahaanId: perusahaan.id, kategoriId: kategoriBan.id, nama: "Ban GT Radial 70/90 Ring 17", modal: 350000, hargaJualDefault: 420000, stok: 12, stokMinimum: 3 },
      { perusahaanId: perusahaan.id, kategoriId: kategoriBan.id, nama: "Ban FDR 80/90 Ring 17", modal: 300000, hargaJualDefault: 370000, stok: 8, stokMinimum: 3 },
      { perusahaanId: perusahaan.id, kategoriId: kategoriBan.id, nama: "Ban Corsa 90/80 Ring 14", modal: 250000, hargaJualDefault: 310000, stok: 2, stokMinimum: 3 },
    ],
  });

  // Velg baru (reguler)
  await prisma.produk.createMany({
    data: [
      { perusahaanId: perusahaan.id, kategoriId: kategoriVelg.id, nama: "Velg Racing Ring 17 Palang 6", modal: 800000, hargaJualDefault: 950000, stok: 6, stokMinimum: 2 },
      { perusahaanId: perusahaan.id, kategoriId: kategoriVelg.id, nama: "Velg Standar Ring 14", modal: 450000, hargaJualDefault: 550000, stok: 10, stokMinimum: 3 },
    ],
  });

  // Oli (reguler)
  await prisma.produk.createMany({
    data: [
      { perusahaanId: perusahaan.id, kategoriId: kategoriOli.id, nama: "Oli Federal Matic 800ml", modal: 35000, hargaJualDefault: 48000, stok: 25, stokMinimum: 5 },
    ],
  });

  // Ban second (unit unik, dijual terpisah)
  await prisma.produk.createMany({
    data: [
      { perusahaanId: perusahaan.id, kategoriId: kategoriBanSecond.id, nama: "Ban Second FDR 80/90 Ring 17", modal: 120000, hargaJualDefault: 175000, kondisi: "80%", statusUnitUnik: "tersedia" },
      { perusahaanId: perusahaan.id, kategoriId: kategoriBanSecond.id, nama: "Ban Second Corsa 90/80 Ring 14", modal: 90000, hargaJualDefault: 140000, kondisi: "70%", statusUnitUnik: "tersedia" },
    ],
  });

  // Velg + ban second (paket gabungan, unit unik)
  await prisma.produk.create({
    data: {
      perusahaanId: perusahaan.id,
      kategoriId: kategoriPaketSecond.id,
      nama: "Paket Velg Racing 17in + Ban FDR Second",
      modal: 950000,
      hargaJualDefault: 1350000,
      kondisi: "85%",
      statusUnitUnik: "tersedia",
      isPaket: true,
      keteranganPaket: "1 set velg racing ring 17 + ban FDR second kondisi 85%",
    },
  });

  console.log("Selesai. Login dengan:");
  console.log("  owner@jayamotor.test / password123 (role: owner)");
  console.log("  kasir@jayamotor.test / password123 (role: karyawan)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
