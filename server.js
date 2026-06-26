const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Database = require('better-sqlite3');
const path = require('path');

const app = express();
const PORT = 3001;
const JWT_SECRET = 'zhaiyk_aktau_secret_2025';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// База данных
const db = new Database('zhaiyk.db');

// Создаём таблицы
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    login TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT NOT NULL,
    region TEXT DEFAULT ''
  );

  CREATE TABLE IF NOT EXISTS orders (
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
  );
`);

// Добавляем начальных пользователей если их нет
const usersCount = db.prepare('SELECT COUNT(*) as cnt FROM users').get();
if (usersCount.cnt === 0) {
  const insertUser = db.prepare('INSERT INTO users (login, password, name, role, region) VALUES (?, ?, ?, ?, ?)');
  insertUser.run('torgoviy1', bcrypt.hashSync('1234', 10), 'Асхат Бейсенов',  'sales',   'Актау');
  insertUser.run('torgoviy2', bcrypt.hashSync('1234', 10), 'Динара Сейткали', 'sales',   'Актау');
  insertUser.run('voditel1',  bcrypt.hashSync('1234', 10), 'Марат Ахметов',   'driver',  '');
  insertUser.run('manager1',  bcrypt.hashSync('1234', 10), 'Айгуль Нурова',   'manager', '');
  insertUser.run('admin',     bcrypt.hashSync('admin', 10),'Администратор',   'admin',   '');
  console.log('✅ Пользователи созданы');
}

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
  const user = db.prepare('SELECT * FROM users WHERE login = ?').get(login);
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign(
    { id: user.id, login: user.login, name: user.name, role: user.role, region: user.region },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, region: user.region } });
});

// ===== ORDERS =====

// Получить все заявки
app.get('/api/orders', authMiddleware, (req, res) => {
  let orders;
  if (req.user.role === 'sales') {
    orders = db.prepare('SELECT * FROM orders WHERE sales_id = ? ORDER BY created_at DESC').all(req.user.id);
  } else {
    orders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  }
  // Парсим items из JSON строки
  orders = orders.map(o => ({ ...o, items: JSON.parse(o.items || '[]') }));
  res.json(orders);
});

// Создать заявку
app.post('/api/orders', authMiddleware, (req, res) => {
  const { clientName, address, timeSlot, items, total, paymentCash, paymentQr, paymentDebt, comment } = req.body;
  const stmt = db.prepare(`
    INSERT INTO orders (sales_id, sales_name, client_name, address, time_slot, date, status, total, payment_cash, payment_qr, payment_debt, items, comment)
    VALUES (?, ?, ?, ?, ?, ?, 'new', ?, ?, ?, ?, ?, ?)
  `);
  const result = stmt.run(
    req.user.id, req.user.name, clientName, address, timeSlot,
    new Date().toISOString().slice(0, 10),
    total, paymentCash || 0, paymentQr || 0, paymentDebt || 0,
    JSON.stringify(items || []), comment || ''
  );
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  res.json({ ...order, items: JSON.parse(order.items) });
});

// Обновить статус заявки
app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'in_transit', 'delivered', 'cancelled', 'returned'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Неверный статус' });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, req.params.id);
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  res.json({ ...order, items: JSON.parse(order.items) });
});

// ===== USERS =====
app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const users = db.prepare('SELECT id, login, name, role, region FROM users').all();
  res.json(users);
});

// Добавить пользователя
app.post('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { login, password, name, role, region } = req.body;
  try {
    const hashed = bcrypt.hashSync(password, 10);
    const result = db.prepare('INSERT INTO users (login, password, name, role, region) VALUES (?, ?, ?, ?, ?)').run(login, hashed, name, role, region || '');
    res.json({ id: result.lastInsertRowid, login, name, role, region });
  } catch (e) {
    res.status(400).json({ error: 'Логин уже занят' });
  }
});

// Удалить пользователя
app.delete('/api/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Главная страница
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`\n🚀 Сервер ЖАЙЫК АКТАУ запущен!`);
  console.log(`📡 Адрес: http://localhost:${PORT}`);
  console.log(`\nЛогины для входа:`);
  console.log(`  Торговый:  torgoviy1 / 1234`);
  console.log(`  Водитель:  voditel1  / 1234`);
  console.log(`  Менеджер:  manager1  / 1234`);
  console.log(`  Админ:     admin     / admin`);
});
