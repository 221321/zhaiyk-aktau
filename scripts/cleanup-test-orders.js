// Разовый скрипт очистки тестовых заявок перед переводом сервера в боевой
// режим. Удаляет ВСЕ записи из orders (и сбрасывает nextOrderId на 1).
//
// НЕ трогает: пользователей (users — роли и пароли), псевдонимы товаров
// (productAliases), номенклатуру (products), остатки (stock) и остальные
// коллекции (клиенты, приходы, продажи, возвраты, инкассации, смены) —
// только сами заявки.
//
// ВАЖНО:
//   1) Перед запуском останови сервер (node server.js), иначе можно
//      потерять запись, если сервер в этот момент тоже пишет в db.json.
//   2) Сначала сделай бэкап: ./scripts/backup-db.sh
//   3) По умолчанию скрипт ничего не удаляет — только показывает, сколько
//      заявок найдено. Для реального удаления нужен флаг --confirm.
//
// Использование:
//   node scripts/backup-db.sh
//   node scripts/cleanup-test-orders.js            # dry-run, ничего не меняет
//   node scripts/cleanup-test-orders.js --confirm  # реальное удаление

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const db = low(new FileSync('db.json'));

const orders = db.get('orders').value() || [];
console.log(`Найдено заявок в базе: ${orders.length}`);

if (orders.length === 0) {
  console.log('Заявок нет, очищать нечего.');
  process.exit(0);
}

if (!process.argv.includes('--confirm')) {
  console.log('');
  console.log('Это ПОЛНОСТЬЮ и БЕЗВОЗВРАТНО удалит все заявки выше (пользователи,');
  console.log('роли, пароли и псевдонимы товаров затронуты не будут).');
  console.log('Убедись, что бэкап уже сделан (./scripts/backup-db.sh), и запусти:');
  console.log('  node scripts/cleanup-test-orders.js --confirm');
  process.exit(0);
}

db.set('orders', []).write();
db.set('nextOrderId', 1).write();

console.log(`Удалено заявок: ${orders.length}`);
console.log('nextOrderId сброшен на 1.');
console.log('Пользователи, роли, пароли, псевдонимы товаров и остальные данные не затронуты.');
