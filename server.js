const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const webpush = require('web-push');

const app = express();
const PORT = process.env.PORT || 3001;
// Секреты берутся из окружения; значения ниже — fallback на случай отсутствия .env,
// чтобы не сломать текущий деплой. Рекомендуется задать их в /etc/environment или .env на сервере.
const JWT_SECRET = process.env.JWT_SECRET || 'zhaiyk_aktau_secret_2025';
const SYNC_SECRET = process.env.SYNC_SECRET || '1c_zhaiyk_2025';

// ===== НКТ (nct.gov.kz) — поиск кода НКТ (NTIN) по GTIN/названию =====
const NKT_OFD_BASE_URL = process.env.NKT_OFD_BASE_URL || 'https://nct.gov.kz/api/integration/ofd';
const NKT_OFD_JWT = process.env.NKT_OFD_JWT || '';

// ===== ФОТО ПОДПИСАННЫХ НАКЛАДНЫХ =====
const WAYBILL_PHOTOS_DIR = path.join(__dirname, 'uploads', 'waybill-photos');
fs.mkdirSync(WAYBILL_PHOTOS_DIR, { recursive: true });

// ===== ФОТО ТОВАРОВ (карточки номенклатуры) =====
const PRODUCT_PHOTOS_DIR = path.join(__dirname, 'uploads', 'product-photos');
fs.mkdirSync(PRODUCT_PHOTOS_DIR, { recursive: true });

// ===== PUSH (web-push / VAPID) =====
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BD0DnB9fdncg0KE7RyDuy4HjWbfS9yrFOz7hPPjFokzNsi5P7HzRoc-fBWQn2wjJ5Ku72gZEUSAiW98-ob4Oht8';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || 'n09Cw7dPy2z7RI54fOhdwuDq-iMImbk81rUTEonJi04';
webpush.setVapidDetails('mailto:admin@probuh.asia', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
  nextOrderId: 1,
  pushSubscriptions: []
}).write();

console.log('✅ База данных готова');

// Middleware проверки токена
function authMiddleware(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Нет токена' });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'Неверный токен' });
  }
  // Роль и активность всегда берём из базы, а не из токена: токен живёт 7 дней,
  // и без этой проверки смена должности сотруднику или его отключение
  // администратором не подействует, пока сотрудник сам не перезайдёт —
  // всё это время он продолжит работать со старыми правами
  const user = db.get('users').find({ id: payload.id }).value();
  if (!user || user.active === false) {
    return res.status(401).json({ error: 'Неверный токен' });
  }
  req.user = { id: user.id, login: user.login, name: user.name, role: user.role, region: user.region, client_code: user.client_code || null };
  next();
}

// ===== PUSH: подписки и отправка =====
app.get('/api/push/vapid-public-key', (req, res) => {
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

app.post('/api/push/subscribe', authMiddleware, (req, res) => {
  const { subscription } = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: 'Некорректная подписка' });
  }
  const subs = db.get('pushSubscriptions');
  const exists = subs.find({ endpoint: subscription.endpoint }).value();
  if (exists) {
    subs.find({ endpoint: subscription.endpoint }).assign({ user_id: req.user.id, subscription }).write();
  } else {
    subs.push({ endpoint: subscription.endpoint, user_id: req.user.id, subscription }).write();
  }
  res.json({ success: true });
});

app.post('/api/push/unsubscribe', authMiddleware, (req, res) => {
  const { endpoint } = req.body;
  if (endpoint) {
    db.get('pushSubscriptions').remove({ endpoint }).write();
  } else {
    db.get('pushSubscriptions').remove({ user_id: req.user.id }).write();
  }
  res.json({ success: true });
});

// Отправляет push всем подпискам конкретного пользователя, чистит протухшие подписки
async function sendPushToUser(userId, payload) {
  const subs = db.get('pushSubscriptions').filter({ user_id: userId }).value();
  for (const s of subs) {
    try {
      await webpush.sendNotification(s.subscription, JSON.stringify(payload));
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        db.get('pushSubscriptions').remove({ endpoint: s.endpoint }).write();
      } else {
        console.error('Push error:', err.message);
      }
    }
  }
}

// Отправляет push всем пользователям с указанной ролью (опционально исключая одного)
async function sendPushToRole(role, payload, excludeUserId) {
  const users = db.get('users').filter({ role }).value();
  for (const u of users) {
    if (excludeUserId && u.id === excludeUserId) continue;
    await sendPushToUser(u.id, payload);
  }
}

// ===== AUTH =====
// Публичный список для подсказки на экране входа (как в 1С) — только логин и имя,
// без ролей и прочих данных, чтобы не раскрывать лишнего неавторизованным
app.get('/api/login-hints', (req, res) => {
  const users = db.get('users').filter(u => u.active !== false).value();
  res.json(users.map(u => ({ login: u.login, name: u.name })));
});

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
    { id: user.id, login: user.login, name: user.name, role: user.role, region: user.region, client_code: user.client_code || null },
    JWT_SECRET, { expiresIn: '7d' }
  );
  res.json({ token, user: { id: user.id, name: user.name, role: user.role, region: user.region, client_code: user.client_code || null } });
});

// ===== ORDERS =====
app.get('/api/orders', authMiddleware, (req, res) => {
  let orders = db.get('orders').value();
  if (req.user.role === 'sales' || req.user.role === 'store') {
    orders = orders.filter(o => o.sales_id === req.user.id);
  }
  res.json(orders.slice().reverse());
});

// Фото подписанной клиентом накладной — обязательное условие перед статусом "Доставлено"
app.post('/api/orders/:id/photo', authMiddleware, (req, res) => {
  const orderId = parseInt(req.params.id);
  const order = db.get('orders').find({ id: orderId }).value();
  if (!order) return res.status(404).json({ error: 'Заявка не найдена' });

  const { imageBase64 } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Нет фото' });

  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length > 3 * 1024 * 1024) {
    return res.status(413).json({ error: 'Фото слишком большое' });
  }

  const fileName = `order${orderId}_${Date.now()}.jpg`;
  fs.writeFileSync(path.join(WAYBILL_PHOTOS_DIR, fileName), buf);
  const url = '/uploads/waybill-photos/' + fileName;

  db.get('orders').find({ id: orderId }).assign({
    delivery_photo: url,
    delivery_photo_at: new Date().toISOString()
  }).write();

  res.json({ url });
});

