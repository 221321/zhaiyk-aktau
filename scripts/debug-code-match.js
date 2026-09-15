#!/usr/bin/env node
// Разовая диагностика: почему доставка конкретного товара не списывает
// остаток (см. reconcile-debug.js — по коду только sync-записи, ни одной
// delivery). Печатает текущую карточку товара (priced_by_weight — от неё
// зависит пул при доставке, см. PUT /api/orders/:id/status) и ПОЛНЫЕ позиции
// этого кода во всех доставленных заявках — is_weight_item/boxes/
// weight_confirmed/qty, чтобы увидеть, не разъехался ли снимок весового
// флага на позиции с текущей карточкой (тогда boxesDelta считается по
// устаревшему/отсутствующему boxes и уходит в 0 — а pushLedgerEntry молча
// пропускает запись с delta=0).
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

const aliasRec = db.get('productAliases').find({ code }).value();
console.log('\n=== productAliases (ТЕКУЩАЯ карточка товара — priced_by_weight решает пул при доставке) ===');
console.log(aliasRec);

console.log('\n=== Полные позиции с этим кодом в заявках status=delivered ===');
const orders = db.get('orders').value().filter(o => o.status === 'delivered');
let found = 0;
orders.forEach(o => {
  const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
  items.forEach(it => {
    if (!it.code || it.code !== code) return;
    found++;
    console.log(`--- order #${o.id} (delivered_at=${o.delivered_at || '?'}) ---`);
    console.log(JSON.stringify(it, null, 2));
  });
});
console.log(`\nВсего позиций с этим кодом среди delivered-заявок: ${found}`);
