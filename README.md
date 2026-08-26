# Stok AI — Manajemen Stok Produk dengan Chat AI

Aplikasi web full-stack untuk manajemen stok multi-tenant (bisa dipakai
berbagai jenis usaha), dengan input/update stok lewat chat bahasa natural ke
AI. Studi kasus contoh: toko ban & velg (lihat data seed).

## Struktur Proyek

```
stok-ai/
├── backend/        Node.js + Express + Prisma (SQLite untuk dev)
├── frontend/        React + Vite + Tailwind CSS
└── docs/             Panduan deploy VPS & integrasi WhatsApp/Telegram
```

## Stack & Alasan Pemilihan

- **Backend: Node.js + Express + Prisma.** Satu bahasa (JavaScript) dipakai
  di frontend & backend, mempercepat development dan memudahkan tim kecil
  maintain. Prisma dipilih karena schema-first migration cocok untuk model
  multi-tenant yang eksplisit (setiap tabel punya `perusahaanId`), dan
  Prisma Client memberi type-safety saat query.
- **Database: SQLite (dev) → PostgreSQL (production).** SQLite tidak perlu
  server terpisah, cocok untuk development cepat dan demo. Untuk production
  dengan banyak tenant/traffic, tinggal ganti `provider` di
  `prisma/schema.prisma` ke `postgresql` — model data tidak perlu diubah.
- **AI layer: Groq API (function calling / tool use).** Groq dipilih karena
  inference sangat cepat (penting untuk pengalaman chat yang responsif),
  API-nya kompatibel dengan pola OpenAI tool-use yang sudah matang untuk
  parsing bahasa natural → instruksi terstruktur, dan mendukung model vision
  untuk ekstraksi foto daftar produk tanpa perlu OCR terpisah.
  - Trade-off vs Ollama (model lokal open-source): Ollama gratis & privat
    (jalan di server sendiri, cocok kalau data tidak boleh keluar server),
    tapi akurasi function-calling & pemahaman bahasa Indonesia (termasuk
    typo/singkatan) umumnya lebih lemah, dan tidak mendukung input gambar
    langsung tanpa pipeline OCR tambahan.
  - Trade-off vs Claude/OpenAI API: akurasi serupa atau lebih tinggi, tapi
    biaya per-request lebih mahal dan latensi lebih tinggi dibanding Groq
    untuk kasus penggunaan chat real-time seperti ini.

## Keamanan Data: AI Tidak Pernah Menyentuh Database Langsung

Ini prinsip desain utama sistem ini:

1. Pesan user dikirim ke Groq beserta system prompt (daftar kategori & produk
   perusahaan tersebut) dan daftar *tools* yang boleh dipanggil.
2. Groq **hanya menghasilkan pemanggilan tool** (`nama_aksi` + `parameter`
   dalam JSON) — lihat `backend/src/services/aiService.js`.
3. `backend/src/services/aiActionExecutor.js` menerima instruksi itu,
   **memvalidasi** (produk ada? fuzzy match kalau typo? stok cukup? data
   lengkap?), baru memanggil service yang sama persis dipakai endpoint REST
   manual (`backend/src/services/stokService.js`).
4. Kalau ambigu/data kurang, executor mengembalikan status `butuh_klarifikasi`
   **tanpa mengubah DB apa pun** — Groq lalu menyusun pertanyaan klarifikasi
   ke user dalam bahasa natural.

## Menjalankan di Lokal (Development)

### Backend

```bash
cd backend
cp .env.example .env
# isi GROQ_API_KEY (daftar gratis di https://console.groq.com/keys)
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run prisma:seed     # opsional: data contoh toko ban & velg
npm run dev              # jalan di http://localhost:4000
```

> **Catatan penting:** `prisma generate` dan `prisma migrate dev` mengunduh
> query engine dari `binaries.prisma.sh` saat pertama kali dijalankan —
> butuh koneksi internet keluar yang tidak diblokir firewall/proxy. Ini
> berjalan normal di laptop/VPS dengan akses internet standar.

Login data contoh (setelah `prisma:seed`):
- Owner: `owner@jayamotor.test` / `password123`
- Karyawan: `kasir@jayamotor.test` / `password123`

### Frontend

```bash
cd frontend
npm install
npm run dev    # jalan di http://localhost:5173, proxy /api ke backend:4000
```

Buka `http://localhost:5173`, atau langsung `/register` untuk mendaftarkan
perusahaan baru dengan jenis usaha apa pun.

## Ringkasan Fitur yang Sudah Diimplementasikan

- CRUD kategori (custom per perusahaan, mode reguler/unit_unik), produk,
  transaksi stok, user & role (owner/karyawan).
- Chat AI (Groq function calling): tambah/kurangi stok, tambah produk, tambah
  kategori, query analitik, multi-item dalam satu pesan, klarifikasi otomatis
  saat ambigu/data kurang.
- Import massal: paste teks bebas (AI ekstrak), upload foto (AI vision),
  upload Excel/CSV (parsing langsung) — semua dengan preview & commit
  terpisah, baris tidak lengkap ditahan untuk dilengkapi.
- Template Excel siap download.
- Dashboard: kartu ringkasan, tab kategori, daftar produk per kategori, panel
  chat AI yang selalu terlihat (drawer di mobile).
- Laporan: laba-rugi (grafik per hari), produk terlaris, slow-moving stock,
  notifikasi stok menipis (threshold per produk), audit log.
- Snapshot modal & harga jual di setiap transaksi (laporan tetap akurat
  meski modal/harga produk berubah di kemudian hari).

## Deploy ke Hosting (Satu Layanan, Tanpa VPS Manual)

Backend Express sudah dikonfigurasi untuk ikut menyajikan hasil build
frontend dari folder `backend/public` — jadi production build-nya cukup
**satu server/satu deploy**, bukan dua layanan terpisah. Ada `Dockerfile` di
root repo yang otomatis: build frontend → generate Prisma Client → migrate
database → start server, setiap kali deploy.

Langkah paling gampang: push repo ini ke GitHub, lalu deploy `Dockerfile`-nya
ke **Railway** atau **Render** (keduanya mendukung deploy langsung dari
Dockerfile dan punya free tier). Panduan step-by-step lengkap ada di
`docs/DEPLOY_MUDAH.md` — termasuk cara set environment variable dan volume
penyimpanan supaya data SQLite tidak hilang saat redeploy.

Kalau lebih suka VPS sendiri (Nginx + PM2 manual, dua layanan terpisah),
panduannya ada di `docs/DEPLOY.md`.

## Yang Didokumentasikan tapi Belum Diimplementasikan Live

Sesuai kesepakatan cakupan build (fokus ke sistem inti + AI + import + laporan):

- **Integrasi WhatsApp/Telegram** — arsitektur & langkah implementasi ada di
  `docs/INTEGRASI_CHAT.md`. Butuh kredensial WhatsApp Business API/Telegram
  Bot Token milik Anda untuk diaktifkan.

## Catatan Verifikasi

Semua file backend & frontend sudah lolos syntax check dan `npm run build`
frontend berhasil tanpa error. Logic fuzzy-matching produk sudah diuji dengan
skenario typo, ambigu, dan tidak ditemukan. Alur `prisma migrate`/`generate`
dan pemanggilan API Groq membutuhkan akses internet ke domain masing-masing
(`binaries.prisma.sh`, `api.groq.com`) yang berjalan normal di lingkungan
development/production biasa — jalankan langkah "Menjalankan di Lokal" di
atas di komputer/server Anda untuk uji end-to-end penuh (registrasi → seed →
chat AI → laporan).
