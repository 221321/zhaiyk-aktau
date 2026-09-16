// GET /api/debts — точное время доставки (delivered_at) на карточке
// должника, по просьбе владельца: когда у одного клиента несколько
// накладных на разные дни/часы, одной даты заявки не хватало, чтобы их
// не путать между собой.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct, createOrder, deliverOrder, SYNC_SECRET } = require('./helpers');

const PORT = 4121;
let server;
let salesToken, driverToken, adminToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
  adminToken = await login(server.baseUrl, 'admin');
  await seedProduct(server.baseUrl, adminToken, { code: 'DB1', name: 'Товар', qty: 100, price: 1000 });
  await apiCall(server.baseUrl, 'POST', '/api/clients/sync', {
    secret: SYNC_SECRET, items: [{ code: 'TIMECL1', name: 'Клиент Времени' }],
  });
});

test.after(() => server.stop());

test('долг по заявке содержит delivered_at — реальный момент доставки', async () => {
  const before = new Date();
  const order = await createOrder(server.baseUrl, salesToken, { clientName: 'Клиент Времени', clientCode: 'TIMECL1', items: [{ code: 'DB1', name: 'Товар', qty: 2, price: 1000, commission: 5 }] });
  await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 0, qr: 0, debt: 2000 });
  const after = new Date();

  const debts = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, adminToken);
  const d = debts.find(x => x.order_id === order.id);
  assert.ok(d, 'долг по заявке должен быть в списке');
  assert.ok(d.delivered_at, 'delivered_at должен быть заполнен сразу при доставке');
  const deliveredAt = new Date(d.delivered_at);
  assert.ok(deliveredAt >= before && deliveredAt <= after, 'delivered_at должен соответствовать реальному моменту доставки');
});

test('долг по продаже кассы — delivered_at пуст (доставки не было, продажа мгновенная)', async () => {
  const sale = await apiCall(server.baseUrl, 'POST', '/api/sales', {
    items: [{ code: 'DB1', name: 'Товар', qty: 1, price: 1000 }],
    paymentCash: 0, paymentQr: 0, paymentDebt: 1000, clientCode: 'TIMECL1',
  }, adminToken);
  const debts = await apiCall(server.baseUrl, 'GET', '/api/debts', undefined, adminToken);
  const d = debts.find(x => x.sale_id === sale.id);
  assert.ok(d, 'долг по продаже кассы должен быть в списке');
  assert.equal(d.delivered_at, undefined, 'у продажи кассы нет доставки — поле не должно приходить вовсе');
});
