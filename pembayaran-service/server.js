const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5004;
const DATA_FILE = path.join(__dirname, 'data', 'pembayaran.json');

// URL Order Service for webhook callbacks
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:5003';

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[PEMBAYARAN-SERVICE] ${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

// Initial seed data
const initialData = {
  payments: [
    {
      id: 'pay-1001',
      orderId: 'order-1001',
      customerId: 'usr-cust-2',
      customerName: 'Siti Rahmawati',
      amount: 6800000,
      paymentMethod: 'QRIS',
      status: 'SUCCESS',
      referenceNumber: 'QRIS-UNHAN-882910384',
      createdAt: '2026-11-04T10:00:10.000Z',
      paidAt: '2026-11-04T10:02:30.000Z',
      metadata: {
        qrCodeString: '00020101021226680016ID.CO.UNHAN.PAY51450114000100000000005204581253033605802ID5914UNHAN STORE6005BOGOR',
        gatewayProvider: 'Simulated Gateway Switch'
      }
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
    console.error('[PEMBAYARAN-SERVICE] Error reading data file:', err.message);
    return JSON.parse(JSON.stringify(initialData));
  }
}

function saveData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[PEMBAYARAN-SERVICE] Error saving data file:', err.message);
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
    service: 'pembayaran-service',
    status: 'UP',
    port: PORT,
    orderServiceUrl: ORDER_SERVICE_URL,
    timestamp: new Date()
  });
});

// Reset endpoint
app.post('/api/reset', (req, res) => {
  const data = JSON.parse(JSON.stringify(initialData));
  saveData(data);
  res.json({ success: true, message: 'Data pembayaran berhasil di-reset ke nilai awal.' });
});

// ==========================================
// 1. INISIASI PEMBAYARAN
// ==========================================
app.post('/api/payments', (req, res) => {
  const { orderId, customerId, customerName, amount, paymentMethod } = req.body;

  if (!orderId || !amount) {
    return res.status(400).json({ success: false, error: 'orderId dan amount wajib diisi' });
  }

  const data = loadData();

  // Generate virtual account / QRIS code mock
  const method = paymentMethod || 'QRIS';
  const timestamp = Date.now();
  let referenceNumber = '';
  let metadata = {};

  if (method === 'QRIS') {
    referenceNumber = `QRIS-${timestamp.toString().slice(-8)}`;
    metadata = {
      qrCodeString: `00020101021226680016ID.CO.UNHAN.PAY51450114000100000000005204581253033605802ID5914UNHAN STORE6005BOGOR6304${Math.floor(1000 + Math.random() * 9000)}`,
      qrExpiryMinutes: 15
    };
  } else if (method === 'BANK_TRANSFER') {
    referenceNumber = `VA-8899${Math.floor(10000000 + Math.random() * 90000000)}`;
    metadata = {
      bankName: 'Bank Mandiri Virtual Account',
      vaNumber: referenceNumber,
      expiryHours: 24
    };
  } else if (method === 'E_WALLET') {
    referenceNumber = `EWL-${timestamp.toString().slice(-8)}`;
    metadata = {
      eWalletProvider: 'GoPay / OVO / Dana',
      checkoutUrl: `https://mock-ewallet.pay/checkout/${timestamp}`
    };
  } else {
    referenceNumber = `CC-${timestamp.toString().slice(-8)}`;
    metadata = {
      channel: 'Credit Card 3D Secure'
    };
  }

  const newPayment = {
    id: `pay-${timestamp}`,
    orderId,
    customerId: customerId || 'guest',
    customerName: customerName || 'Pelanggan',
    amount: Number(amount),
    paymentMethod: method,
    status: 'PENDING',
    referenceNumber,
    metadata,
    createdAt: new Date().toISOString()
  };

  data.payments.unshift(newPayment);
  saveData(data);

  console.log(`[PEMBAYARAN-SERVICE] Tagihan baru dibuat: ${newPayment.id} untuk Order ${orderId} senilai Rp ${amount}`);

  res.status(201).json({
    success: true,
    message: 'Tagihan pembayaran berhasil diinisiasi',
    data: newPayment
  });
});

