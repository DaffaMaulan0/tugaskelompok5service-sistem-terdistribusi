# Pengujian & Data Awal (Tests & Seed Data - Peserta 5)

Direktori ini berisi skrip pengujian otomatis menyeluruh (*End-to-End Test Suite*) dan skrip inisialisasi (*Seed Data*) untuk memvalidasi kerja sama seluruh 5 microservice.

## Berkas Pengujian
1. **`seed-data.js`**: Skrip untuk me-reset dan menyuntikkan data awal ke dalam seluruh service.
2. **`e2e-test.js`**: Skrip pengujian terotomatisasi yang memverifikasi:
   - Kesehatan koneksi kelima service melalui Gateway.
   - Pendaftaran akun, login, dan validasi token JWT.
   - Katalog produk dan perhitungan ketersediaan stok (`stock - reserved`).
   - **SAGA Transaksi Sukses:** Alur normal Checkout -> Reservasi Stok -> Pembayaran Sukses -> Pemotongan Permanen Stok (*Commit*).
   - **SAGA Kompensasi Rollback:** Alur kegagalan Checkout -> Reservasi Stok -> Pembayaran Gagal -> Pengembalian Stok Semula (*Release / Compensation*).
   - Rekapitulasi laporan analitik dan keuangan pembayaran.

## Cara Menjalankan Tes

Pastikan seluruh service telah menyala (baik menggunakan `docker compose up` maupun script `run-all`), kemudian jalankan:

```bash
# Inisialisasi / Reset Data
node tests/seed-data.js

# Menjalankan Otomasi Pengujian E2E
node tests/e2e-test.js
```
