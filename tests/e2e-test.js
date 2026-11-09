/**
 * END-TO-END AUTOMATED TEST SUITE
 * Pengujian komprehensif seluruh alur transaksi sistem terdistribusi,
 * termasuk pengujian pola kompensasi SAGA rollback stok jika bayar gagal.
 *
 * Jalankan: node tests/e2e-test.js
 */

const BASE_URL = process.env.GATEWAY_URL || 'http://localhost:5000';

const GREEN = '\x1b[32m';
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const CYAN = '\x1b[36m';
const BOLD = '\x1b[1m';
const RESET = '\x1b[0m';

let passedTests = 0;
let failedTests = 0;

function assert(condition, testName, detail = '') {
  if (condition) {
    console.log(`  ${GREEN}✓ PASS:${RESET} ${testName}`);
    passedTests++;
  } else {
    console.log(`  ${RED}✗ FAIL:${RESET} ${testName} ${detail ? `(${detail})` : ''}`);
    failedTests++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const config = {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  };
  if (config.body && typeof config.body !== 'string') {
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(url, config);
  const data = await response.json().catch(() => ({}));
  return { status: response.status, ok: response.ok, data };
}

async function runTests() {
  console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
  console.log(`${BOLD}${CYAN}     PENGUJIAN END-TO-END SISTEM TERDISTRIBUSI (SAGA PATTERN)     ${RESET}`);
  console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);
  console.log(`Gateway Target: ${BOLD}${BASE_URL}${RESET}\n`);

  try {
    // -------------------------------------------------------------
    // TEST 1: HEALTH CHECK SELURUH MICROSERVICES
    // -------------------------------------------------------------
    console.log(`${BOLD}[TEST 1] Memeriksa Kesehatan Seluruh Layanan (API Gateway & Microservices)...${RESET}`);
    const health = await request('/health');
    assert(health.status === 200, 'Gateway dan seluruh 4 microservice merespons status HEALTHY');
    if (health.data.services) {
      health.data.services.forEach(s => {
        assert(s.status === 'UP', `Service ${s.name} dalam status UP (${s.latencyMs}ms)`);
      });
    }

    // Reset data ke kondisi awal sebelum pengujian
    await request('/api/reset-all', { method: 'POST' });

    // -------------------------------------------------------------
    // TEST 2: PELANGGAN SERVICE (REGISTRASI, LOGIN & VERIFIKASI JWT)
    // -------------------------------------------------------------
    console.log(`\n${BOLD}[TEST 2] Pengujian Pelanggan Service (Auth & JWT)...${RESET}`);
    const testEmail = `tester_${Date.now()}@unhan.ac.id`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: {
        name: 'Kadet Mahasiswa',
        email: testEmail,
        password: 'password123',
        phone: '08123456789'
      }
    });
    assert(regRes.status === 201 && regRes.data.success, 'Registrasi akun pelanggan baru berhasil');
    assert(!!regRes.data.token, 'Menerima token JWT hasil registrasi');

    // Login test
    const loginRes = await request('/api/auth/login', {
      method: 'POST',
      body: { email: testEmail, password: 'password123' }
    });
    assert(loginRes.status === 200 && loginRes.data.success, 'Login akun berhasil dengan kredensial yang valid');
    const userToken = loginRes.data.token;
    const testUserId = loginRes.data.user.id;

    // Verifikasi Token
    const verifyRes = await request('/api/auth/verify', {
      method: 'POST',
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert(verifyRes.status === 200 && verifyRes.data.valid, 'Verifikasi token JWT berhasil dan valid');

    // -------------------------------------------------------------
    // TEST 3: KATALOG SERVICE (PRODUK & KETERSEDIAAN STOK)
    // -------------------------------------------------------------
    console.log(`\n${BOLD}[TEST 3] Pengujian Katalog Service (Query & Stok)...${RESET}`);
    const prodRes = await request('/api/products');
    assert(prodRes.status === 200 && prodRes.data.count > 0, 'Berhasil mengambil daftar produk katalog');

    const laptop = prodRes.data.data.find(p => p.id === 'prod-1');
    const initialLaptopStock = laptop.stock;
    const initialLaptopAvailable = laptop.available;
    console.log(`  ${YELLOW}ℹ Info Stok Prod-1 (${laptop.name}): Total=${initialLaptopStock}, Tersedia=${initialLaptopAvailable}${RESET}`);

    // -------------------------------------------------------------
    // TEST 4: SAGA SKENARIO 1 (TRANSAKSI SUKSES & COMMIT STOK)
    // -------------------------------------------------------------
    console.log(`\n${BOLD}[TEST 4] SAGA SKENARIO 1: Alur Normal Transaksi Sukses & Commit Stok...${RESET}`);

    // Step A: Tambah item ke keranjang
    const addCart = await request('/api/cart/items', {
      method: 'POST',
      headers: { 'x-user-id': testUserId },
      body: { productId: 'prod-1', quantity: 1 }
    });
    assert(addCart.status === 200 && addCart.data.success, 'Item berhasil ditambahkan ke keranjang belanja');

    // Step B: Lakukan Checkout (Memulai SAGA)
    const checkoutRes = await request('/api/orders/checkout', {
      method: 'POST',
      headers: { 'x-user-id': testUserId },
      body: {
        userId: testUserId,
        paymentMethod: 'QRIS'
      }
    });
    assert(checkoutRes.status === 201 && checkoutRes.data.success, 'Checkout SAGA berhasil dimulai (Status: PENDING_PAYMENT)');
    const order1 = checkoutRes.data.order;
    const payment1 = checkoutRes.data.payment;

    // Step C: Periksa apakah stok di-RESERVE (stok available berkurang 1, reserved bertambah 1)
    const stockAfterReserve = await request('/api/products/prod-1/stock');
    assert(
      stockAfterReserve.data.data.reservedStock >= 1,
      'Stok barang berhasil di-RESERVE sementara di Katalog Service saat checkout'
    );
    assert(
      stockAfterReserve.data.data.availableStock === initialLaptopAvailable - 1,
      'Stok ketersediaan (available) berkurang tepat sejumlah pesanan'
    );

    // Step D: Simulasi Pembayaran SUKSES
    console.log(`  ${YELLOW}ℹ Menjalankan simulasi bayar SUKSES untuk payment ${payment1.id}...${RESET}`);
    const paySuccessRes = await request(`/api/payments/${payment1.id}/simulate`, {
      method: 'POST',
      body: { action: 'SUCCESS' }
    });
    assert(paySuccessRes.status === 200 && paySuccessRes.data.data.status === 'SUCCESS', 'Pembayaran sukses diverifikasi');

    // Step E: Verifikasi Order berstatus PAID dan Stok telah di-COMMIT
    const order1Detail = await request(`/api/orders/${order1.id}`);
    assert(order1Detail.data.data.status === 'PAID', 'Status pesanan berubah menjadi PAID');

    const stockAfterCommit = await request('/api/products/prod-1/stock');
    assert(
      stockAfterCommit.data.data.totalStock === initialLaptopStock - 1,
      'Stok fisik (total stock) resmi terpotong permanen setelah SAGA Commit'
    );
    assert(
      stockAfterCommit.data.data.reservedStock === 0,
      'Reserved stock kembali ke 0 setelah transaksi selesai'
    );

    // -------------------------------------------------------------
    // TEST 5: SAGA SKENARIO 2 (PEMBAYARAN GAGAL & KOMPENSASI ROLLBACK STOK)
    // -------------------------------------------------------------
    console.log(`\n${BOLD}[TEST 5] SAGA SKENARIO 2: Pembayaran Gagal & Eksekusi KOMPENSASI ROLLBACK Stok...${RESET}`);

    // Cek stok awal prod-2 (Smartwatch)
    const prod2Before = (await request('/api/products/prod-2/stock')).data.data;
    console.log(`  ${YELLOW}ℹ Stok Awal Prod-2: Total=${prod2Before.totalStock}, Available=${prod2Before.availableStock}${RESET}`);

    // Step A: Tambah item prod-2 ke keranjang
    await request('/api/cart/items', {
      method: 'POST',
      headers: { 'x-user-id': testUserId },
      body: { productId: 'prod-2', quantity: 2 }
    });

    // Step B: Lakukan Checkout
    const checkoutRes2 = await request('/api/orders/checkout', {
      method: 'POST',
      headers: { 'x-user-id': testUserId },
      body: {
        userId: testUserId,
        paymentMethod: 'BANK_TRANSFER'
      }
    });
    assert(checkoutRes2.status === 201, 'Order 2 berhasil di-checkout dan stok prod-2 di-reserve sebanyak 2 unit');
    const order2 = checkoutRes2.data.order;
    const payment2 = checkoutRes2.data.payment;

    // Verifikasi stok ter-reserve
    const stockReserved2 = (await request('/api/products/prod-2/stock')).data.data;
    assert(stockReserved2.reservedStock === 2, 'Stok prod-2 berhasil dikunci (Reserved = 2)');

    // Step C: Simulasi Pembayaran GAGAL / Dibatalkan
    console.log(`  ${YELLOW}ℹ Menjalankan simulasi bayar GAGAL untuk memicu KOMPENSASI SAGA...${RESET}`);
    const payFailRes = await request(`/api/payments/${payment2.id}/simulate`, {
      method: 'POST',
      body: { action: 'FAILED', failureReason: 'Saldo kartu tidak mencukupi (Uji Kompensasi)' }
    });
    assert(payFailRes.status === 200 && payFailRes.data.data.status === 'FAILED', 'Pembayaran ditandai FAILED');

    // Step D: Verifikasi KOMPENSASI SAGA
    const order2Detail = await request(`/api/orders/${order2.id}`);
    assert(
      order2Detail.data.data.status === 'CANCELLED',
      'Order dibatalkan (Status: CANCELLED) karena pembayaran gagal'
    );

    // Step E: Verifikasi Stok Prod-2 DIKEMBALIKAN (RELEASED) ke semula!
    const stockAfterRollback = (await request('/api/products/prod-2/stock')).data.data;
    assert(
      stockAfterRollback.availableStock === prod2Before.availableStock,
      'KOMPENSASI SAGA BERHASIL: Stok barang yang terkunci telah di-RELEASE kembali utuh!'
    );
    assert(
      stockAfterRollback.reservedStock === 0,
      'Reserved stock kembali ke 0 setelah kompensasi'
    );
    assert(
      stockAfterRollback.totalStock === prod2Before.totalStock,
      'Total stok fisik tidak berkurang karena order dibatalkan'
    );

    // -------------------------------------------------------------
    // TEST 6: LAPORAN PEMBAYARAN & SINKRONISASI
    // -------------------------------------------------------------
    console.log(`\n${BOLD}[TEST 6] Pengujian Laporan Pembayaran (Peserta 4)...${RESET}`);
    const reportRes = await request('/api/payments/reports/summary');
    assert(reportRes.status === 200 && reportRes.data.success, 'Laporan ringkasan pembayaran berhasil diakses');
    assert(reportRes.data.data.totalTransactions >= 2, 'Tercatat minimal 2 riwayat transaksi pengujian');
    assert(reportRes.data.data.failedCount >= 1, 'Tercatat transaksi gagal dalam laporan statistik');

    // -------------------------------------------------------------
    // KESIMPULAN
    // -------------------------------------------------------------
    console.log(`\n${BOLD}${CYAN}================================================================${RESET}`);
    console.log(`${BOLD}HASIL PENGUJIAN AKHIR:${RESET}`);
    console.log(`Total Pengujian : ${passedTests + failedTests}`);
    console.log(`Lolos (PASS)    : ${GREEN}${passedTests}${RESET}`);
    console.log(`Gagal (FAIL)    : ${failedTests === 0 ? GREEN : RED}${failedTests}${RESET}`);
    console.log(`${BOLD}${CYAN}================================================================${RESET}\n`);

    if (failedTests === 0) {
      console.log(`${GREEN}${BOLD}SELURUH MODUL MICROSERVICES & POLA SAGA KOMPENSASI LOLOS UJI 100%!${RESET}\n`);
      process.exit(0);
    } else {
      console.log(`${RED}${BOLD}Beberapa pengujian mengalami kegagalan. Silakan periksa log di atas.${RESET}\n`);
      process.exit(1);
    }

  } catch (err) {
    console.error(`${RED}Error tidak terduga saat pengujian:${RESET}`, err);
    process.exit(1);
  }
}

runTests();