// ==========================================
// 2. SIMULASI PEMBAYARAN (SUCCESS / FAILED)
// ==========================================
app.post('/api/payments/:id/simulate', async (req, res) => {
  const paymentId = req.params.id;
  const { action, failureReason } = req.body; // action: 'SUCCESS' | 'FAILED'

  const data = loadData();
  const payment = data.payments.find(p => p.id === paymentId);

  if (!payment) {
    return res.status(404).json({ success: false, error: 'Transaksi pembayaran tidak ditemukan' });
  }

  if (payment.status !== 'PENDING') {
    return res.status(400).json({
      success: false,
      error: `Pembayaran sudah dalam status final: ${payment.status}`
    });
  }

  console.log(`\n======================================================`);
  console.log(`[PEMBAYARAN SIMULASI] Memproses simulasi untuk Payment ${paymentId}`);
  console.log(`Aksi yang dipilih: ${action}`);

  if (action === 'SUCCESS') {
    payment.status = 'SUCCESS';
    payment.paidAt = new Date().toISOString();

    // Callback webhook ke Order Service untuk commit transaksi
    console.log(`[PEMBAYARAN] Mengirim Webhook Callback SUCCESS ke Order Service (${ORDER_SERVICE_URL})...`);
    try {
      const notifyRes = await callService(
        `${ORDER_SERVICE_URL}/api/orders/${payment.orderId}/payment-result`,
        'POST',
        {
          status: 'SUCCESS',
          paymentId: payment.id,
          orderId: payment.orderId,
          amount: payment.amount
        }
      );
      payment.webhookSync = { success: notifyRes.ok, timestamp: new Date().toISOString() };
      console.log(`[PEMBAYARAN] Webhook SUCCESS diterima oleh Order Service`);
    } catch (err) {
      console.error(`[PEMBAYARAN] Gagal mengirim webhook ke Order Service:`, err.message);
      payment.webhookSync = { success: false, error: err.message, timestamp: new Date().toISOString() };
    }

  } else {
    // FAILED / CANCELLED
    payment.status = 'FAILED';
    payment.failedAt = new Date().toISOString();
    payment.failureReason = failureReason || 'Simulasi Pembayaran Gagal / Saldo Tidak Cukup / Dibatalkan';

    // Callback webhook ke Order Service untuk trigger KOMPENSASI SAGA
    console.log(`[PEMBAYARAN] [TRIGGER KOMPENSASI] Mengirim Webhook Callback FAILED ke Order Service...`);
    try {
      const notifyRes = await callService(
        `${ORDER_SERVICE_URL}/api/orders/${payment.orderId}/payment-result`,
        'POST',
        {
          status: 'FAILED',
          paymentId: payment.id,
          orderId: payment.orderId,
          reason: payment.failureReason
        }
      );
      payment.webhookSync = { success: notifyRes.ok, timestamp: new Date().toISOString() };
      console.log(`[PEMBAYARAN] Webhook FAILED (Kompensasi SAGA) berhasil diterima oleh Order Service`);
    } catch (err) {
      console.error(`[PEMBAYARAN] Gagal mengirim webhook kompensasi ke Order Service:`, err.message);
      payment.webhookSync = { success: false, error: err.message, timestamp: new Date().toISOString() };
    }
  }

  saveData(data);
  console.log(`======================================================\n`);

  res.json({
    success: true,
    message: `Simulasi pembayaran berhasil diproses: ${payment.status}`,
    data: payment
  });
});

// ==========================================
// 3. SINKRONISASI STATUS
// ==========================================

// Detail pembayaran by ID
app.get('/api/payments/:id', (req, res) => {
  const data = loadData();
  const payment = data.payments.find(p => p.id === req.params.id);

  if (!payment) {
    return res.status(404).json({ success: false, error: 'Pembayaran tidak ditemukan' });
  }

  res.json({ success: true, data: payment });
});