app.post('/api/orders', authMiddleware, (req, res) => {
  const { clientName, clientCode, address, timeSlot, items, total, paymentCash, paymentQr, paymentDebt, comment, contactName, contactPhone } = req.body;

  if (!contactPhone || !contactPhone.trim()) {
    return res.status(400).json({ error: 'Укажите телефон контактного лица' });
  }

  // Заказ от магазина: клиент и цены — только из системы, не из запроса
  // (клиента подменять нельзя, а цену торговой точке трогать нельзя вообще —
  // всегда price1, как решено для самостоятельных заказов).
  let finalClientName = clientName;
  let finalClientCode = clientCode || '';
  let finalItems = items || [];
  if (req.user.role === 'store') {
    if (!req.user.client_code) return res.status(400).json({ error: 'К вашему аккаунту не привязан магазин' });
    const storeClient = db.get('clients').find({ code: req.user.client_code }).value();
    if (!storeClient) return res.status(400).json({ error: 'Клиент не найден' });
    finalClientName = storeClient.name;
    finalClientCode = storeClient.code;

    const aliases = db.get('productAliases').value();
    const aliasMap = {};
    aliases.forEach(a => { aliasMap[a.code] = a; });
    finalItems = (items || []).map(it => {
      const rec = aliasMap[it.code];
      return { ...it, price: rec && rec.price1 != null ? rec.price1 : it.price, commission: rec && rec.commission != null ? rec.commission : 4 };
    });
  }

  // cost — себестоимость на момент оформления заявки, для обоих источников
  // (торгпред и магазин), см. getCostMap. Пишется в саму заявку, чтобы
  // отчёт по прибыли не зависел от того, поменяется ли закупочная цена
  // товара позже.
  const costMap = getCostMap();
  finalItems = finalItems.map(it => ({ ...it, cost: costMap[it.code] != null ? costMap[it.code] : null }));

  const availableMap = computeAvailableStock();
  for (const it of finalItems) {
    if (!it.code) continue;
    const avail = availableMap[it.code] != null ? availableMap[it.code] : 0;
    if (Number(it.qty) > avail) {
      return res.status(400).json({ error: `Недостаточно остатка: "${it.name}" (доступно ${avail})` });
    }
  }

  const id = db.get('nextOrderId').value();
  const finalTotal = req.user.role === 'store'
    ? finalItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    : (total || 0);
  const commissionTotal = finalItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0) * (Number(it.commission) || 0) / 100, 0);
  const order = {
    id,
    sales_id: req.user.id,
    sales_name: req.user.name,
    client_name: finalClientName,
    client_code: finalClientCode,
    source: req.user.role === 'store' ? 'store' : 'sales',
    address,
    time_slot: timeSlot,
    date: new Date().toISOString().slice(0, 10),
    status: 'new',
    total: finalTotal,
    payment_cash: paymentCash || 0,
    payment_qr: paymentQr || 0,
    payment_debt: paymentDebt || 0,
    items: finalItems,
    comment: comment || '',
    contact_name: contactName || '',
    contact_phone: contactPhone || '',
    commission_total: commissionTotal,
    created_at: new Date().toISOString(),
    realized_in_1c: false
  };
  db.get('orders').push(order).write();
  db.set('nextOrderId', id + 1).write();

  sendPushToRole('driver', {
    title: 'Новая заявка',
    body: `${order.client_name} · ${order.time_slot || ''}`,
    url: '/'
  });
  sendPushToRole('manager', {
    title: 'Новая заявка',
    body: order.source === 'store' ? `Магазин «${order.client_name}» оформил заказ` : `${order.sales_name} создал заявку для ${order.client_name}`,
    url: '/'
  });

  // Запоминаем контактное лицо для этого клиента, чтобы в следующий раз
  // оно подставилось само (пока торговый его вручную не изменит)
  if (finalClientCode && (contactName || contactPhone)) {
    const existingContact = db.get('clientContacts').find({ code: finalClientCode }).value();
    if (existingContact) {
      db.get('clientContacts').find({ code: finalClientCode }).assign({
        name: contactName || existingContact.name,
        phone: contactPhone || existingContact.phone
      }).write();
    } else {
      db.get('clientContacts').push({ code: finalClientCode, name: contactName || '', phone: contactPhone || '' }).write();
    }
  }

  res.json(order);
});

app.put('/api/orders/:id/status', authMiddleware, (req, res) => {
  const { status, payment, driverId } = req.body;
  const validStatuses = ['new', 'in_transit', 'delivered', 'cancelled', 'returned', 'revoked'];
  if (!validStatuses.includes(status)) return res.status(400).json({ error: 'Неверный статус' });
  const orderId = parseInt(req.params.id);
  const orderBefore = db.get('orders').find({ id: orderId }).value();
  if (!orderBefore) return res.status(404).json({ error: 'Заявка не найдена' });

  if (status === 'delivered') {
    if (!payment || (Number(payment.cash) || 0) + (Number(payment.qr) || 0) + (Number(payment.debt) || 0) <= 0) {
      return res.status(400).json({ error: 'Укажите способ оплаты (нал/QR/долг) перед подтверждением доставки' });
    }
    if (!orderBefore.delivery_photo) {
      return res.status(400).json({ error: 'Сфотографируйте подписанную накладную перед подтверждением доставки' });
    }
  }

  if (status === 'in_transit' && orderBefore.status !== 'new') {
    return res.status(409).json({ error: 'Заявка уже взята другим водителем' });
  }

  // Менеджер/админ/оператор передаёт заявку конкретному водителю — водитель обязателен
  let assignedDriver = null;
  if (status === 'in_transit' && ['admin', 'manager', 'operator'].includes(req.user.role)) {
    if (!driverId) {
      return res.status(400).json({ error: 'Выберите водителя, которому передать заявку' });
    }
    assignedDriver = db.get('users').find({ id: Number(driverId) }).value();
    if (!assignedDriver || assignedDriver.role !== 'driver') {
      return res.status(400).json({ error: 'Указанный пользователь не является водителем' });
    }
    if (assignedDriver.active === false) {
      return res.status(400).json({ error: 'Этот водитель отключён' });
    }
  }

  if (status === 'new') {
    if (orderBefore.status !== 'in_transit') {
      return res.status(400).json({ error: 'Вернуть в очередь можно только заявку в статусе "В работе"' });
    }
    const isOwner = req.user.role === 'driver' && orderBefore.driver_id === req.user.id;
    const isManager = ['admin', 'manager', 'operator'].includes(req.user.role);
    if (!isOwner && !isManager) {
      return res.status(403).json({ error: 'Вернуть заявку может только водитель, который её взял, либо менеджер' });
    }
  }

  const patch = { status };
  if (['in_transit', 'delivered', 'cancelled', 'returned'].includes(status) && req.user.role === 'driver') {
    patch.driver_id = req.user.id;
    patch.driver_name = req.user.name;
  }
  if (assignedDriver) {
    patch.driver_id = assignedDriver.id;
    patch.driver_name = assignedDriver.name;
  }
  if (status === 'new') {
    patch.driver_id = null;
    patch.driver_name = null;
  }
  if (payment) {
    patch.payment_cash = payment.cash || 0;
    patch.payment_qr = payment.qr || 0;
    patch.payment_debt = payment.debt || 0;
  }
  db.get('orders').find({ id: orderId }).assign(patch).write();
  const order = db.get('orders').find({ id: orderId }).value();
  res.json(order);

  if (['delivered', 'cancelled', 'returned'].includes(status)) {
    const STATUS_LABEL = { delivered: 'Доставлено', cancelled: 'Отказ при получении', returned: 'Возврат' };
    const payload = {
      title: 'Заявка закрыта',
      body: `${order.client_name} · ${STATUS_LABEL[status]}`,
      url: '/'
    };
    sendPushToRole('manager', payload);
    sendPushToRole('driver', payload, req.user.role === 'driver' ? req.user.id : null);
    if (order.source === 'store') {
      sendPushToUser(order.sales_id, {
        title: STATUS_LABEL[status] === 'Доставлено' ? 'Ваш заказ доставлен' : 'Статус заказа изменился',
        body: `Заказ №${order.id} · ${STATUS_LABEL[status]}`,
        url: '/'
      });
    }
  }

  if (status === 'in_transit') {
    sendPushToRole('manager', {
      title: 'Заявка в пути',
      body: `${order.client_name} взята в доставку`,
      url: '/'
    });
    if (order.source === 'store') {
      sendPushToUser(order.sales_id, {
        title: 'Ваш заказ в пути',
        body: `Заказ №${order.id} передан в доставку`,
        url: '/'
      });
    }
    if (order.driver_id) {
      // Целевое уведомление именно назначенному водителю, а не рассылка всем
      sendPushToUser(order.driver_id, {
        title: assignedDriver ? 'Вам передана заявка' : 'Заявка в пути',
        body: `${order.client_name} · ${order.time_slot || ''}`,
        url: '/'
      });
    } else {
      sendPushToRole('driver', {
        title: 'Заявка в пути',
        body: `${order.client_name} взята в доставку`,
        url: '/'
      }, req.user.role === 'driver' ? req.user.id : null);
    }
  }

  if (status === 'new' && orderBefore.status === 'in_transit') {
    const payload = {
      title: 'Заявка снова в очереди',
      body: `${order.client_name} · можно забрать`,
      url: '/'
    };
    sendPushToRole('manager', payload);
    sendPushToRole('driver', payload, req.user.role === 'driver' ? req.user.id : null);
  }
});

