// Два разных контракта синка с 1С, которые легко перепутать:
// - /api/stock/sync — 1С может прислать НЕ полный снимок, а только
//   изменившиеся коды, поэтому это upsert (пропавший код не трогаем);
// - /api/products/sync — ВСЕГДА полный снимок каталога (db.set), поэтому
//   пропавший код = 1С его удалил, остаток обнуляем.
// Регресс на обе жалобы: "остаток висит после удаления в 1С" (было
// исправлено раньше) и "в 1С 50 позиций, на сайте 52" (дедуп кода).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, SYNC_SECRET } = require('./helpers');

const PORT = 4105;
let server;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
});

test.after(() => server.stop());

test('stock/sync — частичный пакет НЕ обнуляет коды, которых нет в этом пакете', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/products/sync', { secret: SYNC_SECRET, items: [{ code: 'A1', name: 'Товар A', unit: 'кор', price: 100 }, { code: 'A2', name: 'Товар B', unit: 'кор', price: 200 }] });
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', { secret: SYNC_SECRET, items: [{ code: 'A1', qty: 10 }, { code: 'A2', qty: 20 }] });
  // Следующий пакет содержит только A1 — A2 не должен обнулиться
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', { secret: SYNC_SECRET, items: [{ code: 'A1', qty: 99 }] });

  const products = await apiCall(server.baseUrl, 'GET', '/api/products');
  assert.equal(products.find(p => p.code === 'A1').stock, 99);
  assert.equal(products.find(p => p.code === 'A2').stock, 20, 'код, отсутствующий в конкретном пакете stock/sync, не должен обнуляться');
});

test('products/sync — исчезновение кода из полного снимка обнуляет его остаток', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/products/sync', { secret: SYNC_SECRET, items: [{ code: 'B1', name: 'Товар', unit: 'кор', price: 100 }] });
  await apiCall(server.baseUrl, 'POST', '/api/stock/sync', { secret: SYNC_SECRET, items: [{ code: 'B1', qty: 50 }] });

  let products = await apiCall(server.baseUrl, 'GET', '/api/products');
  assert.equal(products.find(p => p.code === 'B1').stock, 50);

  // Новый полный снимок каталога БЕЗ B1 — товар удалили в 1С
  const res = await apiCall(server.baseUrl, 'POST', '/api/products/sync', { secret: SYNC_SECRET, items: [] });
  assert.equal(res.removed, 1);

  products = await apiCall(server.baseUrl, 'GET', '/api/products');
  assert.equal(products.find(p => p.code === 'B1'), undefined, 'товар пропал из каталога вместе с 1С');

  // Если код заведут заново в 1С — остаток должен быть 0, а не старые 50
  await apiCall(server.baseUrl, 'POST', '/api/products/sync', { secret: SYNC_SECRET, items: [{ code: 'B1', name: 'Товар', unit: 'кор', price: 100 }] });
  products = await apiCall(server.baseUrl, 'GET', '/api/products');
  assert.equal(products.find(p => p.code === 'B1').stock, 0, 'старый остаток не должен вернуться вместе с кодом');
});

test('products/sync — дубль кода в одном пакете не создаёт вторую позицию', async () => {
  const res = await apiCall(server.baseUrl, 'POST', '/api/products/sync', {
    secret: SYNC_SECRET,
    items: [
      { code: 'C1', name: 'Старое имя', unit: 'кор', price: 100 },
      { code: 'C1', name: 'Новое имя', unit: 'кор', price: 150 },
    ],
  });
  assert.equal(res.duplicates, 1);
  assert.equal(res.count, 1);

  const products = await apiCall(server.baseUrl, 'GET', '/api/products');
  const matches = products.filter(p => p.code === 'C1');
  assert.equal(matches.length, 1, 'код не должен показываться дважды');
  assert.equal(matches[0].name, 'Новое имя', 'должна победить последняя запись в присланном пакете');
});
