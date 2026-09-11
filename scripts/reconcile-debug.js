#!/usr/bin/env node
// Диагностика расхождений сверки с 1С — запускать НА СЕРВЕРЕ, из папки
// деплоя (там же, где db.json), тем же Node, что и сам сервер:
//
//   cd /var/www/zhaiyk-aktau
//   node scripts/reconcile-debug.js 2026-09-01 2026-09-11                 # проверка целостности ленты по ВСЕМ кодам
//   node scripts/reconcile-debug.js 2026-09-01 2026-09-11 00000000041     # детальная лента по конкретному коду(ам)
//   node scripts/reconcile-debug.js 2026-09-01 2026-09-11 00000000041 00000000104
//
// Ничего не пишет в db.json — только читает (тот же FileSync-адаптер, что
// и server.js, без единого .write()).
//
// Режим без кодов — самопроверка ленты: closing из computeMaterialStatementRows
// (как в отчёте "Ведомость"/сверке с 1С) должен совпадать с ТЕКУЩИМ
// stock.qty/weight_kg. Если где-то не совпадает — это баг в коде (потерялась
// запись в ленте при каком-то движении остатка), а не реальное расхождение
// с 1С. Совпадает у всех — значит цифры "Расход на сайте" в сверке верны,
// и расхождение с 1С (см. shortfall) отражает реальность (непроведённые в
// 1С реализации), а не ошибку отчёта.
//
// Режим с кодами — построчная лента движений за период (и немного до `from`
// для контекста), чтобы своими глазами увидеть, из каких заявок/продаж/
// возвратов/синков сложился "Расход на сайте" по конкретному товару.

const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const [, , from, to, ...codes] = process.argv;
if (!from || !to) {
  console.error('Использование: node scripts/reconcile-debug.js <from YYYY-MM-DD> <to YYYY-MM-DD> [код...]');
  process.exit(1);
}

const db = low(new FileSync(process.env.DB_PATH || 'db.json'));

function round2(n) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

const aliasMap = {};
db.get('productAliases').value().forEach(a => { aliasMap[a.code] = a; });
const productNameMap = {};
db.get('products').value().forEach(p => { productNameMap[p.code] = p.name; });
const stockMap = {};
db.get('stock').value().forEach(s => { stockMap[s.code] = s; });
const ledger = db.get('stockLedger').value();

function statementRow(code) {
  const isWeight = !!(aliasMap[code] && aliasMap[code].priced_by_weight);
  const pool = isWeight ? 'weight_kg' : 'qty';
  const entries = ledger.filter(e => e.code === code && e.pool === pool);

  const currentBalance = isWeight
    ? (stockMap[code] && stockMap[code].weight_kg != null ? Number(stockMap[code].weight_kg) : 0)
    : (stockMap[code] ? Number(stockMap[code].qty) || 0 : 0);

  const uptoTo = entries.filter(e => e.date <= to);
  const beforeFrom = entries.filter(e => e.date < from);
  const inPeriod = entries.filter(e => e.date >= from && e.date <= to);

  const income = inPeriod.filter(e => e.delta > 0).reduce((s, e) => s + e.delta, 0);
  const outcome = inPeriod.filter(e => e.delta < 0).reduce((s, e) => s - e.delta, 0);

  const closing = uptoTo.length > 0 ? uptoTo[uptoTo.length - 1].balance_after : currentBalance;
  const opening = beforeFrom.length > 0 ? beforeFrom[beforeFrom.length - 1].balance_after : (closing - income + outcome);

  return {
    code, pool, isWeight, currentBalance,
    opening: round2(opening), income: round2(income), outcome: round2(outcome), closing: round2(closing),
    entriesInPeriod: inPeriod, lastEntry: uptoTo[uptoTo.length - 1] || null,
  };
}

