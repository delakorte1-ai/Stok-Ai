import { PrismaClient } from "@prisma/client";

// Singleton Prisma client dipakai di seluruh backend supaya connection pool
// tidak dibuat berulang-ulang (penting terutama saat hot-reload di development).
export const prisma = new PrismaClient();

export default prisma;
