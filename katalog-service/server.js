const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5001;
const DATA_FILE = path.join(__dirname, 'data', 'katalog.json');

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[KATALOG-SERVICE] ${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

// Initial seed data
const initialData = {
  categories: [
    { id: 'cat-1', name: 'Elektronik & Gadget', description: 'Perangkat teknologi, laptop, dan komunikasi' },
    { id: 'cat-2', name: 'Perlengkapan Lapangan', description: 'Peralatan lapangan, taktikal, dan outdoor' },
    { id: 'cat-3', name: 'Pakaian & Seragam', description: 'Pakaian tugas, dinas, dan seragam lapangan' },
    { id: 'cat-4', name: 'Buku & Modul Kuliah', description: 'Buku teks sistem terdistribusi dan teknik informatika' }
  ],
  products: [
    {
      id: 'prod-1',
      name: 'Laptop Taktikal Ruggedized Core i7',
      description: 'Laptop tahan benturan, air, dan suhu ekstrem untuk operasi lapangan militer.',
      price: 24500000,
      stock: 15,
      reserved: 0,
      categoryId: 'cat-1',
      imageUrl: 'https://images.unsplash.com/photo-1541807084-5c52b6b3adef?w=600&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-2',
      name: 'Smartwatch GPS Taktikal Solarpower',
      description: 'Jam tangan dengan navigasi koordinat militer, altimeter, dan kompas 3-axis.',
      price: 6800000,
      stock: 25,
      reserved: 0,
      categoryId: 'cat-1',
      imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-3',
      name: 'Ransel Tempur Taktikal 55L Waterproof',
      description: 'Tas ransel berkapasitas besar dengan sistem modular MOLLE webbing berstandar militer.',
      price: 1350000,
      stock: 40,
      reserved: 0,
      categoryId: 'cat-2',
      imageUrl: 'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=600&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-4',
      name: 'Sepatu Boots Taktikal Gore-Tex Anti-Selip',
      description: 'Sepatu lapangan tahan air dengan sol vibram untuk mobilitas tinggi di segala medan.',
      price: 2100000,
      stock: 30,
      reserved: 0,
      categoryId: 'cat-3',
      imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=60'
    },
    {
      id: 'prod-5',
      name: 'Buku Konsep & Praktik Sistem Terdistribusi',
      description: 'Panduan komprehensif microservices, konsistensi data, SAGA pattern, dan API Gateway.',
      price: 185000,
      stock: 50,
      reserved: 0,
      categoryId: 'cat-4',
      imageUrl: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=600&auto=format&fit=crop&q=60'
    }
  ],
  reservations: []
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
    console.error('[KATALOG-SERVICE] Error reading data file, resetting to initial:', err.message);
    return JSON.parse(JSON.stringify(initialData));
  }
}

function saveData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[KATALOG-SERVICE] Error saving data file:', err.message);
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'katalog-service', status: 'UP', port: PORT, timestamp: new Date() });
});

// Reset endpoint for testing & seeding
app.post('/api/reset', (req, res) => {
  const data = JSON.parse(JSON.stringify(initialData));
  saveData(data);
  res.json({ success: true, message: 'Data katalog berhasil di-reset ke nilai awal.' });
});

// ==========================================
// 1. KATEGORI (CRUD)
// ==========================================
app.get('/api/categories', (req, res) => {
  const data = loadData();
  res.json({ success: true, count: data.categories.length, data: data.categories });
});

app.post('/api/categories', (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ success: false, error: 'Nama kategori wajib diisi' });
  }
  const data = loadData();
  const newCat = {
    id: `cat-${Date.now()}`,
    name,
    description: description || ''
  };
  data.categories.push(newCat);
  saveData(data);
  res.status(201).json({ success: true, message: 'Kategori berhasil ditambahkan', data: newCat });
});

app.delete('/api/categories/:id', (req, res) => {
  const data = loadData();
  const idx = data.categories.findIndex(c => c.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Kategori tidak ditemukan' });
  }
  data.categories.splice(idx, 1);
  saveData(data);
  res.json({ success: true, message: 'Kategori berhasil dihapus' });
});

// ==========================================
// 2. PRODUK (CRUD)
// ==========================================
app.get('/api/products', (req, res) => {
  const { categoryId, search } = req.query;
  const data = loadData();
  let results = data.products.map(p => ({
    ...p,
    available: Math.max(0, (p.stock || 0) - (p.reserved || 0))
  }));

  if (categoryId) {
    results = results.filter(p => p.categoryId === categoryId);
  }
  if (search) {
    const q = search.toLowerCase();
    results = results.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
  }

  res.json({ success: true, count: results.length, data: results });
});

app.get('/api/products/:id', (req, res) => {
  const data = loadData();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
  }
  const available = Math.max(0, (product.stock || 0) - (product.reserved || 0));
  res.json({ success: true, data: { ...product, available } });
});

app.post('/api/products', (req, res) => {
  const { name, description, price, stock, categoryId, imageUrl } = req.body;
  if (!name || price === undefined || stock === undefined) {
    return res.status(400).json({ success: false, error: 'Nama, harga, dan stok wajib diisi' });
  }

  const data = loadData();
  const newProduct = {
    id: `prod-${Date.now()}`,
    name,
    description: description || '',
    price: Number(price),
    stock: Number(stock),
    reserved: 0,
    categoryId: categoryId || 'cat-1',
    imageUrl: imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=60'
  };

  data.products.push(newProduct);
  saveData(data);
  res.status(201).json({
    success: true,
    message: 'Produk berhasil dibuat',
    data: { ...newProduct, available: newProduct.stock }
  });
});

