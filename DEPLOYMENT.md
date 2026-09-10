# Paket produksi TumbuhBersama

Paket ini berisi frontend hasil build, backend Node.js, shared modules, dan skema MySQL. Tidak ada tes, node_modules, cache WHO, source frontend, Git, PPT, atau kredensial. Tes tetap tersedia di repository.

## Jagoweb
Pastikan paket hosting menyediakan Node.js 22.13+ (disarankan Node.js 24), npm, MySQL 8.0.30+ dan proxy WebSocket. Nama penyedia saja belum memastikan fasilitas paketnya. Hosting PHP/static saja tidak dapat menjalankan backend ini. Referensi layanan: https://www.jagoweb.com/hosting

1. Ekstrak ZIP ke folder aplikasi di luar folder publik yang menyajikan file mentah. Jangan mengekspos server/, SQL, package.json, atau .env melalui file manager publik. Arahkan domain ke aplikasi Node; Express menyajikan dist/.
2. Buat database dan user MySQL melalui panel; berikan akses ke database tersebut. Pilih database itu di phpMyAdmin, impor database-fresh.sql untuk instalasi BARU. File ini tidak membuat atau memilih nama database hardcoded. Untuk database lama, backup dahulu dan jalankan hanya migrasi yang belum diterapkan dalam server/migrations; jangan impor skema baru di atas data lama sebagai pengganti migrasi.
3. Instal dependensi pada server: npm ci --omit=dev. node_modules sengaja tidak dikirim dari Windows. Paket masih memakai manifest/lock asli agar versi terkunci; sebagian dependensi frontend ikut terpasang. Batas ZIP berbeda dari kuota disk setelah instalasi dan penyimpanan media database.
4. Isi environment di panel atau salin .env.example menjadi .env: NODE_ENV=production, DEMO_MODE=false, APP_ORIGIN=https://domain-anda (tanpa slash akhir), DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME dan PORT sesuai panel. Jangan unggah .env ke GitHub. Gunakan HTTPS karena cookie sesi produksi memakai Secure.
5. Jalankan npm start (entry point server/index.js). Proses harus terus aktif. Backend mendengarkan 127.0.0.1 pada PORT, sehingga proxy pada host yang sama diperlukan. Jika panel hanya menerima CommonJS/Passenger atau container yang perlu bind 0.0.0.0, konfigurasi peluncuran perlu disesuaikan terlebih dahulu; paket ini belum diuji pada panel Jagoweb Anda.
6. Aktifkan penerusan WebSocket /socket.io/ di proxy agar notifikasi langsung bekerja. Atur batas upload proxy >=21 MB untuk unggahan forum. Pastikan max_allowed_packet MySQL cukup untuk video 10 MB (misalnya 16 MB atau lebih).
7. Periksa login/daftar + captcha, refresh sesi, CRUD anak/pengukuran, grafik WHO, kalender, forum/upload dan notifikasi antarakun di domain HTTPS. Pengingat server perlu proses Node tetap hidup; tidak otomatis menjadi push notification saat browser ditutup.

Build frontend sudah tersedia; tidak perlu npm run build pada hosting. Data akun dari Laragon tidak termasuk ZIP: migrasi data dilakukan terpisah melalui backup yang aman. Belum ada deployment otomatis ke Jagoweb.

## Membuat ulang paket di Windows
Dari root repository: powershell -ExecutionPolicy Bypass -File tools/package-production.ps1
Output dibuat di folder releases/ (diabaikan Git). Script menjalankan build, memakai daftar file yang diizinkan, memeriksa isi ZIP dan batas 150 MB.
