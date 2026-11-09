# Pembayaran Service (Peserta 4)

**Tanggung Jawab:** Inisiasi Transaksi Pembayaran, Simulasi Pembayaran (Sukses / Gagal), Sinkronisasi Status Transaksi, dan Laporan Rekapitulasi Pembayaran.

## Spesifikasi & Port
- **Port:** `5004`
- **Base URL:** `http://localhost:5004`
- **Docker Service:** `pembayaran-service`

## Fitur Utama
1. **Inisiasi Pembayaran:** Menerima permintaan pembuatan invoice tagihan dari Order Service dengan metode: QRIS, Bank Transfer Virtual Account, E-Wallet, dan Kartu Kredit.
2. **Simulasi Pembayaran (Simulator):** Endpoint khusus untuk menguji skenario pembayaran nyata:
   - **`SUCCESS`**: Memicu webhook commit ke Order Service sehingga stok berkurang permanen dan pesanan berstatus `PAID`.
   - **`FAILED`**: Memicu webhook kompensasi ke Order Service sehingga stok dibebaskan kembali (*release*) dan pesanan dibatalkan (`CANCELLED`).
3. **Sinkronisasi Status:** Memungkinkan pengecekan status serta sinkronisasi ulang (*re-sync*) jika terjadi kendala jaringan sementara.
4. **Laporan & Analisis:** Menyajikan statistik total omzet, tingkat keberhasilan transaksi (*success rate*), serta persebaran metode pembayaran.

## Endpoint API

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/health` | Health check service status |
| `POST` | `/api/payments` | Inisiasi invoice tagihan pembayaran baru |
| `POST` | `/api/payments/:id/simulate` | Eksekusi simulasi bayar (`SUCCESS` atau `FAILED`) |
| `GET` | `/api/payments/:id` | Detail transaksi pembayaran |
| `GET` | `/api/payments/order/:orderId` | Cari pembayaran berdasarkan `orderId` |
| `POST` | `/api/payments/:id/sync` | Sinkronisasi ulang webhook ke Order Service |
| `GET` | `/api/payments` | Daftar semua transaksi (filter status & method) |
| `GET` | `/api/payments/reports/summary` | Laporan ringkasan total omzet & statistik |
| `GET` | `/api/payments/reports/transactions` | Laporan detail transaksi (filter tanggal & status) |
| `POST` | `/api/reset` | Reset data pembayaran ke nilai awal |

### Contoh Request & Response

#### 1. Inisiasi Pembayaran (`POST /api/payments`)
Request:
```json
{
  "orderId": "order-1700000000",
  "customerId": "usr-cust-1",
  "amount": 24500000,
  "paymentMethod": "QRIS"
}
```
Response `201 Created`:
```json
{
  "success": true,
  "message": "Tagihan pembayaran berhasil diinisiasi",
  "data": {
    "id": "pay-1700000000",
    "orderId": "order-1700000000",
    "amount": 24500000,
    "paymentMethod": "QRIS",
    "status": "PENDING",
    "referenceNumber": "QRIS-88291038"
  }
}
```

#### 2. Simulasi Pembayaran (`POST /api/payments/:id/simulate`)
Request (Skenario Kompensasi / Gagal):
```json
{
  "action": "FAILED",
  "failureReason": "Saldo kartu tidak mencukupi"
}
```
Response `200 OK`:
```json
{
  "success": true,
  "message": "Simulasi pembayaran berhasil diproses: FAILED",
  "data": {
    "id": "pay-1700000000",
    "status": "FAILED",
    "failureReason": "Saldo kartu tidak mencukupi",
    "webhookSync": { "success": true }
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
docker build -t pembayaran-service .
docker run -p 5004:5004 pembayaran-service
```
