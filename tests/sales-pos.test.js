// Продажа с кассы (см. POST/GET /api/sales, POST /api/sales/:id/void).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct } = require('./helpers');

const PORT = 4120;
let server;
let adminToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  await seedProduct(server.baseUrl, adminToken, { code: 'POS1', name: 'Товар кассы', qty: 10, price: 500 });
});

test.after(() => server.stop());

test('обычная продажа списывает остаток', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/sales', {
    items: [{ code: 'POS1', name: 'Товар кассы', qty: 4, price: 500 }],
    paymentCash: 2000, paymentQr: 0, paymentDebt: 0,
  }, adminToken);
  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === 'POS1').stock, 6);
});

test('один код дважды в одной продаже — сверяется СУММА, не каждая строка отдельно', async () => {
  // Остаток сейчас 6. Просим продать 6 ДВУМЯ строками по 4 — по отдельности
  // каждая строка <= 6 (доступно), но вместе это 8, больше остатка. Раньше
  // avail читался один раз до цикла и не убывал построчно — обе строки
  // прошли бы независимо, а фактическое списание (Math.max(0, ...)) тихо
  // обнулило бы остаток, хотя чек пробили бы на полную сумму (8 единиц).
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const stockBefore = before.find(p => p.code === 'POS1').stock;

  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/sales', {
      items: [{ code: 'POS1', name: 'Товар кассы', qty: 4, price: 500 }, { code: 'POS1', name: 'Товар кассы', qty: 4, price: 500 }],
      paymentCash: 4000, paymentQr: 0, paymentDebt: 0,
    }, adminToken),
    (err) => err.status === 400
  );

  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'POS1').stock, stockBefore, 'отклонённая продажа не должна была тронуть остаток вообще');
});
