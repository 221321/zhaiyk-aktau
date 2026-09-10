// Общий харнесс для автотестов (см. TESTING.md) — поднимает реальный
// server.js как отдельный процесс с изолированной базой (DB_PATH) и папкой
// загрузок (UPLOADS_DIR) во временной директории, чтобы тесты не трогали
// боевой db.json/uploads и не мешали друг другу. Тестируем через настоящий
// HTTP, а не подключаемся к внутренностям сервера напрямую — так же, как
// реально ходит браузер, и не нужно ничего мокать.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const SECRET = 'test_jwt_secret';
const SYNC_SECRET = 'test_sync_secret';

// Сидовые аккаунты — те же самые, что server.js сам создаёт в db.defaults()
// на пустой базе (см. server.js). Пароли те же, что в проде на новой базе.
const USERS = {
  sales1: { login: 'torgoviy1', password: '1234' },
  sales2: { login: 'torgoviy2', password: '1234' },
  driver1: { login: 'voditel1', password: '1234' },
  manager1: { login: 'manager1', password: '1234' },
  admin: { login: 'admin', password: 'admin' },
};

function startServer(port) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'zhaiyk-test-'));
  const dbPath = path.join(tmpDir, 'db.json');
  const uploadsDir = path.join(tmpDir, 'uploads');
  const env = {
    ...process.env,
    PORT: String(port),
    JWT_SECRET: SECRET,
    SYNC_SECRET: SYNC_SECRET,
    DB_PATH: dbPath,
    UPLOADS_DIR: uploadsDir,
    NODE_ENV: 'test',
  };
  const child = spawn(process.execPath, [path.join(__dirname, '..', 'server.js')], {
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let output = '';
  child.stdout.on('data', d => { output += d.toString(); });
  child.stderr.on('data', d => { output += d.toString(); });

  const baseUrl = `http://127.0.0.1:${port}`;

  return {
    baseUrl,
    async waitReady() {
      for (let i = 0; i < 150; i++) {
        if (child.exitCode !== null) {
          throw new Error(`Сервер (порт ${port}) упал при старте:\n${output}`);
        }
        try {
          const res = await fetch(`${baseUrl}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ login: '__ping__', password: '__ping__' }),
          });
          if (res.status) return;
        } catch (e) { /* сервер ещё не слушает порт */ }
        await new Promise(r => setTimeout(r, 100));
      }
      throw new Error(`Сервер (порт ${port}) не поднялся за 15с:\n${output}`);
    },
    stop() {
      child.kill();
      fs.rmSync(tmpDir, { recursive: true, force: true });
    },
  };
}

async function apiCall(baseUrl, method, urlPath, body, token) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(`${baseUrl}${urlPath}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch (e) { data = { raw: text }; }
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

async function login(baseUrl, userKey) {
  const u = USERS[userKey];
  const res = await apiCall(baseUrl, 'POST', '/api/login', { login: u.login, password: u.password });
  return res.token;
}

// 1x1 прозрачный PNG в base64 — достаточно для эндпоинтов, которым нужно
// просто "какое-то фото" (накладная/нал/QR), содержимое не проверяется.
const TINY_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

// Заводит один или несколько товаров с остатком и ценой — то, что нужно
// почти каждому тесту, чтобы не повторять один и тот же бойлерплейт.
// ВАЖНО: все товары уходят в /api/products/sync ОДНИМ вызовом — этот
// эндпоинт всегда полный снимок каталога (см. server.js), и код, которого
// нет в присланном массиве, считается удалённым в 1С (остаток обнуляется).
// Вызвать sync дважды по одному товару в каждом — та же ошибка, что ловили
// на проде: второй вызов "стирает" первый.
async function seedProducts(baseUrl, adminToken, products) {
  await apiCall(baseUrl, 'POST', '/api/products/sync', {
    secret: SYNC_SECRET,
    items: products.map(p => ({ code: p.code, name: p.name, unit: 'кор', price: p.price })),
  });
  await apiCall(baseUrl, 'POST', '/api/stock/sync', {
    secret: SYNC_SECRET,
    items: products.map(p => ({ code: p.code, qty: p.qty })),
  });
  for (const p of products) {
    await apiCall(baseUrl, 'POST', '/api/product-aliases', {
      code: p.code, alias: p.name, price1: p.price, commission: p.commission ?? 5, priced_by_weight: !!p.pricedByWeight,
    }, adminToken);
  }
}

// Обёртка для одного товара — та же семантика, если в файле только один код.
async function seedProduct(baseUrl, adminToken, product) {
  return seedProducts(baseUrl, adminToken, [product]);
}

async function createOrder(baseUrl, salesToken, { clientName = 'Тестовый клиент', clientCode = 'CL1', items, timeSlot = 'До обеда (09:00 – 14:00)' }) {
  const total = items.reduce((s, it) => s + (Number(it.qty) || 0) * (Number(it.price) || 0), 0);
  return apiCall(baseUrl, 'POST', '/api/orders', {
    clientName, clientCode, address: 'г. Актау', timeSlot, items, total,
    paymentCash: 0, paymentQr: 0, paymentDebt: 0, comment: '', contactName: 'Тест', contactPhone: '87001112233',
  }, salesToken);
}

// Проводит заявку от in_transit до delivered (фото накладной + нала +
// смена статуса) — обвязка, которая нужна любому тесту, где заявку нужно
// именно "довезти", а не просто проверить промежуточный статус.
async function deliverOrder(baseUrl, driverToken, orderId, payment) {
  await apiCall(baseUrl, 'PUT', `/api/orders/${orderId}/status`, { status: 'in_transit' }, driverToken);
  await apiCall(baseUrl, 'POST', `/api/orders/${orderId}/photo`, { imageBase64: TINY_PNG }, driverToken);
  if (payment.cash > 0) await apiCall(baseUrl, 'POST', `/api/orders/${orderId}/cash-photo`, { imageBase64: TINY_PNG }, driverToken);
  if (payment.qr > 0) await apiCall(baseUrl, 'POST', `/api/orders/${orderId}/qr-photo`, { imageBase64: TINY_PNG }, driverToken);
  return apiCall(baseUrl, 'PUT', `/api/orders/${orderId}/status`, { status: 'delivered', payment }, driverToken);
}

module.exports = { startServer, apiCall, login, seedProduct, seedProducts, createOrder, deliverOrder, TINY_PNG, SYNC_SECRET };
