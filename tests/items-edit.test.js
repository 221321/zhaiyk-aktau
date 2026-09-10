// Правка состава заявки в статусе "Ожидает" (PUT /api/orders/:id/items) —
// добавлена вместо "отозвать и создать заново". Проверяем именно то, что
// раньше ловили вручную curl-ом: доступ, лимиты остатка с учётом
// собственного резерва заявки, блокировку вне статуса "new".
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProducts, createOrder } = require('./helpers');

const PORT = 4103;
let server;
let sales1Token, sales2Token, driverToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  sales1Token = await login(server.baseUrl, 'sales1');
  sales2Token = await login(server.baseUrl, 'sales2');
  driverToken = await login(server.baseUrl, 'driver1');
  const adminToken = await login(server.baseUrl, 'admin');
  await seedProducts(server.baseUrl, adminToken, [
    { code: 'P001', name: 'Мука', qty: 100, price: 1000 },
    { code: 'P002', name: 'Сахар', qty: 50, price: 500 },
    // Отдельный код для теста на "собственный резерв не мешает" ниже — если
    // бы он делил P001 с другими тестами, их заявки уже съели бы часть
    // остатка, и "можно увеличить вплоть до полного физического остатка"
    // перестало бы быть true просто из-за порядка тестов в файле.
    { code: 'P003', name: 'Соль', qty: 20, price: 300 },
  ]);
});

test.after(() => server.stop());

test('чужой торговый не может править заявку', async () => {
  const order = await createOrder(server.baseUrl, sales1Token, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, { items: [{ code: 'P001', name: 'Мука', qty: 5, price: 1000, commission: 5 }] }, sales2Token),
    (err) => err.status === 403
  );
});

test('владелец может уменьшить позицию и добавить новую', async () => {
  const order = await createOrder(server.baseUrl, sales1Token, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, {
    items: [
      { code: 'P001', name: 'Мука', qty: 4, price: 1000, commission: 5 },
      { code: 'P002', name: 'Сахар', qty: 2, price: 500, commission: 5 },
    ],
  }, sales1Token);
  assert.equal(res.total, 4000 + 1000);
  assert.equal(res.items.length, 2);
});

test('нельзя запросить больше, чем физически доступно (за вычетом резерва других заявок)', async () => {
  const order = await createOrder(server.baseUrl, sales1Token, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, { items: [{ code: 'P001', name: 'Мука', qty: 1000, price: 1000, commission: 5 }] }, sales1Token),
    /Недостаточно остатка/
  );
});

test('собственный резерв заявки не мешает ей самой — можно увеличить позицию вплоть до полного физического остатка', async () => {
  const order = await createOrder(server.baseUrl, sales1Token, { items: [{ code: 'P003', name: 'Соль', qty: 5, price: 300, commission: 5 }] });
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, { items: [{ code: 'P003', name: 'Соль', qty: 20, price: 300, commission: 5 }] }, sales1Token);
  assert.equal(res.items[0].qty, 20);
});

test('после взятия в доставку правка недоступна', async () => {
  const order = await createOrder(server.baseUrl, sales1Token, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'in_transit' }, driverToken);
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, { items: [{ code: 'P001', name: 'Мука', qty: 1, price: 1000, commission: 5 }] }, sales1Token),
    (err) => err.status === 400
  );
});

test('после "вернуть в очередь" правка снова доступна', async () => {
  const order = await createOrder(server.baseUrl, sales1Token, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'in_transit' }, driverToken);
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'new' }, driverToken);
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, { items: [{ code: 'P001', name: 'Мука', qty: 3, price: 1000, commission: 5 }] }, sales1Token);
  assert.equal(res.items[0].qty, 3);
});
