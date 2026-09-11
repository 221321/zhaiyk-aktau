// Аннулирование уже ДОСТАВЛЕННОЙ заявки (PUT /api/orders/:id/annul) — по
// просьбе владельца: админ может полностью отменить заявку, даже если она
// уже доставлена, одним действием — остаток возвращается на склад, а
// долг/касса/бонус торгового перестают её учитывать (см. комментарий у
// самого эндпоинта в server.js).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProducts, createOrder, deliverOrder, SYNC_SECRET, TINY_PNG } = require('./helpers');

const PORT = 4109;
let server;
let admin, sales, driver, manager;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  admin = await login(server.baseUrl, 'admin');
  sales = await login(server.baseUrl, 'sales1');
  driver = await login(server.baseUrl, 'driver1');
  manager = await login(server.baseUrl, 'manager1');
});

test.after(() => server.stop());

test('annul — возвращает остаток на склад, обнуляет бонус, убирает заявку из долгов', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A1', name: 'Товар A1', price: 100, qty: 100, commission: 7 }]);
  // commission на позиции — для sales-заявки это то, что прислал сам
  // фронт (в отличие от store-заявки, где сервер сам подставляет из
  // карточки товара, см. POST /api/orders), поэтому указываем явно, иначе
  // commission_total у заявки будет 0 и до аннулирования не от чего
  // отличать "обнулили".
  const order = await createOrder(server.baseUrl, sales, {
    items: [{ code: 'A1', name: 'Товар A1', qty: 10, price: 100, commission: 7 }],
  });
  // Часть суммы в долг — чтобы проверить, что после аннулирования заявка
  // пропадает из "Должников".
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 700, qr: 0, debt: 300 });

  const delivered = await apiCall(server.baseUrl, 'GET', `/api/orders`, undefined, admin).then(list => list.find(o => o.id === order.id));
  assert.equal(delivered.status, 'delivered');
  assert.ok((delivered.commission_total || 0) > 0, 'до аннулирования у заявки должен быть ненулевой бонус');

  const debtsBefore = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, admin);
  assert.ok(debtsBefore.some(d => d.order_id === order.id), 'заявка с долгом должна быть видна в "Должниках" до аннулирования');

  const annulled = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'Клиент отказался постфактум' }, admin);
  assert.equal(annulled.status, 'annulled');
  assert.equal(annulled.commission_total, 0, 'бонус торгового обнулён');
  assert.equal(annulled.annul_reason, 'Клиент отказался постфактум');
  assert.ok(annulled.annulled_by_id, 'зафиксировано, кто аннулировал');

  const debtsAfter = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, admin);
  assert.ok(!debtsAfter.some(d => d.order_id === order.id), 'после аннулирования заявка не должна числиться в "Должниках"');

  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, admin);
  const a1 = products.find(p => p.code === 'A1');
  assert.equal(a1.stock_raw, 100, 'остаток вернулся на склад целиком (100 - 10 + 10)');
});

test('annul — доступно только admin', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A2', name: 'Товар A2', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A2', name: 'Товар A2', qty: 5, price: 100 }] });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 500, qr: 0, debt: 0 });

  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'проверка доступа' }, manager),
    (err) => err.status === 403
  );
});

test('annul — нельзя аннулировать заявку не в статусе "Доставлено"', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A3', name: 'Товар A3', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A3', name: 'Товар A3', qty: 5, price: 100 }] });

  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'проверка статуса' }, admin),
    (err) => err.status === 400
  );
});

test('annul — требует причину', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A4', name: 'Товар A4', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A4', name: 'Товар A4', qty: 5, price: 100 }] });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 500, qr: 0, debt: 0 });

  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: '' }, admin),
    (err) => err.status === 400
  );
});

test('annul — повторно аннулировать уже аннулированную заявку нельзя', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A5', name: 'Товар A5', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A5', name: 'Товар A5', qty: 5, price: 100 }] });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 500, qr: 0, debt: 0 });

  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'первое аннулирование' }, admin);
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'второе аннулирование' }, admin),
    (err) => err.status === 400
  );
});

