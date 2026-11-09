const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5003;
const DATA_FILE = path.join(__dirname, 'data', 'order.json');

// Service URLs (configurable via env for Docker Compose or local development)
const KATALOG_SERVICE_URL = process.env.KATALOG_SERVICE_URL || 'http://localhost:5001';
const PELANGGAN_SERVICE_URL = process.env.PELANGGAN_SERVICE_URL || 'http://localhost:5002';
const PEMBAYARAN_SERVICE_URL = process.env.PEMBAYARAN_SERVICE_URL || 'http://localhost:5004';

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[ORDER-SERVICE] ${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

// Initial seed data
const initialData = {
  carts: {
    'usr-cust-1': [
      {
        productId: 'prod-1',
        name: 'Laptop Taktikal Ruggedized Core i7',
        price: 24500000,
        quantity: 1,
        imageUrl: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=60'
      }
    ]
  },
  orders: [
    {
      id: 'order-1001',
      userId: 'usr-cust-2',
      customerName: 'Siti Rahmawati',
      customerEmail: 'siti@gmail.com',
      items: [
        {
          productId: 'prod-2',
          name: 'Smartwatch GPS Taktikal Solarpower',
          price: 6800000,
          quantity: 1
        }
      ],
      totalAmount: 6800000,
      status: 'PAID',
      shippingAddress: {
        recipientName: 'Siti Rahmawati',
        phone: '081288887777',
        street: 'Komplek Unhan Indonesia, Sentul Citeureup',
        city: 'Bogor',
        province: 'Jawa Barat',
        postalCode: '16810'
      },
      paymentMethod: 'QRIS',
      paymentId: 'pay-1001',
      createdAt: '2026-11-04T10:00:00.000Z',
      timeline: [
        { timestamp: '2026-11-04T10:00:00.000Z', event: 'ORDER_CREATED', message: 'Pesanan dibuat' },
        { timestamp: '2026-11-04T10:00:05.000Z', event: 'STOCK_RESERVED', message: 'Stok berhasil di-reserve di Katalog Service' },
        { timestamp: '2026-11-04T10:02:30.000Z', event: 'PAYMENT_CONFIRMED', message: 'Pembayaran QRIS lunas terkonfirmasi' },
        { timestamp: '2026-11-04T10:02:31.000Z', event: 'STOCK_COMMITTED', message: 'Stok telah dipotong permanen' }
      ]
    }
  ]
};

// Persistence helpers
function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) {
      fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
      fs.writeFileSync(DATA_FILE, JSON.stringify(initialData, null, 2), 'utf8');
      return JSON.parse(JSON.stringify(initialData));
    }
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('[ORDER-SERVICE] Error reading data file:', err.message);
    return JSON.parse(JSON.stringify(initialData));
  }
}

function saveData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[ORDER-SERVICE] Error saving data file:', err.message);
  }
}

// Helper: HTTP request wrapper using native fetch
async function callService(url, method = 'GET', body = null, headers = {}) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json', ...headers }
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

// Health check
app.get('/health', (req, res) => {
  res.json({
    service: 'order-service',
    status: 'UP',
    port: PORT,
    dependencies: {
      katalog: KATALOG_SERVICE_URL,
      pelanggan: PELANGGAN_SERVICE_URL,
      pembayaran: PEMBAYARAN_SERVICE_URL
    },
    timestamp: new Date()
  });
});

// Reset endpoint
app.post('/api/reset', (req, res) => {
  const data = JSON.parse(JSON.stringify(initialData));
  saveData(data);
  res.json({ success: true, message: 'Data order & keranjang berhasil di-reset ke nilai awal.' });
});

// ==========================================
// 1. KERANJANG BELANJA (CART)
// ==========================================

// Ambil keranjang user
app.get('/api/cart', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId || 'usr-cust-1';
  const data = loadData();
  const items = data.carts[userId] || [];
  const totalAmount = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  res.json({
    success: true,
    userId,
    items,
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount
  });
});

// Tambah item ke keranjang
app.post('/api/cart/items', async (req, res) => {
  const userId = req.headers['x-user-id'] || req.body.userId || 'usr-cust-1';
  const { productId, quantity = 1 } = req.body;

  if (!productId) {
    return res.status(400).json({ success: false, error: 'productId wajib diisi' });
  }

  // Ambil detail produk dari Katalog Service
  try {
    const prodRes = await callService(`${KATALOG_SERVICE_URL}/api/products/${productId}`);
    if (!prodRes.ok || !prodRes.data.data) {
      return res.status(404).json({ success: false, error: 'Produk tidak ditemukan di Katalog Service' });
    }

    const prod = prodRes.data.data;
    if (prod.available < quantity) {
      return res.status(400).json({
        success: false,
        error: `Stok produk tidak mencukupi (Tersedia: ${prod.available})`
      });
    }

    const data = loadData();
    if (!data.carts[userId]) {
      data.carts[userId] = [];
    }

    const existingIdx = data.carts[userId].findIndex(i => i.productId === productId);
    if (existingIdx !== -1) {
      data.carts[userId][existingIdx].quantity += Number(quantity);
    } else {
      data.carts[userId].push({
        productId: prod.id,
        name: prod.name,
        price: prod.price,
        quantity: Number(quantity),
        imageUrl: prod.imageUrl
      });
    }

    saveData(data);
    res.json({
      success: true,
      message: 'Item berhasil ditambahkan ke keranjang',
      cart: data.carts[userId]
    });
  } catch (err) {
    console.error('[ORDER-SERVICE] Error calling Katalog Service:', err.message);
    res.status(500).json({ success: false, error: 'Gagal menghubungi Katalog Service', details: err.message });
  }
});

