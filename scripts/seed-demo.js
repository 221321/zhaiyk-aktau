// Одноразовый (идемпотентный) сидер демо-данных — чтобы можно было зайти
// и посмотреть кассу/каталог с реальными данными, пока 1С ещё не
// синхронизирует products/stock. Работает напрямую с db.json тем же lowdb,
// что и server.js — запускать при остановленном сервере (иначе можно
// потерять запись, если сервер в этот момент тоже пишет в файл).
//
// Использование:
//   node scripts/seed-demo.js
//
// Безопасно перезапускать: все добавляемые записи помечены кодом DEMO*
// и логином demo-кассира, повторный запуск ничего не задублирует.

const bcrypt = require('bcryptjs');
const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');

const db = low(new FileSync('db.json'));

const DEMO_PRODUCTS = [
  { code: 'DEMO001', name: 'Стиральный порошок "Актив" 5кг', group: 'Бытовая химия', unit: 'шт', price1: 4500, cost: 3200 },
  { code: 'DEMO002', name: 'Мыло хозяйственное 200г', group: 'Бытовая химия', unit: 'шт', price1: 350, cost: 220 },
  { code: 'DEMO003', name: 'Отбеливатель "Белизна" 1л', group: 'Бытовая химия', unit: 'шт', price1: 600, cost: 400 },
  { code: 'DEMO004', name: 'Губки для посуды, уп. 5шт', group: 'Хозтовары', unit: 'уп', price1: 450, cost: 280 },
  { code: 'DEMO005', name: 'Туалетная бумага, уп. 4 рулона', group: 'Бумажная продукция', unit: 'уп', price1: 900, cost: 600 },
  { code: 'DEMO006', name: 'Мешки для мусора 60л, уп. 20шт', group: 'Хозтовары', unit: 'уп', price1: 1200, cost: 850 },
];
const DEMO_STOCK_QTY = { DEMO001: 50, DEMO002: 100, DEMO003: 80, DEMO004: 60, DEMO005: 40, DEMO006: 70 };

// 1) demo-кассир, чтобы было куда зайти и посмотреть CashierCabinet
const usersCol = db.get('users');
if (!usersCol.find({ login: 'cashier1' }).value()) {
  const nextId = db.get('nextUserId').value();
  usersCol.push({
    id: nextId,
    login: 'cashier1',
    password: bcrypt.hashSync('1234', 10),
    name: 'Демо Кассир',
    role: 'cashier',
    region: '',
    active: true,
  }).write();
  db.set('nextUserId', nextId + 1).write();
  console.log('+ создан пользователь cashier1 / 1234 (роль cashier)');
} else {
  console.log('= пользователь cashier1 уже есть, пропускаю');
}

// 2) номенклатура (products) — обычно приходит из 1С sync, тут добавляем
// поверх (не трогая существующие товары), если демо-кодов ещё нет.
const productsCol = db.get('products');
let addedProducts = 0;
DEMO_PRODUCTS.forEach(p => {
  if (!productsCol.find({ code: p.code }).value()) {
    productsCol.push({ code: p.code, name: p.name, group: p.group, unit: p.unit }).write();
    addedProducts++;
  }
});
console.log(`+ товаров добавлено: ${addedProducts} (уже было: ${DEMO_PRODUCTS.length - addedProducts})`);

// 3) остатки (stock) — тоже обычно из 1С, добавляем/обновляем по демо-кодам
const stockCol = db.get('stock');
Object.entries(DEMO_STOCK_QTY).forEach(([code, qty]) => {
  const existing = stockCol.find({ code }).value();
  if (existing) {
    stockCol.find({ code }).assign({ qty }).write();
  } else {
    stockCol.push({ code, qty }).write();
  }
});
console.log(`+ остатки выставлены для ${Object.keys(DEMO_STOCK_QTY).length} кодов`);

// 4) productAliases — цена (price1) для сайта/кассы, без неё касса не
// покажет цену товара (см. CashierCabinet: p.price1 || 0)
const aliasesCol = db.get('productAliases');
DEMO_PRODUCTS.forEach(p => {
  const existing = aliasesCol.find({ code: p.code }).value();
  const patch = { price1: p.price1, price2: null, price3: null, cost: p.cost, commission: 4 };
  if (existing) {
    aliasesCol.find({ code: p.code }).assign(patch).write();
  } else {
    aliasesCol.push({ code: p.code, ...patch }).write();
  }
});
console.log('+ цены (price1) и себестоимость выставлены для демо-товаров');

// 5) одна тестовая продажа от demo-кассира, чтобы отчёт "Касса" и история
// кассира тоже не были пустыми
const salesCol = db.get('sales');
if (!salesCol.find({ client_code: '', created_by_name: 'Демо Кассир', status: 'completed' }).value()) {
  const cashier = usersCol.find({ login: 'cashier1' }).value();
  const items = [
    { code: 'DEMO001', name: DEMO_PRODUCTS[0].name, qty: 1, price: DEMO_PRODUCTS[0].price1, sum: DEMO_PRODUCTS[0].price1, cost: DEMO_PRODUCTS[0].cost },
    { code: 'DEMO003', name: DEMO_PRODUCTS[2].name, qty: 2, price: DEMO_PRODUCTS[2].price1, sum: DEMO_PRODUCTS[2].price1 * 2, cost: DEMO_PRODUCTS[2].cost },
  ];
  const total = items.reduce((s, it) => s + it.sum, 0);
  const id = db.get('nextSaleId').value();
  salesCol.push({
    id,
    created_at: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    created_by_id: cashier.id,
    created_by_name: cashier.name,
    client_code: '',
    client_name: '',
    items,
    total,
    payment_cash: total,
    payment_qr: 0,
    payment_debt: 0,
    status: 'completed',
    realized_in_1c: false,
  }).write();
  db.set('nextSaleId', id + 1).write();
  console.log(`+ добавлена тестовая продажа #${id} на ${total} ₸`);
} else {
  console.log('= тестовая продажа уже есть, пропускаю');
}

console.log('\nГотово. Логин кассира: cashier1 / 1234');
