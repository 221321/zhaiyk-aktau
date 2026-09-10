// Построчная лента движения товара (GET /api/products/:code/ledger) —
// "было / пришло / списалось / стало" одно событие на строку, замена
// прежнему списку заявок одной строкой текста без приходов из 1С.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProducts, createOrder, deliverOrder } = require('./helpers');

const PORT = 4108;
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

test('product ledger — приход и расход построчно, с правильным остатком после каждого события', async () => {
  await seedProducts(server.baseUrl, admin, [{ code: 'L1', name: 'Товар L1', price: 100, qty: 50 }]);
  const order = await createOrder(server.baseUrl, sales, {
    items: [{ code: 'L1', name: 'Товар L1', qty: 12, price: 100 }],
  });
  await deliverOrder(server.baseUrl, driver, order.id, { cash: 1200, qr: 0, debt: 0 });

  const data = await apiCall(server.baseUrl, 'GET', '/api/products/L1/ledger', undefined, admin);
  assert.equal(data.entries.length, 2, 'приход (сидинг) + расход (доставка) = 2 события');

  const [first, second] = data.entries;
  assert.equal(first.income, 50, 'первое событие — приход при сидинге');
  assert.equal(first.outcome, 0);
  assert.equal(first.balance_after, 50);
  assert.ok(first.label.includes('Синхронизация'));

  assert.equal(second.income, 0);
  assert.equal(second.outcome, 12, 'второе событие — расход при доставке');
  assert.equal(second.balance_after, 38);
  assert.ok(second.label.includes('Доставка'));
  assert.ok(second.label.includes(String(order.id)));
});

test('product ledger — для товара без движений возвращает пустой список, не ошибку', async () => {
  const data = await apiCall(server.baseUrl, 'GET', '/api/products/NOPE/ledger', undefined, admin);
  assert.deepEqual(data.entries, []);
});
