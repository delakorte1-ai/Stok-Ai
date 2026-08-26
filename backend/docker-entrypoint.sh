#!/bin/sh
# Dijalankan setiap kali container start: pastikan skema database sudah
# ter-migrasi (aman dijalankan berulang, migrasi yang sudah ada dilewati),
# baru start server. Ini membuat deploy "sekali klik" karena tidak perlu
# masuk ke shell server secara manual untuk migrate.
set -e

# Kalau DATABASE_URL menunjuk ke file SQLite di folder volume (mis. file:/data/prod.db),
# pastikan foldernya ada dulu sebelum migrate — supaya kompatibel dengan volume
# persisten yang di-mount di path custom (Railway/Render/Fly.io volumes).
case "$DATABASE_URL" in
  file:*)
    DB_PATH=$(echo "$DATABASE_URL" | sed 's/^file://')
    mkdir -p "$(dirname "$DB_PATH")" 2>/dev/null || true
    ;;
esac

echo "Menjalankan migrasi database..."
npx prisma migrate deploy

# Seed data contoh HANYA kalau database masih benar-benar kosong (tabel
# perusahaan belum ada isinya) dan variabel SEED_ON_START=true diset.
if [ "$SEED_ON_START" = "true" ]; then
  echo "Menjalankan seed data contoh (SEED_ON_START=true)..."
  node prisma/seed.js || echo "Seed dilewati (kemungkinan data sudah ada)."
fi

echo "Menjalankan server..."
exec node src/index.js
