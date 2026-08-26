import jwt from "jsonwebtoken";
import prisma from "../services/prisma.js";

/**
 * Middleware autentikasi: verifikasi JWT dan lampirkan req.user + req.perusahaanId.
 * Semua route di bawah middleware ini otomatis di-scope ke perusahaan milik user
 * yang login — ini adalah pertahanan utama isolasi data multi-tenant.
 */
export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      return res.status(401).json({ error: "Token tidak ditemukan. Silakan login." });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await prisma.user.findUnique({ where: { id: payload.sub } });

    if (!user || !user.aktif) {
      return res.status(401).json({ error: "Sesi tidak valid. Silakan login ulang." });
    }

    req.user = user;
    req.perusahaanId = user.perusahaanId; // dipakai semua query untuk isolasi tenant
    next();
  } catch (err) {
    return res.status(401).json({ error: "Token tidak valid atau kedaluwarsa." });
  }
}

/**
 * Middleware role guard: hanya izinkan role tertentu (misal owner) untuk
 * aksi sensitif seperti ubah modal/harga atau kelola user.
 */
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Anda tidak punya izin untuk aksi ini." });
    }
    next();
  };
}
