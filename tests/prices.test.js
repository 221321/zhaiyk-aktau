// Свободная правка цены — только admin, до статуса "Доставлено" включительно
// (см. PUT /api/orders/:id/prices). Регресс-тест на жалобу "админ не может
// редактировать цену": на момент написания сервер работает корректно, этот
// файл фиксирует ожидаемое поведение на будущее.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct, createOrder, deliverOrder } = require('./helpers');

const PORT = 4102;
let server;
let salesToken, driverToken, adminToken, managerToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
  adminToken = await login(server.baseUrl, 'admin');
  managerToken = await login(server.baseUrl, 'manager1');
  await seedProduct(server.baseUrl, adminToken, { code: 'P001', name: 'Мука', qty: 100, price: 1000 });
});

test.after(() => server.stop());

test('manager не может менять цену — только admin', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/prices`, { items: [{ code: 'P001', price: 700 }] }, managerToken),
    (err) => err.status === 403
  );
});

test('admin может поставить любую цену на заявке в статусе "Ожидает" — без привязки к каталогу', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/prices`, { items: [{ code: 'P001', price: 1 }] }, adminToken);
  assert.equal(res.items[0].price, 1);
  assert.equal(res.total, 10);
});

test('отрицательная цена отклоняется', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/prices`, { items: [{ code: 'P001', price: -5 }] }, adminToken),
    (err) => err.status === 400
  );
});

test('цену можно менять и после доставки, пока это не отменённая/возвращённая заявка', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 10000, qr: 0, debt: 0 });
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/prices`, { items: [{ code: 'P001', price: 1200 }], reason: 'VIP клиент' }, adminToken);
  assert.equal(res.total, 12000);
  assert.equal(res.payment_mismatch, true, 'оплата (10000) больше не совпадает с новой суммой (12000) — фронт должен получить сигнал');
  assert.ok(Array.isArray(res.items_edits) && res.items_edits.length === 1);
  assert.equal(res.items_edits[0].reason, 'VIP клиент');
});

test('после revoked цену менять нельзя', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'revoked' }, salesToken);
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/prices`, { items: [{ code: 'P001', price: 500 }] }, adminToken),
    (err) => err.status === 400
  );
});
