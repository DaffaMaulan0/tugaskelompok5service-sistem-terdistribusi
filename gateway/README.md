# API Gateway & Dashboard (Peserta 5)

**Tanggung Jawab:** Gerbang Masuk Tunggal (API Gateway Reverse Proxy), Dashboard Interaktif (Toko & Admin), Health Monitoring Seluruh Layanan, dan Orquestrasi Sistem.

## Spesifikasi & Port
- **Port:** `5000`
- **Dashboard URL:** `http://localhost:5000`
- **Docker Service:** `gateway`

## Routing Reverse Proxy
API Gateway mengarahkan seluruh permintaan klien ke microservices internal:

| URL Path di Gateway | Target Downstream Microservice | Tanggung Jawab |
|---|---|---|
| `/api/katalog/*` & `/api/products/*` | `http://katalog-service:5001` | Peserta 1 (Katalog & Stok) |
| `/api/pelanggan/*` & `/api/auth/*` | `http://pelanggan-service:5002` | Peserta 2 (Auth & User) |
| `/api/order/*`, `/api/orders/*`, `/api/cart/*` | `http://order-service:5003` | Peserta 3 (SAGA & Keranjang) |
| `/api/pembayaran/*` & `/api/payments/*` | `http://pembayaran-service:5004` | Peserta 4 (Pembayaran) |
| `/health` | Pemeriksaan kesehatan 5 services | Peserta 5 |
| `/api/reset-all` | Reset data seluruh services ke default | Peserta 5 |

## Fitur Dashboard Web (Single Page Application)
1. **Toko (Storefront):**
   - Menampilkan katalog produk secara real-time dengan filter kategori dan pencarian.
   - Status stok real-time (Tersedia dan Reserved).
   - Keranjang belanja interaktif dengan penyesuaian kuantitas.
   - Tombol checkout yang memicu orkestrasi transaksi terdistribusi SAGA.
   - **Simulasi Pembayaran Interaktif:** Tombol langsung untuk menguji skenario **Commit (Bayar Sukses)** dan **Rollback Kompensasi (Bayar Gagal)**.
2. **Riwayat Pesanan Pelanggan:**
   - Memantau status pesanan (`PAID`, `CANCELLED`, `PENDING_PAYMENT`).
   - Modal Jejak Audit SAGA untuk melihat riwayat event transaksi langkah demi langkah.
3. **Dashboard Admin:**
   - Ringkasan metrik statistik (Total Produk, Pelanggan, Order, Total Omzet).
   - Manajemen stok produk (ubah stok, tambah produk baru).
   - SAGA Transaction Monitor: Memantau status pesanan dan kompensasi seluruh pengguna.
   - Laporan pembayaran dan visualisasi status transaksi.
   - Topologi & Health Monitoring 5 microservices dengan latensi ms.

## Cara Menjalankan
```bash
npm install
npm start
```
Buka browser di `http://localhost:5000`.
