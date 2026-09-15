// Закупочная цена, установленная ПОСЛЕ того, как товар уже фигурировал в
// заявках/продажах — донаполняется в старые записи, где cost ещё не был
// указан (см. backfillMissingCostInPlace в server.js), иначе отчёт
// "Касса"/"Отчёт" честно, но неприятно ругается "нет закупочной цены" на
// товар, у которого закупка давно стоит на карточке (owner жаловался).
// Позиции, где cost уже был зафиксирован — НЕ трогаем (не едем задним
// числом по уже посчитанной сумме, см. комментарий у getCostMap).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct, createOrder, deliverOrder } = require('./helpers');

const PORT = 4118;
let server;
let adminToken, salesToken, driverToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
});

test.after(() => server.stop());

test('установка закупочной цены задним числом донаполняет старые заявки без cost', async () => {
  await seedProduct(server.baseUrl, adminToken, { code: 'B1', name: 'Товар без закупки', price: 1500, qty: 50 });

  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'B1', name: 'Товар без закупки', qty: 2, price: 1500 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 3000, qr: 0, debt: 0 });

  const before = await apiCall(server.baseUrl, 'GET', '/api/orders', undefined, adminToken);
  assert.equal(before.find(o => o.id === order.id).items[0].cost, null, 'закупки ещё не было — cost должен быть пуст');

  // Только теперь заводим закупочную цену на карточке товара
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'B1', cost: 900 }, adminToken);

  const after = await apiCall(server.baseUrl, 'GET', '/api/orders', undefined, adminToken);
  assert.equal(after.find(o => o.id === order.id).items[0].cost, 900, 'закупка задним числом должна была донаполниться в уже закрытую заявку');
});

test('уже указанный cost не перезаписывается новой закупкой', async () => {
  await seedProduct(server.baseUrl, adminToken, { code: 'B2', name: 'Товар с закупкой', price: 1000, qty: 50 });
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'B2', cost: 500 }, adminToken);

  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'B2', name: 'Товар с закупкой', qty: 1, price: 1000 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 1000, qr: 0, debt: 0 });

  const before = await apiCall(server.baseUrl, 'GET', '/api/orders', undefined, adminToken);
  assert.equal(before.find(o => o.id === order.id).items[0].cost, 500);

  // Меняем закупку — уже посчитанная заявка не должна "поплыть"
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'B2', cost: 700 }, adminToken);

  const after = await apiCall(server.baseUrl, 'GET', '/api/orders', undefined, adminToken);
  assert.equal(after.find(o => o.id === order.id).items[0].cost, 500, 'cost уже был зафиксирован — новая закупка не должна его перезаписать');
});

test('приход с ценой тоже донаполняет старые заявки без cost', async () => {
  await seedProduct(server.baseUrl, adminToken, { code: 'B3', name: 'Товар через приход', price: 800, qty: 50 });

  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'B3', name: 'Товар через приход', qty: 3, price: 800 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 2400, qr: 0, debt: 0 });

  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'B3', qty: 10, price: 300 }] }, adminToken);

  const after = await apiCall(server.baseUrl, 'GET', '/api/orders', undefined, adminToken);
  assert.equal(after.find(o => o.id === order.id).items[0].cost, 300);
});
