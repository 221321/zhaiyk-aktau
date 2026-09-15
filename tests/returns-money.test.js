// Возврат должен реально задевать деньги, а не только остаток:
// - refund_debt уменьшает долг клиента (через ту же debtSettlements, что и
//   ручное погашение, см. POST /api/debts/settle) — раньше возврат вообще
//   не трогал долг, клиент продолжал числиться должным полную сумму.
// - refund_cash уменьшает то, что водитель должен сдать в кассу (см.
//   computeDriverPendingCash) — раньше водитель "должен был" сдать
//   наличку, которую уже отдал клиенту обратно при возврате.
// - сумма возврата (нал+QR+долг) не может быть больше стоимости самих
//   возвращаемых позиций.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct, createOrder, deliverOrder } = require('./helpers');

const PORT = 4114;
let server;
let salesToken, driverToken, adminToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
  adminToken = await login(server.baseUrl, 'admin');
  await seedProduct(server.baseUrl, adminToken, { code: 'RM1', name: 'Мука', qty: 1000, price: 1000 });
});

test.after(() => server.stop());

test('возврат с refund_debt уменьшает долг клиента в GET /api/debts', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { clientName: 'Должник 1', clientCode: 'DEBT1', items: [{ code: 'RM1', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 0, qr: 0, debt: 10000 });

  let debts = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, adminToken);
  let d = debts.find(x => x.order_id === order.id);
  assert.equal(d.remaining, 10000);

  // Вернули 2 из 10 коробок (по 1000 ₸) — списываем долгом
  await apiCall(server.baseUrl, 'POST', '/api/returns', {
    orderId: order.id, items: [{ code: 'RM1', name: 'Мука', qty: 2, price: 1000 }], refundDebt: 2000,
  }, driverToken);

  debts = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, adminToken);
  d = debts.find(x => x.order_id === order.id);
  assert.equal(d.remaining, 8000, 'долг должен уменьшиться на сумму возврата');
});

test('нельзя списать долгом больше, чем реально остаётся должен клиент', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { clientName: 'Должник 2', clientCode: 'DEBT2', items: [{ code: 'RM1', name: 'Мука', qty: 5, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 0, qr: 0, debt: 5000 });

  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/returns', {
      orderId: order.id, items: [{ code: 'RM1', name: 'Мука', qty: 5, price: 1000 }], refundDebt: 999999,
    }, driverToken),
    (err) => err.status === 400
  );
});

test('сумма возврата (нал+QR+долг) не может быть больше стоимости позиций', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { clientName: 'Клиент 3', clientCode: 'CL3', items: [{ code: 'RM1', name: 'Мука', qty: 5, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 5000, qr: 0, debt: 0 });

  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/returns', {
      orderId: order.id, items: [{ code: 'RM1', name: 'Мука', qty: 1, price: 1000 }], refundCash: 5000,
    }, driverToken),
    (err) => err.status === 400
  );
});

test('удаление возврата с refund_debt возвращает долг обратно', async () => {
  const order = await createOrder(server.baseUrl, salesToken, { clientName: 'Должник 4', clientCode: 'DEBT4', items: [{ code: 'RM1', name: 'Мука', qty: 4, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 0, qr: 0, debt: 4000 });

  const ret = await apiCall(server.baseUrl, 'POST', '/api/returns', {
    orderId: order.id, items: [{ code: 'RM1', name: 'Мука', qty: 2, price: 1000 }], refundDebt: 2000,
  }, driverToken);

  let debts = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, adminToken);
  assert.equal(debts.find(x => x.order_id === order.id).remaining, 2000);

  await apiCall(server.baseUrl, 'DELETE', `/api/returns/${ret.id}`, undefined, adminToken);

  debts = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, adminToken);
  assert.equal(debts.find(x => x.order_id === order.id).remaining, 4000, 'после удаления возврата долг должен вернуться к исходному');
});

test('refund_cash уменьшает наличку, которую водитель должен сдать', async () => {
  // Сбрасываем всё, что накопилось за предыдущие тесты этого файла на общем
  // сервере (тот же водитель) — иначе pending cash от чужих заявок собьёт
  // ожидаемую сумму именно этого теста.
  try { await apiCall(server.baseUrl, 'POST', '/api/cash-handovers', {}, driverToken); } catch (e) {}

  const order = await createOrder(server.baseUrl, salesToken, { clientName: 'Клиент 5', clientCode: 'CL5', items: [{ code: 'RM1', name: 'Мука', qty: 10, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 10000, qr: 0, debt: 0 });

  await apiCall(server.baseUrl, 'POST', '/api/returns', {
    orderId: order.id, items: [{ code: 'RM1', name: 'Мука', qty: 3, price: 1000 }], refundCash: 3000,
  }, driverToken);

  const handover = await apiCall(server.baseUrl, 'POST', '/api/cash-handovers', {}, driverToken);
  assert.equal(handover.expected_amount, 7000, 'водитель отдал 3000 клиенту обратно — должен сдать на 3000 меньше');
});

test('возврат без orderId (свободный формат) — refund_debt запрещён (нет заявки, долг списывать не с чего)', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/returns', {
      clientCode: 'FREE1', clientName: 'Свободный клиент', items: [{ name: 'Товар', qty: 1, price: 500 }], refundDebt: 100,
    }, adminToken),
    (err) => err.status === 400
  );
});
