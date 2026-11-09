# Katalog Service (Peserta 1)

**Tanggung Jawab:** Manajemen Produk, Kategori, Stok, serta Mekanisme Reservasi dan Release Stok (Distributed Transaction SAGA).

## Spesifikasi & Port
- **Port:** `5001`
- **Base URL:** `http://localhost:5001`
- **Docker Service:** `katalog-service`

## Fitur Utama
1. **Kategori:** CRUD data kategori barang.
2. **Produk:** CRUD produk lengkap dengan harga, deskripsi, gambar, kategori, dan stok.
3. **Stok Real-time:** Menghitung stok fisik (`stock`), stok yang sedang dipesan (`reserved`), dan stok yang siap dijual (`available = stock - reserved`).
4. **SAGA Pattern Support (Reserve, Release, Commit):**
   - **Reserve (`POST /api/stock/reserve`)**: Mengunci kuantitas stok saat pesanan baru dibuat agar tidak terjadi *race condition* atau *overselling*.
   - **Release (`POST /api/stock/release`)**: Kompensasi transaksi terdistribusi untuk mengembalikan kuantitas stok jika pembayaran gagal atau waktu pesanan kedaluwarsa.
   - **Commit (`POST /api/stock/commit`)**: Mengurangi stok fisik secara permanen setelah pembayaran berhasil dikonfirmasi.

## Endpoint API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/health` | Health check service status |
| `GET` | `/api/categories` | Daftar semua kategori |
| `POST` | `/api/categories` | Tambah kategori baru |
| `DELETE` | `/api/categories/:id` | Hapus kategori |
| `GET` | `/api/products` | Ambil semua produk (support query `?categoryId=` dan `?search=`) |
| `GET` | `/api/products/:id` | Detail produk beserta ketersediaan stok |
| `POST` | `/api/products` | Tambah produk baru |
| `PUT` | `/api/products/:id` | Perbarui data produk |
| `DELETE` | `/api/products/:id` | Hapus produk |
| `GET` | `/api/products/:id/stock` | Cek status stok (total, reserved, available) |
| `POST` | `/api/stock/reserve` | Kunci kuantitas stok untuk `orderId` |
| `POST` | `/api/stock/release` | Kompensasi: lepaskan kunci stok jika order batal/gagal |
| `POST` | `/api/stock/commit` | Finalisasi: potong stok permanen saat order sukses |
| `GET` | `/api/stock/reservations` | Daftar riwayat reservasi stok |
| `POST` | `/api/reset` | Reset data ke kondisi awal |

### Contoh Request & Response

#### 1. Reserve Stock (`POST /api/stock/reserve`)
Request:
```json
{
  "orderId": "order-1700000000",
  "items": [
    { "productId": "prod-1", "quantity": 1 },
    { "productId": "prod-2", "quantity": 2 }
  ]
}
```
Response `200 OK`:
```json
{
  "success": true,
  "message": "Stok berhasil di-reserve sementara",
  "reservation": {
    "id": "res-1700000010",
    "orderId": "order-1700000000",
    "status": "RESERVED"
  }
}
```

#### 2. Release Stock (Kompensasi SAGA) (`POST /api/stock/release`)
Request:
```json
{
  "orderId": "order-1700000000",
  "reason": "Pembayaran disimulasikan gagal oleh pengguna"
}
```
Response `200 OK`:
```json
{
  "success": true,
  "message": "Stok berhasil di-release kembali (Kompensasi SAGA selesai)",
  "reservation": {
    "orderId": "order-1700000000",
    "status": "RELEASED",
    "reason": "Pembayaran disimulasikan gagal oleh pengguna"
  }
}
```

## Cara Menjalankan
```bash
npm install
npm start
```
Atau via Docker:
```bash
docker build -t katalog-service .
docker run -p 5001:5001 katalog-service
```
