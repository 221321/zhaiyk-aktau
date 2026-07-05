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
  if (user.active === false) {
    return res.status(403).json({ error: 'Доступ отключён. Обратитесь к администратору' });
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

  const availableMap = computeAvailableStock();
  for (const it of (items || [])) {
    if (!it.code) continue;
    const avail = availableMap[it.code] != null ? availableMap[it.code] : 0;
    if (Number(it.qty) > avail) {
      return res.status(400).json({ error: `Недостаточно остатка: "${it.name}" (доступно ${avail})` });
    }
  }

  const id = db.get('nextOrderId').value();
  const commissionTotal = (items || []).reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0) * (Number(it.commission) || 0) / 100, 0);
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
    commission_total: commissionTotal,
    created_at: new Date().toISOString(),
    realized_in_1c: false
  };
  db.get('orders').push(order).write();
  db.set('nextOrderId', id + 1).write();
  res.json(order);
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status, payment } = req.body;
  const validStatuses = ['new', 'in_transit', 'delivered', 'cancelled', 'returned', 'revoked'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
  const orderId = parseInt(req.params.id);
  const orderBefore = db.get('orders').find({ id: orderId }).value();
  if (!orderBefore) return res.status(404).json({ error: 'Заявка не найдена' });

  if (status === 'delivered') {
    if (!payment || (Number(payment.cash) || 0) + (Number(payment.qr) || 0) + (Number(payment.debt) || 0) <= 0) {
      return res.status(400).json({ error: 'Укажите способ оплаты (нал/QR/долг) перед подтверждением доставки' });
    }
  }

  const patch = { status };
  if (['delivered', 'cancelled', 'returned'].includes(status) && req.user.role === 'driver') {
    patch.driver_id = req.user.id;
    patch.driver_name = req.user.name;
  }
  if (payment) {
    patch.payment_cash = payment.cash || 0;
    patch.payment_qr = payment.qr || 0;
    patch.payment_debt = payment.debt || 0;
  }
  db.get('orders').find({ id: orderId }).assign(patch).write();
  const order = db.get('orders').find({ id: orderId }).value();
  res.json(order);
});

// ===== USERS =====
// миграция: у старых пользователей проставляем active:true, если поля не было
db.get('users').forEach(u => { if (u.active === undefined) u.active = true; }).write();

app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const users = db.get('users').map(u => ({ id: u.id, login: u.login, name: u.name, role: u.role, region: u.region, active: u.active !== false, employee_code: u.employee_code || null })).value();
  res.json(users);
});

app.post('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { login, password, name, role, region, employee_code } = req.body;
  if (!login || !password || !name || !role) return res.status(400).json({ error: 'Заполните все поля' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  const exists = db.get('users').find({ login }).value();
  if (exists) return res.status(400).json({ error: 'Логин уже занят' });
  const id = db.get('nextUserId').value();
  const user = { id, login, password: bcrypt.hashSync(password, 10), name, role, region: region || '', active: true, employee_code: employee_code || null };
  db.get('users').push(user).write();
  db.set('nextUserId', id + 1).write();
  res.json({ id, login, name, role, region, active: true, employee_code: employee_code || null });
});

app.put('/api/users/:id/toggle', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const user = db.get('users').find({ id }).value();
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  const newActive = !(user.active !== false);
  db.get('users').find({ id }).assign({ active: newActive }).write();
  res.json({ success: true, active: newActive });
});

app.delete('/api/users/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Нет доступа' });
  db.get('users').remove({ id: parseInt(req.params.id) }).write();
  res.json({ success: true });
});

// ===== EMPLOYEES (Физлица из 1С) =====
db.defaults({ employees: [] }).write();

app.get('/api/employees', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const employees = db.get('employees').value();
  const users = db.get('users').value();
  const linkedCodes = new Set(users.map(u => u.employee_code).filter(Boolean));
  res.json(employees.map(e => ({ ...e, has_account: linkedCodes.has(e.code) })));
});

app.post('/api/employees/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== '1c_zhaiyk_2025') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  db.set('employees', items).write();
  res.json({ success: true, count: items.length });
});

// ===== PRODUCTS (Номенклатура из 1С) =====
db.defaults({ products: [], productAliases: [] }).write();

