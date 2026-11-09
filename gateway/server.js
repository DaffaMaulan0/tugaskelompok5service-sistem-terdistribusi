const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Upstream service URLs (configurable via environment variables)
const KATALOG_SERVICE_URL = process.env.KATALOG_SERVICE_URL || 'http://localhost:5001';
const PELANGGAN_SERVICE_URL = process.env.PELANGGAN_SERVICE_URL || 'http://localhost:5002';
const ORDER_SERVICE_URL = process.env.ORDER_SERVICE_URL || 'http://localhost:5003';
const PEMBAYARAN_SERVICE_URL = process.env.PEMBAYARAN_SERVICE_URL || 'http://localhost:5004';

app.use(cors());
app.use(express.json());

// Logger
app.use((req, res, next) => {
  console.log(`[API-GATEWAY] ${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

// Serve Dashboard (Frontend Toko & Admin)
app.use(express.static(path.join(__dirname, 'public')));

// Global Health Check - Memeriksa status seluruh microservice
app.get('/health', async (req, res) => {
  const checkService = async (name, url) => {
    const start = Date.now();
    try {
      const response = await fetch(`${url}/health`, { signal: AbortSignal.timeout(3000) });
      const latency = Date.now() - start;
      if (response.ok) {
        const body = await response.json();
        return { name, url, status: 'UP', latencyMs: latency, details: body };
      }
      return { name, url, status: 'DOWN', latencyMs: latency, error: `HTTP ${response.status}` };
    } catch (err) {
      return { name, url, status: 'DOWN', latencyMs: Date.now() - start, error: err.message };
    }
  };

  const results = await Promise.all([
    checkService('katalog-service (Peserta 1)', KATALOG_SERVICE_URL),
    checkService('pelanggan-service (Peserta 2)', PELANGGAN_SERVICE_URL),
    checkService('order-service (Peserta 3)', ORDER_SERVICE_URL),
    checkService('pembayaran-service (Peserta 4)', PEMBAYARAN_SERVICE_URL)
  ]);

  const allUp = results.every(s => s.status === 'UP');

  res.status(allUp ? 200 : 207).json({
    gateway: {
      service: 'gateway (Peserta 5)',
      status: 'UP',
      port: PORT,
      timestamp: new Date()
    },
    systemStatus: allUp ? 'HEALTHY' : 'DEGRADED',
    services: results
  });
});

// Reset All Services - Membantu pengujian & demonstrasi
app.post('/api/reset-all', async (req, res) => {
  const resetService = async (name, url) => {
    try {
      const resp = await fetch(`${url}/api/reset`, { method: 'POST' });
      return { name, ok: resp.ok };
    } catch (err) {
      return { name, ok: false, error: err.message };
    }
  };

  const results = await Promise.all([
    resetService('katalog', KATALOG_SERVICE_URL),
    resetService('pelanggan', PELANGGAN_SERVICE_URL),
    resetService('order', ORDER_SERVICE_URL),
    resetService('pembayaran', PEMBAYARAN_SERVICE_URL)
  ]);

  res.json({
    success: true,
    message: 'Seluruh service berhasil di-reset ke seed data awal.',
    results
  });
});

// Forwarding helper function
async function forwardRequest(req, res, targetBaseUrl, targetPath) {
  try {
    const url = new URL(targetPath, targetBaseUrl);
    const queryString = new URL(req.originalUrl, 'http://localhost').search;
    const finalUrl = `${url.origin}${url.pathname}${queryString}`;

    const headers = {};
    if (req.headers.authorization) headers['authorization'] = req.headers.authorization;
    if (req.headers['x-user-id']) headers['x-user-id'] = req.headers['x-user-id'];
    headers['content-type'] = 'application/json';

    const options = {
      method: req.method,
      headers
    };

    if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
    }

    const upstreamRes = await fetch(finalUrl, options);
    const data = await upstreamRes.json().catch(() => ({}));

    res.status(upstreamRes.status).json(data);
  } catch (err) {
    console.error(`[API-GATEWAY PROXY ERROR] Gagal forward ke ${targetBaseUrl}:`, err.message);
    res.status(502).json({
      success: false,
      error: `Bad Gateway: Layanan target (${targetBaseUrl}) tidak dapat dihubungi (${err.message})`
    });
  }
}

// =========================================================================
// REVERSE PROXY ROUTING
// =========================================================================

// 1. KATALOG SERVICE (Peserta 1)
app.all(['/api/katalog/*', '/api/products*', '/api/categories*', '/api/stock*'], (req, res) => {
  let targetPath = req.originalUrl.split('?')[0];
  if (targetPath.startsWith('/api/katalog/')) {
    targetPath = targetPath.replace('/api/katalog/', '/api/');
  }
  forwardRequest(req, res, KATALOG_SERVICE_URL, targetPath);
});

// 2. PELANGGAN SERVICE (Peserta 2)
app.all(['/api/pelanggan/*', '/api/auth*', '/api/customers*', '/api/addresses*'], (req, res) => {
  let targetPath = req.originalUrl.split('?')[0];
  if (targetPath.startsWith('/api/pelanggan/')) {
    targetPath = targetPath.replace('/api/pelanggan/', '/api/');
  }
  forwardRequest(req, res, PELANGGAN_SERVICE_URL, targetPath);
});

// 3. ORDER SERVICE (Peserta 3)
app.all(['/api/order/*', '/api/orders*', '/api/cart*'], (req, res) => {
  let targetPath = req.originalUrl.split('?')[0];
  if (targetPath.startsWith('/api/order/')) {
    targetPath = targetPath.replace('/api/order/', '/api/');
  }
  forwardRequest(req, res, ORDER_SERVICE_URL, targetPath);
});

// 4. PEMBAYARAN SERVICE (Peserta 4)
app.all(['/api/pembayaran/*', '/api/payments*'], (req, res) => {
  let targetPath = req.originalUrl.split('?')[0];
  if (targetPath.startsWith('/api/pembayaran/')) {
    targetPath = targetPath.replace('/api/pembayaran/', '/api/');
  }
  forwardRequest(req, res, PEMBAYARAN_SERVICE_URL, targetPath);
});

// Fallback route untuk SPA frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`[PESERTA 5] API GATEWAY & DASHBOARD RUNNING ON PORT ${PORT}`);
  console.log(`Dashboard Toko & Admin : http://localhost:${PORT}`);
  console.log(`Health Check Endpoint  : http://localhost:${PORT}/health`);
  console.log(`- Katalog Service URL  : ${KATALOG_SERVICE_URL}`);
  console.log(`- Pelanggan Service URL: ${PELANGGAN_SERVICE_URL}`);
  console.log(`- Order Service URL    : ${ORDER_SERVICE_URL}`);
  console.log(`- Pembayaran Service   : ${PEMBAYARAN_SERVICE_URL}`);
  console.log(`=============================================================`);
});
