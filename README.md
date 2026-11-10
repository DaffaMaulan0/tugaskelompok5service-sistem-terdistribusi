# Tugas Kelompok: Arsitektur Sistem Terdistribusi (E-Commerce Microservices)

Proyek ini merupakan implementasi arsitektur **Microservices** dan **Transaksi Terdistribusi (*SAGA Pattern with Compensation*)** untuk platform e-commerce, yang dikerjakan berdasarkan pembagian tugas 5 peserta.

---

## 👥 Anggota Kelompok

| Nama | Akun GitHub | Peran |
|---|---|---|
| HizkiaGopas | [@HizkiaGopas](https://github.com/HizkiaGopas) | Katalog Service (Peserta 1), Pembayaran Service (Peserta 4) |
| daffamaulana | [@DaffaMaulan0](https://github.com/DaffaMaulan0) | Pelanggan Service (Peserta 2), API Gateway, Dashboard & Tests (Peserta 5) |
| MichaelPratamaSiagian | [@MichaelPratamaSiagian](https://github.com/MichaelPratamaSiagian) | Order Service (Peserta 3) |

---

## 👥 Pembagian Tugas & Struktur Folder

Sesuai dengan ketentuan tugas kelompok:

| Peran | Tanggung Jawab | Folder / Berkas | Port |
|---|---|---|---|
| **Peserta 1** | **Katalog Service** (produk, kategori, stok, reserve/release) | `katalog-service/` | `:5001` |
| **Peserta 2** | **Pelanggan Service** (registrasi, login JWT, profil, alamat, endpoint verifikasi token) | `pelanggan-service/` | `:5002` |
| **Peserta 3** | **Order Service** (keranjang, checkout dengan kompensasi, riwayat dan status pesanan) | `order-service/` | `:5003` |
| **Peserta 4** | **Pembayaran Service** (inisiasi dan simulasi pembayaran, sinkronisasi status, laporan) | `pembayaran-service/` | `:5004` |
| **Peserta 5** | **API Gateway, Dashboard** (toko dan admin), **Docker Compose**, **seed data**, **tes end-to-end** | `gateway/`, `tests/`, `docker-compose.yml` | `:5000` |

---

## 🏛️ Diagram Arsitektur Sistem

```
                              [ KLIEN / BROWSER ]
                                       │
                                       ▼ HTTP :5000
                       ┌──────────────────────────────┐
                       │   PESERTA 5: API GATEWAY     │
                       │   & Dashboard Toko / Admin   │
                       └──────────────┬───────────────┘
                                      │ Reverse Proxy
         ┌──────────────────┬─────────┴────────┬──────────────────┐
         │ :5001            │ :5002            │ :5003            │ :5004
         ▼                  ▼                  ▼                  ▼
┌─────────────────┐┌─────────────────┐┌─────────────────┐┌─────────────────┐
│    PESERTA 1    ││    PESERTA 2    ││    PESERTA 3    ││    PESERTA 4    │
│ Katalog Service ││Pelanggan Service││  Order Service  ││Pembayaran Service│
│ (Produk & Stok) ││ (Auth & Profil) ││(Saga Orchestr.) ││ (Simulasi Bayar) │
└────────┬────────┘└─────────────────┘└────────┬────────┘└────────┬────────┘
         ▲                                     │                  │
         │ (2) Reserve / (5b) Release / Commit │ (3) Inisiasi     │ (4) Callback
         └─────────────────────────────────────┴──────────────────┘
```

---

## 🔄 Alur Transaksi Terdistribusi (SAGA Pattern & Kompensasi)

1. **Inisiasi Checkout:**
   - Klien mengirim permintaan checkout ke `order-service` (`POST /api/orders/checkout`).
   - `order-service` memvalidasi identitas pelanggan ke `pelanggan-service`.
2. **Reservasi Stok Sementara (Locking):**
   - `order-service` menghubungi `katalog-service` (`POST /api/stock/reserve`).
   - `katalog-service` mengunci stok: `reserved` bertambah, `available` berkurang.
3. **Inisiasi Tagihan:**
   - `order-service` meminta `pembayaran-service` membuat tagihan (`POST /api/payments`).
4. **Hasil Pembayaran & Kompensasi:**
   - **Kasus Sukses:**
     - Pengguna membayar tagihan (`POST /api/payments/:id/simulate` action: `SUCCESS`).
     - `order-service` memanggil `katalog-service` (`POST /api/stock/commit`). Stok fisik terpotong permanen, pesanan berstatus `PAID`.
   - **Kasus Gagal / Pembatalan (KOMPENSASI SAGA):**
     - Pengguna gagal bayar atau saldo tidak cukup (`action: FAILED`).
     - `order-service` mengeksekusi **KOMPENSASI**: memanggil `katalog-service` (`POST /api/stock/release`).
     - Stok yang terkunci otomatis di-*release* kembali ke ketersediaan awal. Pesanan berstatus `CANCELLED`.

---

## 🚀 Panduan Menjalankan Sistem

### Opsi A: Menggunakan Docker Compose (Sangat Disarankan)

Pastikan Docker Desktop aktif di komputer Anda:

```bash
# 1. Bangun citra (build) dan jalankan seluruh container
docker compose up --build

# 2. Untuk menghentikan sistem:
docker compose down
```

Setelah berjalan:
- **Dashboard Web (Toko & Admin):** [http://localhost:5000](http://localhost:5000)
- **Unified Healthcheck:** [http://localhost:5000/health](http://localhost:5000/health)

---

### Opsi B: Menjalankan Langsung Tanpa Docker (Node.js)

1. **Instal dependensi pada masing-masing service:**
   ```bash
   cd katalog-service && npm install && cd ..
   cd pelanggan-service && npm install && cd ..
   cd order-service && npm install && cd ..
   cd pembayaran-service && npm install && cd ..
   cd gateway && npm install && cd ..
   ```

2. **Jalankan seluruh service sekaligus:**
   - Di Windows: Cukup jalankan berkas `start-all.bat` atau `start-all.ps1`.
   - Atau buka 5 terminal terpisah dan jalankan `npm start` di setiap folder:
     - Terminal 1: `cd katalog-service && npm start` (Port 5001)
     - Terminal 2: `cd pelanggan-service && npm start` (Port 5002)
     - Terminal 3: `cd order-service && npm start` (Port 5003)
     - Terminal 4: `cd pembayaran-service && npm start` (Port 5004)
     - Terminal 5: `cd gateway && npm start` (Port 5000)

---

## 🧪 Pengujian Otomatis End-to-End (E2E)

Proyek ini telah dilengkapi dengan rangkaian pengujian terotomatisasi (*automated test suite*) yang menguji seluruh integrasi:

```bash
# Jalankan pengujian menyeluruh
npm test
# atau
node tests/e2e-test.js
```

### Skenario yang Diuji:
1. Pengecekan status kesehatan (healthcheck) 5 node service.
2. Registrasi pelanggan, login, dan verifikasi JWT token.
3. Kueri katalog produk dan perhitungan stok `available`.
4. **Skenario 1 (Sukses):** Checkout -> Reservasi Stok -> Bayar Sukses -> Commit Stok Permanen.
5. **Skenario 2 (Rollback):** Checkout -> Reservasi Stok -> Bayar Gagal -> Trigger Kompensasi SAGA -> Release Stok Kembali Semula.
6. Rekapitulasi laporan keuangan & analitik pembayaran.

---

## 🔑 Data Pengguna Bawaan (Seed Data)

| Role | Nama | Email | Kata Sandi |
|---|---|---|---|
| Admin | Administrator Toko | `admin@toko.com` | `admin123` |
| Customer 1 | Budi Santoso | `budi@gmail.com` | `budi123` |
| Customer 2 | Siti Rahmawati | `siti@gmail.com` | `siti123` |

---

## 📂 Dokumentasi Setiap Peserta

Setiap folder memiliki berkas `README.md` terpisah dengan rincian API dan contoh payload:
- [Katalog Service (Peserta 1)](katalog-service/README.md)
- [Pelanggan Service (Peserta 2)](pelanggan-service/README.md)
- [Order Service (Peserta 3)](order-service/README.md)
- [Pembayaran Service (Peserta 4)](pembayaran-service/README.md)
- [Gateway & Dashboard (Peserta 5)](gateway/README.md)
- [Pengujian & Seed Data (Peserta 5)](tests/README.md)
