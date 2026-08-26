import Groq from "groq-sdk";
import prisma from "./prisma.js";
import { executeAiAction } from "./aiActionExecutor.js";

let groqClient = null;
function getGroq() {
  if (!process.env.GROQ_API_KEY) {
    throw new Error(
      "GROQ_API_KEY belum diset di .env. Daftar gratis di https://console.groq.com/keys lalu isi GROQ_API_KEY."
    );
  }
  if (!groqClient) groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
  return groqClient;
}

/**
 * Definisi tools (function calling) yang "boleh diminta" oleh AI.
 * AI HANYA menghasilkan pemanggilan salah satu fungsi ini dengan parameter JSON —
 * eksekusi sungguhan (validasi + tulis DB) ada di aiActionExecutor.js, bukan di sini.
 */
const TOOLS = [
  {
    type: "function",
    function: {
      name: "tambah_produk",
      description: "Tambah produk baru ke katalog. Wajib punya kategori yang sudah ada. Untuk kategori mode reguler, stok awal wajib diisi.",
      parameters: {
        type: "object",
        properties: {
          kategoriNama: { type: "string", description: "Nama kategori yang sudah ada, misal 'Ban' atau 'Velg'" },
          nama: { type: "string", description: "Nama produk" },
          modal: { type: "number", description: "Harga modal/beli per unit" },
          stok: { type: "number", description: "Jumlah stok awal (wajib untuk kategori mode reguler)" },
          stokMinimum: { type: "number", description: "Threshold notifikasi stok menipis (opsional)" },
          hargaJualDefault: { type: "number", description: "Harga jual default (opsional)" },
          kondisi: { type: "string", description: "Kondisi barang, khusus kategori mode unit_unik, opsional (misal 'second 80%')" },
          isPaket: { type: "boolean", description: "True kalau ini produk paket gabungan, misal velg + ban second" },
          keteranganPaket: { type: "string", description: "Deskripsi paket kalau isPaket true" },
        },
        required: ["kategoriNama", "nama"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tambah_kategori",
      description: "Buat kategori produk baru milik perusahaan ini.",
      parameters: {
        type: "object",
        properties: {
          nama: { type: "string" },
          modeStok: {
            type: "string",
            enum: ["reguler", "unit_unik"],
            description: "reguler untuk barang seragam (stok berupa angka), unit_unik untuk barang yang tiap unit beda (misal second)",
          },
        },
        required: ["nama", "modeStok"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "tambah_stok",
      description: "Tambah stok (barang masuk) untuk produk kategori mode reguler yang SUDAH ADA di katalog.",
      parameters: {
        type: "object",
        properties: {
          produkNama: { type: "string", description: "Nama produk sesuai disebut user (boleh typo/singkatan, akan dicocokkan otomatis)" },
          jumlah: { type: "number" },
          modalBaru: { type: "number", description: "Modal baru kalau berubah dari sebelumnya (opsional)" },
          keterangan: { type: "string" },
        },
        required: ["produkNama", "jumlah"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "kurangi_stok",
      description: "Kurangi stok (barang terjual/keluar) untuk produk yang sudah ada. Berlaku untuk produk reguler maupun unit unik (kalau produk yang cocok ternyata unit unik, akan otomatis diproses sebagai penjualan unit).",
      parameters: {
        type: "object",
        properties: {
          produkNama: { type: "string" },
          jumlah: { type: "number", description: "Jumlah yang terjual (untuk produk unit unik selalu 1)" },
          hargaJual: { type: "number", description: "Harga jual saat ini, kalau disebutkan user" },
          keterangan: { type: "string" },
        },
        required: ["produkNama"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "query_analitik",
      description: "Jawab pertanyaan analitik berdasarkan data transaksi asli: laba-rugi, produk terlaris, atau stok menipis.",
      parameters: {
        type: "object",
        properties: {
          jenis: { type: "string", enum: ["laba_rugi", "produk_terlaris", "stok_menipis"] },
          dari: { type: "string", description: "Tanggal mulai format YYYY-MM-DD, opsional (default awal bulan ini)" },
          sampai: { type: "string", description: "Tanggal akhir format YYYY-MM-DD, opsional (default hari ini)" },
        },
        required: ["jenis"],
      },
    },
  },
];

async function buildSystemPrompt(perusahaanId) {
  const [kategoriList, produkList] = await Promise.all([
    prisma.kategoriProduk.findMany({ where: { perusahaanId } }),
    prisma.produk.findMany({ where: { perusahaanId }, include: { kategori: true } }),
  ]);

  const kategoriText = kategoriList
    .map((k) => `- ${k.nama} (mode: ${k.modeStok})`)
    .join("\n") || "(belum ada kategori)";

  const produkText = produkList
    .map((p) => {
      const stokInfo = p.kategori.modeStok === "reguler" ? `stok=${p.stok}` : `status=${p.statusUnitUnik}`;
      return `- [${p.kategori.nama}] ${p.nama} (id:${p.id}, ${stokInfo}, modal=${p.modal})`;
    })
    .join("\n") || "(belum ada produk)";

  return `Kamu adalah asisten AI untuk sistem manajemen stok perusahaan ini. Tugasmu HANYA mengubah pesan chat bahasa natural (boleh typo, singkatan, sinonim seperti "laku"/"kejual"/"terjual") menjadi pemanggilan fungsi (tool call) yang sudah disediakan.

ATURAN PENTING:
1. Kamu TIDAK PERNAH mengubah database secara langsung. Kamu hanya boleh memanggil tools yang tersedia. Backend yang akan memvalidasi dan mengeksekusi.
2. Kalau nama produk yang disebut user AMBIGU (mirip beberapa produk) atau data PENTING tidak lengkap (misal jumlah stok tidak disebutkan), JANGAN menebak dan JANGAN memanggil tool dengan data kosong/asumsi. Sebagai gantinya, balas dengan pertanyaan klarifikasi dalam teks biasa ke user.
3. Kalau user menyebutkan BEBERAPA transaksi sekaligus dalam satu pesan (multi-item), panggil beberapa tool call sekaligus dalam satu response.
4. Setelah tool dieksekusi dan kamu menerima hasilnya, susun jawaban akhir dalam bahasa Indonesia natural yang menyebutkan produk, jumlah, sisa stok, dan untung (kalau relevan). Kalau ada aksi yang hasilnya "butuh_klarifikasi", sampaikan pertanyaan klarifikasi itu ke user dengan jelas, dan tetap laporkan aksi lain yang berhasil.
5. Untuk pertanyaan analitik (misal "produk apa yang paling laku bulan ini?"), gunakan tool query_analitik, JANGAN mengarang jawaban dari asumsi.

Kategori produk perusahaan ini:
${kategoriText}

Daftar produk yang sudah ada (gunakan ini untuk mengenali produk yang disebut user, termasuk toleransi typo):
${produkText}

Hari ini: ${new Date().toISOString().slice(0, 10)}`;
}

/**
 * Loop utama chat AI: kirim pesan -> kalau ada tool_calls, eksekusi lewat
 * aiActionExecutor -> kirim hasilnya balik ke model -> ambil jawaban akhir.
 * Maksimal beberapa putaran untuk mencegah infinite loop.
 */
export async function chatWithAI({ perusahaanId, userId, messages }) {
  const groq = getGroq();
  const systemPrompt = await buildSystemPrompt(perusahaanId);

  const conversation = [{ role: "system", content: systemPrompt }, ...messages];
  const executedActions = [];

  for (let round = 0; round < 4; round++) {
    const completion = await groq.chat.completions.create({
      model: process.env.GROQ_MODEL_TEXT || "llama-3.3-70b-versatile",
      messages: conversation,
      tools: TOOLS,
      tool_choice: "auto",
      temperature: 0.2,
    });

    const choice = completion.choices[0];
    const msg = choice.message;
    conversation.push(msg);

    if (!msg.tool_calls || msg.tool_calls.length === 0) {
      return { reply: msg.content, actions: executedActions };
    }

    // Eksekusi semua tool call di response ini (mendukung multi-item dalam satu chat)
    for (const call of msg.tool_calls) {
      let args = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        args = {};
      }

      const result = await executeAiAction(call.function.name, args, { perusahaanId, userId });
      executedActions.push({ nama_aksi: call.function.name, parameter: args, hasil: result });

      conversation.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify(result),
      });
    }
  }

  return {
    reply: "Maaf, terjadi terlalu banyak langkah untuk memproses permintaan ini. Coba pecah jadi beberapa pesan.",
    actions: executedActions,
  };
}

/**
 * Ekstraksi data massal dari teks bebas (paste daftar ala WhatsApp supplier).
 * TIDAK langsung menyimpan ke DB — mengembalikan array baris untuk di-preview
 * dulu oleh user (dipakai fitur import).
 */
export async function extractProductsFromText({ perusahaanId, teks }) {
  const groq = getGroq();
  const kategoriList = await prisma.kategoriProduk.findMany({ where: { perusahaanId } });
  const kategoriText = kategoriList.map((k) => `- ${k.nama} (${k.modeStok})`).join("\n") || "(belum ada kategori)";

  const prompt = `Ekstrak SEMUA baris produk dari teks berikut (format bebas ala pesan WhatsApp supplier) menjadi array JSON.
Setiap item punya field: nama, kategoriNama (cocokkan ke kategori yang sudah ada di bawah kalau memungkinkan, kalau tidak ada yang cocok isi dengan tebakan nama kategori baru), modal (angka, null kalau tidak disebutkan), stok (angka, null kalau tidak disebutkan), hargaJualDefault (angka atau null), lengkap (boolean: true kalau nama+modal+stok semuanya ada, false kalau ada yang kurang), alasanTidakLengkap (string, null kalau lengkap true).

Kategori yang sudah ada:
${kategoriText}

Balas HANYA dengan JSON array, tanpa teks lain, tanpa markdown code fence.

Teks:
"""
${teks}
"""`;

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL_TEXT || "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content;
  return safeParseJsonArray(raw);
}

/**
 * Ekstraksi data massal dari foto daftar produk (pakai model vision Groq).
 */
export async function extractProductsFromImage({ perusahaanId, imageBase64, mimeType }) {
  const groq = getGroq();
  const kategoriList = await prisma.kategoriProduk.findMany({ where: { perusahaanId } });
  const kategoriText = kategoriList.map((k) => `- ${k.nama} (${k.modeStok})`).join("\n") || "(belum ada kategori)";

  const prompt = `Ini adalah foto daftar produk/stok. Baca semua baris yang terlihat dan ekstrak menjadi array JSON dengan field: nama, kategoriNama, modal (angka atau null), stok (angka atau null), hargaJualDefault (angka atau null), lengkap (boolean), alasanTidakLengkap (string atau null).
Kategori yang sudah ada:
${kategoriText}
Balas HANYA JSON array di dalam key "items", tanpa teks lain.`;

  const completion = await groq.chat.completions.create({
    model: process.env.GROQ_MODEL_VISION || "llama-4-scout-17b-16e-instruct",
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: prompt },
          { type: "image_url", image_url: { url: `data:${mimeType};base64,${imageBase64}` } },
        ],
      },
    ],
    temperature: 0,
    response_format: { type: "json_object" },
  });

  const raw = completion.choices[0].message.content;
  return safeParseJsonArray(raw);
}

function safeParseJsonArray(raw) {
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed;
    if (Array.isArray(parsed.items)) return parsed.items;
    // fallback: ambil array pertama yang ditemukan di object
    const firstArray = Object.values(parsed).find((v) => Array.isArray(v));
    return firstArray || [];
  } catch (err) {
    console.error("Gagal parse JSON dari AI:", raw);
    return [];
  }
}
