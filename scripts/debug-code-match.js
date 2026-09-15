#!/usr/bin/env node
// Разовая диагностика: почему доставка конкретного товара не списывает
// остаток (см. reconcile-debug.js — по коду только sync-записи, ни одной
// delivery). Проверяет, совпадает ли it.code в позициях доставленных заявок
// с code в коллекции stock БАЙТ В БАЙТ (JSON.stringify показывает скрытые
// пробелы/непечатные символы, которые "==" не видно).
//
// Запуск на сервере из папки деплоя:
//   node scripts/debug-code-match.js 00000000177
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const code = process.argv[2];
if (!code) {
  console.error('Использование: node scripts/debug-code-match.js <код>');
  process.exit(1);
}

const db = low(new FileSync(process.env.DB_PATH || 'db.json'));

const stockRec = db.get('stock').find({ code }).value();
console.log('=== stock запись (поиск по code === %s) ===', JSON.stringify(code));
console.log(stockRec);

const allStock = db.get('stock').value();
console.log('\n=== Все коды в stock, похожие на искомый (includes) ===');
allStock.filter(s => s.code && s.code.includes(code.slice(-6))).forEach(s => {
  console.log(JSON.stringify(s.code), '=== equal to target?', s.code === code, '| qty=', s.qty, 'weight_kg=', s.weight_kg);
});

console.log('\n=== Позиции с этим кодом в заявках status=delivered ===');
const orders = db.get('orders').value().filter(o => o.status === 'delivered');
let found = 0;
orders.forEach(o => {
  const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
  items.forEach(it => {
    if (!it.code) return;
    if (it.code === code || it.code.includes(code.slice(-6))) {
      found++;
      if (found <= 10) {
        console.log(
          `order #${o.id} | it.code=${JSON.stringify(it.code)} | equal to target? ${it.code === code} | qty=${it.qty} | is_weight_item=${it.is_weight_item}`
        );
      }
    }
  });
});
console.log(`\nВсего позиций с этим/похожим кодом среди delivered-заявок: ${found}`);
