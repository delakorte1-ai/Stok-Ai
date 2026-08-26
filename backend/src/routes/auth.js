import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import prisma from "../services/prisma.js";
import { requireAuth } from "../middleware/auth.js";

const router = Router();

function signToken(user) {
  return jwt.sign({ sub: user.id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "7d",
  });
}

function toPublicUser(user) {
  const { passwordHash, ...rest } = user;
  return rest;
}

/**
 * Registrasi perusahaan baru + user owner pertama.
 * Ini adalah entrypoint onboarding tenant baru.
 */
router.post("/register", async (req, res) => {
  try {
    const { namaPerusahaan, jenisUsaha, namaUser, email, password } = req.body;
    if (!namaPerusahaan || !namaUser || !email || !password) {
      return res.status(400).json({ error: "Semua field wajib diisi." });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email sudah terdaftar." });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const perusahaan = await tx.perusahaan.create({
        data: { nama: namaPerusahaan, jenisUsaha: jenisUsaha || null },
      });
      const user = await tx.user.create({
        data: {
          perusahaanId: perusahaan.id,
          nama: namaUser,
          email,
          passwordHash,
          role: "owner",
        },
      });
      return { perusahaan, user };
    });

    const token = signToken(result.user);
    res.status(201).json({ token, user: toPublicUser(result.user), perusahaan: result.perusahaan });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mendaftar." });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || !user.aktif) {
      return res.status(401).json({ error: "Email atau password salah." });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Email atau password salah." });
    }
    const token = signToken(user);
    res.json({ token, user: toPublicUser(user) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal login." });
  }
});

router.get("/me", requireAuth, async (req, res) => {
  const perusahaan = await prisma.perusahaan.findUnique({ where: { id: req.perusahaanId } });
  res.json({ user: toPublicUser(req.user), perusahaan });
});

/**
 * Owner menambah user karyawan/kasir baru untuk perusahaannya.
 */
router.post("/users", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ error: "Hanya owner yang bisa menambah user." });
  }
  const { nama, email, password, role } = req.body;
  if (!nama || !email || !password) {
    return res.status(400).json({ error: "Semua field wajib diisi." });
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return res.status(409).json({ error: "Email sudah terdaftar." });

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      perusahaanId: req.perusahaanId,
      nama,
      email,
      passwordHash,
      role: role === "owner" ? "owner" : "karyawan",
    },
  });
  res.status(201).json(toPublicUser(user));
});

router.get("/users", requireAuth, async (req, res) => {
  const users = await prisma.user.findMany({ where: { perusahaanId: req.perusahaanId } });
  res.json(users.map(toPublicUser));
});

router.patch("/users/:id", requireAuth, async (req, res) => {
  if (req.user.role !== "owner") {
    return res.status(403).json({ error: "Hanya owner yang bisa mengubah user." });
  }
  const { nama, role, aktif } = req.body;
  const user = await prisma.user.findFirst({ where: { id: req.params.id, perusahaanId: req.perusahaanId } });
  if (!user) return res.status(404).json({ error: "User tidak ditemukan." });

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: {
      ...(nama !== undefined && { nama }),
      ...(role !== undefined && { role }),
      ...(aktif !== undefined && { aktif }),
    },
  });
  res.json(toPublicUser(updated));
});

export default router;