test('annul — блокируется, если долг по заявке уже частично погашен', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A6', name: 'Товар A6', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A6', name: 'Товар A6', qty: 5, price: 100 }] });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 0, qr: 0, debt: 500 });
  await apiCall(server.baseUrl, 'POST', '/api/debts/settle', { orderId: order.id, amount: 200, method: 'cash' }, admin);

  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'проверка долга' }, admin),
    (err) => err.status === 400
  );
});

test('annul — блокируется, если наличка по заявке уже в подтверждённой сдаче', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A7', name: 'Товар A7', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A7', name: 'Товар A7', qty: 5, price: 100 }] });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 500, qr: 0, debt: 0 });

  const handover = await apiCall(server.baseUrl, 'POST', '/api/cash-handovers', {}, driver);
  await apiCall(server.baseUrl, 'PUT', `/api/cash-handovers/${handover.id}/confirm`, { actualAmount: 500 }, admin);

  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'проверка сдачи' }, admin),
    (err) => err.status === 400
  );
});

test('annul — наличка в НЕподтверждённой сдаче автоматически вынимается из неё', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A8', name: 'Товар A8', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A8', name: 'Товар A8', qty: 5, price: 100 }] });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 500, qr: 0, debt: 0 });

  const handover = await apiCall(server.baseUrl, 'POST', '/api/cash-handovers', {}, driver);
  assert.equal(handover.expected_amount, 500);

  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'клиент отказался' }, admin);

  const handovers = await apiCall(server.baseUrl, 'GET', '/api/cash-handovers', undefined, admin);
  // Заявка была единственной в сдаче — сдача должна была исчезнуть целиком,
  // а не остаться зависшей с нулевой суммой.
  assert.ok(!handovers.some(h => h.id === handover.id), 'пустая после изъятия единственной заявки сдача удаляется');
});

test('annul — аннулированную заявку нельзя удалить (история аннулирования остаётся)', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A10', name: 'Товар A10', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, { items: [{ code: 'A10', name: 'Товар A10', qty: 5, price: 100 }] });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 500, qr: 0, debt: 0 });
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'проверка удаления' }, admin);

  await assert.rejects(
    apiCall(server.baseUrl, 'DELETE', `/api/orders/${order.id}`, undefined, admin),
    (err) => err.status === 400
  );
});

test('annul — весовой товар возвращается в кг-пул', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'A9', name: 'Товар A9 (весовой)', price: 100, qty: 20, pricedByWeight: true }]);
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', { secret: SYNC_SECRET, items: [{ code: 'A9', qty: 30 }] });

  const order = await createOrder(server.baseUrl, sales, {
    items: [{ code: 'A9', name: 'Товар A9 (весовой)', qty: 5, boxes: 1, price: 100, is_weight_item: true }],
  });
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'in_transit' }, driver);
  // Весовой товар: вес подтверждает склад/админ (см. POST
  // /api/orders/weights — в тестовом харнессе нет отдельного пользователя
  // warehouse, используем admin, он тоже допущен).
  await apiCall(server.baseUrl, 'POST', '/api/orders/weights', { entries: [{ orderId: order.id, code: 'A9', weight: 5 }] }, admin);
  await apiCall(server.baseUrl, 'POST', `/api/orders/${order.id}/photo`, { imageBase64: TINY_PNG }, driver);
  await apiCall(server.baseUrl, 'POST', `/api/orders/${order.id}/cash-photo`, { imageBase64: TINY_PNG }, driver);
  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/status`, { status: 'delivered', payment: { cash: 500, qr: 0, debt: 0 } }, driver);

  await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/annul`, { reason: 'проверка веса' }, admin);

  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, admin);
  const a9 = products.find(p => p.code === 'A9');
  assert.equal(a9.stock_weight_kg, 30, 'кг-остаток вернулся к значению до доставки');
});