app.delete('/api/orders/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только администратор может удалять заявки' });
  const orderId = parseInt(req.params.id);
  const order = db.get('orders').find({ id: orderId }).value();
  if (!order) return res.status(404).json({ error: 'Заявка не найдена' });
  db.get('orders').remove({ id: orderId }).write();
  res.json({ success: true });
});

// ===== USERS =====
// миграция: у старых пользователей проставляем active:true, если поля не было
db.get('users').forEach(u => { if (u.active === undefined) u.active = true; }).write();

app.get('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const users = db.get('users').map(u => ({ id: u.id, login: u.login, name: u.name, role: u.role, region: u.region, client_code: u.client_code || null, active: u.active !== false, employee_code: u.employee_code || null })).value();
  res.json(users);
});

app.post('/api/users', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { login, password, name, role, region, employee_code, client_code } = req.body;
  if (!login || !password || !name || !role) return res.status(400).json({ error: 'Заполните все поля' });
  if (password.length < 4) return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  if (role === 'store' && !client_code) return res.status(400).json({ error: 'Выберите магазин (клиента), к которому привязать кабинет' });
  const exists = db.get('users').find({ login }).value();
  if (exists) return res.status(400).json({ error: 'Логин уже занят' });
  const id = db.get('nextUserId').value();
  const user = { id, login, password: bcrypt.hashSync(password, 10), name, role, region: region || '', client_code: client_code || null, active: true, employee_code: employee_code || null };
  db.get('users').push(user).write();
  db.set('nextUserId', id + 1).write();
  res.json({ id, login, name, role, region, client_code: client_code || null, active: true, employee_code: employee_code || null });
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

const USER_ROLES = ['sales', 'senior_sales', 'driver', 'cashier', 'warehouse', 'manager', 'operator', 'admin', 'store'];

app.put('/api/users/:id/role', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const { role } = req.body;
  if (!USER_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Недопустимая роль' });
  }
  const user = db.get('users').find({ id }).value();
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  db.get('users').find({ id }).assign({ role }).write();
  res.json({ success: true, role });
});

app.put('/api/users/:id/password', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Пароль должен быть не короче 4 символов' });
  }
  const user = db.get('users').find({ id }).value();
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });
  db.get('users').find({ id }).assign({ password: bcrypt.hashSync(password, 10) }).write();
  res.json({ success: true });
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
  // Часть сотрудников приходит из 1С без кода (code пустой) — для них связку с уже
  // созданным аккаунтом можно определить только по имени, иначе сотрудник навсегда
  // остаётся в списке "Без учётной записи", хотя аккаунт для него уже есть.
  // Проверяем по имени всегда, а не только когда у сотрудника ещё нет кода:
  // /api/employees/sync дозаполняет employee_code сам, как только код у
  // физлица появляется в 1С, но это подстраховка на случай рассинхрона
  // (например, между этим запросом и следующей синхронизацией).
  const linkedNamesNoCode = new Set(
    users.filter(u => !u.employee_code).map(u => (u.name || '').trim().toLowerCase())
  );
  res.json(employees.map(e => {
    const hasAccount = (e.code && linkedCodes.has(e.code))
      || linkedNamesNoCode.has((e.name || '').trim().toLowerCase());
    return { ...e, has_account: hasAccount };
  }));
});

