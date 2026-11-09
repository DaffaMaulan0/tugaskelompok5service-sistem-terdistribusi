const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5002;
const JWT_SECRET = process.env.JWT_SECRET || 'unhan-sistem-terdistribusi-super-secret-key-2026';
const DATA_FILE = path.join(__dirname, 'data', 'pelanggan.json');

app.use(cors());
app.use(express.json());

// Logger middleware
app.use((req, res, next) => {
  console.log(`[PELANGGAN-SERVICE] ${new Date().toISOString()} | ${req.method} ${req.originalUrl}`);
  next();
});

// Initial seed data with hashed passwords (hash of 'password123' / 'admin123')
// bcrypt.hashSync('admin123', 10)
const salt = bcrypt.genSaltSync(10);
const initialData = {
  users: [
    {
      id: 'usr-admin-1',
      name: 'Administrator Toko',
      email: 'admin@toko.com',
      passwordHash: bcrypt.hashSync('admin123', salt),
      phone: '081299990001',
      role: 'admin',
      createdAt: '2026-11-01T00:00:00.000Z'
    },
    {
      id: 'usr-cust-1',
      name: 'Budi Santoso',
      email: 'budi@gmail.com',
      passwordHash: bcrypt.hashSync('budi123', salt),
      phone: '081234567890',
      role: 'customer',
      createdAt: '2026-11-02T08:30:00.000Z'
    },
    {
      id: 'usr-cust-2',
      name: 'Siti Rahmawati',
      email: 'siti@gmail.com',
      passwordHash: bcrypt.hashSync('siti123', salt),
      phone: '081288887777',
      role: 'customer',
      createdAt: '2026-11-03T09:15:00.000Z'
    }
  ],
  addresses: [
    {
      id: 'addr-1',
      userId: 'usr-cust-1',
      recipientName: 'Budi Santoso',
      phone: '081234567890',
      street: 'Kawasan IPSC Sentul, Jl. Pasir Penganten',
      city: 'Bogor',
      province: 'Jawa Barat',
      postalCode: '16810',
      isDefault: true
    },
    {
      id: 'addr-2',
      userId: 'usr-cust-2',
      recipientName: 'Siti Rahmawati',
      phone: '081288887777',
      street: 'Komplek Unhan Indonesia, Sentul Citeureup',
      city: 'Bogor',
      province: 'Jawa Barat',
      postalCode: '16810',
      isDefault: true
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
    console.error('[PELANGGAN-SERVICE] Error reading data file, resetting to initial:', err.message);
    return JSON.parse(JSON.stringify(initialData));
  }
}

function saveData(data) {
  try {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error('[PELANGGAN-SERVICE] Error saving data file:', err.message);
  }
}

// Token extraction middleware
function extractToken(req) {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }
  if (req.body && req.body.token) {
    return req.body.token;
  }
  if (req.query && req.query.token) {
    return req.query.token;
  }
  return null;
}

// Authenticate JWT middleware
function requireAuth(req, res, next) {
  const token = extractToken(req);
  if (!token) {
    return res.status(401).json({ success: false, error: 'Akses ditolak: Token otentikasi tidak disediakan' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Token tidak valid atau telah kedaluwarsa', details: err.message });
  }
}

// Health check
app.get('/health', (req, res) => {
  res.json({ service: 'pelanggan-service', status: 'UP', port: PORT, timestamp: new Date() });
});

// Reset endpoint
app.post('/api/reset', (req, res) => {
  const data = JSON.parse(JSON.stringify(initialData));
  saveData(data);
  res.json({ success: true, message: 'Data pelanggan berhasil di-reset ke nilai awal.' });
});

// ==========================================
// 1. AUTENTIKASI (REGISTER, LOGIN, VERIFIKASI)
// ==========================================

// Register Pelanggan
app.post('/api/auth/register', (req, res) => {
  const { name, email, password, phone, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ success: false, error: 'Nama, email, dan password wajib diisi' });
  }

  const data = loadData();
  const existing = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(400).json({ success: false, error: 'Email sudah terdaftar. Silakan gunakan email lain atau login.' });
  }

  const saltRounds = 10;
  const passwordHash = bcrypt.hashSync(password, saltRounds);

  const newUser = {
    id: `usr-${Date.now()}`,
    name,
    email: email.toLowerCase(),
    passwordHash,
    phone: phone || '',
    role: role === 'admin' ? 'admin' : 'customer',
    createdAt: new Date().toISOString()
  };

  data.users.push(newUser);
  saveData(data);

  // Auto generate token upon registration
  const token = jwt.sign(
    { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const safeUser = { ...newUser };
  delete safeUser.passwordHash;

  console.log(`[PELANGGAN-SERVICE] Pendaftaran berhasil untuk user ${newUser.email} (${newUser.role})`);

  res.status(201).json({
    success: true,
    message: 'Registrasi berhasil',
    token,
    user: safeUser
  });
});

// Login Pelanggan
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ success: false, error: 'Email dan password wajib diisi' });
  }

  const data = loadData();
  const user = data.users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ success: false, error: 'Email atau password salah' });
  }

  const token = jwt.sign(
    { id: user.id, name: user.name, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  console.log(`[PELANGGAN-SERVICE] Login berhasil untuk user ${user.email} (${user.role})`);

  res.json({
    success: true,
    message: 'Login berhasil',
    token,
    user: safeUser
  });
});

