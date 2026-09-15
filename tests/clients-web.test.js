// Контрагенты, созданные на сайте, без 1С (см. POST/GET /api/clients-web).
// Ключевой регресс, который здесь проверяется: /api/clients/sync (полная
// замена коллекции `clients` из 1С) не трогает `clientsWeb` — иначе
// сайтовый контрагент терялся бы при ближайшем синке, до того как
// бухгалтер успеет завести его в 1С (см. бриф).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall, SYNC_SECRET } = require('./helpers');

const PORT = 4110;
let server;
let adminToken, managerToken, salesToken, driverToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  managerToken = await login(server.baseUrl, 'manager1');
  salesToken = await login(server.baseUrl, 'sales1');
  driverToken = await login(server.baseUrl, 'driver1');
});

test.after(() => server.stop());

test('admin создаёт контрагента — получает код WEB-000001', async () => {
  const rec = await apiCall(server.baseUrl, 'POST', '/api/clients-web', {
    name: 'ТОО Ромашка', phone: '87001234567', bin: '123456789012', address: 'г. Актау, 1 мкр',
  }, adminToken);
  assert.equal(rec.code, 'WEB-000001');
  assert.equal(rec.name, 'ТОО Ромашка');
  assert.equal(rec.bin, '123456789012');
  assert.equal(rec.archived, false);
  assert.equal(rec.created_by_name, 'Администратор');
});

test('manager создаёт следующего контрагента — код инкрементируется', async () => {
  const rec = await apiCall(server.baseUrl, 'POST', '/api/clients-web', {
    name: 'Асель Жумабекова', phone: '87007654321',
  }, managerToken);
  assert.equal(rec.code, 'WEB-000002');
  assert.equal(rec.created_by_name, 'Айгуль Нурова');
});

test('sales/driver — нет доступа (403)', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/clients-web', { name: 'X', phone: '1' }, salesToken),
    (err) => err.status === 403
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'GET', '/api/clients-web', undefined, driverToken),
    (err) => err.status === 403
  );
});

test('без токена — 401/403', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'GET', '/api/clients-web', undefined, undefined),
    (err) => err.status === 401 || err.status === 403
  );
});

test('обязательные поля: без наименования/телефона — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/clients-web', { name: '', phone: '87001234567' }, adminToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/clients-web', { name: 'Есть имя', phone: '' }, adminToken),
    (err) => err.status === 400
  );
});

test('GET /api/clients-web возвращает все созданные записи', async () => {
  const list = await apiCall(server.baseUrl, 'GET', '/api/clients-web', undefined, managerToken);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 2);
  assert.ok(list.some(c => c.code === 'WEB-000001'));
});

test('/api/clients/sync (полная замена из 1С) не стирает clientsWeb', async () => {
  await apiCall(server.baseUrl, 'POST', '/api/clients/sync', {
    secret: SYNC_SECRET,
    items: [{ code: '00000000177', name: 'Контрагент из 1С' }],
  });
  const list = await apiCall(server.baseUrl, 'GET', '/api/clients-web', undefined, adminToken);
  assert.ok(list.some(c => c.code === 'WEB-000001'), 'сайтовый контрагент должен пережить синк из 1С');

  const clients = await apiCall(server.baseUrl, 'GET', '/api/clients', undefined, adminToken);
  assert.ok(clients.some(c => c.code === '00000000177'), '/api/clients/sync продолжает работать как раньше');
});

test('GET /api/clients включает сайтовых контрагентов — доступны при оформлении заявки/прихода', async () => {
  const clients = await apiCall(server.baseUrl, 'GET', '/api/clients', undefined, adminToken);
  const web = clients.find(c => c.code === 'WEB-000001');
  assert.ok(web, 'сайтовый контрагент должен быть виден в общем списке /api/clients');
  assert.equal(web.name, 'ТОО Ромашка');
  assert.equal(web.is_site_created, true);
});