app.post('/api/employees/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== SYNC_SECRET) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  // Сотрудники без кода 1С — нормальный случай (см. /api/employees), поэтому
  // дедуплицируем по коду только тех, у кого он есть, а не выбрасываем всех
  // остальных из выгрузки
  const seen = new Set();
  const deduped = (items || []).filter(it => {
    if (!it) return false;
    if (!it.code) return true;
    if (seen.has(it.code)) return false;
    seen.add(it.code);
    return true;
  });

  // Сотрудник мог сначала прийти из 1С без кода (баг в обработке 1С) — админ
  // уже завёл ему аккаунт на сайте, привязанный по имени, раз кода тогда не
  // было (см. hasAccount в GET /api/employees). Если физлицо потом
  // перепровели в 1С и код наконец появился, без этого шага сайт решал бы,
  // что аккаунта ещё нет (совпадение по коду не находится, а по имени
  // больше не проверяется, раз code уже не пуст) — и админ, видя такого
  // сотрудника в "Без учётной записи", создавал бы второй аккаунт на того
  // же человека. Молча дозаполняем employee_code на уже существующем
  // аккаунте по имени, пока он ещё ни к какому коду не привязан.
  const usersCol = db.get('users');
  deduped.forEach(it => {
    if (!it.code) return;
    if (usersCol.find({ employee_code: it.code }).value()) return;
    const name = (it.name || '').trim().toLowerCase();
    if (!name) return;
    const match = usersCol.find(u => !u.employee_code && (u.name || '').trim().toLowerCase() === name).value();
    if (match) usersCol.find({ id: match.id }).assign({ employee_code: it.code }).write();
  });

  db.set('employees', deduped).write();
  res.json({ success: true, count: deduped.length, skipped: (items || []).length - deduped.length });
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
    // categoryCleared — раздел явно очищен на сайте (например, раздел
    // удалили в "Управлении разделами"), даже если у товара есть непустая
    // группа в 1С. Без этого флага rec.category==='' неотличимо от "правки
    // не было", и очистка молча откатывалась бы обратно на p.group.
    const hasCategory = !!(rec && (rec.categoryCleared || (rec.category && rec.category.trim())));
    return {
      ...p,
      display_name: hasAlias ? rec.alias : p.name,
      has_alias: hasAlias,
      // group — раздел в каталоге. По умолчанию из 1С, но менеджер может
      // переопределить на сайте (rec.category) — например, у 1С группа
      // называется иначе или её вообще нет, а на сайте нужен свой раздел.
      group: hasCategory ? (rec.category || '') : (p.group || ''),
      barcode: rec && rec.barcode ? rec.barcode : (p.barcode || ''),
      // Закупочная цена — из 1С (p.cost, когда обмен начнёт её отдавать),
      // либо вручную на вкладке "Товары" (rec.cost перекрывает p.cost).
      // Нужна только для расчёта прибыли в отчётах — на резерв/остаток
      // не влияет.
      cost: rec && rec.cost != null ? rec.cost : (p.cost != null ? p.cost : null),
      price1: rec && rec.price1 != null ? rec.price1 : null,
      price2: rec && rec.price2 != null ? rec.price2 : null,
      price3: rec && rec.price3 != null ? rec.price3 : null,
      // Комиссия — процент от суммы строки заказа сотруднику (см. commissionTotal
      // в POST /api/orders); по умолчанию 4%, пока менеджер не переопределит
      // в карточке товара на вкладке "Товары".
      commission: rec && rec.commission != null ? rec.commission : 4,
      stock: availableMap[p.code] != null ? availableMap[p.code] : 0,
      photo: rec && rec.photo ? rec.photo : null,
      // Код НКТ (NTIN) — подбирается по штрихкоду/названию через nct.gov.kz
      // (см. /api/nkt/*), либо вводится вручную. nkt_status: 'matched'
      // (найден автоматически), 'manual' (вписан руками), 'not_found'
      // (не нашли по штрихкоду) — используется в админке для сортировки/фильтра.
      nkt_code: rec && rec.nkt_code ? rec.nkt_code : '',
      nkt_status: rec && rec.nkt_status ? rec.nkt_status : null,
    };
  });
  res.json(result);
});

// Фото карточки товара — грузит admin/manager, хранится в productAliases
// (та же site-only надстройка над 1С-номенклатурой, что и alias/цены/комиссия),
// поэтому переживает пересинхронизацию products из 1С (products.sync
// перезаписывает весь массив целиком, productAliases отдельная коллекция).
app.post('/api/products/:code/photo', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code } = req.params;
  const { imageBase64 } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Нет фото' });

  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length > 3 * 1024 * 1024) {
    return res.status(413).json({ error: 'Фото слишком большое' });
  }

  const fileName = `product_${code}_${Date.now()}.jpg`;
  fs.writeFileSync(path.join(PRODUCT_PHOTOS_DIR, fileName), buf);
  const url = '/uploads/product-photos/' + fileName;

  const existing = db.get('productAliases').find({ code }).value();
  if (existing) {
    db.get('productAliases').find({ code }).assign({ photo: url }).write();
  } else {
    db.get('productAliases').push({ code, photo: url }).write();
  }

  res.json({ url });
});

app.delete('/api/products/:code/photo', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code } = req.params;
  const existing = db.get('productAliases').find({ code }).value();
  if (existing && existing.photo) {
    const filePath = path.join(__dirname, existing.photo.replace(/^\//, ''));
    fs.unlink(filePath, () => {}); // best-effort — не блокируем ответ, если файла вдруг уже нет
    db.get('productAliases').find({ code }).assign({ photo: null }).write();
  }
  res.json({ success: true });
});

app.post('/api/products/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== SYNC_SECRET) {
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
  const { code, alias, category, barcode, price1, price2, price3, commission, nkt_code, cost } = req.body;
  if (!code) return res.status(400).json({ error: 'Не передан код товара' });

  // Каждое поле — только если реально передано: экран "Товары" шлёт alias+цены
  // без category, а новый экран "Каталог" шлёт category (и фото отдельным
  // эндпоинтом) без alias — раньше alias всегда попадал в patch (даже undefined),
  // и сохранение из "Каталога" тихо стирало бы название сайта.
  const patch = {};
  if (alias !== undefined) patch.alias = alias;
  if (category !== undefined) { patch.category = category; patch.categoryCleared = !category || !category.trim(); }
  if (barcode !== undefined) patch.barcode = barcode;
  if (price1 !== undefined) patch.price1 = price1;
  if (price2 !== undefined) patch.price2 = price2;
  if (price3 !== undefined) patch.price3 = price3;
  if (commission !== undefined) patch.commission = commission;
  if (cost !== undefined) patch.cost = cost === '' || cost === null ? null : Number(cost);
  // Ручная правка кода НКТ на экране "НКТ" — помечаем 'manual', чтобы
  // отличить от автоподбора по штрихкоду (matchNktBatch ставит 'matched')
  // и не перезаписать её следующим массовым подбором.
  if (nkt_code !== undefined) { patch.nkt_code = nkt_code; patch.nkt_status = nkt_code ? 'manual' : null; }

  const existing = db.get('productAliases').find({ code }).value();
  if (existing) {
    db.get('productAliases').find({ code }).assign(patch).write();
  } else {
    db.get('productAliases').push({ code, ...patch }).write();
  }
  res.json({ success: true });
});