// Ambil pembayaran by Order ID
app.get('/api/payments/order/:orderId', (req, res) => {
  const data = loadData();
  const payment = data.payments.find(p => p.orderId === req.params.orderId);

  if (!payment) {
    return res.status(404).json({ success: false, error: 'Pembayaran untuk order ini tidak ditemukan' });
  }

  res.json({ success: true, data: payment });
});

// Paksa sinkronisasi manual status ke Order Service
app.post('/api/payments/:id/sync', async (req, res) => {
  const data = loadData();
  const payment = data.payments.find(p => p.id === req.params.id);

  if (!payment) {
    return res.status(404).json({ success: false, error: 'Pembayaran tidak ditemukan' });
  }

  try {
    const notifyRes = await callService(
      `${ORDER_SERVICE_URL}/api/orders/${payment.orderId}/payment-result`,
      'POST',
      {
        status: payment.status,
        paymentId: payment.id,
        orderId: payment.orderId,
        reason: payment.failureReason
      }
    );

    res.json({
      success: true,
      message: 'Sinkronisasi dengan Order Service berhasil',
      orderServiceResponse: notifyRes.data
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: 'Gagal melakukan sinkronisasi dengan Order Service',
      details: err.message
    });
  }
});

// Daftar semua transaksi
app.get('/api/payments', (req, res) => {
  const { status, method } = req.query;
  const data = loadData();
  let results = data.payments;

  if (status) {
    results = results.filter(p => p.status.toUpperCase() === status.toUpperCase());
  }
  if (method) {
    results = results.filter(p => p.paymentMethod.toUpperCase() === method.toUpperCase());
  }

  res.json({ success: true, count: results.length, data: results });
});

// ==========================================
// 4. LAPORAN PEMBAYARAN
// ==========================================

// Ringkasan Laporan (Total Omzet, Rasio Sukses/Gagal, Breakdown Metode)
app.get('/api/payments/reports/summary', (req, res) => {
  const data = loadData();
  const list = data.payments;

  const totalTransactions = list.length;
  const successPayments = list.filter(p => p.status === 'SUCCESS');
  const pendingPayments = list.filter(p => p.status === 'PENDING');
  const failedPayments = list.filter(p => p.status === 'FAILED');

  const totalRevenue = successPayments.reduce((sum, p) => sum + p.amount, 0);

  // Breakdown metode
  const methodBreakdown = {};
  list.forEach(p => {
    const m = p.paymentMethod || 'OTHER';
    if (!methodBreakdown[m]) {
      methodBreakdown[m] = { count: 0, totalAmount: 0, successCount: 0 };
    }
    methodBreakdown[m].count += 1;
    methodBreakdown[m].totalAmount += p.amount;
    if (p.status === 'SUCCESS') {
      methodBreakdown[m].successCount += 1;
    }
  });

  res.json({
    success: true,
    data: {
      totalTransactions,
      totalRevenue,
      successCount: successPayments.length,
      pendingCount: pendingPayments.length,
      failedCount: failedPayments.length,
      successRatePercentage: totalTransactions > 0
        ? Math.round((successPayments.length / totalTransactions) * 100)
        : 0,
      methodBreakdown
    }
  });
});

// Laporan Detail Transaksi
app.get('/api/payments/reports/transactions', (req, res) => {
  const { startDate, endDate, status } = req.query;
  const data = loadData();
  let list = data.payments;

  if (status) {
    list = list.filter(p => p.status === status);
  }
  if (startDate) {
    list = list.filter(p => new Date(p.createdAt) >= new Date(startDate));
  }
  if (endDate) {
    list = list.filter(p => new Date(p.createdAt) <= new Date(endDate));
  }

  res.json({
    success: true,
    count: list.length,
    data: list
  });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`[PESERTA 4] PEMBAYARAN SERVICE RUNNING ON PORT ${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
  console.log(`Order Service URL: ${ORDER_SERVICE_URL}`);
  console.log(`===============================================`);
});
