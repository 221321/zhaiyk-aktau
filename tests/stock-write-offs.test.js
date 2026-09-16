// Списание товара на сайте без 1С (см. POST/GET /api/stock-write-offs) —
// зеркало "Поступления": возврат поставщику или порча/брак, товар уходит
// со склада не через продажу. Возврат ОТ клиента (см. POST /api/returns)
// увеличивает остаток и уже работает отдельно — здесь наоборот.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, SYNC_SECRET } = require('./helpers');

const PORT = 4113;
let server;
let adminToken, managerToken, salesToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  managerToken = await login(server.baseUrl, 'manager1');
  salesToken = await login(server.baseUrl, 'sales1');

  await apiCall(server.baseUrl, 'POST', '/api/products/sync', {
    secret: SYNC_SECRET,
    items: [
      { code: 'W1', name: 'Мука в/с', unit: 'кор', price: 1000 },
      { code: 'W2', name: 'Курица тушка', unit: 'кор', price: 2000 },
    ],
  });
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'W2', priced_by_weight: true }, adminToken);
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', { secret: SYNC_SECRET, items: [{ code: 'W1', qty: 20 }] });
  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'W2', qty: 50 }] }, adminToken);
});

test.after(() => server.stop());

test('manager списывает возврат поставщику — остаток уменьшается', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', {
    reason: 'supplier_return', doc_number: 'ВЗ-1', items: [{ code: 'W1', qty: 5, price: 900 }],
  }, managerToken);
  assert.equal(wo.items[0].qty, 5);
  assert.equal(wo.items[0].line_total, 4500);
  assert.equal(wo.total, 4500);
  assert.equal(wo.created_by_name, 'Айгуль Нурова');

  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === 'W1').stock, 15, '20 - 5 = 15');
});

test('списание весового товара уменьшает weight_kg', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', {
    reason: 'damage', items: [{ code: 'W2', qty: 10 }],
  }, adminToken);
  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === 'W2').stock_weight_kg, 40, '50 - 10 = 40');
});

test('нельзя списать больше, чем есть на складе', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'other', items: [{ code: 'W1', qty: 999 }] }, adminToken),
    (err) => err.status === 400
  );
  // Остаток не должен был измениться при отказе
  const products = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(products.find(p => p.code === 'W1').stock, 15);
});

test('некорректная/отсутствующая причина — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'wat', items: [{ code: 'W1', qty: 1 }] }, adminToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { items: [{ code: 'W1', qty: 1 }] }, adminToken),
    (err) => err.status === 400
  );
});

test('sales — нет доступа (403)', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'other', items: [{ code: 'W1', qty: 1 }] }, salesToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'GET', '/api/stock-write-offs', undefined, salesToken),
    (err) => err.status === 403
  );
});

test('GET /api/stock-write-offs возвращает историю', async () => {
  const list = await apiCall(server.baseUrl, 'GET', '/api/stock-write-offs', undefined, managerToken);
  assert.ok(Array.isArray(list));
  assert.ok(list.some(w => w.doc_number === 'ВЗ-1'));
});

test('поставщик (контрагент) — сохраняется вместе с кодом, необязателен', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', {
    reason: 'supplier_return', supplier: 'ИП Тестовый', supplier_code: 'WEB-000005', items: [{ code: 'W1', qty: 1 }],
  }, adminToken);
  assert.equal(wo.supplier, 'ИП Тестовый');
  assert.equal(wo.supplier_code, 'WEB-000005');

  const woNoSupplier = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', {
    reason: 'damage', items: [{ code: 'W1', qty: 1 }],
  }, adminToken);
  assert.equal(woNoSupplier.supplier, '');
  assert.equal(woNoSupplier.supplier_code, null);
});

// ===== ПРАВКА И АННУЛИРОВАНИЕ (только admin) =====

test('manager не может править или аннулировать списание (403)', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'other', items: [{ code: 'W1', qty: 1 }] }, adminToken);
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}`, { items: [{ code: 'W1', qty: 2 }], reason: 'тест' }, managerToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}/annul`, { reason: 'тест' }, managerToken),
    (err) => err.status === 403
  );
});

