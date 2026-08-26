# Panduan Deploy ke VPS

Panduan ini mengasumsikan VPS Ubuntu 22.04+ dengan akses root/sudo.

## 1. Siapkan server

```bash
sudo apt update && sudo apt install -y nginx git
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

## 2. Clone & install

```bash
git clone <repo-anda> stok-ai
cd stok-ai/backend
cp .env.example .env
nano .env   # isi GROQ_API_KEY, JWT_SECRET, DATABASE_URL, CORS_ORIGIN
npm install
npx prisma generate
npx prisma migrate deploy   # jalankan migrasi production
npm run prisma:seed         # opsional, hanya untuk data contoh awal
```

> Catatan: `prisma generate` dan `migrate` butuh koneksi internet keluar
> (mengunduh query engine dari binaries.prisma.sh) saat pertama kali dijalankan
> di server baru. Ini normal dan hanya sekali per instalasi/upgrade Prisma.

Untuk production disarankan pindah ke PostgreSQL: ubah `provider` di
`prisma/schema.prisma` dari `sqlite` ke `postgresql`, isi `DATABASE_URL` dengan
connection string Postgres, lalu jalankan ulang `prisma migrate deploy`.

## 3. Jalankan backend dengan PM2

```bash
pm2 start src/index.js --name stok-ai-backend
pm2 save
pm2 startup   # ikuti instruksi yang muncul agar PM2 auto-start saat reboot
```

## 4. Build & deploy frontend

```bash
cd ../frontend
npm install
# set VITE base url kalau backend beda domain, atau biarkan pakai reverse proxy /api
npm run build
sudo mkdir -p /var/www/stok-ai
sudo cp -r dist/* /var/www/stok-ai/
```

## 5. Konfigurasi Nginx (reverse proxy + serve frontend)

Buat `/etc/nginx/sites-available/stok-ai`:

```nginx
server {
    listen 80;
    server_name stok.domainanda.com;

    root /var/www/stok-ai;
    index index.html;

    location / {
        try_files $uri /index.html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        client_max_body_size 15m;   # untuk upload foto/excel
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/stok-ai /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS (opsional tapi disarankan)

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d stok.domainanda.com
```

## 7. Update deployment berikutnya

```bash
cd stok-ai && git pull
cd backend && npm install && npx prisma migrate deploy && pm2 restart stok-ai-backend
cd ../frontend && npm install && npm run build && sudo cp -r dist/* /var/www/stok-ai/
```

## Alternatif: Docker Compose (ringkas)

Kalau lebih suka container, buat `docker-compose.yml` di root repo:

```yaml
version: "3.8"
services:
  backend:
    build: ./backend
    env_file: ./backend/.env
    ports: ["4000:4000"]
    volumes:
      - backend_data:/app/prisma
  frontend:
    build: ./frontend
    ports: ["80:80"]
volumes:
  backend_data:
```

Lalu tambahkan `Dockerfile` sederhana di masing-masing folder (`node:20-alpine`
untuk backend menjalankan `npm ci && npx prisma generate && npm start`, dan
multi-stage build + `nginx:alpine` untuk menyajikan hasil `npm run build` di
frontend).
