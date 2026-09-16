// Самовывоз (time_slot === "Самовывоз") — клиент забирает товар сам, без
// водителя (см. isPickupOrder в PUT /api/orders/:id/status). Владелец
// решил, что бонус торговому за такую заявку не начисляется вообще (см.
// enforceCatalogCommission в server.js) — раньше комиссия фиксировалась
// как обычно, и в отчёте "По торговым представителям" самовывоз давал
// такой же бонус, как обычная доставка (жалоба владельца).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct, createOrder, deliverOrder } = require('./helpers');

const PORT = 4123;
let server;
let adminToken, salesToken, driverToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
  await seedProduct(server.baseUrl, adminToken, { code: 'PK1', name: 'Товар', price: 1000, qty: 50, commission: 50 });
});

test.after(() => server.stop());

test('заявка с самовывозом — комиссия на позиции сразу 0', async () => {
  const order = await createOrder(server.baseUrl, salesToken, {
    timeSlot: 'Самовывоз',
    items: [{ code: 'PK1', name: 'Товар', qty: 3, price: 1000, commission: 50 }],
  });
  assert.equal(order.commission_total, 0, 'при самовывозе итоговая комиссия заявки должна быть 0, даже если клиент прислал 50');
  const items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items;
  assert.equal(items[0].commission, 0, 'комиссия на самой позиции должна быть обнулена, а не только в сумме');
});

test('обычная заявка (не самовывоз) — комиссия начисляется как обычно', async () => {
  const order = await createOrder(server.baseUrl, salesToken, {
    timeSlot: 'До обеда (09:00 – 14:00)',
    items: [{ code: 'PK1', name: 'Товар', qty: 3, price: 1000 }],
  });
  assert.equal(order.commission_total, 150, '3 × 50 ₸ — комиссия должна начислиться как обычно');
});

test('самовывоз остаётся без комиссии и после доставки (delivered пересчитывает commission_total из позиций)', async () => {
  const order = await createOrder(server.baseUrl, salesToken, {
    timeSlot: 'Самовывоз',
    items: [{ code: 'PK1', name: 'Товар', qty: 2, price: 1000 }],
  });
  const delivered = await deliverOrder(server.baseUrl, driverToken, order.id, { cash: 2000, qr: 0, debt: 0 });
  assert.equal(delivered.commission_total, 0, 'после доставки самовывоза комиссия всё ещё должна быть 0');
});

test('правка состава заявки-самовывоза (PUT /api/orders/:id/items) не возвращает комиссию', async () => {
  const order = await createOrder(server.baseUrl, salesToken, {
    timeSlot: 'Самовывоз',
    items: [{ code: 'PK1', name: 'Товар', qty: 1, price: 1000 }],
  });
  const edited = await apiCall(server.baseUrl, 'PUT', `/api/orders/${order.id}/items`, {
    items: [{ code: 'PK1', name: 'Товар', qty: 4, price: 1000, commission: 999 }],
  }, salesToken);
  assert.equal(edited.commission_total, 0, 'правка состава не должна протащить ненулевую комиссию для самовывоза');
});
