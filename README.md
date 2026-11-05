# Bishamon Monolith

Bishamon adalah aplikasi **Wise Scrolling** pribadi untuk membaca, membuat, menyimpan, dan mengevaluasi kartu pengetahuan dalam bahasa Indonesia. UI dan API berjalan dalam satu aplikasi Next.js, dengan database SQLite lokal dan satu pemilik per instalasi.

Mode demo dapat digunakan tanpa API key atau koneksi internet setelah dependensi terpasang. Untuk generasi AI, hubungkan NVIDIA NIM, Google Gemini, atau layanan OpenAI/kompatibel melalui konfigurasi server.

## Fitur

- Feed kartu dengan pencarian, filter domain pengetahuan, dan bookmark.
- Empat format konten: artikel, flashcard, explainer, dan thread.
- Taksonomi awal berisi 129 domain serta tiga kartu contoh yang diberi label demo.
- Generasi AI dengan opsi konteks referensi dari arXiv dan fallback antarprovider yang dikonfigurasi.
- Evaluasi pribadi baik/bermasalah, alasan, dan catatan yang dapat diperbarui atau dihapus.
- Riwayat generasi, percobaan provider, model aktual, durasi, serta penggunaan token jika tersedia.
- Statistik model yang mengecualikan kartu demo, serta ekspor kartu dan evaluasi ke JSON/CSV.
- Login pemilik untuk akses jaringan, database persisten, dan skrip backup SQLite.

Referensi arXiv atau model merupakan jejak sumber; keberadaannya tidak menjamin bahwa setiap klaim telah diverifikasi. Mode demo memakai templat lokal, tidak memanggil AI, dan tidak menjadi fallback otomatis dari provider AI.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Runtime | Node.js 22.18+ dengan modul bawaan `node:sqlite` |
| UI dan API | Next.js 16 App Router, React 19, TypeScript |
| Tampilan | Tailwind CSS 4 dan CSS |
| Validasi | Zod 4 |
| Penyimpanan | SQLite lokal dengan WAL |
| Pengujian | Node.js test runner |

Tidak memerlukan server PostgreSQL, Redis, worker terpisah, atau layanan autentikasi eksternal. Jalankan satu proses aplikasi untuk satu database; aplikasi ini ditujukan untuk penggunaan pribadi.

## Menjalankan secara lokal

Siapkan Node.js **22.18.0 atau lebih baru** dan npm. Dari root direktori proyek:

```bash
npm ci
npm run setup
npm run dev
```

Buka **http://127.0.0.1:3000**. Konfigurasi bawaan memakai provider `demo` dan hanya menerima akses lokal tanpa login.

`npm run setup` membuat `.env` dari `.env.example` jika belum ada, membatasi izin file, lalu menyiapkan database beserta data awal. Menjalankan setup atau seed kembali tidak menghapus kartu, bookmark, maupun evaluasi yang sudah tersimpan.

Setelah aplikasi terbuka:

1. Baca kartu contoh di feed atau pilih tombol untuk membuat kartu.
2. Pilih domain, topik, format, dan provider `Demo lokal` untuk mencoba alur tanpa API key.
3. Simpan kartu dengan bookmark dan berikan evaluasi.
4. Periksa halaman Evaluasi, Riwayat, dan Pengaturan untuk statistik serta ekspor.

Untuk build dan menjalankan mode produksi:

```bash
npm run build
npm start
```

## Konfigurasi

Ubah `.env` di server, lalu mulai ulang aplikasi. Jangan memasukkan API key melalui kartu atau catatan evaluasi. Daftar variabel tersedia di [`.env.example`](.env.example).

| Variabel | Fungsi |
| --- | --- |
| `HOST`, `PORT` | Alamat dan port server lokal; bawaan `127.0.0.1:3000`. |
| `APP_PASSWORD` | Kata sandi pemilik. Wajib jika membuka akses LAN atau menjalankan container. |
| `SESSION_SECRET` | Nilai acak pribadi untuk penandatanganan sesi bersama kata sandi. |
| `APP_ORIGIN` | Origin publik aplikasi, misalnya `https://nama-domain.example`, jika diperlukan di belakang reverse proxy. |
| `COOKIE_SECURE` | Atur `true` ketika aplikasi diakses melalui HTTPS. |
| `BISHAMON_DB_PATH` | Lokasi database; bawaan `data/bishamon.sqlite`. |
| `LLM_DEFAULT_PROVIDER` | Provider pilihan: `demo`, `nvidia`, `gemini`, atau `openai`. |
| `LLM_TIMEOUT_MS` | Batas waktu permintaan provider dalam milidetik. |
| `LLM_FALLBACK_CHAIN` | Daftar provider cadangan dipisahkan koma, misalnya `gemini,openai`; masing-masing harus memiliki API key. |
| `NVIDIA_API_KEY`, `NVIDIA_MODEL`, `NVIDIA_API_BASE_URL` | Konfigurasi NVIDIA NIM. |
| `GEMINI_API_KEY`, `GEMINI_MODEL` | Konfigurasi Google Gemini. |
| `OPENAI_API_KEY`, `OPENAI_MODEL`, `OPENAI_BASE_URL` | Konfigurasi OpenAI atau endpoint yang kompatibel. |

Untuk mengaktifkan AI, isi API key salah satu provider dan ubah `LLM_DEFAULT_PROVIDER` ke provider tersebut. Pilih model yang tersedia pada akun Anda. Nama model dan endpoint bawaan dapat dilihat pada `.env.example`; sesuaikan dengan akses provider Anda. Permintaan AI membutuhkan internet dan dapat memakai kuota akun provider.

Opsi konteks arXiv mengambil referensi melalui jaringan. Jika pencarian gagal, aplikasi mencatat keterbatasannya pada riwayat dan dapat melanjutkan generasi tanpa konteks arXiv.

