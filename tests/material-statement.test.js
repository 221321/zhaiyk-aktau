// Отчёт "Ведомость" (GET /api/reports/material-statement) — приход/расход/
// остаток за период по товару, без контрагентов, как материальная ведомость
// в 1С (просьба владельца). Строится по stockLedger — проверяем, что
// приход (sync) и расход (доставка) правильно попадают в свои столбцы и
// арифметика сходится: opening + income - outcome === closing.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProducts, createOrder, deliverOrder, SYNC_SECRET } = require('./helpers');

const PORT = 4106;
let server;
let admin, sales, driver;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  admin = await login(server.baseUrl, 'admin');
  sales = await login(server.baseUrl, 'sales1');
  driver = await login(server.baseUrl, 'driver1');
});

test.after(() => server.stop());

test('material-statement — приход (sync) и расход (доставка) считаются раздельно, арифметика сходится', async () => {
  await seedProducts(server.baseUrl, admin, [
    { code: 'M1', name: 'Товар M1', price: 100, qty: 100 },
    { code: 'M2', name: 'Товар без движения', price: 50, qty: 0 },
  ]);

  const order = await createOrder(server.baseUrl, sales, {
    items: [{ code: 'M1', name: 'Товар M1', qty: 10, price: 100 }],
  });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 1000, qr: 0, debt: 0 });

  const today = new Date().toISOString().slice(0, 10);
  const rows = await apiCall(server.baseUrl, 'GET', `/api/reports/material-statement?from=${today}&to=${today}`, undefined, admin);

  const m1 = rows.find(r => r.code === 'M1');
  assert.ok(m1, 'M1 должен быть в отчёте');
  assert.equal(m1.income, 100, 'приход = то, что пришло синком из 1С');
  assert.equal(m1.outcome, 10, 'расход = то, что списала доставка');
  assert.equal(m1.closing, 90, 'остаток на конец = текущий физический остаток');
  assert.equal(m1.opening + m1.income - m1.outcome, m1.closing, 'начальный + приход - расход = конечный');

  const m2 = rows.find(r => r.code === 'M2');
  assert.ok(m2, 'товар без движения тоже должен попасть в отчёт');
  assert.equal(m2.income, 0);
  assert.equal(m2.outcome, 0);
  assert.equal(m2.opening, 0);
  assert.equal(m2.closing, 0);
});

test('material-statement — отрицательная корректировка остатка синком из 1С не считается расходом', async () => {
  // Воспроизводит реальный случай: 1С прислала остаток ниже, чем на сайте
  // (потому что в 1С реализация ещё не проведена) — это не физическая
  // продажа, поэтому "Расход" не должен её учитывать, а разница уходит в
  // отдельное поле correction (см. computeMaterialStatementRows).
  await seedProducts(server.baseUrl, admin, [{ code: 'M3', name: 'Товар M3', price: 100, qty: 100 }]);
  const order = await createOrder(server.baseUrl, sales, {
    items: [{ code: 'M3', name: 'Товар M3', qty: 10, price: 100 }],
  });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 1000, qr: 0, debt: 0 });
  // Остаток на сайте сейчас 90 (100 - 10 доставленных). 1С досчиталась и
  // прислала гораздо более низкий остаток — 20 — не потому что кто-то ещё
  // продал 70, а потому что в 1С не были проведены другие реализации.
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', {
    secret: SYNC_SECRET,
    items: [{ code: 'M3', qty: 20 }],
  });

  const today = new Date().toISOString().slice(0, 10);
  const rows = await apiCall(server.baseUrl, 'GET', `/api/reports/material-statement?from=${today}&to=${today}`, undefined, admin);

  const m3 = rows.find(r => r.code === 'M3');
  assert.ok(m3, 'M3 должен быть в отчёте');
  assert.equal(m3.outcome, 10, 'расход — только реальная доставка, корректировка 1С в него не идёт');
  assert.equal(m3.correction, -70, 'корректировка синком (1С прислала на 70 меньше) видна отдельно');
  assert.equal(m3.closing, 20, 'конечный остаток — фактический, каким его прислала 1С');
  assert.equal(m3.opening + m3.income - m3.outcome + m3.correction, m3.closing, 'начальный + приход - расход + корректировка = конечный');
});

test('material-statement — за пределами доступа роль sales/driver видеть не может', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'GET', '/api/reports/material-statement', undefined, sales),
    (err) => err.status === 403
  );
});