// Verifikasi Token (Untuk Gateway & Service Lain!)
app.all('/api/auth/verify', (req, res) => {
  const token = extractToken(req);

  if (!token) {
    return res.status(401).json({ valid: false, error: 'Token tidak ditemukan' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const data = loadData();
    const user = data.users.find(u => u.id === decoded.id);

    if (!user) {
      return res.status(404).json({ valid: false, error: 'User dalam token sudah tidak terdaftar' });
    }

    const safeUser = { ...user };
    delete safeUser.passwordHash;

    return res.json({
      valid: true,
      message: 'Token terverifikasi valid',
      user: safeUser
    });
  } catch (err) {
    return res.status(401).json({
      valid: false,
      error: 'Token tidak valid atau kedaluwarsa',
      details: err.message
    });
  }
});

// ==========================================
// 2. PROFIL PELANGGAN
// ==========================================

// Get Profil Saya
app.get('/api/customers/profile', requireAuth, (req, res) => {
  const data = loadData();
  const user = data.users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ success: false, error: 'Profil tidak ditemukan' });
  }

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  const addresses = data.addresses.filter(a => a.userId === user.id);

  res.json({
    success: true,
    data: {
      ...safeUser,
      addresses
    }
  });
});

// Update Profil
app.put('/api/customers/profile', requireAuth, (req, res) => {
  const data = loadData();
  const user = data.users.find(u => u.id === req.user.id);

  if (!user) {
    return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
  }

  const { name, phone, password } = req.body;
  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (password) {
    user.passwordHash = bcrypt.hashSync(password, 10);
  }

  saveData(data);

  const safeUser = { ...user };
  delete safeUser.passwordHash;

  res.json({
    success: true,
    message: 'Profil berhasil diperbarui',
    data: safeUser
  });
});

// List All Customers (untuk admin)
app.get('/api/customers', (req, res) => {
  const data = loadData();
  const safeUsers = data.users.map(u => {
    const copy = { ...u };
    delete copy.passwordHash;
    return copy;
  });
  res.json({ success: true, count: safeUsers.length, data: safeUsers });
});

// Get Customer by ID
app.get('/api/customers/:id', (req, res) => {
  const data = loadData();
  const user = data.users.find(u => u.id === req.params.id);
  if (!user) {
    return res.status(404).json({ success: false, error: 'User tidak ditemukan' });
  }
  const safeUser = { ...user };
  delete safeUser.passwordHash;
  res.json({ success: true, data: safeUser });
});

// ==========================================
// 3. ALAMAT PENGIRIMAN
// ==========================================

// Get Alamat Pengguna
app.get('/api/customers/:userId/addresses', (req, res) => {
  const data = loadData();
  const addresses = data.addresses.filter(a => a.userId === req.params.userId);
  res.json({ success: true, count: addresses.length, data: addresses });
});

// Tambah Alamat
app.post('/api/customers/:userId/addresses', (req, res) => {
  const { recipientName, phone, street, city, province, postalCode, isDefault } = req.body;
  const userId = req.params.userId;

  if (!recipientName || !street || !city) {
    return res.status(400).json({ success: false, error: 'Nama penerima, jalan, dan kota wajib diisi' });
  }

  const data = loadData();
  if (isDefault) {
    data.addresses.forEach(a => {
      if (a.userId === userId) a.isDefault = false;
    });
  }

  const newAddress = {
    id: `addr-${Date.now()}`,
    userId,
    recipientName,
    phone: phone || '',
    street,
    city,
    province: province || 'Jawa Barat',
    postalCode: postalCode || '16810',
    isDefault: !!isDefault
  };

  data.addresses.push(newAddress);
  saveData(data);

  res.status(201).json({
    success: true,
    message: 'Alamat pengiriman berhasil ditambahkan',
    data: newAddress
  });
});

// Update Alamat
app.put('/api/addresses/:id', (req, res) => {
  const data = loadData();
  const address = data.addresses.find(a => a.id === req.params.id);

  if (!address) {
    return res.status(404).json({ success: false, error: 'Alamat tidak ditemukan' });
  }

  const { recipientName, phone, street, city, province, postalCode, isDefault } = req.body;
  if (recipientName !== undefined) address.recipientName = recipientName;
  if (phone !== undefined) address.phone = phone;
  if (street !== undefined) address.street = street;
  if (city !== undefined) address.city = city;
  if (province !== undefined) address.province = province;
  if (postalCode !== undefined) address.postalCode = postalCode;
  if (isDefault !== undefined) {
    if (isDefault) {
      data.addresses.forEach(a => {
        if (a.userId === address.userId && a.id !== address.id) a.isDefault = false;
      });
    }
    address.isDefault = isDefault;
  }

  saveData(data);
  res.json({ success: true, message: 'Alamat berhasil diperbarui', data: address });
});

// Hapus Alamat
app.delete('/api/addresses/:id', (req, res) => {
  const data = loadData();
  const idx = data.addresses.findIndex(a => a.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, error: 'Alamat tidak ditemukan' });
  }
  data.addresses.splice(idx, 1);
  saveData(data);
  res.json({ success: true, message: 'Alamat berhasil dihapus' });
});

app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`[PESERTA 2] PELANGGAN SERVICE RUNNING ON PORT ${PORT}`);
  console.log(`Healthcheck: http://localhost:${PORT}/health`);
  console.log(`===============================================`);
});
