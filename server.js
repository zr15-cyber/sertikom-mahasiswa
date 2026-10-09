const express = require('express');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const session = require('express-session');
const multer = require('multer');
const { randomUUID } = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const UPLOAD_DIR = path.join(ROOT, 'uploads');

function ensureDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDirectory(UPLOAD_DIR);

// Database Configuration
const dbConfig = {
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'sertikom',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
};

let pool;

async function initializeDatabase() {
  try {
    const connection = await mysql.createConnection({
      host: dbConfig.host,
      user: dbConfig.user,
      password: dbConfig.password
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${dbConfig.database}`);
    await connection.end();

    pool = mysql.createPool(dbConfig);

    const conn = await pool.getConnection();

    // Create tables
    await conn.query(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(36) PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        role ENUM('user', 'admin') DEFAULT 'user',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS documents (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        type VARCHAR(50) NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        stored_name VARCHAR(255) NOT NULL,
        status ENUM('Terkirim', 'Diproses', 'Terverifikasi', 'Ditolak') DEFAULT 'Terkirim',
        user_email VARCHAR(255) NOT NULL,
        admin_notes TEXT,
        uploaded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        verified_at TIMESTAMP NULL,
        FOREIGN KEY (user_email) REFERENCES users(email)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS schedules (
        id VARCHAR(36) PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        date DATE NOT NULL,
        time TIME NOT NULL,
        description TEXT,
        created_by VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (created_by) REFERENCES users(email)
      )
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(36) PRIMARY KEY,
        message TEXT NOT NULL,
        user_email VARCHAR(255),
        type VARCHAR(50) DEFAULT 'info',
        read_at TIMESTAMP NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_email) REFERENCES users(email)
      )
    `);

    // Seed data
    const adminExists = await conn.query(
      'SELECT id FROM users WHERE email = ?',
      ['admin@sertikom.com']
    );

    if (adminExists[0].length === 0) {
      await conn.query(
        'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [
          randomUUID(),
          'Admin Sertikom',
          'admin@sertikom.com',
          bcrypt.hashSync('admin123', 10),
          'admin'
        ]
      );

      await conn.query(
        'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
        [
          randomUUID(),
          'Mahasiswa A',
          'user@sertikom.com',
          bcrypt.hashSync('user123', 10),
          'user'
        ]
      );
    }

    conn.release();
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    process.exit(1);
  }
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (_req, file, cb) => {
    const safeName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(ROOT, 'public')));

app.use(session({
  secret: 'sertikom-session-secret-key-2024',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use((_req, res, next) => {
  res.header('Cache-Control', 'no-store');
  next();
});

function ensureLoggedIn(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: 'Silakan login terlebih dahulu.' });
  }
  next();
}

function ensureAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'admin') {
    return res.status(403).json({ message: 'Akses admin dibatasi.' });
  }
  next();
}

// Auth Endpoints
app.get('/api/session', (req, res) => {
  res.json({ user: req.session.user || null });
});

app.post('/api/register', async (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Nama, email, dan password wajib diisi.' });
  }

  if (String(password).length < 6) {
    return res.status(400).json({ message: 'Password minimal 6 karakter.' });
  }

  try {
    const conn = await pool.getConnection();
    const normalizedEmail = String(email).trim().toLowerCase();

    const existingUser = await conn.query('SELECT id FROM users WHERE email = ?', [normalizedEmail]);

    if (existingUser[0].length > 0) {
      conn.release();
      return res.status(409).json({ message: 'Email sudah terdaftar.' });
    }

    const userId = randomUUID();
    await conn.query(
      'INSERT INTO users (id, name, email, password, role) VALUES (?, ?, ?, ?, ?)',
      [userId, String(name).trim(), normalizedEmail, bcrypt.hashSync(String(password), 10), 'user']
    );

    req.session.user = {
      id: userId,
      name: String(name).trim(),
      email: normalizedEmail,
      role: 'user'
    };

    conn.release();
    res.status(201).json({
      message: 'Akun Sertikom berhasil dibuat.',
      user: req.session.user
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: 'Email dan password wajib diisi.' });
  }

  try {
    const conn = await pool.getConnection();
    const normalizedEmail = String(email).trim().toLowerCase();

    const results = await conn.query('SELECT * FROM users WHERE email = ?', [normalizedEmail]);
    const user = results[0][0];

    if (!user || !bcrypt.compareSync(String(password), user.password)) {
      conn.release();
      return res.status(401).json({ message: 'Email atau password salah.' });
    }

    req.session.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role
    };

    conn.release();
    res.json({
      message: 'Login berhasil.',
      user: req.session.user
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => {
    res.json({ message: 'Logout berhasil.' });
  });
});