app.put('/api/products/:id', (req, res) => {
  const data = loadData();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
  }

  const { name, description, price, stock, categoryId, imageUrl } = req.body;
  if (name !== undefined) product.name = name;
  if (description !== undefined) product.description = description;
  if (price !== undefined) product.price = Number(price);
  if (stock !== undefined) product.stock = Number(stock);
  if (categoryId !== undefined) product.categoryId = categoryId;
  if (imageUrl !== undefined) product.imageUrl = imageUrl;

  saveData(data);
  const available = Math.max(0, product.stock - (product.reserved || 0));
  res.json({ success: true, message: 'Produk berhasil diupdate', data: { ...product, available } });
});

app.delete('/api/products/:id', (req, res) => {
  const data = loadData();
  const idx = data.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
  }
  data.products.splice(idx, 1);
  saveData(data);
  res.json({ success: true, message: 'Produk berhasil dihapus' });
});

// ==========================================
// 3. STOK MANAGEMENT
// ==========================================
app.get('/api/products/:id/stock', (req, res) => {
  const data = loadData();
  const product = data.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, error: 'Produk tidak ditemukan' });
  }
  const reserved = product.reserved || 0;
  const available = Math.max(0, product.stock - reserved);
  res.json({
    success: true,
    data: {
      productId: product.id,
      name: product.name,
      totalStock: product.stock,
      reservedStock: reserved,
      availableStock: available
    }
  });
});

// ==========================================
// 4. RESERVE / RELEASE / COMMIT (DISTRIBUTED SAGA)
// ==========================================

// Reservasi stok saat checkout dimulai
app.post('/api/stock/reserve', (req, res) => {
  const { orderId, items } = req.body;

  if (!orderId || !items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, error: 'orderId dan array items wajib diisi' });
  }

  const data = loadData();

  // Validasi ketersediaan semua item sebelum reservasi (Atomic check)
  for (const item of items) {
    const product = data.products.find(p => p.id === item.productId);
    if (!product) {
      return res.status(400).json({
        success: false,
        error: `Produk dengan ID ${item.productId} tidak ditemukan`
      });
    }
    const available = (product.stock || 0) - (product.reserved || 0);
    if (available < item.quantity) {
      return res.status(400).json({
        success: false,
        error: `Stok produk '${product.name}' tidak mencukupi (Tersedia: ${available}, Diminta: ${item.quantity})`
      });
    }
  }

  // Jika semua lolos, lakukan reservasi
  for (const item of items) {
    const product = data.products.find(p => p.id === item.productId);
    product.reserved = (product.reserved || 0) + item.quantity;
  }

  const reservation = {
    id: `res-${Date.now()}`,
    orderId,
    items,
    status: 'RESERVED',
    createdAt: new Date().toISOString()
  };

  data.reservations.push(reservation);
  saveData(data);

  console.log(`[KATALOG-SERVICE] Stok berhasil di-reserve untuk order ${orderId}:`, items);

  res.json({
    success: true,
    message: 'Stok berhasil di-reserve sementara',
    reservation
  });
});

// Kompensasi: Release stok jika pembayaran gagal atau order dibatalkan
app.post('/api/stock/release', (req, res) => {
  const { orderId, reason } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId wajib diisi' });
  }

  const data = loadData();
  const reservation = data.reservations.find(r => r.orderId === orderId && r.status === 'RESERVED');

  if (!reservation) {
    return res.status(404).json({
      success: false,
      error: `Tidak ada reservasi aktif untuk orderId ${orderId}`
    });
  }

  // Kembalikan stok yang di-reserve
  for (const item of reservation.items) {
    const product = data.products.find(p => p.id === item.productId);
    if (product) {
      product.reserved = Math.max(0, (product.reserved || 0) - item.quantity);
    }
  }

  reservation.status = 'RELEASED';
  reservation.releasedAt = new Date().toISOString();
  reservation.reason = reason || 'Kompensasi pembatalan order / pembayaran gagal';

  saveData(data);

  console.log(`[KATALOG-SERVICE] [KOMPENSASI] Stok di-RELEASE kembali untuk order ${orderId}. Alasan: ${reservation.reason}`);

  res.json({
    success: true,
    message: 'Stok berhasil di-release kembali (Kompensasi SAGA selesai)',
    reservation
  });
});

// Finalisasi: Commit stok saat pembayaran terverifikasi sukses
app.post('/api/stock/commit', (req, res) => {
  const { orderId } = req.body;

  if (!orderId) {
    return res.status(400).json({ success: false, error: 'orderId wajib diisi' });
  }

  const data = loadData();
  const reservation = data.reservations.find(r => r.orderId === orderId && r.status === 'RESERVED');

  if (!reservation) {
    return res.status(404).json({
      success: false,
      error: `Tidak ada reservasi aktif untuk orderId ${orderId}`
    });
  }

  // Potong stok permanen dan kurangi reserved
  for (const item of reservation.items) {
    const product = data.products.find(p => p.id === item.productId);
    if (product) {
      product.stock = Math.max(0, (product.stock || 0) - item.quantity);
      product.reserved = Math.max(0, (product.reserved || 0) - item.quantity);
    }
  }

  reservation.status = 'COMMITTED';
  reservation.committedAt = new Date().toISOString();

  saveData(data);

  console.log(`[KATALOG-SERVICE] Stok berhasil di-COMMIT (permanen dipotong) untuk order ${orderId}`);

  res.json({
    success: true,
    message: 'Stok berhasil dipotong permanen (Transaksi selesai)',
    reservation
  });
});

// Lihat riwayat reservasi
app.get('/api/stock/reservations', (req, res) => {
  const data = loadData();
  res.json({ success: true, count: data.reservations.length, data: data.reservations });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`[PESERTA 1] KATALOG SERVICE RUNNING ON PORT ${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
  console.log(`===============================================`);
});
