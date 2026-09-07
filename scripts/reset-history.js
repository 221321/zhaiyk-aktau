// Полная очистка истории операций перед новым периодом работы (по просьбе
// владельца) — заявки, продажи в кассе, смены, инкассации, возвраты и
// погашения долгов. Долги отдельной коллекцией не хранятся — они считаются
// от payment_debt в orders/sales (см. GET /api/debts на сервере), поэтому
// отдельно их зачищать не нужно: как только исчезнут заявки и продажи,
// исчезнут и долги.
//
// НЕ трогает: пользователей (users — роли и пароли), номенклатуру
// (products), псевдонимы/цены (productAliases), остатки (stock), клиентов
// и договорников (clients, clientAddresses, clientContacts, clientTags),
// категории (categories), сотрудников (employees), подписки на push
// (pushSubscriptions) и историю взвешивания (weighLog — по явной просьбе
// владельца, это учёт факт. веса товара, а не история заявок/кассы).
//
// Номера документов (nextOrderId, nextSaleId, nextShiftId,
// nextCashHandoverId, nextReturnId) сбрасываются на 1 — новая нумерация
// начнётся заново (решение владельца: раньше выданные бумажные накладные
// с текущими номерами в расчёт не берём).
//
// ВАЖНО:
//   1) Перед запуском останови сервер (pm2 stop zhaiyk-aktau), иначе можно
//      потерять запись, если сервер в этот момент тоже пишет в db.json.
//   2) По умолчанию скрипт ничего не удаляет — только показывает, сколько
//      записей найдено. Для реального удаления нужен флаг --confirm.
//   3) Бэкап перед удалением ОБЯЗАТЕЛЕН и делается самим скриптом
//      автоматически (запускает scripts/backup-db.sh) — вручную запускать
//      его отдельно не нужно, и без него --confirm не сработает: если
//      бэкап не удался, скрипт останавливается и ничего не удаляет.
//
// Использование (на сервере, из папки проекта):
//   pm2 stop zhaiyk-aktau
//   node scripts/reset-history.js            # dry-run, ничего не меняет
//   node scripts/reset-history.js --confirm  # бэкап + реальное удаление
//   pm2 start zhaiyk-aktau

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { execFileSync } = require('child_process');

const db = low(new FileSync('db.json'));

const TARGETS = [
  { collection: 'orders', nextIdKey: 'nextOrderId', label: 'Заявки' },
  { collection: 'sales', nextIdKey: 'nextSaleId', label: 'Продажи в кассе' },
  { collection: 'cashierShifts', nextIdKey: 'nextShiftId', label: 'Кассовые смены' },
  { collection: 'cashHandovers', nextIdKey: 'nextCashHandoverId', label: 'Инкассации/сдачи кассы' },
  { collection: 'returns', nextIdKey: 'nextReturnId', label: 'Возвраты' },
  { collection: 'debtSettlements', nextIdKey: null, label: 'Погашения долгов' },
];

const counts = TARGETS.map(t => ({ ...t, count: (db.get(t.collection).value() || []).length }));
const total = counts.reduce((s, t) => s + t.count, 0);

console.log('Найдено записей:');
counts.forEach(t => console.log(`  ${t.label} (${t.collection}): ${t.count}`));
console.log(`  Итого: ${total}`);

if (total === 0) {
  console.log('\nВсё уже пусто, очищать нечего.');
  process.exit(0);
}

if (!process.argv.includes('--confirm')) {
  console.log('');
  console.log('Это ПОЛНОСТЬЮ и БЕЗВОЗВРАТНО удалит все записи выше и обнулит их');
  console.log('нумерацию (новая заявка/продажа будет №1).');
  console.log('НЕ ЗАТРОНЕТ: пользователей, товары, цены, остатки, клиентов,');
  console.log('договорников, сотрудников и историю взвешивания.');
  console.log('');
  console.log('Перед удалением скрипт сам сделает бэкап (scripts/backup-db.sh).');
  console.log('Убедись, что сервер остановлен, и запусти:');
  console.log('  pm2 stop zhaiyk-aktau && node scripts/reset-history.js --confirm');
  process.exit(0);
}

// Бэкап — обязательная часть удаления, а не отдельный ручной шаг: если он
// не прошёл (нет прав, нет места на диске и т.п.), ничего не удаляем.
console.log('\nДелаю бэкап перед удалением...');
try {
  const backupScript = path.join(__dirname, 'backup-db.sh');
  execFileSync('bash', [backupScript], { stdio: 'inherit' });
} catch (e) {
  console.error('\nОШИБКА: бэкап не удался — удаление ОТМЕНЕНО, база не тронута.');
  process.exit(1);
}

counts.forEach(t => {
  db.set(t.collection, []).write();
  if (t.nextIdKey) db.set(t.nextIdKey, 1).write();
});

console.log('\nГотово. Удалено записей:');
counts.forEach(t => console.log(`  ${t.label}: ${t.count}`));
console.log('\nНомера документов обнулены (следующая заявка/продажа — №1).');
console.log('Товары, цены, остатки, клиенты, договорники, сотрудники, пользователи');
console.log('и история взвешивания не затронуты.');
console.log('\nНе забудь запустить сервер обратно: pm2 start zhaiyk-aktau');