// Dashboard Endpoint
app.get('/api/dashboard', ensureLoggedIn, async (req, res) => {
  try {
    const conn = await pool.getConnection();

    const userCountResult = await conn.query('SELECT COUNT(*) as count FROM users');
    const docCountResult = await conn.query('SELECT COUNT(*) as count FROM documents');
    const scheduleCountResult = await conn.query('SELECT COUNT(*) as count FROM schedules');
    const notifCountResult = await conn.query('SELECT COUNT(*) as count FROM notifications WHERE read_at IS NULL');

    const stats = {
      totalMahasiswa: req.session.user.role === 'admin' ? userCountResult[0][0].count : 1,
      totalFiles: docCountResult[0][0].count,
      totalSchedule: scheduleCountResult[0][0].count,
      totalNotif: notifCountResult[0][0].count
    };

    conn.release();
    res.json({
      stats,
      recentActivity: [
        'Mahasiswa baru menyelesaikan pendaftaran.',
        'Dokumen baru berhasil diunggah.',
        'Jadwal ujian diperbarui oleh admin.',
        'Notifikasi pengingat dikirim ke semua peserta.'
      ]
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// Users Endpoint
app.get('/api/users', ensureLoggedIn, ensureAdmin, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const results = await conn.query('SELECT id, name, email, role FROM users');
    conn.release();
    res.json({ users: results[0] });
  } catch (error) {
    console.error('Users error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// Documents Endpoints
app.get('/api/documents', ensureLoggedIn, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const results = await conn.query('SELECT * FROM documents ORDER BY uploaded_at DESC');
    conn.release();
    res.json({ documents: results[0] });
  } catch (error) {
    console.error('Documents error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/documents', ensureLoggedIn, upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'File wajib diunggah.' });
  }

  const { title, type } = req.body;

  if (!title || !type) {
    return res.status(400).json({ message: 'Judul dan jenis file wajib diisi.' });
  }

  try {
    const conn = await pool.getConnection();
    const docId = randomUUID();
    const notifId = randomUUID();

    await conn.query(
      'INSERT INTO documents (id, title, type, file_name, stored_name, user_email) VALUES (?, ?, ?, ?, ?, ?)',
      [
        docId,
        String(title).trim(),
        String(type),
        req.file.originalname,
        req.file.filename,
        req.session.user.email
      ]
    );

    await conn.query(
      'INSERT INTO notifications (id, message, user_email, type) VALUES (?, ?, ?, ?)',
      [
        notifId,
        `File "${String(title).trim()}" berhasil diunggah.`,
        req.session.user.email,
        'success'
      ]
    );

    conn.release();
    res.status(201).json({
      message: 'File berhasil diunggah.',
      document: { id: docId, title, type, file_name: req.file.originalname }
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// Verify Document Endpoint
app.put('/api/documents/:id/verify', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { status, notes } = req.body;

  if (!status || !['Terverifikasi', 'Ditolak'].includes(status)) {
    return res.status(400).json({ message: 'Status verifikasi tidak valid.' });
  }

  try {
    const conn = await pool.getConnection();
    const notifId = randomUUID();

    const results = await conn.query('SELECT user_email FROM documents WHERE id = ?', [req.params.id]);
    const document = results[0][0];

    if (!document) {
      conn.release();
      return res.status(404).json({ message: 'Dokumen tidak ditemukan.' });
    }

    await conn.query(
      'UPDATE documents SET status = ?, admin_notes = ?, verified_at = NOW() WHERE id = ?',
      [status, notes || null, req.params.id]
    );

    const message = status === 'Terverifikasi'
      ? 'Dokumen Anda telah diverifikasi.'
      : `Dokumen Anda ditolak. Catatan: ${notes || 'Silakan upload ulang.'}`;

    await conn.query(
      'INSERT INTO notifications (id, message, user_email, type) VALUES (?, ?, ?, ?)',
      [notifId, message, document.user_email, status === 'Terverifikasi' ? 'success' : 'warning']
    );

    conn.release();
    res.json({ message: 'Dokumen berhasil diverifikasi.' });
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// Notifications Endpoints
app.get('/api/notifications', ensureLoggedIn, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const results = await conn.query(
      'SELECT * FROM notifications WHERE user_email = ? ORDER BY created_at DESC',
      [req.session.user.email]
    );
    conn.release();
    res.json({ notifications: results[0] });
  } catch (error) {
    console.error('Notifications error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/notifications', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { message, userEmail } = req.body;

  if (!message) {
    return res.status(400).json({ message: 'Isi notifikasi wajib diisi.' });
  }

  try {
    const conn = await pool.getConnection();
    const notifId = randomUUID();

    await conn.query(
      'INSERT INTO notifications (id, message, user_email, type) VALUES (?, ?, ?, ?)',
      [notifId, String(message).trim(), userEmail || null, 'info']
    );

    conn.release();
    res.status(201).json({ message: 'Notifikasi berhasil dikirim.' });
  } catch (error) {
    console.error('Notification error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// Schedules Endpoints
app.get('/api/schedules', ensureLoggedIn, async (req, res) => {
  try {
    const conn = await pool.getConnection();
    const results = await conn.query('SELECT * FROM schedules ORDER BY date DESC');
    conn.release();
    res.json({ schedules: results[0] });
  } catch (error) {
    console.error('Schedules error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

app.post('/api/schedules', ensureLoggedIn, ensureAdmin, async (req, res) => {
  const { title, date, time, description } = req.body;

  if (!title || !date || !time) {
    return res.status(400).json({ message: 'Judul, tanggal, dan waktu wajib diisi.' });
  }

  try {
    const conn = await pool.getConnection();
    const scheduleId = randomUUID();
    const notifId = randomUUID();

    await conn.query(
      'INSERT INTO schedules (id, title, date, time, description, created_by) VALUES (?, ?, ?, ?, ?, ?)',
      [
        scheduleId,
        String(title).trim(),
        date,
        time,
        description || null,
        req.session.user.email
      ]
    );

    // Notify all users
    await conn.query(
      'INSERT INTO notifications (id, message, type) SELECT ?, ?, "info" FROM users',
      [randomUUID(), `Jadwal "${String(title).trim()}" telah dibuat.`]
    );

    conn.release();
    res.status(201).json({ message: 'Jadwal berhasil disimpan.', schedule: { id: scheduleId, title, date, time } });
  } catch (error) {
    console.error('Schedule error:', error);
    res.status(500).json({ message: 'Terjadi kesalahan pada server.' });
  }
});

// Serve static files
app.get('*', (_req, res) => {
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

// Initialize and start server
initializeDatabase().then(() => {
  app.listen(PORT, () => {
    console.log(`Sertikom app running at http://localhost:${PORT}`);
    console.log('Database: MySQL/PostgreSQL connected');
  });
}).catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});
