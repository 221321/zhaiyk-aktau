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
const NODE_ENV = process.env.NODE_ENV || 'development';
const IS_PRODUCTION = NODE_ENV === 'production';
// Секреты берутся из окружения; значения ниже — fallback на случай отсутствия .env,
// чтобы не сломать текущий деплой. Рекомендуется задать их в /etc/environment или .env на сервере.
const DEFAULT_JWT_SECRET = 'zhaiyk_aktau_secret_2025';
const DEFAULT_SYNC_SECRET = '1c_zhaiyk_2025';
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_JWT_SECRET;
const SYNC_SECRET = process.env.SYNC_SECRET || DEFAULT_SYNC_SECRET;

// Боевой режим (NODE_ENV=production) не должен молча работать на дефолтных
// секретах из открытого репозитория — иначе любой, кто читал код, может
// подделать JWT сотрудника или обойти SYNC_SECRET синхронизации с 1С.
if (IS_PRODUCTION && (JWT_SECRET === DEFAULT_JWT_SECRET || SYNC_SECRET === DEFAULT_SYNC_SECRET)) {
  console.error(
    '❌ NODE_ENV=production, но JWT_SECRET и/или SYNC_SECRET не заданы через переменные окружения ' +
    '(используются небезопасные значения по умолчанию из исходного кода). ' +
    'Задайте реальные секреты в /etc/environment или .env на сервере и перезапустите процесс.'
  );
  process.exit(1);
}

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