### Akses LAN dan HTTPS

Untuk akses LAN, atur `HOST=0.0.0.0` dan isi `APP_PASSWORD` di `.env`. Buat nilai acak untuk `SESSION_SECRET`, misalnya dengan:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

Simpan hasilnya hanya di `.env`. Akses aplikasi melalui alamat mesin dan port yang dikonfigurasi, lalu masuk dengan kata sandi pemilik. Untuk akses internet, pasang reverse proxy HTTPS dan sesuaikan `APP_ORIGIN` serta `COOKIE_SECURE=true`.

## Docker Compose

Siapkan Docker Engine dan plugin Docker Compose, lalu buat konfigurasi:

```bash
cp .env.example .env
chmod 600 .env
```

Isi `APP_PASSWORD` dan `SESSION_SECRET` di `.env` sebelum menjalankan container. Tambahkan API key jika ingin memakai AI.

```bash
docker compose up -d --build
docker compose logs -f bishamon
```

Aplikasi tersedia di **http://127.0.0.1:3000**. Compose secara bawaan memublikasikan port hanya ke loopback; untuk LAN, tambahkan `BIND_ADDRESS=0.0.0.0` di `.env`. Data container disimpan pada named volume `bishamon-data`, terpisah dari folder `data/` instalasi lokal.

```bash
docker compose down
```

Perintah di atas mempertahankan volume. `docker compose down -v` menghapus volume beserta database di dalamnya.

## Perintah pengembangan

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Server pengembangan. |
| `npm run build` | Build produksi. |
| `npm start` | Server produksi setelah build. |
| `npm run setup` | Siapkan `.env` dan database awal. |
| `npm run seed` | Tambahkan domain/kartu awal yang belum ada. |
| `npm test` | Tes data, autentikasi, HTTP, generasi, dan skrip operasional. |
| `npm run typecheck` | Pemeriksaan TypeScript. |
| `npm run backup` | Buat snapshot database yang konsisten. |

Tes menggunakan database sementara dan simulasi respons provider, sehingga tidak memerlukan API key atau panggilan AI berbayar.

## Backup dan pemulihan

Untuk instalasi lokal:

```bash
npm run backup
# Atau tentukan file tujuan baru:
npm run backup -- backups/manual.sqlite
```

Skrip membuat snapshot SQLite konsisten, termasuk data yang masih berada di WAL, dan menolak menimpa file tujuan yang sudah ada. Simpan salinan backup di tempat terpisah dari mesin aplikasi.

Untuk memulihkan, hentikan aplikasi dan simpan salinan database lama beserta file `-wal`/`-shm` jika ada. Salin snapshot ke lokasi baru, ubah `BISHAMON_DB_PATH` di `.env` agar menunjuk file tersebut, lalu mulai ulang aplikasi. Skrip backup npm berjalan terhadap database instalasi lokal; database Compose berada di dalam volume container.

## Struktur proyek

```text
src/
  app/              Halaman Next.js dan route API
  components/       Feed, pembaca kartu, dialog generasi, evaluasi, pengaturan
  lib/
    ai/             Provider, prompt, validasi keluaran, dan pencarian arXiv
    database.ts     Koneksi, skema, dan inisialisasi SQLite
    repository.ts   Operasi kartu, domain, evaluasi, riwayat, dan statistik
    auth.ts         Kata sandi dan sesi pemilik
    http.ts         Otorisasi dan validasi permintaan HTTP
scripts/            Setup, seed, launcher, dan backup
tests/              Tes platform, HTTP, dan generasi
public/             Aset statis
compose.yml         Satu layanan aplikasi dengan volume data persisten
```

Endpoint utama: `GET /api/health`, `GET /api/domains`, `GET /api/cards`, `POST /api/generate`, `GET /api/runs`, `GET /api/stats`, dan `GET /api/export?format=json|csv`. Bookmark dan evaluasi tersedia di `/api/cards/[id]/bookmark` dan `/api/cards/[id]/evaluation`. Endpoint aplikasi memerlukan sesi ketika kata sandi diaktifkan; mutasi juga memerlukan header `Origin` yang sesuai.

## Pemecahan masalah

- **`node:sqlite` atau opsi Node tidak dikenali:** periksa `node --version`; gunakan Node.js 22.18+.
- **Provider belum siap:** pastikan API key di `.env` terisi dan mulai ulang aplikasi. Periksa model yang tersedia di akun provider.
- **Akses LAN ditolak:** isi `APP_PASSWORD` dan atur `HOST` untuk proses lokal, atau `BIND_ADDRESS` untuk port Compose.
- **Permintaan ditolak karena origin:** periksa URL browser, reverse proxy, dan `APP_ORIGIN`.
- **Container gagal saat mulai:** pastikan `APP_PASSWORD` terisi, lalu periksa `docker compose logs bishamon`.
- **Build Turbopack gagal dengan `binding to a port` / `Operation not permitted`:** lingkungan eksekusi membatasi pembuatan proses/socket; jalankan build di lingkungan yang mengizinkannya, atau coba `npm run build -- --webpack`.
- **Peringatan SQLite eksperimental:** beberapa versi Node.js menampilkannya untuk modul `node:sqlite`.

## Data dan publikasi kode

Kode sumber, lockfile dependensi, konfigurasi contoh, dan dokumentasi dapat disimpan di Git. `.env`, database, backup, `node_modules/`, dan hasil build dikecualikan oleh `.gitignore`. API key tetap berada di server. Saat memakai provider AI, topik dan konteks prompt dikirim ke provider yang dipilih.

Untuk berkontribusi, sertakan penjelasan perubahan dan jalankan `npm test`, `npm run typecheck`, serta `npm run build` sebelum mengajukan pull request.
