/**
 * SEED DATA INITIALIZER
 * Memastikan data awal terdistribusi tersimpan rapi pada masing-masing service.
 * Jalankan: node tests/seed-data.js
 */

const GATEWAY_URL = process.env.GATEWAY_URL || 'http://localhost:5000';
const KATALOG_URL = process.env.KATALOG_SERVICE_URL || 'http://localhost:5001';
const PELANGGAN_URL = process.env.PELANGGAN_SERVICE_URL || 'http://localhost:5002';
const ORDER_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:5003';
const PEMBAYARAN_URL = process.env.PEMBAYARAN_SERVICE_URL || 'http://localhost:5004';

async function seed() {
  console.log('====================================================');
  console.log('MENJALANKAN INISIALISASI SEED DATA SISTEM TERDISTRIBUSI');
  console.log('====================================================');

  // Coba reset via gateway terlebih dahulu
  try {
    const res = await fetch(`${GATEWAY_URL}/api/reset-all`, { method: 'POST' });
    if (res.ok) {
      const data = await res.json();
      console.log('✓ Berhasil reset dan seeding seluruh data via Gateway:');
      console.log(data);
      console.log('\nSeed Data Selesai.');
      return;
    }
  } catch (e) {
    console.log('Gateway belum aktif di port 5000, mencoba reset langsung ke tiap service individual...');
  }

  // Fallback: reset satu per satu
  const services = [
    { name: 'Katalog Service', url: `${KATALOG_URL}/api/reset` },
    { name: 'Pelanggan Service', url: `${PELANGGAN_URL}/api/reset` },
    { name: 'Order Service', url: `${ORDER_URL}/api/reset` },
    { name: 'Pembayaran Service', url: `${PEMBAYARAN_URL}/api/reset` }
  ];

  for (const s of services) {
    try {
      const res = await fetch(s.url, { method: 'POST' });
      if (res.ok) {
        console.log(`✓ ${s.name}: Berhasil di-reset ke nilai default`);
      } else {
        console.log(`✗ ${s.name}: Gagal reset (HTTP ${res.status})`);
      }
    } catch (err) {
      console.log(`✗ ${s.name}: Service belum aktif (${err.message})`);
    }
  }

  console.log('\nProses seed data selesai.');
}

seed();