// ===== НКТ (nct.gov.kz) — подбор кода НКТ (NTIN) по штрихкоду/названию =====
// Публичный (по документации, без токена) поиск в Национальном каталоге
// товаров: используется, чтобы заполнить "Код НКТ" карточки номенклатуры —
// то же поле, что в 1С:БК на вкладке "Основное" ("Код НКТ") и в регистре
// "Источники происхождения товаров" ("Код товара"). NKT_OFD_JWT добавляется
// в заголовок только если задан — в доке он требовался лишь для отдельного
// метода пакетной выгрузки по timestamp, не для search_ofd.
async function nktFetch(path) {
  const headers = {};
  if (NKT_OFD_JWT) headers['Authorization'] = `JWT ${NKT_OFD_JWT}`;
  const resp = await fetch(`${NKT_OFD_BASE_URL}${path}`, { headers, signal: AbortSignal.timeout(15000) });
  if (!resp.ok) {
    const err = new Error(`НКТ вернул ${resp.status}`);
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

function nktSearchByGtin(gtin) {
  return nktFetch(`/search_ofd/?tin=${encodeURIComponent(gtin)}`);
}

function nktSearchByName(name) {
  return nktFetch(`/search_ofd/?q=${encodeURIComponent(name)}`);
}

// Ответ search_ofd может прийти как массив или как {results:[...]}/объект
// одной карточки — нормализуем в массив, не зная точной формы заранее.
function normalizeNktResults(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.results)) return data.results;
  if (data && (data.ntin_code || data.gtin)) return [data];
  return [];
}

app.get('/api/nkt/search', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { gtin, q } = req.query;
  if (!gtin && !q) return res.status(400).json({ error: 'Укажите gtin или q' });
  try {
    const data = gtin ? await nktSearchByGtin(gtin) : await nktSearchByName(q);
    res.json({ results: normalizeNktResults(data) });
  } catch (e) {
    res.status(502).json({ error: `НКТ недоступен: ${e.message}` });
  }
});

// Пакетный подбор — обрабатывает одну порцию товаров за вызов (фронт гонит
// цикл сам, см. вкладку "НКТ"), а не всё разом на 3400 позиций: синхронный
// HTTP-запрос на весь массив упёрся бы в таймаут, плюс так виден прогресс.
// Каждая позиция — в своём try/catch (см. паттерн "изоляция ошибок" из
// docs/1c-integration-pattern.md в bba-trade) — одна битая карточка НКТ не
// должна останавливать всю пачку.
app.post('/api/nkt/match-batch', authMiddleware, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { codes } = req.body;
  if (!Array.isArray(codes) || codes.length === 0) return res.status(400).json({ error: 'Пустой список кодов' });
  if (codes.length > 50) return res.status(400).json({ error: 'Не более 50 за раз' });

  const products = db.get('products').value();
  const productByCode = {};
  products.forEach(p => { productByCode[p.code] = p; });

  const results = [];
  for (const code of codes) {
    const p = productByCode[code];
    if (!p) { results.push({ code, status: 'error', error: 'Товар не найден' }); continue; }
    if (!p.barcode) { results.push({ code, status: 'no_barcode' }); continue; }
    try {
      const found = normalizeNktResults(await nktSearchByGtin(p.barcode));
      if (found.length > 0 && found[0].ntin_code) {
        const existing = db.get('productAliases').find({ code }).value();
        const patch = { nkt_code: found[0].ntin_code, nkt_status: 'matched' };
        if (existing) db.get('productAliases').find({ code }).assign(patch).write();
        else db.get('productAliases').push({ code, ...patch }).write();
        results.push({ code, status: 'matched', nkt_code: found[0].ntin_code });
      } else {
        const existing = db.get('productAliases').find({ code }).value();
        if (existing) db.get('productAliases').find({ code }).assign({ nkt_status: 'not_found' }).write();
        else db.get('productAliases').push({ code, nkt_status: 'not_found' }).write();
        results.push({ code, status: 'not_found' });
      }
    } catch (e) {
      results.push({ code, status: 'error', error: e.message });
    }
  }
  res.json({ results });
});

// Выгрузка для 1С: подобранные коды НКТ, чтобы обработка обмена записала их
// в реквизит "Код НКТ" карточки номенклатуры (см. паттерн 1С тянет/сверка
// в bba-trade/docs/1c-integration-pattern.md).
app.get('/api/1c/nkt-export', (req, res) => {
  if (req.query.secret !== SYNC_SECRET) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const items = db.get('productAliases').value()
    .filter(a => a.nkt_code)
    .map(a => ({ code: a.code, nkt_code: a.nkt_code }));
  res.json({ items });
});

// ===== CATEGORIES (разделы каталога) =====
// Отдельный явный список — чтобы можно было завести раздел заранее, до
// того как в него попадёт хоть один товар, и переименовать/удалить его
// сразу везде, а не гонять руками каждую карточку товара по отдельности.
db.defaults({ categories: [] }).write();

function effectiveCategory(p, aliasMap) {
  const rec = aliasMap[p.code];
  const hasCategory = !!(rec && (rec.categoryCleared || (rec.category && rec.category.trim())));
  return hasCategory ? (rec.category || '') : (p.group || '');
}

app.get('/api/categories', authMiddleware, (req, res) => {
  res.json(db.get('categories').value());
});

app.post('/api/categories', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const name = (req.body.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Не передано название раздела' });
  const categories = db.get('categories').value();
  if (!categories.includes(name)) {
    db.set('categories', [...categories, name]).write();
  }
  res.json({ success: true });
});

// Переименование — каскадом по всем товарам, у которых текущий эффективный
// раздел (rec.category с учётом categoryCleared, либо p.group из 1С) равен
// старому имени, иначе карточки товаров продолжали бы показывать старое
// название, даже если явный список разделов уже переименован.
app.put('/api/categories/:name', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const oldName = req.params.name;
  const newName = (req.body.name || '').trim();
  if (!newName) return res.status(400).json({ error: 'Не передано новое название' });

  const categories = db.get('categories').value();
  db.set('categories', [...new Set(categories.map(n => n === oldName ? newName : n))]).write();

  const products = db.get('products').value();
  const aliasMap = {};
  db.get('productAliases').value().forEach(a => { aliasMap[a.code] = a; });
  products.forEach(p => {
    if (effectiveCategory(p, aliasMap) !== oldName) return;
    if (aliasMap[p.code]) {
      db.get('productAliases').find({ code: p.code }).assign({ category: newName, categoryCleared: false }).write();
    } else {
      db.get('productAliases').push({ code: p.code, category: newName, categoryCleared: false }).write();
    }
  });
  res.json({ success: true });
});

