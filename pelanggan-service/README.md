# Pelanggan Service (Peserta 2)

**Tanggung Jawab:** Registrasi Pengguna, Login dengan JWT, Manajemen Profil, Manajemen Alamat Pengiriman, dan Endpoint Verifikasi Token untuk Layanan Lain.

## Spesifikasi & Port
- **Port:** `5002`
- **Base URL:** `http://localhost:5002`
- **Docker Service:** `pelanggan-service`

## Fitur Utama
1. **Registrasi Pelanggan:** Pendaftaran akun baru dengan hashing kata sandi aman (Bcrypt).
2. **Login & JWT Token:** Otentikasi menghasilkan token JWT yang berlaku selama 7 hari berisi claims `id`, `name`, `email`, dan `role`.
3. **Verifikasi Token (`/api/auth/verify`):** Endpoint khusus untuk divalidasi oleh API Gateway dan Order Service dalam arsitektur microservices terdistribusi.
4. **Profil Pengguna:** Melihat dan memperbarui data profil akun pelanggan.
5. **Alamat Pengiriman:** Menambah, melihat, mengubah, dan menghapus alamat pengiriman pesanan (support alamat default).

## Data Akun Bawaan (Default Seed Data)
| Role | Email | Password | Nama |
|---|---|---|---|
| Admin | `admin@toko.com` | `admin123` | Administrator Toko |
| Customer | `budi@gmail.com` | `budi123` | Budi Santoso |
| Customer | `siti@gmail.com` | `siti123` | Siti Rahmawati |

## Endpoint API

| Method | Endpoint | Deskripsi | Auth |
|---|---|---|---|
| `GET` | `/health` | Health check service status | Publik |
| `POST` | `/api/auth/register` | Pendaftaran akun baru | Publik |
| `POST` | `/api/auth/login` | Login dan peroleh JWT token | Publik |
| `POST` / `GET` | `/api/auth/verify` | Verifikasi validitas token JWT | Bearer Header / Body |
| `GET` | `/api/customers/profile` | Ambil data profil pengguna saat ini | Wajib JWT |
| `PUT` | `/api/customers/profile` | Ubah profil nama, telepon, sandi | Wajib JWT |
| `GET` | `/api/customers` | Ambil daftar semua pengguna | Admin / Internal |
| `GET` | `/api/customers/:id` | Ambil detail satu pengguna | Publik / Internal |
| `GET` | `/api/customers/:userId/addresses` | Ambil semua alamat user tertentu | Publik / Internal |
| `POST` | `/api/customers/:userId/addresses` | Tambah alamat pengiriman baru | Publik / Internal |
| `PUT` | `/api/addresses/:id` | Perbarui data alamat | Publik / Internal |
| `DELETE` | `/api/addresses/:id` | Hapus data alamat | Publik / Internal |
| `POST` | `/api/reset` | Reset data pengguna & alamat ke awal | Publik |

### Contoh Request & Response

#### 1. Login (`POST /api/auth/login`)
Request:
```json
{
  "email": "budi@gmail.com",
  "password": "budi123"
}
```
Response `200 OK`:
```json
{
  "success": true,
  "message": "Login berhasil",
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "user": {
    "id": "usr-cust-1",
    "name": "Budi Santoso",
    "email": "budi@gmail.com",
    "phone": "081234567890",
    "role": "customer"
  }
}
```

#### 2. Verifikasi Token (`POST /api/auth/verify`)
Header: `Authorization: Bearer <token>`
Response `200 OK`:
```json
{
  "valid": true,
  "message": "Token terverifikasi valid",
  "user": {
    "id": "usr-cust-1",
    "name": "Budi Santoso",
    "email": "budi@gmail.com",
    "role": "customer"
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
docker build -t pelanggan-service .
docker run -p 5002:5002 pelanggan-service
```