// Фото факт. переданной наличности — обязательно, если водитель принимает
// оплату наличными: фото накладной подтверждает, что товар передан, но не
// то, сколько денег реально получено — отдельное фото купюр закрывает этот
// разрыв (см. проверку в PUT /api/orders/:id/status при payment.cash > 0).
app.post('/api/orders/:id/cash-photo', authMiddleware, (req, res) => {
  if (!['driver', 'admin', 'manager', 'operator'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const orderId = parseInt(req.params.id);
  const order = db.get('orders').find({ id: orderId }).value();
  if (!order) return res.status(404).json({ error: 'Заявка не найдена' });
  if (req.user.role === 'driver' && order.driver_id !== req.user.id) {
    return res.status(403).json({ error: 'Это не ваша заявка' });
  }

  const { imageBase64 } = req.body || {};
  if (!imageBase64) return res.status(400).json({ error: 'Нет фото' });

  const raw = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const buf = Buffer.from(raw, 'base64');
  if (buf.length > 3 * 1024 * 1024) {
    return res.status(413).json({ error: 'Фото слишком большое' });
  }

  const fileName = `order${orderId}_cash_${Date.now()}.jpg`;
  fs.writeFileSync(path.join(WAYBILL_PHOTOS_DIR, fileName), buf);
  const url = '/uploads/waybill-photos/' + fileName;

  db.get('orders').find({ id: orderId }).assign({
    cash_photo: url,
    cash_photo_at: new Date().toISOString()
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
  const aliases = db.get('productAliases').value();
  const aliasMap = {};
  aliases.forEach(a => { aliasMap[a.code] = a; });

  let finalClientName = clientName;
  let finalClientCode = clientCode || '';
  let finalItems = items || [];
  if (req.user.role === 'store') {
    if (!req.user.client_code) return res.status(400).json({ error: 'К вашему аккаунту не привязан магазин' });
    const storeClient = db.get('clients').find({ code: req.user.client_code }).value();
    if (!storeClient) return res.status(400).json({ error: 'Клиент не найден' });
    finalClientName = storeClient.name;
    finalClientCode = storeClient.code;

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
  finalItems = finalItems.map(it => {
    // Снимок признака "весовой товар" на момент создания заявки — не
    // ссылка на текущую карточку товара, чтобы если менеджер потом снимет
    // флаг, уже созданные заявки не "забыли" сами, что их кол-во условное
    // до факт. взвешивания (см. POST /api/orders/weights и печать накладной).
    const isWeightItem = !!(aliasMap[it.code] && aliasMap[it.code].priced_by_weight);
    return {
      ...it,
      cost: costMap[it.code] != null ? costMap[it.code] : null,
      is_weight_item: isWeightItem,
      // Для весового товара qty при создании — это ОЦЕНКА веса в кг
      // (кол-во коробов × примерный вес короба, который вписывает торговый,
      // см. форму заявки), а не количество тары. boxes — реальное кол-во
      // коробов, и именно оно резервирует остаток на складе ниже: остаток
      // до факт. взвешивания (POST /api/orders/weights) считается в
      // коробах (stock.qty), а не в кг. Если клиент не прислал boxes
      // (например, самозаказ магазина) — считаем как раньше, что qty уже
      // и есть кол-во коробов.
      boxes: isWeightItem ? (it.boxes != null ? Number(it.boxes) : (Number(it.qty) || 0)) : undefined,
    };
  });

  const availableMap = computeAvailableStock();
  for (const it of finalItems) {
    if (!it.code) continue;
    const avail = availableMap[it.code] != null ? availableMap[it.code] : 0;
    const checkQty = it.is_weight_item ? (it.boxes || 0) : (Number(it.qty) || 0);
    if (checkQty > avail) {
      return res.status(400).json({ error: `Недостаточно остатка: "${it.name}" (доступно ${avail})` });
    }
  }

  const id = db.get('nextOrderId').value();
  const finalTotal = req.user.role === 'store'
    ? finalItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0)
    : (total || 0);
  // Комиссия — фиксированная сумма в ₸ за единицу товара, а не % от суммы строки.
  const commissionTotal = finalItems.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.commission) || 0), 0);
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

  // Кто вообще вправе поменять статус ЭТОЙ заявки. Раньше это проверялось
  // только для перехода в "new" (см. isOwner/isManager) — остальные переходы
  // (delivered/cancelled/returned/revoked/in_transit) мог вызвать любой
  // залогиненный пользователь любой роли на чужой заявке напрямую через API:
  // кнопки на фронте скрыты по роли/владельцу, но это не защита сервера.
  const isManagerRole = ['admin', 'manager', 'operator'].includes(req.user.role);
  const isOwnerDriver = req.user.role === 'driver' && orderBefore.driver_id === req.user.id;
  const isOwnerSales = ['sales', 'store', 'senior_sales'].includes(req.user.role) && orderBefore.sales_id === req.user.id;
  const canChange = {
    in_transit: (req.user.role === 'driver' && orderBefore.status === 'new') || isManagerRole,
    new: isOwnerDriver || isManagerRole,
    delivered: isOwnerDriver || isManagerRole,
    cancelled: isOwnerDriver || isManagerRole,
    returned: isOwnerDriver || isManagerRole,
    revoked: isOwnerSales || isManagerRole,
  };
  if (!canChange[status]) {
    return res.status(403).json({ error: 'Нет доступа к изменению этой заявки' });
  }

  // Переходы, для которых заявка обязана сейчас быть в конкретном
  // предыдущем статусе — иначе можно, например, "довезти" уже отменённую
  // заявку или повторно закрыть уже доставленную с другой суммой оплаты.
  if (['delivered', 'cancelled', 'returned'].includes(status) && orderBefore.status !== 'in_transit') {
    return res.status(400).json({ error: 'Действие доступно только для заявки в статусе "В работе"' });
  }
  if (status === 'revoked' && orderBefore.status !== 'new') {
    return res.status(400).json({ error: 'Отозвать можно только заявку, которая ещё не взята в доставку' });
  }
  // "new" — это "вернуть в очередь" (см. кнопку у водителя/менеджера) и
  // имеет смысл только из in_transit. Без этой проверки canChange.new
  // (isOwnerDriver||isManagerRole) пропускала бы и delivered→new в обход UI,
  // а доставка списывает остаток напрямую (см. ниже) — вернув статус назад,
  // заявку можно было бы "доставить" повторно и списать остаток дважды.
  if (status === 'new' && orderBefore.status !== 'in_transit') {
    return res.status(400).json({ error: 'Вернуть в очередь можно только заявку в статусе "В работе"' });
  }

  if (status === 'delivered') {
    // Весовая позиция без факт. веса (weight_confirmed) всё ещё хранит
    // ОЦЕНКУ (кол-во коробов × примерный вес, вписанные торговым при
    // оформлении, см. POST /api/orders) — если довезти заявку так, эта
    // оценка навсегда останется в total/qty: после статуса "доставлено"
    // POST /api/orders/weights взвешивать уже не даёт (см. проверку статуса
    // там же), а kg-остаток по факту так и не спишется.
    const orderItems = typeof orderBefore.items === 'string' ? JSON.parse(orderBefore.items || '[]') : (orderBefore.items || []);
    const pendingWeightItems = orderItems.filter(it => it.is_weight_item && !it.weight_confirmed);
    if (pendingWeightItems.length > 0) {
      return res.status(400).json({ error: `Склад ещё не подтвердил факт. вес: ${pendingWeightItems.map(it => it.name).join(', ')}. Доставка недоступна, пока вес не введён` });
    }
    const cash = Number(payment && payment.cash) || 0;
    const qr = Number(payment && payment.qr) || 0;
    const debt = Number(payment && payment.debt) || 0;
    if (!payment || cash + qr + debt <= 0) {
      return res.status(400).json({ error: 'Укажите способ оплаты (нал/QR/долг) перед подтверждением доставки' });
    }
    if (!orderBefore.delivery_photo) {
      return res.status(400).json({ error: 'Сфотографируйте подписанную накладную перед подтверждением доставки' });
    }
    // Фото накладной подтверждает только передачу товара, а не то, сколько
    // денег реально получено наличными — отдельное фото купюр обязательно,
    // если в оплате участвует нал (см. POST /api/orders/:id/cash-photo).
    if (cash > 0 && !orderBefore.cash_photo) {
      return res.status(400).json({ error: 'Сфотографируйте полученную наличность перед подтверждением доставки' });
    }
    // Нал+QR+долг обязаны совпасть с суммой заявки — иначе касса/долги
    // разъедутся с тем, что реально доставлено (для продаж кассы такая
    // сверка уже была, см. POST /api/sales; для доставки её не хватало).
    if (Math.abs((cash + qr + debt) - (orderBefore.total || 0)) > 1) {
      return res.status(400).json({ error: `Сумма оплаты (${cash + qr + debt}) не совпадает с суммой заявки (${orderBefore.total || 0})` });
    }

    // Товар физически покинул склад — списываем остаток напрямую и сразу
    // (без 1С списывать больше некому). До сих пор заявка в статусах
    // new/in_transit только резервировала остаток (см. computeAvailableStock),
    // а окончательное списание происходит один раз здесь, ровно в момент
    // подтверждения доставки — все проверки выше (вес подтверждён, оплата
    // указана) уже прошли, дальше статус этой заявки меняться не может
    // (см. canChange/прежний статус выше), так что повторно списать нельзя.
    const stockCol = db.get('stock');
    orderItems.forEach(it => {
      if (!it.code) return;
      const rec = stockCol.find({ code: it.code }).value();
      if (!rec) return;
      const boxesDelta = it.is_weight_item ? (Number(it.boxes) || 0) : (Number(it.qty) || 0);
      stockCol.find({ code: it.code }).assign({ qty: Math.max(0, (Number(rec.qty) || 0) - boxesDelta) }).write();
      // Для весового товара после подтверждения факт. веса (см. POST
      // /api/orders/weights) отдельно списываем и кг-пул — qty позиции
      // теперь хранит именно кг (см. computeAvailableWeightKg).
      if (it.is_weight_item && it.weight_confirmed && rec.weight_kg != null) {
        stockCol.find({ code: it.code }).assign({ weight_kg: Math.max(0, (Number(rec.weight_kg) || 0) - (Number(it.qty) || 0)) }).write();
      }
    });
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

// Факт. вес для весового товара — часть заявок содержит позиции, вес которых
// известен только когда зав. склад реально взвешивает их при отгрузке
// водителю (заказано "4 коробки", а сколько это в кг — узнаётся на весах).
// Кладовщик правит сразу пачкой (по всем заявкам одного водителя из
// "Загрузочного листа"), поэтому один эндпоинт принимает список правок по
// разным заявкам. Каждая правка меняет qty у конкретной позиции конкретной
// заявки на факт. вес (для этих товаров цена уже указана за кг) и
// пересчитывает total заявки — дальше это уже "живые" данные для отчётов,
// остатка и для того, что менеджер увидит при синхронизации с 1С.
app.post('/api/orders/weights', authMiddleware, (req, res) => {
  if (!['warehouse', 'admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { entries } = req.body;
  if (!Array.isArray(entries) || entries.length === 0) {
    return res.status(400).json({ error: 'Нет данных для сохранения' });
  }

  // Остаток для сверки веса — отдельный, В КГ (см. computeAvailableWeightKg):
  // qty позиции здесь заказан в коробах (единица остатка stock.qty), а
  // вводимое здесь число — факт. вес в кг, сверять его нужно с кг-остатком
  // (stock.weight_kg), а не с остатком в коробах — иначе почти любой вес
  // будет выглядеть как "не хватает остатка". Считаем один раз и уменьшаем
  // по ходу пачки: если в одной пачке две правки идут по одному коду в
  // разных заявках, вторая должна видеть остаток уже с учётом первой.
  const weightAvailableMap = computeAvailableWeightKg();
  // Флаг is_weight_item — снимок на момент СОЗДАНИЯ заявки (см. POST
  // /api/orders): у заявок, оформленных до того, как товар отметили
  // "Весовой" в карточке (или до того, как это поле вообще появилось),
  // снимок остался false, хотя товар физически весовой и ждёт взвешивания.
  // Подстраховываемся текущим состоянием карточки товара, чтобы такие
  // старые заявки не выпадали из ввода веса молча.
  const aliasMap = {};
  db.get('productAliases').value().forEach(a => { aliasMap[a.code] = a; });
  const isCurrentlyWeightItem = (code) => !!(aliasMap[code] && aliasMap[code].priced_by_weight);
  const updatedOrders = [];
  const errors = [];
  entries.forEach(entry => {
    const { orderId, code, weight } = entry || {};
    if (!orderId || !code || weight === undefined || weight === null || weight === '') return;
    const order = db.get('orders').find({ id: Number(orderId) }).value();
    if (!order) return;
    // Вес должен быть введён ДО того, как заявка доставлена — после
    // доставки остаток по этой позиции уже списан напрямую (см. PUT
    // /api/orders/:id/status), и правка веса задним числом разъехалась бы
    // с тем, что уже списано и с чем сверилась оплата у водителя.
    if (!['new', 'in_transit'].includes(order.status)) {
      errors.push(`№${orderId}: вес можно вводить только пока заявка не доставлена (сейчас "${order.status}")`);
      return;
    }
    const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
    const item = items.find(it => it.code === code);
    if (!item) return;
    // Эндпоинт только для весового товара — у обычной позиции qty остаётся
    // в коробах/штуках, вписывать сюда "кг" для неё означало бы молча
    // подменить количество совсем другим числом. Смотрим и на снимок с
    // момента создания заявки, и на текущую карточку товара (см. выше).
    const isWeightItem = item.is_weight_item || isCurrentlyWeightItem(code);
    if (!isWeightItem) {
      errors.push(`"${item.name}" в заявке №${orderId}: не весовой товар, правка веса недоступна`);
      return;
    }
    // Самолечим устаревший снимок — дальше именно это поле решает, что
    // позиция считается по кг-пулу, а не по остатку в коробах (см.
    // computeAvailableStock/computeAvailableWeightKg).
    item.is_weight_item = true;
    const newWeight = Number(weight);
    // До первого подтверждения qty позиции — это короба (другая единица,
    // другой пул), поэтому в кг-пуле она ещё ничего не резервирует: дельта
    // против кг-остатка — это весь вводимый вес. После подтверждения qty
    // уже в кг сам, и повторная правка — обычная дельта.
    const oldKgQty = item.weight_confirmed ? (Number(item.qty) || 0) : 0;
    const deltaKg = newWeight - oldKgQty;
    // Кг-остаток известен только если склад заполнил "Вес, кг" в "Остатках"
    // (PUT /api/stock/:code) — если нет, сверять не с чем, пропускаем
    // проверку, а не блокируем ввод веса из-за отсутствующих данных.
    if (Object.prototype.hasOwnProperty.call(weightAvailableMap, code)) {
      const avail = weightAvailableMap[code];
      if (deltaKg > avail) {
        errors.push(`"${item.name}" в заявке №${orderId}: не хватает остатка по весу (нужно ещё ${(deltaKg - avail).toLocaleString()} кг, доступно ${avail.toLocaleString()} кг)`);
        return;
      }
      weightAvailableMap[code] = avail - deltaKg;
    }
    item.qty = newWeight;
    // Помечаем позицию подтверждённой — печать накладной по заявкам с
    // весовым товаром предупреждает, пока это не выставлено на всех
    // весовых позициях заявки (см. is_weight_item, снимок при создании).
    item.weight_confirmed = true;
    const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
    db.get('orders').find({ id: Number(orderId) }).assign({ items, total }).write();
    if (!updatedOrders.includes(Number(orderId))) updatedOrders.push(Number(orderId));
  });

  res.json({ success: true, updatedOrders, errors: errors.length ? errors : undefined });
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
  const stockMap = {};
  db.get('stock').value().forEach(s => { stockMap[s.code] = s; });

  const result = products.map(p => {
    const rec = aliasMap[p.code];
    const stockRec = stockMap[p.code];
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
      // Комиссия — фиксированная сумма в ₸ за единицу товара сотруднику
      // (см. commissionTotal в POST /api/orders и bonus в отчёте
      // AdminCabinet), не % от суммы строки. По умолчанию 4 ₸, пока
      // менеджер не переопределит в карточке товара на вкладке "Товары".
      commission: rec && rec.commission != null ? rec.commission : 4,
      // Весовой товар — цена за кг, но заказывают коробками/штуками, точный
      // вес узнаётся только на складе (см. POST /api/orders/weights).
      // Помечает менеджер вручную на вкладке "Товары".
      priced_by_weight: !!(rec && rec.priced_by_weight),
      stock: availableMap[p.code] != null ? availableMap[p.code] : 0,
      // Единица измерения и вес остатка — правит зав. склад вручную на
      // экране "Остатки" (см. PUT /api/stock/:code), 1С шлёт только qty.
      // Нужно, когда товар физически весовой, а 1С отдаёт его коробками/
      // штуками — склад фиксирует, сколько реально килограммов в остатке.
      stock_unit: stockRec && stockRec.unit ? stockRec.unit : (p.unit || null),
      stock_weight_kg: stockRec && stockRec.weight_kg != null ? stockRec.weight_kg : null,
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
  if (!['admin', 'manager', 'senior_sales'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code, alias, category, barcode, price1, price2, price3, commission, nkt_code, cost, priced_by_weight } = req.body;
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
  // Весовой товар — количество в заявке до факт. взвешивания на складе
  // условное (см. POST /api/orders/weights), поэтому накладную по такой
  // заявке нельзя печатать до подтверждения веса (см. is_weight_item на
  // позиции заявки, снимается снимком с этого флага на момент создания).
  if (priced_by_weight !== undefined) patch.priced_by_weight = !!priced_by_weight;
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

  // Раньше запросы к nct.gov.kz шли строго по одному (for..await) — пакет
  // из полусотни кодов с 15с таймаутом на каждый (см. nktFetch) мог тянуться
  // минутами и упираться в таймаут прокси/клиента. Коды независимы друг от
  // друга, гоняем с ограниченной параллельностью — не все 50 разом одним
  // залпом на внешний госсервис. Гонки по db.get('productAliases') тоже нет:
  // между await и записью для каждого кода нет других await, так что этот
  // синхронный кусок (чтение existing → write) не может быть прерван другим
  // воркером, а разные коды пишут разные записи.
  const CONCURRENCY = 5;
  const results = new Array(codes.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < codes.length) {
      const i = nextIndex++;
      const code = codes[i];
      const p = productByCode[code];
      if (!p) { results[i] = { code, status: 'error', error: 'Товар не найден' }; continue; }
      if (!p.barcode) { results[i] = { code, status: 'no_barcode' }; continue; }
      try {
        const found = normalizeNktResults(await nktSearchByGtin(p.barcode));
        if (found.length > 0 && found[0].ntin_code) {
          const existing = db.get('productAliases').find({ code }).value();
          const patch = { nkt_code: found[0].ntin_code, nkt_status: 'matched' };
          if (existing) db.get('productAliases').find({ code }).assign(patch).write();
          else db.get('productAliases').push({ code, ...patch }).write();
          results[i] = { code, status: 'matched', nkt_code: found[0].ntin_code };
        } else {
          const existing = db.get('productAliases').find({ code }).value();
          if (existing) db.get('productAliases').find({ code }).assign({ nkt_status: 'not_found' }).write();
          else db.get('productAliases').push({ code, nkt_status: 'not_found' }).write();
          results[i] = { code, status: 'not_found' };
        }
      } catch (e) {
        results[i] = { code, status: 'error', error: e.message };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, codes.length) }, worker));
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
// driver — для оформления возврата в свободной форме (см. POST
// /api/returns), когда нужно найти клиента без конкретной заявки под рукой.
app.get('/api/clients', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'sales', 'senior_sales', 'cashier', 'driver'].includes(req.user.role)) {
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

// ===== STOCK (остатки снова приходят из 1С через /api/stock/sync; продажа/
// доставка/возврат по-прежнему списывают/приходуют qty напрямую в моменте —
// см. соответствующие эндпоинты) =====
db.defaults({ stock: [] }).write();

// 1С — снова источник остатков (решение владельца отменено). 1С может
// присылать не полный снимок, а только изменившиеся коды — поэтому
// обновляем/добавляем только присланные коды через upsert, а не полностью
// заменяем коллекцию db.set(), иначе коды, отсутствующие в конкретном
// пакете, молча обнулялись бы (см. computeAvailableStock: код без записи в
// stock = остаток 0; этот баг уже однажды чинили, см. историю коммитов).
app.post('/api/stock/sync', (req, res) => {
  const { items, secret } = req.body;
  if (secret !== SYNC_SECRET) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  // Мутируем массив в памяти и пишем на диск один раз в конце — 1С может
  // прислать разом весь каталог (тысячи кодов), а FileSync.write() каждый
  // раз синхронно сериализует и перезаписывает ВЕСЬ db.json (включая
  // заявки/приходы/клиентов), не только stock; запись на каждый код
  // означала бы столько же блокирующих операций записи файла подряд.
  const stock = db.get('stock').value();
  const stockByCode = {};
  stock.forEach(s => { stockByCode[s.code] = s; });
  let count = 0;
  (items || []).forEach(it => {
    if (!it || !it.code) return;
    const qty = Number(it.qty) || 0;
    if (stockByCode[it.code]) {
      stockByCode[it.code].qty = qty;
    } else {
      const rec = { code: it.code, qty };
      stock.push(rec);
      stockByCode[it.code] = rec;
    }
    count++;
  });
  db.write();
  res.json({ success: true, count });
});

// Зав. склад правит остаток вручную — 1С шлёт только qty в её единице
// измерения (может быть "коробки"), а по факту часть товара весовая
// (реальный вес узнаётся только на складе). unit/weight_kg — сайт-only
// надстройка поверх qty из 1С, тем же паттерном что productAliases поверх
// products: /api/stock/sync трогает только qty через assign(), эти два
// поля переживают ресинк остатков.
app.put('/api/stock/:code', authMiddleware, (req, res) => {
  if (!['warehouse', 'admin', 'manager', 'senior_sales'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { code } = req.params;
  const { qty, unit, weight_kg } = req.body;
  const patch = {};
  if (qty !== undefined) patch.qty = Number(qty) || 0;
  if (unit !== undefined) patch.unit = unit || null;
  if (weight_kg !== undefined) patch.weight_kg = weight_kg === '' || weight_kg === null ? null : Number(weight_kg);

  const stockCol = db.get('stock');
  if (stockCol.find({ code }).value()) {
    stockCol.find({ code }).assign(patch).write();
  } else {
    stockCol.push({ code, qty: 0, ...patch }).write();
  }
  res.json({ success: true });
});

// Считает реально доступный остаток: физический остаток на сайте (его меняют
// напрямую приход/продажа/доставка/возврат — см. соответствующие эндпоинты)
// минус то, что ещё зарезервировано под заявки, которые едут, но ещё не
// доставлены (см. ниже)
function computeAvailableStock() {
  const stock = db.get('stock').value();
  const stockMap = {};
  stock.forEach(s => { stockMap[s.code] = s.qty; });

  // stock.qty — уже актуальный физический остаток (приход/продажа/доставка/
  // возврат меняют его напрямую, каждый в своём эндпоинте, см. POST
  // /api/receipts, POST /api/sales, PUT /api/orders/:id/status, POST
  // /api/returns). Резервировать здесь нужно только то, что ещё едет, но не
  // доставлено (new/in_transit) — иначе одно и то же можно было бы продать
  // дважды, пока заявка в пути; доставленные/отменённые/возвращённые заявки
  // на остаток уже не влияют (либо списаны напрямую, либо ничего не брали).
  const reservedMap = {};
  const orders = db.get('orders').value();
  orders.forEach(o => {
    if (!['new', 'in_transit'].includes(o.status)) return;
    const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
    items.forEach(it => {
      if (!it.code) return;
      if (it.is_weight_item) {
        // Позиция с подтверждённым факт. весом (weight_confirmed, см. POST
        // /api/orders/weights) хранит qty уже в кг, а не в единице остатка
        // (обычно короба) — считать её здесь означало бы вычитать кг-число
        // из остатка в коробах, как будто это тоже короба. Расход такой
        // позиции отслеживается отдельно, см. computeAvailableWeightKg.
        if (it.weight_confirmed) return;
        // До подтверждения qty у весовой позиции — оценка веса в кг (см.
        // POST /api/orders), реальное кол-во коробов лежит в it.boxes —
        // короба резервируем им, а не оценкой веса.
        reservedMap[it.code] = (reservedMap[it.code] || 0) + (Number(it.boxes) || 0);
        return;
      }
      reservedMap[it.code] = (reservedMap[it.code] || 0) + (Number(it.qty) || 0);
    });
  });

  const availableMap = {};
  Object.keys(stockMap).forEach(code => {
    availableMap[code] = Math.max(0, stockMap[code] - (reservedMap[code] || 0));
  });
  return availableMap;
}

// Доступный остаток В КГ для весовых товаров (priced_by_weight) — отдельный
// пул от computeAvailableStock. У весового товара остаток считается
// короба́ми (stock.qty), а факт. вес узнаётся только на весах при отгрузке
// (POST /api/orders/weights); склад отдельно фиксирует, сколько реально кг
// в остатке, в stock.weight_kg (см. PUT /api/stock/:code, поле "Вес, кг").
// После подтверждения веса позиция заявки хранит вес в кг — сверять его
// нужно с этим кг-остатком, а не с остатком в коробах, иначе 40+ кг веса
// сравнивались бы с 10-15 доступными коробами и почти всегда "не хватало бы
// остатка", хотя по весу товара физически достаточно.
function computeAvailableWeightKg() {
  const stock = db.get('stock').value();
  const weightMap = {};
  stock.forEach(s => { if (s.weight_kg != null) weightMap[s.code] = Number(s.weight_kg) || 0; });

  const reservedKg = {};
  const orders = db.get('orders').value();
  orders.forEach(o => {
    if (!['new', 'in_transit'].includes(o.status)) return;
    const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
    items.forEach(it => {
      if (!it.code || !it.is_weight_item || !it.weight_confirmed) return;
      reservedKg[it.code] = (reservedKg[it.code] || 0) + (Number(it.qty) || 0);
    });
  });

  const availableMap = {};
  Object.keys(weightMap).forEach(code => {
    availableMap[code] = Math.max(0, weightMap[code] - (reservedKg[code] || 0));
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

// Комиссия торгового на момент возврата — та же логика снимка, что у
// getCostMap: используется только при создании возврата (см. RETURNS), чтобы
// вычесть бонус из отчёта по актуальной на сегодня ставке (сама ставка на
// заявке уже заморожена при продаже, см. commissionByCode в отчёте фронта).
function getCommissionMap() {
  const products = db.get('products').value();
  const aliases = db.get('productAliases').value();
  const aliasMap = {};
  aliases.forEach(a => { aliasMap[a.code] = a; });
  const map = {};
  products.forEach(p => {
    const rec = aliasMap[p.code];
    map[p.code] = rec && rec.commission != null ? rec.commission : 4;
  });
  return map;
}

// ===== ВОЗВРАТЫ (частичные, отдельно от статуса заявки) =====
// Раньше единственный способ оформить возврат — статус заявки "returned",
// который снимает ВСЮ заявку целиком (см. PUT /api/orders/:id/status).
// В жизни магазин часто возвращает 1-2 позиции из 5, а порча товара
// обнаруживается через дни после доставки, когда заявка уже отработана —
// под оба случая нужен отдельный, независимый от статуса заявки объект:
// конкретные позиции/количество, с датой и причиной, который просто
// уменьшает выручку/бонус нужного торгового и возвращает товар в остаток
// (см. computeAvailableStock), не трогая саму заявку и её статус.
db.defaults({ returns: [], nextReturnId: 1 }).write();

app.get('/api/returns', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'driver', 'sales', 'senior_sales'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  let list = db.get('returns').value();
  // Водитель/торговый видят только свои возвраты (сам оформил / его продажи) —
  // как и с заявками, полный список — только у admin/manager/operator.
  if (req.user.role === 'driver') list = list.filter(r => r.created_by_id === req.user.id);
  if (req.user.role === 'sales') list = list.filter(r => r.sales_id === req.user.id);
  res.json(list.slice().reverse());
});

app.post('/api/returns', authMiddleware, (req, res) => {
  // Оформить возврат может водитель (обнаружил порчу/забрал у магазина) —
  // прямая просьба, ради которой это всё затевалось — и admin/manager/operator.
  if (!['admin', 'manager', 'operator', 'driver'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { orderId, clientCode, clientName, salesId, items, reason, date, refundCash, refundQr } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Укажите хотя бы одну позицию для возврата' });
  }

  let finalClientCode = clientCode || '';
  let finalClientName = clientName || '';
  let finalSalesId = salesId != null && salesId !== '' ? Number(salesId) : null;
  let finalSalesName = null;
  let order = null;

  if (orderId) {
    order = db.get('orders').find({ id: Number(orderId) }).value();
    if (!order) return res.status(400).json({ error: 'Заявка не найдена' });
    // Возврат по заявке имеет смысл только после того, как товар реально
    // доставлен клиенту — до этого действует обычная логика заявки
    // (статусы cancelled/returned на самой заявке, см. PUT .../status).
    if (order.status !== 'delivered') {
      return res.status(400).json({ error: 'Возврат по заявке доступен только после статуса "Доставлено"' });
    }
    // Клиента и торгового при возврате по заявке берём из самой заявки, а не
    // из тела запроса — иначе можно было бы приписать возврат/минус бонуса
    // не тому торговому.
    finalClientCode = order.client_code;
    finalClientName = order.client_name;
    finalSalesId = order.sales_id;
    finalSalesName = order.sales_name;
  } else if (finalSalesId) {
    const rep = db.get('users').find({ id: finalSalesId }).value();
    if (!rep) return res.status(400).json({ error: 'Торговый не найден' });
    finalSalesName = rep.name;
  }
  if (!finalClientName || !finalClientName.trim()) {
    return res.status(400).json({ error: 'Укажите клиента' });
  }

  // Сколько по этой заявке уже возвращали раньше — чтобы нельзя было вернуть
  // больше, чем реально было доставлено (в т.ч. по частям, за несколько раз).
  const alreadyReturned = {};
  let orderItemsParsed = [];
  if (order) {
    orderItemsParsed = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
    db.get('returns').filter({ order_id: order.id }).value().forEach(r => {
      (r.items || []).forEach(it => {
        if (!it.code) return;
        alreadyReturned[it.code] = (alreadyReturned[it.code] || 0) + (Number(it.qty) || 0);
      });
    });
  }

  const costMap = getCostMap();
  const commissionMap = getCommissionMap();
  const cleanItems = [];
  for (const it of (items || [])) {
    const qty = Number(it.qty) || 0;
    const price = Number(it.price) || 0;
    const name = (it.name || '').trim();
    if (!name || qty <= 0) continue;
    let orderItem = null;
    if (order) {
      orderItem = orderItemsParsed.find(oi => oi.code === it.code);
      const delivered = orderItem ? (Number(orderItem.qty) || 0) : 0;
      const already = alreadyReturned[it.code] || 0;
      if (qty > delivered - already) {
        return res.status(400).json({ error: `"${name}": нельзя вернуть больше, чем доставлено (доставлено ${delivered}, уже возвращено ${already})` });
      }
    }
    cleanItems.push({
      code: it.code || '',
      name,
      qty,
      price,
      sum: qty * price,
      // Себестоимость/комиссия — снимок на момент ВОЗВРАТА (не самой
      // продажи): это отдельная от заявки операция, и для свободного
      // формата (без orderId) снимка на продаже вообще нет.
      cost: it.code && costMap[it.code] != null ? costMap[it.code] : null,
      commission: it.code && commissionMap[it.code] != null ? commissionMap[it.code] : 0,
      // Признак весового товара — только по заявке (см. ниже, чем возврат
      // приходует остаток): для весового товара после подтверждения веса
      // qty здесь в кг, и его нужно вернуть в кг-пул (stock.weight_kg), а
      // не в короба́ (stock.qty). У свободного формата (без orderId) знать
      // это неоткуда — считаем обычным товаром.
      is_weight_item: !!(orderItem && orderItem.is_weight_item && orderItem.weight_confirmed),
    });
  }
  if (cleanItems.length === 0) return res.status(400).json({ error: 'Нет корректных позиций для возврата' });

  const total = cleanItems.reduce((s, it) => s + it.sum, 0);
  const id = db.get('nextReturnId').value();
  const ret = {
    id,
    order_id: order ? order.id : null,
    client_code: finalClientCode,
    client_name: finalClientName,
    sales_id: finalSalesId,
    sales_name: finalSalesName,
    items: cleanItems,
    total,
    reason: (reason || '').trim(),
    refund_cash: Number(refundCash) || 0,
    refund_qr: Number(refundQr) || 0,
    date: date || new Date().toISOString().slice(0, 10),
    created_by_id: req.user.id,
    created_by_name: req.user.name,
    created_at: new Date().toISOString(),
  };
  db.get('returns').push(ret).write();
  db.set('nextReturnId', id + 1).write();

  // Товар физически вернулся на склад — приходуем остаток сразу и напрямую.
  // Весовой товар (is_weight_item): it.qty здесь — кг (см. комментарий на
  // cleanItems выше), а не короба́, поэтому идёт ТОЛЬКО в кг-пул
  // (stock.weight_kg), никогда в stock.qty — форма возврата не спрашивает,
  // сколько именно коробов физически вернулось (частичный по весу возврат
  // необязательно кратен целому коробу), так что короба́ трогать нечем; их
  // при необходимости поправит склад вручную через "Остатки". Раньше при
  // отсутствии настроенного кг-пула (weight_kg===null) кг-число ошибочно
  // прибавлялось прямо в stock.qty, задваивая единицы измерения.
  const stockCol = db.get('stock');
  cleanItems.forEach(it => {
    if (!it.code) return;
    const rec = stockCol.find({ code: it.code }).value();
    if (it.is_weight_item) {
      if (rec) {
        stockCol.find({ code: it.code }).assign({ weight_kg: (rec.weight_kg != null ? Number(rec.weight_kg) : 0) + it.qty }).write();
      } else {
        stockCol.push({ code: it.code, qty: 0, weight_kg: it.qty }).write();
      }
      return;
    }
    if (rec) {
      stockCol.find({ code: it.code }).assign({ qty: (Number(rec.qty) || 0) + it.qty }).write();
    } else {
      stockCol.push({ code: it.code, qty: it.qty }).write();
    }
  });

  res.json(ret);
});

app.delete('/api/returns/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только администратор может удалять возвраты' });
  const id = parseInt(req.params.id);
  const ret = db.get('returns').find({ id }).value();
  if (!ret) return res.status(404).json({ error: 'Возврат не найден' });
  // Откатываем остаток обратно — возврат приходовал его напрямую при
  // создании (см. выше — весовой товар только в кг-пул), удаление должно
  // симметрично списать именно то, что было приходовано.
  const stockCol = db.get('stock');
  (ret.items || []).forEach(it => {
    if (!it.code) return;
    const rec = stockCol.find({ code: it.code }).value();
    if (!rec) return;
    if (it.is_weight_item) {
      if (rec.weight_kg != null) {
        stockCol.find({ code: it.code }).assign({ weight_kg: Math.max(0, Number(rec.weight_kg) - (Number(it.qty) || 0)) }).write();
      }
      return;
    }
    stockCol.find({ code: it.code }).assign({ qty: Math.max(0, (Number(rec.qty) || 0) - (Number(it.qty) || 0)) }).write();
  });
  db.get('returns').remove({ id }).write();
  res.json({ success: true });
});

// ===== ПРИХОД ТОВАРА (журнал; остаток больше НЕ меняет) =====
// По решению владельца приход товара снова оформляется в 1С (менеджером), а
// остаток на сайт приходит через /api/stock/sync — поэтому этот эндпоинт
// больше не трогает stock.qty/weight_kg (иначе один и тот же приход задвоился
// бы: один раз здесь, второй раз — следующим синком из 1С). Оставлен только
// как журнал/история на сайте, на случай если он ещё нужен для отчётности.
db.defaults({ receipts: [], nextReceiptId: 1 }).write();

app.get('/api/receipts', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'warehouse'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  res.json(db.get('receipts').value().slice().reverse());
});

app.post('/api/receipts', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'warehouse'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const { items, supplier, supplierCode, comment, date } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: 'Укажите хотя бы одну позицию прихода' });
  }
  const cleanItems = [];
  for (const it of items) {
    const qty = Number(it.qty) || 0;
    // Для весового товара (короб/тара, а фактический вес — отдельный кг-пул,
    // см. is_weight_item в заявках) приход может прийти и коробами, и кг, и
    // тем и другим сразу — склад мог получить только довес без новых
    // коробов, или наоборот. Для обычного товара короба-поле остаётся
    // единственным количеством, как раньше.
    const weightKg = (it.weightKg !== undefined && it.weightKg !== '' && it.weightKg !== null) ? Number(it.weightKg) : null;
    const name = (it.name || '').trim();
    // Код обязателен — без него нечего увеличивать в остатке (в отличие от
    // возвратов, у прихода нет "свободного формата" без привязки к товару).
    if (!name || !it.code) continue;
    if (qty <= 0 && !(weightKg > 0)) continue;
    cleanItems.push({
      code: it.code,
      name,
      qty,
      weight_kg: weightKg,
      is_weight_item: !!it.isWeightItem,
      purchase_price: (it.purchasePrice !== undefined && it.purchasePrice !== '' && it.purchasePrice !== null) ? Number(it.purchasePrice) : null,
    });
  }
  if (cleanItems.length === 0) return res.status(400).json({ error: 'Нет корректных позиций для прихода' });

  // Остаток этот приход больше не трогает — см. комментарий у db.defaults
  // выше: приход теперь оформляется в 1С, а остаток сайту приходит синком.

  const id = db.get('nextReceiptId').value();
  const receipt = {
    id,
    items: cleanItems,
    supplier: (supplier || '').trim(),
    // Поставщик — необязательная привязка к контрагенту из того же
    // справочника, что и покупатели (см. GET /api/clients): 1С ведёт
    // контрагентов одним списком без разделения ролей. Код сохраняется
    // только если реально выбрали из подсказки — свободный текст (например,
    // разовый поставщик без карточки) остаётся просто строкой без кода.
    supplier_code: supplierCode || '',
    comment: (comment || '').trim(),
    date: date || new Date().toISOString().slice(0, 10),
    created_by_id: req.user.id,
    created_by_name: req.user.name,
    created_at: new Date().toISOString(),
  };
  db.get('receipts').push(receipt).write();
  db.set('nextReceiptId', id + 1).write();
  res.json(receipt);
});

app.delete('/api/receipts/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только администратор может удалять приходы' });
  const id = parseInt(req.params.id);
  const receipt = db.get('receipts').find({ id }).value();
  if (!receipt) return res.status(404).json({ error: 'Приход не найден' });
  // Приход больше не меняет остаток (см. комментарий у db.defaults выше),
  // поэтому удаление записи журнала теперь ничего не откатывает в stock.
  db.get('receipts').remove({ id }).write();
  res.json({ success: true });
});

// ===== СДАЧА НАЛИЧКИ ВОДИТЕЛЕМ (инкассация) =====
// Водитель весь день возит заявки и собирает нал у клиентов "на руки";
// вечером (или в любой момент, если накопилось много) сдаёт её зав.
// складу лично. Раньше на сайте это нигде не фиксировалось — не было
// способа сверить, сколько водитель должен был собрать (это точно известно
// по payment_cash доставленных им заявок) с тем, сколько он реально принёс,
// и часто "недовозили нал" оставалось незамеченным. Модель: водитель
// нажимает "Сдать наличку" — сайт сам считает, сколько за ним ещё числится
// неоприходованной налички (см. computeDriverPendingCash), и создаёт запись
// со статусом "ожидает"; склад (или админ/менеджер) потом вписывает, сколько
// реально принял, и видна разница. Сумма от водителя в API не принимается
// вообще — иначе он мог бы просто прислать число, совпадающее с ожидаемым,
// и вся проверка потеряла бы смысл.
db.defaults({ cashHandovers: [], nextCashHandoverId: 1 }).write();

// Заявки этого водителя, доставленные с получением налички, которая ещё не
// вошла ни в одну сдачу (cash_handover_id не проставлен) — то, что водитель
// физически должен принести складу прямо сейчас.
function computeDriverPendingCash(driverId) {
  const orders = db.get('orders').value();
  const pending = orders.filter(o =>
    o.driver_id === driverId &&
    o.status === 'delivered' &&
    (Number(o.payment_cash) || 0) > 0 &&
    !o.cash_handover_id
  );
  const amount = pending.reduce((s, o) => s + (Number(o.payment_cash) || 0), 0);
  return { amount, orderIds: pending.map(o => o.id) };
}

app.get('/api/cash-handovers', authMiddleware, (req, res) => {
  if (!['admin', 'manager', 'operator', 'warehouse', 'driver'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  let list = db.get('cashHandovers').value();
  // Водитель видит только свои сдачи — полный список (все водители) только
  // у admin/manager/operator/warehouse (склад принимает налику у всех).
  if (req.user.role === 'driver') list = list.filter(h => h.driver_id === req.user.id);
  res.json(list.slice().reverse());
});

app.post('/api/cash-handovers', authMiddleware, (req, res) => {
  if (!['driver', 'admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  let driverId, driverName;
  if (req.user.role === 'driver') {
    driverId = req.user.id;
    driverName = req.user.name;
  } else {
    driverId = Number(req.body.driverId);
    if (!driverId) return res.status(400).json({ error: 'Укажите водителя' });
    const driver = db.get('users').find({ id: driverId }).value();
    if (!driver || driver.role !== 'driver') return res.status(400).json({ error: 'Указанный пользователь не является водителем' });
    driverName = driver.name;
  }

  const { amount, orderIds } = computeDriverPendingCash(driverId);
  if (amount <= 0) {
    return res.status(400).json({ error: 'За водителем нет неоприходованной наличности — сдавать нечего' });
  }

  const id = db.get('nextCashHandoverId').value();
  const handover = {
    id,
    driver_id: driverId,
    driver_name: driverName,
    expected_amount: amount,
    order_ids: orderIds,
    status: 'pending',
    actual_amount: null,
    difference: null,
    comment: '',
    created_by_id: req.user.id,
    created_by_name: req.user.name,
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
  };
  db.get('cashHandovers').push(handover).write();
  db.set('nextCashHandoverId', id + 1).write();

  // Помечаем заявки этой сдачей — при следующей "Сдать наличку" этого же
  // водителя они уже не попадут в pending повторно (см.
  // computeDriverPendingCash).
  const ordersCol = db.get('orders');
  orderIds.forEach(oid => ordersCol.find({ id: oid }).assign({ cash_handover_id: id }).write());

  res.json(handover);
});

app.put('/api/cash-handovers/:id/confirm', authMiddleware, (req, res) => {
  if (!['warehouse', 'admin', 'manager'].includes(req.user.role)) {
    return res.status(403).json({ error: 'Нет доступа' });
  }
  const id = parseInt(req.params.id);
  const handover = db.get('cashHandovers').find({ id }).value();
  if (!handover) return res.status(404).json({ error: 'Сдача не найдена' });
  if (handover.status === 'confirmed') return res.status(400).json({ error: 'Эта сдача уже подтверждена' });
  const actualAmount = Number(req.body.actualAmount);
  if (!(actualAmount >= 0)) return res.status(400).json({ error: 'Укажите сумму, которую реально принял склад' });

  db.get('cashHandovers').find({ id }).assign({
    status: 'confirmed',
    actual_amount: actualAmount,
    difference: actualAmount - handover.expected_amount,
    comment: (req.body.comment || '').trim(),
    confirmed_by_id: req.user.id,
    confirmed_by_name: req.user.name,
    confirmed_at: new Date().toISOString(),
  }).write();
  res.json(db.get('cashHandovers').find({ id }).value());
});

app.delete('/api/cash-handovers/:id', authMiddleware, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Только администратор может удалять сдачи налички' });
  const id = parseInt(req.params.id);
  const handover = db.get('cashHandovers').find({ id }).value();
  if (!handover) return res.status(404).json({ error: 'Сдача не найдена' });
  // Возвращаем заявки в "неоприходованные" — иначе эта наличность зависнет
  // навсегда, не попадая ни в одну сдачу.
  const ordersCol = db.get('orders');
  (handover.order_ids || []).forEach(oid => ordersCol.find({ id: oid }).assign({ cash_handover_id: null }).write());
  db.get('cashHandovers').remove({ id }).write();
  res.json({ success: true });
});

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
  };
  db.get('sales').push(sale).write();
  db.set('nextSaleId', id + 1).write();

  // Продажа кассы — мгновенная (не как заявка, у неё нет статуса "едет"),
  // товар физически ушёл с прилавка прямо сейчас, поэтому остаток
  // списываем сразу и напрямую (см. также PUT /api/orders/:id/status —
  // там то же самое, но в момент доставки).
  const stockCol = db.get('stock');
  cleanItems.forEach(it => {
    if (!it.code) return;
    const rec = stockCol.find({ code: it.code }).value();
    if (rec) stockCol.find({ code: it.code }).assign({ qty: Math.max(0, (Number(rec.qty) || 0) - it.qty) }).write();
  });

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

  // Продажа списала остаток напрямую при создании (см. POST /api/sales) —
  // отмена должна симметрично вернуть его обратно. Ранняя проверка
  // "sale.status === 'voided'" выше не даёт сделать это дважды по одной
  // и той же продаже.
  const stockCol = db.get('stock');
  (sale.items || []).forEach(it => {
    if (!it.code) return;
    const rec = stockCol.find({ code: it.code }).value();
    if (rec) stockCol.find({ code: it.code }).assign({ qty: (Number(rec.qty) || 0) + (Number(it.qty) || 0) }).write();
  });

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
  console.log(`🚀 Сервер ЖАЙЫК АКТАУ запущен на порту ${PORT} (режим: ${NODE_ENV}${IS_PRODUCTION ? ', боевой' : ''})`);
});
