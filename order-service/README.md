# Order Service (Peserta 3)

**Tanggung Jawab:** Manajemen Keranjang Belanja, Orkestrasi Checkout Transaksi Terdistribusi dengan Kompensasi (Saga Orchestration Pattern), serta Riwayat dan Pelacakan Status Pesanan.

## Spesifikasi & Port
- **Port:** `5003`
- **Base URL:** `http://localhost:5003`
- **Docker Service:** `order-service`

## Arsitektur Transaksi Terdistribusi (SAGA Pattern)

Order Service bertindak sebagai **Saga Orchestrator** yang mengoordinasikan transaksi antar microservices:

```
[ Pelanggan ]
      |
   (1) POST /api/orders/checkout
      v
[ Order Service ] --(2) POST /api/stock/reserve-------------> [ Katalog Service ]
      |                                                              | (Stok Terkunci)
      +------------(3) POST /api/payments (Inisiasi)---------> [ Pembayaran Service ]
                                                                     |
                     [ Hasil Simulasi Pembayaran ]                   |
                                |                                    |
      +<--(4) POST /api/orders/:id/payment-result -------------------+
      |
  [ Keputusan SAGA ]:
  * JIKA SUKSES:
      Order Service --(5a) POST /api/stock/commit -----------> [ Katalog Service ]
      (Stok resmi terpotong, status pesanan menjadi PAID)
  * JIKA GAGAL (KOMPENSASI):
      Order Service --(5b) POST /api/stock/release ----------> [ Katalog Service ]
      (Stok dikembalikan ke katalog, status pesanan menjadi CANCELLED)
```

## Fitur Utama
1. **Keranjang Belanja (Cart):** Menyimpan, mengubah jumlah item, menghapus item, dan mengosongkan keranjang berdasarkan `userId`.
2. **Checkout Terdistribusi:** Menguji ketersediaan stok, mengunci stok di Katalog Service, menerbitkan invoice di Pembayaran Service.
3. **Kompensasi Otomatis (Rollback):** Jika pembayaran gagal atau inisiasi gagal, memicu webhook kompensasi untuk membebaskan reservasi stok.
4. **Riwayat dan Status Pesanan:** Menampilkan histori belanja, detail alamat, invoice pembayaran, dan timeline jejak audit event.

## Endpoint API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/health` | Health check service status |
| `GET` | `/api/cart` | Ambil isi keranjang belanja user |
| `POST` | `/api/cart/items` | Tambah produk ke keranjang |
| `PUT` | `/api/cart/items/:productId` | Ubah kuantitas produk di keranjang |
| `DELETE` | `/api/cart/items/:productId` | Hapus satu produk dari keranjang |
| `DELETE` | `/api/cart` | Kosongkan seluruh keranjang |
| `POST` | `/api/orders/checkout` | Mulai transaksi Checkout SAGA |
| `POST` | `/api/orders/:id/payment-result` | Webhook hasil pembayaran & trigger kompensasi |
| `GET` | `/api/orders` | Ambil riwayat order (support `?userId=`) |
| `GET` | `/api/orders/:id` | Detail order beserta riwayat timeline SAGA |
| `PUT` | `/api/orders/:id/status` | Ubah status pesanan (`SHIPPED`, `DELIVERED`, dll.) |
| `POST` | `/api/reset` | Reset data order & keranjang |

### Contoh Request & Response

#### 1. Checkout (`POST /api/orders/checkout`)
Request:
```json
{
  "userId": "usr-cust-1",
  "paymentMethod": "QRIS",
  "shippingAddress": {
    "recipientName": "Budi Santoso",
    "street": "Kawasan IPSC Sentul",
    "city": "Bogor"
  }
}
```
Response `201 Created`:
```json
{
  "success": true,
  "message": "Checkout berhasil dibuat. Silakan selesaikan pembayaran.",
  "order": {
    "id": "order-1700000000",
    "userId": "usr-cust-1",
    "totalAmount": 24500000,
    "status": "PENDING_PAYMENT"
  },
  "payment": {
    "id": "pay-1700000000",
    "amount": 24500000,
    "paymentMethod": "QRIS",
    "status": "PENDING"
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
docker build -t order-service .
docker run -p 5003:5003 order-service
```