// Update kuantitas item keranjang
app.put('/api/cart/items/:productId', (req, res) => {
  const userId = req.headers['x-user-id'] || req.body.userId || 'usr-cust-1';
  const { quantity } = req.body;
  const productId = req.params.productId;

  const data = loadData();
  const cart = data.carts[userId] || [];
  const item = cart.find(i => i.productId === productId);

  if (!item) {
    return res.status(404).json({ success: false, error: 'Item tidak ditemukan di keranjang' });
  }

  if (Number(quantity) <= 0) {
    data.carts[userId] = cart.filter(i => i.productId !== productId);
  } else {
    item.quantity = Number(quantity);
  }

  saveData(data);
  res.json({ success: true, message: 'Kuantitas keranjang berhasil diperbarui', cart: data.carts[userId] });
});

// Hapus item dari keranjang
app.delete('/api/cart/items/:productId', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId || 'usr-cust-1';
  const productId = req.params.productId;

  const data = loadData();
  if (data.carts[userId]) {
    data.carts[userId] = data.carts[userId].filter(i => i.productId !== productId);
    saveData(data);
  }

  res.json({ success: true, message: 'Item berhasil dihapus dari keranjang' });
});

// Kosongkan keranjang
app.delete('/api/cart', (req, res) => {
  const userId = req.headers['x-user-id'] || req.query.userId || req.body.userId || 'usr-cust-1';
  const data = loadData();
  data.carts[userId] = [];
  saveData(data);
  res.json({ success: true, message: 'Keranjang berhasil dikosongkan' });
});

// =========================================================================
// 2. CHECKOUT DENGAN KOMPENSASI (SAGA ORCHESTRATION PATTERN)
// =========================================================================

/**
 * Alur Transaksi Terdistribusi (SAGA):
 * 1. Validasi User / Pelanggan (Pelanggan Service)
 * 2. Reserve Stok Barang (Katalog Service)
 *    -> JIKA GAGAL: Batalkan transaksi langsung (stok tidak cukup).
 * 3. Simpan Pesanan Baru (status: PENDING_PAYMENT)
 * 4. Buat Inisiasi Pembayaran (Pembayaran Service)
 *    -> JIKA GAGAL: Jalankan KOMPENSASI (release stok di katalog-service), ubah order jadi CANCELLED.
 * 5. Kosongkan keranjang belanja user.
 */