// Удаление — снимает раздел с товаров, у которых он сейчас проставлен
// (через categoryCleared, см. effectiveCategory/hasCategory выше — иначе
// очистка на пустую строку молча откатилась бы обратно на p.group из 1С).
app.delete('/api/categories/:name', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const name = req.params.name;
  db.set('categories', db.get('categories').value().filter(n => n !== name)).write();

  const products = db.get('products').value();
  const aliasMap = {};
  db.get('productAliases').value().forEach(a => { aliasMap[a.code] = a; });
  products.forEach(p => {
    if (effectiveCategory(p, aliasMap) !== name) return;
    if (aliasMap[p.code]) {
      db.get('productAliases').find({ code: p.code }).assign({ category: '', categoryCleared: true }).write();
    } else {
      db.get('productAliases').push({ code: p.code, category: '', categoryCleared: true }).write();
    }
  });
  res.json({ success: true });
});

// ===== CLIENTS (Контрагенты из 1С) =====
db.defaults({ clients: [], clientAddresses: [], clientContacts: [] }).write();

// Полный список контрагентов — с адресами и контактами каждого, поэтому
// не публичный: раньше отдавался вообще без авторизации (включая аккаунтам
// role=store, у которых на фронте просто фильтровался свой код — но сам
// запрос скачивал данные всех магазинов). Нужен только тем, кто оформляет
// заказ за произвольного клиента (sales) или администрирует карточки
// (admin/manager) — своя карточка магазина теперь отдельно, см. /api/my-client.
app.get('/api/clients', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'sales', 'senior_sales', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const clients = db.get('clients').value();
  const addrs = db.get('clientAddresses').value();
  const contacts = db.get('clientContacts').value();
  const addrMap = {};
  addrs.forEach(a => { addrMap[a.code] = a; });
  const contactMap = {};
  contacts.forEach(c => { contactMap[c.code] = c; });

  const result = clients.map(c => {
    const rec = addrMap[c.code];
    const hasAddress = !!(rec && rec.address && rec.address.trim());
    const contact = contactMap[c.code];
    return {
      ...c,
      address: hasAddress ? rec.address : (c.address || ''),
      has_address: hasAddress,
      contact_name: contact ? contact.name : '',
      contact_phone: contact ? contact.phone : ''
    };
  });
  res.json(result);
});

// ===== "МОЙ КАБИНЕТ" (self-service для role=store) =====
// Магазин видит и редактирует только свою карточку — код берём из токена
// (req.user.client_code), а не из тела запроса, тем же способом, каким
// POST /api/orders уже не даёт store-аккаунту подменить клиента заказа.
app.get('/api/my-client', authMiddleware, (req, res) => {
  if (req.user.role !== 'store') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  if (!req.user.client_code) {
    return res.status(400).json({ error: 'К вашему аккаунту не привязан магазин' });
  }
  const client = db.get('clients').find({ code: req.user.client_code }).value();
  if (!client) return res.status(404).json({ error: 'Клиент не найден' });

  const addrRec = db.get('clientAddresses').find({ code: req.user.client_code }).value();
  const contactRec = db.get('clientContacts').find({ code: req.user.client_code }).value();

  res.json({
    code: client.code,
    name: client.name,
    address: (addrRec && addrRec.address) || client.address || '',
    contactName: (contactRec && contactRec.name) || '',
    contactPhone: (contactRec && contactRec.phone) || '',
  });
});

app.put('/api/my-client', authMiddleware, (req, res) => {
  if (req.user.role !== 'store') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  if (!req.user.client_code) {
    return res.status(400).json({ error: 'К вашему аккаунту не привязан магазин' });
  }
  const code = req.user.client_code;
  const { address, contactName, contactPhone } = req.body || {};

  const existingAddr = db.get('clientAddresses').find({ code }).value();
  if (existingAddr) {
    db.get('clientAddresses').find({ code }).assign({ address: address || '' }).write();
  } else {
    db.get('clientAddresses').push({ code, address: address || '' }).write();
  }

  const existingContact = db.get('clientContacts').find({ code }).value();
  if (existingContact) {
    db.get('clientContacts').find({ code }).assign({ name: contactName || '', phone: contactPhone || '' }).write();
  } else {
    db.get('clientContacts').push({ code, name: contactName || '', phone: contactPhone || '' }).write();
  }

  res.json({ success: true, address: address || '', contactName: contactName || '', contactPhone: contactPhone || '' });
});

app.post('/api/clients/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== SYNC_SECRET) {
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

// ===== CLIENT CONTACTS (контактное лицо клиента, для админа — ручное редактирование) =====
app.get('/api/client-contacts', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(db.get('clientContacts').value());
});

app.post('/api/client-contacts', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'manager') {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code, name, phone } = req.body;
  if (!code) return res.status(400).json({ error: 'Не передан код контрагента' });

  const existing = db.get('clientContacts').find({ code }).value();
  if (existing) {
    db.get('clientContacts').find({ code }).assign({ name, phone }).write();
  } else {
    db.get('clientContacts').push({ code, name, phone }).write();
  }
  res.json({ success: true });
});

// ===== DEBTS (учёт погашения долгов, частично или полностью) =====
db.defaults({ debtSettlements: [] }).write();

app.get('/api/debts', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'driver', 'sales', 'senior_sales'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const orders = db.get('orders').value();
  const sales = db.get('sales').value() || [];
  const settlements = db.get('debtSettlements').value();
  const settledByOrder = {};
  const settledBySale = {};
  settlements.forEach(s => {
    if (s.order_id) settledByOrder[s.order_id] = (settledByOrder[s.order_id] || 0) + s.amount;
    if (s.sale_id) settledBySale[s.sale_id] = (settledBySale[s.sale_id] || 0) + s.amount;
  });

  const today = new Date();
  const daysAgoOf = (dateStr) => Math.floor((today - new Date(dateStr)) / (1000 * 60 * 60 * 24));

  const orderDebts = orders
    .filter(o => o.status === 'delivered' && (o.payment_debt || 0) > 0)
    .map(o => {
      const settled = settledByOrder[o.id] || 0;
      const remaining = Math.max(0, (o.payment_debt || 0) - settled);
      return {
        order_id: o.id, sale_id: null,
        client_name: o.client_name,
        date: o.date,
        original_debt: o.payment_debt || 0,
        settled,
        remaining,
        overdue: remaining > 0 && daysAgoOf(o.date) > 7,
        days_ago: daysAgoOf(o.date),
        // Фото подписанной накладной — оператору нужно скачать/скинуть
        // магазину-должнику как подтверждение поставки при напоминании об оплате.
        delivery_photo: o.delivery_photo || null
      };
    });

  // Долги по продажам в кассе (см. /api/sales) — та же логика погашения,
  // отдельный счётчик settledBySale, чтобы не путать order_id/sale_id
  // (id независимо нумеруются в двух разных коллекциях).
  const saleDebts = sales
    .filter(s => s.status !== 'voided' && (s.payment_debt || 0) > 0)
    .map(s => {
      const settled = settledBySale[s.id] || 0;
      const remaining = Math.max(0, (s.payment_debt || 0) - settled);
      return {
        order_id: null, sale_id: s.id,
        client_name: s.client_name || 'Без клиента',
        date: s.date,
        original_debt: s.payment_debt || 0,
        settled,
        remaining,
        overdue: remaining > 0 && daysAgoOf(s.date) > 7,
        days_ago: daysAgoOf(s.date)
      };
    });

  const debts = [...orderDebts, ...saleDebts]
    .filter(d => d.remaining > 0)
    .sort((a, b) => a.date.localeCompare(b.date));

  res.json(debts);
});

