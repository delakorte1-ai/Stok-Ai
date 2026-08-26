import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

import authRoutes from "./routes/auth.js";
import kategoriRoutes from "./routes/kategori.js";
import produkRoutes from "./routes/produk.js";
import laporanRoutes from "./routes/laporan.js";
import chatRoutes from "./routes/chat.js";
import importRoutes from "./routes/import.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || "*" }));
app.use(express.json({ limit: "10mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true, waktu: new Date().toISOString() }));

app.use("/api/auth", authRoutes);
app.use("/api/kategori", kategoriRoutes);
app.use("/api/produk", produkRoutes);
app.use("/api/laporan", laporanRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/import", importRoutes);

// ---------------------------------------------------------------------------
// Sajikan frontend (hasil `npm run build` di folder frontend) dari server yang
// SAMA supaya deploy cukup satu layanan (satu proses, satu URL, satu port).
// Folder ini diisi otomatis oleh Dockerfile / script deploy — lihat README.
// ---------------------------------------------------------------------------
const frontendDist = path.join(__dirname, "../public");
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  // Semua rute selain /api/* diarahkan ke index.html (SPA routing di React Router)
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"));
  });
}

// Error handler terakhir untuk error tak terduga (mis. multer file terlalu besar)
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || "Terjadi kesalahan server." });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Server Stok AI berjalan di http://localhost:${PORT}`);
  if (!fs.existsSync(frontendDist)) {
    console.log("(Mode development: frontend belum di-build ke ../public, jalankan frontend terpisah dengan `npm run dev`.)");
  }
});
