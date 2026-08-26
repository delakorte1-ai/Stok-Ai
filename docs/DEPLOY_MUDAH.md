# Deploy Cepat (Railway / Render) — Satu Layanan, Tanpa VPS Manual

Sejak update ini, backend Express juga menyajikan frontend (hasil build React)
dari server yang sama. Jadi cukup **satu layanan** yang di-deploy dari
`Dockerfile` di root repo — tidak perlu setup Nginx atau proses terpisah.

Repo ini punya `Dockerfile` (root) yang otomatis: build frontend → pasang di
backend → jalankan migrasi database → start server, setiap kali deploy.

## Opsi A: Railway (paling gampang, ada free trial)

1. Push kode ini ke repo GitHub kamu (bikin repo baru, `git init` &
   `git push` dari folder `stok-ai`).
2. Buka [railway.app](https://railway.app) → **New Project** → **Deploy from
   GitHub repo** → pilih repo ini. Railway otomatis mendeteksi `Dockerfile`.
3. Di tab **Variables**, isi environment variable berikut:
   - `GROQ_API_KEY` — dari [console.groq.com/keys](https://console.groq.com/keys)
   - `JWT_SECRET` — teks acak panjang, bebas
   - `DATABASE_URL` — `file:/data/prod.db`
   - `CORS_ORIGIN` — boleh dikosongkan/`*` karena frontend & backend satu domain
   - `SEED_ON_START` — isi `true` sekali di awal untuk data contoh, lalu hapus
     lagi setelah deploy pertama supaya tidak seed ulang tiap restart
4. Di tab **Settings → Volumes**, tambah volume baru, mount path `/data`.
   Ini supaya database SQLite tidak hilang setiap kali Railway redeploy
   (disk container itu sendiri tidak permanen).
5. Railway akan kasih domain publik otomatis (`xxxx.up.railway.app`), atau
   kamu bisa pasang custom domain di tab **Settings → Networking**.
6. Klik **Deploy**. Tunggu build selesai (~2-4 menit pertama kali), lalu buka
   domainnya — aplikasi sudah bisa dipakai langsung dari domain itu.

## Opsi B: Render

1. Push kode ke GitHub (sama seperti di atas).
2. Buka [render.com](https://render.com) → **New** → **Web Service** → hubungkan
   repo ini. Render otomatis mendeteksi `Dockerfile`.
3. Di **Environment**, isi variable yang sama seperti daftar Railway di atas.
4. Di **Disks**, tambah disk baru, mount path `/data`, minimal 1GB — supaya
   database persisten antar deploy.
5. Pilih plan (ada free tier, tapi free tier Render "tidur" kalau tidak ada
   trafik dan disk gratis terbatas — untuk pemakaian toko harian sebaiknya
   pakai plan berbayar termurah supaya selalu aktif).
6. Deploy. Render kasih domain `xxxx.onrender.com` otomatis, atau pasang
   custom domain di **Settings → Custom Domains**.

## Kalau nanti butuh skala lebih besar: pindah ke PostgreSQL

SQLite di volume cukup untuk satu toko/perusahaan kecil-menengah. Kalau
datanya sudah besar atau butuh banyak koneksi bersamaan, tinggal:

1. Tambah database Postgres (Railway & Render sama-sama punya, gratis untuk
   skala kecil di Railway).
2. Ubah `provider = "sqlite"` jadi `provider = "postgresql"` di
   `backend/prisma/schema.prisma`.
3. Ganti `DATABASE_URL` ke connection string Postgres yang diberikan platform.
4. Commit & push — deploy berikutnya otomatis migrate ke skema yang sama di
   Postgres (tidak perlu ubah kode lain).

## Menjalankan versi Docker ini di komputer sendiri (opsional, untuk tes dulu)

```bash
cd stok-ai
docker build -t stok-ai .
docker run -p 4000:4000 \
  -e GROQ_API_KEY=isi_api_key_kamu \
  -e JWT_SECRET=rahasia-acak \
  -e DATABASE_URL="file:/data/dev.db" \
  -v stok_ai_data:/data \
  stok-ai
```

Buka `http://localhost:4000` — frontend & backend sudah jadi satu di situ.
