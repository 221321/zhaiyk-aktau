// Разовый перенос нумерации заявок/накладных на уже РАБОТАЮЩЕЙ базе — не
// трогает ни одну существующую заявку (их номера/id остаются как есть),
// только сдвигает счётчик, с которого начнётся СЛЕДУЮЩАЯ заявка (nextOrderId,
// см. POST /api/orders на сервере). Нужен, когда номер накладной должен
// продолжать старую (бумажную/1С) нумерацию, а не начинаться с 1 — если
// база свежая (ключа nextOrderId ещё нет), это уже делает значение по
// умолчанию в server.js (db.defaults), и скрипт не нужен.
//
// ВАЖНО:
//   1) Перед запуском останови сервер (pm2 stop zhaiyk-aktau), иначе можно
//      потерять запись, если сервер в этот момент тоже пишет в db.json.
//   2) Новое значение обязано быть БОЛЬШЕ и текущего счётчика, и id самой
//      "старшей" уже существующей заявки — иначе следующая заявка получит
//      id, который уже занят (столкновение по /api/orders/:id и связям с
//      ним). Скрипт сам это проверяет и без --confirm ничего не меняет.
//   3) Бэкап перед изменением делается автоматически (scripts/backup-db.sh).
//
// Использование (на сервере, из папки проекта):
//   pm2 stop zhaiyk-aktau
//   node scripts/set-next-order-id.js 22400            # dry-run, ничего не меняет
//   node scripts/set-next-order-id.js 22400 --confirm  # бэкап + реальное изменение
//   pm2 start zhaiyk-aktau

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { execFileSync } = require('child_process');

const target = Number(process.argv[2]);
if (!Number.isInteger(target) || target < 1) {
  console.error('Укажи целевой номер первым аргументом, например:');
  console.error('  node scripts/set-next-order-id.js 22400');
  process.exit(1);
}

const db = low(new FileSync('db.json'));

const current = db.get('nextOrderId').value() || 1;
const orders = db.get('orders').value() || [];
const maxExistingId = orders.reduce((m, o) => Math.max(m, Number(o.id) || 0), 0);

console.log(`Текущий счётчик (nextOrderId): ${current}`);
console.log(`Наибольший id среди существующих заявок: ${maxExistingId}`);
console.log(`Всего заявок в базе: ${orders.length}`);
console.log(`Новое значение: ${target}`);

if (target <= current) {
  console.error(`\nОШИБКА: новое значение (${target}) не больше текущего счётчика (${current}) — отменено.`);
  process.exit(1);
}
if (target <= maxExistingId) {
  console.error(`\nОШИБКА: новое значение (${target}) не больше id самой новой существующей заявки (${maxExistingId}) — привело бы к повторяющимся номерам, отменено.`);
  process.exit(1);
}

if (!process.argv.includes('--confirm')) {
  console.log('\nЭто изменит ТОЛЬКО счётчик — ни одна существующая заявка не тронута.');
  console.log(`Следующая созданная заявка получит номер ${target}.`);
  console.log('\nПеред изменением скрипт сам сделает бэкап (scripts/backup-db.sh).');
  console.log('Убедись, что сервер остановлен, и запусти:');
  console.log(`  pm2 stop zhaiyk-aktau && node scripts/set-next-order-id.js ${target} --confirm`);
  process.exit(0);
}

console.log('\nДелаю бэкап перед изменением...');
try {
  const backupScript = path.join(__dirname, 'backup-db.sh');
  execFileSync('bash', [backupScript], { stdio: 'inherit' });
} catch (e) {
  console.error('\nОШИБКА: бэкап не удался — изменение ОТМЕНЕНО, база не тронута.');
  process.exit(1);
}

db.set('nextOrderId', target).write();

console.log(`\nГотово. Следующая заявка/накладная получит номер ${target}.`);
console.log('Не забудь запустить сервер обратно: pm2 start zhaiyk-aktau');
