// Создание/управление учётными записями сотрудников (см. POST/PUT/DELETE
// /api/users) — раньше единственным входом в это API был пикер по уже
// синхронизированному из 1С физлицу (см. /api/employees/sync), теперь
// добавлена "+ Новый сотрудник" — свободная форма без привязки к 1С,
// использующая тот же самый эндпоинт. Ни один из этих тестов не трогает
// employees/1С вовсе — они и раньше были полностью независимы от синка
// физлиц (employee_code на пользователе — необязательное поле, только для
// связки с 1С-ростером в интерфейсе, не для авторизации).
const test = require('node:test');
const assert = require('node:assert/strict');
const { startServer, login, apiCall } = require('./helpers');

const PORT = 4119;
let server;
let adminToken, managerToken, salesToken;

test.before(async () => {
  server = startServer(PORT);
  await server.waitReady();
  adminToken = await login(server.baseUrl, 'admin');
  managerToken = await login(server.baseUrl, 'manager1');
  salesToken = await login(server.baseUrl, 'sales1');
});

test.after(() => server.stop());

test('admin создаёт сотрудника без привязки к 1С (employee_code не передан)', async () => {
  const user = await apiCall(server.baseUrl, 'POST', '/api/users', {
    login: 'new_cashier', password: '1234', name: 'Новый Кассир', role: 'cashier',
  }, adminToken);
  assert.equal(user.login, 'new_cashier');
  assert.equal(user.name, 'Новый Кассир');
  assert.equal(user.role, 'cashier');
  assert.equal(user.active, true);
  assert.equal(user.employee_code, null, 'сотрудник создан не из 1С — employee_code пуст, и это нормально');

  const list = await apiCall(server.baseUrl, 'GET', '/api/users', undefined, adminToken);
  const found = list.find(u => u.login === 'new_cashier');
  assert.ok(found, 'новый сотрудник виден в общем списке пользователей');
  assert.equal(found.employee_code, null);
});

test('manager тоже может создавать сотрудников', async () => {
  const user = await apiCall(server.baseUrl, 'POST', '/api/users', {
    login: 'new_driver', password: '1234', name: 'Новый Водитель', role: 'driver',
  }, managerToken);
  assert.equal(user.role, 'driver');
});

test('sales — нет доступа (403)', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/users', { login: 'x', password: '1234', name: 'X', role: 'driver' }, salesToken),
    (err) => err.status === 403
  );
});

test('дубль логина — 400, существующий аккаунт не портится', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/users', { login: 'new_cashier', password: '5678', name: 'Другое Имя', role: 'admin' }, adminToken),
    (err) => err.status === 400
  );
  const list = await apiCall(server.baseUrl, 'GET', '/api/users', undefined, adminToken);
  const still = list.find(u => u.login === 'new_cashier');
  assert.equal(still.name, 'Новый Кассир', 'дубль логина не должен был перезаписать существующего сотрудника');
  assert.equal(still.role, 'cashier');
});

test('короткий пароль — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/users', { login: 'short_pwd', password: '12', name: 'X', role: 'driver' }, adminToken),
    (err) => err.status === 400
  );
});

test('без обязательных полей — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/users', { login: '', password: '1234', name: 'X', role: 'driver' }, adminToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/users', { login: 'y', password: '1234', name: '', role: 'driver' }, adminToken),
    (err) => err.status === 400
  );
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/users', { login: 'z', password: '1234', name: 'X', role: '' }, adminToken),
    (err) => err.status === 400
  );
});

test('role=store без client_code — 400', async () => {
  await assert.rejects(
    apiCall(server.baseUrl, 'POST', '/api/users', { login: 'store_test', password: '1234', name: 'Магазин', role: 'store' }, adminToken),
    (err) => err.status === 400
  );
});

test('отключение и включение сотрудника (toggle) — не трогает других', async () => {
  const list1 = await apiCall(server.baseUrl, 'GET', '/api/users', undefined, adminToken);
  const target = list1.find(u => u.login === 'new_driver');
  const before = list1.filter(u => u.login !== 'new_driver').map(u => ({ login: u.login, active: u.active }));

  await apiCall(server.baseUrl, 'PUT', `/api/users/${target.id}/toggle`, {}, adminToken);
  const list2 = await apiCall(server.baseUrl, 'GET', '/api/users', undefined, adminToken);
  assert.equal(list2.find(u => u.login === 'new_driver').active, false);

  const after = list2.filter(u => u.login !== 'new_driver').map(u => ({ login: u.login, active: u.active }));
  assert.deepEqual(after, before, 'отключение одного сотрудника не должно менять статус остальных');

  await apiCall(server.baseUrl, 'PUT', `/api/users/${target.id}/toggle`, {}, adminToken);
  const list3 = await apiCall(server.baseUrl, 'GET', '/api/users', undefined, adminToken);
  assert.equal(list3.find(u => u.login === 'new_driver').active, true);
});

test('смена роли — отклоняет недопустимое значение, не трогает других сотрудников', async () => {
  const list = await apiCall(server.baseUrl, 'GET', '/api/users', undefined, adminToken);
  const target = list.find(u => u.login === 'new_cashier');

  await assert.rejects(
    apiCall(server.baseUrl, 'PUT', `/api/users/${target.id}/role`, { role: 'вообще_не_роль' }, adminToken),
    (err) => err.status === 400
  );

  await apiCall(server.baseUrl, 'PUT', `/api/users/${target.id}/role`, { role: 'warehouse' }, adminToken);
  const after = await apiCall(server.baseUrl, 'GET', '/api/users', undefined, adminToken);
  assert.equal(after.find(u => u.login === 'new_cashier').role, 'warehouse');
  // Остальные сотрудники не задеты
  assert.equal(after.find(u => u.login === 'new_driver').role, 'driver');
});