app.post('/api/debts/settle', authMiddleware, (req, res) => {
  // Закрывать долг (частично/полностью) может только оператор/менеджер/админ —
  // раньше это ошибочно разрешалось и водителю, но водитель и торговый
  // должны только видеть должников, справочно (см. GET /api/debts).
  if (!['admin', 'manager', 'operator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { orderId, saleId, amount, method } = req.body;
  if ((!orderId && !saleId) || !amount || Number(amount) <= 0) {
    return res.status(400).json({ error: 'Укажите сумму погашения' });
  }

  const settlements = db.get('debtSettlements').value();
  let clientName, debtTotal, entryPatch;
  if (orderId) {
    const order = db.get('orders').find({ id: Number(orderId) }).value();
    if (!order) return res.status(404).json({ error: 'Заявка не найдена' });
    clientName = order.client_name;
    debtTotal = order.payment_debt || 0;
    const alreadySettled = settlements.filter(s => s.order_id === Number(orderId)).reduce((s, x) => s + x.amount, 0);
    entryPatch = { order_id: Number(orderId), sale_id: null };
    debtTotal = Math.max(0, debtTotal - alreadySettled);
  } else {
    const sale = db.get('sales').find({ id: Number(saleId) }).value();
    if (!sale) return res.status(404).json({ error: 'Продажа не найдена' });
    clientName = sale.client_name;
    const alreadySettled = settlements.filter(s => s.sale_id === Number(saleId)).reduce((s, x) => s + x.amount, 0);
    entryPatch = { order_id: null, sale_id: Number(saleId) };
    debtTotal = Math.max(0, (sale.payment_debt || 0) - alreadySettled);
  }
  const amt = Math.min(Number(amount), debtTotal);

  db.get('debtSettlements').push({
    id: Date.now(),
    ...entryPatch,
    client_name: clientName,
    amount: amt,
    method: method || 'cash',
    date: new Date().toISOString().slice(0, 10),
    settled_by: req.user.name
  }).write();

  res.json({ success: true });
});

// Полная история погашений долгов — для выгрузки в 1С (просто данные, без проводок)
app.get('/api/debt-settlements', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(db.get('debtSettlements').value());
});

// ===== STOCK (остатки из 1С) =====
db.defaults({ stock: [] }).write();

app.post('/api/stock/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== SYNC_SECRET) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  // 1С может присылать не полный снимок остатков, а только изменившиеся
  // коды (как в этом обмене) — db.set() полностью заменял коллекцию, и
  // все коды, отсутствующие в присланном пакете, молча обнулялись
  // (см. computeAvailableStock: код без записи в stock = остаток 0).
  // Обновляем/добавляем только присланные коды, остальные не трогаем.
  const stockCol = db.get('stock');
  (items || []).forEach(it => {
    if (!it || !it.code) return;
    if (stockCol.find({ code: it.code }).value()) {
      stockCol.find({ code: it.code }).assign({ qty: it.qty }).write();
    } else {
      stockCol.push({ code: it.code, qty: it.qty }).write();
    }
  });
  res.json({ success: true, count: (items || []).length });
});

