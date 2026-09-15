// Номенклатура, созданная на сайте, без 1С (см. POST/GET /api/products-web).
// Ключевой регресс, как и у clients-web: /api/products/sync (полная
// замена коллекции `products` из 1С) не трогает `productsWeb` — иначе
// сайтовый товар терялся бы при ближайшем синке. Сайтовый товар слит в
// общий каталог (GET /api/products) тем же способом, что и сайтовые
// контрагенты — сразу доступен для заказа/прихода/списания, но с
// остатком 0, пока для него не оформят "Поступление" (см.
// stock-receipts.test.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, SYNC_SECRET } = require('./helpers');

const PORT = 4111;
let server;
let adminToken, managerToken, salesToken, driverToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  managerToken = await login(server.baseUrl, 'manager1');
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
});

test.after(() => server.stop());

test('admin создаёт товар — получает код WEBP-000001', async () => {
  const rec = await apiCall(server.baseUrl, 'POST', '/api/products-web', {
    name: 'Мука в/с 25кг', unit: 'кор', barcode: '4870000000012', category: 'Бакалея',
  }, adminToken);
  assert.equal(rec.code, 'WEBP-000001');
  assert.equal(rec.name, 'Мука в/с 25кг');
  assert.equal(rec.unit, 'кор');
  assert.equal(rec.archived, false);
  assert.equal(rec.created_by_name, 'Администратор');
});

test('manager создаёт следующий товар — код инкрементируется', async () => {
  const rec = await apiCall(server.baseUrl, 'POST', '/api/products-web', {
    name: 'Сахар 1кг', unit: 'шт',
  }, managerToken);
  assert.equal(rec.code, 'WEBP-000002');
  assert.equal(rec.barcode, '');
  assert.equal(rec.created_by_name, 'Айгуль Нурова');
});

test('sales/driver — нет доступа (403)', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/products-web', { name: 'X', unit: 'шт' }, salesToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'GET', '/api/products-web', undefined, driverToken),
    (err) => err.status === 403
  );
});

test('обязательные поля: без наименования/ед. измерения — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/products-web', { name: '', unit: 'шт' }, adminToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/products-web', { name: 'Есть имя', unit: '' }, adminToken),
    (err) => err.status === 400
  );
});

test('единица измерения — только из фиксированного списка, свободный текст отклоняется', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/products-web', { name: 'Тест единицы', unit: 'коробка' }, adminToken),
    (err) => err.status === 400
  );
  const rec = await apiCall(server.baseUrl, 'POST', '/api/products-web', { name: 'Тест единицы 2', unit: 'уп' }, adminToken);
  assert.equal(rec.unit, 'уп');
});

test('GET /api/products-web возвращает все созданные записи', async () => {
  const list = await apiCall(server.baseUrl, 'GET', '/api/products-web', undefined, managerToken);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 2);
  assert.ok(list.some(p => p.code === 'WEBP-000001'));
});

test('/api/products/sync (полная замена из 1С) не стирает productsWeb, и сайтовый товар слит в GET /api/products с остатком 0', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/products/sync', {
    secret: SYNC_SECRET,
    items: [{ code: 'P900', name: 'Товар из 1С', unit: 'кор', price: 500 }],
  });
  const list = await apiCall(server.baseUrl, 'GET', '/api/products-web', undefined, adminToken);
  assert.ok(list.some(p => p.code === 'WEBP-000001'), 'сайтовый товар должен пережить синк из 1С');

  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.ok(products.some(p => p.code === 'P900'), '/api/products/sync продолжает работать как раньше');
  const webProduct = products.find(p => p.code === 'WEBP-000001');
  assert.ok(webProduct, 'сайтовый товар теперь виден в общем каталоге заказа, как и контрагенты');
  assert.equal(webProduct.name, 'Мука в/с 25кг');
  assert.equal(webProduct.stock, 0, 'остатка ещё нет — товар ни разу не приходовали');
});

test('поступление по сайтовому товару поднимает его остаток в общем каталоге', async () => {
  const rec = await apiCall(server.baseUrl, 'POST', '/api/products-web', { name: 'Товар для прихода', unit: 'кор' }, adminToken);
  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: rec.code, qty: 12 }] }, adminToken);
  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === rec.code).stock, 12);
});