app.get('/api/products', (req, res) => {
  const products = db.get('products').value();
  const aliases = db.get('productAliases').value();
  const availableMap = computeAvailableStock();
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
      commission: rec && rec.commission != null ? rec.commission : 0,
      stock: availableMap[p.code] != null ? availableMap[p.code] : 0,
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
  const { code, alias, price1, price2, price3, commission } = req.body;
  if (!code) return res.status(400).json({ error: 'Не передан код товара' });

  const patch = { alias };
  if (price1 !== undefined) patch.price1 = price1;
  if (price2 !== undefined) patch.price2 = price2;
  if (price3 !== undefined) patch.price3 = price3;
  if (commission !== undefined) patch.commission = commission;

  const existing = db.get('productAliases').find({ code }).value();
  if (existing) {
    db.get('productAliases').find({ code }).assign(patch).write();
  } else {
    db.get('productAliases').push({ code, ...patch }).write();
  }
  res.json({ success: true });
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

// ===== DEBTS (учёт погашения долгов, частично или полностью) =====
db.defaults({ debtSettlements: [] }).write();

app.get('/api/debts', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'driver', 'sales'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const orders = db.get('orders').value();
  const settlements = db.get('debtSettlements').value();
  const settledByOrder = {};
  settlements.forEach(s => { settledByOrder[s.order_id] = (settledByOrder[s.order_id] || 0) + s.amount; });

  const today = new Date();
  const debts = orders
    .filter(o => o.status === 'delivered' && (o.payment_debt || 0) > 0)
    .map(o => {
      const settled = settledByOrder[o.id] || 0;
      const remaining = Math.max(0, (o.payment_debt || 0) - settled);
      const orderDate = new Date(o.date);
      const daysAgo = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));
      return {
        order_id: o.id,
        client_name: o.client_name,
        date: o.date,
        original_debt: o.payment_debt || 0,
        settled,
        remaining,
        overdue: remaining > 0 && daysAgo > 7
      };
    })
    .filter(d => d.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(debts);
});

app.post('/api/debts/settle', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'driver'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { orderId, amount, method } = req.body;
  if (!orderId || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Укажите сумму погашения' });
  }
  const order = db.get('orders').find({ id: Number(orderId) }).value();
  if (!order) return res.status(404).json({ error: 'Заявка не найдена' });

  const settlements = db.get('debtSettlements').value();
  const alreadySettled = settlements.filter(s => s.order_id === Number(orderId)).reduce((s, x) => s + x.amount, 0);
  const remaining = Math.max(0, (order.payment_debt || 0) - alreadySettled);
  const amt = Math.min(Number(amount), remaining);

  db.get('debtSettlements').push({
    id: Date.now(),
    order_id: Number(orderId),
    client_name: order.client_name,
    amount: amt,
    method: method || 'cash',
    date: new Date().toISOString().slice(0, 10),
    settled_by: req.user.name
  }).write();

  res.json({ success: true });
});

// ===== STOCK (остатки из 1С) =====
db.defaults({ stock: [] }).write();

app.post('/api/stock/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== '1c_zhaiyk_2025') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  db.set('stock', items).write();
  res.json({ success: true, count: items.length });
});

// 1С вызывает этот эндпоинт сразу после того, как реально создала и провела
// документ реализации по заявке — с этого момента заявка больше не резервирует
// остаток на сайте, так как товар уже физически списан в 1С
app.post('/api/orders/:id/mark-realized', (req, res) => {
  const { secret } = req.body;
  if (secret !== '1c_zhaiyk_2025') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const order = db.get('orders').find({ id }).value();
  if (!order) return res.status(404).json({ error: 'Заявка не найдена' });
  db.get('orders').find({ id }).assign({ realized_in_1c: true }).write();
  res.json({ success: true });
});

// Считает реально доступный остаток: то, что прислала 1С, минус то, что ещё числится
// за незакрытыми в 1С заявками (независимо от того, когда была последняя синхронизация остатков)
function computeAvailableStock() {
  const stock = db.get('stock').value();
  const stockMap = {};
  stock.forEach(s => { stockMap[s.code] = s.qty; });

  const reservedMap = {};
  const orders = db.get('orders').value();
  orders.forEach(o => {
    if (['cancelled', 'revoked', 'returned'].includes(o.status)) return;
    if (o.realized_in_1c) return; // реализация уже проведена в 1С — товар реально списан со склада, повторно не резервируем
    const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
    items.forEach(it => {
      if (!it.code) return;
      reservedMap[it.code] = (reservedMap[it.code] || 0) + (Number(it.qty) || 0);
    });
  });

  const availableMap = {};
  Object.keys(stockMap).forEach(code => {
    availableMap[code] = Math.max(0, stockMap[code] - (reservedMap[code] || 0));
  });
  return availableMap;
}

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер ЖАЙЫК АКТАУ запущен на порту ${PORT}`);
});