if (codes.length === 0) {
  // Самопроверка целостности ленты по всем кодам, которые вообще упоминаются
  // в остатках/номенклатуре/ленте (та же выборка кодов, что в
  // computeMaterialStatementRows на сервере).
  const allCodes = new Set();
  ledger.forEach(e => allCodes.add(e.code));
  Object.keys(stockMap).forEach(c => allCodes.add(c));
  db.get('products').value().forEach(p => { if (p.code) allCodes.add(p.code); });

  console.log(`Проверка целостности ленты остатка на ${to} (сегодня) — closing из ленты должен совпадать с текущим stock.qty/weight_kg.\n`);
  let mismatches = 0;
  const rows = [];
  allCodes.forEach(code => {
    const r = statementRow(code);
    rows.push(r);
    // closing уже равен currentBalance по построению, если ленты нет ВООБЩЕ
    // (fallback) — интересен только случай, когда лента ЕСТЬ, но её
    // последняя запись разошлась с фактическим остатком (баг: где-то стока
    // поменяли, а в ленту не записали).
    if (r.lastEntry && round2(r.lastEntry.balance_after) !== round2(r.currentBalance)) {
      mismatches++;
      console.log(`РАСХОЖДЕНИЕ: ${code} (${productNameMap[code] || aliasMap[code]?.alias || '?'}) — лента говорит closing=${r.closing}, а факт. остаток (${r.pool})=${r.currentBalance}`);
    }
  });
  if (mismatches === 0) {
    console.log('Расхождений между лентой и фактическим остатком не найдено — движок остатка/ленты внутренне непротиворечив.');
  } else {
    console.log(`\nВсего расхождений: ${mismatches} — по этим кодам "Ведомость"/сверка с 1С считает closing неверно (стоит разобрать отдельно, это баг, а не реальная разница с 1С).`);
  }

  console.log(`\nТоп-20 по обороту (приход+расход) за ${from}..${to} — для общей картины:`);
  rows
    .map(r => ({ ...r, turnover: round2(r.income + r.outcome) }))
    .sort((a, b) => b.turnover - a.turnover)
    .slice(0, 20)
    .forEach(r => {
      console.log(`  ${r.code}  ${(productNameMap[r.code] || aliasMap[r.code]?.alias || '').padEnd(40)}  приход=${r.income}\tрасход=${r.outcome}\tclosing=${r.closing}`);
    });
  process.exit(0);
}

codes.forEach(code => {
  const r = statementRow(code);
  console.log(`\n===== ${code}  ${productNameMap[code] || aliasMap[code]?.alias || '(нет в каталоге)'} =====`);
  console.log(`Пул: ${r.pool} (${r.isWeight ? 'весовой товар, кг' : 'короба/шт'})`);
  console.log(`opening=${r.opening}  income=${r.income}  outcome=${r.outcome}  closing=${r.closing}  (факт. остаток сейчас: ${r.currentBalance})`);
  if (r.lastEntry && round2(r.lastEntry.balance_after) !== round2(r.currentBalance)) {
    console.log(`  !! ВНИМАНИЕ: последняя запись ленты (balance_after=${r.lastEntry.balance_after}) не совпадает с фактическим остатком (${r.currentBalance}) — похоже на баг записи ленты.`);
  }
  console.log(`\nДвижения за период (${r.entriesInPeriod.length}):`);
  if (r.entriesInPeriod.length === 0) {
    console.log('  (нет ни одной записи в ленте за этот период — opening/income/outcome посчитаны по фолбэку, см. комментарий в computeMaterialStatementRows)');
  }
  r.entriesInPeriod.forEach(e => {
    const meta = Object.keys(e).filter(k => !['code','pool','delta','balance_after','type','date','created_at'].includes(k))
      .map(k => `${k}=${e[k]}`).join(' ');
    console.log(`  ${e.date}  ${e.type.padEnd(20)}  delta=${String(e.delta).padStart(10)}  balance_after=${String(e.balance_after).padStart(10)}  ${meta}`);
  });
});
