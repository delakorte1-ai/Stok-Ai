# Integrasi Chat via WhatsApp / Telegram (Kanal Tambahan)

Arsitektur AI layer di backend ini (`src/services/aiService.js` +
`src/services/aiActionExecutor.js`) sudah dipisah dari web API (`src/routes/chat.js`)
supaya bisa dipakai ulang oleh kanal chat lain tanpa mengubah logic inti.
Prinsipnya: **setiap kanal cuma perlu menerjemahkan pesan masuk/keluar**,
lalu memanggil fungsi `chatWithAI()` yang sama persis dipakai endpoint web.

```
Pesan WA/Telegram → webhook handler → chatWithAI({ perusahaanId, userId, messages })
                                              → sama seperti panel chat web
                  ← balasan teks    ← reply.reply
```

## Yang perlu ditambahkan (belum diimplementasikan di build ini)

1. **Pemetaan nomor WA/Telegram ↔ user & perusahaan.**
   Tambah tabel `kanal_terhubung` (userId, jenisKanal, idEksternal — nomor WA
   atau chatId Telegram) supaya saat pesan masuk, backend tahu ini dari
   perusahaan & user mana. Karyawan menghubungkan nomornya sekali lewat
   halaman Pengaturan (generate kode verifikasi, kirim ke bot, bot konfirmasi).

2. **Webhook receiver.**
   - WhatsApp: pakai WhatsApp Business Cloud API (Meta) atau provider seperti
     Twilio/Fonnte. Buat endpoint `POST /api/webhook/whatsapp` yang menerima
     payload, ekstrak nomor pengirim + teks pesan, cari `kanal_terhubung`,
     panggil `chatWithAI`, balas via API kirim pesan WA.
   - Telegram: pakai `node-telegram-bot-api` atau webhook resmi Telegram Bot
     API. Endpoint `POST /api/webhook/telegram`, alur sama.

3. **Riwayat percakapan per kanal.**
   Web menyimpan history di localStorage frontend (stateless backend). Untuk
   WA/Telegram, riwayat harus disimpan di server (tabel `pesan_chat` per user)
   karena tidak ada "frontend" yang menyimpan state — setiap webhook request
   perlu ambil N pesan terakhir dari DB sebagai konteks sebelum memanggil AI.

4. **Foto lewat WhatsApp/Telegram.**
   Kedua platform mengirim media sebagai URL/file_id yang perlu diunduh dulu
   oleh backend, lalu diteruskan ke `extractProductsFromImage()` — flow-nya
   sama seperti upload foto di web, hanya sumber filenya beda.

5. **Autentikasi berbeda dari web.**
   Endpoint webhook tidak pakai JWT (request datang dari Meta/Telegram, bukan
   browser user). Verifikasi keaslian request pakai signature/secret token
   yang disediakan masing-masing platform (`X-Hub-Signature-256` untuk Meta,
   secret token untuk Telegram) — WAJIB divalidasi supaya endpoint tidak bisa
   dipanggil sembarang orang untuk mengubah stok.

## Kenapa tidak dibangun langsung di versi ini

Integrasi WA/Telegram butuh kredensial pihak ketiga (WhatsApp Business API
atau Telegram Bot Token) milik Anda sendiri untuk bisa ditest end-to-end.
Struktur kode di atas sudah disiapkan supaya begitu Anda punya kredensialnya,
tinggal tambah 2 file (`routes/webhookWhatsapp.js`, `routes/webhookTelegram.js`)
dan tabel `kanal_terhubung` tanpa menyentuh logic AI/stok yang sudah ada.
