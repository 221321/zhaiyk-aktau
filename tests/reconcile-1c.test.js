// Сверка с 1С (POST /api/reports/reconcile-1c) — сайт сравнивает собственную
// ведомость (то, что реально доставлено) с расходом, который прислала 1С в
// присланных строках (парсинг xlsx делает браузер, сюда приходит уже
// готовый массив — см. parse1cVedomost в app.jsx). shortfall = сайт минус
// 1С — именно то число, которое подсказывает "1С не досчиталась, сюда не
// хватает остатка, чтобы реализация провелась".
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProducts, createOrder, deliverOrder } = require('./helpers');

const PORT = 4107;
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

test('reconcile-1c — считает shortfall = расход сайта минус расход 1С', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'R1', name: 'Товар R1', price: 100, qty: 100 }]);
  const order = await createOrder(server.baseUrl, sales, {
    items: [{ code: 'R1', name: 'Товар R1', qty: 20, price: 100 }],
  });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 2000, qr: 0, debt: 0 });

  const today = new Date().toISOString().slice(0, 10);
  const result = await apiCall(server.baseUrl, 'POST', '/api/reports/reconcile-1c', {
    from: today,
    to: today,
    rows: [{ code: 'R1', name: 'Товар R1', unit: '', income: 100, outcome: 15 }],
  }, admin);

  const r1 = result.find(r => r.code === 'R1');
  assert.ok(r1, 'R1 должен попасть в список расхождений');
  assert.equal(r1.outcome_site, 20, 'сайт реально списал 20');
  assert.equal(r1.outcome_1c, 15, 'из файла 1С пришло 15');
  assert.equal(r1.shortfall, 5, '1С не досчиталась 5 единиц');
});

test('reconcile-1c — идеальное совпадение не попадает в список расхождений', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'R2', name: 'Товар R2', price: 50, qty: 100 }]);
  const order = await createOrder(server.baseUrl, sales, {
    items: [{ code: 'R2', name: 'Товар R2', qty: 10, price: 50 }],
  });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 500, qr: 0, debt: 0 });

  const today = new Date().toISOString().slice(0, 10);
  const result = await apiCall(server.baseUrl, 'POST', '/api/reports/reconcile-1c', {
    from: today,
    to: today,
    rows: [{ code: 'R2', name: 'Товар R2', unit: '', income: 100, outcome: 10 }],
  }, admin);

  assert.equal(result.find(r => r.code === 'R2'), undefined, 'при полном совпадении строка не должна попасть в расхождения');
});

test('reconcile-1c — пустой список строк из файла отклоняется с понятной ошибкой', async () => {
  const today = new Date().toISOString().slice(0, 10);
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/reports/reconcile-1c', { from: today, to: today, rows: [] }, admin),
    (err) => err.status === 400
  );
});

test('reconcile-1c — доступ только у admin/manager/warehouse', async () => {
  const today = new Date().toISOString().slice(0, 10);
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/reports/reconcile-1c', {
      from: today, to: today, rows: [{ code: 'R1', outcome: 1 }],
    }, sales),
    (err) => err.status === 403
  );
});
