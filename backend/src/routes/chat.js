import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import { chatWithAI } from "../services/aiService.js";

const router = Router();
router.use(requireAuth);

/**
 * POST /api/chat
 * body: { messages: [{role:'user'|'assistant', content:string}, ...] }
 * Frontend menyimpan riwayat chat di sisi client dan mengirim beberapa pesan
 * terakhir setiap request (stateless di backend, sederhana untuk versi awal).
 */
router.post("/", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: "messages wajib diisi (array)." });
    }

    const result = await chatWithAI({
      perusahaanId: req.perusahaanId,
      userId: req.user.id,
      messages,
    });

    res.json(result);
  } catch (err) {
    console.error(err);
    if (err.message?.includes("GROQ_API_KEY")) {
      return res.status(503).json({ error: err.message });
    }
    res.status(500).json({ error: "Gagal memproses pesan chat AI." });
  }
});

export default router;