test('admin увеличивает количество в списании — остаток списывается ещё на разницу', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'other', items: [{ code: 'W1', qty: 2 }] }, adminToken);
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const w1Before = before.find(p => p.code === 'W1').stock;

  const updated = await apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}`, {
    items: [{ code: 'W1', qty: 5 }], reason: 'ошиблись количеством',
  }, adminToken);
  assert.equal(updated.items[0].qty, 5);
  assert.equal(updated.edited_by_name, 'Администратор');

  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'W1').stock, w1Before - 3, 'было списано 2, стало 5 — остаток должен уменьшиться ещё на разницу (3)');
});

test('admin уменьшает количество в списании — остаток возвращается на разницу', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'other', items: [{ code: 'W1', qty: 5 }] }, adminToken);
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const w1Before = before.find(p => p.code === 'W1').stock;

  await apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}`, {
    items: [{ code: 'W1', qty: 2 }], reason: 'списали больше, чем нужно было',
  }, adminToken);

  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'W1').stock, w1Before + 3, 'было списано 5, стало 2 — остаток должен вернуться на разницу (3)');
});

test('admin убирает позицию из списания — остаток по ней возвращается полностью', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', {
    reason: 'other', items: [{ code: 'W1', qty: 2 }, { code: 'W2', qty: 3 }],
  }, adminToken);
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const w2Before = before.find(p => p.code === 'W2').stock_weight_kg;

  await apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}`, {
    items: [{ code: 'W1', qty: 2 }], reason: 'лишняя позиция',
  }, adminToken);

  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'W2').stock_weight_kg, w2Before + 3);
});

test('нельзя увеличить списание сверх того, что реально есть на складе', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'other', items: [{ code: 'W1', qty: 1 }] }, adminToken);
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}`, { items: [{ code: 'W1', qty: 999999 }], reason: 'тест' }, adminToken),
    (err) => err.status === 400
  );
});

test('редактирование списания без причины — 400', async () => {
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'other', items: [{ code: 'W1', qty: 1 }] }, adminToken);
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}`, { items: [{ code: 'W1', qty: 2 }] }, adminToken),
    (err) => err.status === 400
  );
});

test('admin аннулирует списание — остаток возвращается полностью, повторно нельзя', async () => {
  // Пополняем остаток перед этим тестом — предыдущие тесты в файле уже
  // насписывали W1 почти в ноль, а само списание здесь не про остаток, а
  // про откат уже проведённого документа.
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', { secret: SYNC_SECRET, items: [{ code: 'W1', qty: 100 }] });
  const wo = await apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', { reason: 'damage', items: [{ code: 'W1', qty: 4 }] }, adminToken);
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const w1Before = before.find(p => p.code === 'W1').stock;

  const annulled = await apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}/annul`, { reason: 'ошиблись документом' }, adminToken);
  assert.equal(annulled.voided, true);
  assert.equal(annulled.voided_by_name, 'Администратор');

  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'W1').stock, w1Before + 4);

  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}/annul`, { reason: 'опять' }, adminToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/stock-write-offs/${wo.id}`, { items: [{ code: 'W1', qty: 1 }], reason: 'после аннулирования' }, adminToken),
    (err) => err.status === 400
  );
});

test('один код дважды в одном списании — сверяется СУММА, не каждая строка отдельно', async () => {
  const before = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  const w1Before = before.find(p => p.code === 'W1').stock;
  // Каждая строка по отдельности <= остатка, но вместе — больше:
  // раньше обе строки проходили бы валидацию против одного и того же
  // неизменного "have", уводя остаток в минус.
  const halfPlus = Math.ceil(w1Before / 2) + 1;
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/stock-write-offs', {
      reason: 'other', items: [{ code: 'W1', qty: halfPlus }, { code: 'W1', qty: halfPlus }],
    }, adminToken),
    (err) => err.status === 400
  );
  const after = await apiCall(server.baseUrl, 'GET', '/api/products', undefined, adminToken);
  assert.equal(after.find(p => p.code === 'W1').stock, w1Before, 'отказ должен быть целиком, остаток не должен был измениться ни на часть');
});
