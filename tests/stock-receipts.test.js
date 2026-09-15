// Поступление товара на сайте без 1С (см. POST/GET /api/stock-receipts).
// Менеджер заносит приход по накладной — прибавляет к тому же stock.qty/
// weight_kg, что и /api/stock/sync, доставка, продажа и возврат (см.
// комментарий у computeAvailableStock в server.js), поэтому новый остаток
// сразу виден в обычном каталоге (GET /api/products) без отдельного сведения.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, SYNC_SECRET } = require('./helpers');

const PORT = 4112;
let server;
let adminToken, managerToken, salesToken, driverToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  managerToken = await login(server.baseUrl, 'manager1');
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');

  await apiCall(server.baseUrl, 'POST', '/api/products/sync', {
    secret: SYNC_SECRET,
    items: [
      { code: 'R1', name: 'Мука в/с', unit: 'кор', price: 1000 },
      { code: 'R2', name: 'Курица тушка', unit: 'кор', price: 2000 },
    ],
  });
  // R2 — весовой товар (см. priced_by_weight в productAliases)
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'R2', priced_by_weight: true }, adminToken);
});

test.after(() => server.stop());

test('manager заносит приход — остаток прибавляется, а не заменяется', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', { secret: SYNC_SECRET, items: [{ code: 'R1', qty: 10 }] });

  const receipt = await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', {
    doc_number: 'НВ-001', supplier: 'ИП Поставщик', date: '2026-09-15',
    items: [{ code: 'R1', qty: 5 }],
  }, managerToken);
  assert.equal(receipt.items[0].qty, 5);
  assert.equal(receipt.created_by_name, 'Айгуль Нурова');

  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === 'R1').stock, 15, 'приход должен ПРИБАВИТЬСЯ к уже бывшему остатку (10+5), а не заменить его');
});

test('цена по позиции — считает сумму строки и итог по накладной, но не трогает цену продажи в каталоге', async () => {
  const receipt = await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', {
    doc_number: 'НВ-002',
    items: [{ code: 'R1', qty: 3, price: 900 }],
  }, managerToken);
  assert.equal(receipt.items[0].price, 900);
  assert.equal(receipt.items[0].line_total, 2700);
  assert.equal(receipt.total, 2700);

  // Цена продажи (price1 из product-aliases) не должна была измениться от прихода
  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const r1 = products.find(p => p.code === 'R1');
  assert.notEqual(r1.price1, 900, 'цена прихода — это не цена продажи, они не связаны');
  // Зато закупочная цена (cost) в карточке товара должна обновиться на цену этого прихода
  assert.equal(r1.cost, 900, 'цена прихода должна стать последней закупочной ценой в карточке товара');
});

test('следующий приход с другой ценой перезаписывает закупочную цену — побеждает последняя', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'R1', qty: 1, price: 1100 }] }, adminToken);
  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === 'R1').cost, 1100);
});

test('приход без цены — цена и суммы нулевые, поведение как раньше', async () => {
  const receipt = await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', {
    items: [{ code: 'R1', qty: 2 }],
  }, adminToken);
  assert.equal(receipt.items[0].price, 0);
  assert.equal(receipt.items[0].line_total, 0);
  assert.equal(receipt.total, 0);
});

test('отрицательная цена — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'R1', qty: 1, price: -5 }] }, adminToken),
    (err) => err.status === 400
  );
});

test('приход весового товара идёт в weight_kg, а не в qty', async () => {
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const stockBefore = before.find(p => p.code === 'R2').stock_weight_kg || 0;

  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', {
    items: [{ code: 'R2', qty: 40 }],
  }, adminToken);

  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'R2').stock_weight_kg, stockBefore + 40);
});

test('новый товар без записи в stock — приход создаёт запись с нуля', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/products/sync', {
    secret: SYNC_SECRET,
    items: [
      { code: 'R1', name: 'Мука в/с', unit: 'кор', price: 1000 },
      { code: 'R2', name: 'Курица тушка', unit: 'кор', price: 2000 },
      { code: 'R3', name: 'Сахар', unit: 'кор', price: 500 },
    ],
  });
  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'R3', qty: 7 }] }, managerToken);
  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === 'R3').stock, 7);
});

test('sales/driver — нет доступа (403)', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'R1', qty: 1 }] }, salesToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'GET', '/api/stock-receipts', undefined, driverToken),
    (err) => err.status === 403
  );
});

test('нет позиций — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [] }, adminToken),
    (err) => err.status === 400
  );
});

test('код не из каталога — 400, ничего не применяется', async () => {
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const r1Before = before.find(p => p.code === 'R1').stock;

  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'R1', qty: 5 }, { code: 'NOPE', qty: 1 }] }, adminToken),
    (err) => err.status === 400
  );

  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'R1').stock, r1Before, 'при ошибке во второй строке первая не должна была примениться');
});

test('некорректное количество (0 или отрицательное) — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'R1', qty: 0 }] }, adminToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'R1', qty: -3 }] }, adminToken),
    (err) => err.status === 400
  );
});

test('GET /api/stock-receipts возвращает историю приходов', async () => {
  const list = await apiCall(server.baseUrl, 'GET', '/api/stock-receipts', undefined, managerToken);
  assert.ok(Array.isArray(list));
  assert.ok(list.some(r => r.doc_number === 'НВ-001'));
});