// 1С вызывает этот эндпоинт сразу после того, как реально создала и провела
// документ реализации по заявке — с этого момента заявка больше не резервирует
// остаток на сайте, так как товар уже физически списан в 1С
app.post('/api/orders/:id/mark-realized', (req, res) => {
  const { secret } = req.body;
  if (secret !== SYNC_SECRET) {
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

  // Продажи по кассе (см. SALES ниже) резервируют остаток точно так же, как
  // заявки — иначе касса и доставка могли бы продать один и тот же товар
  // дважды.
  const sales = db.get('sales').value() || [];
  sales.forEach(s => {
    if (s.status === 'voided') return;
    if (s.realized_in_1c) return;
    (s.items || []).forEach(it => {
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

// Себестоимость на момент продажи/заявки — записывается построчно в сам
// заказ/продажу (см. items[].cost ниже), а не читается заново из карточки
// товара при подсчёте прибыли в отчётах. Так прошлые продажи не "уедут" в
// отчёте задним числом, если закупочную цену потом поправят в карточке.
function getCostMap() {
  const products = db.get('products').value();
  const aliases = db.get('productAliases').value();
  const aliasMap = {};
  aliases.forEach(a => { aliasMap[a.code] = a; });
  const costMap = {};
  products.forEach(p => {
    const rec = aliasMap[p.code];
    const cost = rec && rec.cost != null ? rec.cost : (p.cost != null ? p.cost : null);
    if (cost != null) costMap[p.code] = Number(cost);
  });
  return costMap;
}

// ===== СМЕНЫ КАССИРА (открыть/закрыть кассу) =====
// Чисто учётная обёртка вокруг sales — не блокирует продажу (кассир мог
// просто забыть открыть смену), а даёт кассиру и менеджеру видеть, с
// какого момента считать "эту смену", и итог по ней при закрытии.
db.defaults({ cashierShifts: [], nextShiftId: 1 }).write();

app.get('/api/cashier-shift/current', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const shift = db.get('cashierShifts').find({ user_id: req.user.id, status: 'open' }).value();
  res.json(shift || null);
});

app.post('/api/cashier-shift/open', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const existing = db.get('cashierShifts').find({ user_id: req.user.id, status: 'open' }).value();
  if (existing) return res.json(existing);
  const id = db.get('nextShiftId').value();
  const shift = { id, user_id: req.user.id, user_name: req.user.name, opened_at: new Date().toISOString(), status: 'open', closed_at: null };
  db.get('cashierShifts').push(shift).write();
  db.set('nextShiftId', id + 1).write();
  res.json(shift);
});

app.post('/api/cashier-shift/:id/close', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const shift = db.get('cashierShifts').find({ id }).value();
  if (!shift) return res.status(404).json({ error: 'Смена не найдена' });
  if (shift.status === 'closed') return res.json({ success: true });
  if (shift.user_id !== req.user.id && req.user.role === 'cashier') {
    return res.status(403).json({ error: 'Это не ваша смена' });
  }
  db.get('cashierShifts').find({ id }).assign({ status: 'closed', closed_at: new Date().toISOString() }).write();
  res.json({ success: true });
});

// ===== SALES (Касса — продажа по каталогу) =====
// Отдельная от orders коллекция: продажа за прилавком мгновенная (нет
// адреса/времени доставки/водителя), в отличие от заявки на доставку.
// Остаток делится с orders через computeAvailableStock выше, а отчёт
// "Касса" в админке суммирует orders (status=delivered) и sales вместе —
// чтобы не было двух несвязанных мест для сверки кассы.
db.defaults({ sales: [], nextSaleId: 1 }).write();

app.get('/api/sales', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  // Кассир видит только свои продажи — история других кассиров и клиентов
  // ему не принадлежит; admin/manager по-прежнему получают весь список.
  if (req.user.role === 'cashier') {
    return res.json(db.get('sales').filter({ created_by_id: req.user.id }).value());
  }
  res.json(db.get('sales').value());
});

app.post('/api/sales', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { items, paymentCash, paymentQr, paymentDebt, clientCode } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Пустая продажа' });
  }

  const cash = Number(paymentCash) || 0;
  const qr = Number(paymentQr) || 0;
  const debt = Number(paymentDebt) || 0;
  if (debt > 0 && !clientCode) {
    return res.status(400).json({ error: 'Для продажи в долг нужно выбрать клиента' });
  }
  let clientName = '';
  if (clientCode) {
    const client = db.get('clients').find({ code: clientCode }).value();
    if (!client) return res.status(400).json({ error: 'Клиент не найден' });
    clientName = client.name;
  }

  const availableMap = computeAvailableStock();
  const costMap = getCostMap();
  const cleanItems = [];
  for (const it of items) {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    if (!it.code || qty <= 0) continue;
    const avail = availableMap[it.code] != null ? availableMap[it.code] : 0;
    if (qty > avail) {
      return res.status(400).json({ error: `Недостаточно остатка: "${it.name}" (доступно ${avail})` });
    }
    // cost — себестоимость на момент продажи (см. getCostMap); null, если
    // закупочная цена этого товара ещё не заведена — отчёт тогда просто
    // не досчитает прибыль по этой позиции, а не покажет неверную цифру.
    cleanItems.push({ code: it.code, name: it.name, qty, price, sum: qty * price, cost: costMap[it.code] != null ? costMap[it.code] : null });
  }
  if (cleanItems.length === 0) return res.status(400).json({ error: 'Пустая продажа' });

  const total = cleanItems.reduce((s, it) => s + it.sum, 0);
  if (Math.abs((cash + qr + debt) - total) > 1) {
    return res.status(400).json({ error: `Сумма оплаты (${cash + qr + debt}) не совпадает с суммой продажи (${total})` });
  }

  const id = db.get('nextSaleId').value();
  const sale = {
    id,
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    created_by_id: req.user.id,
    created_by_name: req.user.name,
    client_code: clientCode || '',
    client_name: clientName,
    items: cleanItems,
    total,
    payment_cash: cash,
    payment_qr: qr,
    payment_debt: debt,
    status: 'completed',
    realized_in_1c: false,
  };
  db.get('sales').push(sale).write();
  db.set('nextSaleId', id + 1).write();
  res.json(sale);
});

app.post('/api/sales/:id/void', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const sale = db.get('sales').find({ id }).value();
  if (!sale) return res.status(404).json({ error: 'Продажа не найдена' });
  if (sale.created_by_id !== req.user.id && req.user.role === 'cashier') {
    return res.status(403).json({ error: 'Это не ваша продажа' });
  }
  if (sale.status === 'voided') return res.json({ success: true });
  // Если продажа была фискализирована (sale.fiscal_id), фронт обязан сначала
  // пробить чек возврата через CashCore (operation=OPERATION_SELL_RETURN) и
  // прислать его сюда — без fiscal_return_id для уже пробитого чека
  // отменять не даём, иначе в ККМ/ОФД останется чек без обратного документа.
  if (sale.fiscal_id && !req.body.fiscal_return_id) {
    return res.status(400).json({ error: 'Продажа фискализирована — сначала нужно пробить чек возврата' });
  }
  const patch = { status: 'voided', voided_at: new Date().toISOString(), voided_by: req.user.name };
  if (req.body.fiscal_return_id) {
    patch.fiscal_return_id = req.body.fiscal_return_id;
    patch.fiscal_return_qr = req.body.fiscal_return_qr || '';
  }
  db.get('sales').find({ id }).assign(patch).write();
  res.json({ success: true });
});

// Тот же смысл, что и /api/orders/:id/mark-realized — 1С подтверждает, что
// реализация по продаже проведена, и товар больше не резервируется тут.
app.post('/api/sales/:id/mark-realized', (req, res) => {
  const { secret } = req.body;
  if (secret !== SYNC_SECRET) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const sale = db.get('sales').find({ id }).value();
  if (!sale) return res.status(404).json({ error: 'Продажа не найдена' });
  db.get('sales').find({ id }).assign({ realized_in_1c: true }).write();
  res.json({ success: true });
});

// Кассовое ядро CashCore обычно стоит на компьютере в самой торговой
// точке, а не там же, где сервер приложения (см. docs по подключению
// E-Kassa/ОФД) — поэтому чек пробивает браузер кассира напрямую на
// 127.0.0.1, а сюда только присылает результат (fiscal_id/QR) для учёта.
app.post('/api/sales/:id/fiscal', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'cashier'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const sale = db.get('sales').find({ id }).value();
  if (!sale) return res.status(404).json({ error: 'Продажа не найдена' });
  if (sale.created_by_id !== req.user.id && req.user.role === 'cashier') {
    return res.status(403).json({ error: 'Это не ваша продажа' });
  }
  const { fiscal_id, qr_code, ofd_name } = req.body;
  if (!fiscal_id) return res.status(400).json({ error: 'Не передан fiscal_id' });
  db.get('sales').find({ id }).assign({
    fiscal_id,
    fiscal_qr: qr_code || '',
    fiscal_ofd_name: ofd_name || '',
    fiscalized_at: new Date().toISOString(),
  }).write();
  res.json({ success: true });
});

app.get('/{*path}', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`🚀 Сервер ЖАЙЫК АКТАУ запущен на порту ${PORT}`);
});
