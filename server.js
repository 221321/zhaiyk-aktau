const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'zhaiyk_aktau_secret_2025';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// База данных
const db = new sqlite3.Database('zhaiyk.db');

// Создаём таблицы
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    region TEXT DEFAULT ''
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sales_id INTEGER,
    sales_name TEXT,
    client_name TEXT,
    address TEXT,
    time_slot TEXT,
    date TEXT,
    status TEXT DEFAULT 'new',
    total REAL DEFAULT 0,
    payment_cash REAL DEFAULT 0,
    payment_qr REAL DEFAULT 0,
    payment_debt REAL DEFAULT 0,
    items TEXT DEFAULT '[]',
    comment TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Добавляем начальных пользователей
  db.get('SELECT COUNT(*) as cnt FROM users', (err, row) => {
    if (row && row.cnt === 0) {
      const insert = db.prepare('INSERT OR IGNORE INTO users (login, password, name, role, region) VALUES (?, ?, ?, ?, ?)');
      insert.run('torgoviy1', bcrypt.hashSync('1234', 10),  'Асхат Бейсенов',  'sales',   'Актау');
      insert.run('torgoviy2', bcrypt.hashSync('1234', 10),  'Динара Сейткали', 'sales',   'Актау');
      insert.run('voditel1',  bcrypt.hashSync('1234', 10),  'Марат Ахметов',   'driver',  '');
      insert.run('manager1',  bcrypt.hashSync('1234', 10),  'Айгуль Нурова',   'manager', '');
      insert.run('admin',     bcrypt.hashSync('admin', 10), 'Администратор',   'admin',   '');
      insert.finalize();
      console.log('✅ Пользователи созданы');
    }
  });
});

// Middleware проверки токена
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Неверный токен' });
  }
}

// ===== AUTH =====
app.post('/api/login', (req, res) => {
  const { login, password } = req.body;
  db.get('SELECT * FROM users WHERE login = ?', [login], (err, user) => {
    if (!user || !bcrypt.compareSync(password, user.password)) {
      return res.status(401).json({ error: 'Неверный логин или пароль' });
    }
    const token = jwt.sign(
      { id: user.id, login: user.login, name: user.name, role: user.role, region: user.region },
      JWT_SECRET, { expiresIn: '7d' }
    );
    res.json({ token, user: { id: user.id, name: user.name, role: user.role, region: user.region } });
  });
});

// ===== ORDERS =====
app.get('/api/orders', authMiddleware, (req, res) => {
  const query = req.user.role === 'sales'
    ? 'SELECT * FROM orders WHERE sales_id = ? ORDER BY created_at DESC'
    : 'SELECT * FROM orders ORDER BY created_at DESC';
  const params = req.user.role === 'sales' ? [req.user.id] : [];
  db.all(query, params, (err, orders) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') })));
  });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { clientName, address, timeSlot, items, total, paymentCash, paymentQr, paymentDebt, comment } = req.body;
  const sql = `INSERT INTO orders (sales_id, sales_name, client_name, address, time_slot, date, status, total, payment_cash, payment_qr, payment_debt, items, comment)
               VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [
    req.user.id, req.user.name, clientName, address, timeSlot,
    new Date().toISOString().slice(0, 10),
    total, paymentCash || 0, paymentQr || 0, paymentDebt || 0,
    JSON.stringify(items || []), comment || ''
  ], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM orders WHERE id = ?', [this.lastID], (err, order) => {
      res.json({ ...order, items: JSON.parse(order.items) });
    });
  });
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'in_transit', 'delivered', 'cancelled', 'returned'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
  db.run('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    db.get('SELECT * FROM orders WHERE id = ?', [req.params.id], (err, order) => {
      res.json({ ...order, items: JSON.parse(order.items) });
    });
  });
});

// ===== USERS =====
app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  db.all('SELECT id, login, name, role, region FROM users', [], (err, users) => {
    res.json(users);
  });
});

app.post('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { login, password, name, role, region } = req.body;
  const hashed = bcrypt.hashSync(password, 10);
  db.run('INSERT INTO users (login, password, name, role, region) VALUES (?, ?, ?, ?, ?)',
    [login, hashed, name, role, region || ''], function(err) {
      if (err) return res.status(400).json({ error: 'Логин уже занят' });
      res.json({ id: this.lastID, login, name, role, region });
    }
  );
});

app.delete('/api/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
  db.run('DELETE FROM users WHERE id = ?', [req.params.id], (err) => {
    res.json({ success: true });
  });
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер ЖАЙЫК АКТАУ запущен на порту ${PORT}`);
});
