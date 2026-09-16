// Подсветка товаров, у которых закупка поменялась после того, как цену
// продажи (price1/2/3) в последний раз смотрели — владелец попросил, чтобы
// менеджер/старший торговый не забывал поднять цену продажи вслед за
// закупкой (см. price_reviewed_cost/price_needs_review в buildProductRow,
// server.js). Флаг живёт только на "Товарах" — на резерв/остаток не влияет.
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, seedProduct } = require('./helpers');

const PORT = 4122;
let server;
let adminToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
});

test.after(() => server.stop());

async function getProduct(code) {
  const products = await apiCall(server.baseUrl, 'GET', '/api/products');
  return products.find(p => p.code === code);
}

test('приход с новой закупочной ценой подсвечивает товар как требующий проверки цены', async () => {
  await seedProduct(server.baseUrl, adminToken, { code: 'PR1', name: 'Товар', price: 2000, qty: 10 });
  // price1 и cost в одном запросе — как реально отправляет форма "Товары"
  // при сохранении карточки (см. saveAlias на фронте): это и есть момент,
  // когда цену продажи посмотрели под текущую закупку.
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'PR1', price1: 2000, cost: 1350 }, adminToken);

  let p = await getProduct('PR1');
  assert.equal(p.price_needs_review, false, 'сразу после сохранения цены под текущую закупку флага быть не должно');

  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'PR1', qty: 5, price: 1400 }] }, adminToken);

  p = await getProduct('PR1');
  assert.equal(p.cost, 1400);
  assert.equal(p.price_needs_review, true, 'закупка выросла с 1350 до 1400 — цену продажи не пересматривали, должен появиться флаг');
  assert.equal(p.price_reviewed_cost, 1350, 'должна остаться видна старая (просмотренная) закупка для сравнения');
});

test('повторное сохранение price1 через "Товары" снимает флаг', async () => {
  await seedProduct(server.baseUrl, adminToken, { code: 'PR2', name: 'Товар 2', price: 2000, qty: 10 });
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'PR2', price1: 2000, cost: 1000 }, adminToken);
  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'PR2', qty: 5, price: 1100 }] }, adminToken);

  let p = await getProduct('PR2');
  assert.equal(p.price_needs_review, true);

  // Менеджер посмотрел на карточку и заново сохранил price1 (пусть даже с тем же числом)
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'PR2', price1: 2200 }, adminToken);

  p = await getProduct('PR2');
  assert.equal(p.price_needs_review, false, 'после повторного сохранения price1 закупка считается просмотренной заново');
  assert.equal(p.price_reviewed_cost, 1100);
});

test('ручная правка закупки на "Товарах" без price1 тоже подсвечивает товар', async () => {
  await seedProduct(server.baseUrl, adminToken, { code: 'PR3', name: 'Товар 3', price: 500, qty: 10 });
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'PR3', price1: 500, cost: 300 }, adminToken);

  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'PR3', cost: 350 }, adminToken);

  const p = await getProduct('PR3');
  assert.equal(p.price_needs_review, true, 'закупку поправили руками без пересмотра price1 — тоже должно подсветиться');
});

test('товар без цены продажи (price1 не задан) флагом не помечается', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/products/sync', {
    secret: require('./helpers').SYNC_SECRET, items: [{ code: 'PR4', name: 'Без цены', unit: 'кор' }],
  });
  await apiCall(server.baseUrl, 'POST', '/api/product-aliases', { code: 'PR4', cost: 100 }, adminToken);
  await apiCall(server.baseUrl, 'POST', '/api/stock-receipts', { items: [{ code: 'PR4', qty: 5, price: 150 }] }, adminToken);

  const p = await getProduct('PR4');
  assert.equal(p.price1, null);
  assert.equal(p.price_needs_review, false, 'без выставленной цены продажи флаг "пересмотрите цену" бессмыслен');
});