app.post('/api/orders/checkout', async (req, res) => {
  const userId = req.headers['x-user-id'] || req.body.userId || 'usr-cust-1';
  const { shippingAddress, paymentMethod = 'QRIS', customItems } = req.body;

  const data = loadData();
  let checkoutItems = customItems;

  if (!checkoutItems || checkoutItems.length === 0) {
    checkoutItems = data.carts[userId] || [];
  }

  if (!checkoutItems || checkoutItems.length === 0) {
    return res.status(400).json({ success: false, error: 'Keranjang belanja kosong. Tambahkan barang sebelum checkout.' });
  }

  const orderId = `order-${Date.now()}`;
  console.log(`\n-----------------------------------------------------------`);
  console.log(`[ORDER SAGA] Memulai SAGA Checkout untuk Order ${orderId} (User: ${userId})`);

  // STEP 1: Verifikasi Pelanggan
  let customerInfo = { id: userId, name: 'Customer', email: 'user@toko.com' };
  try {
    const userRes = await callService(`${PELANGGAN_SERVICE_URL}/api/customers/${userId}`);
    if (userRes.ok && userRes.data.data) {
      customerInfo = userRes.data.data;
    }
  } catch (err) {
    console.warn(`[ORDER SAGA] Warning: Gagal verifikasi detail customer, memakai fallback:`, err.message);
  }

  // STEP 2: Reservasi Stok di Katalog Service
  const reservationItems = checkoutItems.map(i => ({
    productId: i.productId,
    quantity: i.quantity
  }));

  console.log(`[ORDER SAGA] [Step 1/3] Mengirim permintaan Reservasi Stok ke Katalog Service...`);
  let reserveRes;
  try {
    reserveRes = await callService(`${KATALOG_SERVICE_URL}/api/stock/reserve`, 'POST', {
      orderId,
      items: reservationItems
    });
  } catch (err) {
    console.error(`[ORDER SAGA] [FAIL] Gagal koneksi ke Katalog Service:`, err.message);
    return res.status(503).json({
      success: false,
      error: 'Layanan Katalog tidak dapat dihubungi saat reservasi stok.'
    });
  }

  if (!reserveRes.ok || !reserveRes.data.success) {
    console.error(`[ORDER SAGA] [ABORT] Reservasi stok ditolak oleh Katalog Service:`, reserveRes.data.error);
    return res.status(400).json({
      success: false,
      error: `Checkout gagal: ${reserveRes.data.error || 'Stok tidak mencukupi'}`
    });
  }

  console.log(`[ORDER SAGA] [SUCCESS] Stok berhasil di-reserve sementara untuk ${orderId}`);

  // Hitung total harga
  const totalAmount = checkoutItems.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Buat draft order
  const newOrder = {
    id: orderId,
    userId,
    customerName: customerInfo.name,
    customerEmail: customerInfo.email,
    items: checkoutItems,
    totalAmount,
    status: 'PENDING_PAYMENT',
    paymentMethod,
    shippingAddress: shippingAddress || {
      recipientName: customerInfo.name,
      street: 'Alamat pengiriman default',
      city: 'Jakarta'
    },
    paymentId: null,
    createdAt: new Date().toISOString(),
    timeline: [
      {
        timestamp: new Date().toISOString(),
        event: 'ORDER_INITIATED',
        message: 'Order dibuat dan siap menunggu inisiasi pembayaran'
      },
      {
        timestamp: new Date().toISOString(),
        event: 'STOCK_RESERVED',
        message: 'Stok berhasil dikunci di Katalog Service (Pending Payment)'
      }
    ]
  };

  // STEP 3: Inisiasi Pembayaran ke Pembayaran Service
  console.log(`[ORDER SAGA] [Step 2/3] Meminta inisiasi pembayaran sebesar Rp ${totalAmount.toLocaleString('id-ID')} ke Pembayaran Service...`);
  let paymentRes;
  try {
    paymentRes = await callService(`${PEMBAYARAN_SERVICE_URL}/api/payments`, 'POST', {
      orderId,
      customerId: userId,
      customerName: customerInfo.name,
      amount: totalAmount,
      paymentMethod
    });
  } catch (err) {
    console.error(`[ORDER SAGA] [FAIL] Error koneksi ke Pembayaran Service:`, err.message);
  }

  // Jika inisiasi pembayaran GAGAL -> EKSEKUSI KOMPENSASI SAGA!
  if (!paymentRes || !paymentRes.ok || !paymentRes.data.success) {
    console.error(`[ORDER SAGA] [KOMPENSASI DIJALANKAN] Inisiasi pembayaran gagal. Melepaskan kembali reservasi stok...`);

    try {
      await callService(`${KATALOG_SERVICE_URL}/api/stock/release`, 'POST', {
        orderId,
        reason: 'Inisiasi pembayaran gagal, stok di-release (Rollback SAGA)'
      });
      console.log(`[ORDER SAGA] [KOMPENSASI SELESAI] Stok berhasil di-rollback.`);
    } catch (compErr) {
      console.error(`[ORDER SAGA] [CRITICAL] Gagal me-release stok saat kompensasi:`, compErr.message);
    }

    newOrder.status = 'CANCELLED';
    newOrder.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'SAGA_COMPENSATION_RELEASE',
      message: 'Inisiasi pembayaran gagal. Transaksi dibatalkan dan stok dikembalikan (Kompensasi SAGA).'
    });

    data.orders.unshift(newOrder);
    saveData(data);

    return res.status(500).json({
      success: false,
      error: 'Inisiasi pembayaran gagal. Transaksi dibatalkan dan stok telah dikembalikan.',
      order: newOrder
    });
  }

  // Jika Pembayaran berhasil diinisiasi
  const paymentData = paymentRes.data.data;
  newOrder.paymentId = paymentData.id;
  newOrder.paymentDetails = paymentData;
  newOrder.timeline.push({
    timestamp: new Date().toISOString(),
    event: 'PAYMENT_INITIATED',
    message: `Tagihan pembayaran ${paymentData.id} berhasil diterbitkan dengan metode ${paymentMethod}`
  });

  // Simpan order
  data.orders.unshift(newOrder);

  // Kosongkan cart user
  data.carts[userId] = [];
  saveData(data);

  console.log(`[ORDER SAGA] [SUCCESS] Order ${orderId} siap dibayar. Menunggu hasil pembayaran...`);
  console.log(`-----------------------------------------------------------\n`);

  res.status(201).json({
    success: true,
    message: 'Checkout berhasil dibuat. Silakan selesaikan pembayaran.',
    order: newOrder,
    payment: paymentData
  });
});

