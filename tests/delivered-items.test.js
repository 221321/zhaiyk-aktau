// Регресс-тест на баг из видео (10.09): "Исправить доставленное количество"
// молча срезал любое значение выше исходного обратно к исходному — кнопка
// "Сохранить" отрабатывала без ошибки, но сумма/остаток не менялись.
// Причина была в Math.min(raw, refQty) на фронте + такой же проверке на
// сервере (PUT /api/orders/:id/delivered-items) — обе убраны. Этот файл
// фиксирует, что дальше так не сломается по крайней мере в бэкенде: если
// кто-то вернёт верхний потолок обратно, тест "увеличение выше исходного"
// ниже упадёт.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct, createOrder, deliverOrder } = require('./helpers');

const PORT = 4104;
let server;
let salesToken, driverToken, adminToken, managerToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
  adminToken = await login(server.baseUrl, 'admin');
  managerToken = await login(server.baseUrl, 'manager1');
  await seedProduct(server.baseUrl, adminToken, { code: 'P001', name: 'Мука', qty: 1000, price: 1000 });
});

test.after(() => server.stop());

test('manager не может править доставленное количество — только admin', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 10000, qr: 0, debt: 0 });
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/delivered-items`, { items: [{ code: 'P001', qty: 5 }] }, managerToken),
    (err) => err.status === 403
  );
});

test('можно уменьшить доставленное количество (частичная доставка задним числом)', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 10000, qr: 0, debt: 0 });
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/delivered-items`, { items: [{ code: 'P001', qty: 4 }] }, adminToken);
  assert.equal(res.total, 4000);
  assert.equal(res.items[0].qty, 4);
});

test('РЕГРЕСС: можно увеличить доставленное количество выше исходного (исправление ошибки взвешивания)', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 10000, qr: 0, debt: 0 });

  const before = await apiCall(server.baseUrl, 'GET', '/api/products');
  const stockBefore = before.find(p => p.code === 'P001').stock_raw;

  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/delivered-items`, { items: [{ code: 'P001', qty: 100 }], reason: 'опечатка при взвешивании' }, adminToken);
  assert.equal(res.total, 100000, 'сумма должна пересчитаться на увеличенное количество, а не остаться прежней');
  assert.equal(res.items[0].qty, 100);

  const after = await apiCall(server.baseUrl, 'GET', '/api/products');
  const stockAfter = after.find(p => p.code === 'P001').stock_raw;
  assert.equal(stockBefore - stockAfter, 90, 'со склада должно доп. списаться ровно (100-10)=90');
});
