// Базовый жизненный цикл заявки: создание резервирует остаток, доставка
// списывает его окончательно. Это самый частый путь в приложении — если он
// сломан, сломано всё остальное, поэтому он идёт первым тестовым файлом.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct, createOrder, deliverOrder } = require('./helpers');

const PORT = 4101;
let server;
let salesToken, driverToken, adminToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
  adminToken = await login(server.baseUrl, 'admin');
  await seedProduct(server.baseUrl, adminToken, { code: 'P001', name: 'Мука', qty: 100, price: 1000 });
});

test.after(() => server.stop());

test('создание заявки резервирует остаток, но не списывает его', async () => {
  await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  const products = await apiCall(server.baseUrl, 'GET', '/api/products');
  const p = products.find(x => x.code === 'P001');
  assert.equal(p.stock, 90, 'доступно должно уменьшиться на зарезервированное кол-во');
  assert.equal(p.stock_raw, 100, 'физический остаток (из 1С) резерв не трогает');
});

test('нельзя заказать больше, чем доступно с учётом резерва', async () => {
  await assert.rejects(
    createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 1000, price: 1000, commission: 5 }] }),
    /Недостаточно остатка/
  );
});

test('доставка списывает остаток окончательно и снимает резерв', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 5, price: 1000, commission: 5 }] });
  const delivered = await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 5000, qr: 0, debt: 0 });
  assert.equal(delivered.status, 'delivered');
  assert.ok(delivered.delivered_at, 'время фактической доставки должно записаться');

  const products = await apiCall(server.baseUrl, 'GET', '/api/products');
  const p = products.find(x => x.code === 'P001');
  // 100 физических - 10 (первая заявка, всё ещё new) - 5 (эта, уже доставлена и списана) = 85 доступно
  assert.equal(p.stock, 85);
  assert.equal(p.stock_raw, 95, 'физический остаток уменьшился ровно на доставленное');
});

test('доставку нельзя подтвердить без фото оплаты наличными', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 1, price: 1000, commission: 5 }] });
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'in_transit' }, driverToken);
  await apiCall(server.baseUrl, 'POST', `/api/orders/${order.id}/photo`, { imageBase64: require('./helpers').TINY_PNG }, driverToken);
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'delivered', payment: { cash: 1000, qr: 0, debt: 0 } }, driverToken),
    /наличност/
  );
});
