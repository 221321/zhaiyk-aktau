// Разовая ПЕРЕНУМЕРАЦИЯ уже существующих заявок — в отличие от
// set-next-order-id.js (который трогает только счётчик для будущих заявок),
// этот скрипт меняет id самих существующих заявок так, чтобы они шли подряд
// начиная с target (по хронологии — самая старая заявка получает наименьший
// новый номер). Следующая созданная после этого заявка продолжит нумерацию
// сразу за последней переномерованной.
//
// id заявки используется как внешний ключ в нескольких других коллекциях —
// при переномеровании синхронно обновляются и они, иначе связи порвутся:
//   - debtSettlements.order_id (погашения долга по заявке)
//   - returns.order_id         (возвраты по заявке)
//   - weighLog.order_id        (история взвешивания)
//   - cashHandovers.order_ids  (список заявок в инкассации/сдаче кассы)
//
// ВАЖНО:
//   1) Номера на уже ВЫДАННЫХ бумажных накладных перестанут совпадать с
//      номером этой же заявки в системе — старая заявка №97 в базе станет,
//      например, №22417. Запускать только если это осознанно принято.
//   2) Перед запуском останови сервер (pm2 stop zhaiyk-aktau), иначе можно
//      потерять запись, если сервер в этот момент тоже пишет в db.json.
//   3) Бэкап перед изменением делается автоматически (scripts/backup-db.sh).
//   4) По умолчанию — dry-run: показывает таблицу "было → стало" и ничего
//      не меняет. Для реального изменения нужен флаг --confirm.
//
// Использование (на сервере, из папки проекта):
//   pm2 stop zhaiyk-aktau
//   node scripts/renumber-orders.js 22400            # dry-run
//   node scripts/renumber-orders.js 22400 --confirm  # бэкап + реальное изменение
//   pm2 start zhaiyk-aktau

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const { execFileSync } = require('child_process');

const target = Number(process.argv[2]);
if (!Number.isInteger(target) || target < 1) {
  console.error('Укажи стартовый номер первым аргументом, например:');
  console.error('  node scripts/renumber-orders.js 22400');
  process.exit(1);
}

const db = low(new FileSync('db.json'));

const orders = db.get('orders').value() || [];
if (orders.length === 0) {
  console.log('Заявок в базе нет, переномеровывать нечего.');
  process.exit(0);
}

// Хронологический порядок — по текущему id (он и есть исходный порядок
// создания, см. nextOrderId), а не по date/created_at (могут совпадать у
// нескольких заявок за один день).
const sorted = orders.slice().sort((a, b) => (Number(a.id) || 0) - (Number(b.id) || 0));
const idMap = {}; // старый id -> новый id
sorted.forEach((o, i) => { idMap[o.id] = target + i; });

const newNextOrderId = target + sorted.length;

console.log(`Заявок к переномерованию: ${sorted.length}`);
console.log(`Диапазон новых номеров: ${target} … ${target + sorted.length - 1}`);
console.log(`Счётчик следующей новой заявки станет: ${newNextOrderId}`);
console.log('');
console.log('Было → стало (первые и последние 5):');
const preview = sorted.length > 10 ? [...sorted.slice(0, 5), null, ...sorted.slice(-5)] : sorted;
preview.forEach(o => {
  if (o === null) { console.log('  ...'); return; }
  console.log(`  №${o.id} → №${idMap[o.id]}  (${o.client_name || ''}, ${o.date || ''})`);
});

const debtSettlements = db.get('debtSettlements').value() || [];
const returns = db.get('returns').value() || [];
const weighLog = db.get('weighLog').value() || [];
const cashHandovers = db.get('cashHandovers').value() || [];
console.log('');
console.log('Связанные записи, которые тоже будут обновлены:');
console.log(`  Погашения долгов (debtSettlements.order_id): ${debtSettlements.filter(s => s.order_id != null && idMap[s.order_id] != null).length}`);
console.log(`  Возвраты (returns.order_id): ${returns.filter(r => r.order_id != null && idMap[r.order_id] != null).length}`);
console.log(`  История взвешивания (weighLog.order_id): ${weighLog.filter(w => w.order_id != null && idMap[w.order_id] != null).length}`);
console.log(`  Инкассации (cashHandovers.order_ids): ${cashHandovers.filter(h => (h.order_ids || []).some(oid => idMap[oid] != null)).length}`);

if (!process.argv.includes('--confirm')) {
  console.log('');
  console.log('Это ПОЛНОСТЬЮ поменяет номера всех существующих заявок (см. таблицу выше).');
  console.log('Номера на уже выданных бумажных накладных перестанут совпадать с системой.');
  console.log('');
  console.log('Перед изменением скрипт сам сделает бэкап (scripts/backup-db.sh).');
  console.log('Убедись, что сервер остановлен, и запусти:');
  console.log(`  pm2 stop zhaiyk-aktau && node scripts/renumber-orders.js ${target} --confirm`);
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

sorted.forEach(o => { o.id = idMap[o.id]; });
debtSettlements.forEach(s => { if (s.order_id != null && idMap[s.order_id] != null) s.order_id = idMap[s.order_id]; });
returns.forEach(r => { if (r.order_id != null && idMap[r.order_id] != null) r.order_id = idMap[r.order_id]; });
weighLog.forEach(w => { if (w.order_id != null && idMap[w.order_id] != null) w.order_id = idMap[w.order_id]; });
cashHandovers.forEach(h => { h.order_ids = (h.order_ids || []).map(oid => idMap[oid] != null ? idMap[oid] : oid); });

db.set('orders', sorted).write();
db.set('debtSettlements', debtSettlements).write();
db.set('returns', returns).write();
db.set('weighLog', weighLog).write();
db.set('cashHandovers', cashHandovers).write();
db.set('nextOrderId', newNextOrderId).write();

console.log(`\nГотово. Заявки переномерованы: ${target} … ${target + sorted.length - 1}.`);
console.log(`Следующая новая заявка получит номер ${newNextOrderId}.`);
console.log('Не забудь запустить сервер обратно: pm2 start zhaiyk-aktau');