// =========================================================================
// 3. PAYMENT RESULT CALLBACK & KOMPENSASI PENUH
// =========================================================================

/**
 * Dipanggil oleh Pembayaran Service saat simulasi bayar (Sukses atau Gagal/Batal).
 * - JIKA SUCCESS: Commit stok di Katalog Service, order status -> PAID.
 * - JIKA FAILED: Release stok di Katalog Service (KOMPENSASI!), order status -> CANCELLED.
 */
app.post('/api/orders/:id/payment-result', async (req, res) => {
  const orderId = req.params.id;
  const { status, paymentId, reason } = req.body;

  const data = loadData();
  const order = data.orders.find(o => o.id === orderId);

  if (!order) {
    return res.status(404).json({ success: false, error: 'Order tidak ditemukan' });
  }

  console.log(`\n[ORDER SAGA] Menerima Notifikasi Pembayaran untuk Order ${orderId}: ${status}`);

  if (status === 'SUCCESS') {
    // 1. Commit stok di katalog
    try {
      await callService(`${KATALOG_SERVICE_URL}/api/stock/commit`, 'POST', { orderId });
      console.log(`[ORDER SAGA] Stok resmi terpotong di Katalog Service untuk ${orderId}`);
    } catch (err) {
      console.error(`[ORDER SAGA] Error saat commit stok:`, err.message);
    }

    order.status = 'PAID';
    order.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'PAYMENT_SUCCESS',
      message: `Pembayaran ${paymentId} BERHASIL. Stok barang telah terpotong permanen.`
    });

  } else if (status === 'FAILED' || status === 'CANCELLED') {
    // 2. JALANKAN KOMPENSASI SAGA: Release stok kembali ke katalog!
    console.log(`[ORDER SAGA] [KOMPENSASI] Pembayaran gagal/batal. Melepaskan (Release) reservasi stok...`);
    try {
      const relRes = await callService(`${KATALOG_SERVICE_URL}/api/stock/release`, 'POST', {
        orderId,
        reason: reason || 'Pembayaran gagal atau dibatalkan oleh pengguna'
      });
      console.log(`[ORDER SAGA] [KOMPENSASI SUKSES] Stok berhasil dikembalikan:`, relRes.data);
    } catch (err) {
      console.error(`[ORDER SAGA] [CRITICAL] Gagal me-release stok:`, err.message);
    }

    order.status = 'CANCELLED';
    order.cancellationReason = reason || 'Pembayaran gagal';
    order.timeline.push({
      timestamp: new Date().toISOString(),
      event: 'SAGA_COMPENSATION_RELEASED',
      message: `[KOMPENSASI SAGA] Pembayaran gagal (${reason || 'Gagal'}). Stok telah berhasil di-release kembali ke katalog.`
    });
  }

  saveData(data);
  res.json({
    success: true,
    message: `Status order ${orderId} berhasil disinkronkan menjadi ${order.status}`,
    order
  });
});

// ==========================================
// 4. RIWAYAT DAN STATUS PESANAN
// ==========================================

// Daftar order (filter by userId atau semua untuk admin)
app.get('/api/orders', (req, res) => {
  const { userId } = req.query;
  const data = loadData();
  let results = data.orders;

  if (userId) {
    results = results.filter(o => o.userId === userId);
  }

  res.json({ success: true, count: results.length, data: results });
});

// Detail order by ID
app.get('/api/orders/:id', (req, res) => {
  const data = loadData();
  const order = data.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, error: 'Order tidak ditemukan' });
  }

  res.json({ success: true, data: order });
});

// Update status pesanan (e.g. SHIPPED, DELIVERED, COMPLETED)
app.put('/api/orders/:id/status', (req, res) => {
  const { status, note } = req.body;
  const data = loadData();
  const order = data.orders.find(o => o.id === req.params.id);

  if (!order) {
    return res.status(404).json({ success: false, error: 'Order tidak ditemukan' });
  }

  order.status = status;
  order.timeline.push({
    timestamp: new Date().toISOString(),
    event: `STATUS_${status}`,
    message: note || `Status pesanan diubah menjadi ${status}`
  });

  saveData(data);
  res.json({ success: true, message: `Status pesanan diubah ke ${status}`, data: order });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`[PESERTA 3] ORDER SERVICE RUNNING ON PORT ${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
  console.log(`Katalog URL:   ${KATALOG_SERVICE_URL}`);
  console.log(`Pelanggan URL: ${PELANGGAN_SERVICE_URL}`);
  console.log(`Pembayaran URL: ${PEMBAYARAN_SERVICE_URL}`);
  console.log(`===============================================`);
});
