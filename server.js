const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = 'zhaiyk_aktau_secret_2025';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// База данных (JSON файл)
const adapter = new FileSync('db.json');
const db = low(adapter);

// Начальные данные
db.defaults({
  users: [
    { id: 1, login: 'torgoviy1', password: bcrypt.hashSync('1234', 10),  name: 'Асхат Бейсенов',  role: 'sales',   region: 'Актау' },
    { id: 2, login: 'torgoviy2', password: bcrypt.hashSync('1234', 10),  name: 'Динара Сейткали', role: 'sales',   region: 'Актау' },
    { id: 3, login: 'voditel1',  password: bcrypt.hashSync('1234', 10),  name: 'Марат Ахметов',   role: 'driver',  region: '' },
    { id: 4, login: 'manager1',  password: bcrypt.hashSync('1234', 10),  name: 'Айгуль Нурова',   role: 'manager', region: '' },
    { id: 5, login: 'admin',     password: bcrypt.hashSync('admin', 10), name: 'Администратор',   role: 'admin',   region: '' },
  ],
  orders: [],
  nextUserId: 6,
  nextOrderId: 1
}).write();

console.log('✅ База данных готова');

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
  const user = db.get('users').find({ login }).value();
  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign(
    { id: user.id, login: user.login, name: user.name, role: user.role, region: user.region },
    JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, region: user.region } });
});

// ===== ORDERS =====
app.get('/api/orders', authMiddleware, (req, res) => {
  let orders = db.get('orders').value();
  if (req.user.role === 'sales') {
    orders = orders.filter(o => o.sales_id === req.user.id);
  }
  res.json(orders.slice().reverse());
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { clientName, address, timeSlot, items, total, paymentCash, paymentQr, paymentDebt, comment, contactName, contactPhone, contactBin } = req.body;
  const id = db.get('nextOrderId').value();
  const order = {
    id,
    sales_id: req.user.id,
    sales_name: req.user.name,
    client_name: clientName,
    address,
    time_slot: timeSlot,
    date: new Date().toISOString().slice(0, 10),
    status: 'new',
    total: total || 0,
    payment_cash: paymentCash || 0,
    payment_qr: paymentQr || 0,
    payment_debt: paymentDebt || 0,
    items: items || [],
    comment: comment || '',
    contact_name: contactName || '',
    contact_phone: contactPhone || '',
    contact_bin: contactBin || '',
    created_at: new Date().toISOString()
  };
  db.get('orders').push(order).write();
  db.set('nextOrderId', id + 1).write();
  res.json(order);
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status } = req.body;
  const validStatuses = ['new', 'in_transit', 'delivered', 'cancelled', 'returned'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
  const orderId = parseInt(req.params.id);
  db.get('orders').find({ id: orderId }).assign({ status }).write();
  const order = db.get('orders').find({ id: orderId }).value();
  res.json(order);
});

// ===== USERS =====
app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const users = db.get('users').map(u => ({ id: u.id, login: u.login, name: u.name, role: u.role, region: u.region })).value();
  res.json(users);
});

app.post('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { login, password, name, role, region } = req.body;
  const exists = db.get('users').find({ login }).value();
  if (exists) return res.status(400).json({ error: 'Логин уже занят' });
  const id = db.get('nextUserId').value();
  const user = { id, login, password: bcrypt.hashSync(password, 10), name, role, region: region || '' };
  db.get('users').push(user).write();
  db.set('nextUserId', id + 1).write();
  res.json({ id, login, name, role, region });
});

app.delete('/api/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
  db.get('users').remove({ id: parseInt(req.params.id) }).write();
  res.json({ success: true });
});

// ===== PRODUCTS (Номенклатура из 1С) =====
// ===== PRODUCTS (Номенклатура из 1С) =====
db.defaults({ products: [], productAliases: [] }).write();

app.get('/api/products', (req, res) => {
  const products = db.get('products').value();
  const aliases = db.get('productAliases').value();
  const aliasMap = {};
  aliases.forEach(a => { aliasMap[a.code] = a; });

  const result = products.map(p => {
    const rec = aliasMap[p.code];
    const hasAlias = !!(rec && rec.alias && rec.alias.trim());
    return {
      ...p,
      display_name: hasAlias ? rec.alias : p.name,
      has_alias: hasAlias,
      price1: rec && rec.price1 != null ? rec.price1 : null,
      price2: rec && rec.price2 != null ? rec.price2 : null,
      price3: rec && rec.price3 != null ? rec.price3 : null,
    };
  });
  res.json(result);
});

app.post('/api/products/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== '1c_zhaiyk_2025') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  db.set('products', items).write();
  res.json({ success: true, count: items.length });
});

// ===== PRODUCT ALIASES (псевдонимы и цены для сайта) =====
app.get('/api/product-aliases', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(db.get('productAliases').value());
});

app.post('/api/product-aliases', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code, alias, price1, price2, price3 } = req.body;
  if (!code) return res.status(400).json({ error: 'Не передан код товара' });

  const patch = { alias };
  if (price1 !== undefined) patch.price1 = price1;
  if (price2 !== undefined) patch.price2 = price2;
  if (price3 !== undefined) patch.price3 = price3;

  const existing = db.get('productAliases').find({ code }).value();
  if (existing) {
    db.get('productAliases').find({ code }).assign(patch).write();
  } else {
    db.get('productAliases').push({ code, ...patch }).write();
  }
  res.json({ success: true });
});
// ===== PRODUCT ALIASES (псевдонимы для сайта) =====
app.get('/api/product-aliases', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(db.get('productAliases').value());
});

app.post('/api/product-aliases', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code, alias } = req.body;
  if (!code) return res.status(400).json({ error: 'Не передан код товара' });

  const existing = db.get('productAliases').find({ code }).value();
  if (existing) {
    db.get('productAliases').find({ code }).assign({ alias }).write();
  } else {
    db.get('productAliases').push({ code, alias }).write();
  }
  res.json({ success: true });
});
app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер ЖАЙЫК АКТАУ запущен на порту ${PORT}`);
});
// ===== CLIENTS (Контрагенты из 1С) =====
db.defaults({ clients: [], clientAddresses: [] }).write();

app.get('/api/clients', (req, res) => {
  const clients = db.get('clients').value();
  const addrs = db.get('clientAddresses').value();
  const addrMap = {};
  addrs.forEach(a => { addrMap[a.code] = a; });

  const result = clients.map(c => {
    const rec = addrMap[c.code];
    const hasAddress = !!(rec && rec.address && rec.address.trim());
    return {
      ...c,
      address: hasAddress ? rec.address : (c.address || ''),
      has_address: hasAddress
    };
  });
  res.json(result);
});

app.post('/api/clients/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== '1c_zhaiyk_2025') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  db.set('clients', items).write();
  res.json({ success: true, count: items.length });
});

app.get('/api/client-addresses', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(db.get('clientAddresses').value());
});

app.post('/api/client-addresses', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code, address } = req.body;
  if (!code) return res.status(400).json({ error: 'Не передан код контрагента' });

  const existing = db.get('clientAddresses').find({ code }).value();
  if (existing) {
    db.get('clientAddresses').find({ code }).assign({ address }).write();
  } else {
    db.get('clientAddresses').push({ code, address }).write();
  }
  res.json({ success: true });
});
