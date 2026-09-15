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
  // Остаток с большим запасом — этот файл создаёт много заявок/продаж по P001
  // на одном сервере без сброса стока между тестами.
  await seedProduct(server.baseUrl, adminToken, { code: 'P001', name: 'Мука', qty: 100000, price: 1000 });
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

// Раньше при ОФОРМЛЕНИИ заявки (POST /api/orders) цена позиции бралась из
// того, что прислал клиент, без всякой проверки — торговый или менеджер
// мог подставить в price что угодно. Правка выше (PUT .../prices) остаётся
// единственным способом свободно назначить цену, и доступна только admin —
// значит и при создании заявки price должен браться из каталога (price1),
// а не из тела запроса, для всех ролей кроме admin.
test('торговый не может назначить произвольную цену при создании заявки — сервер подставляет цену из каталога', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1, commission: 5 }] });
  assert.equal(order.items[0].price, 1000);
  assert.equal(order.total, 10000);
});

test('manager не может назначить произвольную цену при создании заявки — сервер подставляет цену из каталога', async () => {
  const order = await createOrder(server.baseUrl, managerToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1, commission: 5 }] });
  assert.equal(order.items[0].price, 1000);
  assert.equal(order.total, 10000);
});

test('total заявки при создании всегда считается от позиций, а не берётся из запроса', async () => {
  const order = await apiCall(server.baseUrl, 'POST', '/api/orders', {
    clientName: 'Тестовый клиент', clientCode: 'CL1', address: 'г. Актау', timeSlot: 'До обеда (09:00 – 14:00)',
    items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }],
    total: 1, // подделанный итог — не совпадает с 10×1000
    paymentCash: 0, paymentQr: 0, paymentDebt: 0, comment: '', contactName: 'Тест', contactPhone: '87001112233',
  }, salesToken);
  assert.equal(order.total, 10000);
});

test('admin может назначить цену свободно уже при создании заявки', async () => {
  const order = await createOrder(server.baseUrl, adminToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1, commission: 5 }] });
  assert.equal(order.items[0].price, 1);
  assert.equal(order.total, 10);
});

test('торговый не может назначить произвольную цену при правке состава уже оформленной заявки', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, {
    items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1, commission: 5 }],
  }, salesToken);
  assert.equal(res.items[0].price, 1000);
  assert.equal(res.total, 10000);
});

// Комиссия (бонус сотруднику за единицу товара) — та же проблема, что и с
// ценой: раньше бралась из того, что прислал фронт, и торговый мог сам себе
// завысить бонус (см. enforceCatalogCommission). Она всегда из каталога,
// без исключения даже для admin — свободно её никто не назначает.
test('торговый не может завысить свою комиссию при создании заявки', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 999 }] });
  assert.equal(order.items[0].commission, 5);
  assert.equal(order.commission_total, 50);
});

test('торговый не может завысить свою комиссию при правке состава заявки', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  const res = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, {
    items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 999 }],
  }, salesToken);
  assert.equal(res.items[0].commission, 5);
  assert.equal(res.commission_total, 50);
});

// POST /api/sales (продажа с кассы) — та же дыра: кассир/менеджер мог
// вписать в чек любую цену позиции, сервер не сверял её с каталогом.
test('менеджер не может назначить произвольную цену в продаже с кассы (POST /api/sales)', async () => {
  // Оплата указана по РЕАЛЬНОЙ (каталожной) цене — сервер должен подставить
  // именно её вместо присланной price:1, иначе сумма оплаты не совпала бы.
  const sale = await apiCall(server.baseUrl, 'POST', '/api/sales', {
    items: [{ code: 'P001', name: 'Мука', qty: 2, price: 1 }],
    paymentCash: 2000, paymentQr: 0, paymentDebt: 0,
  }, managerToken);
  assert.equal(sale.items[0].price, 1000);
  assert.equal(sale.total, 2000);
});

test('admin может назначить цену свободно в продаже с кассы', async () => {
  const sale = await apiCall(server.baseUrl, 'POST', '/api/sales', {
    items: [{ code: 'P001', name: 'Мука', qty: 2, price: 1 }],
    paymentCash: 2, paymentQr: 0, paymentDebt: 0,
  }, adminToken);
  assert.equal(sale.items[0].price, 1);
  assert.equal(sale.total, 2);
});

// POST /api/returns — водитель мог вписать в возврат по заявке любую цену
// (влияет на сумму возврата/долг), сервер не сверял её ни с заявкой, ни с
// каталогом.
test('водитель не может завысить цену возврата по заявке — берётся цена самой заявки', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { items: [{ code: 'P001', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 10000, qr: 0, debt: 0 });
  const ret = await apiCall(server.baseUrl, 'POST', '/api/returns', {
    orderId: order.id,
    items: [{ code: 'P001', name: 'Мука', qty: 1, price: 1 }],
    refundCash: 1,
  }, driverToken);
  assert.equal(ret.items[0].price, 1000);
  assert.equal(ret.total, 1000);
});

test('менеджер не может назначить произвольную цену возврата без заявки — цена из каталога', async () => {
  const ret = await apiCall(server.baseUrl, 'POST', '/api/returns', {
    clientName: 'Тестовый клиент',
    items: [{ code: 'P001', name: 'Мука', qty: 1, price: 1 }],
    refundCash: 1,
  }, managerToken);
  assert.equal(ret.items[0].price, 1000);
  assert.equal(ret.total, 1000);
});
