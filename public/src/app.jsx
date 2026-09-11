const { useState, useEffect, useCallback, useMemo, useRef, memo } = React;

const API = '';
const FH = "'Manrope', sans-serif"; /* шрифт заголовков и цифр */

const TIME_SLOTS = ["До обеда (09:00 – 14:00)", "После обеда (14:00 – 19:00)"];
const PICKUP_SLOT = "Самовывоз";

// Contact Picker API — реальный выбор контакта из телефонной книги. Есть
// только в Chrome на Android (за защищённым контекстом, HTTPS); в Safari
// на iPhone его нет вообще ни в каком виде (ограничение Apple, не наше) —
// там navigator.contacts просто не существует, кнопку не показываем.
const CONTACT_PICKER_SUPPORTED = typeof navigator !== 'undefined' && !!navigator.contacts && !!navigator.contacts.select;
async function pickPhoneContact(onPicked) {
  try {
    const picked = await navigator.contacts.select(['name', 'tel'], { multiple: false });
    if (!picked || !picked.length) return;
    const c = picked[0];
    const name = (c.name && c.name[0]) || '';
    const tel = (c.tel && c.tel[0]) || '';
    if (name || tel) onPicked({ name, tel });
  } catch (e) {
    // пользователь закрыл системный диалог выбора — это не ошибка
  }
}

// Напоминание должникам через WhatsApp — намеренно НЕ через официальный
// Business API и НЕ через сторонние библиотеки-автоматизаторы (Baileys,
// whatsapp-web.js): и то, и другое либо требует одобрения шаблонов Meta
// под "долги" (регулируемая тема, могут не одобрить), либо банит рабочий
// номер за паттерн автоматической массовой рассылки. wa.me — просто
// диплинк в обычный WhatsApp с готовым текстом, отправляет его вживую сам
// человек, поэтому риска блокировки номера нет вообще.
function toWhatsAppDigits(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  // Казахстанские номера часто вводят с "8" (местный код выхода) — для
  // wa.me нужен международный формат с "7".
  if (digits.length === 11 && digits[0] === '8') return '7' + digits.slice(1);
  return digits;
}
function waMeLink(phone, text) {
  const digits = toWhatsAppDigits(phone);
  if (!digits) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}
// tel:-диплинк — открывает звонок в самом устройстве оператора (телефон/
// планшет со звонилкой; на компьютере — что бы ни было там назначено
// обработчиком tel:), а не через сайт. Оставляем "+", остальное — только
// цифры, чтобы номер вида "+7 (700) 123-45-67" не сломал ссылку.
function telLink(phone) {
  const digits = String(phone || '').trim().replace(/(?!^\+)[^\d]/g, '');
  if (!digits.replace(/\D/g, '')) return null;
  return `tel:${digits}`;
}
const MONTHS_RU_SHORT = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
const MONTHS_KZ_SHORT = ['қаңтар','ақпан','наурыз','сәуір','мамыр','маусым','шілде','тамыз','қыркүйек','қазан','қараша','желтоқсан'];
// День+месяц без года и без часового пояса (см. тот же приём и его причину
// у formatDateWordsRu ниже) — короткая форма для сообщения в WhatsApp,
// год не нужен, долг почти всегда за текущий.
function formatDayMonth(dateStr, months) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getUTCDate()} ${months[d.getUTCMonth()]}`;
}
function debtReminderText(d) {
  const sum = d.remaining.toLocaleString();
  const ru = `Долг на ${formatDayMonth(d.date, MONTHS_RU_SHORT)} сумма ${sum} тг. Напоминаем о своевременной оплате, ⚠️`;
  const kz = `Қарыз ${formatDayMonth(d.date, MONTHS_KZ_SHORT)} ${sum}тг. Еске саламыз, қарызды кешіктірмей төлеңіз ⚠️`;
  return `${ru}\n\n${kz}`;
}

// Тот же принцип, что у wa.me выше (см. комментарий) — отправляет вживую сам
// человек, автоматизации нет. wa.me умеет предзаполнить только текст, фото
// приложить диплинком нельзя — где доступен Web Share API с файлами (по сути
// только мобильные браузеры), открываем системное "Поделиться" сразу с
// накладной и текстом-подписью, человек сам выбирает в нём WhatsApp и
// отправляет. На компьютере (или если share недоступен) откатываемся к
// прежнему поведению — текст в wa.me плюс накладная отдельной вкладкой,
// чтобы прикрепить вручную.
//
// Саму отправку в /api/debt-reminders этот хелпер больше не пишет — только
// открывает WhatsApp. Раньше запись писалась сразу по нажатию кнопки, и
// операторы путались: нажал/открыл ещё не значит отправил (сообщение всё
// равно уходит вживую внутри WhatsApp — сайт не может знать, дошло ли оно,
// см. комментарий у toWhatsAppDigits). Теперь запись пишет sendReminder в
// DebtsPanel, и только после того, как оператор сам подтвердит, что
// отправил (см. waitForReturn там же).
async function shareDebtReminder(d) {
  const text = debtReminderText(d);
  const link = waMeLink(d.contact_phone, text);
  const openFallback = () => {
    if (link) window.open(link, '_blank', 'noopener,noreferrer');
    if (d.delivery_photo) {
      window.open(d.delivery_photo, '_blank', 'noopener,noreferrer');
      alert('Текст открыт в WhatsApp, накладная — отдельной вкладкой: на компьютере прикрепить фото автоматически нельзя, сохраните и прикрепите вручную.');
    }
  };
  if (!d.delivery_photo) { openFallback(); return; }
  try {
    const resp = await fetch(d.delivery_photo);
    const blob = await resp.blob();
    const file = new File([blob], `nakladnaya-${d.order_id || d.sale_id}.jpg`, { type: blob.type || 'image/jpeg' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], text });
      return;
    }
  } catch(e) {
    if (e && e.name === 'AbortError') return;
  }
  openFallback();
}

// Ждём, пока оператор вернётся на вкладку/приложение после того, как
// переключился в WhatsApp — 'focus' на window срабатывает и при возврате из
// другого приложения (мобильный переключатель задач), и при возврате в
// открытую вкладку с сайта после закрытия/переключения вкладки WhatsApp
// (десктоп). Это лучший доступный сигнал "похоже, человек закончил" — сам
// факт отправки сайту всё равно не виден (см. shareDebtReminder), поэтому
// дальше оператор подтверждает вручную (см. sendReminder в DebtsPanel).
// Таймаут — подстраховка на случай, если событие вообще не сработает
// (например, всплывающее окно WhatsApp заблокировано браузером).
function waitForReturn(timeoutMs = 15000) {
  return new Promise(resolve => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.removeEventListener('focus', finish);
      document.removeEventListener('visibilitychange', onVis);
      resolve();
    };
    const onVis = () => { if (document.visibilityState === 'visible') finish(); };
    window.addEventListener('focus', finish);
    document.addEventListener('visibilitychange', onVis);
    setTimeout(finish, timeoutMs);
  });
}

const SL = { new: "Ожидает", in_transit: "В работе", delivered: "Доставлено", cancelled: "Отказ при получении", returned: "Возврат", revoked: "Отозвана" };
const SC = { new: "#DA1A10", in_transit: "#B45309", delivered: "#15803D", cancelled: "#DC2626", returned: "#7C3AED", revoked: "#6B7280" };
const SB = { new: "#FCEBEA", in_transit: "#FBF3E6", delivered: "#EAF5EE", cancelled: "#FEF2F2", returned: "#F5F3FF", revoked: "#F3F4F6" };

const C = {
  navy:"#1C1917", accent:"#1DA851", accentDark:"#157E3C", redSoft:"#FCEBEA",
  white:"#FFFFFF", surface:"#F5F3F0",
  border:"#E7E3DE", text:"#1C1917", textMid:"#44403C", textSub:"#79716B", textFaint:"#A8A29E",
  green:"#15803D", amber:"#B45309", red:"#DC2626",
  // "Новых"/"Ожидают" в статистике — отдельный от бренда цвет (раньше accent
  // и он же совпадал с этим статусом; после ребрендинга в зелёный оставляем
  // тёплый оттенок, иначе не отличить от зелёного "Доставлено" рядом).
  pending:"#DA1A10",
  cashGreen:"#DCFCE7", qrBlue:"#DBEAFE", debtAmber:"#FEF3C7",
};
const R = 14;

const S = {
  app: { fontFamily:"inherit", minHeight:"100vh", background:C.surface, color:C.text, fontSize:17 },
  loginWrap: { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24, background:C.surface },
  loginCard: { background:C.white, border:`1px solid ${C.border}`, borderRadius:16, padding:"44px 36px", width:"100%", maxWidth:380, boxShadow:"0 4px 24px rgba(28,25,23,0.07)" },
  logoTitle: { fontFamily:"'Inter', sans-serif", fontSize:26, fontWeight:800, color:C.navy, margin:"0 0 4px", letterSpacing:"-0.01em" },
  logoSub: { fontSize:13, color:C.accent, margin:"0 0 32px", fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase" },
  label: { display:"block", fontSize:14, fontWeight:600, color:C.textMid, marginBottom:6, letterSpacing:"0.04em", textTransform:"uppercase" },
  input: { width:"100%", padding:"13px 14px", border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:18, outline:"none", boxSizing:"border-box", background:C.white, color:C.text },
  btnPrimary: { width:"100%", padding:"15px", background:C.accent, color:C.white, border:"none", borderRadius:R, fontFamily:FH, fontSize:18, fontWeight:800, cursor:"pointer", marginTop:4, boxShadow:"0 6px 18px rgba(29,168,81,0.28)" },
  errorBox: { background:"#FEF2F2", color:C.red, border:"1px solid #FECACA", padding:"10px 13px", borderRadius:8, fontSize:15, marginBottom:16 },
  header: { background:C.white, color:C.text, padding:"0 18px", height:62, display:"flex", alignItems:"center", justifyContent:"space-between", position:"sticky", top:0, zIndex:100, borderBottom:`1px solid ${C.border}` },
  headerMark: { fontFamily:"'Inter', sans-serif", fontSize:19, fontWeight:800, letterSpacing:"-0.01em", color:C.navy, lineHeight:1.1 },
  headerSub: { fontSize:12, color:C.accent, fontWeight:700, letterSpacing:"0.14em", textTransform:"uppercase", marginTop:2 },
  logoutBtn: { background:"transparent", border:"none", color:C.accent, padding:0, cursor:"pointer", fontSize:14, fontWeight:600 },
  page: { padding:"20px 16px 80px", maxWidth:520, margin:"0 auto" },
  card: { background:C.white, border:`1px solid ${C.border}`, borderRadius:R, padding:"14px 16px", marginBottom:10 },
  cardTitle: { fontFamily:FH, fontSize:18, fontWeight:800, color:C.text, margin:"0 0 3px" },
  cardSub: { fontSize:15, color:C.textSub, margin:0 },
  badge: (s) => ({ display:"inline-block", padding:"4px 11px", borderRadius:99, fontSize:14, fontWeight:700, color:SC[s], background:SB[s] }),
  statsRow: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginBottom:18 },
  statCard: (a) => ({ background:C.white, border:`1px solid ${C.border}`, borderRadius:R, padding:"12px 14px 10px" }),
  statNum: (a) => ({ fontFamily:FH, fontSize:26, fontWeight:800, color:a||C.navy, margin:"0 0 2px", fontVariantNumeric:"tabular-nums" }),
  statLabel: { fontSize:14, color:C.textSub, margin:0, fontWeight:500 },
  nav: { position:"fixed", bottom:0, left:0, right:0, background:C.white, borderTop:`1px solid ${C.border}`, display:"flex", zIndex:100 },
  navBtn: (a) => ({ flex:1, padding:"12px 0 10px", border:"none", background:"none", cursor:"pointer", display:"flex", flexDirection:"column", alignItems:"center", gap:3, color:a?C.accent:C.textFaint, borderTop:a?`2.5px solid ${C.accent}`:"2.5px solid transparent" }),
  navIcon: { fontSize:23 },
  navLabel: (a) => ({ fontSize:13, fontWeight:a?700:500 }),
  formGroup: { marginBottom:16 },
  select: { width:"100%", padding:"13px 14px", border:`1.5px solid ${C.border}`, borderRadius:10, fontSize:18, outline:"none", boxSizing:"border-box", background:C.white },
  textarea: { width:"100%", padding:"11px 13px", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:15, outline:"none", boxSizing:"border-box", resize:"vertical", minHeight:70, background:C.white },
  btnSuccess: { width:"100%", padding:"15px", background:C.green, color:C.white, border:"none", borderRadius:R, fontFamily:FH, fontSize:18, fontWeight:800, cursor:"pointer" },
  btnDanger: { width:"100%", padding:"14px", background:C.white, color:C.red, border:`1.5px solid ${C.red}`, borderRadius:R, fontSize:17, fontWeight:600, cursor:"pointer", marginTop:8 },
  btnSecondary: { padding:"7px 14px", background:C.surface, color:C.textMid, border:`1px solid ${C.border}`, borderRadius:8, fontSize:15, cursor:"pointer" },
  btnOutline: { width:"100%", padding:"14px", background:C.white, color:C.navy, border:`1.5px solid ${C.navy}`, borderRadius:R, fontSize:17, fontWeight:600, cursor:"pointer", marginTop:8 },
  divider: { border:"none", borderTop:`1px solid ${C.border}`, margin:"14px 0" },
  sectionTitle: { fontFamily:FH, fontSize:19, fontWeight:800, color:C.navy, margin:"0 0 14px" },
  row: { display:"flex", alignItems:"center", justifyContent:"space-between" },
  alertSuccess: { background:"#EAF5EE", color:C.green, border:"1px solid #BBF7D0", padding:"11px 14px", borderRadius:10, fontSize:15, fontWeight:600, marginBottom:16 },
  revenueCard: { background:C.white, border:`1px solid ${C.border}`, borderRadius:R, padding:"16px", marginBottom:12 },
  revenueLabel: { margin:"0 0 4px", fontSize:13, color:C.textSub, fontWeight:700, textTransform:"uppercase", letterSpacing:"0.06em" },
  revenueNum: { fontFamily:FH, margin:0, fontSize:28, fontWeight:800, color:C.accent, fontVariantNumeric:"tabular-nums" },
  bigCreate: { display:"flex", alignItems:"center", justifyContent:"center", gap:10, width:"100%", minHeight:56, background:C.accent, color:C.white, border:"none", borderRadius:R, fontFamily:FH, fontWeight:800, fontSize:19, cursor:"pointer", boxShadow:"0 6px 18px rgba(29,168,81,0.28)", marginBottom:16 },
  bigCreatePlus: { width:26, height:26, borderRadius:"50%", background:"rgba(255,255,255,0.22)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:700, lineHeight:1 },
  // десктоп: сайдбар менеджера
  side: { width:240, flexShrink:0, background:C.white, color:C.text, padding:"26px 20px", display:"flex", flexDirection:"column", position:"sticky", top:0, height:"100vh", borderRight:`1px solid ${C.border}` },
  sideLink: (a) => ({ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", marginBottom:4, borderRadius:10, color:a?"#fff":C.textMid, background:a?C.accent:"transparent", textDecoration:"none", fontSize:16, fontWeight:a?700:500, cursor:"pointer", border:"none", width:"100%", textAlign:"left" }),
  main: { flex:1, padding:"34px 42px", minWidth:0 },
  h1: { fontFamily:FH, fontSize:24, fontWeight:800, letterSpacing:"-0.01em", color:C.navy, margin:0 },
  h1sub: { color:C.textSub, fontSize:16, marginTop:4 },
  th: { textAlign:"left", fontSize:13, letterSpacing:"0.08em", textTransform:"uppercase", color:C.textSub, fontWeight:700, padding:"13px 18px", background:"#FAF9F7", borderBottom:`1px solid ${C.border}` },
  td: { padding:"14px 18px", borderBottom:`1px solid ${C.border}`, fontSize:16, verticalAlign:"middle" },
  loadingWrap: { display:"flex", alignItems:"center", justifyContent:"center", padding:"48px 0", color:C.textFaint },
};

function useIsDesktop() {
  const [d, setD] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 900px)');
    const h = (e) => setD(e.matches);
    if (m.addEventListener) m.addEventListener('change', h); else m.addListener(h);
    return () => { if (m.removeEventListener) m.removeEventListener('change', h); else m.removeListener(h); };
  }, []);
  return d;
}

function getToken() { return localStorage.getItem('token'); }
function setToken(t) { localStorage.setItem('token', t); }
function removeToken() { localStorage.removeItem('token'); }

async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getToken()}` },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API + path, opts);
  const data = await res.json();
  if (!res.ok) {
    // 401 на любом эндпоинте, кроме самого /api/login (там 401 значит просто
    // "неверный пароль", а не протухший/перехваченный токен) — это токен,
    // который authMiddleware больше не считает действительным: истёк, либо
    // (см. "одна сессия на аккаунт" на сервере) кто-то другой вошёл под
    // этим же логином и перехватил сессию. Раньше в этом случае экран
    // просто зависал с ошибкой в никуда на следующем действии — теперь
    // сразу сбрасываем токен и уходим на вход с понятным сообщением сервера.
    if (res.status === 401 && path !== '/api/login' && getToken()) {
      removeToken();
      try { sessionStorage.setItem('forcedLogoutMessage', data.error || 'Сессия завершена, войдите заново'); } catch(e) {}
      window.location.reload();
      // reload() не прерывает выполнение немедленно — если тут же бросить
      // ошибку, она долетит до вызвавшего кода (там обычно catch(e){alert(e.message)})
      // и покажет блокирующий alert с той же ошибкой прямо перед уходом на
      // экран входа, где она и так покажется из sessionStorage. Никогда не
      // резолвим/не отклоняем — страница всё равно сейчас перезагрузится.
      return new Promise(() => {});
    }
    throw new Error(data.error || 'Ошибка сервера');
  }
  return data;
}

// PWA "на весь экран" не перезагружает страницу при переключении на неё —
// вкладка/установленное приложение просто размораживается ОС с тем же
// React-состоянием, что было до сворачивания. Без этого хука пуш о новой
// заявке показывается, но список заявок остаётся старым, пока страницу не
// закроют и не откроют заново вручную. Дёргаем переданные загрузчики
// заново при возврате видимости — то же самое происходит и при обычном
// переключении вкладок в браузере, что тоже безвредно (просто лишний GET).
//
// На практике одних только visibilitychange/focus мало: в установленном
// на iOS PWA (Safari) переключение между приложениями не всегда честно
// шлёт эти события странице — и список опять "зависал" старым, пока не
// перезайдёшь руками. Поэтому вдобавок держим обычный интервал-опрос,
// пока вкладка видима — не зависит ни от каких платформенных нюансов
// жизненного цикла, просто гарантированно подтягивает свежие данные.
function useRefetchOnVisible(...loaders) {
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') loaders.forEach(fn => fn && fn());
    };
    document.addEventListener('visibilitychange', handler);
    window.addEventListener('focus', handler);
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') loaders.forEach(fn => fn && fn());
    }, 5000);
    return () => {
      document.removeEventListener('visibilitychange', handler);
      window.removeEventListener('focus', handler);
      clearInterval(interval);
    };
  }, loaders);
}

// Сжатие фото через canvas перед загрузкой: длинная сторона <= maxSide, JPEG с заданным качеством
function compressImage(dataUrl, maxSide, quality) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      let w = img.width, h = img.height;
      if (w > maxSide || h > maxSide) {
        if (w > h) { h = Math.round(h * maxSide / w); w = maxSide; }
        else { w = Math.round(w * maxSide / h); h = maxSide; }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
}

async function subscribeToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push API не поддерживается этим браузером' };
  }
  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    return { ok: false, error: 'requestPermission: ' + e.message };
  }
  if (permission !== 'granted') {
    return { ok: false, error: 'Разрешение не выдано (' + permission + ')' };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const { publicKey } = await apiCall('GET', '/api/push/vapid-public-key');
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    await apiCall('POST', '/api/push/subscribe', { subscription: sub });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e && e.message) || String(e) };
  }
}

async function unsubscribeFromPush() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiCall('POST', '/api/push/unsubscribe', { endpoint: sub.endpoint });
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error('Push unsubscribe failed:', e);
  }
}

function Brand({light, size}) {
  const s = size || 42;
  return (
    <div style={{display:"flex", alignItems:"center", gap:11}}>
      <img src="/icon-192.png" alt="" style={{width:s, height:s, flexShrink:0}}/>
      <div>
        <div style={{...S.headerMark, color: light ? "#fff" : C.navy}}>Жайық Ақтау</div>
        <div style={{...S.headerSub, color: light ? "#F1AAA6" : C.accent}}>құс өнімі</div>
      </div>
    </div>
  );
}

function StatusBadge({status, partial}) {
  // partial (order.partial_delivery) — заявка доставлена, но клиент принял
  // не всё (см. частичная доставка в DriverPaymentBlock/PUT
  // /api/orders/:id/status) — статус в системе остаётся "delivered", но
  // ярлык должен сразу показывать, что это не полная доставка.
  return <span style={S.badge(status)}>{partial && status==='delivered' ? 'Частично' : (SL[status]||status)}</span>;
}

function PaymentTags({payment}) {
  if (!payment) return null;
  const tags = [];
  if (payment.cash>0) tags.push({label:`Нал: ${payment.cash.toLocaleString()} ₸`, bg:C.cashGreen, color:"#15803D"});
  if (payment.qr>0)   tags.push({label:`QR: ${payment.qr.toLocaleString()} ₸`,   bg:C.qrBlue,   color:"#1D4ED8"});
  if (payment.debt>0) tags.push({label:`Долг: ${payment.debt.toLocaleString()} ₸`, bg:C.debtAmber, color:"#92400E"});
  return <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>{tags.map((t,i)=><span key={i} style={{fontSize:13,fontWeight:600,padding:"2px 8px",borderRadius:5,background:t.bg,color:t.color,whiteSpace:"nowrap"}}>{t.label}</span>)}</div>;
}

// Приманка для автозаполнения браузера: на странице сохранён пароль от
// сайта, и некоторые браузеры (Edge) игнорируют autocomplete="off"/
// type="search" на обычных полях поиска и всё равно подставляют туда
// сохранённый логин. Скрытая пара username/password перед реальным
// контентом отдаёт браузеру "законную" цель для автозаполнения вместо
// поля поиска.
function AutofillDecoy() {
  const hidden = {position:"absolute", width:1, height:1, padding:0, margin:-1, overflow:"hidden", clip:"rect(0,0,0,0)", whiteSpace:"nowrap", border:0};
  return (
    <div aria-hidden="true" style={hidden}>
      <input type="text" name="username" autoComplete="username" tabIndex="-1"/>
      <input type="password" name="password" autoComplete="current-password" tabIndex="-1"/>
    </div>
  );
}

function OrderCard({order, onOpen, onEdit}) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items||'[]') : (order.items||[]);
  const payment = typeof order.payment === 'string' ? JSON.parse(order.payment||'{}') : (order.payment||{cash:order.payment_cash||0,qr:order.payment_qr||0,debt:order.payment_debt||0});
  return (
    <div style={{...S.card, borderLeft:`4px solid ${SC[order.status]||'#999'}`}}>
      <div style={{...S.row, cursor:"pointer"}} onClick={()=>onOpen(order)}>
        <div style={{flex:1,marginRight:10}}>
          <p style={S.cardTitle}>№ {order.id} · {order.client_name||order.clientName}</p>
          <p style={S.cardSub}>{order.address} · {order.time_slot||order.timeSlot}</p>
          {order.sales_name&&<p style={{...S.cardSub,marginTop:2}}>👤 {order.sales_name}</p>}
          <p style={{...S.cardSub,marginTop:2,color:C.textFaint}}>
            Создана {fmtDT(order.created_at)||order.date}
            {order.driver_name&&order.in_transit_at?` · в работе с ${fmtDT(order.in_transit_at)}`:''}
          </p>
        </div>
        <StatusBadge status={order.status} partial={order.partial_delivery}/>
      </div>
      <p style={{margin:"8px 0 4px",fontSize:15,color:C.textSub}}>Позиций: <b style={{color:C.text}}>{items.length}</b> · Сумма: <b style={{color:C.text,fontFamily:FH,fontVariantNumeric:"tabular-nums"}}>{(order.total||0).toLocaleString()} ₸</b></p>
      <PaymentTags payment={payment}/>
      {onEdit && order.status==="new" && (
        <button onClick={e=>{e.stopPropagation();onEdit(order);}} style={{marginTop:8,padding:"6px 14px",background:C.surface,color:C.navy,border:`1px solid ${C.border}`,borderRadius:8,fontSize:14,fontWeight:600,cursor:"pointer"}}>✏️ Редактировать</button>
      )}
    </div>
  );
}

function DriverPaymentBlock({ order, onUpdateStatus }) {
  const [payType, setPayType] = useState({ cash: false, qr: false, debt: false });
  const [payAmounts, setPayAmt] = useState({ cash: "", qr: "" });
  const [photoUrl, setPhotoUrl] = useState(order.delivery_photo || null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  // Фото полученной наличности — отдельно от фото накладной (та подтверждает
  // только передачу товара, а не сумму денег), обязательно только если
  // выбрана оплата наличными (см. проверку canConfirm ниже и на сервере,
  // POST /api/orders/:id/cash-photo).
  const [cashPhotoUrl, setCashPhotoUrl] = useState(order.cash_photo || null);
  const [cashPhotoUploading, setCashPhotoUploading] = useState(false);
  const [cashPhotoError, setCashPhotoError] = useState("");
  // Фото чека оплаты по QR — та же логика, что и cashPhoto выше: обязательно
  // только если выбрана оплата по QR (см. canConfirm и на сервере, POST
  // /api/orders/:id/qr-photo).
  const [qrPhotoUrl, setQrPhotoUrl] = useState(order.qr_photo || null);
  const [qrPhotoUploading, setQrPhotoUploading] = useState(false);
  const [qrPhotoError, setQrPhotoError] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  // Пока склад не подтвердил факт. вес весовой позиции (см. POST
  // /api/orders/weights), сумма заявки — ещё оценка, а не факт: довезти
  // такую заявку нельзя, иначе оценка навсегда останется финальной (сервер
  // это тоже блокирует, см. PUT /api/orders/:id/status — здесь только
  // чтобы водитель видел причину сразу, не отправляя запрос).
  const orderItems = typeof order.items === 'string' ? JSON.parse(order.items||'[]') : (order.items||[]);
  const pendingWeightItems = orderItems.filter(it=>it.is_weight_item && !it.weight_confirmed);
  // Частичная приёмка на месте: клиент не оценил свои возможности и на
  // месте берёт не всё — вплоть до конкретной позиции (пол-короба вместо
  // короба и т.п.). По умолчанию принято "как заказано"; водитель может
  // уменьшить любую позицию вплоть до нуля, сумма и оплата пересчитываются
  // сами (см. acceptedTotal/canConfirm ниже и PUT /api/orders/:id/status
  // на сервере, куда эти количества уходят как items).
  const qtyKey = (it, i) => it.code || `i${i}`;
  const [acceptedQty, setAcceptedQty] = useState(() => {
    const init = {};
    orderItems.forEach((it, i) => { init[qtyKey(it, i)] = String(it.qty); });
    return init;
  });
  const acceptedFor = (it, i) => {
    const orderedQty = Number(it.qty) || 0;
    const raw = Number(acceptedQty[qtyKey(it, i)]);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return Math.min(raw, orderedQty);
  };
  const hasShortfall = orderItems.some((it, i) => acceptedFor(it, i) + 1e-9 < (Number(it.qty) || 0));
  const originalTotal = order.total || 0;
  const total = orderItems.reduce((s, it, i) => s + acceptedFor(it, i) * (Number(it.price) || 0), 0);
  const cashPaid = payType.cash ? Number(payAmounts.cash)||0 : 0;
  const qrPaid   = payType.qr   ? Number(payAmounts.qr)  ||0 : 0;
  const remainder = Math.max(0, total - cashPaid - qrPaid);
  const debtAmount = payType.debt ? remainder : 0;
  const hasSelection = payType.cash || payType.qr || payType.debt;
  const hasAcceptedItem = orderItems.some((it, i) => acceptedFor(it, i) > 1e-9);
  const canConfirm = hasSelection && (payType.debt || remainder === 0) && !!photoUrl && (!payType.cash || !!cashPhotoUrl) && (!payType.qr || !!qrPhotoUrl) && pendingWeightItems.length===0 && hasAcceptedItem;

  const toggleCashQr = (key) => {
    const turningOn = !payType[key];
    if (turningOn && payAmounts[key] === "") {
      const otherKey = key === 'cash' ? 'qr' : 'cash';
      const otherAmt = payType[otherKey] ? (Number(payAmounts[otherKey])||0) : 0;
      setPayAmt(a => ({...a, [key]: String(Math.max(0, total - otherAmt))}));
    } else if (!turningOn) {
      setPayAmt(a => ({...a, [key]: ""}));
    }
    setPayType(pt => ({...pt, [key]: turningOn}));
  };

  const onPhotoSelected = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setPhotoUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl, 1280, 0.75);
      const res = await apiCall('POST', `/api/orders/${order.id}/photo`, { imageBase64: compressed });
      setPhotoUrl(res.url);
    } catch(err) {
      setPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setPhotoUploading(false);
  };

  const onCashPhotoSelected = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setCashPhotoError("");
    setCashPhotoUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl, 1280, 0.75);
      const res = await apiCall('POST', `/api/orders/${order.id}/cash-photo`, { imageBase64: compressed });
      setCashPhotoUrl(res.url);
    } catch(err) {
      setCashPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setCashPhotoUploading(false);
  };

  const onQrPhotoSelected = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setQrPhotoError("");
    setQrPhotoUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl, 1280, 0.75);
      const res = await apiCall('POST', `/api/orders/${order.id}/qr-photo`, { imageBase64: compressed });
      setQrPhotoUrl(res.url);
    } catch(err) {
      setQrPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setQrPhotoUploading(false);
  };

  const changeStatus = async (status, payment, confirmMsg, items) => {
    if (statusBusy) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setStatusBusy(true);
    try {
      await onUpdateStatus(order.id, status, payment, undefined, items);
    } finally {
      setStatusBusy(false);
    }
  };

  return (
    <div style={{marginTop:20}}>
      {pendingWeightItems.length>0&&(
        <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 12px",marginBottom:14,fontSize:14,color:"#92400E",fontWeight:600}}>
          ⚖️ Склад ещё не подтвердил факт. вес: {pendingWeightItems.map(it=>it.name).join(', ')}. Доставка недоступна, пока склад не введёт вес.
        </div>
      )}
      {pendingWeightItems.length===0&&(
        <div style={{marginBottom:14}}>
          <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:C.navy}}>Что реально забрал клиент{hasShortfall&&<span style={{color:"#7C3AED",fontWeight:400}}> — сумма пересчитана</span>}</p>
          {orderItems.map((it,i)=>{
            const key = qtyKey(it,i);
            const unit = it.is_weight_item?"кг":"шт";
            const orderedQty = Number(it.qty)||0;
            const accepted = acceptedFor(it,i);
            const short = accepted + 1e-9 < orderedQty;
            return (
              <div key={key} style={{padding:"10px 12px",borderRadius:10,background:short?"#F5F3FF":C.surface,border:`1px solid ${short?"#DDD6FE":C.border}`,marginBottom:8}}>
                <div style={{...S.row,marginBottom:8}}>
                  <span style={{fontSize:14,fontWeight:600,color:C.text}}>{it.name}</span>
                  <span style={{fontSize:13,color:C.textFaint,whiteSpace:"nowrap"}}>заказано {orderedQty} {unit}</span>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                  <input type="number" min="0" max={orderedQty} step={it.is_weight_item?"0.1":"0.5"} value={acceptedQty[key]} onFocus={e=>e.target.select()}
                    onChange={e=>setAcceptedQty(a=>({...a,[key]:e.target.value}))}
                    style={{...S.input,width:88,padding:"7px 8px",fontSize:15,fontWeight:700,textAlign:"right"}}/>
                  <span style={{fontSize:14,color:C.textFaint}}>{unit}</span>
                  <button type="button" onClick={()=>setAcceptedQty(a=>({...a,[key]:String(orderedQty)}))} style={{...S.btnOutline,padding:"6px 10px",fontSize:13,width:"auto"}}>Весь</button>
                  <button type="button" onClick={()=>setAcceptedQty(a=>({...a,[key]:String(Math.round(orderedQty/2*100)/100)}))} style={{...S.btnOutline,padding:"6px 10px",fontSize:13,width:"auto"}}>Половину</button>
                  <button type="button" onClick={()=>setAcceptedQty(a=>({...a,[key]:"0"}))} style={{...S.btnOutline,padding:"6px 10px",fontSize:13,width:"auto",borderColor:C.red,color:C.red}}>Ничего</button>
                </div>
              </div>
            );
          })}
          {!hasAcceptedItem&&<p style={{margin:"4px 0 0",fontSize:14,color:C.red}}>Клиент не принял ни одной позиции — это отказ, оформите возврат по всей заявке кнопкой ниже, а не доставку.</p>}
        </div>
      )}
      <p style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:C.navy}}>Способ оплаты: {!hasSelection&&<span style={{color:C.red,fontWeight:400}}>(выберите хотя бы один)</span>}</p>
      {[{key:"cash",label:"Наличка",icon:"💵",bg:C.cashGreen,col:"#15803D"},{key:"qr",label:"QR код",icon:"📲",bg:C.qrBlue,col:"#1D4ED8"}].map(({key,label,icon,bg,col})=>(
        <div key={key} style={{marginBottom:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <div onClick={()=>toggleCashQr(key)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${payType[key]?col:C.border}`,background:payType[key]?col:C.white,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
              {payType[key]&&<span style={{color:C.white,fontSize:15,fontWeight:700}}>✓</span>}
            </div>
            <span style={{fontSize:16,fontWeight:600,color:payType[key]?col:C.textMid}}>{icon} {label}</span>
            {payType[key]&&<input style={{flex:1,border:`1.5px solid ${col}40`,borderRadius:6,padding:"6px 10px",fontSize:16,fontWeight:600,outline:"none",background:bg,color:col}} placeholder="Сумма ₸" value={payAmounts[key]} onFocus={e=>e.target.select()} onChange={e=>setPayAmt(a=>({...a,[key]:e.target.value}))}/>}
          </div>
        </div>
      ))}
      <div style={{marginBottom:10}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div onClick={()=>setPayType(pt=>({...pt,debt:!pt.debt}))} style={{width:22,height:22,borderRadius:6,border:`2px solid ${payType.debt?"#92400E":C.border}`,background:payType.debt?"#92400E":C.white,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
            {payType.debt&&<span style={{color:C.white,fontSize:15,fontWeight:700}}>✓</span>}
          </div>
          <span style={{fontSize:16,fontWeight:600,color:payType.debt?"#92400E":C.textMid}}>📋 Долг {payType.debt&&`(${remainder.toLocaleString()} ₸ — остаток посчитан сам)`}</span>
        </div>
      </div>
      <div style={{padding:"12px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`,marginBottom:14}}>
        <div style={{...S.row,marginBottom:6}}>
          <span style={{fontSize:14,color:C.textSub}}>Сумма заявки</span>
          <span style={{fontWeight:700,fontFamily:FH}}>
            {hasShortfall&&<span style={{textDecoration:"line-through",color:C.textFaint,marginRight:6,fontWeight:400}}>{originalTotal.toLocaleString()} ₸</span>}
            {total.toLocaleString()} ₸
          </span>
        </div>
        <div style={{...S.row,paddingTop:6,borderTop:`1px solid ${C.border}`}}>
          <span style={{fontSize:15,fontWeight:700,color:debtAmount>0?"#92400E":(remainder>0?C.red:C.green)}}>{debtAmount>0?"📋 Долг":(remainder>0?"⚠️ Не хватает суммы":"✅ Полностью оплачено")}</span>
          {(debtAmount>0||remainder>0)&&<span style={{fontWeight:800,fontSize:17,fontFamily:FH,color:debtAmount>0?"#92400E":C.red}}>{(debtAmount>0?debtAmount:remainder).toLocaleString()} ₸</span>}
        </div>
      </div>
      <div style={{marginBottom:14}}>
        <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:C.navy}}>Фото подписанной накладной: {!photoUrl&&<span style={{color:C.red,fontWeight:400}}>(обязательно)</span>}</p>
        {photoUrl&&(
          <div style={{marginBottom:8}}>
            <img src={photoUrl} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:10,border:`1px solid ${C.border}`}}/>
          </div>
        )}
        <input type="file" accept="image/*" capture="environment" id={`photoInput_${order.id}`} style={{display:"none"}} onChange={onPhotoSelected}/>
        <button type="button" disabled={photoUploading} onClick={()=>document.getElementById(`photoInput_${order.id}`).click()} style={{...S.btnOutline,opacity:photoUploading?0.5:1,cursor:photoUploading?"not-allowed":"pointer"}}>
          {photoUploading?"Загрузка...":(photoUrl?"📷 Переснять фото":"📷 Сфотографировать накладную")}
        </button>
        {photoError&&<p style={{margin:"6px 0 0",fontSize:14,color:C.red}}>{photoError}</p>}
      </div>
      {payType.cash&&(
        <div style={{marginBottom:14}}>
          <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:C.navy}}>Фото полученной наличности: {!cashPhotoUrl&&<span style={{color:C.red,fontWeight:400}}>(обязательно при оплате налом)</span>}</p>
          {cashPhotoUrl&&(
            <div style={{marginBottom:8}}>
              <img src={cashPhotoUrl} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:10,border:`1px solid ${C.border}`}}/>
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" id={`cashPhotoInput_${order.id}`} style={{display:"none"}} onChange={onCashPhotoSelected}/>
          <button type="button" disabled={cashPhotoUploading} onClick={()=>document.getElementById(`cashPhotoInput_${order.id}`).click()} style={{...S.btnOutline,opacity:cashPhotoUploading?0.5:1,cursor:cashPhotoUploading?"not-allowed":"pointer"}}>
            {cashPhotoUploading?"Загрузка...":(cashPhotoUrl?"💵 Переснять фото":"💵 Сфотографировать наличность")}
          </button>
          {cashPhotoError&&<p style={{margin:"6px 0 0",fontSize:14,color:C.red}}>{cashPhotoError}</p>}
        </div>
      )}
      {payType.qr&&(
        <div style={{marginBottom:14}}>
          <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:C.navy}}>Фото чека оплаты по QR: {!qrPhotoUrl&&<span style={{color:C.red,fontWeight:400}}>(обязательно при оплате по QR)</span>}</p>
          {qrPhotoUrl&&(
            <div style={{marginBottom:8}}>
              <img src={qrPhotoUrl} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:10,border:`1px solid ${C.border}`}}/>
            </div>
          )}
          <input type="file" accept="image/*" capture="environment" id={`qrPhotoInput_${order.id}`} style={{display:"none"}} onChange={onQrPhotoSelected}/>
          <input type="file" accept="image/*" id={`qrPhotoGalleryInput_${order.id}`} style={{display:"none"}} onChange={onQrPhotoSelected}/>
          <div style={{display:"flex",gap:8}}>
            <button type="button" disabled={qrPhotoUploading} onClick={()=>document.getElementById(`qrPhotoInput_${order.id}`).click()} style={{...S.btnOutline,flex:1,opacity:qrPhotoUploading?0.5:1,cursor:qrPhotoUploading?"not-allowed":"pointer"}}>
              {qrPhotoUploading?"Загрузка...":(qrPhotoUrl?"📲 Переснять фото":"📲 Сфотографировать чек")}
            </button>
            <button type="button" disabled={qrPhotoUploading} onClick={()=>document.getElementById(`qrPhotoGalleryInput_${order.id}`).click()} style={{...S.btnOutline,flex:1,opacity:qrPhotoUploading?0.5:1,cursor:qrPhotoUploading?"not-allowed":"pointer"}}>
              🖼️ Из галереи
            </button>
          </div>
          {qrPhotoError&&<p style={{margin:"6px 0 0",fontSize:14,color:C.red}}>{qrPhotoError}</p>}
        </div>
      )}
      <button style={{...S.btnSuccess,opacity:(canConfirm&&!statusBusy)?1:0.4,cursor:(canConfirm&&!statusBusy)?"pointer":"not-allowed"}} disabled={!canConfirm||statusBusy} onClick={()=>changeStatus("delivered",{cash:cashPaid,qr:qrPaid,debt:debtAmount},
        hasShortfall
          ? `Подтвердить ЧАСТИЧНУЮ доставку заявки № ${order.id} на ${total.toLocaleString()} ₸ (из ${originalTotal.toLocaleString()} ₸)? Непринятое клиентом останется на складе, оплату потом не изменить.`
          : `Подтвердить доставку заявки № ${order.id} на ${total.toLocaleString()} ₸? Остаток на складе спишется, оплату потом не изменить.`,
        orderItems.map((it,i)=>({code: it.code, qty: acceptedFor(it,i)}))
      )}>{statusBusy?"Сохранение...":(hasShortfall?"✅ Подтвердить частичную доставку":"✅ Подтвердить доставку")}</button>
      <button style={{...S.btnOutline,borderColor:"#7C3AED",color:"#7C3AED",marginTop:8,opacity:statusBusy?0.5:1,cursor:statusBusy?"not-allowed":"pointer"}} disabled={statusBusy} onClick={()=>changeStatus("returned",null,`Оформить возврат по заявке № ${order.id}? Действие нельзя отменить.`)}>↩️ Оформить возврат</button>
    </div>
  );
}

// Компактный формат даты+времени для created_at/in_transit_at (ISO-строка) —
// "06.09 14:32", без года (эти метки нужны для операционной сверки в
// пределах текущего сезона, не как архивная дата).
function fmtDT(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function daysWord(n) {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return "дней";
  const mod10 = n % 10;
  if (mod10 === 1) return "день";
  if (mod10 >= 2 && mod10 <= 4) return "дня";
  return "дней";
}

// Остаток для показа персоналу при выборе товара. У обычного товара — короба́/шт
// из stock (p.stock), их присылает 1С синком, число всегда свежее. У весового
// товара (priced_by_weight) короба́ 1С не считает вообще (см. /api/stock/sync
// на сервере) — их только вручную поддерживает склад на "Остатках", и они
// быстро расходятся с реальностью. Единственное число, которое 1С обновляет
// для весового товара — кг (p.stock_weight_kg), поэтому для него и показываем
// именно его, а не устаревающие короба́.
function stockAmount(p) {
  return p.priced_by_weight ? p.stock_weight_kg : p.stock;
}
// Остатки копятся многолетней арифметикой +/- на сервере (см. round2 в
// server.js) — округляем и на выводе, на случай уже накопленной в базе
// погрешности вида 230.92000000000002, чтобы персонал не путал её с
// реальным остатком.
function round2(n) {
  return n == null ? n : Math.round(Number(n) * 100) / 100;
}
// Общая формула для обоих мест, где кг-остаток весового товара показывается
// персоналу в виде "≈ N кор (W кг)" (stockLabel ниже и строка товара в
// SalesCabinet, у которой поля называются иначе, чем в карточке товара) —
// один разошедшийся дубль формулы уже приводил к рассинхрону округления.
function formatWeightStock(amountKg, avgBoxWeight) {
  if (amountKg == null) return null;
  const kg = round2(amountKg);
  if (avgBoxWeight > 0) {
    const boxes = Math.floor(kg / avgBoxWeight);
    return `≈ ${boxes} кор (${kg} кг)`;
  }
  return `${kg} кг`;
}
function stockLabel(p) {
  const amt = stockAmount(p);
  if (amt == null) return null;
  if (!p.priced_by_weight) return String(amt);
  // Персоналу привычнее прикидывать в коробах, а не в кг — если менеджер
  // задал средний вес короба на вкладке "Товары" (avg_box_weight; вес
  // каждый раз разный, это только грубая прикидка, не точное число),
  // считаем оценку коробов от актуального кг-остатка. Без этого поля
  // показываем как есть, в кг.
  return formatWeightStock(amt, p.avg_box_weight);
}
function stockIsOut(p) {
  // Развесной товар без настроенного кг-пула (weight_kg ещё ни разу не
  // вписан на "Остатках", хотя флаг "Весовой товар" уже стоит) — это не
  // "остаток неизвестен, значит бесконечно доступен", а безопасный дефолт
  // "нет в наличии" (тот же, что раньше давал stock=0 у непроинициализи-
  // рованной записи в stock, прежде чем этот файл начал смотреть на кг).
  if (p.priced_by_weight) return p.stock_weight_kg == null || p.stock_weight_kg <= 0;
  return p.stock != null && p.stock <= 0;
}

function DebtsPanel({ readOnly, role }) {
  const [debts, setDebts] = useState([]);
  const [loadingDebts, setLoadingDebts] = useState(true);
  // Отбор по дате возникновения долга (d.date — дата заявки/чека), тот же
  // паттерн день/неделя/месяц/свободный, что уже используется в отчётах
  // (см. applyAdminPreset/applyStorePreset/applySalesPreset). "Все" —
  // дефолт: долг числится, пока не погашен, независимо от того, когда
  // возник, так что сужать список по умолчанию до "сегодня" не нужно —
  // иначе большинство должников молча пропадало бы из вида.
  const todayStr = new Date().toISOString().slice(0,10);
  const [debtDateFrom, setDebtDateFrom] = useState(todayStr);
  const [debtDateTo, setDebtDateTo] = useState(todayStr);
  const [debtDatePreset, setDebtDatePreset] = useState("all");
  const applyDebtDatePreset = (preset) => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);
    else if (preset === "month") from.setDate(now.getDate() - 29);
    setDebtDatePreset(preset);
    if (preset !== "custom" && preset !== "all") {
      setDebtDateFrom(from.toISOString().slice(0,10));
      setDebtDateTo(todayStr);
    }
  };
  const [settleAmounts, setSettleAmounts] = useState({});
  const [settleMethod, setSettleMethod] = useState({});
  const [savingId, setSavingId] = useState(null);
  const [clientSettleAmounts, setClientSettleAmounts] = useState({});
  const [clientSettleMethod, setClientSettleMethod] = useState({});
  const [savingClientKey, setSavingClientKey] = useState(null);

  const loadDebts = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/debts');
      setDebts(data);
    } catch(e) {}
    setLoadingDebts(false);
  }, []);
  useEffect(()=>{ loadDebts(); }, []);

  // История погашений с возможностью исправить ошибочно введённую сумму —
  // только там, где панель встроена в кабинет с ролями (role передан:
  // admin/manager/operator), а не в её readOnly-показах торговому/водителю.
  // Исправлять сумму может только администратор (см. PUT
  // /api/debt-settlements/:id на сервере) — оператору задним числом менять
  // цифры нельзя, чтобы долг нельзя было тихо списать самому себе.
  const [settlements, setSettlements] = useState([]);
  const [loadingSettlements, setLoadingSettlements] = useState(true);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [correctingId, setCorrectingId] = useState(null);
  const [correctAmount, setCorrectAmount] = useState("");
  const [savingCorrection, setSavingCorrection] = useState(false);
  const loadSettlements = useCallback(async () => {
    try { setSettlements(await apiCall('GET','/api/debt-settlements')); } catch(e) {}
    setLoadingSettlements(false);
  }, []);
  useEffect(()=>{ if (role) loadSettlements(); }, []);

  // История "написал в WhatsApp" (см. POST /api/debt-reminders) — операторы
  // путаются, кому уже напоминали сегодня; last_reminder_at/today на каждом
  // d уже приходит из GET /api/debts (см. sendReminder ниже, бейдж прямо на
  // карточке), а это — полный список за все дни, для отдельной вкладки
  // "История напоминаний" (аналог истории погашений выше).
  const [reminders, setReminders] = useState([]);
  const [loadingReminders, setLoadingReminders] = useState(true);
  const [remindersHistoryOpen, setRemindersHistoryOpen] = useState(false);
  const loadReminders = useCallback(async () => {
    try { setReminders(await apiCall('GET','/api/debt-reminders')); } catch(e) {}
    setLoadingReminders(false);
  }, []);
  useEffect(()=>{ if (role) loadReminders(); }, []);

  // Отправка напоминания в WhatsApp — если по этому долгу СЕГОДНЯ уже
  // писали (last_reminder_today, см. GET /api/debts), переспрашиваем перед
  // повторной отправкой, чтобы два оператора не написали одному должнику
  // одно и то же вслепую. Завтра last_reminder_today само станет false —
  // напоминание раз в день это нормальный рабочий процесс, не ошибка.
  const sendReminder = async (d) => {
    if (d.last_reminder_today) {
      const when = new Date(d.last_reminder_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
      if (!window.confirm(`Сегодня в ${when} должнику «${d.client_name}» уже писали (${d.last_reminder_by_name}). Отправить ещё раз?`)) return;
    }
    // Слушатели возврата на вкладку регистрируем ДО открытия WhatsApp
    // (см. waitForReturn) — иначе можно пропустить момент переключения.
    const returned = waitForReturn();
    await shareDebtReminder(d);
    await returned;
    // Сайт не видит, что реально произошло внутри WhatsApp — спрашиваем
    // оператора напрямую, вместо того чтобы считать открытие ссылки
    // отправкой (см. комментарий у shareDebtReminder). "Нет" — ничего не
    // пишем, карточка должника останется как есть.
    if (window.confirm(`Отправили сообщение в WhatsApp должнику «${d.client_name}»?`)) {
      try {
        await apiCall('POST', '/api/debt-reminders', { orderId: d.order_id||undefined, saleId: d.sale_id||undefined });
      } catch(e) {}
    }
    loadDebts();
    if (role) loadReminders();
  };
  // Звонок должнику — номер тот же, что торговый вписал при оформлении
  // заявки (contact_phone, см. GET /api/debts). Спрашиваем подтверждение,
  // чтобы случайное нажатие не запускало звонок сразу, и открываем tel: —
  // дальше сам звонок идёт с личного телефона оператора, не через сайт.
  const callDebtor = (d) => {
    const link = telLink(d.contact_phone);
    if (!link) return;
    if (!window.confirm(`Позвонить «${d.client_name}» по номеру ${d.contact_phone}?`)) return;
    window.location.href = link;
  };
  const saveCorrection = async (s) => {
    const amount = Number(correctAmount);
    if (!amount || amount<=0) return;
    if (!window.confirm(`Исправить сумму погашения «${s.client_name}» с ${s.amount.toLocaleString()} на ${amount.toLocaleString()} ₸?`)) return;
    setSavingCorrection(true);
    try {
      await apiCall('PUT', `/api/debt-settlements/${s.id}`, { amount });
      await Promise.all([loadSettlements(), loadDebts()]);
      setCorrectingId(null); setCorrectAmount("");
    } catch(e) { alert(e.message); }
    setSavingCorrection(false);
  };

  // /api/debts отдаёт по одной строке на каждую накладную/продажу с долгом —
  // если один и тот же должник числится в двух заявках, ниже будет две
  // отдельные карточки (это осознанно: у каждой своя дата/сумма/накладная и
  // гасится долг тоже по накладной отдельно). Чтобы не потерять из виду,
  // что это один и тот же клиент, считаем сумму и количество по коду
  // клиента и показываем сводку прямо в каждой карточке этого клиента.
  // Группировать по client_name нельзя: продажи кассы без выбранного
  // клиента все приходят с одинаковым именем "Без клиента" (см. сервер) —
  // это разные люди, их долги схлопнулись бы в один. У записей без кода
  // клиента (client_code пуст) группы вообще нет — каждая сама по себе.
  const groupKey = (d) => d.client_code ? `c${d.client_code}` : (d.order_id ? `o${d.order_id}` : `s${d.sale_id}`);
  const totalsByClient = useMemo(() => {
    const totals = {}, counts = {};
    debts.forEach(d => {
      const key = groupKey(d);
      totals[key] = (totals[key]||0) + d.remaining;
      counts[key] = (counts[key]||0) + 1;
    });
    return { totals, counts };
  }, [debts]);

  // Отбор по торговому — список берём прямо из самих долгов (sales_id/name
  // приходит с /api/debts для заявок, см. сервер), отдельный запрос за
  // списком сотрудников не нужен: operator, которому тоже доступна эта
  // панель, не имеет доступа к /api/users. "Всего по клиенту" выше
  // считается по полному списку долгов независимо от этого фильтра — это
  // реальный суммарный долг клиента, а не только по видимым сейчас карточкам.
  const [salesFilter, setSalesFilter] = useState("");
  const salesReps = useMemo(() => {
    const map = {};
    debts.forEach(d => { if (d.sales_id) map[d.sales_id] = d.sales_name; });
    return Object.entries(map).map(([id,name])=>({id,name})).sort((a,b)=>a.name.localeCompare(b.name,'ru'));
  }, [debts]);
  // Если у выбранного торгового погасили все долги (обычное дело), он
  // пропадает из salesReps и из выпадающего списка — без сброса фильтр
  // остался бы висеть на исчезнувшем id, а <select> тем временем визуально
  // показывал бы "Все торговые" (раз такого value нет среди option), пока
  // список на самом деле продолжал бы фильтроваться по старому id.
  useEffect(() => {
    if (salesFilter && !salesReps.some(r => r.id === salesFilter)) setSalesFilter("");
  }, [salesReps, salesFilter]);
  // Кассовые долги (sale_id, sales_id всегда null — см. сервер) не привязаны
  // ни к какому торговому, поэтому остаются видны при любом фильтре, а не
  // прячутся вместе с заявками остальных торговых.
  const bySalesFilter = salesFilter ? debts.filter(d=>!d.sales_id||String(d.sales_id)===salesFilter) : debts;
  const byDateFilter = debtDatePreset === "all" ? bySalesFilter : bySalesFilter.filter(d => d.date >= debtDateFrom && d.date <= debtDateTo);
  // Поиск по контрагенту — список должников может быть длинным, искать
  // конкретного клиента прокруткой и глазами неудобно. Ищем и по имени, и
  // по коду клиента (тем же, что показан в "Всего по клиенту"), но не по
  // номеру заявки/чека — это отдельный, более узкий поиск, не то, что
  // обычно вспоминают в первую очередь про должника.
  const [clientSearch, setClientSearch] = useState("");
  const q = clientSearch.trim().toLowerCase();
  const visibleDebts = !q ? byDateFilter : byDateFilter.filter(d =>
    (d.client_name||'').toLowerCase().includes(q) || (d.client_code||'').toLowerCase().includes(q)
  );

  const settle = async (d) => {
    const key = d.order_id ? `o${d.order_id}` : `s${d.sale_id}`;
    const amount = Number(settleAmounts[key] ?? d.remaining);
    const method = settleMethod[key] || 'cash';
    if (!amount || amount<=0) return;
    const full = amount >= d.remaining;
    if (!window.confirm(`Погасить ${full?'весь':'частично'} долг «${d.client_name}» на ${amount.toLocaleString()} ₸ (${method==='cash'?'наличными':'безналом'})?`)) return;
    setSavingId(key);
    try {
      await apiCall('POST', '/api/debts/settle', { orderId: d.order_id||undefined, saleId: d.sale_id||undefined, amount, method });
      await loadDebts();
      setSettleAmounts(a=>({...a,[key]:''}));
    } catch(e) { alert(e.message); }
    setSavingId(null);
  };

  // Погашение "по клиенту одной суммой" — вместо того чтобы вручную считать
  // и разносить оплату по каждой накладной, оператор вводит общую сумму, а
  // сервер сам раскладывает её от старой накладной к новой (см.
  // POST /api/debts/settle-client). Кнопка показывается один раз на клиента
  // (на первой попавшейся в списке карточке) и только если у него больше
  // одной накладной с долгом — иначе это то же самое, что обычное "Погасить".
  const settleClient = async (d) => {
    const key = groupKey(d);
    const total = totalsByClient.totals[key] || 0;
    const amount = Number(clientSettleAmounts[key] ?? total);
    const method = clientSettleMethod[key] || 'cash';
    if (!amount || amount<=0) return;
    const full = amount >= total;
    if (!window.confirm(`Погасить ${full?'весь':'частично'} долг «${d.client_name}» на ${amount.toLocaleString()} ₸ (${method==='cash'?'наличными':'безналом'})? Сумма распределится по накладным от старых к новым.`)) return;
    setSavingClientKey(key);
    try {
      const res = await apiCall('POST', '/api/debts/settle-client', { clientCode: d.client_code, amount, method });
      await loadDebts();
      setClientSettleAmounts(a=>({...a,[key]:''}));
      if (res.unallocated > 0) alert(`Долг клиента оказался меньше введённой суммы — реально погашено ${(amount-res.unallocated).toLocaleString()} ₸, остаток ${res.unallocated.toLocaleString()} ₸ не с чем зачесть.`);
    } catch(e) { alert(e.message); }
    setSavingClientKey(null);
  };
  const renderedGroups = new Set();

  return (
    <>
      <p style={S.sectionTitle}>Должники</p>
      <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
        <input
          type="search"
          style={{...S.input,flex:1,minWidth:200}}
          placeholder="Поиск по контрагенту..."
          value={clientSearch}
          onChange={e=>setClientSearch(e.target.value)}
          autoComplete="off"
        />
        <select style={{...S.select,width:"auto",minWidth:200}} value={salesFilter} onChange={e=>setSalesFilter(e.target.value)}>
          <option value="">Все торговые</option>
          {salesReps.map(r=><option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>
      <div style={{marginBottom:16,maxWidth:420}}>
        <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
          {[["all","Все"],["day","День"],["week","Неделя"],["month","Месяц"],["custom","Свободный отбор"]].map(([k,lb])=>(
            <button key={k} onClick={()=>applyDebtDatePreset(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${debtDatePreset===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:debtDatePreset===k?C.navy:C.white,color:debtDatePreset===k?C.white:C.textMid}}>{lb}</button>
          ))}
        </div>
        {debtDatePreset==="custom"&&(
          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            <div style={{flex:1,minWidth:120}}>
              <label style={{...S.label,marginBottom:4}}>С</label>
              <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={debtDateFrom} onChange={e=>setDebtDateFrom(e.target.value)}/>
            </div>
            <div style={{flex:1,minWidth:120}}>
              <label style={{...S.label,marginBottom:4}}>По</label>
              <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={debtDateTo} onChange={e=>setDebtDateTo(e.target.value)}/>
            </div>
          </div>
        )}
      </div>
      {loadingDebts?<div style={S.loadingWrap}>Загрузка...</div>:visibleDebts.length===0?<div style={{textAlign:"center",padding:"24px 0",color:C.textFaint}}>{debtDatePreset==="all"?"Долгов нет":"Долгов за этот период нет"}</div>:
        visibleDebts.map(d=>{
          const key = d.order_id ? `o${d.order_id}` : `s${d.sale_id}`;
          const gKey = groupKey(d);
          const isFirstOfGroup = !renderedGroups.has(gKey);
          renderedGroups.add(gKey);
          const showBulkSettle = !readOnly && isFirstOfGroup && !!d.client_code && totalsByClient.counts[gKey]>1;
          return (
          <div key={key} style={{...S.card, borderLeft: d.overdue?`4px solid ${C.red}`:"4px solid #F59E0B", background: d.overdue?"#FEF2F2":C.white}}>
            <div style={S.row}>
              <div>
                <p style={S.cardTitle}>{d.client_name} {d.overdue&&<span style={{color:C.red,fontSize:13,fontWeight:700}}>· ПРОСРОЧЕН</span>}</p>
                <p style={{...S.cardSub,color:d.overdue?"#B91C1C":C.textSub}}>{d.order_id?`№ ${d.order_id}`:`Касса № ${d.sale_id}`} · {d.date} · {d.days_ago===0?'сегодня':`${d.days_ago} ${daysWord(d.days_ago)}`}{d.settled>0?` · погашено ${d.settled.toLocaleString()} ₸`:''}</p>
                {totalsByClient.counts[groupKey(d)]>1&&<p style={{margin:"2px 0 0",fontSize:13,fontWeight:700,color:C.textFaint}}>Всего по клиенту: {totalsByClient.totals[groupKey(d)].toLocaleString()} ₸ · {totalsByClient.counts[groupKey(d)]} накладным</p>}
              </div>
              <p style={{margin:0,fontWeight:800,fontFamily:FH,color:d.overdue?C.red:"#92400E"}}>{d.remaining.toLocaleString()} ₸</p>
            </div>
            {showBulkSettle&&(
              <div style={{marginTop:10,paddingTop:10,borderTop:`1px dashed ${C.border}`}}>
                <p style={{margin:"0 0 6px",fontSize:13,fontWeight:700,color:C.navy}}>💰 Погасить по клиенту одной суммой — распределится по {totalsByClient.counts[gKey]} накладным от старых к новым</p>
                <div style={{display:"flex",gap:6}}>
                  <input type="number" style={{...S.input,padding:"7px 8px",fontSize:14}} placeholder={`До ${totalsByClient.totals[gKey]}`} value={clientSettleAmounts[gKey]||''} onFocus={e=>e.target.select()} onChange={e=>setClientSettleAmounts(a=>({...a,[gKey]:e.target.value}))}/>
                  <select style={{...S.select,padding:"7px 8px",fontSize:14,width:110}} value={clientSettleMethod[gKey]||'cash'} onChange={e=>setClientSettleMethod(m=>({...m,[gKey]:e.target.value}))}>
                    <option value="cash">Нал</option>
                    <option value="qr">Безнал</option>
                  </select>
                  <button style={{...S.btnPrimary,padding:"7px 14px",fontSize:14,width:"auto",whiteSpace:"nowrap",marginTop:0,boxShadow:"none",opacity:savingClientKey===gKey?0.5:1}} disabled={savingClientKey===gKey} onClick={()=>settleClient(d)}>Погасить по клиенту</button>
                </div>
              </div>
            )}
            {(d.delivery_photo||d.contact_phone)&&(
              <div style={{display:"flex",gap:14,flexWrap:"wrap",marginTop:8,alignItems:"center"}}>
                {d.delivery_photo&&(
                  <a href={d.delivery_photo} target="_blank" rel="noopener noreferrer" download style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:14,fontWeight:600,color:C.navy,textDecoration:"none"}}>📄 Накладная</a>
                )}
                {telLink(d.contact_phone)&&(
                  <button onClick={()=>callDebtor(d)} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:14,fontWeight:600,color:C.navy,background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit"}}>📞 {d.contact_phone}</button>
                )}
                {waMeLink(d.contact_phone,debtReminderText(d))&&(
                  <button onClick={()=>sendReminder(d)} style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:14,fontWeight:600,color:"#25D366",background:"none",border:"none",padding:0,cursor:"pointer",fontFamily:"inherit"}}>💬 Написать в WhatsApp</button>
                )}
                {d.last_reminder_at&&(
                  // Видно прямо в списке, не нужно ничего открывать — именно
                  // то, чего не хватало операторам (см. sendReminder выше):
                  // "сегодня" — заметный зелёный бейдж, более старое
                  // напоминание — приглушённая справочная строка.
                  d.last_reminder_today ? (
                    <span style={{fontSize:13,fontWeight:700,color:"#15803D",background:"#EAF5EE",padding:"3px 8px",borderRadius:99}}>
                      ✓ Сегодня в {new Date(d.last_reminder_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} ({d.last_reminder_by_name})
                    </span>
                  ) : (
                    <span style={{fontSize:13,color:C.textFaint}}>
                      Писали {fmtDT(d.last_reminder_at)} ({d.last_reminder_by_name})
                    </span>
                  )
                )}
              </div>
            )}
            {!readOnly&&(
              <div style={{display:"flex",gap:6,marginTop:10}}>
                <input type="number" style={{...S.input,padding:"7px 8px",fontSize:14}} placeholder={`До ${d.remaining}`} value={settleAmounts[key]||''} onFocus={e=>e.target.select()} onChange={e=>setSettleAmounts(a=>({...a,[key]:e.target.value}))}/>
                <select style={{...S.select,padding:"7px 8px",fontSize:14,width:110}} value={settleMethod[key]||'cash'} onChange={e=>setSettleMethod(m=>({...m,[key]:e.target.value}))}>
                  <option value="cash">Нал</option>
                  <option value="qr">Безнал</option>
                </select>
                <button style={{...S.btnPrimary,padding:"7px 14px",fontSize:14,width:"auto",whiteSpace:"nowrap",marginTop:0,boxShadow:"none",opacity:savingId===key?0.5:1}} disabled={savingId===key} onClick={()=>settle(d)}>Погасить</button>
              </div>
            )}
          </div>
          );
        })
      }
      {role && (
        <div style={{...S.card, padding:0, marginTop:16, overflow:"hidden"}}>
          <div onClick={()=>setHistoryOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",cursor:"pointer",background:C.surface}}>
            <span style={{fontSize:15,fontWeight:700,color:C.navy}}>🧾 История погашений долгов</span>
            <span style={{fontSize:14,color:C.textFaint}}>{historyOpen?"▲ Свернуть":"▼ Показать"}</span>
          </div>
          {historyOpen && (
            <div style={{padding:10,maxHeight:420,overflowY:"auto",borderTop:`1px solid ${C.border}`}}>
              {loadingSettlements?<div style={S.loadingWrap}>Загрузка...</div>
                :settlements.length===0?<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint}}>Погашений пока нет</div>
                :settlements.slice().reverse().map(s=>(
                  <div key={s.id} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                      <span style={{color:C.text,fontWeight:600,overflowWrap:"anywhere"}}>{s.client_name}</span>
                      <span style={{color:C.navy,fontWeight:700,whiteSpace:"nowrap"}}>{s.amount.toLocaleString()} ₸</span>
                    </div>
                    <div style={{color:C.textFaint,fontSize:13,marginTop:2}}>
                      {s.order_id?`Заявка №${s.order_id}`:`Касса №${s.sale_id}`} · {s.method==='cash'?'наличные':'безнал'} · {s.date} · {s.settled_by}
                      {s.corrected_by_name&&` · исправлено: ${s.corrected_by_name}, было ${s.original_amount.toLocaleString()} ₸`}
                    </div>
                    {role==="admin" && (
                      correctingId===s.id ? (
                        <div style={{display:"flex",gap:6,marginTop:6}}>
                          <input type="number" autoFocus style={{...S.input,padding:"6px 8px",fontSize:14}} placeholder="Правильная сумма, ₸" value={correctAmount} onChange={e=>setCorrectAmount(e.target.value)} onFocus={e=>e.target.select()}/>
                          <button disabled={savingCorrection||!correctAmount} style={{...S.btnPrimary,width:"auto",marginTop:0,padding:"6px 14px",fontSize:14,opacity:(savingCorrection||!correctAmount)?0.5:1}} onClick={()=>saveCorrection(s)}>{savingCorrection?"...":"Сохранить"}</button>
                          <button disabled={savingCorrection} style={{...S.btnSecondary,width:"auto",marginTop:0,padding:"6px 14px",fontSize:14}} onClick={()=>{setCorrectingId(null);setCorrectAmount("");}}>Отмена</button>
                        </div>
                      ) : (
                        <p style={{margin:"4px 0 0",fontSize:13,color:C.navy,fontWeight:600,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{setCorrectingId(s.id);setCorrectAmount(String(s.amount));}}>исправить сумму</p>
                      )
                    )}
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
      {role && (
        <div style={{...S.card, padding:0, marginTop:16, overflow:"hidden"}}>
          <div onClick={()=>setRemindersHistoryOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",cursor:"pointer",background:C.surface}}>
            <span style={{fontSize:15,fontWeight:700,color:C.navy}}>💬 История напоминаний в WhatsApp</span>
            <span style={{fontSize:14,color:C.textFaint}}>{remindersHistoryOpen?"▲ Свернуть":"▼ Показать"}</span>
          </div>
          {remindersHistoryOpen && (
            <div style={{padding:10,maxHeight:420,overflowY:"auto",borderTop:`1px solid ${C.border}`}}>
              {loadingReminders?<div style={S.loadingWrap}>Загрузка...</div>
                :reminders.length===0?<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint}}>Напоминаний пока не отправляли</div>
                :reminders.map(r=>(
                  <div key={r.id} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:14}}>
                    <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                      <span style={{color:C.text,fontWeight:600,overflowWrap:"anywhere"}}>{r.client_name}</span>
                      <span style={{color:C.textFaint,whiteSpace:"nowrap"}}>{fmtDT(r.sent_at)}</span>
                    </div>
                    <div style={{color:C.textFaint,fontSize:13,marginTop:2}}>
                      {r.order_id?`Заявка №${r.order_id}`:`Касса №${r.sale_id}`} · написал: {r.sent_by_name}
                    </div>
                  </div>
                ))
              }
            </div>
          )}
        </div>
      )}
    </>
  );
}

// Управление группой "Договорники" — ярлык поверх контрагента из 1С (см.
// clientTags/PUT /api/clients/:code/dogovornik на сервере), нужен для
// отбора заявок по этой группе клиентов в "Заявках" (dogovornikFilter в
// AdminCabinet). Простой список с поиском и переключателем прямо по клику
// на строку — отдельного экрана "Клиенты" в приложении пока нет, заводить
// его целиком ради одной пометки было бы избыточно.
function DogovornikModal({ clients, onClose, onSaved }) {
  const [search, setSearch] = useState("");
  const [savingCode, setSavingCode] = useState(null);
  const q = search.trim().toLowerCase();
  const filtered = clients
    .filter(c => !q || (c.name||'').toLowerCase().includes(q) || (c.code||'').includes(q))
    .sort((a,b) => (a.name||'').localeCompare(b.name||'','ru'));

  const toggle = async (c) => {
    if (savingCode) return;
    setSavingCode(c.code);
    try {
      await apiCall('PUT', `/api/clients/${c.code}/dogovornik`, { is_dogovornik: !c.is_dogovornik });
      await onSaved();
    } catch(e) { alert(e.message); }
    setSavingCode(null);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}}>
      <div style={{background:C.white,margin:"16px",borderRadius:16,padding:20,maxWidth:480,marginLeft:"auto",marginRight:"auto",border:`1px solid ${C.border}`}}>
        <div style={{...S.row,marginBottom:14}}>
          <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>Договорники</p>
          <button style={S.btnSecondary} onClick={onClose}>✕</button>
        </div>
        <p style={{margin:"0 0 12px",fontSize:14,color:C.textSub}}>Отметьте клиентов-договорников — по этой группе можно будет отобрать заявки.</p>
        <input
          type="search"
          style={{...S.input,marginBottom:12}}
          placeholder="Поиск по названию или коду..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
          autoComplete="off"
        />
        <div style={{maxHeight:420,overflowY:"auto"}}>
          {filtered.length===0
            ? <div style={{textAlign:"center",padding:"20px 0",color:C.textFaint}}>Ничего не найдено</div>
            : filtered.map(c=>(
              <div key={c.code} onClick={()=>toggle(c)} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 4px",borderBottom:`1px solid ${C.border}`,cursor:savingCode?"default":"pointer",opacity:savingCode===c.code?0.5:1}}>
                <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${c.is_dogovornik?C.navy:C.border}`,background:c.is_dogovornik?C.navy:C.white,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {c.is_dogovornik&&<span style={{color:C.white,fontSize:15,fontWeight:700}}>✓</span>}
                </div>
                <div style={{minWidth:0}}>
                  <div style={{fontSize:15,fontWeight:600,color:C.text,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{c.name}</div>
                  <div style={{fontSize:13,color:C.textFaint}}>Код: {c.code}</div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
}

// Возврат — отдельная от статуса заявки сущность (см. POST /api/returns):
// либо конкретные позиции/количество из уже ДОСТАВЛЕННОЙ заявки (магазин
// вернул 1 из 5 коробок), либо совсем без заявки — товар без привязки
// к конкретной поставке (например, порчу заметили через неделю). И то, и
// другое доступно водителю (обнаружил на месте) и admin/manager/operator.
function ReturnFormModal({ user, onClose, onCreated }) {
  const canAttributeSales = ['admin','manager'].includes(user.role); // GET /api/users не отдаёт operator/driver
  const [mode, setMode] = useState('order');

  // ===== режим "по заявке" =====
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});
  const [alreadyReturned, setAlreadyReturned] = useState({});

  useEffect(() => {
    apiCall('GET','/api/orders').then(all => {
      let delivered = all.filter(o=>o.status==="delivered");
      // Водитель возвращает только по своим доставкам — не видит доставки других водителей
      if (user.role==="driver") delivered = delivered.filter(o=>o.driver_id===user.id);
      setOrders(delivered);
      setLoadingOrders(false);
    }).catch(()=>setLoadingOrders(false));
  }, []);

  const pickOrder = (o) => {
    setSelectedOrder(o);
    setReturnQtys({});
    apiCall('GET','/api/returns').then(list => {
      const map = {};
      list.filter(r=>r.order_id===o.id).forEach(r=>(r.items||[]).forEach(it=>{ if(it.code) map[it.code]=(map[it.code]||0)+(Number(it.qty)||0); }));
      setAlreadyReturned(map);
    }).catch(()=>setAlreadyReturned({}));
  };

  const orderItems = selectedOrder ? (typeof selectedOrder.items==="string"?JSON.parse(selectedOrder.items||"[]"):(selectedOrder.items||[])) : [];
  const q = orderSearch.trim().toLowerCase();
  const matchedOrders = q
    ? orders.filter(o=>(o.client_name||"").toLowerCase().includes(q)||String(o.id).includes(q))
    : orders.slice(0,20);

  // ===== режим "без заявки" =====
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [salesUsers, setSalesUsers] = useState([]);
  const [salesId, setSalesId] = useState('');
  const [freeRows, setFreeRows] = useState([{name:"",qty:"",price:""}]);

  useEffect(() => {
    if (mode!=="freeform") return;
    apiCall('GET','/api/clients').then(setClients).catch(()=>{});
    if (canAttributeSales) {
      apiCall('GET','/api/users').then(us=>setSalesUsers(us.filter(u=>["sales","senior_sales"].includes(u.role)&&u.active!==false))).catch(()=>{});
    }
  }, [mode]);

  const cq = clientSearch.trim().toLowerCase();
  const matchedClients = cq ? clients.filter(c=>(c.name||"").toLowerCase().includes(cq)) : [];

  const updateFreeRow = (i,patch) => setFreeRows(rs=>rs.map((r,idx)=>idx===i?{...r,...patch}:r));
  const addFreeRow = () => setFreeRows(rs=>[...rs,{name:"",qty:"",price:""}]);
  const removeFreeRow = (i) => setFreeRows(rs=>rs.length>1?rs.filter((_,idx)=>idx!==i):rs);

  // ===== общее =====
  const [reason, setReason] = useState('');
  const [refundCash, setRefundCash] = useState('');
  const [refundQr, setRefundQr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const canSubmitOrder = !!selectedOrder && orderItems.some(it=>Number(returnQtys[it.code])>0);
  const canSubmitFree = !!clientCode && freeRows.some(r=>r.name.trim()&&Number(r.qty)>0);
  const canSubmit = mode==="order" ? canSubmitOrder : canSubmitFree;

  const submit = async () => {
    if (!canSubmit || submitting) return;
    setError(""); setSubmitting(true);
    try {
      let payload;
      if (mode==="order") {
        const items = orderItems.filter(it=>Number(returnQtys[it.code])>0).map(it=>({code:it.code,name:it.name,price:it.price,qty:Number(returnQtys[it.code])}));
        payload = { orderId:selectedOrder.id, items, reason, refundCash:Number(refundCash)||0, refundQr:Number(refundQr)||0 };
      } else {
        const client = clients.find(c=>c.code===clientCode);
        const items = freeRows.filter(r=>r.name.trim()&&Number(r.qty)>0).map(r=>({name:r.name.trim(),qty:Number(r.qty),price:Number(r.price)||0}));
        payload = { clientCode, clientName: client?client.name:clientCode, salesId: salesId||undefined, items, reason, refundCash:Number(refundCash)||0, refundQr:Number(refundQr)||0 };
      }
      await apiCall('POST','/api/returns', payload);
      if (onCreated) onCreated();
      onClose();
    } catch(e) { setError(e.message); }
    setSubmitting(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}}>
      <div style={{background:C.white,margin:"16px",borderRadius:16,padding:20,maxWidth:480,marginLeft:"auto",marginRight:"auto",border:`1px solid ${C.border}`}}>
        <div style={{...S.row,marginBottom:14}}>
          <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>↩️ Оформить возврат</p>
          <button style={S.btnSecondary} onClick={onClose}>✕</button>
        </div>

        <div style={{display:"flex",gap:6,marginBottom:14}}>
          <button onClick={()=>setMode("order")} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${mode==="order"?C.navy:C.border}`,background:mode==="order"?C.navy:C.white,color:mode==="order"?C.white:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer"}}>По заявке</button>
          <button onClick={()=>setMode("freeform")} style={{flex:1,padding:"9px",borderRadius:8,border:`1px solid ${mode==="freeform"?C.navy:C.border}`,background:mode==="freeform"?C.navy:C.white,color:mode==="freeform"?C.white:C.textMid,fontSize:13,fontWeight:600,cursor:"pointer"}}>Без заявки</button>
        </div>

        {mode==="order" ? (
          !selectedOrder ? (
            <>
              <input style={{...S.input,marginBottom:10}} placeholder="Поиск по клиенту или № заявки..." value={orderSearch} onChange={e=>setOrderSearch(e.target.value)}/>
              {loadingOrders?<div style={S.loadingWrap}>Загрузка...</div>:matchedOrders.length===0?<p style={{fontSize:13,color:C.textFaint,textAlign:"center",padding:"16px 0"}}>Доставленных заявок не найдено</p>:
                <div style={{maxHeight:280,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10}}>
                  {matchedOrders.map(o=>(
                    <div key={o.id} onClick={()=>pickOrder(o)} style={{padding:"10px 12px",borderBottom:`1px solid ${C.border}`,cursor:"pointer"}}>
                      <p style={{margin:0,fontSize:14,fontWeight:700}}>№ {o.id} · {o.client_name}</p>
                      <p style={{margin:0,fontSize:12,color:C.textFaint}}>{o.date} · {(o.total||0).toLocaleString()} ₸</p>
                    </div>
                  ))}
                </div>
              }
            </>
          ) : (
            <>
              <div style={{...S.row,marginBottom:10}}>
                <p style={{margin:0,fontSize:14,fontWeight:700}}>№ {selectedOrder.id} · {selectedOrder.client_name}</p>
                <button style={S.btnSecondary} onClick={()=>setSelectedOrder(null)}>Сменить</button>
              </div>
              {orderItems.map(it=>{
                const delivered = Number(it.qty)||0;
                const already = alreadyReturned[it.code]||0;
                const maxQty = Math.max(0, delivered-already);
                return (
                  <div key={it.code} style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{margin:0,fontSize:14,overflowWrap:"anywhere"}}>{it.name}</p>
                      <p style={{margin:0,fontSize:12,color:C.textFaint}}>Доставлено {delivered}{already>0?`, уже возвращено ${already}`:''}{maxQty===0?' · весь объём уже возвращён':''}</p>
                    </div>
                    <input type="number" disabled={maxQty===0} min="0" max={maxQty} style={{...S.input,width:70,flexShrink:0,padding:"6px 8px",fontSize:14,textAlign:"center",opacity:maxQty===0?0.5:1}} placeholder="0" value={returnQtys[it.code]||''}
                      onChange={e=>{ let v=e.target.value; if (Number(v)>maxQty) v=String(maxQty); setReturnQtys(qm=>({...qm,[it.code]:v})); }}
                      onFocus={e=>e.target.select()}
                    />
                  </div>
                );
              })}
            </>
          )
        ) : (
          <>
            <label style={S.label}>Клиент</label>
            {!clientCode ? (
              <>
                <input style={{...S.input,marginBottom:6}} placeholder="Поиск клиента..." value={clientSearch} onChange={e=>setClientSearch(e.target.value)}/>
                {cq && (
                  <div style={{maxHeight:180,overflowY:"auto",border:`1px solid ${C.border}`,borderRadius:10,marginBottom:10}}>
                    {matchedClients.length===0?<p style={{fontSize:13,color:C.textFaint,padding:"10px 12px",margin:0}}>Не найдено</p>:matchedClients.map(c=>(
                      <div key={c.code} onClick={()=>{setClientCode(c.code);setClientSearch(c.name);}} style={{padding:"9px 12px",borderBottom:`1px solid ${C.border}`,cursor:"pointer",fontSize:14}}>{c.name}</div>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <div style={{...S.row,marginBottom:10,padding:"8px 12px",background:C.surface,borderRadius:10}}>
                <span style={{fontSize:14,fontWeight:600}}>{(clients.find(c=>c.code===clientCode)||{}).name || clientCode}</span>
                <button style={S.btnSecondary} onClick={()=>{setClientCode('');setClientSearch('');}}>Сменить</button>
              </div>
            )}

            {canAttributeSales && (
              <div style={{marginBottom:10}}>
                <label style={S.label}>Торговый (для бонуса), необязательно</label>
                <select style={S.select} value={salesId} onChange={e=>setSalesId(e.target.value)}>
                  <option value="">— не указан —</option>
                  {salesUsers.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </div>
            )}

            <label style={S.label}>Позиции</label>
            {freeRows.map((r,i)=>(
              <div key={i} style={{display:"grid",gridTemplateColumns:"1fr 64px 80px 28px",gap:6,marginBottom:6}}>
                <input style={{...S.input,padding:"8px 10px",fontSize:14}} placeholder="Название товара" value={r.name} onChange={e=>updateFreeRow(i,{name:e.target.value})}/>
                <input type="number" style={{...S.input,padding:"8px 6px",fontSize:14,textAlign:"center"}} placeholder="кол-во" value={r.qty} onChange={e=>updateFreeRow(i,{qty:e.target.value})}/>
                <input type="number" style={{...S.input,padding:"8px 6px",fontSize:14,textAlign:"right"}} placeholder="цена" value={r.price} onChange={e=>updateFreeRow(i,{price:e.target.value})}/>
                <button onClick={()=>removeFreeRow(i)} style={{width:28,height:34,border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,cursor:"pointer",fontSize:14,color:C.textFaint}}>×</button>
              </div>
            ))}
            <button onClick={addFreeRow} style={{...S.btnSecondary,marginBottom:10}}>+ Позиция</button>
          </>
        )}

        <div style={{marginTop:14}}>
          <label style={S.label}>Причина возврата</label>
          <textarea style={S.textarea} value={reason} onChange={e=>setReason(e.target.value)} placeholder="Например: товар испорчен, привезли лишнее и т.п."/>
        </div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:10}}>
          <div>
            <label style={S.label}>Вернуть налом, ₸</label>
            <input type="number" style={S.input} placeholder="0" value={refundCash} onChange={e=>setRefundCash(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Вернуть на QR/карту, ₸</label>
            <input type="number" style={S.input} placeholder="0" value={refundQr} onChange={e=>setRefundQr(e.target.value)}/>
          </div>
        </div>

        {error && <p style={{...S.errorBox,marginTop:12,marginBottom:0}}>{error}</p>}

        <button style={{...S.btnDanger,marginTop:16,opacity:(canSubmit&&!submitting)?1:0.5,cursor:(canSubmit&&!submitting)?"pointer":"not-allowed"}} disabled={!canSubmit||submitting} onClick={submit}>{submitting?"Сохранение...":"↩️ Оформить возврат"}</button>
      </div>
    </div>
  );
}

// История взвешивания — кто и когда ввёл факт. вес по позиции заявки, см.
// GET /api/weigh-log. Самодостаточная панель — сама грузит данные, ничего
// не делит с родителем.
function WeighLogPanel() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try { setLog(await apiCall('GET','/api/weigh-log')); } catch(e) {}
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, []);
  useRefetchOnVisible(load);

  const [open, setOpen] = useState(false);

  return (
    <div style={{...S.card, padding:0, marginTop:16, overflow:"hidden"}}>
      <div onClick={()=>setOpen(o=>!o)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",cursor:"pointer",background:C.surface}}>
        <span style={{fontSize:15,fontWeight:700,color:C.navy}}>⚖️ История взвешивания</span>
        <span style={{fontSize:14,color:C.textFaint}}>{open?"▲ Свернуть":"▼ Показать"}</span>
      </div>
      {open && (
        <div style={{padding:10,maxHeight:420,overflowY:"auto",borderTop:`1px solid ${C.border}`}}>
          {loading?<div style={S.loadingWrap}>Загрузка...</div>
            :log.length===0?<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint}}>Записей пока нет</div>
            :log.map(l=>(
              <div key={l.id} style={{padding:"8px 0",borderBottom:`1px solid ${C.border}`,fontSize:14}}>
                <div style={{display:"flex",justifyContent:"space-between",gap:8}}>
                  <span style={{color:C.text,fontWeight:600,overflowWrap:"anywhere"}}>{l.item_name}</span>
                  <span style={{color:C.navy,fontWeight:700,whiteSpace:"nowrap"}}>{l.weight} кг</span>
                </div>
                <div style={{color:C.textFaint,fontSize:13,marginTop:2}}>
                  Заявка №{l.order_id} · {l.weighed_by_name} · {new Date(l.weighed_at).toLocaleString('ru-RU')}
                  {l.prev_weight!=null&&` · заявка вес ${l.prev_weight} кг`}
                </div>
              </div>
            ))
          }
        </div>
      )}
    </div>
  );
}

const COMPANY_INFO = {
  name: 'ИП ЖАЙЫК АКТАУ',
  address: 'Уральск Г.А., Уральск, МИКРОРАЙОН ЖЕҢІС, дом 8/1, кв/офис 73',
  bin: '491219400991',
  bank: 'АО "Kaspi Bank"',
  bik: 'CASPKZKA',
  account: 'KZ33722S000046085888',
  releaseAuthorizedBy: 'Байсмаков С.К.',
  // Контактный номер под "Ответственный за поставку" в накладной — чтобы
  // клиенту было куда позвонить по доставке, независимо от того, кто
  // именно из водителей её вёз.
  responsiblePhone: '+7-775-593-95-75',
};

// Сумма прописью для накладной (см. buildWaybillInnerHtml) — стандартная
// русская форма как в бумажных бланках: "Триста четыре тысячи двести тенге
// 00 тиын". Тенге не склоняется и не меняет род числительного (в отличие
// от "тысяча" — та требует "одна/две", а не "один/два"), поэтому для неё
// используем мужской род (NUM_ONES), а для группы тысяч — женский (NUM_ONES_F).
const NUM_ONES = ['','один','два','три','четыре','пять','шесть','семь','восемь','девять'];
const NUM_ONES_F = ['','одна','две','три','четыре','пять','шесть','семь','восемь','девять'];
const NUM_TEENS = ['десять','одиннадцать','двенадцать','тринадцать','четырнадцать','пятнадцать','шестнадцать','семнадцать','восемнадцать','девятнадцать'];
const NUM_TENS = ['','','двадцать','тридцать','сорок','пятьдесят','шестьдесят','семьдесят','восемьдесят','девяносто'];
const NUM_HUNDREDS = ['','сто','двести','триста','четыреста','пятьсот','шестьсот','семьсот','восемьсот','девятьсот'];
function threeDigitsToWordsRu(n, feminine) {
  const words = [];
  const h = Math.floor(n/100), t = Math.floor((n%100)/10), o = n%10;
  if (h) words.push(NUM_HUNDREDS[h]);
  if (t === 1) words.push(NUM_TEENS[o]);
  else {
    if (t) words.push(NUM_TENS[t]);
    if (o) words.push((feminine ? NUM_ONES_F : NUM_ONES)[o]);
  }
  return words;
}
function pluralFormRu(n, forms) {
  const n100 = Math.abs(n) % 100, n10 = n100 % 10;
  if (n100 > 10 && n100 < 20) return forms[2];
  if (n10 === 1) return forms[0];
  if (n10 > 1 && n10 < 5) return forms[1];
  return forms[2];
}
function numberToWordsRu(num) {
  num = Math.floor(num);
  if (num === 0) return 'ноль';
  const groups = [
    { div: 1000000000, forms: ['миллиард','миллиарда','миллиардов'], feminine: false },
    { div: 1000000, forms: ['миллион','миллиона','миллионов'], feminine: false },
    { div: 1000, forms: ['тысяча','тысячи','тысяч'], feminine: true },
  ];
  let remainder = num;
  const parts = [];
  groups.forEach(g => {
    const count = Math.floor(remainder / g.div);
    remainder = remainder % g.div;
    if (count > 0) {
      parts.push(...threeDigitsToWordsRu(count, g.feminine));
      parts.push(pluralFormRu(count, g.forms));
    }
  });
  if (remainder > 0 || parts.length === 0) parts.push(...threeDigitsToWordsRu(remainder, false));
  return parts.join(' ');
}
function tengeSumToWords(amount) {
  const whole = Math.floor(Math.abs(Number(amount) || 0));
  const tiyn = Math.round((Math.abs(Number(amount) || 0) - whole) * 100);
  const words = numberToWordsRu(whole);
  return `${words.charAt(0).toUpperCase()}${words.slice(1)} тенге ${String(tiyn).padStart(2,'0')} тиын`;
}

// Дата словами для "Расходной накладной" (см. buildExpenseWaybillInnerHtml)
// — "6 июля 2026 г.", как в печатной форме 1С. order.date — "YYYY-MM-DD";
// достаём компоненты через UTC-геттеры, а не локальные (getDate/getMonth),
// чтобы часовой пояс браузера ни при каких обстоятельствах не сдвинул
// день на печатном бланке.
const MONTHS_RU_GENITIVE = ['января','февраля','марта','апреля','мая','июня','июля','августа','сентября','октября','ноября','декабря'];
function formatDateWordsRu(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return `${d.getUTCDate()} ${MONTHS_RU_GENITIVE[d.getUTCMonth()]} ${d.getUTCFullYear()} г.`;
}
// "Дата составления" в форме З-2/накладной на возврат (см. buildWaybillInnerHtml/
// buildReturnWaybillInnerHtml) печаталась как есть — "YYYY-MM-DD" (order.date/
// ret.date из POST /api/orders). Для казахстанского/русского читателя это
// читается день-и-месяц наоборот: "2026-09-08" глаз цепляет как "09.08" (9
// августа), а не как 8 сентября — те же самые цифры, но не в том порядке,
// к которому все привыкли (ДД.ММ.ГГГГ). Сами данные были верны всегда, но
// формат вводил в заблуждение — приводим к привычному ДД.ММ.ГГГГ.
function formatDateDMY(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.${d.getUTCFullYear()}`;
}

// Экранирование свободного текста (имя клиента/водителя, адрес, название
// товара и т.п.) перед вставкой в HTML-шаблоны печати ниже — без него,
// например, символы "<"/">" в имени клиента браузер трактует как начало
// тега: "<<DIAMOND>> ИП" рендерился как просто "<> ИП" — "DIAMOND" не
// пропадал из данных, он превращался в невидимый HTML-тег и не отображался.
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function buildWaybillInnerHtml(order, opts) {
  const hideQr = !!(opts && opts.hideQr);
  // Позиция заявки хранит название, которое торговый видел при оформлении —
  // это псевдоним с "Товаров" (p.display_name), если он задан, а не
  // название из 1С (см. addToCart/name: p.display_name||p.name на фронте).
  // В официальной накладной должно быть название из 1С, поэтому здесь
  // подменяем его по коду через productNameByCode (см. вызовы printWaybill/
  // shareWaybillPdf/printWaybillsBatch) — если код не нашёлся в каталоге
  // (например, товар давно снят с продажи), молча остаёмся на сохранённом
  // названии, лучше так, чем пустая графа.
  const nameByCode = (opts && opts.productNameByCode) || {};
  const items = typeof order.items === 'string' ? JSON.parse(order.items||'[]') : (order.items||[]);
  // Единица измерения на самой заявке не хранится (см. POST /api/orders) —
  // единственный надёжный признак на позиции это is_weight_item (кг у
  // весового товара), для остального берём "шт" по умолчанию.
  const unitOf = (it) => it.is_weight_item ? 'кг' : 'шт';
  // НДС 16% "в том числе" — sum (Number(it.qty)*Number(it.price)) это уже
  // фактическая отпускная цена клиенту, т.е. с учётом налога, а не база без
  // него, поэтому налог выделяется из суммы (sum*16/116), а не начисляется
  // сверху (sum*0.16) — иначе НДС считался бы от заведомо большей базы и
  // выходил бы завышенным. Чисто информационная графа в накладной
  // (order.total, от которого зависят касса/долги/прибыль, нигде не меняем
  // и не пересчитываем).
  let totalNds = 0;
  const rows = items.map((it,i)=>{
    const sum = Number(it.qty)*Number(it.price);
    const nds = Math.round(sum*16/116);
    totalNds += nds;
    return `
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td>${esc(nameByCode[it.code] || it.name)}</td>
      <td style="text-align:center">${esc(it.code)}</td>
      <td style="text-align:center">${unitOf(it)}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${Number(it.price).toLocaleString()}</td>
      <td style="text-align:right">${sum.toLocaleString()}</td>
      <td style="text-align:right">${nds.toLocaleString()}</td>
    </tr>`;
  }).join('');
  return `
    <div class="topright">Приложение 26<br>к приказу Министра финансов<br>Республики Казахстан<br>от 20 декабря 2012 года № 562</div>
    <div class="toprow"><span>Организация (индивидуальный предприниматель) <b>${esc(COMPANY_INFO.name)}</b></span><span>ИИН/БИН <b>${esc(COMPANY_INFO.bin)}</b></span></div>
    <table class="docnumtable">
      <tr><th>Номер документа</th><th>Дата составления</th></tr>
      <tr><td>${order.id}</td><td>${formatDateDMY(order.date)}</td></tr>
    </table>
    <h1>НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ<br><span style="font-weight:400;font-size:12px">Форма З-2</span></h1>
    <div class="headrow">
      <div><div class="label">ОРГАНИЗАЦИЯ — ОТПРАВИТЕЛЬ</div>${esc(COMPANY_INFO.name)}</div>
      <div><div class="label">ОРГАНИЗАЦИЯ — ПОЛУЧАТЕЛЬ</div>${esc(order.client_name)}</div>
    </div>
    <div class="headrow row2">
      <div><div class="label">ОТВЕТСТВЕННЫЙ ЗА ПОСТАВКУ (Ф.И.О.)</div>${esc(order.driver_name)}${order.driver_name?'<br>':''}${esc(COMPANY_INFO.responsiblePhone)}</div>
      ${hideQr ? '' : '<div class="miniqr"><img src="/kaspi-qr.png" alt="Kaspi QR"/><p>Kaspi QR — оплата</p></div>'}
      <div><div class="label">АДРЕС ДОСТАВКИ</div>${esc(order.address)}${order.contact_phone?('<br>Тел: '+esc(order.contact_phone)):''}</div>
    </div>
    <table>
      <tr><th>№</th><th>Наименование</th><th>Номенкл. №</th><th>Ед.<br>изм.</th><th>Кол-во<br>подлежит<br>отпуску</th><th>Кол-во<br>отпущено</th><th>Цена за ед., ₸</th><th>Сумма, ₸</th><th>Сумма НДС, ₸</th></tr>
      ${rows}
      <tr><td colspan="7" style="text-align:right;font-weight:700">Итого</td><td style="text-align:right;font-weight:700">${(order.total||0).toLocaleString()}</td><td style="text-align:right;font-weight:700">${totalNds.toLocaleString()}</td></tr>
    </table>
    <div class="totals">
      <p>Всего отпущено на сумму: <b>${(order.total||0).toLocaleString()} ₸</b></p>
      <p>Сумма прописью: ${tengeSumToWords(order.total||0)}</p>
    </div>
    <div class="signcols">
      <div class="sign">
        <p>Отпуск разрешил: <span class="signline">${esc(COMPANY_INFO.releaseAuthorizedBy)}</span> должность / подпись</p>
        <p>Отпустил (водитель): <span class="signline">${esc(order.driver_name)}</span> подпись</p>
        <p style="margin-top:20px">М.П.</p>
      </div>
      <div class="sign">
        <p>Запасы получил: <span class="signline">&nbsp;</span> подпись</p>
        <p>Расшифровка подписи: <span class="signline">&nbsp;</span></p>
      </div>
    </div>`;
}

// "Расходная накладная" — простой бланк в стиле печатной формы 1С (по
// образцу от владельца), для клиентов НЕ из группы "Договорники" (см.
// dogovornikCodes в AdminCabinet и buildWaybillInnerHtml выше — у
// договорников остаётся форма З-2, официальный бланк, только без Kaspi
// QR, т.к. они рассчитываются по договору). У обычных клиентов, наоборот,
// это основной способ оплаты на месте — бланк проще, но всегда с QR.
// "Основание" повторяет "Покупателя" — так печатает и сам 1С в этой форме,
// когда конкретный договор/документ-основание не указан отдельно.
function buildExpenseWaybillInnerHtml(order, productNameByCode) {
  // См. комментарий в buildWaybillInnerHtml — то же самое: заявка хранит
  // псевдоним, накладная должна печатать название из 1С.
  const nameByCode = productNameByCode || {};
  const items = typeof order.items === 'string' ? JSON.parse(order.items||'[]') : (order.items||[]);
  const unitOf = (it) => it.is_weight_item ? 'кг' : 'шт';
  const rows = items.map((it,i)=>`
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td style="text-align:center">${esc(it.code)}</td>
      <td>${esc(nameByCode[it.code] || it.name)}</td>
      <td style="text-align:right">${it.qty}&nbsp;${unitOf(it)}</td>
      <td style="text-align:right">${Number(it.price).toLocaleString()}</td>
      <td style="text-align:right">${(Number(it.qty)*Number(it.price)).toLocaleString()}</td>
    </tr>`).join('');
  const total = order.total || 0;
  return `
    <div class="exphead">Расходная накладная № ${order.id} от ${formatDateWordsRu(order.date)}</div>
    <div class="exptop">
      <table class="expfields">
        <tr><td class="expfields-label">Поставщик</td><td class="expfields-value">${esc(COMPANY_INFO.name)}</td></tr>
        <tr><td class="expfields-label">Покупатель</td><td class="expfields-value">${esc(order.client_name)}</td></tr>
        <tr><td class="expfields-label">Основание</td><td class="expfields-value">${esc(order.client_name)}</td></tr>
        <tr><td class="expfields-label">Склад</td><td class="expfields-value">Основной склад</td></tr>
      </table>
      <div class="miniqr">
        <img src="/kaspi-qr.png" alt="Kaspi QR"/>
        <p>Kaspi QR — оплата</p>
      </div>
    </div>
    <table>
      <tr><th>№ п/п</th><th>Код</th><th>Товар</th><th>Количество</th><th>Цена</th><th>Сумма</th></tr>
      ${rows}
      <tr><td colspan="5" style="text-align:right;font-weight:700">Итого:</td><td style="text-align:right;font-weight:700">${total.toLocaleString()}</td></tr>
    </table>
    <div class="totals">
      <p style="text-decoration:underline">Всего наименований ${items.length}, на сумму ${total.toLocaleString()} KZT</p>
      <p style="font-weight:700">${tengeSumToWords(total)}</p>
    </div>
    <div class="signcols">
      <div class="sign"><p>Отпустил <span class="signline">${esc(COMPANY_INFO.releaseAuthorizedBy)}</span>/</p></div>
      <div class="sign"><p>Получил <span class="signline">&nbsp;</span>/</p></div>
    </div>`;
}

// Та же накладная, что печатается кнопкой "Печать накладной" (см.
// printWaybill/buildWaybillInnerHtml/buildExpenseWaybillInnerHtml выше), но
// как настоящий отформатированный лист Excel (рамки, жирный шрифт,
// объединённые ячейки, ширина колонок) — не просто текст в CSV. CSV не
// умеет стили вообще (Excel открывает его как голый текст без рамок и
// жирности, а по виду это список, не бланк), поэтому по факту нужен
// именно .xlsx — библиотека для стилизованной записи (ExcelJS, см.
// index.html), в отличие от уже подключённого XLSX (SheetJS) выше: у него
// запись со стилями — платная Pro-фича, community-версия при записи
// молча теряет .s (проверено вручную). Тот же выбор формы, что и печать:
// договорники — Форма З-2 (официальный бланк, приказ Минфина №562, с
// НДС), остальные — "Расходная накладная" (простой бланк).
const THIN_BORDER = { style: 'thin', color: { argb: 'FF999999' } };
// Рамка по периметру прямоугольного диапазона (в т.ч. объединённых ячеек)
// — при merge стиль нужно проставлять на КАЖДУЮ ячейку диапазона (иначе
// видна только часть рамки), поэтому не просто .border у "якорной" ячейки.
function boxBorder(ws, r1, c1, r2, c2) {
  for (let r = r1; r <= r2; r++) {
    for (let c = c1; c <= c2; c++) {
      const cell = ws.getCell(r, c);
      const border = { ...cell.border };
      if (r === r1) border.top = THIN_BORDER;
      if (r === r2) border.bottom = THIN_BORDER;
      if (c === c1) border.left = THIN_BORDER;
      if (c === c2) border.right = THIN_BORDER;
      cell.border = border;
    }
  }
}
function fullBorder(cell) {
  cell.border = { top: THIN_BORDER, left: THIN_BORDER, bottom: THIN_BORDER, right: THIN_BORDER };
}
// Высота строки под перенесённый по словам длинный текст (название
// товара может быть на несколько строк, см. wrapText на ячейке
// "Наименование"/"Товар") — иначе видна только первая строка, а остальное
// обрезано по границе ячейки визуально (сами данные при этом не теряются,
// но пока не увеличишь строку вручную — не видно).
function wrapRowHeight(text, colWidth) {
  const charsPerLine = Math.max(8, colWidth - 2);
  const lines = Math.max(1, Math.ceil(String(text||'').length / charsPerLine));
  return Math.max(18, lines * 14 + 6);
}
// Подпись-"линия" — только нижняя рамка на пустой ячейке, чтобы было
// видно, где расписаться (аналог <span class="signline"> в печатной форме).
function signLine(ws, r, c1, c2) {
  ws.mergeCells(r, c1, r, c2);
  for (let c = c1; c <= c2; c++) ws.getCell(r, c).border = { bottom: THIN_BORDER };
}
// Ячейка "жирная подпись: значение" одним объединённым диапазоном — не
// отдельная узкая ячейка под подпись с соседней занятой ячейкой рядом
// (Excel обрезает переполнение текста, только если сосед пуст; занятая
// или объединённая соседняя ячейка обрезает подпись всегда, даже если
// реальной ширины колонки А не хватает — так теряло хвост "Запасы
// получил:"/"Расшифровка подписи:" и т.п. при узкой колонке №).
function labelValueCell(ws, row, c1, c2, label, value) {
  ws.mergeCells(row,c1,row,c2);
  const cell = ws.getCell(row,c1);
  cell.value = { richText: [
    { font: { bold: true }, text: label + ' ' },
    { font: {}, text: value == null ? '' : String(value) },
  ] };
  return cell;
}
function buildDogovornikWaybillSheet(ws, order, productNameByCode) {
  const nameByCode = productNameByCode || {};
  const items = typeof order.items === 'string' ? JSON.parse(order.items||'[]') : (order.items||[]);
  const unitOf = (it) => it.is_weight_item ? 'кг' : 'шт';
  const total = order.total || 0;
  ws.columns = [{width:5},{width:42},{width:13},{width:8},{width:11},{width:11},{width:12},{width:12},{width:12}];
  ws.mergeCells(1,1,1,9);
  ws.getCell(1,1).value = 'Приложение 26 к приказу Министра финансов Республики Казахстан от 20 декабря 2012 года № 562';
  ws.getCell(1,1).font = { italic: true, size: 8, color: { argb: 'FF666666' } };
  ws.getCell(1,1).alignment = { horizontal: 'right' };
  labelValueCell(ws, 2, 1, 5, 'Организация (ИП):', COMPANY_INFO.name);
  labelValueCell(ws, 2, 6, 9, 'ИИН/БИН:', COMPANY_INFO.bin);
  labelValueCell(ws, 3, 1, 4, 'Номер документа:', order.id);
  labelValueCell(ws, 3, 6, 9, 'Дата составления:', formatDateDMY(order.date));
  ws.mergeCells(5,1,5,9);
  ws.getCell(5,1).value = 'НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ';
  ws.getCell(5,1).font = { bold: true, size: 14 };
  ws.getCell(5,1).alignment = { horizontal: 'center' };
  ws.mergeCells(6,1,6,9);
  ws.getCell(6,1).value = 'Форма З-2';
  ws.getCell(6,1).font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  ws.getCell(6,1).alignment = { horizontal: 'center' };
  const headerBox = (row, c1, c2, label, value) => {
    ws.mergeCells(row,c1,row,c2);
    const cell = ws.getCell(row,c1);
    cell.value = { richText: [
      { font: { bold: true, size: 9, color: { argb: 'FF666666' } }, text: label + '\n' },
      { font: { size: 11 }, text: value || '' },
    ] };
    cell.alignment = { wrapText: true, vertical: 'top' };
    boxBorder(ws, row, c1, row, c2);
  };
  ws.getRow(8).height = 30;
  headerBox(8, 1, 4, 'ОРГАНИЗАЦИЯ — ОТПРАВИТЕЛЬ', COMPANY_INFO.name);
  headerBox(8, 6, 9, 'ОРГАНИЗАЦИЯ — ПОЛУЧАТЕЛЬ', order.client_name);
  ws.getRow(9).height = 40;
  headerBox(9, 1, 4, 'ОТВЕТСТВЕННЫЙ ЗА ПОСТАВКУ (Ф.И.О.)', [order.driver_name, COMPANY_INFO.responsiblePhone].filter(Boolean).join('\n'));
  headerBox(9, 6, 9, 'АДРЕС ДОСТАВКИ', [order.address, order.contact_phone?('Тел: '+order.contact_phone):''].filter(Boolean).join('\n'));

  const headRow = 11;
  const headLabels = ['№','Наименование','Номенкл. №','Ед.\nизм.','Кол-во\nподлежит\nотпуску','Кол-во\nотпущено','Цена за ед., ₸','Сумма, ₸','Сумма НДС, ₸'];
  headLabels.forEach((label,i) => {
    const cell = ws.getCell(headRow, i+1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    fullBorder(cell);
  });
  // Высота — по самому "многострочному" заголовку (у "Кол-во подлежит
  // отпуску" три явных переноса \n), иначе Excel обрезает нижнюю строку
  // по границе следующей строки, а не показывает её целиком.
  const headMaxLines = Math.max(...headLabels.map(l => l.split('\n').length));
  ws.getRow(headRow).height = headMaxLines * 15 + 14;

  let totalNds = 0;
  let r = headRow + 1;
  items.forEach((it) => {
    const i = r - headRow - 1;
    const sum = (Number(it.qty)||0)*(Number(it.price)||0);
    const nds = Math.round(sum*16/116);
    totalNds += nds;
    const name = nameByCode[it.code]||it.name;
    const values = [i+1, name, it.code||'', unitOf(it), Number(it.qty)||0, Number(it.qty)||0, Number(it.price)||0, sum, nds];
    values.forEach((v,ci) => {
      const cell = ws.getCell(r, ci+1);
      cell.value = v;
      fullBorder(cell);
      if (ci===1) cell.alignment = { wrapText: true, vertical: 'top' };
      if (ci===2) cell.numFmt = '@'; // код номенклатуры — текстом, не терять ведущие нули
      if (ci===0||ci===3) cell.alignment = { horizontal: 'center' };
      // Без разделителя тысяч: у "#,##0.##" на целых значениях (вес не
      // задан, qty вроде 20) Excel иногда рисует висящую запятую без
      // цифр после неё — количество тут всегда маленькое, группировка не
      // нужна вообще, проще её не включать, чем гоняться за этим багом.
      if (ci===4||ci===5) cell.numFmt = '0.##';
      if (ci>=6) cell.numFmt = '#,##0';
      if (ci>=4) cell.alignment = { horizontal: 'right' };
    });
    ws.getRow(r).height = wrapRowHeight(name, 42);
    r++;
  });
  ws.mergeCells(r,1,r,7);
  ws.getCell(r,1).value = 'Итого';
  ws.getCell(r,1).font = { bold: true };
  ws.getCell(r,1).alignment = { horizontal: 'right' };
  fullBorder(ws.getCell(r,1));
  [total, totalNds].forEach((v,i) => {
    const cell = ws.getCell(r, 8+i);
    cell.value = v;
    cell.numFmt = '#,##0';
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'right' };
    fullBorder(cell);
  });
  r += 2;
  ws.mergeCells(r,1,r,9);
  ws.getCell(r,1).value = `Всего отпущено на сумму: ${total.toLocaleString()} ₸`;
  r++;
  ws.mergeCells(r,1,r,9);
  ws.getCell(r,1).value = `Сумма прописью: ${tengeSumToWords(total)}`;
  ws.getCell(r,1).font = { bold: true };
  // Подписи — двумя колонками рядом, как в самой печатной форме (левая:
  // отгрузивший, правая: принявший), а не одна под другой: "Запасы
  // получил" — это уже подпись КЛИЕНТА, ей самое место внизу справа,
  // напротив "Отпуск разрешил"/"Отпустил", а не под ними.
  r += 2;
  labelValueCell(ws, r, 1, 4, 'Отпуск разрешил:', COMPANY_INFO.releaseAuthorizedBy);
  ws.mergeCells(r,6,r,7);
  ws.getCell(r,6).value = 'Запасы получил:';
  ws.getCell(r,6).font = { bold: true };
  signLine(ws, r, 8, 9);
  r++;
  labelValueCell(ws, r, 1, 4, 'Отпустил (водитель):', order.driver_name || '');
  ws.mergeCells(r,6,r,7);
  ws.getCell(r,6).value = 'Расшифровка подписи:';
  ws.getCell(r,6).font = { bold: true };
  signLine(ws, r, 8, 9);
  r++;
  ws.getCell(r,1).value = 'М.П.';
  ws.getCell(r,1).font = { bold: true };
}
function buildSimpleWaybillSheet(ws, order, productNameByCode) {
  const nameByCode = productNameByCode || {};
  const items = typeof order.items === 'string' ? JSON.parse(order.items||'[]') : (order.items||[]);
  const unitOf = (it) => it.is_weight_item ? 'кг' : 'шт';
  const total = order.total || 0;
  ws.columns = [{width:6},{width:13},{width:42},{width:14},{width:12},{width:12}];
  ws.mergeCells(1,1,1,6);
  ws.getCell(1,1).value = `Расходная накладная № ${order.id} от ${formatDateWordsRu(order.date)}`;
  ws.getCell(1,1).font = { bold: true, size: 13 };
  labelValueCell(ws, 3, 1, 6, 'Поставщик:', COMPANY_INFO.name);
  labelValueCell(ws, 4, 1, 6, 'Покупатель:', order.client_name);
  labelValueCell(ws, 5, 1, 6, 'Основание:', order.client_name);
  labelValueCell(ws, 6, 1, 6, 'Склад:', 'Основной склад');

  const headRow = 8;
  ['№ п/п','Код','Товар','Количество','Цена','Сумма'].forEach((label,i) => {
    const cell = ws.getCell(headRow, i+1);
    cell.value = label;
    cell.font = { bold: true };
    cell.alignment = { horizontal: 'center' };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
    fullBorder(cell);
  });
  let r = headRow + 1;
  items.forEach((it) => {
    const i = r - headRow - 1;
    const name = nameByCode[it.code]||it.name;
    const values = [i+1, it.code||'', name, `${it.qty} ${unitOf(it)}`, Number(it.price)||0, (Number(it.qty)||0)*(Number(it.price)||0)];
    values.forEach((v,ci) => {
      const cell = ws.getCell(r, ci+1);
      cell.value = v;
      fullBorder(cell);
      if (ci===1) cell.numFmt = '@'; // код — текстом, не терять ведущие нули
      if (ci===0) cell.alignment = { horizontal: 'center' };
      if (ci===2) cell.alignment = { wrapText: true, vertical: 'top' };
      if (ci>=4) { cell.numFmt = '#,##0'; cell.alignment = { horizontal: 'right' }; }
    });
    ws.getRow(r).height = wrapRowHeight(name, 42);
    r++;
  });
  ws.mergeCells(r,1,r,4);
  ws.getCell(r,1).value = 'Итого:';
  ws.getCell(r,1).font = { bold: true };
  ws.getCell(r,1).alignment = { horizontal: 'right' };
  fullBorder(ws.getCell(r,1));
  const totalCell = ws.getCell(r,5);
  ws.mergeCells(r,5,r,6);
  totalCell.value = total;
  totalCell.numFmt = '#,##0';
  totalCell.font = { bold: true };
  totalCell.alignment = { horizontal: 'right' };
  fullBorder(totalCell);
  r += 2;
  ws.mergeCells(r,1,r,6);
  ws.getCell(r,1).value = `Всего наименований ${items.length}, на сумму ${total.toLocaleString()} KZT`;
  r++;
  ws.mergeCells(r,1,r,6);
  ws.getCell(r,1).value = tengeSumToWords(total);
  ws.getCell(r,1).font = { bold: true };
  // "Отпустил"/"Получил" рядом на одной строке (как .signcols в печатной
  // форме — два блока side by side), а не один под другим.
  r += 2;
  labelValueCell(ws, r, 1, 2, 'Отпустил:', COMPANY_INFO.releaseAuthorizedBy);
  ws.getCell(r,4).value = 'Получил:';
  ws.getCell(r,4).font = { bold: true };
  signLine(ws, r, 5, 6);
}
// Скачать накладную как настоящий .xlsx (не CSV) — асинхронно, ExcelJS
// собирает буфер файла в памяти (workbook.xlsx.writeBuffer), после чего
// это обычный Blob-даунлоад, как и у остальных выгрузок в приложении.
async function downloadOrderWaybillXlsx(order, isDogovornik, productNameByCode) {
  if (typeof ExcelJS === 'undefined') {
    alert('Библиотека для формирования Excel не загрузилась — проверьте интернет-соединение и обновите страницу');
    return;
  }
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Накладная');
  if (isDogovornik) buildDogovornikWaybillSheet(ws, order, productNameByCode);
  else buildSimpleWaybillSheet(ws, order, productNameByCode);
  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `nakladnaya_${order.id}.xlsx`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Возвратная накладная (см. PUT /api/returns/:id/confirm) — та же форма,
// что и обычная накладная на отпуск (buildWaybillInnerHtml), но товар
// движется в обратную сторону: отправитель — клиент, получатель — компания.
// Печатается только после того, как зав. склад подтвердил возврат (см.
// WarehouseCabinet), а не сразу при оформлении водителем — до подтверждения
// возврат ещё не приходован в остаток, печатать по нему рано.
function buildReturnWaybillInnerHtml(ret, productNameByCode) {
  // См. комментарий в buildWaybillInnerHtml — то же самое: позиция возврата
  // унаследовала название от позиции заявки (псевдоним), накладная должна
  // печатать название из 1С.
  const nameByCode = productNameByCode || {};
  const items = ret.items || [];
  const unitOf = (it) => it.is_weight_item ? 'кг' : 'шт';
  // НДС 16% "в том числе" — см. тот же расчёт и объяснение в
  // buildWaybillInnerHtml выше: sum здесь уже цена с учётом налога, налог
  // выделяется из неё (sum*16/116), а не начисляется сверху.
  let totalNds = 0;
  const rows = items.map((it,i)=>{
    const sum = Number(it.qty)*Number(it.price);
    const nds = Math.round(sum*16/116);
    totalNds += nds;
    return `
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td>${esc(nameByCode[it.code] || it.name)}</td>
      <td style="text-align:center">${esc(it.code)}</td>
      <td style="text-align:center">${unitOf(it)}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${Number(it.price).toLocaleString()}</td>
      <td style="text-align:right">${sum.toLocaleString()}</td>
      <td style="text-align:right">${nds.toLocaleString()}</td>
    </tr>`;
  }).join('');
  return `
    <div class="topright">Приложение 26<br>к приказу Министра финансов<br>Республики Казахстан<br>от 20 декабря 2012 года № 562</div>
    <div class="toprow"><span>Организация (индивидуальный предприниматель) <b>${esc(COMPANY_INFO.name)}</b></span><span>ИИН/БИН <b>${esc(COMPANY_INFO.bin)}</b></span></div>
    <table class="docnumtable">
      <tr><th>Номер документа</th><th>Дата составления</th></tr>
      <tr><td>Возврат №${ret.id}</td><td>${formatDateDMY(ret.date)}</td></tr>
    </table>
    <h1>НАКЛАДНАЯ НА ВОЗВРАТ ЗАПАСОВ<br><span style="font-weight:400;font-size:12px">${ret.order_id?`по заявке № ${ret.order_id}`:'без привязки к заявке'}</span></h1>
    <div class="headrow">
      <div><div class="label">ОРГАНИЗАЦИЯ — ОТПРАВИТЕЛЬ</div>${esc(ret.client_name)}</div>
      <div><div class="label">ОРГАНИЗАЦИЯ — ПОЛУЧАТЕЛЬ</div>${esc(COMPANY_INFO.name)}</div>
    </div>
    <div class="headrow row2">
      <div><div class="label">ОФОРМИЛ (Ф.И.О.)</div>${esc(ret.created_by_name)}</div>
      <div><div class="label">ПОДТВЕРДИЛ (СКЛАД)</div>${esc(ret.confirmed_by_name)}</div>
      <div><div class="label">ПРИЧИНА ВОЗВРАТА</div>${ret.reason?esc(ret.reason):'—'}</div>
    </div>
    <table>
      <tr><th>№</th><th>Наименование</th><th>Номенкл. №</th><th>Ед.<br>изм.</th><th>Кол-во</th><th>Цена за ед., ₸</th><th>Сумма, ₸</th><th>Сумма НДС, ₸</th></tr>
      ${rows}
      <tr><td colspan="6" style="text-align:right;font-weight:700">Итого</td><td style="text-align:right;font-weight:700">${(ret.total||0).toLocaleString()}</td><td style="text-align:right;font-weight:700">${totalNds.toLocaleString()}</td></tr>
    </table>
    <div class="totals">
      <p>Всего принято на сумму: <b>${(ret.total||0).toLocaleString()} ₸</b></p>
      <p>Сумма прописью: ${tengeSumToWords(ret.total||0)}</p>
    </div>
    <div class="signcols">
      <div class="sign">
        <p>Сдал: <span class="signline">&nbsp;</span> подпись</p>
        <p style="margin-top:20px">М.П.</p>
      </div>
      <div class="sign">
        <p>Принял (склад): <span class="signline">${esc(ret.confirmed_by_name)}</span> подпись</p>
      </div>
    </div>`;
}
function printReturnWaybill(ret, productNameByCode) {
  openPrintOverlay(buildReturnWaybillInnerHtml(ret, productNameByCode), WAYBILL_STYLE, true);
}

// Стили печатных форм (накладная/загрузочный лист) — селекторы намеренно
// со scope-префиксом .printScope, а не голые body/table/h1: раньше эти
// правила жили в HTML-документе отдельного window.open()-окна (там body{}
// матчил только body ЭТОГО окна), но с переходом на оверлей в текущем
// окне (см. openPrintOverlay ниже) голый body{}/table{}/h1{} наложился бы
// на весь остальной сайт, пока оверлей открыт.
const WAYBILL_STYLE = `
    .printScope{font-family:Arial, sans-serif; font-size:11px; padding:20px; color:#111; max-width:900px; margin:0 auto; background:#fff;}
    .printScope .topright{text-align:right; font-size:10px; line-height:1.4; margin-bottom:10px;}
    .printScope h1{font-size:14px; text-align:center; margin:14px 0;}
    .printScope table{width:100%; border-collapse:collapse; margin:10px 0;}
    .printScope th,.printScope td{border:1px solid #333; padding:4px 6px; font-size:10px;}
    .printScope th{background:#f0f0f0; text-align:center;}
    .printScope table.docnumtable{width:auto; margin:0 0 8px auto;}
    .printScope table.docnumtable td{text-align:center;}
    .printScope .headrow{display:flex; border:1px solid #333; margin-top:14px;}
    .printScope .headrow.row2{border-top:none; margin-top:0;}
    .printScope .headrow > div{flex:1; border-right:1px solid #333; padding:6px;}
    .printScope .headrow > div:last-child{border-right:none;}
    .printScope .headrow .label{font-size:9px; color:#444; margin-bottom:4px;}
    .printScope .toprow{display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:6px;}
    .printScope .headrow .miniqr{display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center;}
    .printScope .headrow .miniqr img{width:60px; height:60px; display:block; margin:0 0 2px;}
    .printScope .headrow .miniqr p{margin:0; font-size:8px; color:#444; line-height:1.2;}
    .printScope .totals{margin-top:8px; font-size:11px;}
    .printScope .totals p{margin:6px 0;}
    /* "Расходная накладная" (см. buildExpenseWaybillInnerHtml) — простой
       бланк без таблицы-"шапки" формы З-2: заголовок + строка .exptop
       (список полей label/value слева, QR справа — клиент попросил именно
       в правый верхний угол бланка, а не отдельным блоком по центру). */
    .printScope .exphead{font-size:17px; font-weight:800; border-bottom:2px solid #333; padding-bottom:8px; margin-bottom:12px;}
    .printScope .exptop{display:flex; justify-content:space-between; align-items:flex-start; gap:12px; margin-bottom:14px;}
    .printScope table.expfields{width:auto; border:none; margin:0;}
    .printScope table.expfields td{border:none; padding:3px 0; font-size:12px;}
    .printScope table.expfields td.expfields-label{color:#444; padding-right:24px; white-space:nowrap; vertical-align:top;}
    .printScope table.expfields td.expfields-value{font-weight:700;}
    .printScope .miniqr{display:flex; flex-direction:column; align-items:center; text-align:center; flex-shrink:0; margin:0;}
    .printScope .miniqr img{width:70px; height:70px; display:block; margin:0 0 4px;}
    .printScope .miniqr p{margin:0; font-size:10px; color:#444;}
    .printScope .signcols{display:flex; gap:16px;}
    .printScope .signcols .sign{flex:1; min-width:0;}
    .printScope .sign{margin-top:24px;}
    .printScope .sign p{margin:14px 0 2px;}
    .printScope .signline{display:inline-block; min-width:220px; border-bottom:1px solid #333; margin:0 6px;}
    .printScope .btnbar{text-align:center; margin-bottom:20px; display:flex; gap:10px; justify-content:center;}
    .printScope .btnbar button{padding:12px 24px; font-size:15px; font-weight:700; cursor:pointer; border-radius:8px; border:none; color:#fff;}
    @media print { .printScope .btnbar{display:none;} }`;

// Печать по несколько накладных на лист A4 (см. printWaybillsBatch) — та
// же вёрстка накладной, но со уменьшенными шрифтами/отступами, и с
// разрывом страницы после каждой ГРУППЫ, а не после каждой накладной.
// Форма З-2 (договорники) при этом масштабе не используется — только
// компактная "Расходная накладная", которая по 3 штуки с запасом
// умещается на A4 (проверено: ~258px каждая против ~1000-1046px печатной
// области). Для заявки с необычно большим числом позиций группа всё
// равно может не влезть на одну физическую страницу — тогда браузер
// просто перенесёт остаток на следующую, без потери содержимого.
const WAYBILL_PAIR_STYLE = WAYBILL_STYLE + `
    .printScope .waybillSheet{margin-bottom:0;}
    .printScope .waybillSlot{font-size:9px; padding:10px 14px;}
    .printScope .waybillSlot .topright{font-size:8px; margin-bottom:6px;}
    .printScope .waybillSlot h1{font-size:11px; margin:8px 0;}
    .printScope .waybillSlot table{margin:6px 0;}
    .printScope .waybillSlot th,.printScope .waybillSlot td{padding:2px 4px; font-size:8px;}
    .printScope .waybillSlot .headrow{margin-top:8px;}
    .printScope .waybillSlot .headrow > div{padding:4px;}
    .printScope .waybillSlot .headrow .label{font-size:7px; margin-bottom:2px;}
    .printScope .waybillSlot .totals{margin-top:6px; font-size:9px;}
    .printScope .waybillSlot .totals p{margin:3px 0;}
    .printScope .waybillSlot .signcols{gap:8px;}
    .printScope .waybillSlot .sign{margin-top:10px;}
    .printScope .waybillSlot .sign p{margin:8px 0 2px;}
    .printScope .waybillSlot .signline{min-width:110px;}
    .printScope .waybillSlot .headrow .miniqr img{width:38px; height:38px;}
    .printScope .waybillSlot .headrow .miniqr p{font-size:6px;}
    .printScope .cutline{text-align:center; font-size:10px; color:#888; margin:8px 0; border-top:1px dashed #999; position:relative; top:-1px;}
    /* Уменьшенный "Расходной накладной" (см. buildExpenseWaybillInnerHtml)
       при печати парой на лист — та же логика уменьшения, что и у формы
       З-2 выше, только для собственных классов этого бланка. */
    .printScope .waybillSlot .exphead{font-size:11px; padding-bottom:5px; margin-bottom:8px;}
    .printScope .waybillSlot .exptop{margin-bottom:8px;}
    .printScope .waybillSlot table.expfields td{font-size:8px; padding:1px 0;}
    .printScope .waybillSlot table.expfields td.expfields-label{padding-right:12px;}
    .printScope .waybillSlot .miniqr img{width:36px; height:36px;}
    .printScope .waybillSlot .miniqr p{font-size:6px;}
    @media print { .printScope .waybillSheet{page-break-after:always;} .printScope .waybillSheet:last-child{page-break-after:auto;} }`;

// Загрузочный лист — экран для склада/водителя, обычно открывается на
// телефоне (не для печати на бумаге, как накладная, поэтому кнопка
// "Печать" тут не нужна, а вёрстка должна помещаться на узком экране без
// зума). Отдельный набор мобильных правил поверх WAYBILL_STYLE, чтобы не
// затронуть накладную (buildWaybillInnerHtml/printWaybill) — там формат
// официального документа и печать/PDF по-прежнему нужны.
const LOADING_LIST_STYLE = WAYBILL_STYLE + `
    .printScope .tablewrap{overflow-x:auto; -webkit-overflow-scrolling:touch;}
    @media (max-width:480px) {
      .printScope{padding:12px 10px; font-size:11px;}
      .printScope h1{font-size:13px; margin:10px 0;}
      .printScope .headrow{flex-direction:column;}
      .printScope .headrow > div{border-right:none; border-bottom:1px solid #333; padding:8px;}
      .printScope .headrow > div:last-child{border-bottom:none;}
      .printScope th,.printScope td{padding:5px 6px; font-size:10.5px;}
      .printScope .btnbar{margin-bottom:14px;}
      .printScope .btnbar button{flex:1; padding:13px; font-size:14px;}
      .printScope .sign p{font-size:12px;}
      .printScope .signline{min-width:120px;}
    }`;

// Печатные формы раньше открывались в новом окне (window.open('','_blank')
// + document.write). В установленном как PWA приложении на Android
// ("display":"standalone" в manifest.json) у нового окна нет вкладки
// браузера, куда его открыть — ОС/Chrome вместо полноценного окна создают
// маленький попап не по размеру экрана ("маленький квадратик"), и контент
// в нём либо не помещается, либо не рендерится нормально. Вместо этого
// показываем форму оверлеем поверх ТЕКУЩЕГО окна (тот же приём, что уже
// использовался для html2canvas в shareWaybillPdf) — новое окно вообще не
// открывается, поэтому эта проблема пропадает на любой платформе.
function openPrintOverlay(bodyHtml, styleText, showPrintButton) {
  // Если предыдущий оверлей ещё не закрыт (например, двойное нажатие на
  // "Печать накладных" — второй клик успевает открыть ВТОРОЙ оверлей раньше,
  // чем пользователь закрыл первый через "Закрыть") — старый host с тем же
  // id остаётся в DOM. document.body.appendChild() с повторяющимся id не
  // заменяет прежний элемент, а добавляет второй рядом; при печати оба
  // становятся position:static (см. правило ниже) и уходят на печать один
  // за другим на том же листе — так на бумаге видна лишняя (старая)
  // накладная поверх новой. Снимаем прошлый оверлей перед тем как открыть
  // новый, чтобы одновременно был активен только один.
  const prevHost = document.getElementById('printOverlayHost');
  if (prevHost) prevHost.remove();
  const prevRule = document.getElementById('printOverlayHostRule');
  if (prevRule) prevRule.remove();

  const host = document.createElement('div');
  host.id = 'printOverlayHost';
  host.className = 'printScope';
  host.style.cssText = 'position:fixed;inset:0;z-index:99999;overflow:auto;background:#fff;';

  const styleEl = document.createElement('style');
  styleEl.textContent = styleText;
  host.appendChild(styleEl);

  // Печать текущего окна как есть напечатала бы весь остальной сайт вместе
  // с оверлеем — на время, пока оверлей открыт, прячем всё остальное.
  const printRule = document.createElement('style');
  printRule.id = 'printOverlayHostRule';
  printRule.textContent = `@media print {
    body > *:not(#printOverlayHost) { display:none !important; }
    #printOverlayHost { position:static !important; overflow:visible !important; }
  }`;

  const cleanup = () => {
    if (host.parentNode) document.body.removeChild(host);
    if (printRule.parentNode) document.head.removeChild(printRule);
  };

  const btnbar = document.createElement('div');
  btnbar.className = 'btnbar';
  if (showPrintButton) {
    const printBtn = document.createElement('button');
    printBtn.type = 'button';
    printBtn.textContent = '🖨 Печать';
    printBtn.style.background = '#1C1917';
    printBtn.onclick = () => window.print();
    btnbar.appendChild(printBtn);
  }
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.textContent = '✕ Закрыть';
  closeBtn.style.background = '#6B7280';
  closeBtn.onclick = cleanup;
  btnbar.appendChild(closeBtn);
  host.appendChild(btnbar);

  const content = document.createElement('div');
  content.innerHTML = bodyHtml;
  host.appendChild(content);

  document.head.appendChild(printRule);
  document.body.appendChild(host);
  return cleanup;
}

// Договорники — форма З-2 (официальный бланк на отпуск запасов, приказ
// Минфина №562), но без Kaspi QR: рассчитываются по договору, а не
// переводом на месте (см. buildWaybillInnerHtml). Все остальные — простая
// "Расходная накладная" (см. buildExpenseWaybillInnerHtml), но ВСЕГДА с
// Kaspi QR — для них это основной способ принять оплату у клиента.
function printWaybill(order, isDogovornik, productNameByCode) {
  const html = isDogovornik
    ? buildWaybillInnerHtml(order, { hideQr: true, productNameByCode })
    : buildExpenseWaybillInnerHtml(order, productNameByCode);
  openPrintOverlay(html, WAYBILL_STYLE, true);
}

// Пачка накладных сразу по нескольким заявкам (например, по всем заявкам
// одного водителя за день, после отбора по водителю в списке заявок).
// Договорники — форма З-2, каждая одна на полном листе, обычным (не
// уменьшенным) размером, без Kaspi QR (см. printWaybill выше). Остальные —
// "Расходная накладная" с QR, по 3 на лист A4 (уменьшенный шрифт, см.
// WAYBILL_PAIR_STYLE) — разрыв страницы после каждой ГРУППЫ из трёх, а не
// после каждой накладной, чтобы не расходовать бумагу впустую.
function printWaybillsBatch(orders, dogovornikCodes, productNameByCode) {
  if (!orders.length) { alert('Нет заявок для печати'); return; }
  // Заявка с неподтверждённым весом (is_weight_item && !weight_confirmed) —
  // её qty всё ещё ОЦЕНКА торгового (см. POST /api/orders), а не факт.
  // вес с весов склада, поэтому сумма в накладной может быть неточной.
  // Раньше это только предупреждало (window.confirm "всё равно напечатать?")
  // и по факту печатало ВСЕ заявки, включая невзвешенные — по просьбе
  // владельца печатаются только те, что уже прошли проверку зав. склада;
  // невзвешенные молча исключаются из пачки, а не блокируют печать
  // остальных.
  const pendingOrders = orders.filter(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
    return items.some(it => it.is_weight_item && !it.weight_confirmed);
  });
  const readyOrders = orders.filter(o => !pendingOrders.includes(o));
  if (readyOrders.length === 0) {
    alert(`Печать недоступна: по ${pendingOrders.length===1?'заявке':'всем заявкам'} (№${pendingOrders.map(o=>o.id).join(', №')}) вес ещё не подтверждён складом.`);
    return;
  }
  if (pendingOrders.length > 0) {
    if (!window.confirm(`По ${pendingOrders.length} ${pendingOrders.length===1?'заявке':'заявкам'} (№${pendingOrders.map(o=>o.id).join(', №')}) вес ещё не подтверждён складом — ${pendingOrders.length===1?'она':'они'} не будет напечатана.\n\nНапечатать накладные по остальным ${readyOrders.length} из ${orders.length}?`)) return;
  } else if (!window.confirm(`Напечатать накладные по ${readyOrders.length} ${readyOrders.length===1?'заявке':'заявкам'}?`)) {
    return;
  }
  const dogSet = dogovornikCodes || new Set();
  const dogovornikOrders = readyOrders.filter(o => dogSet.has(o.client_code));
  const regularOrders = readyOrders.filter(o => !dogSet.has(o.client_code));
  // margin-bottom — только видимый на экране зазор между листами в
  // превью; на печать не влияет (там разрыв страницы делает page-break-after,
  // см. .waybillSheet в WAYBILL_PAIR_STYLE).
  const sheets = [];
  // Договорники — каждая накладная одна на полном листе, обычным (не
  // уменьшенным) размером, и без Kaspi QR (см. комментарий выше).
  dogovornikOrders.forEach(o => {
    sheets.push(`
      <div class="waybillSheet" style="margin-bottom:32px;">
        ${buildWaybillInnerHtml(o, { hideQr: true, productNameByCode })}
      </div>`);
  });
  // "Расходная накладная" заметно компактнее формы З-2 — на уменьшенном
  // масштабе WAYBILL_PAIR_STYLE три штуки с запасом умещаются на одном
  // листе A4 (проверено: ~258px каждая, 850px на три с линиями отреза
  // против ~1000-1046px печатной области), поэтому режем по 3, а не по 2.
  for (let i = 0; i < regularOrders.length; i += 3) {
    const group = regularOrders.slice(i, i + 3);
    const slots = group.map((o, idx) =>
      (idx > 0 ? '<div class="cutline">✂ линия отреза</div>' : '') +
      `<div class="waybillSlot">${buildExpenseWaybillInnerHtml(o, productNameByCode)}</div>`
    ).join('');
    sheets.push(`<div class="waybillSheet" style="margin-bottom:32px;">${slots}</div>`);
  }
  openPrintOverlay(sheets.join(''), WAYBILL_PAIR_STYLE, true);
}

function buildLoadingListHtml(orders, driverName, productByCode) {
  const productByCode_ = productByCode || {};
  const totals = {};
  orders.forEach(o=>{
    const items = typeof o.items === 'string' ? JSON.parse(o.items||'[]') : (o.items||[]);
    items.forEach(it=>{
      const key = it.code || it.name;
      if (!totals[key]) totals[key] = { name: it.name, code: it.code||'', qty: 0, isWeight: false, allWeighed: true };
      totals[key].qty += Number(it.qty)||0;
      // "Ед. изм." по одному только снимку is_weight_item на заявке — та же
      // ловушка, что уже чинили в WarehouseCabinet (см. isWeightItem там):
      // заявка, оформленная до того как товар отметили "Весовой" в карточке,
      // осталась бы с is_weight_item=false и ошибочно показывала бы "шт".
      // Подстраховываемся live-флагом priced_by_weight из каталога, когда он
      // доступен (передаётся из WarehouseCabinet, где каталог уже загружен).
      const isWeight = !!(it.is_weight_item || (productByCode_[it.code] && productByCode_[it.code].priced_by_weight));
      // "Отметка склада" раньше всегда печаталась пустой ячейкой для ручной
      // записи, даже если зав. склад уже взвесил позицию в приложении (см.
      // POST /api/orders/weights) — теперь подтягиваем факт. отметку оттуда:
      // если позиция весовая и по ВСЕМ заявкам партии уже подтверждена,
      // считаем её взвешенной. Без привязки к конкретному имени — это общая
      // отметка склада, а не подпись того, кто именно нажал "Сохранить вес"
      // (им мог быть и admin, исправлявший ошибку веса).
      if (isWeight) {
        totals[key].isWeight = true;
        if (!it.weight_confirmed) totals[key].allWeighed = false;
      } else {
        totals[key].allWeighed = false;
      }
    });
  });
  const rows = Object.values(totals).sort((a,b)=>a.name.localeCompare(b.name)).map((it,i)=>{
    const unit = it.isWeight ? 'кг' : 'шт';
    const weighed = it.isWeight && it.allWeighed;
    // Штучный товар не взвешивается вовсе (для него нет ни весового пула, ни
    // подтверждения — см. isWeight выше), поэтому для него нет отдельного
    // "факта" ждать: отметка склада для него просто "отгружено по счёту" —
    // раньше эта ячейка оставалась пустой и для него тоже, хотя ждать там
    // взвешивания бессмысленно, отмечать было нечем.
    const mark = weighed ? '✓ взвешено' : (!it.isWeight ? '✓ отгружено' : '');
    return `
    <tr>
      <td style="text-align:center">${i+1}</td>
      <td>${esc(it.name)}</td>
      <td style="text-align:center">${esc(it.code)}</td>
      <td style="text-align:center">${unit}</td>
      <td style="text-align:center">${it.qty} ${unit}</td>
      <td style="text-align:center">${weighed?it.qty+' '+unit:''}</td>
      <td style="text-align:center">${mark}</td>
    </tr>`;
  }).join('');
  const now = new Date();
  const orderNumbers = orders.map(o=>'№'+o.id).join(', ');
  return `
    <h1>ЗАГРУЗОЧНЫЙ ЛИСТ<br><span style="font-weight:400;font-size:12px">${now.toLocaleDateString('ru-RU')} · Водитель: ${esc(driverName)}</span></h1>
    <div class="headrow">
      <div><div class="label">ОРГАНИЗАЦИЯ</div>${esc(COMPANY_INFO.name)}</div>
      <div><div class="label">ВОДИТЕЛЬ</div>${esc(driverName)}</div>
      <div><div class="label">ЗАЯВОК В ПАРТИИ</div>${orders.length} шт (${orderNumbers})</div>
    </div>
    <div class="tablewrap">
    <table>
      <tr><th>№</th><th>Наименование</th><th>Номенкл. №</th><th>Ед. изм.</th><th>Кол-во к отгрузке</th><th>Вес, кг</th><th>Отметка склада</th></tr>
      ${rows}
    </table>
    </div>
    <div class="sign">
      <p>Выдал (складовщик): <span class="signline">&nbsp;</span> подпись</p>
      <p>Принял (водитель): <span class="signline">${esc(driverName)}</span> подпись</p>
      <p>Дата/время выдачи: <span class="signline">&nbsp;</span></p>
    </div>`;
}

function printLoadingList(orders, driverName, productByCode) {
  if (!orders.length) { alert('Нет заявок в статусе "В работе" для формирования листа'); return; }
  openPrintOverlay(buildLoadingListHtml(orders, driverName, productByCode), LOADING_LIST_STYLE, false);
}

async function shareWaybillPdf(order, isDogovornik, productNameByCode) {
  if (!window.jspdf || !window.html2canvas) {
    alert('Модуль печати ещё загружается, попробуйте через пару секунд');
    return;
  }
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.inset = '0';
  overlay.style.background = '#fff';
  overlay.style.zIndex = '99999';
  overlay.style.overflow = 'auto';
  overlay.style.display = 'flex';
  overlay.style.justifyContent = 'center';

  const label = document.createElement('div');
  label.textContent = 'Формируем PDF...';
  label.style.position = 'fixed';
  label.style.top = '8px';
  label.style.left = '0';
  label.style.right = '0';
  label.style.textAlign = 'center';
  label.style.color = '#888';
  label.style.fontSize = '13px';
  label.style.fontFamily = 'Arial, sans-serif';

  const container = document.createElement('div');
  container.className = 'printScope';
  container.style.width = '780px';
  container.style.background = '#fff';
  container.style.marginTop = '36px';
  container.style.marginBottom = '20px';
  const styleTag = document.createElement('style');
  styleTag.textContent = WAYBILL_STYLE;
  container.appendChild(styleTag);
  const contentDiv = document.createElement('div');
  contentDiv.innerHTML = isDogovornik
    ? buildWaybillInnerHtml(order, { hideQr: true, productNameByCode })
    : buildExpenseWaybillInnerHtml(order, productNameByCode);
  container.appendChild(contentDiv);

  overlay.appendChild(label);
  overlay.appendChild(container);
  document.body.appendChild(overlay);

  try {
    await new Promise(r => setTimeout(r, 50));
    // Дожидаемся загрузки картинок (Kaspi QR в накладной, см.
    // buildWaybillInnerHtml) — без этого html2canvas мог бы снять снимок
    // раньше, чем браузер успел подгрузить /kaspi-qr.png, и в PDF попал бы
    // пустой квадрат вместо QR-кода.
    await Promise.all(Array.from(container.querySelectorAll('img')).map(img =>
      img.complete ? Promise.resolve() : new Promise(res => { img.onload = res; img.onerror = res; })
    ));
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    document.body.removeChild(overlay);

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const imgData = canvas.toDataURL('image/png');
    const usableHeight = pageHeight - margin * 2;

    let heightLeft = imgHeight;
    let position = margin;
    doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
    heightLeft -= usableHeight;
    while (heightLeft > 0) {
      position = margin - (imgHeight - heightLeft);
      doc.addPage();
      doc.addImage(imgData, 'PNG', margin, position, imgWidth, imgHeight);
      heightLeft -= usableHeight;
    }

    const blob = doc.output('blob');
    const fileName = `nakladnaya-${order.id}.pdf`;
    const file = new File([blob], fileName, { type: 'application/pdf' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `Накладная №${order.id}` });
      return;
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = fileName;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(()=>URL.revokeObjectURL(url), 5000);
    alert('PDF скачан. На компьютере системная отправка в WhatsApp недоступна — прикрепите файл вручную. На телефоне эта же кнопка сразу откроет "Поделиться".');
  } catch(e) {
    if (document.body.contains(overlay)) document.body.removeChild(overlay);
    if (e && e.name === 'AbortError') return;
    alert('Не удалось сформировать PDF: ' + e.message);
  }
}

// Просмотр фото (накладной/наличности/чека QR) оверлеем поверх текущего
// окна вместо <a target="_blank"> — та же причина, что и у openPrintOverlay
// выше: в установленном как PWA приложении новая вкладка на некоторых
// моделях телефонов открывается без системной панели (без кнопки "Назад"/
// "Закрыть"), и её нечем закрыть, кроме как убить всё приложение целиком и
// открыть заново. Оверлей в том же окне всегда даёт видимую кнопку ✕.
function PhotoViewerOverlay({ src, onClose }) {
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(17,17,17,0.92)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center"}} onClick={onClose}>
      <button style={{position:"absolute",top:14,right:14,width:40,height:40,borderRadius:20,border:"none",background:"#fff",color:"#111",fontSize:20,fontWeight:700,cursor:"pointer"}} onClick={onClose}>✕</button>
      <img src={src} style={{maxWidth:"92%",maxHeight:"88%",objectFit:"contain",borderRadius:6}} onClick={e=>e.stopPropagation()}/>
    </div>
  );
}

function OrderDetail({ order, onClose, onUpdateStatus, onDeleteOrder, onFixItemCost, onFixItemWeight, onEditDeliveredItems, onEditPrices, currentUser, drivers, products }) {
  // Позиции заявки хранят псевдоним товара (см. addToCart), а в накладной
  // должно быть название из 1С (см. buildWaybillInnerHtml) — карта код->
  // название из уже загруженного в кабинете каталога (products), которую
  // передаём в printWaybill/shareWaybillPdf ниже.
  const productNameByCode = useMemo(() => {
    const map = {};
    (products || []).forEach(p => { map[p.code] = p.name; });
    return map;
  }, [products]);
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const [fixingCostIndex, setFixingCostIndex] = useState(null);
  const [costInput, setCostInput] = useState("");
  const [savingCost, setSavingCost] = useState(false);
  const [fixingWeightIndex, setFixingWeightIndex] = useState(null);
  const [weightInput, setWeightInput] = useState("");
  const [savingWeight, setSavingWeight] = useState(false);
  const [viewPhoto, setViewPhoto] = useState(null);
  // Правка кол-ва по позициям уже ДОСТАВЛЕННОЙ заявки задним числом — см.
  // PUT /api/orders/:id/delivered-items на сервере. Доступно только admin
  // (onEditDeliveredItems передаётся только из AdminCabinet и только ему).
  const [editingDelivered, setEditingDelivered] = useState(false);
  const [deliveredQty, setDeliveredQty] = useState({});
  const [editReason, setEditReason] = useState("");
  const [savingDeliveredItems, setSavingDeliveredItems] = useState(false);
  const [editHistoryOpen, setEditHistoryOpen] = useState(false);
  // Свободная правка цены — только admin, до статуса "Доставлено"
  // включительно (см. PUT /api/orders/:id/prices на сервере и onEditPrices
  // выше — передаётся только из AdminCabinet и только ему).
  const [editingPrices, setEditingPrices] = useState(false);
  const [priceInputs, setPriceInputs] = useState({});
  const [priceReason, setPriceReason] = useState("");
  const [savingPrices, setSavingPrices] = useState(false);
  // Договорник ли клиент заявки (см. DogovornikModal/is_dogovornik) — влияет
  // на печать накладной: см. printWaybill/buildWaybillInnerHtml (hideQr).
  const [isDogovornik, setIsDogovornik] = useState(false);
  useEffect(() => {
    let cancelled = false;
    apiCall('GET', '/api/clients').then(list => {
      if (cancelled) return;
      const c = list.find(x => x.code === order.client_code);
      setIsDogovornik(!!(c && c.is_dogovornik));
    }).catch(()=>{});
    return () => { cancelled = true; };
  }, [order.client_code]);
  const items = typeof order.items === 'string' ? JSON.parse(order.items||'[]') : (order.items||[]);
  const payment = typeof order.payment === 'string' ? JSON.parse(order.payment||'{}') : (order.payment||{cash:order.payment_cash||0,qr:order.payment_qr||0,debt:order.payment_debt||0});
  // Исходный состав заявки на момент оформления — пишется на заявку только
  // при частичной доставке (см. PUT /api/orders/:id/status, patch.items_ordered),
  // чтобы было видно, что именно клиент не принял целиком/частично.
  const itemsOrdered = order.items_ordered ? (typeof order.items_ordered === 'string' ? JSON.parse(order.items_ordered||'[]') : order.items_ordered) : [];
  // Эталон для правки кол-ва задним числом (см. onEditDeliveredItems ниже) —
  // то же самое, что сервер берёт за потолок в PUT /api/orders/:id/delivered-items:
  // items_ordered, если он уже есть (заявку уже сокращали), иначе текущий
  // состав (значит, это первая правка и сокращать больше него нельзя).
  const deliveredRefItems = itemsOrdered.length > 0 ? itemsOrdered : items;
  const qtyKeyD = (it, i) => it.code || `i${i}`;
  const startEditingDelivered = () => {
    const init = {};
    deliveredRefItems.forEach((ref, i) => {
      const cur = items.find(it => it.code === ref.code);
      init[qtyKeyD(ref, i)] = String(cur ? cur.qty : 0);
    });
    setDeliveredQty(init);
    setEditReason("");
    setEditingDelivered(true);
  };
  const acceptedForD = (ref, i) => {
    // Раньше значение молча срезалось до refQty (Math.min) — если админ
    // вписывал больше исходного (например, исправляя опечатку в весе,
    // взвешенном раньше), кнопка "Сохранить" визуально работала, а
    // сумма/остаток не менялись вообще, без единой ошибки — см. серверную
    // часть (PUT /api/orders/:id/delivered-items), там тот же потолок снят.
    const raw = Number(deliveredQty[qtyKeyD(ref, i)]);
    if (!Number.isFinite(raw) || raw < 0) return 0;
    return raw;
  };
  const saveDeliveredItems = async () => {
    if (savingDeliveredItems) return;
    const payloadItems = deliveredRefItems.map((ref, i) => ({ code: ref.code, qty: acceptedForD(ref, i) }));
    if (!window.confirm(`Исправить доставленное кол-во по заявке № ${order.id}? Сумма, остаток на складе и комиссия торгового пересчитаются задним числом.`)) return;
    setSavingDeliveredItems(true);
    try {
      const res = await onEditDeliveredItems(order.id, payloadItems, editReason);
      setEditingDelivered(false);
      if (res && res.payment_mismatch) {
        alert('Готово. Обратите внимание: сумма заявки после правки больше не совпадает с уже принятой оплатой (нал/QR/долг) — оплату сверьте отдельно.');
      }
    } catch(e) { alert(e.message); }
    setSavingDeliveredItems(false);
  };
  const startEditingPrices = () => {
    const init = {};
    items.forEach(it => { if (it.code) init[it.code] = String(it.price); });
    setPriceInputs(init);
    setPriceReason("");
    setEditingPrices(true);
  };
  const savePrices = async () => {
    if (savingPrices) return;
    const payloadItems = items.filter(it=>it.code).map(it => ({ code: it.code, price: Number(priceInputs[it.code]) }));
    if (payloadItems.some(it=>!Number.isFinite(it.price)||it.price<0)) { alert('Укажите корректную цену для всех позиций'); return; }
    if (!window.confirm(`Изменить цену по заявке № ${order.id}? Сумма заявки пересчитается.`)) return;
    setSavingPrices(true);
    try {
      const res = await onEditPrices(order.id, payloadItems, priceReason);
      setEditingPrices(false);
      if (res && res.payment_mismatch) {
        alert('Готово. Обратите внимание: сумма заявки после правки больше не совпадает с уже принятой оплатой (нал/QR/долг) — оплату сверьте отдельно.');
      }
    } catch(e) { alert(e.message); }
    setSavingPrices(false);
  };
  // Весовые позиции, вес которых ещё не подтверждён складом (см.
  // POST /api/orders/weights) — до этого кол-во в заявке условное, и
  // накладная/PDF с текущей суммой могут оказаться неточными. Печать
  // такой заявки заблокирована (не просто предупреждение с возможностью
  // напечатать всё равно — по просьбе владельца печатается только то,
  // что уже прошло проверку зав. складом, см. printWaybillsBatch).
  const pendingWeightItems = items.filter(it=>it.is_weight_item && !it.weight_confirmed);
  const confirmPrintIfPending = (fn) => {
    if (pendingWeightItems.length>0) {
      alert(`Печать недоступна: вес по ${pendingWeightItems.length===1?'позиции':'позициям'} (${pendingWeightItems.map(it=>it.name).join(', ')}) ещё не подтверждён складом.`);
      return;
    }
    fn();
  };
  // Выгрузка НАКЛАДНОЙ (не просто списка позиций) в Excel — тот же бланк,
  // что и "Печать накладной", только настоящим .xlsx с рамками/жирным
  // шрифтом (см. downloadOrderWaybillXlsx), а не голым текстом CSV: CSV
  // Excel открывает без единой рамки, по виду это список, а не документ.
  // По просьбе владельца: если у клиента накладная разошлась с 1С
  // (например, контрагента переименовали в 1С уже после того, как заявка
  // была создана — имя в заявке снимок на момент оформления, см.
  // finalClientName на сервере, и задним числом не обновляется), проще
  // скачать бланк и поправить вручную в Excel, чем ждать правки на сайте.
  const [exportingXlsx, setExportingXlsx] = useState(false);
  const exportOrderXlsx = async () => {
    if (exportingXlsx) return;
    setExportingXlsx(true);
    try { await downloadOrderWaybillXlsx(order, isDogovornik, productNameByCode); }
    catch(e) { alert('Не получилось сформировать Excel: ' + e.message); }
    setExportingXlsx(false);
  };
  // Самовывоз клиент забирает прямо со склада, без водителя — зав. склад
  // сам "берёт в работу" и сам же закрывает такую заявку при выдаче товара
  // (см. canChange на сервере), тем же способом, что и водитель у обычной
  // доставки: те же три блока ниже, просто с добавленным условием роли.
  const canWarehousePickup = currentUser.role==="warehouse" && order.time_slot===PICKUP_SLOT;
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}}>
      <div style={{background:C.white,margin:"16px",borderRadius:16,padding:20,maxWidth:480,marginLeft:"auto",marginRight:"auto",border:`1px solid ${C.border}`}}>
        <div style={{...S.row,marginBottom:14}}>
          <div>
            <p style={{margin:0,fontSize:13,color:C.textFaint,fontWeight:600,textTransform:"uppercase"}}>Заявка</p>
            <p style={{margin:0,fontSize:20,fontWeight:800,fontFamily:FH,color:C.navy}}>№ {order.id}</p>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <StatusBadge status={order.status} partial={order.partial_delivery}/>
            <button style={S.btnSecondary} onClick={onClose}>✕</button>
          </div>
        </div>
        {pendingWeightItems.length>0&&(
          <div style={{background:"#FEF3C7",border:"1px solid #FDE68A",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:14,color:"#92400E",fontWeight:600}}>
            ⚖️ Вес не подтверждён складом: {pendingWeightItems.map(it=>it.name).join(', ')}. Сумма заявки может измениться.
          </div>
        )}
        {order.partial_delivery&&itemsOrdered.length>0&&(
          <div style={{background:"#F5F3FF",border:"1px solid #DDD6FE",borderRadius:10,padding:"10px 12px",marginBottom:12,fontSize:14,color:"#5B21B6",fontWeight:600}}>
            ↩️ Клиент принял не всё: {itemsOrdered.map(oi=>{
              const delivered = items.find(it=>it.code===oi.code);
              const deliveredQty = delivered ? (Number(delivered.qty)||0) : 0;
              const orderedQty = Number(oi.qty)||0;
              if (deliveredQty + 1e-9 >= orderedQty) return null;
              const unit = oi.is_weight_item ? 'кг' : 'шт';
              return `${oi.name} (заказано ${orderedQty} ${unit}, принято ${deliveredQty} ${unit})`;
            }).filter(Boolean).join('; ')}
          </div>
        )}
        {currentUser.role!=="driver" && (
          <div style={{display:"flex",gap:8,marginBottom:14}}>
            <button style={{flex:1,padding:"11px",background:C.navy,color:C.white,border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:pendingWeightItems.length>0?"not-allowed":"pointer",opacity:pendingWeightItems.length>0?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>confirmPrintIfPending(()=>printWaybill(order,isDogovornik,productNameByCode))}>🖨 Печать накладной</button>
            <button style={{flex:1,padding:"11px",background:"#25D366",color:C.white,border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:pendingWeightItems.length>0?"not-allowed":"pointer",opacity:pendingWeightItems.length>0?0.5:1,display:"flex",alignItems:"center",justifyContent:"center",gap:6}} onClick={()=>confirmPrintIfPending(()=>shareWaybillPdf(order,isDogovornik,productNameByCode))}>📲 Отправить PDF</button>
          </div>
        )}
        {currentUser.role!=="driver" && (
          <button disabled={exportingXlsx} style={{...S.btnOutline,marginTop:0,marginBottom:14,padding:"9px",fontSize:14,opacity:exportingXlsx?0.6:1,cursor:exportingXlsx?"wait":"pointer"}} onClick={exportOrderXlsx}>{exportingXlsx?"Формирую...":"⬇ Скачать накладную в Excel"}</button>
        )}
        <hr style={S.divider}/>
        {[["Клиент",order.client_name||order.clientName],["Адрес",order.address],["Торговый",order.sales_name||order.salesName],["Дата",order.date],["Доставка",order.time_slot||order.timeSlot],...(order.created_at?[["Создана",fmtDT(order.created_at)]]:[]),...(order.driver_name?[["Водитель",order.driver_name]]:[]),...(order.driver_name&&order.in_transit_at?[["В работе с",fmtDT(order.in_transit_at)]]:[]),...(order.delivered_at?[["Доставлено",fmtDT(order.delivered_at)]]:[]),...(order.contact_name?[["Контакт",order.contact_name]]:[]),...(order.contact_phone?[["Телефон",order.contact_phone]]:[]),...(order.comment?[["Комментарий",order.comment]]:[])].map(([k,v])=>(
          <div key={k} style={{...S.row,marginBottom:8,alignItems:"flex-start"}}>
            <span style={{fontSize:14,color:C.textFaint,fontWeight:600,minWidth:90,textTransform:"uppercase"}}>{k}</span>
            <span style={{fontSize:15,color:C.text,textAlign:"right",flex:1}}>{v}</span>
          </div>
        ))}
        <hr style={S.divider}/>
        <p style={{margin:"0 0 10px",fontSize:14,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>Состав</p>
        {items.map((item,i)=>(
          <div key={i} style={{marginBottom:8}}>
            <div style={{...S.row,fontSize:15}}>
              <span style={{color:C.textMid}}>{item.name}</span>
              <span style={{color:C.textSub}}>{item.qty} × {item.price} ₸ = <strong style={{color:C.text}}>{(item.qty*item.price).toLocaleString()} ₸</strong></span>
            </div>
            {onFixItemCost && item.cost==null && (
              fixingCostIndex===i ? (
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  <input type="number" autoFocus style={{...S.input,padding:"6px 8px",fontSize:14}} placeholder="Закупочная цена за ед., ₸" value={costInput} onChange={e=>setCostInput(e.target.value)} onFocus={e=>e.target.select()}/>
                  <button disabled={savingCost||!costInput} style={{...S.btnPrimary,width:"auto",marginTop:0,padding:"6px 14px",fontSize:14,opacity:(savingCost||!costInput)?0.5:1}} onClick={async()=>{
                    setSavingCost(true);
                    try { await onFixItemCost(order.id, i, Number(costInput)); setFixingCostIndex(null); setCostInput(""); }
                    catch(e) { alert(e.message); }
                    setSavingCost(false);
                  }}>{savingCost?"...":"Сохранить"}</button>
                  <button disabled={savingCost} style={{...S.btnSecondary,width:"auto",marginTop:0,padding:"6px 14px",fontSize:14}} onClick={()=>{setFixingCostIndex(null);setCostInput("");}}>Отмена</button>
                </div>
              ) : (
                <p style={{margin:"4px 0 0",fontSize:13,color:"#92400E"}}>
                  ⚠️ Нет закупочной цены (товар не выбран из каталога) — <span style={{color:C.navy,fontWeight:600,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{setFixingCostIndex(i);setCostInput("");}}>указать вручную</span>
                </p>
              )
            )}
            {item.is_weight_item && item.weight_confirmed && (
              // Правка веса доступна только пока заявка не доставлена — после
              // доставки остаток по позиции уже списан напрямую (см. PUT
              // /api/orders/:id/status и проверку статуса в POST
              // /api/orders/weights на сервере, который эту же правку и
              // отклонит). Для уже доставленной заявки количество (в т.ч.
              // весовой позиции) правит только admin через "Исправить
              // доставленное количество" ниже — здесь для delivered
              // остаётся только информация, кто и когда взвесил, без ссылки
              // на правку, которая всё равно вернёт ошибку с сервера.
              onFixItemWeight && ["new","in_transit"].includes(order.status) && fixingWeightIndex===i ? (
                <div style={{display:"flex",gap:6,marginTop:6}}>
                  <input type="number" autoFocus style={{...S.input,padding:"6px 8px",fontSize:14}} placeholder="Правильный вес, кг" value={weightInput} onChange={e=>setWeightInput(e.target.value)} onFocus={e=>e.target.select()}/>
                  <button disabled={savingWeight||!weightInput} style={{...S.btnPrimary,width:"auto",marginTop:0,padding:"6px 14px",fontSize:14,opacity:(savingWeight||!weightInput)?0.5:1}} onClick={async()=>{
                    if (!window.confirm(`Исправить вес «${item.name}» на ${weightInput} кг? Сумма заявки и остаток на складе пересчитаются.`)) return;
                    setSavingWeight(true);
                    try { await onFixItemWeight(order.id, item.code, Number(weightInput)); setFixingWeightIndex(null); setWeightInput(""); }
                    catch(e) { alert(e.message); }
                    setSavingWeight(false);
                  }}>{savingWeight?"...":"Сохранить"}</button>
                  <button disabled={savingWeight} style={{...S.btnSecondary,width:"auto",marginTop:0,padding:"6px 14px",fontSize:14}} onClick={()=>{setFixingWeightIndex(null);setWeightInput("");}}>Отмена</button>
                </div>
              ) : (
                <p style={{margin:"4px 0 0",fontSize:13,color:C.textFaint}}>
                  Взвесил: {item.weighed_by_name||'—'}{item.weighed_at?', '+fmtDT(item.weighed_at):''}
                  {onFixItemWeight && ["new","in_transit"].includes(order.status) && (
                    <> — <span style={{color:C.navy,fontWeight:600,cursor:"pointer",textDecoration:"underline"}} onClick={()=>{setFixingWeightIndex(i);setWeightInput(String(item.qty));}}>исправить ошибку веса</span></>
                  )}
                </p>
              )
            )}
          </div>
        ))}
        <hr style={S.divider}/>
        <div style={{...S.row,fontSize:17,fontWeight:700,marginBottom:10}}>
          <span style={{color:C.textMid}}>Итого</span>
          <span style={{color:C.navy,fontFamily:FH,fontWeight:800}}>{(order.total||0).toLocaleString()} ₸</span>
        </div>
        <p style={{margin:"0 0 8px",fontSize:14,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>Оплата</p>
        <PaymentTags payment={payment}/>
        {order.delivery_photo && !(currentUser.role==="driver" && order.status==="in_transit") && (
          <div style={{marginTop:14}}>
            <p style={{margin:"0 0 8px",fontSize:14,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>Фото накладной</p>
            <img src={order.delivery_photo} onClick={()=>setViewPhoto(order.delivery_photo)} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer"}}/>
          </div>
        )}
        {order.cash_photo && !(currentUser.role==="driver" && order.status==="in_transit") && (
          <div style={{marginTop:14}}>
            <p style={{margin:"0 0 8px",fontSize:14,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>Фото наличности</p>
            <img src={order.cash_photo} onClick={()=>setViewPhoto(order.cash_photo)} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer"}}/>
          </div>
        )}
        {order.qr_photo && !(currentUser.role==="driver" && order.status==="in_transit") && (
          <div style={{marginTop:14}}>
            <p style={{margin:"0 0 8px",fontSize:14,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>Фото чека QR</p>
            <img src={order.qr_photo} onClick={()=>setViewPhoto(order.qr_photo)} style={{width:"100%",maxHeight:220,objectFit:"cover",borderRadius:10,border:`1px solid ${C.border}`,cursor:"pointer"}}/>
          </div>
        )}
        {viewPhoto && <PhotoViewerOverlay src={viewPhoto} onClose={()=>setViewPhoto(null)}/>}
        {(currentUser.role==="driver"||currentUser.role==="warehouse") && order.status==="in_transit" && order.driver_id===currentUser.id && (
          <DriverPaymentBlock order={order} onUpdateStatus={onUpdateStatus}/>
        )}
        {(currentUser.role==="driver"||currentUser.role==="warehouse") && order.status==="in_transit" && order.driver_id===currentUser.id && (
          <div style={{marginTop:8}}>
            <button style={{...S.btnOutline,borderColor:"#6B7280",color:"#6B7280"}} onClick={()=>{if(window.confirm('Вернуть заявку в очередь? Другой водитель сможет её забрать.'))onUpdateStatus(order.id,"new",null);}}>🔄 Вернуть в очередь</button>
          </div>
        )}
        {currentUser.role==="driver" && order.status==="new" && (
          <div style={{marginTop:20}}>
            <button style={S.btnPrimary} onClick={()=>onUpdateStatus(order.id,"in_transit",null)}>🚚 Взять в доставку</button>
          </div>
        )}
        {canWarehousePickup && order.status==="new" && (
          <div style={{marginTop:20}}>
            <button style={S.btnPrimary} onClick={()=>onUpdateStatus(order.id,"in_transit",null)}>📦 Выдать со склада</button>
          </div>
        )}
        {(currentUser.role==="sales"||currentUser.role==="store"||(currentUser.role==="senior_sales"&&order.sales_id===currentUser.id)) && order.status==="new" && (
          <div style={{marginTop:20}}>
            <button style={S.btnDanger} onClick={()=>{if(window.confirm('Отозвать заявку № '+order.id+'? Действие нельзя отменить.'))onUpdateStatus(order.id,"revoked",null);}}>🗑 Отозвать заявку</button>
          </div>
        )}
        {(currentUser.role==="admin"||currentUser.role==="manager") && order.status==="new" && (
          <div style={{marginTop:20}}>
            <label style={{...S.label,marginBottom:6}}>Назначить водителя</label>
            <select style={{...S.select,marginBottom:10}} value={selectedDriverId} onChange={e=>setSelectedDriverId(e.target.value)}>
              <option value="">— выберите водителя —</option>
              {(drivers||[]).map(d=>(<option key={d.id} value={d.id}>{d.name}</option>))}
            </select>
            <button style={{...S.btnOutline,opacity:selectedDriverId?1:0.5,cursor:selectedDriverId?"pointer":"not-allowed"}} disabled={!selectedDriverId} onClick={()=>{
              const driverName = (drivers||[]).find(d=>String(d.id)===String(selectedDriverId))?.name || '';
              if (!window.confirm(`Передать заявку № ${order.id} водителю «${driverName}»?`)) return;
              onUpdateStatus(order.id,"in_transit",null,Number(selectedDriverId));
            }}>🚚 Передать водителю</button>
            {(!drivers||drivers.length===0)&&<p style={{margin:"8px 0 0",fontSize:14,color:C.red}}>Нет активных водителей в системе</p>}
          </div>
        )}
        {(currentUser.role==="admin"||currentUser.role==="manager") && order.status==="in_transit" && (
          <div style={{marginTop:20,display:"flex",flexDirection:"column",gap:8}}>
            <button style={{...S.btnOutline,borderColor:"#6B7280",color:"#6B7280"}} onClick={()=>{if(window.confirm('Вернуть заявку в очередь? Другой водитель сможет её забрать.'))onUpdateStatus(order.id,"new",null);}}>🔄 Вернуть в очередь</button>
            <button style={{...S.btnOutline,borderColor:"#7C3AED",color:"#7C3AED"}} onClick={()=>{if(window.confirm('Оформить возврат по заявке № '+order.id+'? Действие нельзя отменить.'))onUpdateStatus(order.id,"returned",null);}}>↩️ Оформить возврат</button>
          </div>
        )}
        {currentUser.role==="admin" && onEditPrices && ["new","in_transit","delivered"].includes(order.status) && (
          <div style={{marginTop:20,paddingTop:16,borderTop:`1px dashed ${C.border}`}}>
            {!editingPrices ? (
              <button style={{...S.btnOutline,borderColor:"#7C3AED",color:"#7C3AED",width:"100%"}} onClick={startEditingPrices}>💰 Изменить цену</button>
            ) : (
              <div>
                <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:C.navy}}>Цена за единицу, ₸</p>
                <p style={{margin:"0 0 10px",fontSize:13,color:C.textFaint}}>Свободная цена, без ограничения каталогом — например, для VIP/оптового клиента с эксклюзивной ценой. Сумма заявки пересчитается.</p>
                {items.filter(it=>it.code).map(it=>(
                  <div key={it.code} style={{...S.row,marginBottom:8,gap:8}}>
                    <span style={{fontSize:14,color:C.text,flex:1}}>{it.name}</span>
                    <input type="number" min="0" value={priceInputs[it.code]!=null?priceInputs[it.code]:""} onFocus={e=>e.target.select()}
                      onChange={e=>setPriceInputs(a=>({...a,[it.code]:e.target.value}))}
                      style={{...S.input,width:100,padding:"7px 8px",fontSize:15,fontWeight:700,textAlign:"right"}}/>
                  </div>
                ))}
                <input style={{...S.input,marginBottom:10}} placeholder="Причина правки (необязательно)" value={priceReason} onChange={e=>setPriceReason(e.target.value)}/>
                <div style={{display:"flex",gap:8}}>
                  <button disabled={savingPrices} style={{...S.btnPrimary,flex:1,marginTop:0,opacity:savingPrices?0.5:1}} onClick={savePrices}>{savingPrices?"Сохранение...":"Сохранить"}</button>
                  <button disabled={savingPrices} style={{...S.btnSecondary,flex:1}} onClick={()=>setEditingPrices(false)}>Отмена</button>
                </div>
              </div>
            )}
          </div>
        )}
        {currentUser.role==="admin" && onEditDeliveredItems && order.status==="delivered" && (
          <div style={{marginTop:20,paddingTop:16,borderTop:`1px dashed ${C.border}`}}>
            {!editingDelivered ? (
              <button style={{...S.btnOutline,borderColor:"#7C3AED",color:"#7C3AED",width:"100%"}} onClick={startEditingDelivered}>✏️ Исправить доставленное количество</button>
            ) : (
              <div>
                <p style={{margin:"0 0 8px",fontSize:15,fontWeight:700,color:C.navy}}>Реально доставленное количество</p>
                <p style={{margin:"0 0 10px",fontSize:13,color:C.textFaint}}>Задним числом — можно и уменьшить (клиент по факту принял не всё, или ошиблись при взвешивании), и увеличить (например, исправить опечатку в записанном весе). Сумма, остаток на складе и комиссия торгового пересчитаются.</p>
                {deliveredRefItems.map((ref,i)=>{
                  const key = qtyKeyD(ref,i);
                  const unit = ref.is_weight_item?"кг":"шт";
                  const refQty = Number(ref.qty)||0;
                  const accepted = acceptedForD(ref,i);
                  const short = accepted + 1e-9 < refQty;
                  return (
                    <div key={key} style={{padding:"10px 12px",borderRadius:10,background:short?"#F5F3FF":C.surface,border:`1px solid ${short?"#DDD6FE":C.border}`,marginBottom:8}}>
                      <div style={{...S.row,marginBottom:8}}>
                        <span style={{fontSize:14,fontWeight:600,color:C.text}}>{ref.name}</span>
                        <span style={{fontSize:13,color:C.textFaint,whiteSpace:"nowrap"}}>изначально {refQty} {unit}</span>
                      </div>
                      <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap"}}>
                        <input type="number" min="0" step={ref.is_weight_item?"0.1":"0.5"} value={deliveredQty[key]} onFocus={e=>e.target.select()}
                          onChange={e=>setDeliveredQty(a=>({...a,[key]:e.target.value}))}
                          style={{...S.input,width:88,padding:"7px 8px",fontSize:15,fontWeight:700,textAlign:"right"}}/>
                        <span style={{fontSize:14,color:C.textFaint}}>{unit}</span>
                        <button type="button" onClick={()=>setDeliveredQty(a=>({...a,[key]:String(refQty)}))} style={{...S.btnOutline,padding:"6px 10px",fontSize:13,width:"auto"}}>Весь</button>
                        <button type="button" onClick={()=>setDeliveredQty(a=>({...a,[key]:String(Math.round(refQty/2*100)/100)}))} style={{...S.btnOutline,padding:"6px 10px",fontSize:13,width:"auto"}}>Половину</button>
                        <button type="button" onClick={()=>setDeliveredQty(a=>({...a,[key]:"0"}))} style={{...S.btnOutline,padding:"6px 10px",fontSize:13,width:"auto",borderColor:C.red,color:C.red}}>Ничего</button>
                      </div>
                    </div>
                  );
                })}
                <input style={{...S.input,marginBottom:10}} placeholder="Причина правки (необязательно)" value={editReason} onChange={e=>setEditReason(e.target.value)}/>
                <div style={{display:"flex",gap:8}}>
                  <button disabled={savingDeliveredItems} style={{...S.btnPrimary,flex:1,marginTop:0,opacity:savingDeliveredItems?0.5:1}} onClick={saveDeliveredItems}>{savingDeliveredItems?"Сохранение...":"Сохранить"}</button>
                  <button disabled={savingDeliveredItems} style={{...S.btnSecondary,flex:1}} onClick={()=>setEditingDelivered(false)}>Отмена</button>
                </div>
              </div>
            )}
          </div>
        )}
        {currentUser.role==="admin" && Array.isArray(order.items_edits) && order.items_edits.length>0 && (
          <div style={{marginTop:14}}>
            <p style={{margin:0,fontSize:14,fontWeight:600,color:C.navy,cursor:"pointer",textDecoration:"underline"}} onClick={()=>setEditHistoryOpen(o=>!o)}>{editHistoryOpen?"▲ Скрыть историю правок":`▼ История правок (${order.items_edits.length})`}</p>
            {editHistoryOpen && order.items_edits.slice().reverse().map((e,i)=>(
              <div key={i} style={{marginTop:8,padding:"8px 10px",borderRadius:8,background:C.surface,border:`1px solid ${C.border}`,fontSize:13,color:C.textSub}}>
                <div style={{fontWeight:600,color:C.text}}>{e.kind==="price"?"💰 ":""}{e.by_name} · {fmtDT(e.at)}</div>
                <div>Сумма: {(e.before_total||0).toLocaleString()} ₸ → {(e.after_total||0).toLocaleString()} ₸</div>
                {e.reason&&<div>Причина: {e.reason}</div>}
              </div>
            ))}
          </div>
        )}
        {currentUser.role==="admin" && onDeleteOrder && order.status!=="delivered" && (
          <div style={{marginTop:20,paddingTop:16,borderTop:`1px dashed ${C.border}`}}>
            <button style={{...S.btnDanger,width:"100%",opacity:0.85}} onClick={()=>{
              if (window.confirm(`Удалить заявку №${order.id} без возможности восстановления?`)) onDeleteOrder(order.id);
            }}>🗑 Удалить заявку навсегда</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SalesCabinet({ user, token, onLogout }) {
  const [tab, setTab] = useState("orders");
  useEffect(() => {
    const handlePopState = () => setTab("orders");
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [clientId, setClientId] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [comment, setComment] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [editOrder, setEditOrder] = useState(null);
  const [editLines, setEditLines] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const newLine = () => ({uid:Math.random(),productId:null,name:"",qty:"",price:"",search:"",showDrop:false,pricedByWeight:false,weightPerBox:""});
  const [lines, setLines] = useState([newLine()]);

  const [clients, setClients] = useState([]);
  const [clientSearchText, setClientSearchText] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  useEffect(() => {
    apiCall('GET','/api/clients').then(setClients).catch(()=>{});
  }, []);

  const [debts, setDebts] = useState([]);
  const loadDebts = useCallback(() => {
    apiCall('GET','/api/debts').then(setDebts).catch(()=>{});
  }, []);
  useEffect(() => { loadDebts(); }, []);
  useRefetchOnVisible(loadDebts);
  const selectedClientDebt = clientId ? debts.filter(d=>d.client_name===clients.find(c=>c.code===clientId)?.name && d.overdue).reduce((s,d)=>s+d.remaining,0) : 0;

  const [products, setProducts] = useState([]);
  const loadProducts = useCallback(() => {
    fetch('/api/products')
  .then(r => r.json())
  .then(data => setProducts(data.filter(p => p.has_alias).map((p, i) => ({
    id: i + 1,
    name: p.display_name || p.name,
    price: p.price || 0,
    priceOptions: [p.price1, p.price2, p.price3].filter(v => v !== null && v !== undefined),
    commission: p.commission || 0,
    unit: p.unit || 'кг',
    group: p.group || '',
    code: p.code,
    stock: p.stock,
    photo: p.photo || null,
    barcode: p.barcode || '',
    // Весовой товар (короб/тара, а цена — за кг): факт. вес узнаётся точно
    // только на складе при отгрузке (см. POST /api/orders/weights), но
    // торговый обычно примерно знает вес короба — даём сразу прикинуть
    // сумму заявки по кол-ву коробов × примерный вес, а не только по
    // кол-ву коробов (что для цены "за кг" не имеет смысла).
    pricedByWeight: !!p.priced_by_weight,
    // Средний вес короба — сначала то, что менеджер задал вручную на
    // "Товарах" (avg_box_weight, надёжное число), и только если его нет —
    // старая грубая прикидка "кг-остаток / короба-остаток" (ненадёжна,
    // т.к. короба-остаток сам протухший, см. stockAmount выше).
    avgWeightPerBox: p.avg_box_weight != null ? p.avg_box_weight
      : ((p.stock_weight_kg != null && p.stock > 0) ? (p.stock_weight_kg / p.stock) : null),
    // Snake_case-дубли — их читают общие хелперы stockAmount/stockLabel/
    // stockIsOut (см. выше), которые проверяют именно priced_by_weight/
    // stock_weight_kg, как отдаёт /api/products. Без этого хелперы решали
    // бы, что товар не весовой, и молча возвращались бы к протухшим коробам.
    priced_by_weight: !!p.priced_by_weight,
    stock_weight_kg: p.stock_weight_kg != null ? p.stock_weight_kg : null,
    avg_box_weight: p.avg_box_weight != null ? p.avg_box_weight : null
  }))))
  .catch(() => {});
  }, []);
  useEffect(() => { loadProducts(); }, []);
  useRefetchOnVisible(loadProducts);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch(e) { if(e.message.includes('токен')) onLogout(); }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, []);
  useRefetchOnVisible(loadOrders);

  const updateLine = (uid,patch) => setLines(ls=>ls.map(l=>l.uid===uid?{...l,...patch}:l));
  const removeLine = (uid) => setLines(ls=>ls.length>1?ls.filter(l=>l.uid!==uid):ls);
  const addLine = () => setLines(ls=>[...ls,newLine()]);
  const selectProduct = (uid,prod) => {
    if (stockIsOut(prod)) return;
    updateLine(uid,{
      productId:prod.id,code:prod.code,name:prod.name,unit:prod.unit,
      price:prod.priceOptions&&prod.priceOptions.length===1?prod.priceOptions[0]:"",
      search:prod.name,showDrop:false,qty:"",priceOptions:prod.priceOptions||[],commission:prod.commission||0,stock:prod.stock,
      stockWeightKg:prod.stock_weight_kg,
      avgBoxWeight:prod.avg_box_weight,
      pricedByWeight:!!prod.pricedByWeight,
      weightPerBox: prod.avgWeightPerBox!=null ? String(Math.round(prod.avgWeightPerBox*100)/100) : ""
    });
  };

  // Для весового товара (короб/тара, цена за кг) реальный вес заявки — это
  // кол-во коробов × примерный вес короба, который торговый вписывает сам
  // (см. selectProduct — предзаполняется средним по остатку, если известен).
  // Это только оценка для суммы заявки на этом этапе: факт. вес всё равно
  // потом подтверждает склад при отгрузке (POST /api/orders/weights) и
  // сумма заявки пересчитывается по нему.
  const estWeightOf = (l) => l.pricedByWeight ? (Number(l.qty)||0)*(Number(l.weightPerBox)||0) : (Number(l.qty)||0);
  // productId (и code) появляются только через selectProduct — свободный
  // текст без выбора из списка исторически проходил как позиция без кода,
  // и такая заявка потом никогда не находится на "Товарах" (искать нечего —
  // товар ни к чему не привязан) и не может получить закупочную цену.
  // Поэтому такие строки не считаем заполненными.
  const filledLines = lines.filter(l=>l.name&&l.productId&&Number(l.qty)>0&&Number(l.price)>0&&(!l.pricedByWeight||Number(l.weightPerBox)>0));
  const total = filledLines.reduce((s,l)=>s+estWeightOf(l)*Number(l.price),0);
  // Оценка веса весового товара может превысить кг-остаток склада (см.
  // проверку на сервере в POST /api/orders) — не даём отправить такую заявку
  // и здесь, чтобы не ждать ответа сервера ради того, что уже видно на экране.
  const hasOverStock = filledLines.some(l=>l.pricedByWeight&&l.stockWeightKg!=null&&estWeightOf(l)>l.stockWeightKg);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!clientId||filledLines.length===0||!timeSlot||!contactPhone.trim()||hasOverStock) return;
    const client = clients.find(c=>c.code===clientId);
    const items = filledLines.map(l=>l.pricedByWeight
      ? {id:l.productId,code:l.code,name:l.name,qty:estWeightOf(l),boxes:Number(l.qty),price:Number(l.price),commission:l.commission||0}
      : {id:l.productId,code:l.code,name:l.name,qty:Number(l.qty),price:Number(l.price),commission:l.commission||0}
    );
    setSubmitting(true);
    try {
      await apiCall('POST','/api/orders',{clientName:client.name,clientCode:client.code,address:client.address||'',timeSlot,items,total,paymentCash:0,paymentQr:0,paymentDebt:0,comment,contactName,contactPhone});
      setLines([newLine()]); setClientId(""); setClientSearchText(""); setTimeSlot(""); setComment(""); setContactName(""); setContactPhone("");
      setSubmitted(true); setTab("orders"); loadOrders();
      apiCall('GET','/api/clients').then(setClients).catch(()=>{});
      setTimeout(()=>setSubmitted(false),4000);
    } catch(e) { alert(e.message); }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id, status, payment) => {
    try {
      await apiCall('PUT',`/api/orders/${id}/status`,{status});
      setSelectedOrder(null); loadOrders();
    } catch(e) { alert(e.message); }
  };

  // Правка состава заявки, пока она "Ожидает" (см. PUT /api/orders/:id/items
  // на сервере) — раньше единственным вариантом было отозвать заявку и
  // создать новую (см. openEditOrder ниже и модалку в JSX). Строки
  // заполняются из уже сохранённых позиций заявки, а не с нуля.
  const openEditOrder = (order) => {
    const its = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : (order.items || []);
    setEditLines(its.map(it => {
      const prod = products.find(p=>p.code===it.code);
      const isW = !!it.is_weight_item;
      const ownQty = Number(it.qty) || 0;
      const ownBoxes = Number(it.boxes) || 0;
      const baseStock = prod ? prod.stock : null;
      const baseStockKg = prod ? prod.stock_weight_kg : null;
      return {
        uid: Math.random(),
        productId: prod ? prod.id : (it.code || true),
        code: it.code,
        name: it.name,
        unit: prod ? prod.unit : it.unit,
        search: it.name,
        showDrop: false,
        pricedByWeight: isW,
        qty: isW ? String(ownBoxes || ownQty) : String(ownQty),
        weightPerBox: isW && ownBoxes > 0 ? String(Math.round((ownQty / ownBoxes) * 100) / 100) : "",
        price: String(it.price != null ? it.price : ""),
        commission: it.commission || 0,
        priceOptions: prod ? prod.priceOptions : [],
        // Возвращаем в отображаемый остаток то, что эта же заявка уже сама
        // резервирует по этой позиции (см. /api/products: stock/stock_weight_kg
        // там уже "доступно" за минусом всех new/in_transit заявок, включая
        // эту) — иначе при правке нельзя было бы даже сохранить исходное кол-во.
        stock: baseStock != null ? baseStock + (isW ? ownBoxes : ownQty) : null,
        stockWeightKg: baseStockKg != null ? baseStockKg + (isW && it.weight_confirmed ? ownQty : 0) : null,
        avgBoxWeight: prod ? prod.avg_box_weight : null,
      };
    }));
    setEditOrder(order);
  };
  const updateEditLine = (uid,patch) => setEditLines(ls=>ls.map(l=>l.uid===uid?{...l,...patch}:l));
  const removeEditLine = (uid) => setEditLines(ls=>ls.length>1?ls.filter(l=>l.uid!==uid):ls);
  const addEditLine = () => setEditLines(ls=>[...ls,newLine()]);
  const selectEditProduct = (uid,prod) => {
    if (stockIsOut(prod)) return;
    updateEditLine(uid,{
      productId:prod.id,code:prod.code,name:prod.name,unit:prod.unit,
      price:prod.priceOptions&&prod.priceOptions.length===1?prod.priceOptions[0]:"",
      search:prod.name,showDrop:false,qty:"",priceOptions:prod.priceOptions||[],commission:prod.commission||0,stock:prod.stock,
      stockWeightKg:prod.stock_weight_kg,
      avgBoxWeight:prod.avg_box_weight,
      pricedByWeight:!!prod.pricedByWeight,
      weightPerBox: prod.avgWeightPerBox!=null ? String(Math.round(prod.avgWeightPerBox*100)/100) : ""
    });
  };
  const filledEditLines = editLines.filter(l=>l.name&&l.productId&&Number(l.qty)>0&&Number(l.price)>0&&(!l.pricedByWeight||Number(l.weightPerBox)>0));
  const editTotal = filledEditLines.reduce((s,l)=>s+estWeightOf(l)*Number(l.price),0);
  const hasEditOverStock = filledEditLines.some(l=>l.pricedByWeight&&l.stockWeightKg!=null&&estWeightOf(l)>l.stockWeightKg);
  const closeEditOrder = () => { setEditOrder(null); setEditLines([]); };
  const handleSaveEdit = async () => {
    if (editSaving || !editOrder) return;
    if (filledEditLines.length===0 || hasEditOverStock) return;
    const items = filledEditLines.map(l=>l.pricedByWeight
      ? {id:l.productId,code:l.code,name:l.name,qty:estWeightOf(l),boxes:Number(l.qty),price:Number(l.price),commission:l.commission||0}
      : {id:l.productId,code:l.code,name:l.name,qty:Number(l.qty),price:Number(l.price),commission:l.commission||0}
    );
    setEditSaving(true);
    try {
      await apiCall('PUT',`/api/orders/${editOrder.id}/items`,{items});
      closeEditOrder(); loadOrders();
    } catch(e) { alert(e.message); }
    setEditSaving(false);
  };

  const todayStr = new Date().toISOString().slice(0,10);
  const [salesDateFrom, setSalesDateFrom] = useState(todayStr);
  const [salesDateTo, setSalesDateTo] = useState(todayStr);
  const [salesPreset, setSalesPreset] = useState("day");

  const applySalesPreset = (preset) => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);
    else if (preset === "month") from.setDate(now.getDate() - 29);
    setSalesPreset(preset);
    if (preset !== "custom") {
      setSalesDateFrom(from.toISOString().slice(0,10));
      setSalesDateTo(todayStr);
    }
  };
  const [salesRepFilter, setSalesRepFilter] = useState("");
  const salesReps = useMemo(() => {
    if (user.role!=="senior_sales") return [];
    const map = {};
    orders.forEach(o=>{ if(o.sales_id!=null) map[o.sales_id] = o.sales_name || map[o.sales_id]; });
    return Object.entries(map).map(([id,name])=>({id,name})).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
  }, [orders, user.role]);
  const scopedOrders = (user.role==="senior_sales" && salesRepFilter) ? orders.filter(o=>String(o.sales_id)===salesRepFilter) : orders;
  const visibleOrders = scopedOrders.filter(o=>o.status==="new"||o.status==="in_transit"||(["cancelled","returned"].includes(o.status)&&o.date===todayStr));
  const stats = {total:visibleOrders.length,delivered:visibleOrders.filter(o=>o.status==="delivered").length,inTransit:visibleOrders.filter(o=>o.status==="in_transit").length,new:visibleOrders.filter(o=>o.status==="new").length};
  const periodDeliveredOrders = scopedOrders.filter(o=>o.status==="delivered"&&o.date>=salesDateFrom&&o.date<=salesDateTo);
  const todaySales = periodDeliveredOrders.reduce((s,o)=>s+(o.total||0),0);
  const [showSalesList, setShowSalesList] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});
  const clientBreakdown = {};
  periodDeliveredOrders.forEach(o=>{
    const key = o.client_name;
    if(!clientBreakdown[key]) clientBreakdown[key] = { name:o.client_name, revenue:0, items:[] };
    clientBreakdown[key].revenue += (o.total||0);
    const its = typeof o.items==='string'?JSON.parse(o.items||'[]'):(o.items||[]);
    its.forEach(it=>clientBreakdown[key].items.push({name:it.name,qty:it.qty,price:it.price}));
  });
  const clientList = Object.values(clientBreakdown).sort((a,b)=>b.revenue-a.revenue);

  // Долги "своих" клиентов — для обычного торгового (не старшего): бэкенд
  // уже отдаёт ему только его заявки (см. GET /api/orders), поэтому долг
  // считается "свой", если он привязан к заявке из этого списка. Кассовые
  // долги (sale_id) сюда не попадают — их пробивает кассир, не торговый.
  const [showMyDebts, setShowMyDebts] = useState(false);
  const myOrderIds = useMemo(() => new Set(orders.map(o=>o.id)), [orders]);
  const myDebts = user.role==="sales" ? debts.filter(d=>d.order_id && myOrderIds.has(d.order_id)) : [];
  const myDebtsTotal = myDebts.reduce((s,d)=>s+d.remaining,0);

  return (
    <div style={{paddingBottom:72}}>
      {selectedOrder&&<OrderDetail order={selectedOrder} onClose={()=>setSelectedOrder(null)} onUpdateStatus={handleUpdateStatus} currentUser={user} products={products}/>}
      {editOrder&&(
        <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}}>
          <div style={{background:"#fff",margin:"16px",borderRadius:16,padding:20,maxWidth:480,marginLeft:"auto",marginRight:"auto"}}>
            <div style={{...S.row,marginBottom:16}}>
              <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>Редактирование № {editOrder.id}</p>
              <button style={S.btnSecondary} onClick={closeEditOrder}>✕</button>
            </div>
            <p style={{fontSize:14,color:C.textSub,marginBottom:12}}>Можно уменьшить/убрать позицию или добавить новую — доступно, пока заявка «Ожидает»</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 64px 80px 28px",gap:6,marginBottom:6}}>
              {["Наименование","Кол-во","Цена ₸",""].map((h,i)=><div key={i} style={{fontSize:12,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>{h}</div>)}
            </div>
            {editLines.map(line=>{
              const inStock=products.filter(p=>!stockIsOut(p));
              const matched=line.search.length>0?inStock.filter(p=>p.name.toLowerCase().includes(line.search.toLowerCase())):inStock.slice(0,50);
              const lineWeight=estWeightOf(line);
              const lineTotal=lineWeight>0&&Number(line.price)>0?lineWeight*Number(line.price):null;
              return(
                <div key={line.uid} style={{marginBottom:8}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 64px 80px 28px",gap:6,alignItems:"center"}}>
                    <div style={{position:"relative"}}>
                      <input style={{...S.input,padding:"8px 10px",fontSize:15,...(line.name&&!line.productId?{borderColor:C.red}:{})}} placeholder="Введите товар..." value={line.search}
                        onChange={e=>updateEditLine(line.uid,{search:e.target.value,name:e.target.value,productId:null,price:"",showDrop:true})}
                        onFocus={()=>updateEditLine(line.uid,{showDrop:true})}
                        onBlur={()=>setTimeout(()=>updateEditLine(line.uid,{showDrop:false}),180)}
                      />
                      {line.name&&!line.productId&&!line.showDrop&&<p style={{margin:"4px 0 0",fontSize:12,color:C.red}}>Выберите товар из списка — вписать вручную нельзя</p>}
                      {line.showDrop&&matched.length>0&&(
                        <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:180,overflowY:"auto"}}>
                          {matched.map(p=>{
                            const outOfStock = stockIsOut(p);
                            const stockLbl = stockLabel(p);
                            return (
                            <div key={p.id} onMouseDown={()=>selectEditProduct(line.uid,p)} style={{padding:"9px 12px",cursor:outOfStock?"not-allowed":"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15,opacity:outOfStock?0.5:1,background:outOfStock?C.surface:C.white}}>
                              <div style={{fontWeight:600}}>{p.name}</div>
                              <div style={{fontSize:13,color:outOfStock?C.red:C.textFaint}}>{p.price>0?p.price.toLocaleString()+' ₸ / ':''}{p.unit}{p.group?' · '+p.group:''}{stockLbl!=null?(outOfStock?' · Нет в наличии':' · Остаток: '+stockLbl):''}</div>
                            </div>
                          )})}
                        </div>
                      )}
                    </div>
                    <input style={{...S.input,padding:"8px 6px",fontSize:15,textAlign:"center"}} placeholder={line.pricedByWeight?"кор":"кол"} value={line.qty} type="number" min="1" max={(!line.pricedByWeight&&line.stock!=null)?line.stock:undefined}
                      onChange={e=>{
                        let v = e.target.value;
                        if (!line.pricedByWeight && line.stock!=null && Number(v) > line.stock) v = String(line.stock);
                        updateEditLine(line.uid,{qty:v});
                      }}
                      onFocus={e=>e.target.select()}
                    />
                    <input style={{...S.input,padding:"8px 6px",fontSize:15,textAlign:"right",background:(line.priceOptions&&line.priceOptions.length>0)?C.surface:C.white,color:(line.priceOptions&&line.priceOptions.length>0)?C.textSub:C.text}} placeholder="цена" value={line.price} type="number"
                      disabled={line.priceOptions&&line.priceOptions.length>0}
                      onChange={e=>updateEditLine(line.uid,{price:e.target.value})}
                      onFocus={e=>e.target.select()}
                    />
                    <button onClick={()=>removeEditLine(line.uid)} style={{width:28,height:34,border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,cursor:"pointer",fontSize:16,color:C.textFaint}}>×</button>
                  </div>
                  {line.pricedByWeight
                    ? (line.stockWeightKg!=null&&<div style={{fontSize:13,color:C.textFaint,marginTop:2}}>На складе: {formatWeightStock(line.stockWeightKg,line.avgBoxWeight)}</div>)
                    : (line.stock!=null&&<div style={{fontSize:13,color:C.textFaint,marginTop:2}}>На складе: {line.stock} {line.unit}</div>)}
                  {line.pricedByWeight&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                      <span style={{fontSize:13,color:C.textSub,whiteSpace:"nowrap"}}>⚖️ Вес короба, кг (примерно)</span>
                      <input style={{...S.input,width:80,padding:"6px 8px",fontSize:14,textAlign:"center"}} placeholder="кг" value={line.weightPerBox} type="number"
                        onChange={e=>updateEditLine(line.uid,{weightPerBox:e.target.value})}
                        onFocus={e=>e.target.select()}
                      />
                      {lineWeight>0&&<span style={{fontSize:13,color:(line.stockWeightKg!=null&&lineWeight>line.stockWeightKg)?C.red:C.textFaint}}>≈ {lineWeight.toLocaleString()} кг</span>}
                    </div>
                  )}
                  {line.pricedByWeight&&line.stockWeightKg!=null&&lineWeight>line.stockWeightKg&&(
                    <p style={{margin:"2px 0 0",fontSize:12,color:C.red}}>Недостаточно остатка: доступно {line.stockWeightKg.toLocaleString()} кг</p>
                  )}
                  {lineTotal&&<div style={{textAlign:"right",fontSize:13,color:C.textSub,marginTop:2,paddingRight:34}}>= <strong style={{color:C.navy}}>{lineTotal.toLocaleString()} ₸</strong></div>}
                  {line.priceOptions&&line.priceOptions.length>0&&(
                    <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                      {line.priceOptions.map((pr,i)=>(
                        <button key={i} onClick={()=>updateEditLine(line.uid,{price:pr})} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${Number(line.price)===pr?C.navy:C.border}`,background:Number(line.price)===pr?C.navy:C.white,color:Number(line.price)===pr?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{pr.toLocaleString()} ₸</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={addEditLine} style={{background:C.navy,color:C.white,border:"none",borderRadius:8,padding:"6px 14px",fontSize:14,fontWeight:600,cursor:"pointer",marginTop:4}}>+ Товар</button>
            {filledEditLines.length>0&&<><hr style={{...S.divider,marginTop:12}}/><div style={S.row}><span style={{fontSize:15,color:C.textSub}}>Итого</span><span style={{fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>{editTotal.toLocaleString()} ₸</span></div></>}
            <button style={{...S.btnPrimary,opacity:(editSaving||filledEditLines.length===0||hasEditOverStock)?0.45:1}} disabled={editSaving||filledEditLines.length===0||hasEditOverStock} onClick={handleSaveEdit}>{editSaving?"Сохранение...":"💾 Сохранить"}</button>
            <button style={{...S.btnDanger,marginTop:8}} onClick={async()=>{
              if(!window.confirm('Отозвать заявку № '+editOrder.id+'? Действие нельзя отменить.')) return;
              try {
                await apiCall('PUT',`/api/orders/${editOrder.id}/status`,{status:"revoked"});
                closeEditOrder(); loadOrders();
              } catch(e){alert(e.message);}
            }}>🗑 Отозвать заявку целиком</button>
          </div>
        </div>
      )}
      <div style={S.page}>
        {tab==="orders"&&<>
          <button style={S.bigCreate} onClick={()=>{window.history.pushState({view:'new'},'','');setTab("new");}}><span style={S.bigCreatePlus}>+</span> Создать заявку</button>
          {submitted&&<div style={S.alertSuccess}>Заявка успешно создана!</div>}
          {loading?<div style={S.loadingWrap}>Загрузка...</div>:<>
            {salesReps.length>1&&(
              <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
                <button onClick={()=>setSalesRepFilter("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${salesRepFilter===""?C.navy:C.border}`,background:salesRepFilter===""?C.navy:C.white,color:salesRepFilter===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все торговые</button>
                {salesReps.map(r=>(
                  <button key={r.id} onClick={()=>setSalesRepFilter(String(r.id))} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${salesRepFilter===String(r.id)?C.navy:C.border}`,background:salesRepFilter===String(r.id)?C.navy:C.white,color:salesRepFilter===String(r.id)?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{r.name}</button>
                ))}
              </div>
            )}
            <div style={S.statsRow}>
              <div style={S.statCard()}><p style={S.statNum()}>{stats.total}</p><p style={S.statLabel}>Всего заявок</p></div>
              <div style={S.statCard()}><p style={S.statNum(C.green)}>{stats.delivered}</p><p style={S.statLabel}>Доставлено</p></div>
              <div style={S.statCard()}><p style={S.statNum(C.amber)}>{stats.inTransit}</p><p style={S.statLabel}>В работе</p></div>
              <div style={S.statCard()}><p style={S.statNum(C.pending)}>{stats.new}</p><p style={S.statLabel}>Новых</p></div>
            </div>
            <div style={S.revenueCard}>
              <p style={S.revenueLabel}>Продажи за период</p>
              <p style={S.revenueNum}>{todaySales.toLocaleString()} ₸</p>
            </div>
            <div style={{marginTop:12,marginBottom:4}}>
              <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                {[["day","День"],["week","Неделя"],["month","Месяц"],["custom","Свободный отбор"]].map(([k,lb])=>(
                  <button key={k} onClick={()=>applySalesPreset(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${salesPreset===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:salesPreset===k?C.navy:C.white,color:salesPreset===k?C.white:C.textMid}}>{lb}</button>
                ))}
              </div>
              {salesPreset==="custom"&&(
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <div style={{flex:1,minWidth:120}}>
                    <label style={{...S.label,marginBottom:4}}>С</label>
                    <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={salesDateFrom} onChange={e=>setSalesDateFrom(e.target.value)}/>
                  </div>
                  <div style={{flex:1,minWidth:120}}>
                    <label style={{...S.label,marginBottom:4}}>По</label>
                    <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={salesDateTo} onChange={e=>setSalesDateTo(e.target.value)}/>
                  </div>
                </div>
              )}
            </div>
            <div style={{...S.row,cursor:"pointer",marginTop:12,marginBottom:showSalesList?8:0}} onClick={()=>setShowSalesList(s=>!s)}>
              <p style={{...S.sectionTitle,fontSize:17,margin:0}}>Продано за период</p>
              <p style={{margin:0,fontSize:14,color:C.textFaint}}>{showSalesList?"▲ Свернуть":"▼ Показать"}</p>
            </div>
            {showSalesList&&clientList.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>Нет доставленных заявок за этот период</div>}
            {showSalesList&&clientList.length>0&&<>
              {clientList.map((c,i)=>(
                <div key={i} style={S.card}>
                  <div style={{...S.row,cursor:"pointer"}} onClick={()=>setExpandedClients(e=>({...e,[i]:!e[i]}))}>
                    <div>
                      <p style={S.cardTitle}>{c.name}</p>
                      <p style={S.cardSub}>{c.items.length} поз.</p>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <p style={{margin:0,fontWeight:800,fontFamily:FH,color:C.navy}}>{c.revenue.toLocaleString()} ₸</p>
                      <p style={{margin:0,fontSize:13,color:C.textFaint}}>{expandedClients[i]?"▲ Свернуть":"▼ Подробнее"}</p>
                    </div>
                  </div>
                  {expandedClients[i]&&(
                    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                      {c.items.map((it,j)=>(
                        <div key={j} style={{...S.row,marginBottom:6,fontSize:14}}>
                          <span style={{color:C.textMid}}>{it.name} <span style={{color:C.textFaint}}>×{it.qty}</span></span>
                          <span style={{color:C.textSub}}>{it.price} ₸</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>}
            {user.role==="sales"&&<>
              <div style={{...S.row,cursor:"pointer",marginTop:20,marginBottom:showMyDebts?8:0}} onClick={()=>setShowMyDebts(s=>!s)}>
                <p style={{...S.sectionTitle,fontSize:17,margin:0}}>Мои должники{myDebtsTotal>0?` · ${myDebtsTotal.toLocaleString()} ₸`:''}</p>
                <p style={{margin:0,fontSize:14,color:C.textFaint}}>{showMyDebts?"▲ Свернуть":"▼ Показать"}</p>
              </div>
              {showMyDebts&&myDebts.length===0&&<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>Долгов нет</div>}
              {showMyDebts&&myDebts.map(d=>(
                <div key={d.order_id} style={{...S.card, borderLeft: d.overdue?`4px solid ${C.red}`:"4px solid #F59E0B", background: d.overdue?"#FEF2F2":C.white}}>
                  <div style={S.row}>
                    <div>
                      <p style={S.cardTitle}>{d.client_name} {d.overdue&&<span style={{color:C.red,fontSize:13,fontWeight:700}}>· ПРОСРОЧЕН</span>}</p>
                      <p style={{...S.cardSub,color:d.overdue?"#B91C1C":C.textSub}}>№ {d.order_id} · {d.date} · {d.days_ago===0?'сегодня':`${d.days_ago} ${daysWord(d.days_ago)}`}{d.settled>0?` · погашено ${d.settled.toLocaleString()} ₸`:''}</p>
                    </div>
                    <p style={{margin:0,fontWeight:800,fontFamily:FH,color:d.overdue?C.red:"#92400E"}}>{d.remaining.toLocaleString()} ₸</p>
                  </div>
                </div>
              ))}
            </>}
            <p style={{...S.sectionTitle,fontSize:17,marginTop:20}}>{user.role==="senior_sales"?(salesRepFilter?`Заявки: ${salesReps.find(r=>r.id===salesRepFilter)?.name||''}`:"Заявки всех торговых"):"Мои заявки"}</p>
            {visibleOrders.length===0?<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>Заявок пока нет</p></div>
              :visibleOrders.map(o=><OrderCard key={o.id} order={o} onOpen={setSelectedOrder} onEdit={o.status==="new"&&(user.role!=="senior_sales"||o.sales_id===user.id)?openEditOrder:null}/>)}
          </>}
        </>}
        {tab==="new"&&<>
          <div style={{...S.row,marginBottom:14}}>
            <p style={{...S.sectionTitle,margin:0}}>Новая заявка</p>
            <button style={S.btnSecondary} onClick={()=>setTab("orders")}>← Назад</button>
          </div>
          <div style={S.card}>
            <div style={S.formGroup}>
              <label style={S.label}>Контрагент {clients.length>0&&<span style={{color:C.green,fontWeight:400,fontSize:13}}>({clients.length} из 1С)</span>}</label>
              <div style={{position:"relative"}}>
                <input
                  style={{...S.input,paddingRight:clientSearchText?38:14}}
                  placeholder="Начните вводить название..."
                  value={clientSearchText}
                  onChange={e=>{setClientSearchText(e.target.value); setClientId(""); setShowClientDrop(true);}}
                  onFocus={()=>setShowClientDrop(true)}
                  onBlur={()=>setTimeout(()=>setShowClientDrop(false),180)}
                />
                {clientSearchText&&(
                  <button
                    type="button"
                    onMouseDown={e=>e.preventDefault()}
                    onClick={()=>{setClientSearchText("");setClientId("");setContactName("");setContactPhone("");}}
                    style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.textFaint,padding:4,lineHeight:1}}
                  >×</button>
                )}
                {showClientDrop&&(()=>{
                  const matched=clientSearchText.length>0?clients.filter(c=>c.name.toLowerCase().includes(clientSearchText.toLowerCase())):clients;
                  return matched.length>0&&(
                    <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:220,overflowY:"auto"}}>
                      {matched.map(c=>(
                        <div key={c.code} onMouseDown={()=>{setClientId(c.code);setClientSearchText(c.name);setShowClientDrop(false);setContactName(c.contact_name||'');setContactPhone(c.contact_phone||'');}} style={{padding:"9px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15}}>
                          <div style={{fontWeight:600}}>{c.name}</div>
                          {c.address&&<div style={{fontSize:13,color:C.textFaint}}>📍 {c.address}</div>}
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
              {clientId&&clients.find(c=>c.code===clientId)?.address&&<p style={{margin:"6px 0 0",fontSize:14,color:C.textSub}}>📍 {clients.find(c=>c.code===clientId)?.address}</p>}
              {selectedClientDebt>0&&<div style={{marginTop:8,padding:"10px 12px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,fontSize:14,color:C.red,fontWeight:600}}>⚠️ У контрагента непогашенный долг более 7 дней: {selectedClientDebt.toLocaleString()} ₸</div>}
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Телефон контактного лица</label>
              <div style={{display:"flex",gap:6}}>
                <div style={{position:"relative",flex:1}}>
                  <input style={{...S.input,paddingRight:contactPhone?38:14}} placeholder="Телефон" value={contactPhone} onChange={e=>setContactPhone(e.target.value)}/>
                  {contactPhone&&(
                    <button type="button" onClick={()=>setContactPhone("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.textFaint,padding:4,lineHeight:1}}>×</button>
                  )}
                </div>
                {CONTACT_PICKER_SUPPORTED&&(
                  <button type="button" title="Выбрать из контактов" onClick={()=>pickPhoneContact(({name,tel})=>{if(name)setContactName(name);if(tel)setContactPhone(tel);})} style={{flexShrink:0,width:48,border:`1.5px solid ${C.border}`,borderRadius:10,background:C.white,fontSize:19,cursor:"pointer"}}>📇</button>
                )}
              </div>
            </div>
            <div style={S.formGroup}>
              <label style={S.label}>Время доставки</label>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {[...TIME_SLOTS,PICKUP_SLOT].map(slot=>(
                  <button key={slot} onClick={()=>setTimeSlot(slot)} style={{padding:"12px",borderRadius:10,border:`1.5px solid ${timeSlot===slot?C.navy:C.border}`,background:timeSlot===slot?C.navy:C.white,color:timeSlot===slot?C.white:C.textMid,fontSize:16,fontWeight:500,cursor:"pointer",textAlign:"left"}}>{slot}</button>
                ))}
              </div>
            </div>
          </div>
          <div style={S.card}>
            <div style={{...S.row,marginBottom:12}}>
              <label style={S.label}>
                Номенклатура {products.length>0&&<span style={{color:C.green,fontWeight:400,fontSize:13}}>({products.length} поз. из 1С)</span>}
              </label>
              <button onClick={addLine} style={{background:C.navy,color:C.white,border:"none",borderRadius:8,padding:"4px 12px",fontSize:14,fontWeight:600,cursor:"pointer"}}>+ Товар</button>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 64px 80px 28px",gap:6,marginBottom:6}}>
              {["Наименование","Кол-во","Цена ₸",""].map((h,i)=><div key={i} style={{fontSize:12,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>{h}</div>)}
            </div>
            {lines.map(line=>{
              const inStock=products.filter(p=>!stockIsOut(p));
              const matched=line.search.length>0?inStock.filter(p=>p.name.toLowerCase().includes(line.search.toLowerCase())):inStock.slice(0,50);
              const lineWeight=estWeightOf(line);
              const lineTotal=lineWeight>0&&Number(line.price)>0?lineWeight*Number(line.price):null;
              return(
                <div key={line.uid} style={{marginBottom:8}}>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 64px 80px 28px",gap:6,alignItems:"center"}}>
                    <div style={{position:"relative"}}>
                      <input style={{...S.input,padding:"8px 10px",fontSize:15,...(line.name&&!line.productId?{borderColor:C.red}:{})}} placeholder="Введите товар..." value={line.search}
                        onChange={e=>updateLine(line.uid,{search:e.target.value,name:e.target.value,productId:null,price:"",showDrop:true})}
                        onFocus={()=>updateLine(line.uid,{showDrop:true})}
                        onBlur={()=>setTimeout(()=>updateLine(line.uid,{showDrop:false}),180)}
                      />
                      {line.name&&!line.productId&&!line.showDrop&&<p style={{margin:"4px 0 0",fontSize:12,color:C.red}}>Выберите товар из списка — вписать вручную нельзя</p>}
                      {line.showDrop&&matched.length>0&&(
                        <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:180,overflowY:"auto"}}>
                          {matched.map(p=>{
                            const outOfStock = stockIsOut(p);
                            const stockLbl = stockLabel(p);
                            return (
                            <div key={p.id} onMouseDown={()=>selectProduct(line.uid,p)} style={{padding:"9px 12px",cursor:outOfStock?"not-allowed":"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15,opacity:outOfStock?0.5:1,background:outOfStock?C.surface:C.white}}>
                              <div style={{fontWeight:600}}>{p.name}</div>
                              <div style={{fontSize:13,color:outOfStock?C.red:C.textFaint}}>{p.price>0?p.price.toLocaleString()+' ₸ / ':''}{p.unit}{p.group?' · '+p.group:''}{stockLbl!=null?(outOfStock?' · Нет в наличии':' · Остаток: '+stockLbl):''}</div>
                            </div>
                          )})}
                        </div>
                      )}
                    </div>
                    <input style={{...S.input,padding:"8px 6px",fontSize:15,textAlign:"center"}} placeholder={line.pricedByWeight?"кор":"кол"} value={line.qty} type="number" min="1" max={(!line.pricedByWeight&&line.stock!=null)?line.stock:undefined}
                      onChange={e=>{
                        // Короба весового товара — только оценка торгового (1С их
                        // не считает вообще, см. /api/stock/sync), ограничивать
                        // ввод остатком коробов не нужно (сервер тоже не проверяет,
                        // см. POST /api/orders) — точный расход выяснится на весах.
                        let v = e.target.value;
                        if (!line.pricedByWeight && line.stock!=null && Number(v) > line.stock) v = String(line.stock);
                        updateLine(line.uid,{qty:v});
                      }}
                      onFocus={e=>e.target.select()}
                    />
                    <input style={{...S.input,padding:"8px 6px",fontSize:15,textAlign:"right",background:(line.priceOptions&&line.priceOptions.length>0)?C.surface:C.white,color:(line.priceOptions&&line.priceOptions.length>0)?C.textSub:C.text}} placeholder="цена" value={line.price} type="number"
                      disabled={line.priceOptions&&line.priceOptions.length>0}
                      onChange={e=>updateLine(line.uid,{price:e.target.value})}
                      onFocus={e=>e.target.select()}
                    />
                    <button onClick={()=>removeLine(line.uid)} style={{width:28,height:34,border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,cursor:"pointer",fontSize:16,color:C.textFaint}}>×</button>
                  </div>
                  {line.pricedByWeight
                    ? (line.stockWeightKg!=null&&<div style={{fontSize:13,color:C.textFaint,marginTop:2}}>На складе: {formatWeightStock(line.stockWeightKg,line.avgBoxWeight)}</div>)
                    : (line.stock!=null&&<div style={{fontSize:13,color:C.textFaint,marginTop:2}}>На складе: {line.stock} {line.unit}</div>)}
                  {line.pricedByWeight&&(
                    <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                      <span style={{fontSize:13,color:C.textSub,whiteSpace:"nowrap"}}>⚖️ Вес короба, кг (примерно)</span>
                      <input style={{...S.input,width:80,padding:"6px 8px",fontSize:14,textAlign:"center"}} placeholder="кг" value={line.weightPerBox} type="number"
                        onChange={e=>updateLine(line.uid,{weightPerBox:e.target.value})}
                        onFocus={e=>e.target.select()}
                      />
                      {lineWeight>0&&<span style={{fontSize:13,color:(line.stockWeightKg!=null&&lineWeight>line.stockWeightKg)?C.red:C.textFaint}}>≈ {lineWeight.toLocaleString()} кг</span>}
                    </div>
                  )}
                  {line.pricedByWeight&&line.stockWeightKg!=null&&lineWeight>line.stockWeightKg&&(
                    <p style={{margin:"2px 0 0",fontSize:12,color:C.red}}>Недостаточно остатка: доступно {line.stockWeightKg.toLocaleString()} кг</p>
                  )}
                  {lineTotal&&<div style={{textAlign:"right",fontSize:13,color:C.textSub,marginTop:2,paddingRight:34}}>= <strong style={{color:C.navy}}>{lineTotal.toLocaleString()} ₸</strong></div>}
                  {line.priceOptions&&line.priceOptions.length>0&&(
                    <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                      {line.priceOptions.map((pr,i)=>(
                        <button key={i} onClick={()=>updateLine(line.uid,{price:pr})} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${Number(line.price)===pr?C.navy:C.border}`,background:Number(line.price)===pr?C.navy:C.white,color:Number(line.price)===pr?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{pr.toLocaleString()} ₸</button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {filledLines.length>0&&<><hr style={{...S.divider,marginTop:8}}/><div style={S.row}><span style={{fontSize:15,color:C.textSub}}>Итого</span><span style={{fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>{total.toLocaleString()} ₸</span></div></>}
          </div>
          <div style={S.card}>
            <div style={S.formGroup}>
              <label style={S.label}>Комментарий</label>
              <textarea style={S.textarea} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Особые пожелания..."/>
            </div>
            <button style={{...S.btnPrimary,opacity:(submitting||!clientId||filledLines.length===0||!timeSlot||!contactPhone.trim()||hasOverStock)?0.45:1}} onClick={handleSubmit} disabled={submitting||!clientId||filledLines.length===0||!timeSlot||!contactPhone.trim()||hasOverStock}>{submitting?"Отправка...":"Отправить заявку"}</button>
                  </div>
        </>}
        {tab==="cashbox"&&<>
          <p style={S.sectionTitle}>Касса</p>
          <div style={{background:C.debtAmber,borderRadius:10,padding:"12px",marginBottom:16}}>
            <p style={{margin:"0 0 2px",fontSize:13,color:"#92400E",fontWeight:600}}>ВСЕГО В ДОЛГАХ (все торговые)</p>
            <p style={{margin:0,fontSize:20,fontWeight:800,fontFamily:FH,color:"#92400E"}}>{debts.reduce((s,d)=>s+d.remaining,0).toLocaleString()} ₸</p>
          </div>
          <DebtsPanel readOnly/>
        </>}
        {tab==="aliases"&&<ProductAliasesPanel/>}
        {tab==="stock"&&<StockPanel/>}
      </div>
      {user.role==="senior_sales"&&tab!=="new"&&(
        <div style={S.nav}>
          {[["orders","📋","Заявки"],["cashbox","💵","Касса"],["aliases","🏷","Товары"],["stock","📦","Остатки"]].map(([k,ic,lb])=>(
            <button key={k} style={{...S.navBtn(tab===k),flex:1}} onClick={()=>setTab(k)}>
              <span style={S.navIcon}>{ic}</span><span style={S.navLabel(tab===k)}>{lb}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

const STORE_TABS = [["orders","📋","Заказы"],["new","➕","Новый заказ"],["report","📊","Отчёт"],["profile","🏬","Профиль"]];
const STORE_TAB_TITLES = { orders:"Заказы", new:"Новый заказ", report:"Отчёт о закупках", profile:"Профиль магазина" };
const STORE_FILTERS = [["all","Все"],["new","Ожидает"],["in_transit","В работе"],["delivered","Доставлено"],["cancelled","Отказ"],["returned","Возврат"]];

function StoreCabinet({ user, onLogout, desktop }) {
  const [tab, setTab] = useState("orders");
  useEffect(() => {
    const handlePopState = () => setTab("orders");
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [timeSlot, setTimeSlot] = useState("");
  const [comment, setComment] = useState("");
  const [lines, setLines] = useState([]);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("");
  const [catalogSort, setCatalogSort] = useState("name_asc");

  // Профиль магазина (адрес доставки, контактное лицо) — заполняется один
  // раз на вкладке "Профиль" и дальше просто подставляется в каждый новый
  // заказ, а не вводится заново каждый раз. Сам заказ сервер всё равно
  // привяжет к user.client_code независимо от того, что отправит браузер.
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const loadProfile = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/my-client');
      setProfile(data);
    } catch(e) {}
    setProfileLoading(false);
  }, []);
  useEffect(() => { loadProfile(); }, []);

  const address = profile?.address || '';
  const contactName = profile?.contactName || '';
  const contactPhone = profile?.contactPhone || '';
  const profileComplete = !!(address.trim() && contactPhone.trim());

  const [profileForm, setProfileForm] = useState({address:'',contactName:'',contactPhone:''});
  useEffect(() => {
    if (profile) setProfileForm({address:profile.address||'',contactName:profile.contactName||'',contactPhone:profile.contactPhone||''});
  }, [profile]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const saveProfile = async () => {
    if (!profileForm.contactPhone.trim()) return;
    setSavingProfile(true);
    try {
      const saved = await apiCall('PUT','/api/my-client',profileForm);
      setProfile(p=>({...p,...saved}));
      setProfileSaved(true);
      setTimeout(()=>setProfileSaved(false),3000);
    } catch(e) { alert(e.message); }
    setSavingProfile(false);
  };

  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch('/api/products')
      .then(r => r.json())
      .then(data => setProducts(data.filter(p => p.has_alias && p.price1 != null).map((p, i) => ({
        id: i + 1,
        name: p.display_name || p.name,
        price: p.price1,
        unit: p.unit || 'кг',
        group: p.group || '',
        code: p.code,
        stock: p.stock,
        photo: p.photo || null,
        barcode: p.barcode || '',
        // Читают общие хелперы stockAmount/stockLabel/stockIsOut — без этих
        // полей весовой товар выглядел бы для них обычным, и они бы молча
        // возвращались к протухшим коробам (см. эти хелперы выше).
        priced_by_weight: !!p.priced_by_weight,
        stock_weight_kg: p.stock_weight_kg != null ? p.stock_weight_kg : null,
        avg_box_weight: p.avg_box_weight != null ? p.avg_box_weight : null
      }))))
      .catch(() => {});
  }, []);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch(e) { if(e.message.includes('токен')) onLogout(); }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, []);
  useRefetchOnVisible(loadOrders);

  const updateLine = (uid,patch) => setLines(ls=>ls.map(l=>l.uid===uid?{...l,...patch}:l));
  const removeLine = (uid) => setLines(ls=>ls.filter(l=>l.uid!==uid));

  // Клик по карточке в каталоге: товар уже в корзине — увеличиваем кол-во
  // (не больше остатка), иначе добавляем новую строку с qty=1. Первое
  // добавление товара требует подтверждения — повторные клики (увеличение
  // кол-ва уже выбранного товара) больше не переспрашивают.
  const addProductToCart = (prod) => {
    if (stockIsOut(prod)) return;
    const alreadyInCart = lines.some(l => l.productId === prod.id);
    if (!alreadyInCart && !window.confirm(`Добавить «${prod.name}» в заказ?`)) return;
    setLines(ls => {
      const existing = ls.find(l => l.productId === prod.id);
      if (existing) {
        const nextQty = (Number(existing.qty) || 0) + 1;
        const avail = stockAmount(prod);
        const capped = avail != null ? Math.min(nextQty, avail) : nextQty;
        return ls.map(l => l.productId === prod.id ? {...l, qty: String(capped)} : l);
      }
      // stock здесь — уже разрешённый остаток (кг для весового товара, короба́
      // для обычного, см. stockAmount) — им же ограничивает ручной ввод кол-ва
      // в корзине ниже (то же поле line.stock, отдельного кг-поля тут нет:
      // в отличие от SalesCabinet, здесь qty и так в единице p.unit, не в коробах).
      return [...ls, {uid:Math.random(),productId:prod.id,code:prod.code,name:prod.name,price:prod.price,search:prod.name,showDrop:false,qty:"1",stock:stockAmount(prod)}];
    });
  };

  const categories = useMemo(() => [...new Set(products.map(p=>p.group).filter(Boolean))].sort(), [products]);
  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const list = products.filter(p =>
      (!q || p.name.toLowerCase().includes(q) || (p.code||'').includes(q) || (p.barcode||'').includes(q)) &&
      (!catalogCategory || p.group === catalogCategory)
    );
    const sorted = list.slice();
    if (catalogSort === "group") sorted.sort((a,b)=>(a.group||"").localeCompare(b.group||"",'ru')||a.name.localeCompare(b.name,'ru'));
    else sorted.sort((a,b)=>a.name.localeCompare(b.name,'ru'));
    return sorted;
  }, [products, catalogSearch, catalogCategory, catalogSort]);

  const filledLines = lines.filter(l=>l.name&&Number(l.qty)>0&&Number(l.price)>0);
  const total = filledLines.reduce((s,l)=>s+Number(l.qty)*Number(l.price),0);

  const handleSubmit = async () => {
    if (submitting) return;
    if (filledLines.length===0||!timeSlot||!contactPhone.trim()) return;
    const items = filledLines.map(l=>({id:l.productId,code:l.code,name:l.name,qty:Number(l.qty),price:Number(l.price)}));
    setSubmitting(true);
    try {
      await apiCall('POST','/api/orders',{address,timeSlot,items,total,comment,contactName,contactPhone});
      setLines([]); setTimeSlot(""); setComment("");
      setSubmitted(true); setTab("orders"); loadOrders();
      setTimeout(()=>setSubmitted(false),4000);
    } catch(e) { alert(e.message); }
    setSubmitting(false);
  };

  const handleUpdateStatus = async (id, status, payment) => {
    try {
      await apiCall('PUT',`/api/orders/${id}/status`,{status});
      setSelectedOrder(null); loadOrders();
    } catch(e) { alert(e.message); }
  };

  const todayStr = new Date().toISOString().slice(0,10);
  const monthAgoStr = (() => { const d = new Date(); d.setDate(d.getDate()-29); return d.toISOString().slice(0,10); })();
  const [storeDateFrom, setStoreDateFrom] = useState(monthAgoStr);
  const [storeDateTo, setStoreDateTo] = useState(todayStr);
  const [storePreset, setStorePreset] = useState("month");
  const [filter, setFilter] = useState("all");

  const applyStorePreset = (preset) => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);
    else if (preset === "month") from.setDate(now.getDate() - 29);
    setStorePreset(preset);
    if (preset !== "custom") {
      setStoreDateFrom(from.toISOString().slice(0,10));
      setStoreDateTo(todayStr);
    }
  };

  const periodOrders = useMemo(() => orders.filter(o=>o.date>=storeDateFrom&&o.date<=storeDateTo), [orders, storeDateFrom, storeDateTo]);
  const filteredOrders = filter==="all" ? periodOrders : periodOrders.filter(o=>o.status===filter);

  const stats = {
    total: periodOrders.length,
    delivered: periodOrders.filter(o=>o.status==="delivered").length,
    inTransit: periodOrders.filter(o=>o.status==="in_transit").length,
    new: periodOrders.filter(o=>o.status==="new").length,
    cancelled: periodOrders.filter(o=>o.status==="cancelled").length,
    returned: periodOrders.filter(o=>o.status==="returned").length,
    spent: periodOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(o.total||0),0),
    cashTotal: periodOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(o.payment_cash||0),0),
    qrTotal: periodOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(o.payment_qr||0),0),
    debtTotal: periodOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(o.payment_debt||0),0),
  };

  // Отчёт о закупках: что и сколько магазин купил за период (только по
  // доставленным заказам — отменённые/возвраты в закуп не считаем).
  const productBreakdown = useMemo(() => {
    const map = {};
    periodOrders.filter(o=>o.status==="delivered").forEach(o=>{
      const its = typeof o.items === 'string' ? JSON.parse(o.items||'[]') : (o.items||[]);
      its.forEach(it=>{
        const key = it.code || it.name;
        if (!map[key]) map[key] = { name: it.name, qty: 0, sum: 0 };
        map[key].qty += Number(it.qty)||0;
        map[key].sum += (Number(it.qty)||0)*(Number(it.price)||0);
      });
    });
    return Object.values(map).sort((a,b)=>b.sum-a.sum);
  }, [periodOrders]);

  const dateRangeInputs = (
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[["day","День"],["week","Неделя"],["month","Месяц"],["custom","Свободный отбор"]].map(([k,lb])=>(
          <button key={k} onClick={()=>applyStorePreset(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${storePreset===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:storePreset===k?C.navy:C.white,color:storePreset===k?C.white:C.textMid}}>{lb}</button>
        ))}
      </div>
      {storePreset==="custom"&&(
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>С</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={storeDateFrom} onChange={e=>setStoreDateFrom(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>По</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={storeDateTo} onChange={e=>setStoreDateTo(e.target.value)}/>
          </div>
        </div>
      )}
    </div>
  );

  const filterChips = (
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      {STORE_FILTERS.map(([k,lb])=>(
        <button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${filter===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:filter===k?C.navy:C.white,color:filter===k?C.white:C.textMid}}>{lb}</button>
      ))}
    </div>
  );

  const ordersTable = (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:R,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>{["№","Дата","Адрес / время","Позиций","Сумма","Оплата","Водитель","Статус"].map((h,i)=><th key={i} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filteredOrders.map(o=>{
              const payment = {cash:o.payment_cash||0,qr:o.payment_qr||0,debt:o.payment_debt||0};
              const its = typeof o.items === 'string' ? JSON.parse(o.items||'[]') : (o.items||[]);
              return (
                <tr key={o.id} className="rowh" onClick={()=>setSelectedOrder(o)} style={{cursor:"pointer"}}>
                  <td style={{...S.td,fontFamily:FH,fontWeight:800}}>{o.id}</td>
                  <td style={S.td}>{o.date}</td>
                  <td style={S.td}>
                    <div style={{fontSize:14,color:C.textSub}}>{o.address}</div>
                    <div style={{fontSize:14,color:C.textFaint}}>{o.time_slot}</div>
                  </td>
                  <td style={S.td}>{its.length}</td>
                  <td style={{...S.td,fontFamily:FH,fontWeight:800,whiteSpace:"nowrap"}}>{(o.total||0).toLocaleString()} ₸</td>
                  <td style={S.td}><PaymentTags payment={payment}/></td>
                  <td style={S.td}>{o.driver_name || <span style={{color:C.textSub,fontStyle:"italic",fontSize:15}}>—</span>}</td>
                  <td style={S.td}><StatusBadge status={o.status} partial={o.partial_delivery}/></td>
                </tr>
              );
            })}
            {filteredOrders.length===0&&(
              <tr><td colSpan="8" style={{...S.td,textAlign:"center",color:C.textFaint,padding:"40px 0"}}>Заказов нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  // ===== "Новый заказ" — каталог в стиле кассы (см. CashierCabinet): большая
  // сетка товаров слева, липкая колонка адреса/корзины/оформления справа на
  // десктопе. На мобильном остаётся прежний порядок карточек друг под другом.
  const newOrderAddressCard = (
    <div style={S.card}>
      <div style={S.formGroup}>
        <div style={{...S.row,marginBottom:2}}>
          <label style={S.label}>Адрес и контакт</label>
          <button style={{background:"transparent",border:"none",color:C.navy,fontSize:14,fontWeight:600,cursor:"pointer",padding:0}} onClick={()=>setTab("profile")}>Изменить</button>
        </div>
        {profileComplete ? (
          <div style={{fontSize:15,color:C.textMid,lineHeight:1.5}}>
            {address}<br/>
            {contactName&&<>{contactName}, </>}{contactPhone}
          </div>
        ) : (
          <div style={{fontSize:15,color:C.textFaint,fontStyle:"italic"}}>Не заполнено</div>
        )}
      </div>
      <div style={S.formGroup}>
        <label style={S.label}>Время доставки</label>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {TIME_SLOTS.map(slot=>(
            <button key={slot} onClick={()=>setTimeSlot(slot)} style={{padding:"12px",borderRadius:10,border:`1.5px solid ${timeSlot===slot?C.navy:C.border}`,background:timeSlot===slot?C.navy:C.white,color:timeSlot===slot?C.white:C.textMid,fontSize:16,fontWeight:500,cursor:"pointer",textAlign:"left"}}>{slot}</button>
          ))}
        </div>
      </div>
    </div>
  );

  const newOrderCatalogCard = (
    <div style={S.card}>
      <div style={{...S.row,marginBottom:12}}>
        <label style={S.label}>Каталог {products.length>0&&<span style={{color:C.green,fontWeight:400,fontSize:13}}>({products.length} поз.)</span>}</label>
        {filledLines.length>0&&<span style={{fontSize:14,fontWeight:700,color:C.navy,background:C.surface,padding:"4px 10px",borderRadius:99,whiteSpace:"nowrap"}}>🛒 {filledLines.length}</span>}
      </div>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
        <input type="search" style={{...S.input,flex:1,minWidth:160}} placeholder="Поиск по названию, коду или штрихкоду..." value={catalogSearch} onChange={e=>setCatalogSearch(e.target.value)} autoComplete="off" name="catalog-search"/>
        <select style={{...S.select,width:"auto"}} value={catalogSort} onChange={e=>setCatalogSort(e.target.value)}>
          <option value="name_asc">По названию</option>
          <option value="group">По отделам</option>
        </select>
      </div>
      {categories.length>1&&(
        <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
          <button onClick={()=>setCatalogCategory("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${catalogCategory===""?C.navy:C.border}`,background:catalogCategory===""?C.navy:C.white,color:catalogCategory===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все</button>
          {categories.map(cat=>(
            <button key={cat} onClick={()=>setCatalogCategory(cat)} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${catalogCategory===cat?C.navy:C.border}`,background:catalogCategory===cat?C.navy:C.white,color:catalogCategory===cat?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{cat}</button>
          ))}
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns: desktop?"repeat(auto-fill, minmax(150px,1fr))":"1fr 1fr",gap:10}}>
        {filteredCatalog.length===0&&(
          <div style={{gridColumn:"1/-1",textAlign:"center",padding:"28px 0",color:C.textFaint,fontSize:15}}>
            {products.length===0?"Товары ещё не загружены":"Ничего не найдено"}
          </div>
        )}
        {filteredCatalog.map(p=>{
          const outOfStock = stockIsOut(p);
          const lowStock = !outOfStock && !p.priced_by_weight && p.stock !== null && p.stock !== undefined && p.stock <= 5;
          const inCart = lines.find(l=>l.productId===p.id);
          return (
            <div key={p.id} style={{border:`1px solid ${C.border}`,borderRadius:R,overflow:"hidden",background:C.white,opacity:outOfStock?0.55:1}}>
              <div style={{position:"relative",aspectRatio:"1",background:C.white,display:"flex",alignItems:"center",justifyContent:"center",padding:8,boxSizing:"border-box"}}>
                {p.photo
                  ? <img src={p.photo} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
                  : <span style={{fontSize:26,color:C.textFaint}}>📦</span>}
                {lowStock && <span style={{position:"absolute",top:6,left:6,background:"#FEF3C7",color:C.amber,fontSize:11,fontWeight:700,padding:"3px 7px",borderRadius:99}}>Осталось {p.stock}</span>}
              </div>
              <div style={{padding:"8px 10px"}}>
                <div style={{fontSize:14,fontWeight:600,color:C.text,marginBottom:6,minHeight:32,lineHeight:1.3}}>{p.name}</div>
                {outOfStock ? (
                  <div style={{fontSize:13,color:C.red,textAlign:"center",padding:"7px 0"}}>Нет в наличии</div>
                ) : inCart ? (
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,borderRadius:8,padding:"3px"}}>
                    <button onClick={()=>{
                      const nextQty=(Number(inCart.qty)||0)-1;
                      if(nextQty<=0) removeLine(inCart.uid); else updateLine(inCart.uid,{qty:String(nextQty)});
                    }} style={{width:26,height:26,border:"none",borderRadius:6,background:C.white,boxShadow:`0 0 0 1px ${C.border}`,fontSize:17,fontWeight:700,color:C.navy,cursor:"pointer"}}>−</button>
                    <span style={{fontSize:15,fontWeight:800,color:C.navy}}>{inCart.qty||0}</span>
                    <button onClick={()=>{
                      const nextQty=(Number(inCart.qty)||0)+1;
                      const availP = stockAmount(p);
                      updateLine(inCart.uid,{qty:String(availP!=null?Math.min(nextQty,availP):nextQty)});
                    }} style={{width:26,height:26,border:"none",borderRadius:6,background:C.white,boxShadow:`0 0 0 1px ${C.border}`,fontSize:17,fontWeight:700,color:C.navy,cursor:"pointer"}}>+</button>
                  </div>
                ) : (
                  <button onClick={()=>addProductToCart(p)} style={{width:"100%",padding:"7px",border:"none",borderRadius:8,background:C.navy,color:C.white,fontSize:14,fontWeight:700,cursor:"pointer"}}>
                    Добавить
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  const newOrderCartCard = filledLines.length>0 && (
    <div style={S.card}>
      <label style={{...S.label,marginBottom:10,display:"block"}}>Корзина</label>
      <div style={{display:"grid",gridTemplateColumns:"1fr 52px 26px",gap:6,marginBottom:6}}>
        {["Товар","Кол-во",""].map((h,i)=><div key={i} style={{fontSize:12,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>{h}</div>)}
      </div>
      {lines.filter(l=>l.productId).map(line=>(
        <div key={line.uid} style={{display:"grid",gridTemplateColumns:"1fr 52px 26px",gap:6,alignItems:"center",marginBottom:6}}>
          <div style={{fontSize:14,color:C.textMid}}>{line.name}</div>
          <input style={{...S.input,padding:"6px 4px",fontSize:14,textAlign:"center"}} type="number" min="1" max={line.stock!=null?line.stock:undefined} value={line.qty}
            onChange={e=>{
              let v = e.target.value;
              if (line.stock!=null && Number(v) > line.stock) v = String(line.stock);
              updateLine(line.uid,{qty:v});
            }}
            onFocus={e=>e.target.select()}
          />
          <button onClick={()=>removeLine(line.uid)} style={{width:26,height:30,border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,cursor:"pointer",fontSize:15,color:C.textFaint}}>×</button>
        </div>
      ))}
    </div>
  );

  const newOrderCommentCard = (
    <div style={S.card}>
      <div style={S.formGroup}>
        <label style={S.label}>Комментарий</label>
        <textarea style={S.textarea} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Особые пожелания..."/>
      </div>
      <button style={{...S.btnPrimary,opacity:(submitting||filledLines.length===0||!timeSlot||!contactPhone.trim())?0.45:1}} onClick={handleSubmit} disabled={submitting||filledLines.length===0||!timeSlot||!contactPhone.trim()}>{submitting?"Отправка...":"Отправить заказ"}</button>
    </div>
  );

  const content = (
    <>
      {tab==="orders"&&<>
        {!desktop&&<p style={S.sectionTitle}>Заказы</p>}
        {!desktop&&<button style={S.bigCreate} onClick={()=>{window.history.pushState({view:'new'},'','');setTab("new");}}><span style={S.bigCreatePlus}>+</span> Новый заказ</button>}
        {submitted&&<div style={S.alertSuccess}>Заказ отправлен! Менеджер направит его в доставку.</div>}
        {dateRangeInputs}
        {loading?<div style={S.loadingWrap}>Загрузка...</div>:<>
          <div style={{...S.statsRow, gridTemplateColumns: desktop?"repeat(6, minmax(0,1fr))":"1fr 1fr"}}>
            <div style={S.statCard()}><p style={S.statNum()}>{stats.total}</p><p style={S.statLabel}>Всего</p></div>
            <div style={S.statCard()}><p style={S.statNum(C.green)}>{stats.delivered}</p><p style={S.statLabel}>Доставлено</p></div>
            <div style={S.statCard()}><p style={S.statNum(C.amber)}>{stats.inTransit}</p><p style={S.statLabel}>В работе</p></div>
            <div style={S.statCard()}><p style={S.statNum(C.pending)}>{stats.new}</p><p style={S.statLabel}>Новых</p></div>
            <div style={S.statCard()}><p style={S.statNum(C.red)}>{stats.cancelled}</p><p style={S.statLabel}>Отказ</p></div>
            <div style={S.statCard()}><p style={S.statNum("#7C3AED")}>{stats.returned}</p><p style={S.statLabel}>Возврат</p></div>
          </div>
          {filterChips}
          {desktop
            ? ordersTable
            : (filteredOrders.length===0
              ?<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>Заказов нет</p></div>
              :filteredOrders.map(o=><OrderCard key={o.id} order={o} onOpen={setSelectedOrder}/>))
          }
        </>}
      </>}
      {tab==="report"&&<>
        {!desktop&&<p style={S.sectionTitle}>Отчёт о закупках</p>}
        {dateRangeInputs}
        <div style={{...S.revenueCard, maxWidth: desktop?560:"none"}}>
          <p style={S.revenueLabel}>Потрачено за период</p>
          <p style={{...S.revenueNum, marginBottom:14}}>{stats.spent.toLocaleString()} ₸</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{label:"Наличка",val:stats.cashTotal,bg:C.cashGreen,col:"#15803D"},{label:"QR код",val:stats.qrTotal,bg:C.qrBlue,col:"#1D4ED8"},{label:"Долг",val:stats.debtTotal,bg:C.debtAmber,col:"#92400E"}].map(({label,val,bg,col})=>(
              <div key={label} style={{background:bg,borderRadius:10,padding:"10px 8px"}}>
                <p style={{margin:"0 0 2px",fontSize:12,color:col,fontWeight:700}}>{label.toUpperCase()}</p>
                <p style={{margin:0,fontSize:15,fontWeight:800,fontFamily:FH,color:col}}>{(val||0).toLocaleString()} ₸</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{maxWidth: desktop?560:"none"}}>
          <p style={{...S.sectionTitle,fontSize:17,marginTop:8}}>По товарам</p>
          {productBreakdown.length===0?<div style={{textAlign:"center",padding:"32px 0",color:C.textFaint}}>Нет доставленных заказов за этот период</div>:
            productBreakdown.map((p,i)=>(
              <div key={i} style={S.card}>
                <div style={S.row}>
                  <div><p style={S.cardTitle}>{p.name}</p><p style={S.cardSub}>{p.qty.toLocaleString()} шт/кг</p></div>
                  <p style={{margin:0,fontWeight:800,fontFamily:FH,color:C.navy}}>{p.sum.toLocaleString()} ₸</p>
                </div>
              </div>
          ))}
        </div>
      </>}
      {tab==="new"&&<>
        {!desktop&&(
          <div style={{...S.row,marginBottom:14}}>
            <p style={{...S.sectionTitle,margin:0}}>Новый заказ</p>
            <button style={S.btnSecondary} onClick={()=>setTab("orders")}>← Назад</button>
          </div>
        )}
          {!profileLoading && !profileComplete && (
            <div style={{...S.alertSuccess,background:"#FEF3C7",color:"#92400E",display:"flex",justifyContent:"space-between",alignItems:"center",gap:10,flexWrap:"wrap"}}>
              <span>Заполните адрес и телефон в профиле — тогда не придётся вводить их в каждом заказе.</span>
              <button style={{...S.btnSecondary,width:"auto",whiteSpace:"nowrap"}} onClick={()=>setTab("profile")}>Заполнить профиль</button>
            </div>
          )}
          {desktop ? (
            // Каталог слева + липкая колонка адрес/корзина/оформление справа —
            // та же раскладка, что у кассы (CashierCabinet), чтобы магазин
            // видел чек и мог оформить продажу, не прокручивая страницу вниз.
            <div style={{display:"grid",gridTemplateColumns:"minmax(0,1fr) 380px",gap:16,alignItems:"start"}}>
              {newOrderCatalogCard}
              <div style={{position:"sticky",top:20,display:"flex",flexDirection:"column",gap:16}}>
                {newOrderAddressCard}
                {newOrderCartCard}
                {newOrderCommentCard}
              </div>
            </div>
          ) : (
            <>
              {newOrderAddressCard}
              {newOrderCatalogCard}
              {newOrderCartCard}
              {newOrderCommentCard}
            </>
          )}
      </>}
      {tab==="profile"&&<>
        {!desktop&&<p style={S.sectionTitle}>Профиль магазина</p>}
        <div style={{maxWidth: desktop?480:"none"}}>
          <p style={{fontSize:14,color:C.textSub,marginTop:desktop?0:-8,marginBottom:14}}>
            Эти данные подставляются в каждый новый заказ — заполните один раз, и не придётся вводить их заново.
          </p>
          {profileLoading ? <div style={S.loadingWrap}>Загрузка...</div> : (
            <div style={S.card}>
              {profileSaved&&<div style={{...S.alertSuccess,marginBottom:14}}>Сохранено</div>}
              <div style={S.formGroup}>
                <label style={S.label}>Адрес доставки</label>
                <input style={S.input} placeholder="Адрес" value={profileForm.address} onChange={e=>setProfileForm(f=>({...f,address:e.target.value}))}/>
              </div>
              <div style={S.formGroup}>
                <label style={S.label}>Контактное лицо</label>
                <input style={{...S.input,marginBottom:8}} placeholder="Имя" value={profileForm.contactName} onChange={e=>setProfileForm(f=>({...f,contactName:e.target.value}))}/>
                <input style={S.input} placeholder="Телефон" value={profileForm.contactPhone} onChange={e=>setProfileForm(f=>({...f,contactPhone:e.target.value}))}/>
              </div>
              <button style={{...S.btnPrimary,opacity:(savingProfile||!profileForm.contactPhone.trim())?0.45:1}} onClick={saveProfile} disabled={savingProfile||!profileForm.contactPhone.trim()}>{savingProfile?"Сохранение...":"Сохранить"}</button>
            </div>
          )}
        </div>
      </>}
    </>
  );

  if (desktop) {
    return (
      <div style={{display:"flex",minHeight:"100vh",background:C.surface,alignItems:"flex-start"}}>
        <AutofillDecoy/>
        {selectedOrder&&<OrderDetail order={selectedOrder} onClose={()=>setSelectedOrder(null)} onUpdateStatus={handleUpdateStatus} currentUser={user} products={products}/>}
        <aside style={S.side}>
          <div style={{marginBottom:34}}><Brand size={44}/></div>
          <nav style={{flex:1}}>
            {STORE_TABS.map(([k,ic,lb])=>(
              <button key={k} style={S.sideLink(tab===k)} onClick={()=>setTab(k)}>
                <span style={{fontSize:18}}>{ic}</span>{lb}
              </button>
            ))}
          </nav>
          <div style={{fontSize:14,color:"#8B8681",lineHeight:1.6}}>
            Магазин · {user.name}<br/>
            <button style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:14,marginTop:8}} onClick={onLogout}>Выйти</button>
          </div>
        </aside>
        <main style={S.main}>
          <div style={{...S.row,marginBottom:22,alignItems:"flex-start"}}>
            <div>
              <h1 style={S.h1}>{STORE_TAB_TITLES[tab]}</h1>
              <div style={S.h1sub}>{new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</div>
            </div>
            {tab!=="new" && <button style={{...S.btnPrimary,width:"auto",padding:"12px 20px",marginTop:0,boxShadow:"none"}} onClick={()=>setTab("new")}>+ Новый заказ</button>}
          </div>
          {content}
        </main>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:72}}>
      {selectedOrder&&<OrderDetail order={selectedOrder} onClose={()=>setSelectedOrder(null)} onUpdateStatus={handleUpdateStatus} currentUser={user} products={products}/>}
      <div style={S.page}>
        {content}
      </div>
      <div style={S.nav}>
        {STORE_TABS.map(([k,ic,lb])=>(
          <button key={k} style={{...S.navBtn(tab===k),flex:1}} onClick={()=>setTab(k)}>
            <span style={S.navIcon}>{ic}</span><span style={S.navLabel(tab===k)}>{lb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DriverCabinet({ user, onLogout }) {
  const [tab, setTab] = useState("queue");
  const [filter, setFilter] = useState("all");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showReturnModal, setShowReturnModal] = useState(false);

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch(e) { if(e.message.includes('токен')) onLogout(); }
    setLoading(false);
  }, []);

  // Сдача налички складу (инкассация) — см. POST /api/cash-handovers.
  // Сумма считается на сервере из тех же orders, что уже загружены здесь
  // (для мгновенного отображения без лишнего запроса), но окончательное
  // решение — за сервером: тот же расчёт там продублирован намеренно.
  const [cashHandovers, setCashHandovers] = useState([]);
  const loadCashHandovers = useCallback(async () => {
    try { setCashHandovers(await apiCall('GET','/api/cash-handovers')); } catch(e) {}
  }, []);
  useEffect(() => { loadCashHandovers(); }, []);
  useRefetchOnVisible(loadCashHandovers);
  const [handingOver, setHandingOver] = useState(false);
  const pendingCashOrders = orders.filter(o=>o.driver_id===user.id&&o.status==="delivered"&&(Number(o.payment_cash)||0)>0&&!o.cash_handover_id);
  const pendingCashAmount = pendingCashOrders.reduce((s,o)=>s+(Number(o.payment_cash)||0),0);
  const handOverCash = async () => {
    if (handingOver || pendingCashAmount<=0) return;
    if (!window.confirm(`Сдать складу ${pendingCashAmount.toLocaleString()} ₸? Склад пересчитает и подтвердит фактическую сумму.`)) return;
    setHandingOver(true);
    try {
      await apiCall('POST','/api/cash-handovers',{});
      loadOrders(); loadCashHandovers();
    } catch(e) { alert(e.message); }
    setHandingOver(false);
  };

  useEffect(() => { loadOrders(); }, []);
  useRefetchOnVisible(loadOrders);

  const handleUpdate = async (id, status, payment, driverId, items) => {
    try {
      await apiCall('PUT', `/api/orders/${id}/status`, { status, payment, items });
      setSelectedOrder(null); loadOrders();
    } catch(e) { alert(e.message); }
  };

  // Мои возвраты — см. POST /api/returns и PUT /api/returns/:id/confirm.
  // Пока склад не подтвердил (status "pending"), товар ещё не приходован
  // в остаток — водителю важно видеть, что возврат ждёт подтверждения,
  // а не считать оформление конечным шагом.
  const [myReturns, setMyReturns] = useState([]);
  const loadMyReturns = useCallback(async () => {
    try { setMyReturns(await apiCall('GET','/api/returns')); } catch(e) {}
  }, []);
  useEffect(() => { loadMyReturns(); }, []);
  useRefetchOnVisible(loadMyReturns);

  const todayStr = new Date().toISOString().slice(0,10);
  const [driverDateFrom, setDriverDateFrom] = useState(todayStr);
  const [driverDateTo, setDriverDateTo] = useState(todayStr);
  const [driverPreset, setDriverPreset] = useState("day");

  const applyDriverPreset = (preset) => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);
    else if (preset === "month") from.setDate(now.getDate() - 29);
    setDriverPreset(preset);
    if (preset !== "custom") {
      setDriverDateFrom(from.toISOString().slice(0,10));
      setDriverDateTo(todayStr);
    }
  };

  // Заявки от магазина в статусе "new" ещё не разобраны менеджером и не
  // видны в общей очереди — менеджер сам назначает водителя (тогда заявка
  // переходит в in_transit с driver_id и появляется как обычно). Самовывоз
  // (time_slot===PICKUP_SLOT) клиент забирает сам, свободному водителю
  // незачем видеть его в общей очереди "доступно взять" — исключаем только
  // отсюда (queueNew и new-часть queueAll). После того как её всё же
  // назначили конкретному человеку (обычно так и оформляют выдачу с
  // самовывоза — по факту через того же водителя/сотрудника на кассе) и
  // статус стал in_transit, заявка должна вести себя как обычно и остаться
  // видна в queueActive — иначе подтвердить её "Доставлено"
  // (единственный путь для этого — DriverPaymentBlock у назначенного
  // водителя, см. ниже) стало бы физически некому: у admin/manager в
  // OrderDetail для in_transit нет своей кнопки завершения.
  //
  // "В работе" (in_transit) — заявка уже закреплена за конкретным водителем,
  // поэтому в отличие от "Ожидает" (ещё ничья, видна всем) здесь каждый
  // водитель должен видеть только свои: queueActive/queueAll фильтруют
  // in_transit по driver_id===user.id.
  const queueNew = orders.filter(o=>o.status==="new"&&o.source!=="store"&&o.time_slot!==PICKUP_SLOT);
  const queueActive = orders.filter(o=>o.status==="in_transit"&&o.driver_id===user.id);
  const queueAll = [...queueNew, ...queueActive];
  const myActive = queueActive;

  const myDoneAll = orders.filter(o=>o.driver_id===user.id&&o.date>=driverDateFrom&&o.date<=driverDateTo&&["delivered","cancelled","returned"].includes(o.status));
  const myDelivered = myDoneAll.filter(o=>o.status==="delivered");
  const myCancelled = myDoneAll.filter(o=>o.status==="cancelled");
  const myReturned = myDoneAll.filter(o=>o.status==="returned");

  const combinedAll = [...queueAll,...myDoneAll].sort((a,b)=>b.id-a.id);
  const FILTERS=[["all","Все"],["new","Ожидает"],["in_transit","В работе"],["delivered","Доставлено"],["cancelled","Отказ"],["returned","Возврат"]];
  const filterShown = filter==="all"?combinedAll:filter==="new"?queueNew:filter==="in_transit"?queueActive:filter==="delivered"?myDelivered:filter==="cancelled"?myCancelled:myReturned;


  const driverDateFilter = (
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[["day","День"],["week","Неделя"],["month","Месяц"],["custom","Свободный отбор"]].map(([k,lb])=>(
          <button key={k} onClick={()=>applyDriverPreset(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${driverPreset===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:driverPreset===k?C.navy:C.white,color:driverPreset===k?C.white:C.textMid}}>{lb}</button>
        ))}
      </div>
      {driverPreset==="custom"&&(
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>С</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={driverDateFrom} onChange={e=>setDriverDateFrom(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>По</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={driverDateTo} onChange={e=>setDriverDateTo(e.target.value)}/>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div style={{paddingBottom:72}}>
      {selectedOrder&&<OrderDetail order={selectedOrder} onClose={()=>setSelectedOrder(null)} onUpdateStatus={handleUpdate} currentUser={user}/>}
      {showReturnModal&&<ReturnFormModal user={user} onClose={()=>setShowReturnModal(false)} onCreated={()=>{loadOrders();loadMyReturns();}}/>}
      <div style={S.page}>
        {tab==="queue"&&<>
          <div style={S.statsRow}>
            <div style={S.statCard()}><p style={S.statNum(C.pending)}>{queueNew.length}</p><p style={S.statLabel}>Ожидают</p></div>
            <div style={S.statCard()}><p style={S.statNum(C.amber)}>{queueActive.length}</p><p style={S.statLabel}>В работе</p></div>
          </div>
          <p style={S.sectionTitle}>Заявки</p>
          <button onClick={()=>setShowReturnModal(true)} style={{...S.btnOutline,borderColor:"#7C3AED",color:"#7C3AED",marginTop:0,marginBottom:myReturns.some(r=>r.status==="pending")?8:14}}>↩️ Оформить возврат</button>
          {myReturns.filter(r=>r.status==="pending").length>0&&(
            <div style={{marginBottom:14,padding:"9px 12px",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:10,fontSize:13,color:"#92400E"}}>
              ⏳ {myReturns.filter(r=>r.status==="pending").length} {myReturns.filter(r=>r.status==="pending").length===1?'возврат ждёт':'возвратов ждут'} подтверждения складом — товар примут и зачтут в остаток, когда физически привезёте.
            </div>
          )}
          {myActive.length>0&&(
            <button onClick={()=>printLoadingList(myActive,user.name)} style={{width:"100%",marginBottom:14,padding:"12px",background:C.navy,color:C.white,border:"none",borderRadius:10,fontSize:16,fontWeight:700,cursor:"pointer"}}>🧾 Загрузочный лист ({myActive.length} {myActive.length===1?'заявка':'заявок'})</button>
          )}
          {driverDateFilter}
          <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
            {FILTERS.map(([k,lb])=>(
              <button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${filter===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:filter===k?C.navy:C.white,color:filter===k?C.white:C.textMid}}>{lb}</button>
            ))}
          </div>
          {loading?<div style={S.loadingWrap}>Загрузка...</div>:filterShown.length===0
            ?<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}><div style={{fontSize:40,marginBottom:12}}>🚗</div><p>Нет заявок</p></div>
            :filterShown.map(o=>(
              <div key={o.id} style={{...S.card,cursor:"pointer",borderLeft:`4px solid ${SC[o.status]||'#999'}`}} onClick={()=>setSelectedOrder(o)}>
                <div style={S.row}>
                  <div style={{flex:1,marginRight:10}}>
                    <p style={S.cardTitle}>№ {o.id} · {o.client_name}</p>
                    <p style={S.cardSub}>{o.address}</p>
                    <p style={{...S.cardSub,marginTop:2}}>🕐 {o.time_slot} · {o.sales_name}</p>
                    <p style={{...S.cardSub,marginTop:2,color:C.textFaint}}>
                      Создана {fmtDT(o.created_at)||o.date}
                      {o.in_transit_at?` · в работе с ${fmtDT(o.in_transit_at)}`:''}
                    </p>
                  </div>
                  <StatusBadge status={o.status} partial={o.partial_delivery}/>
                </div>
                <p style={{margin:"8px 0 4px",fontSize:15,color:C.textSub}}>Сумма: <b style={{color:C.text,fontFamily:FH}}>{(o.total||0).toLocaleString()} ₸</b></p>
                {o.status==="new"&&<button onClick={e=>{e.stopPropagation();handleUpdate(o.id,"in_transit",null);}} style={{marginTop:10,width:"100%",padding:"11px",background:C.navy,color:C.white,border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer"}}>🚚 Взять в доставку</button>}
              </div>
            ))
          }
        </>}
        {tab==="cashbox"&&<>
          <div style={{...S.card,marginBottom:16,background:pendingCashAmount>0?C.cashGreen:C.surface}}>
            <div style={{...S.row,marginBottom:pendingCashAmount>0?8:0}}>
              <div>
                <p style={{margin:0,fontSize:13,fontWeight:700,color:pendingCashAmount>0?"#15803D":C.textFaint,textTransform:"uppercase"}}>Наличка на руках</p>
                <p style={{margin:"2px 0 0",fontSize:22,fontWeight:800,fontFamily:FH,color:pendingCashAmount>0?"#15803D":C.textSub}}>{pendingCashAmount.toLocaleString()} ₸</p>
              </div>
              {pendingCashAmount>0&&(
                <button onClick={handOverCash} disabled={handingOver} style={{...S.btnPrimary,width:"auto",marginTop:0,boxShadow:"none",padding:"11px 18px",opacity:handingOver?0.6:1}}>{handingOver?"Оформляю...":"💰 Сдать наличку"}</button>
              )}
            </div>
            {pendingCashAmount>0&&<p style={{margin:0,fontSize:13,color:"#15803D"}}>{pendingCashOrders.length} {pendingCashOrders.length===1?'доставленная заявка':'доставленных заявок'} с оплатой налом ещё не сданы складу</p>}
          </div>
          {cashHandovers.length>0&&(
            <div style={{marginBottom:16}}>
              <p style={{...S.sectionTitle,fontSize:17}}>Мои сдачи налички</p>
              {cashHandovers.map(h=>(
                <div key={h.id} style={S.card}>
                  <div style={S.row}>
                    <span style={{fontSize:14,fontWeight:600,color:C.textSub}}>{h.date}</span>
                    <span style={{fontSize:13,fontWeight:700,padding:"3px 9px",borderRadius:99,background:h.status==="pending"?"#FFFBEB":(h.difference<0?C.redSoft:"#EAF5EE"),color:h.status==="pending"?"#92400E":(h.difference<0?C.red:C.green)}}>
                      {h.status==="pending"?"⏳ Ожидает":(h.difference<0?`Недостача ${Math.abs(h.difference).toLocaleString()} ₸`:(h.difference>0?`Излишек ${h.difference.toLocaleString()} ₸`:"✓ Сошлось"))}
                    </span>
                  </div>
                  <p style={{margin:"6px 0 0",fontSize:15}}>Ожидалось: <b style={{fontFamily:FH}}>{h.expected_amount.toLocaleString()} ₸</b>{h.status==="confirmed"&&<> · Принято: <b style={{fontFamily:FH}}>{h.actual_amount.toLocaleString()} ₸</b></>}</p>
                  {h.comment&&<p style={{margin:"4px 0 0",fontSize:13,color:C.textFaint}}>{h.comment}</p>}
                </div>
              ))}
            </div>
          )}
          <div style={{marginTop:20}}><DebtsPanel readOnly/></div>
        </>}
      </div>
      <div style={S.nav}>
        {[["queue","📋","Заявки"],["cashbox","💰","Касса"]].map(([k,ic,lb])=>(
          <button key={k} style={{...S.navBtn(tab===k),flex:1}} onClick={()=>setTab(k)}>
            <span style={S.navIcon}>{ic}</span><span style={S.navLabel(tab===k)}>{lb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// Сверка "весовой товар" (галочка на сайте) с единицей измерения, которую
// реально прислала 1С (p.unit, см. /api/products/sync) — найденная на
// практике причина рассинхрона остатка: если 1С считает товар в штуках/
// коробах, а на сайте он ошибочно отмечен как весовой (или наоборот, 1С
// шлёт кг, а на сайте не отмечен) — заявки на сайте пишут qty в одном
// смысле, а 1С разбирает его в другом, отсюда и разъезжаются цифры при
// синхронизации (см. историю: "Яйцо Деревенское 360" считалось на сайте в
// кг, хотя 1С — в шт, из-за этого при сверке остатков расхождение было в
// десятки раз больше, чем по остальным товарам).
function weightUnitMismatch(unit, pricedByWeight) {
  if (!unit) return false; // 1С ещё не прислала единицу — сверять не с чем
  const isKg = /^кг\.?$/i.test(unit.trim());
  return isKg !== !!pricedByWeight;
}

// Мемоизированная карточка товара для вкладки "Товары" (псевдонимы/цены).
// Раньше все карточки рендерились заново на каждое нажатие клавиши в любом
// поле — из-за этого набор текста подтормаживал, особенно когда открыт список
// из 150+ позиций. React.memo + стабильные (useCallback) колбэки в
// AdminCabinet означают, что перерисовывается только та карточка, в которой
// реально поменялось значение.
const ProductAliasCard = memo(function ProductAliasCard({ p, locked: lockedProp, readOnly, saving, alias, price1, price2, price3, commission, cost, pricedByWeight, avgBoxWeight, onChange, onEditRequest, onSave }) {
  // readOnly (роль operator — только просмотр) держит карточку заблокированной
  // независимо от locked/editingCodes выше по стеку — кнопка "Редакт." для
  // такой роли не рендерится вовсе, разлочить нечем.
  const locked = lockedProp || readOnly;
  return (
    <div id={`product-card-${p.code}`} style={{...S.card, padding:10, marginBottom:6}}>
      <div style={{display:"flex",gap:10,marginBottom:6}}>
        <div style={{width:52,height:52,borderRadius:8,flex:"none",overflow:"hidden",background:C.surface,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center"}}>
          {p.photo
            ? <img src={p.photo} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            : <span style={{fontSize:20,color:C.textFaint}}>📷</span>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <div style={{fontSize:13,color:C.textFaint,marginBottom:2}}>Код 1С: {p.code} {p.group?' · '+p.group:''}</div>
          <div style={{fontSize:15,fontWeight:600,color:C.textMid}}>{p.name}</div>
        </div>
      </div>
      <input
        style={{...S.input,padding:"7px 10px",fontSize:15,marginBottom:6,background:locked?C.surface:C.white,color:locked?C.textSub:C.text}}
        placeholder="Название для сайта (необязательно)"
        disabled={locked}
        value={alias}
        onChange={e=>onChange(p.code,'alias',e.target.value)}
      />
      <label style={{display:"flex",alignItems:"center",gap:6,marginBottom:6,cursor:locked?"default":"pointer",fontSize:14,color:locked?C.textFaint:C.textMid}}>
        <input type="checkbox" disabled={locked} checked={pricedByWeight} onChange={e=>onChange(p.code,'priced_by_weight',e.target.checked)}/>
        Весовой товар (цена за кг, кол-во в заявке — до факт. взвешивания на складе)
      </label>
      {weightUnitMismatch(p.unit, pricedByWeight)&&(
        <p style={{margin:"0 0 6px",fontSize:12,fontWeight:700,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",padding:"5px 8px",borderRadius:6}}>
          ⚠ В 1С единица измерения товара — «{p.unit}», а галочка "Весовой товар" здесь {pricedByWeight?'включена':'выключена'}. Если это не весовой товар (штуки/короба), 1С и сайт будут расходиться в остатках.
        </p>
      )}
      {pricedByWeight&&(
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:13,color:locked?C.textFaint:C.textMid,whiteSpace:"nowrap"}}>Средний вес короба, кг</span>
          <input
            style={{...S.input,width:80,padding:"6px 8px",fontSize:14,textAlign:"center",background:locked?C.surface:C.white,color:locked?C.textSub:C.text}}
            placeholder="кг"
            type="number"
            disabled={locked}
            value={avgBoxWeight}
            onFocus={e=>e.target.select()}
            onChange={e=>onChange(p.code,'avg_box_weight',e.target.value)}
          />
          <span style={{fontSize:12,color:C.textFaint}}>для оценки кол-ва коробов по кг-остатку (вес каждый раз разный, это прикидка)</span>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr 70px auto",gap:6,marginBottom:1}}>
        {["Цена 1","Цена 2","Цена 3","Закупка","₸ торговому",""].map((h,i)=><div key={i} style={{fontSize:11,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>{h}</div>)}
      </div>
      <div style={{fontSize:12,color:C.textFaint,marginBottom:4}}>Цена 1 — видят магазины в своём кабинете. Цена 2/3 — на выбор торгового представителя. Закупка — для расчёта прибыли в отчётах, покупатель её не видит.</div>
      <div style={{display:"flex",gap:6}}>
        <input
          style={{...S.input,padding:"7px 8px",fontSize:14,background:locked?C.surface:C.white,color:locked?C.textSub:C.text}}
          placeholder="Цена 1"
          type="number"
          disabled={locked}
          value={price1}
          onFocus={e=>e.target.select()}
          onChange={e=>onChange(p.code,'price1',e.target.value)}
        />
        <input
          style={{...S.input,padding:"7px 8px",fontSize:14,background:locked?C.surface:C.white,color:locked?C.textSub:C.text}}
          placeholder="Цена 2"
          type="number"
          disabled={locked}
          value={price2}
          onFocus={e=>e.target.select()}
          onChange={e=>onChange(p.code,'price2',e.target.value)}
        />
        <input
          style={{...S.input,padding:"7px 8px",fontSize:14,background:locked?C.surface:C.white,color:locked?C.textSub:C.text}}
          placeholder="Цена 3"
          type="number"
          disabled={locked}
          value={price3}
          onFocus={e=>e.target.select()}
          onChange={e=>onChange(p.code,'price3',e.target.value)}
        />
        <input
          style={{...S.input,padding:"7px 8px",fontSize:14,background:locked?C.surface:"#F0F9F4",color:locked?C.textSub:"#157E3C",fontWeight:600}}
          placeholder="Закупка"
          type="number"
          disabled={locked}
          value={cost}
          onFocus={e=>e.target.select()}
          onChange={e=>onChange(p.code,'cost',e.target.value)}
        />
        <div style={{position:"relative",width:70}}>
          <input
            style={{...S.input,padding:"7px 20px 7px 8px",fontSize:14,background:locked?C.surface:"#FFFBEB",color:locked?C.textSub:"#92400E",fontWeight:700,borderColor:locked?C.border:"#FDE68A",width:70}}
            placeholder="0"
            type="number"
            disabled={locked}
            value={commission}
            onFocus={e=>e.target.select()}
            onChange={e=>onChange(p.code,'commission',e.target.value)}
          />
          <span style={{position:"absolute",right:8,top:"50%",transform:"translateY(-50%)",fontSize:14,fontWeight:700,color:locked?C.textFaint:"#92400E",pointerEvents:"none"}}>₸</span>
        </div>
        {!readOnly&&<button
          style={{...S.btnPrimary, padding:"7px 14px", fontSize:14, marginTop:0, boxShadow:"none", opacity: saving?0.5:1, width:"auto", whiteSpace:"nowrap"}}
          disabled={saving}
          onClick={()=>{
            if (locked) { onEditRequest(p.code); }
            else { onSave(p); }
          }}
        >{locked ? "Редакт." : "Сохр."}</button>}
      </div>
    </div>
  );
});

// Экран "Товары" (псевдонимы/цены/себестоимость/комиссия) — тот же
// набор полей и логика сохранения, что у менеджера/админа (см. вкладку
// "aliases" в AdminCabinet), вынесен в отдельный самодостаточный
// компонент, чтобы его же мог открыть у себя старший торговый
// представитель (см. SalesCabinet), не дублируя код руками. Компонент
// сам грузит /api/products и сам знает, как сохранять правки — не
// делит состояние с AdminCabinet (та вкладка остаётся работать как
// была, отдельным куском состояния).
function ProductAliasesPanel({ desktop }) {
  const [products, setProducts] = useState([]);
  const [aliasSearch, setAliasSearch] = useState("");
  const [edits, setEdits] = useState({});
  const [savingCode, setSavingCode] = useState(null);
  const [editingCodes, setEditingCodes] = useState({});
  const [aliasSectionsOpen, setAliasSectionsOpen] = useState({ unset: true, set: false });
  const [onlyMismatch, setOnlyMismatch] = useState(false);

  const loadProducts = useCallback(async () => {
    try { setProducts(await fetch('/api/products').then(r => r.json())); } catch(e) {}
  }, []);
  useEffect(() => { loadProducts(); }, []);
  useRefetchOnVisible(loadProducts);

  const getField = (p, field) => {
    if (edits[p.code] && edits[p.code][field] !== undefined) return edits[p.code][field];
    if (field === 'alias') return p.has_alias ? p.display_name : '';
    if (field === 'priced_by_weight') return !!p.priced_by_weight;
    return p[field] != null ? String(p[field]) : '';
  };
  const updateField = useCallback((code, field, value) => setEdits(e => ({...e, [code]: {...e[code], [field]: value}})), []);
  const onEditRequest = useCallback((code) => setEditingCodes(e => ({...e, [code]: true})), []);

  const editsRef = useRef(edits);
  useEffect(() => { editsRef.current = edits; }, [edits]);

  const saveAlias = useCallback(async (p) => {
    const code = p.code;
    const fieldsFromEdits = editsRef.current[code] || {};
    const resolve = (field) => fieldsFromEdits[field] !== undefined
      ? fieldsFromEdits[field]
      : (field === 'alias' ? (p.has_alias ? p.display_name : '') : (field === 'priced_by_weight' ? !!p.priced_by_weight : (p[field] != null ? String(p[field]) : '')));
    const alias = resolve('alias');
    const price1 = resolve('price1');
    const price2 = resolve('price2');
    const price3 = resolve('price3');
    const commission = resolve('commission');
    const cost = resolve('cost');
    const pricedByWeight = resolve('priced_by_weight');
    const avgBoxWeight = resolve('avg_box_weight');
    setSavingCode(code);
    try {
      await apiCall('POST', '/api/product-aliases', {
        code, alias,
        price1: price1 === '' ? null : Number(price1),
        price2: price2 === '' ? null : Number(price2),
        price3: price3 === '' ? null : Number(price3),
        commission: commission === '' ? 0 : Number(commission),
        cost: cost === '' ? null : Number(cost),
        priced_by_weight: !!pricedByWeight,
        avg_box_weight: avgBoxWeight === '' ? null : Number(avgBoxWeight),
      });
      await loadProducts();
      setEditingCodes(e => { const n = {...e}; delete n[code]; return n; });
    } catch(e) { alert(e.message); }
    setSavingCode(null);
  }, [loadProducts]);

  const renderProductCard = (p) => {
    const locked = p.has_alias && !editingCodes[p.code];
    return (
      <ProductAliasCard
        key={p.code}
        p={p}
        locked={locked}
        saving={savingCode===p.code}
        alias={getField(p,'alias')}
        price1={getField(p,'price1')}
        price2={getField(p,'price2')}
        price3={getField(p,'price3')}
        commission={getField(p,'commission')}
        cost={getField(p,'cost')}
        pricedByWeight={getField(p,'priced_by_weight')}
        avgBoxWeight={getField(p,'avg_box_weight')}
        onChange={updateField}
        onEditRequest={onEditRequest}
        onSave={saveAlias}
      />
    );
  };

  // Та же защита от лишнего размонтирования карточек при вводе, что и в
  // AdminCabinet — обычная функция, а не JSX-компонент, см. её комментарий там.
  const renderAliasSection = ({ id, title, badgeColor, list }) => {
    const open = !!aliasSectionsOpen[id];
    return (
      <div key={id} style={{...S.card, padding:0, marginBottom:12, overflow:"hidden"}}>
        <div
          onClick={()=>setAliasSectionsOpen(s=>({...s,[id]:!s[id]}))}
          style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",cursor:"pointer",background:C.surface}}
        >
          <span style={{fontSize:15,fontWeight:700,color:C.navy,display:"flex",alignItems:"center",gap:8}}>
            {title}
            <span style={{fontSize:13,fontWeight:700,color:badgeColor,background:badgeColor+"22",padding:"2px 8px",borderRadius:99}}>{list.length}</span>
          </span>
          <span style={{fontSize:14,color:C.textFaint}}>{open?"▲ Свернуть":"▼ Развернуть"}</span>
        </div>
        {open && (
          <div style={{padding:10,maxHeight:520,overflowY:"auto",borderTop:`1px solid ${C.border}`}}>
            {list.length===0
              ? <div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>{aliasSearch.trim()?"Ничего не найдено":"Пусто"}</div>
              : list.map(renderProductCard)}
          </div>
        )}
      </div>
    );
  };

  // p.name — сырое название из 1С (меняется от поставки к поставке, см.
  // GET /api/products), а не то, что видит пользователь — там display_name
  // (постоянный псевдоним, если задан). Раньше поиск сверял запрос только с
  // p.name: искать по названию, под которым товар знают на сайте (тому же,
  // что показано в предупреждении отчёта о прибыли), было невозможно —
  // "Ничего не найдено" даже когда товар точно есть.
  const q = aliasSearch.trim().toLowerCase();
  const mismatchCount = products.filter(p => weightUnitMismatch(p.unit, !!p.priced_by_weight)).length;
  const filtered = products
    .filter(p => !q || p.name.toLowerCase().includes(q) || (p.display_name||'').toLowerCase().includes(q) || (p.code||'').includes(q))
    .filter(p => !onlyMismatch || weightUnitMismatch(p.unit, !!p.priced_by_weight));
  const withoutAlias = filtered.filter(p => !p.has_alias);
  const withAlias = filtered.filter(p => p.has_alias);

  return (
    <>
      {!desktop&&<p style={S.sectionTitle}>Псевдонимы товаров</p>}
      <div style={{maxWidth: desktop?720:"none"}}>
        <p style={{fontSize:14,color:C.textSub,marginTop:desktop?0:-8,marginBottom:12}}>
          Название из 1С меняется от поставки к поставке — задай здесь постоянное имя, которое увидят торгпреды.
        </p>
        {mismatchCount>0&&(
          <button
            onClick={()=>setOnlyMismatch(v=>!v)}
            style={{display:"block",width:"100%",textAlign:"left",marginBottom:12,padding:"10px 12px",borderRadius:10,border:`1px solid ${onlyMismatch?"#92400E":"#FDE68A"}`,background:onlyMismatch?"#92400E":"#FFFBEB",color:onlyMismatch?"#fff":"#92400E",fontSize:13,fontWeight:700,cursor:"pointer"}}
          >
            ⚠ {mismatchCount} {mismatchCount===1?'товар':'товаров'}: единица измерения из 1С не совпадает с галочкой "Весовой товар" — риск рассинхрона остатка. {onlyMismatch?'Показать все товары':'Показать только их'}
          </button>
        )}
        <input
          type="search"
          style={{...S.input,marginBottom:12}}
          placeholder="Поиск по названию или коду..."
          value={aliasSearch}
          onChange={e=>setAliasSearch(e.target.value)}
          autoComplete="off"
          name="alias-search"
        />
        {renderAliasSection({ id:"unset", title:"⚠️ Цены не установлены", badgeColor:C.red, list:withoutAlias })}
        {renderAliasSection({ id:"set", title:"✅ Цены установлены", badgeColor:C.green, list:withAlias })}
        {products.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}>Номенклатура ещё не синхронизирована из 1С</div>}
      </div>
    </>
  );
}

// Экранирование одной ячейки CSV — для downloadCsv (списковые отчёты:
// остатки, ведомость, сверка с 1С — см. ниже; накладная теперь выгружается
// настоящим .xlsx, см. downloadOrderWaybillXlsx). Разделитель — ";", а не
// запятая: Excel с русской локалью (Windows) определяет разделитель CSV по
// системному "разделителю списка", а он в ru-RU — ";" (запятая там
// зарезервирована под десятичную точку). С "," всё содержимое схлопывается
// в один столбец при открытии — так и было.
//
// Числа с точкой (JS-формат, например 14.1) Excel в русской локали не
// узнаёт как десятичную дробь (там точка не разделитель дроби) и вместо
// этого пытается угадать дату "день.месяц" — 14.1 превращается в "14
// октября". Сами цифры при этом верные, просто отображение ломается.
// Чиним так же, как и с разделителем колонок: настоящие числа отдаём с
// запятой вместо точки — тогда Excel читает их как число, а не как дату.
//
// Отдельная беда — текстовые ячейки, которые сами ПОХОЖИ на число/дату/
// формулу (см. csvLooksRisky): код номенклатуры "000040" Excel читает как
// число 40 и теряет ведущие нули, БИН "491219400991" (12 цифр) показывает
// в экспоненциальной записи "4,91E+11", дата "11.09.2026" превращается в
// настоящую Excel-дату и упирается в "####", если колонка узкая, а
// телефон вида "+7-775-593-95-75" Excel принимает за формулу (ячейка,
// начинающаяся с "+"/"-"/"="/"@" — всегда формула) и реально вычисляет её
// как арифметику: "+7-775-593-95-75" превращается в -1531. Все четыре —
// не наша конвертация чисел выше, а автоопределение типа самим Excel при
// открытии CSV, единственный надёжный способ его отключить — обернуть
// значение в ="..." (формула, которая для Excel гарантированно возвращает
// исходный текст как есть, без переинтерпретации).
function csvLooksRisky(s) {
  return /^[=+\-@]/.test(s) || /^\d{4,}$/.test(s) || /^\d{1,2}\.\d{1,2}\.\d{2,4}$/.test(s);
}
function csvEscapeCell(v) {
  if (typeof v === 'number') return String(v).replace('.', ',');
  let s = v == null ? '' : String(v);
  if (s && csvLooksRisky(s)) s = '="' + s.replace(/"/g, '""') + '"';
  return /[";\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
// BOM в начале — чтобы Excel сразу понял кодировку UTF-8 и не превратил
// кириллицу в кракозябры.
function downloadCsvText(filename, lines) {
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
// Скачать массив объектов как CSV (Excel открывает CSV нативно, без
// сторонних библиотек для .xlsx) — одна строка объектов на одинаковые
// колонки, как в списковых отчётах (остатки, ведомость, сверка с 1С).
function downloadCsv(filename, rows, columns) {
  const lines = [columns.map(c => csvEscapeCell(c.label)).join(';')];
  rows.forEach(r => lines.push(columns.map(c => csvEscapeCell(c.get(r))).join(';')));
  downloadCsvText(filename, lines);
}

// Отчёт "Движение остатков" — по просьбе владельца: "был остаток, торговый
// продал минус, остаток после заявки" отдельным экраном с выгрузкой в
// Excel, а не только раскрывающейся строкой в карточке товара (см.
// ProductHistoryToggle ниже — она осталась для быстрого взгляда по одному
// товару, этот отчёт — для полного списка за период). Ничего нового не
// пишем в базу — те же заявки, см. GET /api/stock-movements.
function StockMovementsReport({ onClose }) {
  const todayStr = new Date().toISOString().slice(0,10);
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [salesFilter, setSalesFilter] = useState('');
  const [driverFilter, setDriverFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET', `/api/stock-movements?from=${from}&to=${to}`);
      setRows(data);
    } catch(e) { setRows([]); }
    setLoading(false);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  // Список торговых/водителей/статусов — из самих строк за период, а не
  // фиксированный список: тогда в фильтре не будет пунктов, по которым всё
  // равно пусто.
  const salesOptions = useMemo(() => Array.from(new Set(rows.map(r=>r.sales_name).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ru')), [rows]);
  const driverOptions = useMemo(() => Array.from(new Set(rows.map(r=>r.driver_name).filter(Boolean))).sort((a,b)=>a.localeCompare(b,'ru')), [rows]);
  const statusOptions = useMemo(() => Array.from(new Set(rows.map(r=>r.status).filter(Boolean))), [rows]);
  useEffect(() => {
    if (salesFilter && !salesOptions.includes(salesFilter)) setSalesFilter('');
  }, [salesOptions, salesFilter]);
  useEffect(() => {
    if (driverFilter && !driverOptions.includes(driverFilter)) setDriverFilter('');
  }, [driverOptions, driverFilter]);
  useEffect(() => {
    if (statusFilter && !statusOptions.includes(statusFilter)) setStatusFilter('');
  }, [statusOptions, statusFilter]);

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter(r => !q || (r.name||'').toLowerCase().includes(q) || (r.code||'').includes(q))
    .filter(r => !salesFilter || r.sales_name===salesFilter)
    .filter(r => !driverFilter || r.driver_name===driverFilter)
    .filter(r => !statusFilter || r.status===statusFilter);

  const numLabel = (v, unit) => `${v}${unit?' '+unit:''}`;
  const money = v => Number(v||0).toLocaleString('ru-RU');

  const exportCsv = () => downloadCsv(
    `ostatki_dvizhenie_${from}_${to}.csv`,
    filtered,
    [
      { label: 'Дата', get: r => r.date },
      { label: 'Заявка №', get: r => r.order_id },
      { label: 'Статус', get: r => SL[r.status]||r.status },
      { label: 'Контрагент', get: r => r.client_name || '' },
      { label: 'Торговый', get: r => r.sales_name || '' },
      { label: 'Водитель', get: r => r.driver_name || '' },
      { label: 'Код', get: r => r.code },
      { label: 'Товар', get: r => r.name },
      { label: 'Кол-во', get: r => numLabel(r.qty, r.unit) },
      { label: 'Сумма', get: r => r.sum },
      { label: 'Остаток до', get: r => r.balance_before==null ? '' : numLabel(r.balance_before, r.unit) },
      { label: 'Списано', get: r => r.balance_after==null ? '' : numLabel(r.qty, r.unit) },
      { label: 'Остаток после', get: r => r.balance_after==null ? '' : numLabel(r.balance_after, r.unit) },
    ]
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}}>
      <div style={{background:C.white,margin:"16px",borderRadius:16,padding:20,maxWidth:1200,marginLeft:"auto",marginRight:"auto",border:`1px solid ${C.border}`}}>
        <div style={{...S.row,marginBottom:6}}>
          <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>📊 Движение остатков и заявки</p>
          <button style={S.btnSecondary} onClick={onClose}>✕</button>
        </div>
        <p style={{margin:"0 0 14px",fontSize:13,color:C.textFaint}}>
          Все заявки за период (кроме отозванных) — контрагент, торговый, водитель, сумма. Столбцы "Остаток до/Списано/Остаток после" заполнены только у реально доставленных заявок — только тогда товар физически списался со склада.
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10}}>
          <div>
            <label style={S.label}>С</label>
            <input type="date" style={S.input} value={from} onChange={e=>setFrom(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>По</label>
            <input type="date" style={S.input} value={to} onChange={e=>setTo(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <label style={S.label}>Товар (название/код)</label>
            <input style={S.input} placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>Торговый</label>
            <select style={{...S.select,width:"auto",minWidth:180}} value={salesFilter} onChange={e=>setSalesFilter(e.target.value)}>
              <option value="">Все торговые</option>
              {salesOptions.map(name=><option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Водитель</label>
            <select style={{...S.select,width:"auto",minWidth:180}} value={driverFilter} onChange={e=>setDriverFilter(e.target.value)}>
              <option value="">Все водители</option>
              {driverOptions.map(name=><option key={name} value={name}>{name}</option>)}
            </select>
          </div>
          <div>
            <label style={S.label}>Статус доставки</label>
            <select style={{...S.select,width:"auto",minWidth:160}} value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}>
              <option value="">Все статусы</option>
              {statusOptions.map(st=><option key={st} value={st}>{SL[st]||st}</option>)}
            </select>
          </div>
        </div>
        <div style={{...S.row,marginBottom:10}}>
          <p style={{margin:0,fontSize:14,color:C.textSub}}>Строк: {filtered.length}</p>
          <button style={{...S.btnPrimary,width:"auto",padding:"9px 16px",fontSize:14}} onClick={exportCsv} disabled={filtered.length===0}>⬇ Скачать в Excel</button>
        </div>
        {loading?<div style={S.loadingWrap}>Загрузка...</div>
          :filtered.length===0?<div style={{textAlign:"center",padding:"30px 0",color:C.textFaint}}>За этот период заявок не найдено</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,textAlign:"left"}}>
                  <th style={{padding:"6px 8px"}}>Дата</th>
                  <th style={{padding:"6px 8px"}}>№</th>
                  <th style={{padding:"6px 8px"}}>Статус</th>
                  <th style={{padding:"6px 8px"}}>Контрагент</th>
                  <th style={{padding:"6px 8px"}}>Торговый</th>
                  <th style={{padding:"6px 8px"}}>Водитель</th>
                  <th style={{padding:"6px 8px"}}>Товар</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Кол-во</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Сумма</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Остаток до</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Списано</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Остаток после</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r,i)=>(
                  <tr key={r.order_id+'_'+r.code+'_'+i} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>{r.date}</td>
                    <td style={{padding:"6px 8px"}}>{r.order_id}</td>
                    <td style={{padding:"6px 8px",whiteSpace:"nowrap"}}>
                      <span style={{background:SB[r.status]||C.surface,color:SC[r.status]||C.textSub,padding:"2px 8px",borderRadius:20,fontSize:12,fontWeight:700}}>{SL[r.status]||r.status}</span>
                    </td>
                    <td style={{padding:"6px 8px"}}>{r.client_name||'—'}</td>
                    <td style={{padding:"6px 8px"}}>{r.sales_name||'—'}</td>
                    <td style={{padding:"6px 8px"}}>{r.driver_name||'—'}</td>
                    <td style={{padding:"6px 8px"}}>{r.name}<div style={{color:C.textFaint,fontSize:11}}>{r.code}</div></td>
                    <td style={{padding:"6px 8px",textAlign:"right",whiteSpace:"nowrap"}}>{numLabel(r.qty,r.unit)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",whiteSpace:"nowrap"}}>{money(r.sum)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{r.balance_before==null?'—':numLabel(r.balance_before,r.unit)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:r.balance_after==null?C.textFaint:C.red}}>{r.balance_after==null?'—':`−${numLabel(r.qty,r.unit)}`}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700}}>{r.balance_after==null?'—':numLabel(r.balance_after,r.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}

// Отчёт "Ведомость" — по просьбе владельца: приход/расход/остаток за период
// по товару, без контрагентов/торговых, как материальная ведомость в 1С
// (тот же формат, каким 1С сам выгружает остатки — владелец сверял именно
// такую выгрузку с сайтом). В отличие от StockMovementsReport выше (только
// списание по доставленным заявкам) здесь виден и приход — синк из 1С,
// возвраты, отмена продажи кассы — не только расход. См. GET
// /api/reports/material-statement — лента, по которой строится этот отчёт,
// копится только вперёд с момента, как её завели, поэтому за периоды до
// этого приход/расход будут нулями, даже если остаток на самом деле менялся.
function MaterialStatementReport({ onClose }) {
  const todayStr = new Date().toISOString().slice(0,10);
  const [from, setFrom] = useState(todayStr);
  const [to, setTo] = useState(todayStr);
  const [search, setSearch] = useState('');
  const [hideEmpty, setHideEmpty] = useState(false);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiCall('GET', `/api/reports/material-statement?from=${from}&to=${to}`);
      setRows(data);
    } catch(e) { setRows([]); }
    setLoading(false);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const q = search.trim().toLowerCase();
  const filtered = rows
    .filter(r => !q || (r.name||'').toLowerCase().includes(q) || (r.code||'').includes(q))
    .filter(r => !hideEmpty || r.income || r.outcome);

  const numLabel = (v, unit) => `${v}${unit?' '+unit:''}`;

  const exportCsv = () => downloadCsv(
    `vedomost_${from}_${to}.csv`,
    filtered,
    [
      { label: 'Код', get: r => r.code },
      { label: 'Товар', get: r => r.name },
      { label: 'Ед.', get: r => r.unit || 'кор' },
      { label: 'Начальный остаток', get: r => r.opening },
      { label: 'Приход', get: r => r.income },
      { label: 'Расход', get: r => r.outcome },
      { label: 'Корректировка 1С', get: r => r.correction || 0 },
      { label: 'Конечный остаток', get: r => r.closing },
    ]
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}}>
      <div style={{background:C.white,margin:"16px",borderRadius:16,padding:20,maxWidth:1000,marginLeft:"auto",marginRight:"auto",border:`1px solid ${C.border}`}}>
        <div style={{...S.row,marginBottom:6}}>
          <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>📋 Ведомость по товару</p>
          <button style={S.btnSecondary} onClick={onClose}>✕</button>
        </div>
        <p style={{margin:"0 0 14px",fontSize:13,color:C.textFaint}}>
          Начальный остаток / приход / расход / конечный остаток за период — как материальная ведомость в 1С, без контрагентов и торговых. Копится с момента, как эту ленту завели на сайте — за более ранние периоды приход/расход будут нулями (виден только текущий остаток).
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:10,alignItems:"flex-end"}}>
          <div>
            <label style={S.label}>С</label>
            <input type="date" style={S.input} value={from} onChange={e=>setFrom(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>По</label>
            <input type="date" style={S.input} value={to} onChange={e=>setTo(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:180}}>
            <label style={S.label}>Товар (название/код)</label>
            <input style={S.input} placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)}/>
          </div>
          <label style={{display:"flex",alignItems:"center",gap:6,fontSize:13,color:C.textSub,paddingBottom:9}}>
            <input type="checkbox" checked={hideEmpty} onChange={e=>setHideEmpty(e.target.checked)}/>
            Скрыть без движения
          </label>
        </div>
        <div style={{...S.row,marginBottom:10}}>
          <p style={{margin:0,fontSize:14,color:C.textSub}}>Строк: {filtered.length}</p>
          <button style={{...S.btnPrimary,width:"auto",padding:"9px 16px",fontSize:14}} onClick={exportCsv} disabled={filtered.length===0}>⬇ Скачать в Excel</button>
        </div>
        {loading?<div style={S.loadingWrap}>Загрузка...</div>
          :filtered.length===0?<div style={{textAlign:"center",padding:"30px 0",color:C.textFaint}}>Ничего не найдено</div>
          :<div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,textAlign:"left"}}>
                  <th style={{padding:"6px 8px"}}>Товар</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Начальный остаток</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Приход</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Расход</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}} title="Отрицательная правка остатка синком из 1С (не продажа/доставка) — например, когда в 1С ещё не проведена реализация и присланный остаток ниже факта на сайте">Корректировка 1С</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Конечный остаток</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r=>(
                  <tr key={r.code} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"6px 8px"}}>{r.name}<div style={{color:C.textFaint,fontSize:11}}>{r.code}</div></td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{numLabel(r.opening,r.unit)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:C.green,fontWeight:700}}>{r.income?`+${numLabel(r.income,r.unit)}`:numLabel(0,r.unit)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:C.red,fontWeight:700}}>{r.outcome?`−${numLabel(r.outcome,r.unit)}`:numLabel(0,r.unit)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:r.correction?C.textFaint:undefined}}>{r.correction?numLabel(r.correction,r.unit):'—'}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700}}>{numLabel(r.closing,r.unit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  );
}

// Разбор xlsx-выгрузки "Материальная ведомость" из 1С — колонки ищем по
// заголовкам, а не по фиксированному номеру: "Код" отмечает нужную строку
// шапки, "Итого приход"/"Итого расход" — нужные столбцы (их "Количество"
// лежит ровно в той же колонке, где начинается объединённая шапка — так
// устроен сам шаблон 1С, см. разбор реальной выгрузки владельца). Если
// шаблон в 1С когда-нибудь поменяют — тут сразу понятная ошибка, а не тихо
// неверные цифры.
function parse1cVedomost(workbook) {
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: null });
  let headerRow = -1;
  for (let i = 0; i < data.length; i++) {
    if (data[i] && String(data[i][4] || '').trim() === 'Код') { headerRow = i; break; }
  }
  if (headerRow === -1) {
    throw new Error('Не нашёл колонку "Код" в файле — это не похоже на материальную ведомость 1С в привычном формате');
  }
  const incomeCol = data[headerRow].findIndex(v => String(v||'').trim() === 'Итого приход');
  const outcomeCol = data[headerRow].findIndex(v => String(v||'').trim() === 'Итого расход');
  if (incomeCol === -1 || outcomeCol === -1) {
    throw new Error('Не нашёл колонки "Итого приход"/"Итого расход" в файле');
  }
  const rows = [];
  for (let i = headerRow + 2; i < data.length; i++) {
    const row = data[i];
    if (!row) continue;
    if (String(row[0] || '').trim() === 'Итого') break;
    const code = row[4];
    if (!code) continue;
    rows.push({
      code: String(code).trim(),
      name: row[1] || '',
      unit: (row[5] || '').toString().trim(),
      income: Number(row[incomeCol]) || 0,
      outcome: Number(row[outcomeCol]) || 0,
    });
  }
  return rows;
}

// Сверка с 1С — по просьбе владельца: раньше это делали вручную (сюда
// присылали выгрузку из 1С и отдельно CSV с сайта, сверка была на моей
// стороне). Теперь сайт делает это сам: парсит xlsx из 1С прямо в браузере
// (библиотека XLSX подключена в index.html) и шлёт на сервер уже готовый
// массив строк — POST /api/reports/reconcile-1c сверяет их с собственной
// версией той же ведомости (computeMaterialStatementRows в server.js — то,
// что сайт реально доставил за период). Список — это как раз то, по каким
// товарам в 1С не проводятся реализации ("не хватает остатка") и где
// перепутаны единицы измерения (кг/шт).
function Reconcile1CReport({ onClose }) {
  const todayStr = new Date().toISOString().slice(0,10);
  const monthAgoStr = new Date(Date.now() - 30*86400000).toISOString().slice(0,10);
  const [from, setFrom] = useState(monthAgoStr);
  const [to, setTo] = useState(todayStr);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState(null);

  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setError('');
    setRows(null);
    if (typeof XLSX === 'undefined') {
      setError('Библиотека для чтения Excel не загрузилась — проверь интернет-соединение и обнови страницу');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const c1cRows = parse1cVedomost(wb);
      if (c1cRows.length === 0) throw new Error('В файле не нашлось ни одной строки с товаром');
      setLoading(true);
      const result = await apiCall('POST', '/api/reports/reconcile-1c', { from, to, rows: c1cRows });
      setRows(result);
    } catch (err) {
      setError(err.message || String(err));
    }
    setLoading(false);
    e.target.value = '';
  };

  const numLabel = (v, unit) => `${v}${unit?' '+unit:''}`;

  const exportCsv = () => downloadCsv(
    `sverka_1c_${from}_${to}.csv`,
    rows || [],
    [
      { label: 'Код', get: r => r.code },
      { label: 'Товар', get: r => r.name },
      { label: 'Ед. на сайте', get: r => r.unit_site },
      { label: 'Ед. в 1С', get: r => r.unit_1c },
      { label: 'Расход на сайте', get: r => r.outcome_site },
      { label: 'Расход в 1С', get: r => r.outcome_1c },
      { label: 'Не хватает в 1С', get: r => r.shortfall },
      { label: 'из них корректировка 1С (не продажа)', get: r => r.correction_site || 0 },
    ]
  );

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}}>
      <div style={{background:C.white,margin:"16px",borderRadius:16,padding:20,maxWidth:1100,marginLeft:"auto",marginRight:"auto",border:`1px solid ${C.border}`}}>
        <div style={{...S.row,marginBottom:6}}>
          <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>🔍 Сверка с 1С</p>
          <button style={S.btnSecondary} onClick={onClose}>✕</button>
        </div>
        <p style={{margin:"0 0 14px",fontSize:13,color:C.textFaint}}>
          Загрузи xlsx-выгрузку "Материальная ведомость" из 1С за период — сайт сам сравнит со своими данными и покажет, где 1С не досчиталась (обычно — непроведённые реализации, "не хватает остатка") и где перепутаны единицы измерения.
        </p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12,alignItems:"flex-end"}}>
          <div>
            <label style={S.label}>С</label>
            <input type="date" style={S.input} value={from} onChange={e=>setFrom(e.target.value)}/>
          </div>
          <div>
            <label style={S.label}>По</label>
            <input type="date" style={S.input} value={to} onChange={e=>setTo(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:220}}>
            <label style={S.label}>Файл из 1С (.xlsx)</label>
            <input type="file" accept=".xlsx" style={S.input} onChange={onFile}/>
          </div>
        </div>
        {error&&<div style={{...S.card,background:C.redSoft,color:C.red,padding:12,marginBottom:12,fontSize:13,fontWeight:600}}>{error}</div>}
        {loading&&<div style={S.loadingWrap}>Сверяю...</div>}
        {!loading&&rows&&rows.length===0&&<div style={{textAlign:"center",padding:"30px 0",color:C.green,fontWeight:700}}>✓ Расхождений не найдено — всё сходится</div>}
        {!loading&&rows&&rows.length>0&&<>
          <div style={{...S.row,marginBottom:10}}>
            <p style={{margin:0,fontSize:14,color:C.textSub}}>Расхождений: {rows.length}</p>
            <button style={{...S.btnPrimary,width:"auto",padding:"9px 16px",fontSize:14}} onClick={exportCsv}>⬇ Скачать в Excel</button>
          </div>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
              <thead>
                <tr style={{borderBottom:`2px solid ${C.border}`,textAlign:"left"}}>
                  <th style={{padding:"6px 8px"}}>Товар</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Расход на сайте</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Расход в 1С</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}}>Не хватает в 1С</th>
                  <th style={{padding:"6px 8px",textAlign:"right"}} title="Часть расхода на сайте за период — не продажа/доставка, а отрицательная правка остатка синком из 1С (например, в 1С ещё не проведена реализация). Уже вычтена из shortfall слева — помогает понять, откуда взялось расхождение">Из них коррект. 1С</th>
                  <th style={{padding:"6px 8px"}}>Ед.изм.</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r=>(
                  <tr key={r.code} style={{borderBottom:`1px solid ${C.border}`}}>
                    <td style={{padding:"6px 8px"}}>{r.name}<div style={{color:C.textFaint,fontSize:11}}>{r.code}</div></td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{numLabel(r.outcome_site,r.unit_site)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right"}}>{numLabel(r.outcome_1c,r.unit_1c)}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",fontWeight:700,color:r.shortfall>0?C.red:(r.shortfall<0?C.green:C.textFaint)}}>{r.shortfall>0?'+':''}{r.shortfall}</td>
                    <td style={{padding:"6px 8px",textAlign:"right",color:C.textFaint}}>{r.correction_site?numLabel(r.correction_site,r.unit_site):'—'}</td>
                    <td style={{padding:"6px 8px"}}>{r.unit_mismatch?<span style={{color:"#92400E",fontWeight:700}}>⚠ {r.unit_site||'—'} / {r.unit_1c||'—'}</span>:(r.unit_site||r.unit_1c||'')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}
      </div>
    </div>
  );
}

// Экран "Остатки на складе" — тот же, что у зав. склада (см.
// WarehouseCabinet), вынесен в отдельный самодостаточный компонент по
// той же причине, что и ProductAliasesPanel выше: старшему торговому
// представителю нужен тот же экран у себя в кабинете.
// История движения по товару — раскрывается прямо в карточке на "Остатках"
// (см. StockPanel и её копию в WarehouseCabinet ниже). Список заявок,
// которые трогали этот код (см. GET /api/products/:code/history) — ничего
// не хранится отдельно, это уже существующие данные заявок, просто
// собранные по коду товара, чтобы было видно "кто и сколько убавил".
// Построчная лента движения по товару — "было / пришло / списалось / стало"
// одно событие в одной строке таблицы, как настоящая ведомость (см. GET
// /api/products/:code/ledger). Заменила прежний список заявок одной строкой
// текста на каждую (жалоба владельца: "в таблице хаос") — та версия к тому
// же не показывала приходы из 1С вовсе, только продажи.
function ProductHistoryToggle({ code }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    try { setData(await apiCall('GET', `/api/products/${code}/ledger`)); } catch(e) { setData({ unit: '', entries: [] }); }
    setLoading(false);
  };
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && data === null) load();
  };
  const numLabel = (v, unit) => `${v}${unit?' '+unit:''}`;
  return (
    <div style={{marginTop:8}}>
      <button type="button" onClick={toggle} style={{background:"none",border:"none",padding:0,color:C.navy,fontSize:13,fontWeight:600,cursor:"pointer",textDecoration:"underline"}}>
        {open?"Скрыть историю движения":"История движения"}
      </button>
      {open&&(loading
        ? <p style={{margin:"6px 0 0",fontSize:13,color:C.textFaint}}>Загрузка...</p>
        : (data&&data.entries.length>0)
          ? <div style={{marginTop:8,overflowX:"auto"}}>
              <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
                <thead>
                  <tr style={{borderBottom:`2px solid ${C.border}`,textAlign:"left"}}>
                    <th style={{padding:"4px 6px",whiteSpace:"nowrap"}}>Дата</th>
                    <th style={{padding:"4px 6px"}}>Событие</th>
                    <th style={{padding:"4px 6px",textAlign:"right"}}>Приход</th>
                    <th style={{padding:"4px 6px",textAlign:"right"}}>Расход</th>
                    <th style={{padding:"4px 6px",textAlign:"right"}}>Остаток стал</th>
                  </tr>
                </thead>
                <tbody>
                  {data.entries.map((e,i)=>(
                    <tr key={i} style={{borderBottom:`1px solid ${C.border}`}}>
                      <td style={{padding:"4px 6px",whiteSpace:"nowrap"}}>{e.date}</td>
                      <td style={{padding:"4px 6px"}}>{e.label}</td>
                      <td style={{padding:"4px 6px",textAlign:"right",color:C.green,fontWeight:e.income?700:400}}>{e.income?`+${numLabel(e.income,data.unit)}`:'—'}</td>
                      <td style={{padding:"4px 6px",textAlign:"right",color:C.red,fontWeight:e.outcome?700:400}}>{e.outcome?`−${numLabel(e.outcome,data.unit)}`:'—'}</td>
                      <td style={{padding:"4px 6px",textAlign:"right",fontWeight:700}}>{numLabel(e.balance_after,data.unit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          : <p style={{margin:"6px 0 0",fontSize:13,color:C.textFaint}}>Движения по этому товару ещё не зафиксировано (лента копится с 10 сентября 2026)</p>
      )}
    </div>
  );
}

function StockPanel() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);

  const loadProducts = useCallback(async () => {
    try { setProducts(await fetch('/api/products').then(r => r.json())); } catch(e) {}
    setLoadingProducts(false);
  }, []);
  useEffect(() => { loadProducts(); }, []);
  useRefetchOnVisible(loadProducts);

  const stockStats = products.reduce((acc,p)=>{
    acc.total++;
    // Та же проверка, что решает "в наличии"/"нет" у каждой карточки ниже
    // (stockIsOut учитывает вес для весового товара) — раньше здесь была
    // отдельная упрощённая проверка по p.stock>0, которая для весового
    // товара всегда ложная (1С коробов для него не шлёт вовсе, см.
    // /api/stock/sync), и в сводке он ошибочно уходил в "нет в наличии",
    // хотя в списке ниже та же позиция показана в наличии по весу.
    if (!stockIsOut(p)) acc.inStock++; else acc.outOfStock++;
    return acc;
  }, {total:0,inStock:0,outOfStock:0});

  const stockCategories = Array.from(new Set(products.map(p=>p.group).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

  const q = stockSearch.trim().toLowerCase();
  const filteredProducts = products
    .filter(p => !q || (p.display_name||p.name||'').toLowerCase().includes(q) || (p.code||'').includes(q))
    .filter(p => !stockCategory || p.group===stockCategory)
    .filter(p => !hideEmpty || !stockIsOut(p))
    .slice()
    .sort((a,b)=>{
      const aOut = stockIsOut(a), bOut = stockIsOut(b);
      if (aOut!==bOut) return aOut?1:-1;
      return (a.display_name||a.name||'').localeCompare(b.display_name||b.name||'');
    });

  return (
    <>
      {showMovements&&<StockMovementsReport onClose={()=>setShowMovements(false)}/>}
      {showStatement&&<MaterialStatementReport onClose={()=>setShowStatement(false)}/>}
      {showReconcile&&<Reconcile1CReport onClose={()=>setShowReconcile(false)}/>}
      <div style={{...S.row,marginBottom:4}}>
        <p style={{...S.sectionTitle,margin:0}}>Остатки на складе <span style={{fontWeight:400,fontSize:13,color:C.textFaint}}>(только из 1С)</span></p>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={{...S.btnOutline,width:"auto",padding:"6px 12px",fontSize:13}} onClick={()=>setShowMovements(true)}>📊 Отчёт по движению</button>
          <button style={{...S.btnOutline,width:"auto",padding:"6px 12px",fontSize:13}} onClick={()=>setShowStatement(true)}>📋 Ведомость</button>
          <button style={{...S.btnOutline,width:"auto",padding:"6px 12px",fontSize:13}} onClick={()=>setShowReconcile(true)}>🔍 Сверка с 1С</button>
        </div>
      </div>
      {!loadingProducts && products.length>0 && (
        <div style={S.statsRow}>
          <div style={S.statCard()}><p style={S.statNum()}>{stockStats.total}</p><p style={S.statLabel}>Всего позиций</p></div>
          <div style={S.statCard()}><p style={S.statNum(C.green)}>{stockStats.inStock}</p><p style={S.statLabel}>В наличии</p></div>
          <div style={S.statCard()}><p style={S.statNum(C.red)}>{stockStats.outOfStock}</p><p style={S.statLabel}>Нет в наличии</p></div>
        </div>
      )}
      <input
        style={{...S.input,marginBottom:12}}
        placeholder="Поиск по названию или коду..."
        value={stockSearch}
        onChange={e=>setStockSearch(e.target.value)}
      />
      <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
        {stockCategories.length>1&&<>
          <button onClick={()=>setStockCategory("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${stockCategory===""?C.navy:C.border}`,background:stockCategory===""?C.navy:C.white,color:stockCategory===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все разделы</button>
          {stockCategories.map(cat=>(
            <button key={cat} onClick={()=>setStockCategory(cat)} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${stockCategory===cat?C.navy:C.border}`,background:stockCategory===cat?C.navy:C.white,color:stockCategory===cat?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{cat}</button>
          ))}
        </>}
        <button onClick={()=>setHideEmpty(h=>!h)} style={{marginLeft:"auto",padding:"5px 12px",borderRadius:99,border:`1px solid ${hideEmpty?C.green:C.border}`,background:hideEmpty?"#EAF5EE":C.white,color:hideEmpty?C.green:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{hideEmpty?"✓ ":""}Только в наличии</button>
      </div>
      {loadingProducts?<div style={S.loadingWrap}>Загрузка...</div>
        :filteredProducts.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.textFaint}}>Ничего не найдено</div>
        :filteredProducts.map(p=>{
          const out = stockIsOut(p);
          const amt = stockAmount(p);
          const low = !out && amt!=null && amt<=5;
          const dot = out?C.red:(low?C.amber:C.green);
          const label = stockLabel(p);
          return (
            <div key={p.code} style={{...S.card,opacity:out?0.7:1}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                  <span style={{width:9,height:9,borderRadius:"50%",background:dot,flexShrink:0}}/>
                  <div style={{minWidth:0}}>
                    <p style={{...S.cardTitle,overflowWrap:"anywhere"}}>{p.display_name||p.name}</p>
                    <p style={S.cardSub}>Код: {p.code}{p.group?' · '+p.group:''}</p>
                  </div>
                </div>
                <div style={{textAlign:"right",flexShrink:0}}>
                  <span style={{display:"inline-block",padding:"4px 10px",borderRadius:8,fontWeight:800,fontFamily:FH,fontSize:17,background:out?C.redSoft:(low?"#FEF3C7":"#EAF5EE"),color:out?C.red:(low?C.amber:C.green)}}>{label!=null?label:'—'}</span>
                  {!p.priced_by_weight&&<p style={{margin:"4px 0 0",fontSize:13,color:C.textFaint}}>{p.stock_unit||''}</p>}
                </div>
              </div>
              {p.stock_reserved>0&&<p style={{margin:"6px 0 0",fontSize:13,color:C.textFaint}}>Из 1С: {round2(p.stock_raw)} · в заявках: {round2(p.stock_reserved)} · доступно: {round2(p.stock)}</p>}
              {p.stock_weight_kg_reserved>0&&<p style={{margin:"6px 0 0",fontSize:13,color:C.textFaint}}>Из 1С: {round2(p.stock_weight_kg)} кг · в заявках: {round2(p.stock_weight_kg_reserved)} кг · доступно: {round2(Math.max(0,p.stock_weight_kg-p.stock_weight_kg_reserved))} кг</p>}
              <ProductHistoryToggle code={p.code}/>
            </div>
          );
        })
      }
    </>
  );
}

// Раздел (для каталога) и фото — отдельно от цен, во вкладке "Каталог"
// (её видят и admin, и manager — они уже используют один и тот же
// AdminCabinet). Название товара здесь не редактируется — это делает
// "Товары" (алиас для сайта), а тут только то, что видно покупателю
// при выборе: картинка и раздел.
const ProductCatalogCard = memo(function ProductCatalogCard({ p, category, barcode, categoryOptions, saving, onChangeCategory, onSaveCategory, onUploadPhoto, onRemovePhoto }) {
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputId = `catalog-photo-input-${p.code}`;
  const categoryListId = `catalog-category-options-${p.code}`;

  const onPhotoSelected = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setPhotoError("");
    setPhotoUploading(true);
    try {
      const dataUrl = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = ev => resolve(ev.target.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const compressed = await compressImage(dataUrl, 640, 0.75);
      await onUploadPhoto(p.code, compressed);
    } catch(err) {
      setPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setPhotoUploading(false);
  };

  const removePhoto = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Удалить фото товара?')) return;
    setPhotoError("");
    setPhotoUploading(true);
    try {
      await onRemovePhoto(p.code);
    } catch(err) {
      setPhotoError(err.message || 'Не удалось удалить фото');
    }
    setPhotoUploading(false);
  };

  return (
    <div style={{...S.card, padding:10, marginBottom:0, display:"flex", flexDirection:"column"}}>
      <div style={{position:"relative",width:"100%",aspectRatio:"1"}}>
        <label htmlFor={fileInputId} style={{width:"100%",height:"100%",borderRadius:8,cursor:"pointer",overflow:"hidden",background:C.white,border:`1px solid ${C.border}`,display:"flex",alignItems:"center",justifyContent:"center",padding:8,boxSizing:"border-box"}}>
          {photoUploading
            ? <span style={{fontSize:14,color:C.textFaint}}>...</span>
            : p.photo
              ? <img src={p.photo} style={{width:"100%",height:"100%",objectFit:"contain"}}/>
              : <span style={{fontSize:40,color:C.textFaint}}>📷</span>}
        </label>
        {p.photo && !photoUploading && (
          <button onClick={removePhoto} title="Удалить фото" style={{position:"absolute",top:6,right:6,width:22,height:22,borderRadius:"50%",border:`1px solid ${C.border}`,background:C.white,color:C.red,fontSize:14,lineHeight:1,cursor:"pointer",padding:0}}>✕</button>
        )}
      </div>
      <input id={fileInputId} type="file" accept="image/*" style={{display:"none"}} onChange={onPhotoSelected}/>
      <div style={{marginTop:8,marginBottom:8,minWidth:0}}>
        <div style={{display:"flex",justifyContent:"space-between",gap:6,marginBottom:2}}>
          <span style={{fontSize:13,color:C.textFaint}}>Код 1С: {p.code}</span>
          <span style={{fontSize:14,fontWeight:800,fontFamily:FH,color:C.navy,whiteSpace:"nowrap"}}>{p.price1>0?p.price1.toLocaleString()+' ₸':'—'}</span>
        </div>
        <div style={{fontSize:15,fontWeight:600,color:C.textMid}}>{p.name}</div>
        {photoError&&<div style={{fontSize:13,color:C.red,marginTop:2}}>{photoError}</div>}
      </div>
      <div style={{display:"flex",flexDirection:"column",gap:6,marginTop:"auto"}}>
        <input
          style={{...S.input,padding:"7px 10px",fontSize:15}}
          placeholder="Штрихкод"
          value={barcode}
          onChange={e=>onChangeCategory(p.code,'barcode',e.target.value)}
        />
        <div style={{display:"flex",gap:6}}>
          <input
            style={{...S.input,padding:"7px 10px",fontSize:15,flex:1}}
            placeholder="Раздел каталога (например: Посуда)"
            value={category}
            list={categoryListId}
            onChange={e=>onChangeCategory(p.code,'category',e.target.value)}
          />
          <button
            style={{...S.btnPrimary, padding:"7px 14px", fontSize:14, marginTop:0, boxShadow:"none", opacity: saving?0.5:1, width:"auto", whiteSpace:"nowrap"}}
            disabled={saving}
            onClick={()=>onSaveCategory(p)}
          >Сохр.</button>
        </div>
      </div>
      <datalist id={categoryListId}>
        {categoryOptions.map(c=><option key={c} value={c}/>)}
      </datalist>
    </div>
  );
});

// ===== CashCore (локальное кассовое ядро E-Kassa/ОФД) =====
// Настройки (адрес ядра, ID кассы в ОФД, PIN/токен кассира) — в
// localStorage, а не в общих данных приложения: это привязано к
// конкретному компьютеру-кассе, а не к аккаунту/организации. Кассовое
// ядро почти всегда стоит на другом компьютере, чем сервер приложения (касса
// в торговой точке, сервер — в облаке), поэтому запросы к нему идёт
// напрямую из браузера кассира на 127.0.0.1, а не через бэкенд — бэкенд
// физически не имеет сетевого доступа к кассе в магазине.
const CASHCORE_STORAGE_KEY = 'zhaiyk_aktau_cashcore_settings';
function getCashcoreSettings() {
  try {
    const raw = localStorage.getItem(CASHCORE_STORAGE_KEY);
    return raw ? JSON.parse(raw) : { url: 'http://127.0.0.1:8080', kkmOfdId: '', auth: '' };
  } catch { return { url: 'http://127.0.0.1:8080', kkmOfdId: '', auth: '' }; }
}
function saveCashcoreSettings(s) {
  try { localStorage.setItem(CASHCORE_STORAGE_KEY, JSON.stringify(s)); } catch {}
}

// Пробивает фискальный чек методом TradeOperation. Осознанно не шлёт
// оплату "в долг" — в документации CashCore нет типа платежа под остаток
// долга (только PAYMENT_CASH/PAYMENT_CARD/PAYMENT_MOBILE), поэтому чек с
// неполной оплатой рискует не соответствовать требованиям ОФД; вызывающий
// код (submit в PosSaleModal) сам решает не звать эту функцию, если есть
// remainder>0, и просит пробить чек вручную после погашения долга.
async function fiscalizeSale(sale, operation = 2) {
  const s = getCashcoreSettings();
  if (!s.url || !s.kkmOfdId) {
    throw new Error('ККМ не настроена — заполните адрес ядра и ID кассы в ⚙ настройках кассы');
  }
  const payments = [];
  if (sale.payment_cash > 0) payments.push({ type: 0, sum: sale.payment_cash });
  if (sale.payment_qr > 0) payments.push({ type: 1, sum: sale.payment_qr });
  const body = {
    kkm_ofd_id: Number(s.kkmOfdId),
    is_printable: true,
    // 2 = OPERATION_SELL (продажа), 3 = OPERATION_SELL_RETURN (возврат
    // продажи — см. voidSale в AdminCabinet: чек возврата для уже
    // пробитой продажи, теми же позициями и оплатой).
    operation,
    items: (sale.items || []).map(it => ({
      type: 1, // ItemTypeEnum.ITEM_TYPE_COMMODITY
      commodity: { name: it.name, quantity: it.qty, price: it.price, sum: it.qty * it.price },
    })),
    payments,
  };
  let resp;
  try {
    resp = await fetch(`${s.url.replace(/\/$/, '')}/TradeOperation`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(s.auth ? { Authorization: s.auth } : {}) },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new Error(`Кассовое ядро недоступно по адресу ${s.url}. Проверьте, что CashCore запущен на этом компьютере, и что браузер не блокирует запрос (см. "смешанный контент", если сайт открыт по https)`);
  }
  const data = await resp.json().catch(() => null);
  if (!resp.ok || !data || data.response_code !== 0) {
    const msg = data && data.response_data && (data.response_data.message || (typeof data.response_data === 'string' ? data.response_data : JSON.stringify(data.response_data)));
    throw new Error(msg || `ККМ вернула ошибку (HTTP ${resp.status})`);
  }
  const r = data.response_data;
  return { fiscal_id: r.fiscal_id, qr_code: r.qr_code, ofd_name: r.ofd_name };
}

function CashcoreSettingsForm({ initial, onSave, onClose }) {
  const [url, setUrl] = useState(initial.url || 'http://127.0.0.1:8080');
  const [kkmOfdId, setKkmOfdId] = useState(initial.kkmOfdId || '');
  const [auth, setAuth] = useState(initial.auth || '');
  return (
    <div style={{...S.card, marginBottom:16, background:C.surface}}>
      <p style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:C.navy}}>⚙ Настройка кассового ядра (CashCore)</p>
      <p style={{fontSize:13,color:C.textSub,marginBottom:10}}>
        Заполняется один раз на этом компьютере (данные не уходят на сервер, хранятся только в этом браузере).
        Адрес — обычно http://127.0.0.1:8080, если CashCore запущен на этом же ПК. ID кассы и токен/ПИН — из
        конфигуратора CashCoreConfig и личного кабинета ОФД.
      </p>
      <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:10}}>
        <input style={{...S.input,padding:"7px 10px",fontSize:15}} placeholder="Адрес CashCore (http://127.0.0.1:8080)" value={url} onChange={e=>setUrl(e.target.value)}/>
        <input style={{...S.input,padding:"7px 10px",fontSize:15}} placeholder="ID кассы в ОФД (kkm_ofd_id)" value={kkmOfdId} onChange={e=>setKkmOfdId(e.target.value)}/>
        <input style={{...S.input,padding:"7px 10px",fontSize:15}} placeholder="ПИН-код или Bearer-токен для заголовка Authorization" value={auth} onChange={e=>setAuth(e.target.value)}/>
      </div>
      <div style={{display:"flex",gap:8}}>
        <button style={{...S.btnPrimary,width:"auto",padding:"7px 16px",marginTop:0,boxShadow:"none"}} onClick={()=>{ const next={url:url.trim(),kkmOfdId:kkmOfdId.trim(),auth:auth.trim()}; onSave(next); }}>Сохранить</button>
        <button style={{...S.btnSecondary,width:"auto",padding:"7px 16px"}} onClick={onClose}>Отмена</button>
      </div>
    </div>
  );
}

// Касса — мгновенная продажа по каталогу (без адреса/времени доставки).
// Пишет в /api/sales, которая делит остаток с обычными заявками и
// сводится в тот же отчёт "Касса" — см. AdminCabinet.
function PosSaleModal({ products, clients, onClose, onCompleted }) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [clientSearchText, setClientSearchText] = useState("");
  const [clientId, setClientId] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [payType, setPayType] = useState({ cash: true, qr: false });
  const [payAmounts, setPayAmounts] = useState({ cash: "", qr: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCashcoreSettings, setShowCashcoreSettings] = useState(false);
  // Пока saleResult===null — обычная форма продажи. После оформления —
  // экран с результатом фискализации (успех/долг/ошибка), закрывается
  // отдельной кнопкой "Готово", чтобы кассир успел увидеть, пробился чек
  // или нет, прежде чем модалка закроется и это станет незаметно.
  const [saleResult, setSaleResult] = useState(null);
  const [fiscalizing, setFiscalizing] = useState(false);

  const categories = useMemo(() => [...new Set(products.map(p=>p.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')), [products]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p =>
      (!q || p.name.toLowerCase().includes(q) || (p.code||'').includes(q) || (p.barcode||'').includes(q)) &&
      (!category || p.group === category)
    );
  }, [products, search, category]);

  const addToCart = (p) => {
    setCart(c => {
      const existing = c.find(l => l.code === p.code);
      const avail = stockAmount(p);
      if (existing) {
        const nextQty = existing.qty + 1;
        const capped = avail != null ? Math.min(nextQty, avail) : nextQty;
        return c.map(l => l.code === p.code ? { ...l, qty: capped } : l);
      }
      return [...c, { code: p.code, name: p.name, price: p.price1 || 0, qty: 1, stock: avail }];
    });
  };
  const changeQty = (code, delta) => {
    setCart(c => c.map(l => {
      if (l.code !== code) return l;
      const next = l.qty + delta;
      const capped = l.stock != null ? Math.min(next, l.stock) : next;
      return { ...l, qty: Math.max(0, capped) };
    }).filter(l => l.qty > 0));
  };
  const changePrice = (code, price) => setCart(c => c.map(l => l.code===code ? { ...l, price: Number(price)||0 } : l));
  const removeFromCart = (code) => setCart(c => c.filter(l => l.code !== code));

  const total = cart.reduce((s,l)=>s+l.qty*l.price, 0);
  const cashAmt = payType.cash ? (Number(payAmounts.cash)||0) : 0;
  const qrAmt = payType.qr ? (Number(payAmounts.qr)||0) : 0;
  const remainder = Math.max(0, total - cashAmt - qrAmt);
  const overpaid = (cashAmt + qrAmt) > total;

  const toggleCashQr = (key) => {
    setPayType(pt => {
      const next = { ...pt, [key]: !pt[key] };
      if (!next[key]) setPayAmounts(a => ({ ...a, [key]: "" }));
      return next;
    });
  };

  useEffect(() => {
    // Пока не тронули суммы вручную — наличкой закрываем всю сумму по умолчанию (частый случай).
    if (payType.cash && payAmounts.cash === "" && !payType.qr) {
      setPayAmounts(a => ({ ...a, cash: total ? String(total) : "" }));
    }
  }, [total, payType.cash, payType.qr]);

  const canSubmit = cart.length>0 && !submitting && (remainder<=0 || clientId) && !overpaid;

  const runFiscalize = async (sale) => {
    setFiscalizing(true);
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      setSaleResult(r => ({ ...r, fiscal, fiscalError: null }));
    } catch (fe) {
      setSaleResult(r => ({ ...r, fiscal: null, fiscalError: fe.message }));
    }
    setFiscalizing(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const sale = await apiCall('POST', '/api/sales', {
        items: cart.map(l=>({code:l.code,name:l.name,qty:l.qty,price:l.price})),
        paymentCash: cashAmt,
        paymentQr: qrAmt,
        paymentDebt: remainder,
        clientCode: clientId || undefined,
      });
      // Продажа с долгом (remainder>0) не фискализируем автоматически — в
      // ККМ нет типа платежа "в долг", чек с неполной оплатой был бы
      // некорректен. Пробивается вручную после погашения.
      if (remainder > 0) {
        setSaleResult({ sale, fiscal: null, fiscalError: null, skippedDebt: true });
      } else {
        setSaleResult({ sale, fiscal: null, fiscalError: null, skippedDebt: false });
        await runFiscalize(sale);
      }
    } catch(e) { setError(e.message); }
    setSubmitting(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:C.surface,margin:"16px auto",borderRadius:16,padding:20,maxWidth:900,minHeight:"calc(100vh - 32px)"}}>
        <div style={{...S.row,marginBottom:16}}>
          <p style={{margin:0,fontSize:20,fontWeight:800,fontFamily:FH,color:C.navy}}>💵 Новая продажа</p>
          <div style={{display:"flex",gap:8}}>
            {!saleResult&&<button style={S.btnSecondary} onClick={()=>setShowCashcoreSettings(s=>!s)} title="Настройка кассового ядра">⚙ ККМ</button>}
            <button style={S.btnSecondary} onClick={onClose}>✕ Закрыть</button>
          </div>
        </div>

        {saleResult ? (
          <div style={S.card}>
            <p style={{margin:"0 0 10px",fontSize:17,fontWeight:800,color:C.navy}}>✅ Продажа №{saleResult.sale.id} оформлена — {saleResult.sale.total.toLocaleString()} ₸</p>
            {saleResult.skippedDebt&&(
              <div style={{...S.errorBox,background:"#FEF3E6",color:"#92400E",marginBottom:10}}>
                В продаже есть долг — чек не пробивается автоматически (в ККМ нет типа оплаты "в долг").
                Пробейте чек вручную после погашения.
              </div>
            )}
            {fiscalizing&&<div style={{padding:"10px 0",color:C.textSub,fontSize:15}}>Пробиваю чек через ККМ...</div>}
            {!fiscalizing&&saleResult.fiscal&&(
              <div style={{...S.errorBox,background:"#EAF5EE",color:"#15803D",marginBottom:10}}>
                🧾 Чек пробит. Фискальный признак: {saleResult.fiscal.fiscal_id}{saleResult.fiscal.ofd_name?` (${saleResult.fiscal.ofd_name})`:''}
              </div>
            )}
            {!fiscalizing&&saleResult.fiscalError&&(
              <div style={S.errorBox}>
                ⚠️ Чек не пробит: {saleResult.fiscalError}
                <div style={{marginTop:8}}>
                  <button style={{...S.btnSecondary,width:"auto",padding:"6px 14px",fontSize:14}} onClick={()=>runFiscalize(saleResult.sale)}>🔁 Повторить</button>
                </div>
              </div>
            )}
            <button style={{...S.btnPrimary,marginTop:10}} onClick={onCompleted}>Готово</button>
          </div>
        ) : <>
        {showCashcoreSettings&&(
          <CashcoreSettingsForm
            initial={getCashcoreSettings()}
            onSave={(next)=>{ saveCashcoreSettings(next); setShowCashcoreSettings(false); }}
            onClose={()=>setShowCashcoreSettings(false)}
          />
        )}
        <input
          type="search"
          style={{...S.input,marginBottom:10}}
          placeholder="Поиск по названию, коду или штрихкоду..."
          value={search}
          onChange={e=>setSearch(e.target.value)}
          autoComplete="off"
          name="pos-search"
        />
        {categories.length>0&&(
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
            <button onClick={()=>setCategory("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${category===""?C.navy:C.border}`,background:category===""?C.navy:C.white,color:category===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все</button>
            {categories.map(cat=>(
              <button key={cat} onClick={()=>setCategory(cat)} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${category===cat?C.navy:C.border}`,background:category===cat?C.navy:C.white,color:category===cat?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{cat}</button>
            ))}
          </div>
        )}
        <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px,1fr))",gap:10,marginBottom:20,maxHeight:320,overflowY:"auto",padding:2}}>
          {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>Ничего не найдено</div>}
          {filtered.map(p=>{
            const outOfStock = stockIsOut(p);
            const inCart = cart.find(l=>l.code===p.code);
            return (
              <div key={p.code} style={{border:`1px solid ${C.border}`,borderRadius:R,overflow:"hidden",background:C.white,opacity:outOfStock?0.5:1}}>
                <div style={{aspectRatio:"1",background:C.white,display:"flex",alignItems:"center",justifyContent:"center",padding:6,boxSizing:"border-box"}}>
                  {p.photo ? <img src={p.photo} style={{width:"100%",height:"100%",objectFit:"contain"}}/> : <span style={{fontSize:23,color:C.textFaint}}>📦</span>}
                </div>
                <div style={{padding:"6px 8px"}}>
                  <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2,minHeight:28,lineHeight:1.3}}>{p.name}</div>
                  <div style={{fontSize:14,fontWeight:800,fontFamily:FH,color:C.navy,marginBottom:6}}>{p.price1>0?p.price1.toLocaleString()+' ₸':'—'}</div>
                  {outOfStock ? (
                    <div style={{fontSize:12,color:C.red,textAlign:"center",padding:"6px 0"}}>Нет в наличии</div>
                  ) : inCart ? (
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,borderRadius:8,padding:"2px"}}>
                      <button onClick={()=>changeQty(p.code,-1)} style={{width:24,height:24,border:"none",borderRadius:6,background:C.white,boxShadow:`0 0 0 1px ${C.border}`,fontSize:16,fontWeight:700,color:C.navy,cursor:"pointer"}}>−</button>
                      <span style={{fontSize:14,fontWeight:800,color:C.navy}}>{inCart.qty}</span>
                      <button onClick={()=>changeQty(p.code,1)} style={{width:24,height:24,border:"none",borderRadius:6,background:C.white,boxShadow:`0 0 0 1px ${C.border}`,fontSize:16,fontWeight:700,color:C.navy,cursor:"pointer"}}>+</button>
                    </div>
                  ) : (
                    <button onClick={()=>addToCart(p)} style={{width:"100%",padding:"6px",border:"none",borderRadius:8,background:C.navy,color:C.white,fontSize:13,fontWeight:700,cursor:"pointer"}}>Добавить</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div style={S.card}>
          <p style={{...S.label,marginBottom:10,display:"block"}}>Корзина</p>
          {cart.length===0
            ? <div style={{textAlign:"center",padding:"16px 0",color:C.textFaint,fontSize:15}}>Пусто — выберите товары выше</div>
            : cart.map(l=>(
              <div key={l.code} style={{display:"grid",gridTemplateColumns:"1fr 56px 80px 28px",gap:6,alignItems:"center",marginBottom:8}}>
                <div style={{fontSize:15,color:C.textMid,fontWeight:600}}>{l.name}</div>
                <input style={{...S.input,padding:"7px 6px",fontSize:15,textAlign:"center"}} type="number" min="1" max={l.stock!=null?l.stock:undefined} value={l.qty}
                  onChange={e=>{
                    let v = Number(e.target.value)||0;
                    if (l.stock!=null) v = Math.min(v, l.stock);
                    setCart(c=>c.map(x=>x.code===l.code?{...x,qty:Math.max(0,v)}:x));
                  }}
                  onFocus={e=>e.target.select()}
                />
                <input style={{...S.input,padding:"7px 6px",fontSize:15,textAlign:"right"}} type="number" value={l.price} onChange={e=>changePrice(l.code,e.target.value)} onFocus={e=>e.target.select()}/>
                <button onClick={()=>removeFromCart(l.code)} style={{width:28,height:34,border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,cursor:"pointer",fontSize:16,color:C.textFaint}}>×</button>
              </div>
            ))}
          {cart.length>0&&<><hr style={{...S.divider,marginTop:4}}/><div style={S.row}><span style={{fontSize:15,color:C.textSub}}>Итого</span><span style={{fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>{total.toLocaleString()} ₸</span></div></>}
        </div>

        <div style={S.card}>
          <p style={{...S.label,marginBottom:10,display:"block"}}>Клиент {remainder>0?<span style={{color:C.red,fontWeight:400}}>(обязателен для долга)</span>:<span style={{color:C.textFaint,fontWeight:400}}>(необязательно)</span>}</p>
          <div style={{position:"relative"}}>
            <input
              style={S.input}
              placeholder="Начните вводить название..."
              value={clientSearchText}
              onChange={e=>{ setClientSearchText(e.target.value); setClientId(""); setShowClientDrop(true); }}
              onFocus={()=>setShowClientDrop(true)}
              onBlur={()=>setTimeout(()=>setShowClientDrop(false),180)}
            />
            {showClientDrop&&(()=>{
              const matched = clientSearchText.length>0 ? clients.filter(c=>c.name.toLowerCase().includes(clientSearchText.toLowerCase())) : clients;
              return matched.length>0&&(
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:200,overflowY:"auto"}}>
                  {matched.map(c=>(
                    <div key={c.code} onMouseDown={()=>{ setClientId(c.code); setClientSearchText(c.name); setShowClientDrop(false); }} style={{padding:"9px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15}}>{c.name}</div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        <div style={S.card}>
          <p style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:C.navy}}>Оплата</p>
          {[{key:"cash",label:"Наличка",icon:"💵",bg:C.cashGreen,col:"#15803D"},{key:"qr",label:"QR код",icon:"📲",bg:C.qrBlue,col:"#1D4ED8"}].map(({key,label,icon,bg,col})=>(
            <div key={key} style={{marginBottom:10}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div onClick={()=>toggleCashQr(key)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${payType[key]?col:C.border}`,background:payType[key]?col:C.white,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {payType[key]&&<span style={{color:C.white,fontSize:15,fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:16,fontWeight:600,color:payType[key]?col:C.textMid}}>{icon} {label}</span>
                {payType[key]&&<input style={{flex:1,border:`1.5px solid ${col}40`,borderRadius:6,padding:"6px 10px",fontSize:16,fontWeight:600,outline:"none",background:bg,color:col}} placeholder="Сумма ₸" value={payAmounts[key]} onFocus={e=>e.target.select()} onChange={e=>setPayAmounts(a=>({...a,[key]:e.target.value}))}/>}
              </div>
            </div>
          ))}
          <div style={{padding:"12px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`}}>
            <div style={{...S.row,marginBottom:6}}><span style={{fontSize:14,color:C.textSub}}>Сумма продажи</span><span style={{fontWeight:700,fontFamily:FH}}>{total.toLocaleString()} ₸</span></div>
            <div style={{...S.row,paddingTop:6,borderTop:`1px solid ${C.border}`}}>
              <span style={{fontSize:15,fontWeight:700,color:overpaid?C.red:(remainder>0?"#92400E":C.green)}}>{overpaid?"⚠️ Оплачено больше суммы":(remainder>0?"📋 Долг":"✅ Полностью оплачено")}</span>
              {(remainder>0||overpaid)&&<span style={{fontWeight:800,fontSize:17,fontFamily:FH,color:overpaid?C.red:"#92400E"}}>{(overpaid?(cashAmt+qrAmt-total):remainder).toLocaleString()} ₸</span>}
            </div>
          </div>
        </div>

        {error&&<div style={S.errorBox}>{error}</div>}
        <button style={{...S.btnSuccess,opacity:canSubmit?1:0.45,cursor:canSubmit?"pointer":"not-allowed"}} disabled={!canSubmit} onClick={submit}>{submitting?"Оформление...":"✅ Оформить продажу"}</button>
        </>}
      </div>
    </div>
  );
}

// Создание заявки менеджером/админом — та же форма, что у торгового
// (SalesCabinet, tab==="new"), но модалкой поверх "Заявок" (по аналогии с
// PosSaleModal выше), т.к. у менеджера в кабинете нет отдельного экрана
// под заявку. products/clients приходят как есть из /api/products и
// /api/clients (см. AdminCabinet) — сама раскладка карточки товара под
// форму (priceOptions/pricedByWeight и т.п.) повторяет loadProducts из
// SalesCabinet, чтобы работали те же built. Заявка после создания
// получает sales_id/sales_name текущего пользователя (см. POST
// /api/orders на сервере) — заявка от менеджера так и подписывается его
// именем, это нормально: менеджеру и так доступны все заявки целиком.
//
// isAdmin (только role==="admin", см. вызов в AdminCabinet) разблокирует
// ручной ввод цены даже у товара с готовыми price1/2/3 из 1С — у пары
// клиентов админ продаёт по своей, нестандартной цене. Сама цена дальше
// идёт в заявку тем же полем items[].price, что и обычно (см. handleSubmit
// ниже) — на кассу/прибыль/отчёты это никак специально не влияет, для них
// это просто ещё одна цена позиции, как если бы её выбрали из priceOptions.
function NewOrderModal({ products, clients, onClose, onCreated, isAdmin }) {
  const mappedProducts = useMemo(() => products.filter(p => p.has_alias).map((p, i) => ({
    id: i + 1,
    name: p.display_name || p.name,
    price: p.price || 0,
    priceOptions: [p.price1, p.price2, p.price3].filter(v => v !== null && v !== undefined),
    commission: p.commission || 0,
    unit: p.unit || 'кг',
    group: p.group || '',
    code: p.code,
    stock: p.stock,
    pricedByWeight: !!p.priced_by_weight,
    avgWeightPerBox: p.avg_box_weight != null ? p.avg_box_weight
      : ((p.stock_weight_kg != null && p.stock > 0) ? (p.stock_weight_kg / p.stock) : null),
    priced_by_weight: !!p.priced_by_weight,
    stock_weight_kg: p.stock_weight_kg != null ? p.stock_weight_kg : null,
    avg_box_weight: p.avg_box_weight != null ? p.avg_box_weight : null
  })), [products]);

  const [clientId, setClientId] = useState("");
  const [clientSearchText, setClientSearchText] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const newLine = () => ({uid:Math.random(),productId:null,name:"",qty:"",price:"",search:"",showDrop:false,pricedByWeight:false,weightPerBox:""});
  const [lines, setLines] = useState([newLine()]);

  const [debts, setDebts] = useState([]);
  useEffect(() => { apiCall('GET','/api/debts').then(setDebts).catch(()=>{}); }, []);
  const selectedClientDebt = clientId ? debts.filter(d=>d.client_name===clients.find(c=>c.code===clientId)?.name && d.overdue).reduce((s,d)=>s+d.remaining,0) : 0;

  const updateLine = (uid,patch) => setLines(ls=>ls.map(l=>l.uid===uid?{...l,...patch}:l));
  const removeLine = (uid) => setLines(ls=>ls.length>1?ls.filter(l=>l.uid!==uid):ls);
  const addLine = () => setLines(ls=>[...ls,newLine()]);
  const selectProduct = (uid,prod) => {
    if (stockIsOut(prod)) return;
    updateLine(uid,{
      productId:prod.id,code:prod.code,name:prod.name,unit:prod.unit,
      price:prod.priceOptions&&prod.priceOptions.length===1?prod.priceOptions[0]:"",
      search:prod.name,showDrop:false,qty:"",priceOptions:prod.priceOptions||[],commission:prod.commission||0,stock:prod.stock,
      stockWeightKg:prod.stock_weight_kg,
      avgBoxWeight:prod.avg_box_weight,
      pricedByWeight:!!prod.pricedByWeight,
      weightPerBox: prod.avgWeightPerBox!=null ? String(Math.round(prod.avgWeightPerBox*100)/100) : ""
    });
  };
  const estWeightOf = (l) => l.pricedByWeight ? (Number(l.qty)||0)*(Number(l.weightPerBox)||0) : (Number(l.qty)||0);
  const filledLines = lines.filter(l=>l.name&&l.productId&&Number(l.qty)>0&&Number(l.price)>0&&(!l.pricedByWeight||Number(l.weightPerBox)>0));
  const total = filledLines.reduce((s,l)=>s+estWeightOf(l)*Number(l.price),0);
  // Оценка веса весового товара может превысить кг-остаток склада (см.
  // проверку на сервере в POST /api/orders) — не даём отправить такую заявку
  // и здесь, чтобы не ждать ответа сервера ради того, что уже видно на экране.
  const hasOverStock = filledLines.some(l=>l.pricedByWeight&&l.stockWeightKg!=null&&estWeightOf(l)>l.stockWeightKg);

  const handleSubmit = async () => {
    if (submitting) return;
    if (!clientId||filledLines.length===0||!timeSlot||!contactPhone.trim()||hasOverStock) return;
    const client = clients.find(c=>c.code===clientId);
    const items = filledLines.map(l=>l.pricedByWeight
      ? {id:l.productId,code:l.code,name:l.name,qty:estWeightOf(l),boxes:Number(l.qty),price:Number(l.price),commission:l.commission||0}
      : {id:l.productId,code:l.code,name:l.name,qty:Number(l.qty),price:Number(l.price),commission:l.commission||0}
    );
    setSubmitting(true);
    try {
      await apiCall('POST','/api/orders',{clientName:client.name,clientCode:client.code,address:client.address||'',timeSlot,items,total,paymentCash:0,paymentQr:0,paymentDebt:0,comment,contactName,contactPhone});
      onCreated();
    } catch(e) { alert(e.message); }
    setSubmitting(false);
  };

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(28,25,23,0.45)",zIndex:200,overflowY:"auto"}} onClick={e=>{ if(e.target===e.currentTarget) onClose(); }}>
      <div style={{background:C.surface,margin:"16px auto",borderRadius:16,padding:20,maxWidth:560,minHeight:"calc(100vh - 32px)"}}>
        <div style={{...S.row,marginBottom:16}}>
          <p style={{margin:0,fontSize:20,fontWeight:800,fontFamily:FH,color:C.navy}}>📝 Новая заявка</p>
          <button style={S.btnSecondary} onClick={onClose}>✕ Закрыть</button>
        </div>
        <div style={S.card}>
          <div style={S.formGroup}>
            <label style={S.label}>Контрагент {clients.length>0&&<span style={{color:C.green,fontWeight:400,fontSize:13}}>({clients.length} из 1С)</span>}</label>
            <div style={{position:"relative"}}>
              <input
                style={{...S.input,paddingRight:clientSearchText?38:14}}
                placeholder="Начните вводить название..."
                value={clientSearchText}
                onChange={e=>{setClientSearchText(e.target.value); setClientId(""); setShowClientDrop(true);}}
                onFocus={()=>setShowClientDrop(true)}
                onBlur={()=>setTimeout(()=>setShowClientDrop(false),180)}
              />
              {clientSearchText&&(
                <button
                  type="button"
                  onMouseDown={e=>e.preventDefault()}
                  onClick={()=>{setClientSearchText("");setClientId("");setContactName("");setContactPhone("");}}
                  style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.textFaint,padding:4,lineHeight:1}}
                >×</button>
              )}
              {showClientDrop&&(()=>{
                const matched=clientSearchText.length>0?clients.filter(c=>c.name.toLowerCase().includes(clientSearchText.toLowerCase())):clients;
                return matched.length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:220,overflowY:"auto"}}>
                    {matched.map(c=>(
                      <div key={c.code} onMouseDown={()=>{setClientId(c.code);setClientSearchText(c.name);setShowClientDrop(false);setContactName(c.contact_name||'');setContactPhone(c.contact_phone||'');}} style={{padding:"9px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15}}>
                        <div style={{fontWeight:600}}>{c.name}</div>
                        {c.address&&<div style={{fontSize:13,color:C.textFaint}}>📍 {c.address}</div>}
                      </div>
                    ))}
                  </div>
                );
              })()}
            </div>
            {clientId&&clients.find(c=>c.code===clientId)?.address&&<p style={{margin:"6px 0 0",fontSize:14,color:C.textSub}}>📍 {clients.find(c=>c.code===clientId)?.address}</p>}
            {selectedClientDebt>0&&<div style={{marginTop:8,padding:"10px 12px",background:"#FEF2F2",border:"1px solid #FECACA",borderRadius:8,fontSize:14,color:C.red,fontWeight:600}}>⚠️ У контрагента непогашенный долг более 7 дней: {selectedClientDebt.toLocaleString()} ₸</div>}
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Телефон контактного лица</label>
            <div style={{display:"flex",gap:6}}>
              <div style={{position:"relative",flex:1}}>
                <input style={{...S.input,paddingRight:contactPhone?38:14}} placeholder="Телефон" value={contactPhone} onChange={e=>setContactPhone(e.target.value)}/>
                {contactPhone&&(
                  <button type="button" onClick={()=>setContactPhone("")} style={{position:"absolute",right:10,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:20,color:C.textFaint,padding:4,lineHeight:1}}>×</button>
                )}
              </div>
              {CONTACT_PICKER_SUPPORTED&&(
                <button type="button" title="Выбрать из контактов" onClick={()=>pickPhoneContact(({name,tel})=>{if(name)setContactName(name);if(tel)setContactPhone(tel);})} style={{flexShrink:0,width:48,border:`1.5px solid ${C.border}`,borderRadius:10,background:C.white,fontSize:19,cursor:"pointer"}}>📇</button>
              )}
            </div>
          </div>
          <div style={S.formGroup}>
            <label style={S.label}>Время доставки</label>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[...TIME_SLOTS,PICKUP_SLOT].map(slot=>(
                <button key={slot} onClick={()=>setTimeSlot(slot)} style={{padding:"12px",borderRadius:10,border:`1.5px solid ${timeSlot===slot?C.navy:C.border}`,background:timeSlot===slot?C.navy:C.white,color:timeSlot===slot?C.white:C.textMid,fontSize:16,fontWeight:500,cursor:"pointer",textAlign:"left"}}>{slot}</button>
              ))}
            </div>
          </div>
        </div>
        <div style={S.card}>
          <div style={{...S.row,marginBottom:12}}>
            <label style={S.label}>
              Номенклатура {mappedProducts.length>0&&<span style={{color:C.green,fontWeight:400,fontSize:13}}>({mappedProducts.length} поз. из 1С)</span>}
            </label>
            <button onClick={addLine} style={{background:C.navy,color:C.white,border:"none",borderRadius:8,padding:"4px 12px",fontSize:14,fontWeight:600,cursor:"pointer"}}>+ Товар</button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 64px 80px 28px",gap:6,marginBottom:6}}>
            {["Наименование","Кол-во","Цена ₸",""].map((h,i)=><div key={i} style={{fontSize:12,fontWeight:600,color:C.textFaint,textTransform:"uppercase"}}>{h}</div>)}
          </div>
          {lines.map(line=>{
            const inStock=mappedProducts.filter(p=>!stockIsOut(p));
            const matched=line.search.length>0?inStock.filter(p=>p.name.toLowerCase().includes(line.search.toLowerCase())):inStock.slice(0,50);
            const lineWeight=estWeightOf(line);
            const lineTotal=lineWeight>0&&Number(line.price)>0?lineWeight*Number(line.price):null;
            return(
              <div key={line.uid} style={{marginBottom:8}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 64px 80px 28px",gap:6,alignItems:"center"}}>
                  <div style={{position:"relative"}}>
                    <input style={{...S.input,padding:"8px 10px",fontSize:15,...(line.name&&!line.productId?{borderColor:C.red}:{})}} placeholder="Введите товар..." value={line.search}
                      onChange={e=>updateLine(line.uid,{search:e.target.value,name:e.target.value,productId:null,price:"",showDrop:true})}
                      onFocus={()=>updateLine(line.uid,{showDrop:true})}
                      onBlur={()=>setTimeout(()=>updateLine(line.uid,{showDrop:false}),180)}
                    />
                    {line.name&&!line.productId&&!line.showDrop&&<p style={{margin:"4px 0 0",fontSize:12,color:C.red}}>Выберите товар из списка — вписать вручную нельзя</p>}
                    {line.showDrop&&matched.length>0&&(
                      <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:180,overflowY:"auto"}}>
                        {matched.map(p=>{
                          const outOfStock = stockIsOut(p);
                          const stockLbl = stockLabel(p);
                          return (
                          <div key={p.id} onMouseDown={()=>selectProduct(line.uid,p)} style={{padding:"9px 12px",cursor:outOfStock?"not-allowed":"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15,opacity:outOfStock?0.5:1,background:outOfStock?C.surface:C.white}}>
                            <div style={{fontWeight:600}}>{p.name}</div>
                            <div style={{fontSize:13,color:outOfStock?C.red:C.textFaint}}>{p.price>0?p.price.toLocaleString()+' ₸ / ':''}{p.unit}{p.group?' · '+p.group:''}{stockLbl!=null?(outOfStock?' · Нет в наличии':' · Остаток: '+stockLbl):''}</div>
                          </div>
                        )})}
                      </div>
                    )}
                  </div>
                  <input style={{...S.input,padding:"8px 6px",fontSize:15,textAlign:"center"}} placeholder={line.pricedByWeight?"кор":"кол"} value={line.qty} type="number" min="1" max={(!line.pricedByWeight&&line.stock!=null)?line.stock:undefined}
                    onChange={e=>{
                      let v = e.target.value;
                      if (!line.pricedByWeight && line.stock!=null && Number(v) > line.stock) v = String(line.stock);
                      updateLine(line.uid,{qty:v});
                    }}
                    onFocus={e=>e.target.select()}
                  />
                  <input style={{...S.input,padding:"8px 6px",fontSize:15,textAlign:"right",background:(!isAdmin&&line.priceOptions&&line.priceOptions.length>0)?C.surface:C.white,color:(!isAdmin&&line.priceOptions&&line.priceOptions.length>0)?C.textSub:C.text}} placeholder="цена" value={line.price} type="number"
                    disabled={!isAdmin&&line.priceOptions&&line.priceOptions.length>0}
                    onChange={e=>updateLine(line.uid,{price:e.target.value})}
                    onFocus={e=>e.target.select()}
                  />
                  <button onClick={()=>removeLine(line.uid)} style={{width:28,height:34,border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,cursor:"pointer",fontSize:16,color:C.textFaint}}>×</button>
                </div>
                {line.pricedByWeight
                  ? (line.stockWeightKg!=null&&<div style={{fontSize:13,color:C.textFaint,marginTop:2}}>На складе: {formatWeightStock(line.stockWeightKg,line.avgBoxWeight)}</div>)
                  : (line.stock!=null&&<div style={{fontSize:13,color:C.textFaint,marginTop:2}}>На складе: {line.stock} {line.unit}</div>)}
                {line.pricedByWeight&&(
                  <div style={{display:"flex",alignItems:"center",gap:8,marginTop:6}}>
                    <span style={{fontSize:13,color:C.textSub,whiteSpace:"nowrap"}}>⚖️ Вес короба, кг (примерно)</span>
                    <input style={{...S.input,width:80,padding:"6px 8px",fontSize:14,textAlign:"center"}} placeholder="кг" value={line.weightPerBox} type="number"
                      onChange={e=>updateLine(line.uid,{weightPerBox:e.target.value})}
                      onFocus={e=>e.target.select()}
                    />
                    {lineWeight>0&&<span style={{fontSize:13,color:(line.stockWeightKg!=null&&lineWeight>line.stockWeightKg)?C.red:C.textFaint}}>≈ {lineWeight.toLocaleString()} кг</span>}
                  </div>
                )}
                {line.pricedByWeight&&line.stockWeightKg!=null&&lineWeight>line.stockWeightKg&&(
                  <p style={{margin:"2px 0 0",fontSize:12,color:C.red}}>Недостаточно остатка: доступно {line.stockWeightKg.toLocaleString()} кг</p>
                )}
                {lineTotal&&<div style={{textAlign:"right",fontSize:13,color:C.textSub,marginTop:2,paddingRight:34}}>= <strong style={{color:C.navy}}>{lineTotal.toLocaleString()} ₸</strong></div>}
                {line.priceOptions&&line.priceOptions.length>0&&(
                  <div style={{display:"flex",gap:6,marginTop:6,flexWrap:"wrap"}}>
                    {line.priceOptions.map((pr,i)=>(
                      <button key={i} onClick={()=>updateLine(line.uid,{price:pr})} style={{padding:"5px 12px",borderRadius:8,border:`1px solid ${Number(line.price)===pr?C.navy:C.border}`,background:Number(line.price)===pr?C.navy:C.white,color:Number(line.price)===pr?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{pr.toLocaleString()} ₸</button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {filledLines.length>0&&<><hr style={{...S.divider,marginTop:8}}/><div style={S.row}><span style={{fontSize:15,color:C.textSub}}>Итого</span><span style={{fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>{total.toLocaleString()} ₸</span></div></>}
        </div>
        <div style={S.card}>
          <div style={S.formGroup}>
            <label style={S.label}>Комментарий</label>
            <textarea style={S.textarea} value={comment} onChange={e=>setComment(e.target.value)} placeholder="Особые пожелания..."/>
          </div>
          <button style={{...S.btnPrimary,opacity:(submitting||!clientId||filledLines.length===0||!timeSlot||!contactPhone.trim()||hasOverStock)?0.45:1}} onClick={handleSubmit} disabled={submitting||!clientId||filledLines.length===0||!timeSlot||!contactPhone.trim()||hasOverStock}>{submitting?"Отправка...":"Отправить заявку"}</button>
        </div>
      </div>
    </div>
  );
}

// Считает выручку/себестоимость/прибыль по списку заявок или продаж (у
// обеих items — либо массив, либо JSON-строка). cost — снимок закупочной
// цены на момент продажи (см. getCostMap на сервере), а не текущая цена
// товара, поэтому прошлые продажи не "плывут" при правке закупки задним
// числом. Если у части позиций cost ещё не заведён — они не портят сумму
// (просто не входят в себестоимость), но считаются в missingCostLines,
// чтобы отчёт мог честно предупредить "прибыль занижена".
function sumItemsProfit(list) {
  let revenue = 0, cost = 0, missingCostLines = 0;
  const missingCostItemsMap = {};
  (list || []).forEach(o => {
    const its = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : (o.items || []);
    its.forEach(it => {
      const qty = Number(it.qty) || 0, price = Number(it.price) || 0;
      revenue += qty * price;
      if (it.cost != null) cost += qty * Number(it.cost);
      else {
        missingCostLines += 1;
        // Дедуп по коду (или имени, если кода нет) — один и тот же товар
        // без закупочной цены может встретиться в десятках заявок, но
        // в предупреждении назвать его нужно один раз.
        const key = it.code || it.name;
        if (key && !missingCostItemsMap[key]) missingCostItemsMap[key] = { code: it.code || null, name: it.name };
      }
    });
  });
  return { revenue, cost, profit: revenue - cost, missingCostLines, missingCostItems: Object.values(missingCostItemsMap) };
}

// Блок "Прибыль" — переиспользуется в "Отчёте" (только заявки), "Кассе"
// (только продажи по кассе) и как общий свод (заявки+касса вместе).
// missingLines>0 означает, что у части проданных позиций ещё не заведена
// закупочная цена (см. вкладку "Товары") — тогда прибыль занижена, честно
// показываем это отдельной строкой вместо того, чтобы выдать неполную
// цифру за точную.
// commission — необязательный: бонус торговых (реальный расход, выплачивается
// сотруднику, см. totalCommission выше). Когда он передан, показываем ещё и
// "чистую" прибыль (после вычета бонуса) — то, что владелец реально
// зарабатывает, а не валовую маржу без учёта, сколько ушло на бонусы.
function ProfitBlock({ revenue, cost, profit, missingLines, missingItems, commission }) {
  const margin = revenue > 0 ? (profit / revenue * 100) : 0;
  const hasCommission = commission != null;
  const netProfit = hasCommission ? profit - commission : null;
  return (
    <div style={{...S.card, marginTop:10}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
        <div>
          <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Себестоимость</p>
          <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:C.textMid}}>{cost.toLocaleString(undefined,{maximumFractionDigits:0})} ₸</p>
        </div>
        <div>
          <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Прибыль</p>
          <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:profit>=0?C.green:C.red}}>{profit.toLocaleString(undefined,{maximumFractionDigits:0})} ₸</p>
        </div>
        <div>
          <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Маржа</p>
          <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:profit>=0?C.green:C.red}}>{margin.toFixed(1)}%</p>
        </div>
      </div>
      {hasCommission&&(
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`}}>
          <div>
            <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Бонус торговых (расход)</p>
            <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:C.textMid}}>{commission.toLocaleString(undefined,{maximumFractionDigits:0})} ₸</p>
          </div>
          <div>
            <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Чистая прибыль</p>
            <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:netProfit>=0?C.green:C.red}}>{netProfit.toLocaleString(undefined,{maximumFractionDigits:0})} ₸</p>
          </div>
        </div>
      )}
      {missingLines>0&&(
        <p style={{margin:"10px 0 0",fontSize:13.5,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"7px 10px"}}>
          ⚠️ У {missingLines} {missingLines===1?'позиции':'позиций'} нет закупочной цены — прибыль занижена. Заполните на вкладке «Товары»{missingItems&&missingItems.length>0&&<>: <b>{missingItems.map(it=>it.code?`${it.name} (код ${it.code})`:it.name).join(', ')}</b></>}.
        </p>
      )}
    </div>
  );
}

// Кабинет кассира — постоянный экран кассы: каталог и текущий чек всегда
// на экране (не нужно нажимать "Новая продажа" каждый раз, как торговый
// жмёт "Создать заявку"), плюс смена — пока не открыта, кассы не видно.
function CashierCabinet({ user, onLogout }) {
  const isDesktop = useIsDesktop();
  const [shift, setShift] = useState(undefined); // undefined = грузится, null = смены нет
  const [openingShift, setOpeningShift] = useState(false);
  const [closingShift, setClosingShift] = useState(false);

  const loadShift = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/cashier-shift/current');
      setShift(data);
    } catch(e) { if(e.message.includes('токен')) onLogout(); }
  }, []);
  useEffect(() => { loadShift(); }, []);

  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);

  const loadSales = useCallback(async () => {
    try { setSales(await apiCall('GET', '/api/sales')); } catch(e) {}
  }, []);
  useEffect(() => { loadSales(); }, []);
  useEffect(() => { fetch('/api/products').then(r=>r.json()).then(setProducts).catch(()=>{}); }, []);
  useEffect(() => { apiCall('GET', '/api/clients').then(setClients).catch(()=>{}); }, []);

  const openShift = async () => {
    setOpeningShift(true);
    try { setShift(await apiCall('POST', '/api/cashier-shift/open', {})); }
    catch(e) { alert(e.message); }
    setOpeningShift(false);
  };

  // Итог смены считаем по своим продажам с момента открытия — без
  // отдельного поля shift_id на продаже: он не нужен, пока смены не
  // пересекаются (одна открытая на кассира за раз, см. сервер).
  const myShiftSales = useMemo(() => {
    if (!shift) return [];
    return sales.filter(s => s.created_by_id === user.id && s.status !== "voided" && s.created_at >= shift.opened_at);
  }, [sales, shift, user.id]);

  const closeShift = async () => {
    if (!shift) return;
    const cash = myShiftSales.reduce((s,o)=>s+(o.payment_cash||0),0);
    const qr = myShiftSales.reduce((s,o)=>s+(o.payment_qr||0),0);
    const debt = myShiftSales.reduce((s,o)=>s+(o.payment_debt||0),0);
    if (!window.confirm(`Закрыть смену?\n\nПродаж: ${myShiftSales.length}\nНаличка: ${cash.toLocaleString()} ₸\nQR: ${qr.toLocaleString()} ₸\nДолг: ${debt.toLocaleString()} ₸`)) return;
    setClosingShift(true);
    try {
      await apiCall('POST', `/api/cashier-shift/${shift.id}/close`, {});
      setShift(null);
    } catch(e) { alert(e.message); }
    setClosingShift(false);
  };

  // ===== Каталог + чек — та же механика, что в PosSaleModal у менеджера,
  // но всегда на экране, без открытия/закрытия отдельного окна =====
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [clientSearchText, setClientSearchText] = useState("");
  const [clientId, setClientId] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [payType, setPayType] = useState({ cash: true, qr: false });
  const [payAmounts, setPayAmounts] = useState({ cash: "", qr: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saleResult, setSaleResult] = useState(null);
  const [fiscalizing, setFiscalizing] = useState(false);
  const [showCashcoreSettings, setShowCashcoreSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [fiscalizingSaleId, setFiscalizingSaleId] = useState(null);
  const [fiscalErrorBySale, setFiscalErrorBySale] = useState({});

  const categories = useMemo(() => [...new Set(products.map(p=>p.group).filter(Boolean))].sort((a,b)=>a.localeCompare(b,'ru')), [products]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p =>
      (!q || p.name.toLowerCase().includes(q) || (p.code||'').includes(q) || (p.barcode||'').includes(q)) &&
      (!category || p.group === category)
    );
  }, [products, search, category]);

  const addToCart = (p) => {
    setCart(c => {
      const existing = c.find(l => l.code === p.code);
      const avail = stockAmount(p);
      if (existing) {
        const nextQty = existing.qty + 1;
        const capped = avail != null ? Math.min(nextQty, avail) : nextQty;
        return c.map(l => l.code === p.code ? { ...l, qty: capped } : l);
      }
      return [...c, { code: p.code, name: p.name, price: p.price1 || 0, qty: 1, stock: avail }];
    });
  };
  const changeQty = (code, delta) => {
    setCart(c => c.map(l => {
      if (l.code !== code) return l;
      const next = l.qty + delta;
      const capped = l.stock != null ? Math.min(next, l.stock) : next;
      return { ...l, qty: Math.max(0, capped) };
    }).filter(l => l.qty > 0));
  };
  const changePrice = (code, price) => setCart(c => c.map(l => l.code===code ? { ...l, price: Number(price)||0 } : l));
  const removeFromCart = (code) => setCart(c => c.filter(l => l.code !== code));
  const clearCart = () => { setCart([]); setClientId(""); setClientSearchText(""); setPayAmounts({ cash:"", qr:"" }); };

  const total = cart.reduce((s,l)=>s+l.qty*l.price, 0);
  const cashAmt = payType.cash ? (Number(payAmounts.cash)||0) : 0;
  const qrAmt = payType.qr ? (Number(payAmounts.qr)||0) : 0;
  const remainder = Math.max(0, total - cashAmt - qrAmt);
  const overpaid = (cashAmt + qrAmt) > total;

  const toggleCashQr = (key) => {
    setPayType(pt => {
      const next = { ...pt, [key]: !pt[key] };
      if (!next[key]) setPayAmounts(a => ({ ...a, [key]: "" }));
      return next;
    });
  };

  useEffect(() => {
    if (payType.cash && payAmounts.cash === "" && !payType.qr) {
      setPayAmounts(a => ({ ...a, cash: total ? String(total) : "" }));
    }
  }, [total, payType.cash, payType.qr]);

  const canSubmit = cart.length>0 && !submitting && (remainder<=0 || clientId) && !overpaid;

  const runFiscalize = async (sale) => {
    setFiscalizing(true);
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      setSaleResult(r => ({ ...r, fiscal, fiscalError: null }));
    } catch (fe) {
      setSaleResult(r => ({ ...r, fiscal: null, fiscalError: fe.message }));
    }
    setFiscalizing(false);
  };

  const submit = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const sale = await apiCall('POST', '/api/sales', {
        items: cart.map(l=>({code:l.code,name:l.name,qty:l.qty,price:l.price})),
        paymentCash: cashAmt,
        paymentQr: qrAmt,
        paymentDebt: remainder,
        clientCode: clientId || undefined,
      });
      clearCart();
      loadSales();
      if (remainder > 0) {
        setSaleResult({ sale, fiscal: null, fiscalError: null, skippedDebt: true });
      } else {
        setSaleResult({ sale, fiscal: null, fiscalError: null, skippedDebt: false });
        await runFiscalize(sale);
      }
    } catch(e) { setError(e.message); }
    setSubmitting(false);
  };

  const retryFiscal = useCallback(async (sale) => {
    setFiscalizingSaleId(sale.id);
    setFiscalErrorBySale(e => ({ ...e, [sale.id]: null }));
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      await loadSales();
    } catch (e) {
      setFiscalErrorBySale(er => ({ ...er, [sale.id]: e.message }));
    }
    setFiscalizingSaleId(null);
  }, [loadSales]);

  const voidSale = useCallback(async (sale) => {
    if (!window.confirm(`Отменить продажу № ${sale.id} на ${sale.total.toLocaleString()} ₸? Остаток вернётся на склад.`)) return;
    try {
      let fiscalReturn = {};
      if (sale.fiscal_id) {
        try {
          const r = await fiscalizeSale(sale, 3); // OPERATION_SELL_RETURN
          fiscalReturn = { fiscal_return_id: r.fiscal_id, fiscal_return_qr: r.qr_code };
        } catch (fe) {
          alert(`Не удалось пробить чек возврата: ${fe.message}\n\nПродажа НЕ отменена — иначе в ОФД останется чек без документа возврата. Попробуйте ещё раз, когда касса будет доступна.`);
          return;
        }
      }
      await apiCall('POST', `/api/sales/${sale.id}/void`, fiscalReturn);
      await loadSales();
    } catch(e) { alert(e.message); }
  }, [loadSales]);

  const todayStr = new Date().toISOString().slice(0,10);
  const historyList = useMemo(() => sales.filter(s=>s.date===todayStr).slice().sort((a,b)=>b.id-a.id), [sales, todayStr]);

  if (shift === undefined) {
    return <div style={S.loadingWrap}>Загрузка...</div>;
  }

  if (!shift) {
    return (
      <div style={{minHeight:"60vh",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
        <div style={{...S.card,maxWidth:360,width:"100%",textAlign:"center",padding:"32px 24px"}}>
          <div style={{fontSize:44,marginBottom:12}}>🔒</div>
          <p style={{...S.cardTitle,fontSize:20,marginBottom:6}}>Касса закрыта</p>
          <p style={{...S.cardSub,marginBottom:20}}>Откройте смену, чтобы начать продажи</p>
          <button style={S.btnSuccess} disabled={openingShift} onClick={openShift}>{openingShift?"Открываем...":"▶ Начать смену"}</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{padding: isDesktop?"20px 24px 40px":"16px 12px 90px"}}>
      {showCashcoreSettings&&(
        <CashcoreSettingsForm
          initial={getCashcoreSettings()}
          onSave={(next)=>{ saveCashcoreSettings(next); setShowCashcoreSettings(false); }}
          onClose={()=>setShowCashcoreSettings(false)}
        />
      )}
      <div style={{...S.row,marginBottom:16,flexWrap:"wrap",gap:10}}>
        <div>
          <p style={{margin:"0 0 2px",fontSize:14,color:C.textSub,display:"flex",alignItems:"center",gap:6}}>
            <span style={{width:8,height:8,borderRadius:"50%",background:C.green,display:"inline-block"}}/> Касса открыта · смена №{shift.id}
          </p>
          <p style={{margin:0,fontSize:14,color:C.textFaint}}>с {new Date(shift.opened_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})} · {user.name}</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button style={S.btnSecondary} onClick={()=>setShowCashcoreSettings(s=>!s)}>⚙ ККМ</button>
          <button style={S.btnSecondary} onClick={()=>setShowHistory(s=>!s)}>{showHistory?"✕ Скрыть историю":"🧾 История"}</button>
          <button style={{...S.btnSecondary,color:C.red,borderColor:"#FCA5A5"}} disabled={closingShift} onClick={closeShift}>{closingShift?"Закрываем...":"⏹ Закончить смену"}</button>
        </div>
      </div>

      <div style={{display: isDesktop?"grid":"block", gridTemplateColumns: isDesktop?"minmax(0,1fr) 380px":undefined, gap:16, alignItems:"start"}}>
        <div>
          <input
            type="search"
            style={{...S.input,marginBottom:10}}
            placeholder="Поиск по названию, коду или штрихкоду..."
            value={search}
            onChange={e=>setSearch(e.target.value)}
            autoComplete="off"
            name="cashier-pos-search"
          />
          {categories.length>0&&(
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              <button onClick={()=>setCategory("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${category===""?C.navy:C.border}`,background:category===""?C.navy:C.white,color:category===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все</button>
              {categories.map(cat=>(
                <button key={cat} onClick={()=>setCategory(cat)} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${category===cat?C.navy:C.border}`,background:category===cat?C.navy:C.white,color:category===cat?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{cat}</button>
              ))}
            </div>
          )}
          <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(140px,1fr))",gap:10}}>
            {filtered.length===0&&<div style={{gridColumn:"1/-1",textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>Ничего не найдено</div>}
            {filtered.map(p=>{
              const outOfStock = stockIsOut(p);
              const inCart = cart.find(l=>l.code===p.code);
              return (
                <div key={p.code} style={{border:`1px solid ${C.border}`,borderRadius:R,overflow:"hidden",background:C.white,opacity:outOfStock?0.5:1}}>
                  <div style={{aspectRatio:"1",background:C.white,display:"flex",alignItems:"center",justifyContent:"center",padding:6,boxSizing:"border-box"}}>
                    {p.photo ? <img src={p.photo} style={{width:"100%",height:"100%",objectFit:"contain"}}/> : <span style={{fontSize:23,color:C.textFaint}}>📦</span>}
                  </div>
                  <div style={{padding:"6px 8px"}}>
                    <div style={{fontSize:13,fontWeight:600,color:C.text,marginBottom:2,minHeight:28,lineHeight:1.3}}>{p.name}</div>
                    <div style={{fontSize:14,fontWeight:800,fontFamily:FH,color:C.navy,marginBottom:6}}>{p.price1>0?p.price1.toLocaleString()+' ₸':'—'}</div>
                    {outOfStock ? (
                      <div style={{fontSize:12,color:C.red,textAlign:"center",padding:"6px 0"}}>Нет в наличии</div>
                    ) : inCart ? (
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.surface,borderRadius:8,padding:"2px"}}>
                        <button onClick={()=>changeQty(p.code,-1)} style={{width:24,height:24,border:"none",borderRadius:6,background:C.white,boxShadow:`0 0 0 1px ${C.border}`,fontSize:16,fontWeight:700,color:C.navy,cursor:"pointer"}}>−</button>
                        <span style={{fontSize:14,fontWeight:800,color:C.navy}}>{inCart.qty}</span>
                        <button onClick={()=>changeQty(p.code,1)} style={{width:24,height:24,border:"none",borderRadius:6,background:C.white,boxShadow:`0 0 0 1px ${C.border}`,fontSize:16,fontWeight:700,color:C.navy,cursor:"pointer"}}>+</button>
                      </div>
                    ) : (
                      <button onClick={()=>addToCart(p)} style={{width:"100%",padding:"6px",border:"none",borderRadius:8,background:C.navy,color:C.white,fontSize:13,fontWeight:700,cursor:"pointer"}}>Добавить</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {showHistory&&(
            <div style={{marginTop:24}}>
              <p style={{...S.sectionTitle,fontSize:17}}>Продажи сегодня ({historyList.length})</p>
              {historyList.length===0?<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>Продаж пока не было</div>:
                historyList.map(s=>(
                  <div key={s.id} style={S.card}>
                    <div style={S.row}>
                      <div>
                        <p style={S.cardTitle}>№ {s.id} · {s.client_name||"Без клиента"}</p>
                        <p style={S.cardSub}>{s.items.length} поз. · {s.created_by_name} · {new Date(s.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p>
                      </div>
                      <p style={{margin:0,fontWeight:800,fontFamily:FH,color:C.navy}}>{s.total.toLocaleString()} ₸</p>
                    </div>
                    {s.status==="voided" ? (
                      <p style={{margin:"8px 0 0",fontSize:13,color:C.red}}>Отменена</p>
                    ) : s.fiscal_id
                      ? <p style={{margin:"8px 0 0",fontSize:13,color:C.green}}>
                          🧾 Чек пробит · признак {s.fiscal_id}
                          {s.fiscal_return_id&&<><br/>↩️ Чек возврата пробит · признак {s.fiscal_return_id}</>}
                        </p>
                      : (
                        <div style={{marginTop:8}}>
                          <p style={{margin:"0 0 6px",fontSize:13,color:s.payment_debt>0?C.textFaint:C.red}}>
                            {s.payment_debt>0 ? "Чек не пробит (продажа с долгом — пробить можно после погашения)" : "⚠️ Чек не пробит"}
                          </p>
                          <button
                            style={{...S.btnSecondary,padding:"6px 14px",fontSize:14,width:"auto",opacity:fiscalizingSaleId===s.id?0.6:1}}
                            disabled={fiscalizingSaleId===s.id}
                            onClick={()=>retryFiscal(s)}
                          >{fiscalizingSaleId===s.id?"Пробиваю...":"🔁 Пробить чек"}</button>
                          {fiscalErrorBySale[s.id]&&<p style={{margin:"6px 0 0",fontSize:13,color:C.red}}>{fiscalErrorBySale[s.id]}</p>}
                        </div>
                      )}
                    {s.status!=="voided"&&<button style={{...S.btnDanger,marginTop:10,padding:"8px",fontSize:14}} onClick={()=>voidSale(s)}>Отменить продажу</button>}
                  </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {saleResult ? (
            <div style={S.card}>
              <p style={{margin:"0 0 10px",fontSize:17,fontWeight:800,color:C.navy}}>✅ Продажа №{saleResult.sale.id} оформлена — {saleResult.sale.total.toLocaleString()} ₸</p>
              {saleResult.skippedDebt&&(
                <div style={{...S.errorBox,background:"#FEF3E6",color:"#92400E",marginBottom:10}}>
                  В продаже есть долг — чек не пробивается автоматически (в ККМ нет типа оплаты "в долг").
                  Пробейте чек вручную после погашения.
                </div>
              )}
              {fiscalizing&&<div style={{padding:"10px 0",color:C.textSub,fontSize:15}}>Пробиваю чек через ККМ...</div>}
              {!fiscalizing&&saleResult.fiscal&&(
                <div style={{...S.errorBox,background:"#EAF5EE",color:"#15803D",marginBottom:10}}>
                  🧾 Чек пробит. Фискальный признак: {saleResult.fiscal.fiscal_id}{saleResult.fiscal.ofd_name?` (${saleResult.fiscal.ofd_name})`:''}
                </div>
              )}
              {!fiscalizing&&saleResult.fiscalError&&(
                <div style={S.errorBox}>
                  ⚠️ Чек не пробит: {saleResult.fiscalError}
                  <div style={{marginTop:8}}>
                    <button style={{...S.btnSecondary,width:"auto",padding:"6px 14px",fontSize:14}} onClick={()=>runFiscalize(saleResult.sale)}>🔁 Повторить</button>
                  </div>
                </div>
              )}
              <button style={{...S.btnPrimary,marginTop:10}} onClick={()=>setSaleResult(null)}>Новая продажа</button>
            </div>
          ) : <>
          <div style={S.card}>
            <div style={{...S.row,marginBottom:10}}>
              <p style={{margin:0,fontSize:17,fontWeight:800,color:C.navy}}>Текущий чек</p>
              {cart.length>0&&<button style={{background:"none",border:"none",color:C.red,fontSize:14,cursor:"pointer"}} onClick={clearCart}>Очистить</button>}
            </div>
            {cart.length===0
              ? <div style={{textAlign:"center",padding:"30px 0",color:C.textFaint}}><div style={{fontSize:36,marginBottom:8}}>🛒</div><p style={{margin:0,fontSize:15}}>Чек пока пуст —<br/>выберите товары слева</p></div>
              : cart.map(l=>(
                <div key={l.code} style={{display:"grid",gridTemplateColumns:"1fr 56px 80px 28px",gap:6,alignItems:"center",marginBottom:8}}>
                  <div style={{fontSize:15,color:C.textMid,fontWeight:600}}>{l.name}</div>
                  <input style={{...S.input,padding:"7px 6px",fontSize:15,textAlign:"center"}} type="number" min="1" max={l.stock!=null?l.stock:undefined} value={l.qty}
                    onChange={e=>{
                      let v = Number(e.target.value)||0;
                      if (l.stock!=null) v = Math.min(v, l.stock);
                      setCart(c=>c.map(x=>x.code===l.code?{...x,qty:Math.max(0,v)}:x));
                    }}
                    onFocus={e=>e.target.select()}
                  />
                  <input style={{...S.input,padding:"7px 6px",fontSize:15,textAlign:"right"}} type="number" value={l.price} onChange={e=>changePrice(l.code,e.target.value)} onFocus={e=>e.target.select()}/>
                  <button onClick={()=>removeFromCart(l.code)} style={{width:28,height:34,border:`1px solid ${C.border}`,borderRadius:8,background:C.surface,cursor:"pointer",fontSize:16,color:C.textFaint}}>×</button>
                </div>
              ))}
            {cart.length>0&&<><hr style={{...S.divider,marginTop:4}}/><div style={S.row}><span style={{fontSize:15,color:C.textSub}}>Итого</span><span style={{fontSize:19,fontWeight:800,fontFamily:FH,color:C.navy}}>{total.toLocaleString()} ₸</span></div></>}
          </div>

          <div style={S.card}>
            <p style={{...S.label,marginBottom:10,display:"block"}}>Клиент {remainder>0?<span style={{color:C.red,fontWeight:400}}>(обязателен для долга)</span>:<span style={{color:C.textFaint,fontWeight:400}}>(необязательно)</span>}</p>
            <div style={{position:"relative"}}>
              <input
                style={S.input}
                placeholder="Начните вводить название..."
                value={clientSearchText}
                onChange={e=>{ setClientSearchText(e.target.value); setClientId(""); setShowClientDrop(true); }}
                onFocus={()=>setShowClientDrop(true)}
                onBlur={()=>setTimeout(()=>setShowClientDrop(false),180)}
              />
              {showClientDrop&&(()=>{
                const matched = clientSearchText.length>0 ? clients.filter(c=>c.name.toLowerCase().includes(clientSearchText.toLowerCase())) : clients;
                return matched.length>0&&(
                  <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:200,overflowY:"auto"}}>
                    {matched.map(c=>(
                      <div key={c.code} onMouseDown={()=>{ setClientId(c.code); setClientSearchText(c.name); setShowClientDrop(false); }} style={{padding:"9px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15}}>{c.name}</div>
                    ))}
                  </div>
                );
              })()}
            </div>
          </div>

          <div style={S.card}>
            <p style={{margin:"0 0 12px",fontSize:15,fontWeight:700,color:C.navy}}>Оплата</p>
            {[{key:"cash",label:"Наличка",icon:"💵",bg:C.cashGreen,col:"#15803D"},{key:"qr",label:"QR код",icon:"📲",bg:C.qrBlue,col:"#1D4ED8"}].map(({key,label,icon,bg,col})=>(
              <div key={key} style={{marginBottom:10}}>
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div onClick={()=>toggleCashQr(key)} style={{width:22,height:22,borderRadius:6,border:`2px solid ${payType[key]?col:C.border}`,background:payType[key]?col:C.white,cursor:"pointer",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    {payType[key]&&<span style={{color:C.white,fontSize:15,fontWeight:700}}>✓</span>}
                  </div>
                  <span style={{fontSize:16,fontWeight:600,color:payType[key]?col:C.textMid}}>{icon} {label}</span>
                  {payType[key]&&<input style={{flex:1,border:`1.5px solid ${col}40`,borderRadius:6,padding:"6px 10px",fontSize:16,fontWeight:600,outline:"none",background:bg,color:col}} placeholder="Сумма ₸" value={payAmounts[key]} onFocus={e=>e.target.select()} onChange={e=>setPayAmounts(a=>({...a,[key]:e.target.value}))}/>}
                </div>
              </div>
            ))}
            <div style={{padding:"12px 14px",borderRadius:10,background:C.surface,border:`1px solid ${C.border}`}}>
              <div style={{...S.row,marginBottom:6}}><span style={{fontSize:14,color:C.textSub}}>Сумма продажи</span><span style={{fontWeight:700,fontFamily:FH}}>{total.toLocaleString()} ₸</span></div>
              <div style={{...S.row,paddingTop:6,borderTop:`1px solid ${C.border}`}}>
                <span style={{fontSize:15,fontWeight:700,color:overpaid?C.red:(remainder>0?"#92400E":C.green)}}>{overpaid?"⚠️ Оплачено больше суммы":(remainder>0?"📋 Долг":"✅ Полностью оплачено")}</span>
                {(remainder>0||overpaid)&&<span style={{fontWeight:800,fontSize:17,fontFamily:FH,color:overpaid?C.red:"#92400E"}}>{(overpaid?(cashAmt+qrAmt-total):remainder).toLocaleString()} ₸</span>}
              </div>
            </div>
          </div>

          {error&&<div style={S.errorBox}>{error}</div>}
          <button style={{...S.btnSuccess,opacity:canSubmit?1:0.45,cursor:canSubmit?"pointer":"not-allowed"}} disabled={!canSubmit} onClick={submit}>{submitting?"Оформление...":"✅ Оплатить"}</button>
          </>}
        </div>
      </div>
    </div>
  );
}

function AdminCabinet({ user, onLogout, desktop }) {
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("");
  const [salesFilter, setSalesFilter] = useState("");
  // "all" — все заявки, "dogovornik" — только договорники, "regular" — без
  // договора (остальные). Раньше был просто вкл/выкл фильтр "только
  // договорники" — этого хватало, пока обеим группам печаталась одна и та
  // же форма накладной; теперь у них РАЗНЫЕ формы печати (см.
  // printWaybillsBatch/buildExpenseWaybillInnerHtml), и часто нужно
  // отобрать именно "без договора" отдельным списком — не только
  // "договорники" или "все".
  const [dogovornikFilter, setDogovornikFilter] = useState("all");
  const [pickupOnly, setPickupOnly] = useState(false);
  // Отбор по времени доставки (см. TIME_SLOTS) внутри отбора "Заявки" за
  // конкретный день — доступен только при orderDatePreset==="day", иначе
  // "До обеда"/"После обеда" пришлось бы сравнивать заявки за недели/месяц
  // без даты рядом, что бессмысленно. Сбрасывается при уходе с "День" (см.
  // applyOrderDatePreset), чтобы скрытый чип не продолжал молча фильтровать.
  const [timeSlotFilter, setTimeSlotFilter] = useState("");
  const [showDogovornikModal, setShowDogovornikModal] = useState(false);
  const [orderSearch, setOrderSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const loadProducts = useCallback(async () => {
    try {
      const data = await fetch('/api/products').then(r => r.json());
      setProducts(data);
    } catch(e) {}
  }, []);
  useEffect(() => { loadProducts(); }, []);
  const [aliasSearch, setAliasSearch] = useState("");
  const [onlyMismatch, setOnlyMismatch] = useState(false);
  const [catalogAdminSearch, setCatalogAdminSearch] = useState("");
  const [catalogAdminSection, setCatalogAdminSection] = useState("");

  // ===== НКТ: подбор кода НКТ (NTIN) по штрихкоду через nct.gov.kz =====
  const [nktSearch, setNktSearch] = useState("");
  const [nktOnlyMissing, setNktOnlyMissing] = useState(true);
  const [nktRunning, setNktRunning] = useState(false);
  const [nktProgress, setNktProgress] = useState(null); // {done,total,matched,notFound,noBarcode,errors}
  const [nktPicker, setNktPicker] = useState(null); // {code, loading, results, error}
  // Ref, а не state — цикл в runNktMatch держит одно замыкание на весь
  // прогон (как editsRef выше), поэтому нажатие "Остановить" должно быть
  // видно этому же замыканию сразу, а не только в следующем вызове функции.
  const nktStopRef = useRef(false);

  // Гоняем пакетный подбор порциями по 25, а не всё разом — так виден
  // прогресс и один долгий запрос не упирается в таймаут на 3400 позициях.
  const runNktMatch = useCallback(async () => {
    const targets = products.filter(p => p.barcode && !p.nkt_code);
    if (targets.length === 0) { alert('Нет товаров со штрихкодом без кода НКТ'); return; }
    setNktRunning(true);
    nktStopRef.current = false;
    const summary = { done: 0, total: targets.length, matched: 0, notFound: 0, noBarcode: 0, errors: 0 };
    setNktProgress({ ...summary });
    for (let i = 0; i < targets.length; i += 25) {
      if (nktStopRef.current) break;
      const batch = targets.slice(i, i + 25).map(p => p.code);
      try {
        const { results } = await apiCall('POST', '/api/nkt/match-batch', { codes: batch });
        results.forEach(r => {
          summary.done++;
          if (r.status === 'matched') summary.matched++;
          else if (r.status === 'not_found') summary.notFound++;
          else if (r.status === 'no_barcode') summary.noBarcode++;
          else summary.errors++;
        });
      } catch (e) {
        summary.done += batch.length;
        summary.errors += batch.length;
      }
      setNktProgress({ ...summary });
    }
    await loadProducts();
    setNktRunning(false);
  }, [products, loadProducts]);

  const searchNktForProduct = useCallback(async (p) => {
    setNktPicker({ code: p.code, loading: true, results: [], error: '' });
    try {
      const params = p.barcode ? `gtin=${encodeURIComponent(p.barcode)}` : `q=${encodeURIComponent(p.name)}`;
      const { results } = await apiCall('GET', `/api/nkt/search?${params}`);
      setNktPicker({ code: p.code, loading: false, results, error: results.length === 0 ? 'Ничего не найдено' : '' });
    } catch (e) {
      setNktPicker({ code: p.code, loading: false, results: [], error: e.message });
    }
  }, []);

  const pickNktResult = useCallback(async (code, ntinCode) => {
    try {
      await apiCall('POST', '/api/product-aliases', { code, nkt_code: ntinCode });
      await loadProducts();
    } catch (e) { alert(e.message); }
    setNktPicker(null);
  }, [loadProducts]);

  const saveNktCodeManually = useCallback(async (code, value) => {
    try {
      await apiCall('POST', '/api/product-aliases', { code, nkt_code: value });
      await loadProducts();
    } catch (e) { alert(e.message); }
  }, [loadProducts]);
  const [edits, setEdits] = useState({});
  const [savingCode, setSavingCode] = useState(null);
  const [editingCodes, setEditingCodes] = useState({});
  const [aliasSectionsOpen, setAliasSectionsOpen] = useState({ unset: true, set: false });

  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientEdits, setClientEdits] = useState({});
  const [savingClientCode, setSavingClientCode] = useState(null);
  const [editingClientCodes, setEditingClientCodes] = useState({});

  const todayStr = new Date().toISOString().slice(0,10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [adminPreset, setAdminPreset] = useState("day");

  const applyAdminPreset = (preset) => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);
    else if (preset === "month") from.setDate(now.getDate() - 29);
    setAdminPreset(preset);
    if (preset !== "custom") {
      setDateFrom(from.toISOString().slice(0,10));
      setDateTo(todayStr);
    }
  };

  // Отбор по периоду для списка заявок (вкладка "Заявки") — отдельный от
  // dateFrom/dateTo отчёта выше, чтобы смена периода в отчёте не влияла
  // молча на список заявок и наоборот. По умолчанию "Все" — список заявок
  // и так всегда показывал всю историю, менять это неожиданно не хочется.
  const [orderDatePreset, setOrderDatePreset] = useState("all");
  const [orderDateFrom, setOrderDateFrom] = useState(todayStr);
  const [orderDateTo, setOrderDateTo] = useState(todayStr);
  const applyOrderDatePreset = (preset) => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);
    else if (preset === "month") from.setDate(now.getDate() - 29);
    setOrderDatePreset(preset);
    if (preset !== "custom" && preset !== "all") {
      setOrderDateFrom(from.toISOString().slice(0,10));
      setOrderDateTo(todayStr);
    }
    if (preset !== "day") setTimeSlotFilter("");
  };

  const [employees, setEmployees] = useState([]);
  const [users, setUsers] = useState([]);
  const [empSearch, setEmpSearch] = useState("");
  const [empForm, setEmpForm] = useState({});
  const [savingEmp, setSavingEmp] = useState(null);
  const [togglingUser, setTogglingUser] = useState(null);
  const [passwordEdits, setPasswordEdits] = useState({});
  const [changingPwd, setChangingPwd] = useState(null);
  const [roleEdits, setRoleEdits] = useState({});
  const [savingRole, setSavingRole] = useState(null);
  const [resettingSession, setResettingSession] = useState(null);
  const [empSectionsOpen, setEmpSectionsOpen] = useState({ noAccount: true, accounts: true, noStoreAccount: false });

  const loadEmployees = useCallback(async () => {
    try { setEmployees(await apiCall('GET','/api/employees')); } catch(e) {}
  }, []);
  const loadUsers = useCallback(async () => {
    try { setUsers(await apiCall('GET','/api/users')); } catch(e) {}
  }, []);
  useEffect(() => { loadEmployees(); loadUsers(); }, []);

  const ROLE_OPTIONS = [["sales","Торговый представитель"],["senior_sales","Старший торговый представитель"],["driver","Водитель"],["cashier","Кассир"],["warehouse","Зав. склад"],["operator","Оператор"],["manager","Менеджер"],["admin","Администратор"],["store","Магазин"]];

  const updateEmpForm = (formKey, field, value) => setEmpForm(f => ({...f, [formKey]: {...f[formKey], [field]: value}}));

  const createEmpAccount = async (emp, formKey) => {
    const form = empForm[formKey] || {};
    if (!form.login || !form.password || !form.role) { alert('Заполните логин, пароль и роль'); return; }
    if (form.password.length < 4) { alert('Пароль минимум 4 символа'); return; }
    setSavingEmp(formKey);
    try {
      await apiCall('POST','/api/users', { login: form.login, password: form.password, name: emp.name, role: form.role, region: form.region||'', employee_code: emp.code });
      await loadEmployees(); await loadUsers();
      setEmpForm(f => ({...f, [formKey]: {}}));
    } catch(e) { alert(e.message); }
    setSavingEmp(null);
  };

  const createStoreAccount = async (client, formKey) => {
    const form = empForm[formKey] || {};
    if (!form.login || !form.password) { alert('Заполните логин и пароль'); return; }
    if (form.password.length < 4) { alert('Пароль минимум 4 символа'); return; }
    setSavingEmp(formKey);
    try {
      await apiCall('POST','/api/users', { login: form.login, password: form.password, name: client.name, role: 'store', client_code: client.code });
      await loadClients(); await loadUsers();
      setEmpForm(f => ({...f, [formKey]: {}}));
    } catch(e) { alert(e.message); }
    setSavingEmp(null);
  };

  const toggleUser = async (u) => {
    if (!window.confirm(`${u.active===false?'Включить':'Отключить'} доступ для «${u.name}»?`)) return;
    setTogglingUser(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/toggle`, {});
      await loadUsers();
    } catch(e) { alert(e.message); }
    setTogglingUser(null);
  };

  const changeRole = async (u) => {
    const role = roleEdits[u.id];
    if (!role || role === u.role) return;
    if (!window.confirm(`Сменить роль «${u.name}» на «${ROLE_LABEL[role]||role}»?`)) return;
    setSavingRole(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/role`, { role });
      await loadUsers();
      setRoleEdits(r => { const n = {...r}; delete n[u.id]; return n; });
    } catch(e) { alert(e.message); }
    setSavingRole(null);
  };

  const changePassword = async (u) => {
    const pwd = (passwordEdits[u.id]||'').trim();
    if (!pwd || pwd.length < 4) { alert('Пароль минимум 4 символа'); return; }
    if (!window.confirm(`Сменить пароль для «${u.name}»?`)) return;
    setChangingPwd(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/password`, { password: pwd });
      setPasswordEdits(p => ({...p, [u.id]: ''}));
    } catch(e) { alert(e.message); }
    setChangingPwd(null);
  };

  const resetUserSession = async (u) => {
    if (!window.confirm(`Сбросить активную сессию «${u.name}»? Это позволит войти с другого устройства прямо сейчас.`)) return;
    setResettingSession(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/reset-session`, {});
      await loadUsers();
    } catch(e) { alert(e.message); }
    setResettingSession(null);
  };

  const loadClients = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/clients');
      setClients(data);
    } catch(e) {}
  }, []);

  useEffect(() => { loadClients(); }, []);

  const getClientField = (c, field) => {
    if (clientEdits[c.code] && clientEdits[c.code][field] !== undefined) return clientEdits[c.code][field];
    return c[field] || '';
  };
  const updateClientField = (code, field, value) => setClientEdits(e => ({...e, [code]: {...e[code], [field]: value}}));

  const saveClientAddress = async (c) => {
    const code = c.code;
    const address = getClientField(c, 'address');
    setSavingClientCode(code);
    try {
      await apiCall('POST', '/api/client-addresses', { code, address });
      await loadClients();
      setEditingClientCodes(e => { const n = {...e}; delete n[code]; return n; });
    } catch(e) { alert(e.message); }
    setSavingClientCode(null);
  };

  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch(e) { if(e.message.includes('токен')) onLogout(); }
    setLoading(false);
  }, []);

  useEffect(() => { loadOrders(); }, []);
  useRefetchOnVisible(loadOrders);

  // Разделы каталога — явный список (можно завести раздел заранее, до
  // того как в него попадёт товар), плюс объединяем с тем, что уже
  // фактически проставлено у товаров (categoryOptions ниже), чтобы старые
  // разделы из 1С тоже были доступны для переименования/удаления.
  const [categories, setCategories] = useState([]);
  const loadCategories = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/categories');
      setCategories(data);
    } catch(e) {}
  }, []);
  useEffect(() => { loadCategories(); }, []);

  const createCategory = useCallback(async (name) => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    try {
      await apiCall('POST', '/api/categories', { name: trimmed });
      await loadCategories();
    } catch(e) { alert(e.message); }
  }, [loadCategories]);

  const renameCategory = useCallback(async (oldName, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === oldName) return;
    try {
      await apiCall('PUT', `/api/categories/${encodeURIComponent(oldName)}`, { name: trimmed });
      await Promise.all([loadCategories(), loadProducts()]);
    } catch(e) { alert(e.message); }
  }, [loadCategories, loadProducts]);

  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const deleteCategory = useCallback(async (name) => {
    if (!window.confirm(`Удалить раздел «${name}»? У товаров этот раздел будет снят (станут «Без раздела»).`)) return;
    try {
      await apiCall('DELETE', `/api/categories/${encodeURIComponent(name)}`);
      await Promise.all([loadCategories(), loadProducts()]);
    } catch(e) { alert(e.message); }
  }, [loadCategories, loadProducts]);

  // Касса — продажа по каталогу (мгновенная, без доставки). См. /api/sales
  // на сервере: отдельная от orders коллекция, но делит остаток и сводится
  // в один отчёт с заявками ниже (salesReport).
  const [sales, setSales] = useState([]);
  const [showPosModal, setShowPosModal] = useState(false);
  const [showNewOrderModal, setShowNewOrderModal] = useState(false);
  const loadSales = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/sales');
      setSales(data);
    } catch(e) {}
  }, []);
  useEffect(() => { loadSales(); }, []);

  // Погашения долгов (нал/QR) — нужны, чтобы в отчёте долг показывался как
  // остаток на сейчас, а не как изначально выданная сумма, и чтобы
  // погашенное наличкой/QR добавлялось в кассовую выручку того же периода.
  const [debtSettlements, setDebtSettlements] = useState([]);
  const loadDebtSettlements = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/debt-settlements');
      setDebtSettlements(data);
    } catch(e) {}
  }, []);
  useEffect(() => { loadDebtSettlements(); }, []);
  useRefetchOnVisible(loadDebtSettlements);

  // Возвраты (частичные, по конкретным позициям — см. POST /api/returns) —
  // отдельная от статуса заявки сущность, вычитается из выручки/бонуса
  // нужного торгового в отчёте ниже (returnsByRep).
  const [returnsList, setReturnsList] = useState([]);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const loadReturns = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/returns');
      setReturnsList(data);
    } catch(e) {}
  }, []);
  useEffect(() => { loadReturns(); }, []);
  useRefetchOnVisible(loadReturns);

  // Сдача налички водителями (инкассация) — см. POST/PUT /api/cash-handovers.
  const [cashHandovers, setCashHandovers] = useState([]);
  const loadCashHandovers = useCallback(async () => {
    try { setCashHandovers(await apiCall('GET','/api/cash-handovers')); } catch(e) {}
  }, []);
  useEffect(() => { loadCashHandovers(); }, []);
  useRefetchOnVisible(loadCashHandovers);

  // Закрыть недостачу/излишек по уже подтверждённой сдаче (например, водитель
  // донёс недостающую сумму отдельно) — только администратор, см.
  // PUT /api/cash-handovers/:id/resolve-difference на сервере.
  const resolveDifference = async (h) => {
    const comment = window.prompt(`Закрыть ${h.difference<0?'недостачу':'излишек'} ${Math.abs(h.difference).toLocaleString()} ₸ у водителя «${h.driver_name}»?\n\nКомментарий (необязательно):`, '');
    if (comment === null) return;
    try {
      await apiCall('PUT', `/api/cash-handovers/${h.id}/resolve-difference`, { comment });
      loadCashHandovers();
    } catch(e) { alert(e.message); }
  };

  const [fiscalizingSaleId, setFiscalizingSaleId] = useState(null);
  const [fiscalErrorBySale, setFiscalErrorBySale] = useState({});
  const retryFiscal = useCallback(async (sale) => {
    setFiscalizingSaleId(sale.id);
    setFiscalErrorBySale(e => ({ ...e, [sale.id]: null }));
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      await loadSales();
    } catch (e) {
      setFiscalErrorBySale(er => ({ ...er, [sale.id]: e.message }));
    }
    setFiscalizingSaleId(null);
  }, [loadSales]);

  const voidSale = useCallback(async (sale) => {
    if (!window.confirm(`Отменить продажу № ${sale.id} на ${sale.total.toLocaleString()} ₸? Остаток вернётся на склад.`)) return;
    try {
      let fiscalReturn = {};
      if (sale.fiscal_id) {
        // Чек уже пробит в ККМ/ОФД — без обратного чека возврата отмена в
        // самом CashCore/налоговой не отразится, сервер это тоже проверит
        // и откажет, но лучше объяснить кассиру заранее.
        try {
          const r = await fiscalizeSale(sale, 3); // OPERATION_SELL_RETURN
          fiscalReturn = { fiscal_return_id: r.fiscal_id, fiscal_return_qr: r.qr_code };
        } catch (fe) {
          alert(`Не удалось пробить чек возврата: ${fe.message}\n\nПродажа НЕ отменена — иначе в ОФД останется чек без документа возврата. Попробуйте ещё раз, когда касса будет доступна.`);
          return;
        }
      }
      await apiCall('POST', `/api/sales/${sale.id}/void`, fiscalReturn);
      await loadSales();
    } catch(e) { alert(e.message); }
  }, [loadSales]);

  const getField = (p, field) => {
    if (edits[p.code] && edits[p.code][field] !== undefined) return edits[p.code][field];
    if (field === 'alias') return p.has_alias ? p.display_name : '';
    if (field === 'category') return p.group || '';
    if (field === 'priced_by_weight') return !!p.priced_by_weight;
    return p[field] != null ? String(p[field]) : '';
  };
  const categoryOptions = useMemo(() => [...new Set([...products.map(p=>p.group).filter(Boolean), ...categories])].sort((a,b)=>a.localeCompare(b,'ru')), [products, categories]);
  // updateField передаётся вниз в 150+ мемоизированных карточек, поэтому
  // должен иметь стабильную ссылку (useCallback без зависимостей, только
  // функциональный setState) — иначе React.memo на карточках бесполезен.
  const updateField = useCallback((code, field, value) => setEdits(e => ({...e, [code]: {...e[code], [field]: value}})), []);
  const onEditRequest = useCallback((code) => setEditingCodes(e => ({...e, [code]: true})), []);

  // saveAlias тоже должен быть стабильным, поэтому актуальные edits/products
  // читаем из ref, а не из замыкания над состоянием.
  const editsRef = useRef(edits);
  useEffect(() => { editsRef.current = edits; }, [edits]);

  const saveAlias = useCallback(async (p) => {
    const code = p.code;
    const fieldsFromEdits = editsRef.current[code] || {};
    const resolve = (field) => fieldsFromEdits[field] !== undefined
      ? fieldsFromEdits[field]
      : (field === 'alias' ? (p.has_alias ? p.display_name : '') : (field === 'priced_by_weight' ? !!p.priced_by_weight : (p[field] != null ? String(p[field]) : '')));
    const alias = resolve('alias');
    const price1 = resolve('price1');
    const price2 = resolve('price2');
    const price3 = resolve('price3');
    const commission = resolve('commission');
    const cost = resolve('cost');
    const pricedByWeight = resolve('priced_by_weight');
    const avgBoxWeight = resolve('avg_box_weight');
    setSavingCode(code);
    try {
      await apiCall('POST', '/api/product-aliases', {
        code, alias,
        price1: price1 === '' ? null : Number(price1),
        price2: price2 === '' ? null : Number(price2),
        price3: price3 === '' ? null : Number(price3),
        commission: commission === '' ? 0 : Number(commission),
        cost: cost === '' ? null : Number(cost),
        priced_by_weight: !!pricedByWeight,
        avg_box_weight: avgBoxWeight === '' ? null : Number(avgBoxWeight),
      });
      await loadProducts();
      setEditingCodes(e => { const n = {...e}; delete n[code]; return n; });
    } catch(e) { alert(e.message); }
    setSavingCode(null);
  }, [loadProducts]);

  // Раздел (вкладка "Каталог") сохраняется отдельно от цен/названия — своя
  // кнопка "Сохр.", без запроса на разблокировку. Сервер шлёт только
  // {code, category}, alias в этот запрос не попадает (см. фикс в
  // POST /api/product-aliases — иначе тихо стёрло бы название сайта).
  const [savingCategoryCode, setSavingCategoryCode] = useState(null);
  const saveCategory = useCallback(async (p) => {
    const code = p.code;
    const fieldsFromEdits = editsRef.current[code] || {};
    const category = fieldsFromEdits.category !== undefined ? fieldsFromEdits.category : (p.group || '');
    const barcode = fieldsFromEdits.barcode !== undefined ? fieldsFromEdits.barcode : (p.barcode || '');
    setSavingCategoryCode(code);
    try {
      await apiCall('POST', '/api/product-aliases', { code, category, barcode });
      await loadProducts();
    } catch(e) { alert(e.message); }
    setSavingCategoryCode(null);
  }, [loadProducts]);

  // Стабильная ссылка (как saveAlias) — передаётся в 150+ мемоизированных
  // ProductCatalogCard. Ответственность карточки — сжать фото и показать
  // ошибку/спиннер; загрузка на сервер и обновление списка — здесь.
  const uploadProductPhoto = useCallback(async (code, imageBase64) => {
    await apiCall('POST', `/api/products/${code}/photo`, { imageBase64 });
    await loadProducts();
  }, [loadProducts]);

  const removeProductPhoto = useCallback(async (code) => {
    await apiCall('DELETE', `/api/products/${code}/photo`);
    await loadProducts();
  }, [loadProducts]);

  const handleUpdate = async (id, status, payment, driverId, items) => {
    try {
      await apiCall('PUT', `/api/orders/${id}/status`, { status, payment, driverId, items });
      setSelectedOrder(null); loadOrders();
    } catch(e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    try {
      await apiCall('DELETE', `/api/orders/${id}`);
      setSelectedOrder(null); loadOrders();
    } catch(e) { alert(e.message); }
  };

  // Ручная правка закупочной цены позиции без кода товара (см. комментарий
  // у PUT /api/orders/:orderId/items/:itemIndex/cost на сервере) — не
  // закрывает модалку заявки, чтобы сразу было видно результат.
  const fixItemCost = async (orderId, itemIndex, cost) => {
    const updated = await apiCall('PUT', `/api/orders/${orderId}/items/${itemIndex}/cost`, { cost });
    setSelectedOrder(updated);
    loadOrders();
  };

  // Исправление уже подтверждённого веса (человеческий фактор при
  // взвешивании) — доступно только admin/manager, см. проверку
  // canOverride в POST /api/orders/weights на сервере. Переиспользуем тот
  // же массовый эндпоинт склада, просто с одной записью.
  const fixItemWeight = async (orderId, code, weight) => {
    const res = await apiCall('POST', '/api/orders/weights', { entries: [{ orderId, code, weight }] });
    if (res.errors && res.errors.length) throw new Error(res.errors.join('\n'));
    const data = await apiCall('GET', '/api/orders');
    setOrders(data);
    const updated = data.find(o=>o.id===orderId);
    if (updated) setSelectedOrder(updated);
  };

  // Правка кол-ва по позициям уже ДОСТАВЛЕННОЙ заявки задним числом — см.
  // PUT /api/orders/:id/delivered-items на сервере (доступ там тоже
  // проверяется, здесь только для того, чтобы кнопка вообще не
  // показывалась не-admin, см. OrderDetail).
  const editDeliveredItems = async (orderId, items, reason) => {
    const res = await apiCall('PUT', `/api/orders/${orderId}/delivered-items`, { items, reason });
    setSelectedOrder(res);
    loadOrders();
    return res;
  };

  // Свободная правка цены позиций — только admin, до статуса "Доставлено"
  // включительно (см. PUT /api/orders/:id/prices на сервере). Нужна для
  // VIP/оптовых клиентов с эксклюзивной ценой, которую торговый не знал на
  // момент оформления заявки.
  const editPrices = async (orderId, items, reason) => {
    const res = await apiCall('PUT', `/api/orders/${orderId}/prices`, { items, reason });
    setSelectedOrder(res);
    loadOrders();
    return res;
  };

  const [expandedSales, setExpandedSales] = useState({});
  const [cashboxGroupBy, setCashboxGroupBy] = useState("driver");
  // Клик по кругляшкам НАЛ/QR/ДОЛГ в сводке "Касса за период" прокручивает
  // к соответствующему разделу ниже — вместо того чтобы заставлять
  // оператора искать долги/сдачу кассы листанием вручную.
  const debtorsSectionRef = useRef(null);
  const cashHandoverSectionRef = useRef(null);
  const scrollToSection = (ref) => ref.current && ref.current.scrollIntoView({ behavior: "smooth", block: "start" });

  // Эти вычисления раньше выполнялись при каждом рендере компонента (в т.ч. на
  // каждое нажатие клавиши в других вкладках, например "Товары"), потому что
  // перебирали весь список заказов. useMemo пересчитывает их только когда
  // реально меняются orders/products/фильтры, а не на любой setState где-либо
  // в AdminCabinet.
  // Список водителей для отбора — из самих заявок (а не из /api/users), чтобы
  // в списке были только те, кто реально что-то возил, без лишних неактивных
  // аккаунтов.
  const driverOptions = useMemo(() => {
    const map = {};
    orders.forEach(o => { if (o.driver_id) map[o.driver_id] = o.driver_name; });
    return Object.entries(map).map(([id,name])=>({id,name})).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
  }, [orders]);

  // Список торговых для отбора — из самих заявок, тем же паттерном, что и
  // driverOptions: только те, кто реально оформил хотя бы одну заявку.
  const salesOptions = useMemo(() => {
    const map = {};
    orders.forEach(o => { if (o.sales_id) map[o.sales_id] = o.sales_name; });
    return Object.entries(map).map(([id,name])=>({id,name})).sort((a,b)=>(a.name||'').localeCompare(b.name||'','ru'));
  }, [orders]);

  // Коды клиентов-договорников (см. PUT /api/clients/:code/dogovornik) — для
  // отбора заявок по этой группе ниже. Заявка сама по себе такую пометку не
  // хранит (это свойство контрагента, а не разовой заявки), поэтому сверяем
  // по client_code с уже загруженным списком клиентов.
  const dogovornikCodes = useMemo(() => new Set(clients.filter(c=>c.is_dogovornik).map(c=>c.code)), [clients]);
  // Код->название из 1С для печати накладных (см. OrderDetail выше и
  // printWaybillsBatch) — позиция заявки хранит псевдоним, а не название
  // из 1С.
  const productNameByCode = useMemo(() => {
    const map = {};
    products.forEach(p => { map[p.code] = p.name; });
    return map;
  }, [products]);
  const q = orderSearch.trim().toLowerCase();
  const filtered = useMemo(() => orders
    .filter(o=>filter==="all"||o.status===filter)
    .filter(o=>!driverFilter||String(o.driver_id)===driverFilter)
    .filter(o=>!salesFilter||String(o.sales_id)===salesFilter)
    .filter(o=>dogovornikFilter==="all"||(dogovornikFilter==="dogovornik"?dogovornikCodes.has(o.client_code):!dogovornikCodes.has(o.client_code)))
    .filter(o=>!pickupOnly||o.time_slot===PICKUP_SLOT)
    .filter(o=>orderDatePreset==="all"||(o.date>=orderDateFrom&&o.date<=orderDateTo))
    .filter(o=>orderDatePreset!=="day"||!timeSlotFilter||o.time_slot===timeSlotFilter)
    .filter(o=>!q
      || String(o.id).includes(q)
      || (o.client_name||'').toLowerCase().includes(q)
      || (o.sales_name||'').toLowerCase().includes(q)
      || (o.driver_name||'').toLowerCase().includes(q)
      || (o.address||'').toLowerCase().includes(q)), [orders, filter, driverFilter, salesFilter, dogovornikFilter, dogovornikCodes, pickupOnly, orderDatePreset, orderDateFrom, orderDateTo, timeSlotFilter, q]);

  const { stats, repList, storeList, driverCashList, repCashList, posReport, returnsInfo, totalCommission } = useMemo(() => {
    // Погашение долга нал/QR "перетекает" из долга в наличку/QR того же
    // заказа/продажи — иначе касса за период не сходится с тем, что
    // оператор реально погасил, а долг в сводке зависает на изначальной
    // сумме, даже если по нему уже расплатились.
    const settledByOrder = {};
    const settledBySale = {};
    debtSettlements.forEach(s => {
      const bucket = s.order_id ? settledByOrder : settledBySale;
      const key = s.order_id || s.sale_id;
      if (!bucket[key]) bucket[key] = { cash: 0, qr: 0, total: 0 };
      if (s.method === 'qr') bucket[key].qr += s.amount; else bucket[key].cash += s.amount;
      bucket[key].total += s.amount;
    });
    const orderSettledCash = o => (settledByOrder[o.id]||{}).cash || 0;
    const orderSettledQr = o => (settledByOrder[o.id]||{}).qr || 0;
    const orderRemainingDebt = o => Math.max(0, (o.payment_debt||0) - ((settledByOrder[o.id]||{}).total||0));
    const saleSettledCash = s => (settledBySale[s.id]||{}).cash || 0;
    const saleSettledQr = s => (settledBySale[s.id]||{}).qr || 0;
    const saleRemainingDebt = s => Math.max(0, (s.payment_debt||0) - ((settledBySale[s.id]||{}).total||0));

    const periodOrders = orders.filter(o=>o.date>=dateFrom&&o.date<=dateTo);
    const stats = {
      total:periodOrders.length,
      delivered:periodOrders.filter(o=>o.status==="delivered").length,
      inTransit:periodOrders.filter(o=>o.status==="in_transit").length,
      cancelled:periodOrders.filter(o=>o.status==="cancelled").length,
      returned:periodOrders.filter(o=>o.status==="returned").length,
      revenue:periodOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(o.total||0),0),
      cashTotal:periodOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(o.payment_cash||0)+orderSettledCash(o),0),
      qrTotal:periodOrders.filter(o=>o.status==="delivered").reduce((s,o)=>s+(o.payment_qr||0)+orderSettledQr(o),0),
      debtTotal:periodOrders.reduce((s,o)=>s+orderRemainingDebt(o),0),
    };
    const deliveredOrders = periodOrders.filter(o=>o.status==="delivered");
    const ordersProfit = sumItemsProfit(deliveredOrders);
    stats.costTotal = ordersProfit.cost;
    stats.profit = ordersProfit.profit;
    stats.profitMissingLines = ordersProfit.missingCostLines;
    stats.profitMissingItems = ordersProfit.missingCostItems;

    // Продажи по кассе за тот же период — отдельно от заявок на доставку,
    // но объединяем в общую сумму (combinedCash/Qr/Debt) ниже, чтобы
    // менеджер видел одну кассовую сумму, а не считал вручную по двум местам.
    const periodSales = sales.filter(s=>s.date>=dateFrom&&s.date<=dateTo&&s.status!=="voided");
    const posReport = {
      count: periodSales.length,
      revenue: periodSales.reduce((s,o)=>s+(o.total||0),0),
      cashTotal: periodSales.reduce((s,o)=>s+(o.payment_cash||0)+saleSettledCash(o),0),
      qrTotal: periodSales.reduce((s,o)=>s+(o.payment_qr||0)+saleSettledQr(o),0),
      debtTotal: periodSales.reduce((s,o)=>s+saleRemainingDebt(o),0),
      list: periodSales.slice().sort((a,b)=>b.id-a.id),
      combinedCash: stats.cashTotal + periodSales.reduce((s,o)=>s+(o.payment_cash||0)+saleSettledCash(o),0),
      combinedQr: stats.qrTotal + periodSales.reduce((s,o)=>s+(o.payment_qr||0)+saleSettledQr(o),0),
      combinedDebt: stats.debtTotal + periodSales.reduce((s,o)=>s+saleRemainingDebt(o),0),
      combinedRevenue: stats.revenue + periodSales.reduce((s,o)=>s+(o.total||0),0),
    };
    const salesProfit = sumItemsProfit(periodSales);
    posReport.costTotal = salesProfit.cost;
    posReport.profit = salesProfit.profit;
    posReport.profitMissingLines = salesProfit.missingCostLines;
    posReport.profitMissingItems = salesProfit.missingCostItems;
    posReport.combinedCost = stats.costTotal + salesProfit.cost;
    posReport.combinedProfit = stats.profit + salesProfit.profit;
    posReport.combinedProfitMissingLines = stats.profitMissingLines + salesProfit.missingCostLines;
    // Дедуп по коду/имени между заявками и кассой — один и тот же товар без
    // закупочной цены не должен назваться дважды в общем предупреждении.
    const combinedMissingMap = {};
    [...ordersProfit.missingCostItems, ...salesProfit.missingCostItems].forEach(it => {
      const key = it.code || it.name;
      if (key && !combinedMissingMap[key]) combinedMissingMap[key] = it;
    });
    posReport.combinedProfitMissingItems = Object.values(combinedMissingMap);

    const commissionByCode = {};
    products.forEach(p => { commissionByCode[p.code] = p.commission || 0; });
    // Разбито на два свода по order.source: "sales" — реальные торгпреды
    // (у них комиссия — их заработок), "store" — магазины, оформившие
    // заказ сами себе (sales_id там — это аккаунт самого магазина, не
    // сотрудник; раньше оба вида смешивались в одном списке под общим
    // заголовком "По торговым представителям", отличить можно было только
    // по имени в списке).
    const repBreakdown = {};
    const storeBreakdown = {};
    periodOrders.filter(o=>o.status==="delivered").forEach(o=>{
      const bucket = o.source === "store" ? storeBreakdown : repBreakdown;
      const key = o.sales_id;
      if(!bucket[key]) bucket[key] = { name: o.sales_name, revenue: 0, items: [], cash: 0, qr: 0, debt: 0, orders: 0 };
      bucket[key].revenue += (o.total||0);
      bucket[key].cash += (o.payment_cash||0) + orderSettledCash(o);
      bucket[key].qr += (o.payment_qr||0) + orderSettledQr(o);
      bucket[key].debt += orderRemainingDebt(o);
      bucket[key].orders += 1;
      const orderItems = typeof o.items === 'string' ? JSON.parse(o.items||'[]') : (o.items||[]);
      orderItems.forEach(it=>{
        // Комиссия фиксируется на позиции заявки в момент оформления (см.
        // POST /api/orders, commission_total) — используем этот снимок, а
        // не текущую ставку из карточки товара, точно так же как cost
        // (себестоимость) не пересчитывается задним числом (см.
        // sumItemsProfit). Раньше отчёт брал ЖИВУЮ ставку commissionByCode
        // в приоритете, и правка комиссии у товара молча переписывала уже
        // начисленный/выплаченный бонус торговых за прошлые периоды.
        // commissionByCode остаётся только запасным вариантом для старых
        // заявок, оформленных до того, как commission стало сохраняться
        // на позиции.
        const frozenCommission = it.commission != null
          ? Number(it.commission)
          : (it.code && commissionByCode[it.code] !== undefined ? commissionByCode[it.code] : 0);
        bucket[key].items.push({
          name: it.name,
          qty: it.qty,
          price: it.price,
          commission: frozenCommission,
          // Комиссия — фиксированная сумма в ₸ за единицу товара, а не % от
          // суммы строки (раньше было qty*price*commission/100).
          bonus: (Number(it.qty)||0)*frozenCommission
        });
      });
    });
    // Возвраты по конкретным позициям (см. POST /api/returns) — отдельная от
    // статуса заявки сущность: магазин мог вернуть 1 из 5 коробок, или товар
    // испортился уже после доставки. Считаются в периоде ДАТЫ САМОГО
    // ВОЗВРАТА (а не заявки) и вычитаются из выручки/бонуса того торгового,
    // к кому привязаны (order.sales_id или явно выбранный salesId) — заявка
    // при этом остаётся "доставлена", отчёт по ней не переписывается задним
    // числом.
    const periodReturns = returnsList.filter(r=>r.date>=dateFrom&&r.date<=dateTo);
    const returnsItemized = {
      count: periodReturns.length,
      revenue: periodReturns.reduce((s,r)=>s+(r.total||0),0),
      cost: periodReturns.reduce((s,r)=>s+(r.items||[]).reduce((ss,it)=>ss+(it.cost!=null?(Number(it.qty)||0)*it.cost:0),0),0),
      bonus: periodReturns.reduce((s,r)=>s+(r.items||[]).reduce((ss,it)=>ss+(Number(it.qty)||0)*(Number(it.commission)||0),0),0),
      unattributed: periodReturns.filter(r=>r.sales_id==null).reduce((s,r)=>s+(r.total||0),0),
      list: periodReturns.slice().sort((a,b)=>b.date.localeCompare(a.date)),
    };
    periodReturns.forEach(r=>{
      if (r.sales_id == null) return; // без привязки к торговому — только в общем итоге, бонус вычесть не у кого
      const key = r.sales_id;
      const targetBucket = storeBreakdown[key] ? storeBreakdown : repBreakdown;
      if (!targetBucket[key]) targetBucket[key] = { name: r.sales_name || ('#'+key), revenue:0, items:[], cash:0, qr:0, debt:0, orders:0 };
      targetBucket[key].revenue -= (r.total||0);
      (r.items||[]).forEach(it=>{
        targetBucket[key].items.push({
          name: `↩️ Возврат: ${it.name}`,
          qty: -(Number(it.qty)||0),
          price: it.price,
          commission: it.commission||0,
          bonus: -(Number(it.qty)||0)*(Number(it.commission)||0),
        });
      });
    });

    const toList = (breakdown) => Object.entries(breakdown).map(([id,v])=>({
      id, ...v, totalBonus: v.items.reduce((s,it)=>s+it.bonus,0)
    })).sort((a,b)=>b.revenue-a.revenue);
    const repList = toList(repBreakdown);
    const storeList = toList(storeBreakdown);

    // Общий итог (combined*) — тоже за вычетом итемизированных возвратов,
    // иначе выручка/прибыль в сводке не сходится с тем, что уже вычтено
    // из бонусов торговых выше.
    posReport.combinedRevenue -= returnsItemized.revenue;
    posReport.combinedCost -= returnsItemized.cost;
    posReport.combinedProfit -= (returnsItemized.revenue - returnsItemized.cost);

    // Возвраты за период: отказы/возвраты заявок (доставка не состоялась
    // или товар вернули) плюс отменённые продажи кассы. И то, и другое уже
    // снимает резерв остатка (см. computeAvailableStock на сервере), но
    // нигде не суммировалось как "сколько выручки не случилось из-за
    // возвратов" — только этот блок это считает.
    const lostOrders = periodOrders.filter(o=>o.status==="cancelled"||o.status==="returned");
    const lostOrdersRevenue = lostOrders.reduce((s,o)=>s+(o.total||0),0);
    const voidedSales = sales.filter(s=>s.date>=dateFrom&&s.date<=dateTo&&s.status==="voided");
    const voidedSalesRevenue = voidedSales.reduce((s,o)=>s+(o.total||0),0);
    // Плюс итемизированные возвраты (частично/после доставки, см. выше) —
    // раньше в эту сумму попадали только целиком отменённые заявки/продажи.
    const returnsRevenue = lostOrdersRevenue + voidedSalesRevenue + returnsItemized.revenue;
    const successfulRevenue = stats.revenue + periodSales.reduce((s,o)=>s+(o.total||0),0);
    const returnsInfo = {
      count: lostOrders.length + voidedSales.length + returnsItemized.count,
      ordersCount: lostOrders.length,
      ordersRevenue: lostOrdersRevenue,
      salesCount: voidedSales.length,
      salesRevenue: voidedSalesRevenue,
      revenue: returnsRevenue,
      itemized: returnsItemized,
      // доля возвратов от всего оборота за период (успешное + вернувшееся) —
      // а не от одной только успешной выручки, иначе цифра занижена.
      share: (successfulRevenue + returnsRevenue) > 0 ? (returnsRevenue / (successfulRevenue + returnsRevenue) * 100) : 0,
    };

    const cashByDriver = {};
    periodOrders.filter(o=>o.status==="delivered"&&o.driver_id).forEach(o=>{
      const key = o.driver_id;
      if(!cashByDriver[key]) cashByDriver[key] = { name: o.driver_name, cash:0, qr:0, debt:0, orders:0 };
      cashByDriver[key].cash += (o.payment_cash||0) + orderSettledCash(o);
      cashByDriver[key].qr += (o.payment_qr||0) + orderSettledQr(o);
      cashByDriver[key].debt += orderRemainingDebt(o);
      cashByDriver[key].orders += 1;
    });
    const driverCashList = Object.values(cashByDriver).sort((a,b)=>b.cash-a.cash);
    // Та же сдача кассы, но сгруппированная по торговым представителям —
    // переключатель в разделе "Сдача кассы" даёт выбрать разрез (по
    // водителям, кто физически привёз наличку, или по торговым, чьи это
    // продажи и кому считать план/бонус).
    const repCashList = Object.entries(repBreakdown)
      .map(([id,v])=>({ id, name: v.name, cash: v.cash, qr: v.qr, debt: v.debt, orders: v.orders }))
      .sort((a,b)=>b.cash-a.cash);

    // Бонус торговых — реальный расход владельца (выплачивается сотруднику),
    // поэтому вычитаем только repList (настоящие торгпреды). storeList — это
    // магазины, оформившие заказ сами себе (см. комментарий у repBreakdown
    // выше): их "бонус" никому не выплачивается, включать его в расход было
    // бы задвоением — прибыль занизилась бы на сумму, которая на самом деле
    // осталась у владельца. Кассовые продажи (/api/sales) бонус вообще не
    // считают (нет комиссии у кассира) — totalCommission корректен и для
    // combinedProfit ниже, доля кассы в нём просто равна нулю.
    const totalCommission = repList.reduce((s, r) => s + r.totalBonus, 0);

    return { stats, repList, storeList, driverCashList, repCashList, posReport, returnsInfo, totalCommission };
  }, [orders, sales, products, dateFrom, dateTo, debtSettlements, returnsList]);

  const FILTERS=[["all","Все"],["new","Ожидает"],["in_transit","В работе"],["delivered","Доставлено"],["cancelled","Отказ"],["returned","Возврат"],["revoked","Отозвана"]];
  // Оператор — только два раздела (Заявки, Касса), и без прав на изменение
  // в них (см. readOnlyOp ниже): видит, но не правит, кроме сумм по
  // должникам (POST /api/debts/settle) и WhatsApp — тем ничего на сервере
  // не требуется вовсе.
  const readOnlyOp = user.role==="operator";
  // "Сотрудники" — логины/пароли и назначение ролей, это уровень доступа
  // владельца (admin), менеджеру эта вкладка не нужна и не должна быть
  // видна вовсе (просьба владельца), в отличие от operator, которому и так
  // урезан весь список вкладок выше.
  const TABS = readOnlyOp
    ? [["all","📋","Заявки"],["cashbox","💵","Касса"]]
    : user.role==="manager"
      ? [["all","📋","Заявки"],["report","📊","Отчёт"],["cashbox","💵","Касса"],["aliases","🏷","Товары"],["stock","📦","Остатки"]]
      : [["all","📋","Заявки"],["report","📊","Отчёт"],["cashbox","💵","Касса"],["aliases","🏷","Товары"],["stock","📦","Остатки"],["employees","👤","Сотрудники"]];
  const TAB_TITLES={all:"Заявки",report:"Отчёт",cashbox:"Касса",aliases:"Псевдонимы товаров",stock:"Остатки",catalog:"Каталог",nkt:"Коды НКТ",employees:"Сотрудники"};

  const dateRangeInputs = (
    <div style={{marginBottom:16,maxWidth:420}}>
      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
        {[["day","День"],["week","Неделя"],["month","Месяц"],["custom","Свободный отбор"]].map(([k,lb])=>(
          <button key={k} onClick={()=>applyAdminPreset(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${adminPreset===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:adminPreset===k?C.navy:C.white,color:adminPreset===k?C.white:C.textMid}}>{lb}</button>
        ))}
      </div>
      {adminPreset==="custom"&&(
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>С</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={dateFrom} onChange={e=>setDateFrom(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>По</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={dateTo} onChange={e=>setDateTo(e.target.value)}/>
          </div>
        </div>
      )}
    </div>
  );

  const filterChips = (
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap"}}>
      {FILTERS.map(([k,lb])=>(
        <button key={k} onClick={()=>setFilter(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${filter===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:filter===k?C.navy:C.white,color:filter===k?C.white:C.textMid}}>{lb}</button>
      ))}
    </div>
  );

  const orderDateFilterUI = (
    <div style={{marginBottom:16}}>
      <div style={{display:"flex",gap:6,marginBottom:(orderDatePreset==="custom"||orderDatePreset==="day")?10:0,flexWrap:"wrap"}}>
        {[["all","Все"],["day","День"],["week","Неделя"],["month","Месяц"],["custom","Свободный отбор"]].map(([k,lb])=>(
          <button key={k} onClick={()=>applyOrderDatePreset(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${orderDatePreset===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:orderDatePreset===k?C.navy:C.white,color:orderDatePreset===k?C.white:C.textMid}}>{lb}</button>
        ))}
      </div>
      {orderDatePreset==="day"&&(
        <div style={{maxWidth:200}}>
          <label style={{...S.label,marginBottom:4}}>Дата</label>
          <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={orderDateFrom} onChange={e=>{setOrderDateFrom(e.target.value);setOrderDateTo(e.target.value);}}/>
        </div>
      )}
      {orderDatePreset==="custom"&&(
        <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap",maxWidth:420}}>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>С</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={orderDateFrom} onChange={e=>setOrderDateFrom(e.target.value)}/>
          </div>
          <div style={{flex:1,minWidth:120}}>
            <label style={{...S.label,marginBottom:4}}>По</label>
            <input type="date" style={{...S.input,padding:"8px 10px",fontSize:15}} value={orderDateTo} onChange={e=>setOrderDateTo(e.target.value)}/>
          </div>
        </div>
      )}
    </div>
  );

  // Показывается только при отборе за конкретный день (orderDatePreset==="day")
  // — по просьбе владельца: за день заявки удобно разом видеть отдельно "до
  // обеда" и "после обеда" (см. TIME_SLOTS), а не одним общим списком.
  const timeSlotFilterChip = orderDatePreset==="day" && (
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:14,color:C.textFaint,fontWeight:600}}>Время доставки:</span>
      <button onClick={()=>setTimeSlotFilter("")} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${timeSlotFilter===""?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:timeSlotFilter===""?C.navy:C.white,color:timeSlotFilter===""?C.white:C.textMid}}>Все</button>
      {TIME_SLOTS.map(slot=>(
        <button key={slot} onClick={()=>setTimeSlotFilter(slot)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${timeSlotFilter===slot?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:timeSlotFilter===slot?C.navy:C.white,color:timeSlotFilter===slot?C.white:C.textMid}}>{slot}</button>
      ))}
    </div>
  );

  const driverFilterChips = driverOptions.length>0 && (
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:14,color:C.textFaint,fontWeight:600}}>Водитель:</span>
      <button onClick={()=>setDriverFilter("")} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${driverFilter===""?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:driverFilter===""?C.navy:C.white,color:driverFilter===""?C.white:C.textMid}}>Все</button>
      {driverOptions.map(d=>(
        <button key={d.id} onClick={()=>setDriverFilter(String(d.id))} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${driverFilter===String(d.id)?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:driverFilter===String(d.id)?C.navy:C.white,color:driverFilter===String(d.id)?C.white:C.textMid}}>{d.name}</button>
      ))}
    </div>
  );

  const salesFilterChips = salesOptions.length>0 && (
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:14,color:C.textFaint,fontWeight:600}}>Торговый:</span>
      <button onClick={()=>setSalesFilter("")} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${salesFilter===""?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:salesFilter===""?C.navy:C.white,color:salesFilter===""?C.white:C.textMid}}>Все</button>
      {salesOptions.map(s=>(
        <button key={s.id} onClick={()=>setSalesFilter(String(s.id))} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${salesFilter===String(s.id)?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:salesFilter===String(s.id)?C.navy:C.white,color:salesFilter===String(s.id)?C.white:C.textMid}}>{s.name}</button>
      ))}
    </div>
  );

  const dogovornikFilterChip = (
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:14,color:C.textFaint,fontWeight:600}}>Договорники:</span>
      {[["all","Все"],["dogovornik","🏷 Договорники"],["regular","Без договора"]].map(([k,label])=>(
        <button key={k} onClick={()=>setDogovornikFilter(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${dogovornikFilter===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:dogovornikFilter===k?C.navy:C.white,color:dogovornikFilter===k?C.white:C.textMid}}>{label}</button>
      ))}
      {!readOnlyOp&&<button onClick={()=>setShowDogovornikModal(true)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:C.white,color:C.textMid}}>⚙️ Настроить группу</button>}
    </div>
  );

  const pickupFilterChip = (
    <div style={{display:"flex",gap:6,marginBottom:16,flexWrap:"wrap",alignItems:"center"}}>
      <span style={{fontSize:14,color:C.textFaint,fontWeight:600}}>Самовывоз:</span>
      <button onClick={()=>setPickupOnly(false)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${!pickupOnly?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:!pickupOnly?C.navy:C.white,color:!pickupOnly?C.white:C.textMid}}>Все</button>
      <button onClick={()=>setPickupOnly(true)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${pickupOnly?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:pickupOnly?C.navy:C.white,color:pickupOnly?C.white:C.textMid}}>🏬 Только самовывоз</button>
    </div>
  );

  const searchInput = (
    <input
      type="search"
      style={{...S.input, maxWidth: desktop?360:"100%", marginBottom:12}}
      placeholder="Поиск по номеру, клиенту, торговому…"
      value={orderSearch}
      onChange={e=>setOrderSearch(e.target.value)}
      autoComplete="off"
      name="order-search"
    />
  );

  const ordersTable = (
    <div style={{background:C.white,border:`1px solid ${C.border}`,borderRadius:R,overflow:"hidden"}}>
      <div style={{overflowX:"auto"}}>
        <table style={{width:"100%",borderCollapse:"collapse"}}>
          <thead>
            <tr>{["№","Клиент","Торговый","Взял на доставку","Сумма","Оплата","Статус"].map((h,i)=><th key={i} style={S.th}>{h}</th>)}</tr>
          </thead>
          <tbody>
            {filtered.map(o=>{
              const payment = {cash:o.payment_cash||0,qr:o.payment_qr||0,debt:o.payment_debt||0};
              return (
                <tr key={o.id} className="rowh" onClick={()=>setSelectedOrder(o)} style={{cursor:"pointer"}}>
                  <td style={{...S.td,fontFamily:FH,fontWeight:800}}>{o.id}</td>
                  <td style={S.td}>
                    <div style={{fontWeight:600}}>{o.client_name}</div>
                    <div style={{fontSize:14,color:C.textSub}}>{o.address}{o.time_slot?' · '+o.time_slot:''}</div>
                    <div style={{fontSize:13,color:C.textFaint,marginTop:2}}>Создана {fmtDT(o.created_at)||o.date}</div>
                  </td>
                  <td style={S.td}>{o.sales_name}</td>
                  <td style={S.td}>
                    {o.driver_name || <span style={{color:C.textSub,fontStyle:"italic",fontSize:15}}>не назначен</span>}{o.delivery_photo&&<span title="Есть фото накладной" style={{marginLeft:6}}>📷</span>}
                    {o.driver_name&&o.in_transit_at&&<div style={{fontSize:13,color:C.textFaint,marginTop:2}}>в работе с {fmtDT(o.in_transit_at)}</div>}
                  </td>
                  <td style={{...S.td,fontFamily:FH,fontWeight:800,whiteSpace:"nowrap"}}>{(o.total||0).toLocaleString()} ₸</td>
                  <td style={S.td}><PaymentTags payment={payment}/></td>
                  <td style={S.td}><StatusBadge status={o.status} partial={o.partial_delivery}/></td>
                </tr>
              );
            })}
            {filtered.length===0&&(
              <tr><td colSpan="7" style={{...S.td,textAlign:"center",color:C.textFaint,padding:"40px 0"}}>Заявок нет</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  const content = (
    <>
      {tab==="all"&&<>
        {!desktop&&<p style={S.sectionTitle}>Все заявки</p>}
        {!readOnlyOp&&<button onClick={()=>setShowNewOrderModal(true)} style={{...S.btnPrimary,width:"auto",marginBottom:16,padding:"9px 16px",fontSize:14}}>📝 Новая заявка</button>}
        {searchInput}
        {orderDateFilterUI}
        {timeSlotFilterChip}
        {filterChips}
        {driverFilterChips}
        {salesFilterChips}
        {dogovornikFilterChip}
        {pickupFilterChip}
        {!loading&&filtered.length>0&&(
          <button onClick={()=>printWaybillsBatch(filtered,dogovornikCodes,productNameByCode)} style={{...S.btnOutline,width:"auto",marginTop:0,marginBottom:16,padding:"9px 16px",fontSize:14}}>🖨 Печать накладных ({filtered.length})</button>
        )}
        {loading?<div style={S.loadingWrap}>Загрузка...</div>
          :desktop
            ? ordersTable
            : (filtered.length===0
              ?<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>Заявок нет</p></div>
              :filtered.map(o=><OrderCard key={o.id} order={o} onOpen={setSelectedOrder}/>))
        }
      </>}
      {tab==="report"&&<>
        {!desktop&&<p style={S.sectionTitle}>Отчёт</p>}
        {dateRangeInputs}
        <div style={{...S.statsRow, gridTemplateColumns: desktop?"repeat(5, minmax(0,1fr))":"1fr 1fr", maxWidth: desktop?900:"none"}}>
          <div style={S.statCard()}><p style={S.statNum()}>{stats.total}</p><p style={S.statLabel}>Всего</p></div>
          <div style={S.statCard()}><p style={S.statNum(C.green)}>{stats.delivered}</p><p style={S.statLabel}>Доставлено</p></div>
          <div style={S.statCard()}><p style={S.statNum(C.amber)}>{stats.inTransit}</p><p style={S.statLabel}>В работе</p></div>
          <div style={S.statCard()}><p style={S.statNum(C.red)}>{stats.cancelled}</p><p style={S.statLabel}>Не доставлено</p></div>
          <div style={S.statCard()}><p style={S.statNum("#7C3AED")}>{stats.returned}</p><p style={S.statLabel}>Возвратов</p></div>
        </div>
        <div style={{...S.revenueCard, maxWidth: desktop?560:"none"}}>
          <p style={S.revenueLabel}>Общая выручка</p>
          <p style={{...S.revenueNum, marginBottom:14}}>{stats.revenue.toLocaleString()} ₸</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[{label:"Наличка",val:stats.cashTotal,bg:C.cashGreen,col:"#15803D"},{label:"QR код",val:stats.qrTotal,bg:C.qrBlue,col:"#1D4ED8"},{label:"Долг",val:stats.debtTotal,bg:C.debtAmber,col:"#92400E"}].map(({label,val,bg,col})=>(
              <div key={label} style={{background:bg,borderRadius:10,padding:"10px 8px"}}>
                <p style={{margin:"0 0 2px",fontSize:12,color:col,fontWeight:700}}>{label.toUpperCase()}</p>
                <p style={{margin:0,fontSize:15,fontWeight:800,fontFamily:FH,color:col}}>{(val||0).toLocaleString()} ₸</p>
              </div>
            ))}
          </div>
        </div>
        <div style={{maxWidth: desktop?560:"none"}}>
          <ProfitBlock revenue={stats.revenue} cost={stats.costTotal} profit={stats.profit} missingLines={stats.profitMissingLines} missingItems={stats.profitMissingItems} commission={totalCommission}/>
        </div>
        <div style={{maxWidth: desktop?560:"none"}}>
          <div style={{...S.card,marginTop:10}}>
            <div style={{...S.row,marginBottom:10}}>
              <p style={{margin:0,fontSize:15,fontWeight:700,color:C.navy}}>Возвраты за период</p>
              {!readOnlyOp&&<button onClick={()=>setShowReturnModal(true)} style={{padding:"6px 12px",borderRadius:8,border:`1.5px solid #7C3AED`,background:C.white,color:"#7C3AED",fontSize:13,fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>↩️ Оформить возврат</button>}
            </div>
            {returnsInfo.count===0
              ? <p style={{margin:0,fontSize:15,color:C.textSub}}>Возвратов и отказов не было.</p>
              : <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <div>
                    <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Случаев</p>
                    <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:C.text}}>{returnsInfo.count}</p>
                  </div>
                  <div>
                    <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Сумма</p>
                    <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:C.red}}>{returnsInfo.revenue.toLocaleString(undefined,{maximumFractionDigits:0})} ₸</p>
                  </div>
                  <div>
                    <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Доля оборота</p>
                    <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:C.red}}>{returnsInfo.share.toFixed(1)}%</p>
                  </div>
                </div>
                <p style={{margin:0,fontSize:13.5,color:C.textSub}}>
                  Заявки (отказ/возврат целиком): {returnsInfo.ordersCount} на {returnsInfo.ordersRevenue.toLocaleString()} ₸ ·
                  {" "}Отменённые продажи кассы: {returnsInfo.salesCount} на {returnsInfo.salesRevenue.toLocaleString()} ₸ ·
                  {" "}Частичные/после доставки: {returnsInfo.itemized.count} на {returnsInfo.itemized.revenue.toLocaleString()} ₸
                </p>
                {returnsInfo.itemized.unattributed>0&&(
                  <p style={{margin:"6px 0 0",fontSize:12.5,color:"#92400E",background:"#FFFBEB",border:"1px solid #FDE68A",borderRadius:8,padding:"7px 10px"}}>
                    ⚠️ Из них {returnsInfo.itemized.unattributed.toLocaleString()} ₸ — без привязки к торговому (не с кого списать бонус).
                  </p>
                )}
                {returnsInfo.itemized.list.length>0&&(
                  <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                    {returnsInfo.itemized.list.map(r=>(
                      <div key={r.id} style={{marginBottom:8,fontSize:13}}>
                        <div style={S.row}>
                          <span style={{fontWeight:600}}>{r.date} · {r.client_name}{r.order_id?` (заявка №${r.order_id})`:''}</span>
                          <span style={{fontWeight:700,color:C.red}}>−{r.total.toLocaleString()} ₸</span>
                        </div>
                        <p style={{margin:"2px 0 0",fontSize:12,color:C.textFaint}}>
                          {r.items.map(it=>`${it.name} × ${it.qty}`).join(', ')}
                          {r.sales_name?` · торговый: ${r.sales_name}`:' · без торгового'}
                          {r.reason?` · причина: ${r.reason}`:''}
                          {" · "}{r.status==="confirmed"?<span style={{color:C.green,fontWeight:600}}>✓ принят складом</span>:<span style={{color:"#92400E",fontWeight:600}}>⏳ ждёт склад</span>}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </>}
          </div>
        </div>
        <div style={{maxWidth: desktop?560:"none"}}>
          <div style={{...S.card,marginTop:10}}>
            <p style={{margin:"0 0 10px",fontSize:15,fontWeight:700,color:C.navy}}>Сдача налички водителями</p>
            {(()=>{
              const periodHandovers = cashHandovers.filter(h=>h.date>=dateFrom&&h.date<=dateTo);
              const pending = periodHandovers.filter(h=>h.status==="pending");
              const confirmed = periodHandovers.filter(h=>h.status==="confirmed");
              const shortfalls = confirmed.filter(h=>h.difference<0);
              if (periodHandovers.length===0) return <p style={{margin:0,fontSize:15,color:C.textSub}}>За период сдач не было.</p>;
              return <>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:10}}>
                  <div>
                    <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Сдач</p>
                    <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:C.text}}>{periodHandovers.length}</p>
                  </div>
                  <div>
                    <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Ожидают</p>
                    <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:pending.length>0?"#92400E":C.text}}>{pending.length}</p>
                  </div>
                  <div>
                    <p style={{margin:"0 0 2px",fontSize:12,color:C.textFaint,fontWeight:700,textTransform:"uppercase"}}>Недостач</p>
                    <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:shortfalls.length>0?C.red:C.text}}>{shortfalls.length}</p>
                  </div>
                </div>
                {periodHandovers.slice().sort((a,b)=>b.id-a.id).map(h=>(
                  <div key={h.id} style={{marginBottom:8,fontSize:13.5,paddingBottom:8,borderBottom:`1px solid ${C.border}`}}>
                    <div style={S.row}>
                      <span style={{fontWeight:600}}>{h.date} · {h.driver_name}</span>
                      <span style={{fontWeight:700,color:h.status==="pending"?"#92400E":(h.difference<0?C.red:(h.difference>0?C.green:C.textSub))}}>
                        {h.status==="pending"?"⏳ Ожидает":(h.difference===0?"✓ Сошлось":`${h.difference<0?'−':'+'}${Math.abs(h.difference).toLocaleString()} ₸`)}
                      </span>
                    </div>
                    <p style={{margin:"2px 0 0",fontSize:12,color:C.textFaint}}>
                      Ожидалось {h.expected_amount.toLocaleString()} ₸{h.status==="confirmed"?` · принято ${h.actual_amount.toLocaleString()} ₸`:''}{h.comment?` · ${h.comment}`:''}
                    </p>
                    {h.status==="confirmed"&&h.difference!==0&&(
                      h.difference_resolved ? (
                        <p style={{margin:"4px 0 0",fontSize:12,color:C.green}}>✓ Разница закрыта{h.difference_resolved_by_name?` · ${h.difference_resolved_by_name}`:''}{h.difference_resolved_at?', '+fmtDT(h.difference_resolved_at):''}{h.difference_resolved_comment?` · ${h.difference_resolved_comment}`:''}</p>
                      ) : user.role==="admin" && (
                        <button style={{...S.btnOutline,width:"auto",marginTop:6,padding:"5px 12px",fontSize:13}} onClick={()=>resolveDifference(h)}>Закрыть разницу</button>
                      )
                    )}
                  </div>
                ))}
              </>;
            })()}
          </div>
        </div>
        {(() => {
          // Обычная функция, возвращающая JSX (не JSX-компонент) — тот же
          // приём, что и renderAliasSection/renderEmpSection выше: если
          // объявить как <RenderSalesEntity/>, React считает её новым типом
          // компонента на каждый рендер AdminCabinet и сбрасывает
          // expandedSales/раскрытые карточки.
          const renderSalesEntity = (s) => (
            <div key={s.id} style={S.card}>
              <div style={{...S.row,cursor:"pointer"}} onClick={()=>setExpandedSales(e=>({...e,[s.id]:!e[s.id]}))}>
                <div>
                  <p style={S.cardTitle}>{s.name}</p>
                  <p style={S.cardSub}>{s.items.length} поз. продано</p>
                </div>
                <div style={{textAlign:"right"}}>
                  <p style={{margin:0,fontWeight:800,fontFamily:FH,color:C.navy}}>{s.revenue.toLocaleString()} ₸</p>
                  <p style={{margin:0,fontSize:13,color:C.textFaint}}>{expandedSales[s.id]?"▲ Свернуть":"▼ Подробнее"}</p>
                </div>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
                <div style={{background:C.cashGreen,borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:"0 0 2px",fontSize:12,color:"#15803D",fontWeight:700}}>НАЛИЧКА</p>
                  <p style={{margin:0,fontSize:16,fontWeight:800,fontFamily:FH,color:"#15803D"}}>{(s.cash||0).toLocaleString()} ₸</p>
                </div>
                <div style={{background:C.qrBlue,borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:"0 0 2px",fontSize:12,color:"#1D4ED8",fontWeight:700}}>QR</p>
                  <p style={{margin:0,fontSize:16,fontWeight:800,fontFamily:FH,color:"#1D4ED8"}}>{(s.qr||0).toLocaleString()} ₸</p>
                </div>
                <div style={{background:C.debtAmber,borderRadius:10,padding:"8px 10px"}}>
                  <p style={{margin:"0 0 2px",fontSize:12,color:"#92400E",fontWeight:700}}>ДОЛГ</p>
                  <p style={{margin:0,fontSize:16,fontWeight:800,fontFamily:FH,color:"#92400E"}}>{(s.debt||0).toLocaleString()} ₸</p>
                </div>
              </div>
              {expandedSales[s.id]&&(
                <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                  {s.items.map((it,i)=>(
                    <div key={i} style={{...S.row,marginBottom:6,fontSize:14,alignItems:"flex-start"}}>
                      <span style={{color:C.textMid,flex:1}}>{it.name} <span style={{color:C.textFaint}}>×{it.qty}</span></span>
                      <span style={{color:C.textSub,textAlign:"right"}}>{it.commission} ₸ × {it.qty} = <strong style={{color:C.green}}>{it.bonus.toLocaleString(undefined,{maximumFractionDigits:0})} ₸</strong></span>
                    </div>
                  ))}
                  <div style={{...S.row,marginTop:8,paddingTop:8,borderTop:`1px solid ${C.border}`,fontWeight:700}}>
                    <span style={{fontSize:15,color:C.textMid}}>Итого бонус</span>
                    <span style={{fontSize:17,fontFamily:FH,fontWeight:800,color:C.green}}>{s.totalBonus.toLocaleString(undefined,{maximumFractionDigits:0})} ₸</span>
                  </div>
                </div>
              )}
            </div>
          );
          // Экспорт сводки — то же самое, что видно в карточках (по одной
          // строке на человека), а не разбивка по позициям внутри — та
          // видна только при разворачивании карточки на экране.
          const exportSalesListCsv = (list, filenamePrefix) => downloadCsv(
            `${filenamePrefix}-${dateFrom}_${dateTo}.csv`,
            list,
            [
              { label: 'Имя', get: r => r.name },
              { label: 'Позиций продано', get: r => r.items.length },
              { label: 'Выручка', get: r => r.revenue },
              { label: 'Наличка', get: r => r.cash||0 },
              { label: 'QR', get: r => r.qr||0 },
              { label: 'Долг', get: r => r.debt||0 },
              { label: 'Бонус', get: r => r.totalBonus },
            ]
          );
          return <>
            <div style={{maxWidth: desktop?560:"none"}}>
              <div style={{...S.row,marginTop:8}}>
                <p style={{...S.sectionTitle,fontSize:17,margin:0}}>По торговым представителям</p>
                {repList.length>0&&<button onClick={()=>exportSalesListCsv(repList,'otchet-torgovye')} style={{...S.btnOutline,width:"auto",marginTop:0,padding:"6px 12px",fontSize:13}}>⬇ Скачать в Excel</button>}
              </div>
              {repList.length===0
                ? <div style={{textAlign:"center",padding:"32px 0",color:C.textFaint}}>Нет доставленных заявок за этот период</div>
                : repList.map(renderSalesEntity)}
            </div>
            <div style={{maxWidth: desktop?560:"none"}}>
              <div style={{...S.row,marginTop:20}}>
                <p style={{...S.sectionTitle,fontSize:17,margin:0}}>Магазины (самозаказ)</p>
                {storeList.length>0&&<button onClick={()=>exportSalesListCsv(storeList,'otchet-magaziny')} style={{...S.btnOutline,width:"auto",marginTop:0,padding:"6px 12px",fontSize:13}}>⬇ Скачать в Excel</button>}
              </div>
              {storeList.length===0
                ? <div style={{textAlign:"center",padding:"32px 0",color:C.textFaint}}>Нет самостоятельных заказов от магазинов за этот период</div>
                : storeList.map(renderSalesEntity)}
            </div>
          </>;
        })()}
      </>}
      {tab==="cashbox"&&<>
        {!desktop&&<p style={S.sectionTitle}>Касса</p>}
        {dateRangeInputs}
        <div style={{maxWidth: desktop?560:"none"}}>
          <p style={{...S.sectionTitle,fontSize:17}}>Касса за период (заявки + продажи)</p>
          <div style={{...S.revenueCard}}>
            <p style={S.revenueLabel}>Общая выручка</p>
            <p style={{...S.revenueNum,marginBottom:14}}>{posReport.combinedRevenue.toLocaleString()} ₸</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
              <div onClick={()=>scrollToSection(cashHandoverSectionRef)} style={{background:C.cashGreen,borderRadius:10,padding:"10px 8px",cursor:"pointer"}} title="Показать по торговым/водителям">
                <p style={{margin:"0 0 2px",fontSize:12,color:"#15803D",fontWeight:700}}>НАЛИЧКА</p>
                <p style={{margin:0,fontSize:15,fontWeight:800,fontFamily:FH,color:"#15803D"}}>{posReport.combinedCash.toLocaleString()} ₸</p>
              </div>
              <div onClick={()=>scrollToSection(cashHandoverSectionRef)} style={{background:C.qrBlue,borderRadius:10,padding:"10px 8px",cursor:"pointer"}} title="Показать по торговым/водителям">
                <p style={{margin:"0 0 2px",fontSize:12,color:"#1D4ED8",fontWeight:700}}>QR</p>
                <p style={{margin:0,fontSize:15,fontWeight:800,fontFamily:FH,color:"#1D4ED8"}}>{posReport.combinedQr.toLocaleString()} ₸</p>
              </div>
              <div onClick={()=>scrollToSection(debtorsSectionRef)} style={{background:C.debtAmber,borderRadius:10,padding:"10px 8px",cursor:"pointer"}} title="Показать должников">
                <p style={{margin:"0 0 2px",fontSize:12,color:"#92400E",fontWeight:700}}>ДОЛГ</p>
                <p style={{margin:0,fontSize:15,fontWeight:800,fontFamily:FH,color:"#92400E"}}>{posReport.combinedDebt.toLocaleString()} ₸</p>
              </div>
            </div>
          </div>
          <ProfitBlock revenue={posReport.combinedRevenue} cost={posReport.combinedCost} profit={posReport.combinedProfit} missingLines={posReport.combinedProfitMissingLines} missingItems={posReport.combinedProfitMissingItems} commission={totalCommission}/>
        </div>
        {user.role!=="operator"&&<div style={{maxWidth: desktop?560:"none"}}>
          <p style={{...S.sectionTitle,fontSize:17,marginTop:20}}>Продажи по кассе ({posReport.count})</p>
          {posReport.list.length===0?<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>Продаж за период не было</div>:
            posReport.list.map(s=>(
              <div key={s.id} style={S.card}>
                <div style={S.row}>
                  <div>
                    <p style={S.cardTitle}>№ {s.id} · {s.client_name||"Без клиента"}</p>
                    <p style={S.cardSub}>{s.items.length} поз. · {s.created_by_name} · {new Date(s.created_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})}</p>
                  </div>
                  <p style={{margin:0,fontWeight:800,fontFamily:FH,color:C.navy}}>{s.total.toLocaleString()} ₸</p>
                </div>
                {s.fiscal_id
                  ? <p style={{margin:"8px 0 0",fontSize:13,color:C.green}}>
                      🧾 Чек пробит · признак {s.fiscal_id}
                      {s.fiscal_return_id&&<><br/>↩️ Чек возврата пробит · признак {s.fiscal_return_id}</>}
                    </p>
                  : s.status!=="voided"&&(
                    <div style={{marginTop:8}}>
                      <p style={{margin:"0 0 6px",fontSize:13,color:s.payment_debt>0?C.textFaint:C.red}}>
                        {s.payment_debt>0 ? "Чек не пробит (продажа с долгом — пробить можно после погашения)" : "⚠️ Чек не пробит"}
                      </p>
                      {!readOnlyOp&&<button
                        style={{...S.btnSecondary,padding:"6px 14px",fontSize:14,width:"auto",opacity:fiscalizingSaleId===s.id?0.6:1}}
                        disabled={fiscalizingSaleId===s.id}
                        onClick={()=>retryFiscal(s)}
                      >{fiscalizingSaleId===s.id?"Пробиваю...":"🔁 Пробить чек"}</button>}
                      {fiscalErrorBySale[s.id]&&<p style={{margin:"6px 0 0",fontSize:13,color:C.red}}>{fiscalErrorBySale[s.id]}</p>}
                    </div>
                  )}
                {!readOnlyOp&&<button style={{...S.btnDanger,marginTop:10,padding:"8px",fontSize:14}} onClick={()=>voidSale(s)}>Отменить продажу</button>}
              </div>
          ))}
        </div>}
        <div ref={debtorsSectionRef} style={{maxWidth: desktop?560:"none",marginTop:20}}>
          <DebtsPanel role={user.role}/>
        </div>
        <div ref={cashHandoverSectionRef} style={{maxWidth: desktop?560:"none"}}>
          {(() => {
            // Оператору "по водителям" не нужен — он работает с торговыми
            // (заявки/долги/аналитика), сдачу наличности от водителей
            // курирует менеджер/админ, поэтому у оператора переключателя
            // нет вовсе, всегда разрез по торговым.
            const groupBy = user.role==="operator" ? "rep" : cashboxGroupBy;
            const list = groupBy==="driver" ? driverCashList : repCashList;
            return <>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,marginTop:20}}>
                <p style={{...S.sectionTitle,fontSize:17,margin:0}}>{groupBy==="driver"?"Сдача кассы по водителям":"Сдача кассы по торговым"}</p>
                {user.role!=="operator"&&<div style={{display:"flex",gap:6}}>
                  {[["driver","По водителям"],["rep","По торговым"]].map(([k,lb])=>(
                    <button key={k} onClick={()=>setCashboxGroupBy(k)} style={{padding:"5px 11px",borderRadius:99,border:`1px solid ${cashboxGroupBy===k?C.navy:C.border}`,cursor:"pointer",fontSize:13.5,fontWeight:600,background:cashboxGroupBy===k?C.navy:C.white,color:cashboxGroupBy===k?C.white:C.textMid}}>{lb}</button>
                  ))}
                </div>}
              </div>
              {list.length===0?<div style={{textAlign:"center",padding:"24px 0",color:C.textFaint}}>{groupBy==="driver"?"Нет закрытых водителями заявок за период":"Нет доставленных заявок по торговым за период"}</div>:
                list.map((d,i)=>(
              <div key={i} style={S.card}>
                <p style={S.cardTitle}>{d.name}</p>
                <p style={S.cardSub}>{d.orders} заявок доставлено</p>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:10}}>
                  <div style={{background:C.cashGreen,borderRadius:10,padding:"8px 10px"}}>
                    <p style={{margin:"0 0 2px",fontSize:12,color:"#15803D",fontWeight:700}}>НАЛИЧКА</p>
                    <p style={{margin:0,fontSize:16,fontWeight:800,fontFamily:FH,color:"#15803D"}}>{d.cash.toLocaleString()} ₸</p>
                  </div>
                  <div style={{background:C.qrBlue,borderRadius:10,padding:"8px 10px"}}>
                    <p style={{margin:"0 0 2px",fontSize:12,color:"#1D4ED8",fontWeight:700}}>QR</p>
                    <p style={{margin:0,fontSize:16,fontWeight:800,fontFamily:FH,color:"#1D4ED8"}}>{d.qr.toLocaleString()} ₸</p>
                  </div>
                  <div style={{background:C.debtAmber,borderRadius:10,padding:"8px 10px"}}>
                    <p style={{margin:"0 0 2px",fontSize:12,color:"#92400E",fontWeight:700}}>ДОЛГ</p>
                    <p style={{margin:0,fontSize:16,fontWeight:800,fontFamily:FH,color:"#92400E"}}>{d.debt.toLocaleString()} ₸</p>
                  </div>
                </div>
              </div>
                ))}
            </>;
          })()}
        </div>
      </>}
      {tab==="aliases"&&<>
        {!desktop&&<p style={S.sectionTitle}>Псевдонимы товаров</p>}
        <div style={{maxWidth: desktop?720:"none"}}>
          <p style={{fontSize:14,color:C.textSub,marginTop:desktop?0:-8,marginBottom:12}}>
            Название из 1С меняется от поставки к поставке — задай здесь постоянное имя, которое увидят торгпреды.
          </p>
          {(() => {
            const mismatchCount = products.filter(p => weightUnitMismatch(p.unit, !!p.priced_by_weight)).length;
            if (!mismatchCount) return null;
            return (
              <button
                onClick={()=>setOnlyMismatch(v=>!v)}
                style={{display:"block",width:"100%",textAlign:"left",marginBottom:12,padding:"10px 12px",borderRadius:10,border:`1px solid ${onlyMismatch?"#92400E":"#FDE68A"}`,background:onlyMismatch?"#92400E":"#FFFBEB",color:onlyMismatch?"#fff":"#92400E",fontSize:13,fontWeight:700,cursor:"pointer"}}
              >
                ⚠ {mismatchCount} {mismatchCount===1?'товар':'товаров'}: единица измерения из 1С не совпадает с галочкой "Весовой товар" — риск рассинхрона остатка. {onlyMismatch?'Показать все товары':'Показать только их'}
              </button>
            );
          })()}
          <input
            type="search"
            style={{...S.input,marginBottom:12}}
            placeholder="Поиск по названию или коду..."
            value={aliasSearch}
            onChange={e=>setAliasSearch(e.target.value)}
            autoComplete="off"
            name="alias-search"
          />
          {(() => {
            const renderProductCard = (p) => {
              const locked = p.has_alias && !editingCodes[p.code];
              return (
                <ProductAliasCard
                  key={p.code}
                  p={p}
                  locked={locked}
                  readOnly={readOnlyOp}
                  saving={savingCode===p.code}
                  alias={getField(p,'alias')}
                  price1={getField(p,'price1')}
                  price2={getField(p,'price2')}
                  price3={getField(p,'price3')}
                  commission={getField(p,'commission')}
                  cost={getField(p,'cost')}
                  pricedByWeight={getField(p,'priced_by_weight')}
                  avgBoxWeight={getField(p,'avg_box_weight')}
                  onChange={updateField}
                  onEditRequest={onEditRequest}
                  onSave={saveAlias}
                />
              );
            };

            // p.name — сырое название из 1С, а не то, что видит пользователь
            // (display_name — постоянный псевдоним, если задан) — см. тот же
            // фикс в ProductAliasesPanel.
            const q = aliasSearch.trim().toLowerCase();
            const filtered = products
              .filter(p => !q || p.name.toLowerCase().includes(q) || (p.display_name||'').toLowerCase().includes(q) || (p.code||'').includes(q))
              .filter(p => !onlyMismatch || weightUnitMismatch(p.unit, !!p.priced_by_weight));
            const withoutAlias = filtered.filter(p => !p.has_alias);
            const withAlias = filtered.filter(p => p.has_alias);

            // ВАЖНО: это обычная функция, возвращающая JSX, а НЕ JSX-компонент
            // (не вызывается как <AliasSection/>). Раньше здесь была
            // const AliasSection = (...) => {...}, определяемая заново на
            // каждый рендер AdminCabinet и используемая как <AliasSection/> —
            // из-за этого React считал её каждый раз новым типом компонента и
            // полностью размонтировал/пересоздавал все 157 карточек (со сбросом
            // фокуса) при любом изменении состояния, включая ввод в поле. Вызов
            // как обычной функции этого не делает: реконсиляция идёт по
            // фактически возвращаемым элементам (div/ProductAliasCard), и типы
            // остаются стабильными между рендерами.
            const renderAliasSection = ({ id, title, badgeColor, list }) => {
              const open = !!aliasSectionsOpen[id];
              return (
                <div key={id} style={{...S.card, padding:0, marginBottom:12, overflow:"hidden"}}>
                  <div
                    onClick={()=>setAliasSectionsOpen(s=>({...s,[id]:!s[id]}))}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",cursor:"pointer",background:C.surface}}
                  >
                    <span style={{fontSize:15,fontWeight:700,color:C.navy,display:"flex",alignItems:"center",gap:8}}>
                      {title}
                      <span style={{fontSize:13,fontWeight:700,color:badgeColor,background:badgeColor+"22",padding:"2px 8px",borderRadius:99}}>{list.length}</span>
                    </span>
                    <span style={{fontSize:14,color:C.textFaint}}>{open?"▲ Свернуть":"▼ Развернуть"}</span>
                  </div>
                  {open && (
                    <div style={{padding:10,maxHeight:520,overflowY:"auto",borderTop:`1px solid ${C.border}`}}>
                      {list.length===0
                        ? <div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>{q?"Ничего не найдено":"Пусто"}</div>
                        : list.map(renderProductCard)}
                    </div>
                  )}
                </div>
              );
            };

            return <>
              {renderAliasSection({ id:"unset", title:"⚠️ Цены не установлены", badgeColor:C.red, list:withoutAlias })}
              {renderAliasSection({ id:"set", title:"✅ Цены установлены", badgeColor:C.green, list:withAlias })}
            </>;
          })()}
          {products.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}>Номенклатура ещё не синхронизирована из 1С</div>}
        </div>
      </>}
      {tab==="stock"&&<StockPanel/>}
      {tab==="catalog"&&<>
        {!desktop&&<p style={S.sectionTitle}>Каталог</p>}
        <div style={{maxWidth:"none"}}>
          <p style={{fontSize:14,color:C.textSub,marginTop:desktop?0:-8,marginBottom:12}}>
            Название и код — из 1С, как есть. Здесь — только то, что видит покупатель при выборе: фото и раздел каталога.
          </p>
          <input
            type="search"
            style={{...S.input,marginBottom:12}}
            placeholder="Поиск по названию, коду или штрихкоду..."
            value={catalogAdminSearch}
            onChange={e=>setCatalogAdminSearch(e.target.value)}
            autoComplete="off"
            name="catalog-admin-search"
          />
          <div style={{...S.row,marginBottom:10}}>
            <span style={{fontSize:14,color:C.textSub}}>{categoryOptions.length>0?`${categoryOptions.length} раздел(ов)`:"Разделов пока нет"}</span>
            <button onClick={()=>setShowCategoryManager(s=>!s)} style={{...S.btnSecondary,padding:"5px 12px",fontSize:14}}>{showCategoryManager?"✕ Закрыть":"⚙ Управление разделами"}</button>
          </div>
          {showCategoryManager&&(
            <div style={{...S.card,marginBottom:12}}>
              <div style={{display:"flex",gap:6,marginBottom:categoryOptions.length>0?12:0}}>
                <input
                  style={{...S.input,padding:"7px 10px",fontSize:15,flex:1}}
                  placeholder="Название нового раздела"
                  value={newCategoryName}
                  onChange={e=>setNewCategoryName(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'){ createCategory(newCategoryName); setNewCategoryName(""); } }}
                />
                <button
                  style={{...S.btnPrimary,padding:"7px 14px",fontSize:14,marginTop:0,boxShadow:"none",width:"auto",whiteSpace:"nowrap"}}
                  onClick={()=>{ createCategory(newCategoryName); setNewCategoryName(""); }}
                >+ Раздел</button>
              </div>
              {categoryOptions.map(cat=>(
                <div key={cat} style={{...S.row,padding:"7px 0",borderTop:`1px solid ${C.border}`}}>
                  <span style={{fontSize:15,color:C.textMid}}>{cat}</span>
                  <div style={{display:"flex",gap:6}}>
                    <button
                      title="Переименовать"
                      onClick={()=>{ const next=window.prompt(`Новое название для «${cat}»`, cat); if(next!=null) renameCategory(cat, next); }}
                      style={{width:28,height:28,border:`1px solid ${C.border}`,borderRadius:8,background:C.white,cursor:"pointer",fontSize:15}}
                    >✎</button>
                    <button
                      title="Удалить"
                      onClick={()=>deleteCategory(cat)}
                      style={{width:28,height:28,border:`1px solid ${C.border}`,borderRadius:8,background:C.white,color:C.red,cursor:"pointer",fontSize:15}}
                    >🗑</button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {categoryOptions.length>0&&(
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              <button onClick={()=>setCatalogAdminSection("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${catalogAdminSection===""?C.navy:C.border}`,background:catalogAdminSection===""?C.navy:C.white,color:catalogAdminSection===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все</button>
              {categoryOptions.map(cat=>(
                <button key={cat} onClick={()=>setCatalogAdminSection(cat)} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${catalogAdminSection===cat?C.navy:C.border}`,background:catalogAdminSection===cat?C.navy:C.white,color:catalogAdminSection===cat?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{cat}</button>
              ))}
              <button onClick={()=>setCatalogAdminSection("__none__")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${catalogAdminSection==="__none__"?C.red:C.border}`,background:catalogAdminSection==="__none__"?"#FEF2F2":C.white,color:catalogAdminSection==="__none__"?C.red:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Без раздела</button>
            </div>
          )}
          {(() => {
            const q = catalogAdminSearch.trim().toLowerCase();
            const filtered = products.filter(p =>
              (!q || p.name.toLowerCase().includes(q) || (p.code||'').includes(q) || (p.barcode||'').includes(q)) &&
              (!catalogAdminSection || (catalogAdminSection==="__none__" ? !p.group : p.group===catalogAdminSection))
            );
            return filtered.length===0
              ? <div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>{q?"Ничего не найдено":"Пусто"}</div>
              : <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill, minmax(200px, 1fr))",gap:14}}>
                {filtered.map(p=>(
                  <ProductCatalogCard
                    key={p.code}
                    p={p}
                    category={getField(p,'category')}
                    barcode={getField(p,'barcode')}
                    categoryOptions={categoryOptions}
                    saving={savingCategoryCode===p.code}
                    onChangeCategory={updateField}
                    onSaveCategory={saveCategory}
                    onUploadPhoto={uploadProductPhoto}
                    onRemovePhoto={removeProductPhoto}
                  />
                ))}
              </div>;
          })()}
          {products.length===0&&<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}>Номенклатура ещё не синхронизирована из 1С</div>}
        </div>
      </>}
      {tab==="nkt"&&<>
        {!desktop&&<p style={S.sectionTitle}>Коды НКТ</p>}
        <div style={{maxWidth:"none"}}>
          <p style={{fontSize:14,color:C.textSub,marginTop:desktop?0:-8,marginBottom:12}}>
            Код НКТ (NTIN) ищется в Национальном каталоге товаров по штрихкоду. Найденное — это то же
            значение, что в 1С в поле "Код НКТ" карточки номенклатуры. Можно поправить вручную и подобрать
            по названию, если по штрихкоду не нашлось.
          </p>
          {(() => {
            const total = products.length;
            const withBarcode = products.filter(p=>p.barcode).length;
            const matched = products.filter(p=>p.nkt_status==='matched').length;
            const manual = products.filter(p=>p.nkt_status==='manual').length;
            const notFound = products.filter(p=>p.nkt_status==='not_found').length;
            const unchecked = total - matched - manual - notFound;
            return (
              <div style={{display:"flex",gap:8,flexWrap:"wrap",marginBottom:12}}>
                {[["Всего",total,C.textMid],["Со штрихкодом",withBarcode,C.textMid],["Найдено",matched,C.green],["Вручную",manual,C.navy],["Не найдено",notFound,C.red],["Не проверено",unchecked,C.textFaint]].map(([label,val,color])=>(
                  <div key={label} style={{...S.card,padding:"8px 12px",display:"flex",flexDirection:"column",gap:2,minWidth:88}}>
                    <span style={{fontSize:13,color:C.textSub}}>{label}</span>
                    <span style={{fontSize:18,fontWeight:800,fontFamily:FH,color}}>{val}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <div style={{...S.card,marginBottom:12,display:"flex",flexDirection:"column",gap:8}}>
            <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
              <button
                style={{...S.btnPrimary,width:"auto",padding:"9px 16px",marginTop:0,boxShadow:"none",opacity:nktRunning?0.6:1}}
                disabled={nktRunning}
                onClick={runNktMatch}
              >▶ Подобрать коды НКТ по штрихкодам</button>
              {nktRunning&&(
                <button
                  style={{...S.btnSecondary,width:"auto",padding:"9px 16px"}}
                  onClick={()=>{ nktStopRef.current = true; }}
                >■ Остановить</button>
              )}
              {nktProgress&&(
                <span style={{fontSize:14,color:C.textSub}}>
                  {nktRunning?"Идёт подбор: ":"Готово: "}{nktProgress.done} / {nktProgress.total}
                  {" "}(найдено {nktProgress.matched}, не найдено {nktProgress.notFound}, ошибок {nktProgress.errors})
                </span>
              )}
            </div>
            <p style={{fontSize:13,color:C.textFaint,margin:0}}>
              Обрабатывает только товары со штрихкодом, у которых код НКТ ещё не заполнен. Товары без штрихкода
              и уже заполненные — не трогает; для них ищите вручную кнопкой "🔍" по названию.
            </p>
          </div>
          <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
            <input
              type="search"
              style={{...S.input,flex:1,minWidth:200}}
              placeholder="Поиск по названию, коду 1С или штрихкоду..."
              value={nktSearch}
              onChange={e=>setNktSearch(e.target.value)}
              autoComplete="off"
              name="nkt-search"
            />
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:14,color:C.textMid,whiteSpace:"nowrap"}}>
              <input type="checkbox" checked={nktOnlyMissing} onChange={e=>setNktOnlyMissing(e.target.checked)}/>
              Только без кода НКТ
            </label>
          </div>
          {(() => {
            const q = nktSearch.trim().toLowerCase();
            const filtered = products.filter(p =>
              (!q || p.name.toLowerCase().includes(q) || (p.code||'').includes(q) || (p.barcode||'').includes(q)) &&
              (!nktOnlyMissing || !p.nkt_code)
            );
            const STATUS_LABEL = { matched:"Найден", manual:"Вручную", not_found:"Не найден" };
            const STATUS_COLOR = { matched:C.green, manual:C.navy, not_found:C.red };
            if (filtered.length === 0) {
              return <div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>{q||nktOnlyMissing?"Ничего не найдено":"Пусто"}</div>;
            }
            // Плоская таблица, не карточки с фото — на 3000+ позициях это заметно легче.
            return (
              <div style={{...S.card,padding:0,overflow:"hidden"}}>
                <div style={{overflowX:"auto"}}>
                <table style={{width:"100%",borderCollapse:"collapse",fontSize:14}}>
                  <thead>
                    <tr style={{background:C.surface,textAlign:"left"}}>
                      {["Название","Код 1С","Штрихкод","Код НКТ","Статус",""].map(h=>(
                        <th key={h} style={{padding:"8px 10px",fontWeight:700,color:C.textSub,whiteSpace:"nowrap"}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.slice(0,500).map(p=>(
                      <tr key={p.code} className="rowh" style={{borderTop:`1px solid ${C.border}`}}>
                        <td style={{padding:"6px 10px",maxWidth:280}}>{p.name}</td>
                        <td style={{padding:"6px 10px",color:C.textFaint,whiteSpace:"nowrap"}}>{p.code}</td>
                        <td style={{padding:"6px 10px",color:C.textFaint,whiteSpace:"nowrap"}}>{p.barcode||"—"}</td>
                        <td style={{padding:"6px 10px",minWidth:150}}>
                          <input
                            defaultValue={p.nkt_code}
                            key={p.code+':'+p.nkt_code}
                            style={{...S.input,padding:"5px 8px",fontSize:14,width:150}}
                            placeholder="не указан"
                            onBlur={e=>{ if(e.target.value !== (p.nkt_code||'')) saveNktCodeManually(p.code, e.target.value.trim()); }}
                          />
                        </td>
                        <td style={{padding:"6px 10px",whiteSpace:"nowrap"}}>
                          {p.nkt_status
                            ? <span style={{fontSize:13,fontWeight:700,color:STATUS_COLOR[p.nkt_status]||C.textFaint,background:(STATUS_COLOR[p.nkt_status]||C.textFaint)+"22",padding:"2px 8px",borderRadius:99}}>{STATUS_LABEL[p.nkt_status]||p.nkt_status}</span>
                            : <span style={{fontSize:13,color:C.textFaint}}>—</span>}
                        </td>
                        <td style={{padding:"6px 10px",whiteSpace:"nowrap"}}>
                          <button
                            title="Искать в НКТ по штрихкоду/названию"
                            onClick={()=>searchNktForProduct(p)}
                            style={{width:26,height:26,border:`1px solid ${C.border}`,borderRadius:8,background:C.white,cursor:"pointer",fontSize:14}}
                          >🔍</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                </div>
                {filtered.length>500&&(
                  <div style={{padding:"8px 10px",fontSize:13,color:C.textFaint,borderTop:`1px solid ${C.border}`}}>
                    Показаны первые 500 из {filtered.length} — сузьте поиск, чтобы увидеть остальные.
                  </div>
                )}
              </div>
            );
          })()}
        </div>
        {nktPicker&&(
          <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.4)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:1000,padding:16}} onClick={()=>setNktPicker(null)}>
            <div style={{...S.card,width:"100%",maxWidth:480,maxHeight:"70vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <span style={{fontSize:16,fontWeight:700,color:C.navy}}>Результаты поиска в НКТ</span>
                <button onClick={()=>setNktPicker(null)} style={{border:"none",background:"none",fontSize:18,cursor:"pointer",color:C.textFaint}}>✕</button>
              </div>
              {nktPicker.loading&&<div style={{textAlign:"center",padding:"20px 0",color:C.textFaint,fontSize:15}}>Ищу...</div>}
              {!nktPicker.loading&&nktPicker.error&&<div style={{textAlign:"center",padding:"20px 0",color:C.red,fontSize:15}}>{nktPicker.error}</div>}
              {!nktPicker.loading&&nktPicker.results.map((r,i)=>(
                <div key={i} onClick={()=>pickNktResult(nktPicker.code, r.ntin_code)} style={{padding:"8px 10px",borderRadius:8,border:`1px solid ${C.border}`,marginBottom:6,cursor:"pointer"}}>
                  <div style={{fontSize:14,fontWeight:600,color:C.textMid}}>{r.name_ru||r.name_kk||'Без названия'}</div>
                  <div style={{fontSize:13,color:C.textFaint,marginTop:2}}>NTIN: {r.ntin_code||'—'} · GTIN: {r.gtin||'—'}{r.is_markedeac?' · маркированный':''}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </>}
      {tab==="employees"&&<>
        {!desktop&&<p style={S.sectionTitle}>Сотрудники</p>}
        <div style={{maxWidth: desktop?560:"none"}}>
          <p style={{fontSize:14,color:C.textSub,marginTop:desktop?0:-8,marginBottom:12}}>
            ФИО приходит из 1С. Для новых сотрудников задай роль, логин и пароль — появится рабочий вход на сайт.
          </p>
          <input
            type="search"
            style={{...S.input,marginBottom:16}}
            placeholder="Поиск по ФИО или коду..."
            value={empSearch}
            onChange={e=>setEmpSearch(e.target.value)}
            autoComplete="off"
            name="emp-search"
          />
          {(() => {
            const q = empSearch.trim().toLowerCase();
            // _origIdx фиксируется до фильтрации, чтобы formKey сотрудника без
            // кода 1С не менялся при наборе текста в поиске — иначе позиция
            // сотрудника в отфильтрованном списке сдвигается, его formKey
            // "достаётся" другому сотруднику, и уже введённые логин/пароль
            // показываются под чужим именем (данные не были ничьи, но
            // визуально привязываются не к тому человеку)
            const noAccount = employees
              .map((e,_origIdx)=>({...e,_origIdx}))
              .filter(e=>!e.has_account&&(!q||e.name.toLowerCase().includes(q)||(e.code||'').includes(q)));
            const accounts = users.filter(u=>!q||u.name.toLowerCase().includes(q)||u.login.toLowerCase().includes(q));
            const storeClientCodes = new Set(users.filter(u=>u.role==="store").map(u=>u.client_code));
            const noStoreAccount = clients.filter(cl=>!storeClientCodes.has(cl.code)&&(!q||cl.name.toLowerCase().includes(q)||(cl.code||'').includes(q)));

            // ВАЖНО: обычная функция, возвращающая JSX, а НЕ JSX-компонент (не
            // вызывается как <EmpSection/>). Раньше здесь была
            // const EmpSection = (...) => {...}, определяемая заново на каждый
            // рендер AdminCabinet и используемая как <EmpSection/> — из-за этого
            // React считал её каждый раз новым типом компонента и полностью
            // размонтировал/пересоздавал содержимое (включая поля логина и
            // пароля) при любом изменении состояния, в т.ч. при вводе символа в
            // поле — из-за этого набор текста в полях сбрасывал фокус после
            // каждой буквы. Вызов как обычной функции этого не делает: типы
            // возвращаемых элементов (div/input) остаются стабильными между
            // рендерами. См. аналогичный фикс в renderAliasSection выше.
            const renderEmpSection = ({ id, title, badgeColor, count, children }) => {
              const open = !!empSectionsOpen[id];
              return (
                <div key={id} style={{...S.card, padding:0, marginBottom:12, overflow:"hidden"}}>
                  <div
                    onClick={()=>setEmpSectionsOpen(s=>({...s,[id]:!s[id]}))}
                    style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"13px 14px",cursor:"pointer",background:C.surface}}
                  >
                    <span style={{fontSize:15,fontWeight:700,color:C.navy,display:"flex",alignItems:"center",gap:8}}>
                      {title}
                      <span style={{fontSize:13,fontWeight:700,color:badgeColor,background:badgeColor+"22",padding:"2px 8px",borderRadius:99}}>{count}</span>
                    </span>
                    <span style={{fontSize:14,color:C.textFaint}}>{open?"▲ Свернуть":"▼ Развернуть"}</span>
                  </div>
                  {open && (
                    <div style={{padding:10,maxHeight:520,overflowY:"auto",borderTop:`1px solid ${C.border}`}}>
                      {children}
                    </div>
                  )}
                </div>
              );
            };

            return <>
              {renderEmpSection({ id:"noAccount", title:"Без учётной записи", badgeColor:C.red, count:noAccount.length, children:
                noAccount.length===0
                  ? <div style={{textAlign:"center",padding:"16px 0",color:C.textFaint,fontSize:15}}>{q?"Ничего не найдено":"Все сотрудники из 1С уже с аккаунтами"}</div>
                  : noAccount.map((emp)=>{
                      const formKey = (emp.code||'nocode')+'_'+emp._origIdx;
                      return (
                      <div key={formKey} style={{...S.card,padding:10,marginBottom:6}}>
                        <div style={{fontSize:13,color:C.textFaint,marginBottom:2}}>Код 1С: {emp.code}</div>
                        <div style={{fontSize:15,fontWeight:600,marginBottom:readOnlyOp?0:8,color:C.textMid}}>{emp.name}</div>
                        {!readOnlyOp&&<>
                        <select style={{...S.select,padding:"7px 8px",fontSize:14,marginBottom:6}} value={(empForm[formKey]||{}).role||''} onChange={e=>updateEmpForm(formKey,'role',e.target.value)}>
                          <option value="">— Роль —</option>
                          {ROLE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                        <div style={{display:"flex",gap:6}}>
                          <input style={{...S.input,padding:"7px 8px",fontSize:14}} placeholder="Логин" value={(empForm[formKey]||{}).login||''} onChange={e=>updateEmpForm(formKey,'login',e.target.value)}/>
                          <input style={{...S.input,padding:"7px 8px",fontSize:14}} placeholder="Пароль" value={(empForm[formKey]||{}).password||''} onChange={e=>updateEmpForm(formKey,'password',e.target.value)}/>
                          <button style={{...S.btnPrimary,padding:"7px 14px",fontSize:14,marginTop:0,boxShadow:"none",width:"auto",whiteSpace:"nowrap",opacity:savingEmp===formKey?0.5:1}} disabled={savingEmp===formKey} onClick={()=>createEmpAccount(emp,formKey)}>Создать</button>
                        </div>
                        </>}
                      </div>
                      );
                    })
              })}

              {renderEmpSection({ id:"accounts", title:"Учётные записи", badgeColor:C.green, count:accounts.length, children:
                accounts.length===0
                  ? <div style={{textAlign:"center",padding:"16px 0",color:C.textFaint,fontSize:15}}>{q?"Ничего не найдено":"Аккаунтов пока нет"}</div>
                  : accounts.map(u=>(
                    <div key={u.id} style={{...S.card,padding:10,marginBottom:6,opacity:u.active?1:0.55}}>
                      <div style={S.row}>
                        <div>
                          <p style={S.cardTitle}>{u.name} {!u.active&&<span style={{color:C.red,fontSize:13,fontWeight:700}}>· ОТКЛЮЧЁН</span>}</p>
                          <p style={S.cardSub}>{u.login} · {ROLE_OPTIONS.find(([v])=>v===u.role)?.[1]||u.role}</p>
                          {u.session_active&&<p style={{...S.cardSub,color:C.green,fontWeight:600}}>● Сессия активна{u.last_seen_at?` (посл. активность ${new Date(u.last_seen_at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'})})`:''}</p>}
                        </div>
                        {!readOnlyOp&&<button
                          style={{...S.btnSecondary,opacity:togglingUser===u.id?0.5:1}}
                          disabled={togglingUser===u.id}
                          onClick={()=>toggleUser(u)}
                        >{u.active?"Отключить":"Включить"}</button>}
                      </div>
                      {!readOnlyOp&&<>
                      {u.session_active&&
                        <button
                          style={{...S.btnSecondary,marginTop:6,opacity:resettingSession===u.id?0.5:1}}
                          disabled={resettingSession===u.id}
                          onClick={()=>resetUserSession(u)}
                        >{resettingSession===u.id?"...":"Сбросить сессию"}</button>
                      }
                      <div style={{display:"flex",gap:6,marginTop:8}}>
                        <select
                          style={{...S.select,padding:"7px 8px",fontSize:14,flex:1}}
                          value={roleEdits[u.id]!==undefined?roleEdits[u.id]:u.role}
                          onChange={e=>setRoleEdits(r=>({...r,[u.id]:e.target.value}))}
                        >
                          {ROLE_OPTIONS.map(([v,l])=><option key={v} value={v}>{l}</option>)}
                        </select>
                        <button
                          style={{...S.btnPrimary,padding:"7px 14px",fontSize:14,marginTop:0,boxShadow:"none",width:"auto",whiteSpace:"nowrap",opacity:(savingRole===u.id||roleEdits[u.id]===undefined||roleEdits[u.id]===u.role)?0.5:1}}
                          disabled={savingRole===u.id||roleEdits[u.id]===undefined||roleEdits[u.id]===u.role}
                          onClick={()=>changeRole(u)}
                        >{savingRole===u.id?"...":"Сохранить роль"}</button>
                      </div>
                      <div style={{display:"flex",gap:6,marginTop:6}}>
                        <input
                          type="password"
                          style={{...S.input,padding:"7px 8px",fontSize:14}}
                          placeholder="Новый пароль (мин. 4 симв.)"
                          value={passwordEdits[u.id]||''}
                          onChange={e=>setPasswordEdits(p=>({...p,[u.id]:e.target.value}))}
                        />
                        <button
                          style={{...S.btnPrimary,padding:"7px 14px",fontSize:14,marginTop:0,boxShadow:"none",width:"auto",whiteSpace:"nowrap",opacity:(changingPwd===u.id||!(passwordEdits[u.id]||'').trim())?0.5:1}}
                          disabled={changingPwd===u.id||!(passwordEdits[u.id]||'').trim()}
                          onClick={()=>changePassword(u)}
                        >{changingPwd===u.id?"...":"Сменить пароль"}</button>
                      </div>
                      </>}
                    </div>
                  ))
              })}

              {renderEmpSection({ id:"noStoreAccount", title:"Магазины без кабинета", badgeColor:C.red, count:noStoreAccount.length, children:
                noStoreAccount.length===0
                  ? <div style={{textAlign:"center",padding:"16px 0",color:C.textFaint,fontSize:15}}>{q?"Ничего не найдено":(clients.length===0?"Клиенты из 1С ещё не загружены":"Все магазины уже с кабинетами")}</div>
                  : noStoreAccount.map((cl)=>{
                      const formKey = 'store_'+cl.code;
                      return (
                      <div key={formKey} style={{...S.card,padding:10,marginBottom:6}}>
                        <div style={{fontSize:13,color:C.textFaint,marginBottom:2}}>Код 1С: {cl.code}</div>
                        <div style={{fontSize:15,fontWeight:600,marginBottom:readOnlyOp?0:8,color:C.textMid}}>{cl.name}</div>
                        {!readOnlyOp&&<div style={{display:"flex",gap:6}}>
                          <input style={{...S.input,padding:"7px 8px",fontSize:14}} placeholder="Логин" value={(empForm[formKey]||{}).login||''} onChange={e=>updateEmpForm(formKey,'login',e.target.value)}/>
                          <input style={{...S.input,padding:"7px 8px",fontSize:14}} placeholder="Пароль" value={(empForm[formKey]||{}).password||''} onChange={e=>updateEmpForm(formKey,'password',e.target.value)}/>
                          <button style={{...S.btnPrimary,padding:"7px 14px",fontSize:14,marginTop:0,boxShadow:"none",width:"auto",whiteSpace:"nowrap",opacity:savingEmp===formKey?0.5:1}} disabled={savingEmp===formKey} onClick={()=>createStoreAccount(cl,formKey)}>Создать</button>
                        </div>}
                      </div>
                      );
                    })
              })}
            </>;
          })()}
        </div>
      </>}
    </>
  );

  const ROLE_LABEL = { sales:"Торговый представитель", senior_sales:"Старший торговый представитель", driver:"Водитель", cashier:"Кассир", warehouse:"Зав. склад", operator:"Оператор", admin:"Администратор", manager:"Менеджер", store:"Магазин" };

  if (desktop) {
    return (
      <div style={{display:"flex",minHeight:"100vh",background:C.surface,alignItems:"flex-start"}}>
        <AutofillDecoy/>
        {selectedOrder&&<OrderDetail order={selectedOrder} onClose={()=>setSelectedOrder(null)} onUpdateStatus={handleUpdate} onDeleteOrder={handleDelete} onFixItemCost={user.role!=="operator"?fixItemCost:undefined} onFixItemWeight={user.role==="admin"?fixItemWeight:undefined} onEditDeliveredItems={user.role==="admin"?editDeliveredItems:undefined} onEditPrices={user.role==="admin"?editPrices:undefined} currentUser={user} drivers={users.filter(u=>u.role==="driver"&&u.active!==false)} products={products}/>}
        {showPosModal&&<PosSaleModal products={products} clients={clients} onClose={()=>setShowPosModal(false)} onCompleted={()=>{ setShowPosModal(false); loadSales(); }}/>}
        {showNewOrderModal&&<NewOrderModal products={products} clients={clients} onClose={()=>setShowNewOrderModal(false)} onCreated={()=>{ setShowNewOrderModal(false); loadOrders(); }} isAdmin={user.role==="admin"}/>}
        {showReturnModal&&<ReturnFormModal user={user} onClose={()=>setShowReturnModal(false)} onCreated={loadReturns}/>}
        {showDogovornikModal&&<DogovornikModal clients={clients} onClose={()=>setShowDogovornikModal(false)} onSaved={loadClients}/>}
        <aside style={S.side}>
          <div style={{marginBottom:34}}><Brand size={44}/></div>
          <nav style={{flex:1}}>
            {TABS.map(([k,ic,lb])=>(
              <button key={k} style={S.sideLink(tab===k)} onClick={()=>setTab(k)}>
                <span style={{fontSize:18}}>{ic}</span>{lb}
              </button>
            ))}
          </nav>
          <div style={{fontSize:14,color:"#8B8681",lineHeight:1.6}}>
            {ROLE_LABEL[user.role]} · {user.name}<br/>
            <button style={{background:"transparent",border:`1px solid ${C.border}`,color:C.textMid,padding:"6px 14px",borderRadius:8,cursor:"pointer",fontSize:14,marginTop:8}} onClick={onLogout}>Выйти</button>
          </div>
        </aside>
        <main style={S.main}>
          <h1 style={S.h1}>{TAB_TITLES[tab]}</h1>
          <div style={{...S.h1sub, marginBottom:22}}>{new Date().toLocaleDateString('ru-RU',{day:'numeric',month:'long',year:'numeric'})}</div>
          {content}
        </main>
      </div>
    );
  }

  return (
    <div style={{paddingBottom:72}}>
      <AutofillDecoy/>
      {selectedOrder&&<OrderDetail order={selectedOrder} onClose={()=>setSelectedOrder(null)} onUpdateStatus={handleUpdate} onDeleteOrder={handleDelete} onFixItemCost={user.role!=="operator"?fixItemCost:undefined} onFixItemWeight={user.role==="admin"?fixItemWeight:undefined} onEditDeliveredItems={user.role==="admin"?editDeliveredItems:undefined} onEditPrices={user.role==="admin"?editPrices:undefined} currentUser={user} drivers={users.filter(u=>u.role==="driver"&&u.active!==false)} products={products}/>}
      {showPosModal&&<PosSaleModal products={products} clients={clients} onClose={()=>setShowPosModal(false)} onCompleted={()=>{ setShowPosModal(false); loadSales(); }}/>}
      {showReturnModal&&<ReturnFormModal user={user} onClose={()=>setShowReturnModal(false)} onCreated={loadReturns}/>}
      {showDogovornikModal&&<DogovornikModal clients={clients} onClose={()=>setShowDogovornikModal(false)} onSaved={loadClients}/>}
      <div style={S.page}>
        {content}
      </div>
      <div style={S.nav}>
        {(readOnlyOp
          ? [["all","📋","Заявки"],["cashbox","💵","Касса"]]
          : [["all","📋","Заявки"],["report","📊","Отчёт"],["cashbox","💵","Касса"],["aliases","🏷","Товары"],["stock","📦","Остатки"],["employees","👤","Сотр."]]
        ).map(([k,ic,lb])=>(
          <button key={k} style={S.navBtn(tab===k)} onClick={()=>setTab(k)}>
            <span style={S.navIcon}>{ic}</span><span style={S.navLabel(tab===k)}>{lb}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function WarehouseCabinet({ user, onLogout }) {
  const [tab, setTab] = useState("stock");
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const [showMovements, setShowMovements] = useState(false);
  const [showStatement, setShowStatement] = useState(false);
  const [showReconcile, setShowReconcile] = useState(false);

  // Приём налички от водителей (инкассация) — см. POST/PUT /api/cash-handovers.
  const [cashHandovers, setCashHandovers] = useState([]);
  const [loadingHandovers, setLoadingHandovers] = useState(true);
  const loadCashHandovers = useCallback(async () => {
    try { setCashHandovers(await apiCall('GET','/api/cash-handovers')); } catch(e) {}
    setLoadingHandovers(false);
  }, []);
  useEffect(() => { loadCashHandovers(); }, []);
  useRefetchOnVisible(loadCashHandovers);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmForm, setConfirmForm] = useState({ actualAmount:'', comment:'' });
  const [savingConfirm, setSavingConfirm] = useState(false);
  const startConfirm = (h) => { setConfirmingId(h.id); setConfirmForm({ actualAmount: String(h.expected_amount), comment:'' }); };
  const submitConfirm = async (id) => {
    setSavingConfirm(true);
    try {
      await apiCall('PUT', `/api/cash-handovers/${id}/confirm`, { actualAmount: confirmForm.actualAmount, comment: confirmForm.comment });
      setConfirmingId(null);
      loadCashHandovers();
    } catch(e) { alert(e.message); }
    setSavingConfirm(false);
  };
  const pendingHandovers = cashHandovers.filter(h=>h.status==="pending");
  const confirmedHandovers = cashHandovers.filter(h=>h.status==="confirmed");

  // Подтверждение возвратов от водителей — см. PUT /api/returns/:id/confirm.
  // До подтверждения возврат ещё не приходован в остаток (см. POST
  // /api/returns на сервере) — водитель мог заявить возврат, которого
  // физически не привёз, поэтому остаток зачисляется только здесь, после
  // того как склад реально принял товар. Та же модель, что и приём
  // налички выше.
  const [returns, setReturns] = useState([]);
  const [loadingReturns, setLoadingReturns] = useState(true);
  const loadReturns = useCallback(async () => {
    try { setReturns(await apiCall('GET','/api/returns')); } catch(e) {}
    setLoadingReturns(false);
  }, []);
  useEffect(() => { loadReturns(); }, []);
  useRefetchOnVisible(loadReturns);
  const [confirmingReturnId, setConfirmingReturnId] = useState(null);
  const confirmReturn = async (id) => {
    setConfirmingReturnId(id);
    try {
      await apiCall('PUT', `/api/returns/${id}/confirm`, {});
      loadReturns();
    } catch(e) { alert(e.message); }
    setConfirmingReturnId(null);
  };
  const pendingReturns = returns.filter(r=>r.status==="pending");
  const confirmedReturns = returns.filter(r=>r.status==="confirmed");

  const loadProducts = useCallback(async () => {
    try {
      const data = await fetch('/api/products').then(r => r.json());
      setProducts(data);
    } catch(e) {}
    setLoadingProducts(false);
  }, []);

  useEffect(() => { loadProducts(); }, []);

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch(e) { if(e.message.includes('токен')) onLogout(); }
    setLoadingOrders(false);
  }, []);
  useEffect(() => { loadOrders(); }, []);
  useRefetchOnVisible(loadProducts, loadOrders);

  // Взять в работу и закрыть заявку самовывоза (см. canWarehousePickup в
  // OrderDetail) — единственные переходы статуса, доступные зав. складу.
  const handleUpdate = async (id, status, payment, driverId, items) => {
    try {
      await apiCall('PUT', `/api/orders/${id}/status`, { status, payment, items });
      setSelectedOrder(null); loadOrders();
    } catch(e) { alert(e.message); }
  };

  // Сколько налички сейчас физически на руках у каждого водителя — та же
  // логика, что и computeDriverPendingCash на сервере (доставлено, оплата
  // налом, ещё не вошло ни в одну сдачу). Строго для информации: принимает
  // склад по-прежнему только оформленную сдачу (см. pendingHandovers ниже),
  // здесь нет действия "принять" — иначе можно было бы подтвердить сумму,
  // которую водитель ещё не заявил как сданную.
  const driverCashOnHand = useMemo(() => {
    const byDriver = {};
    orders.forEach(o => {
      if (o.status === 'delivered' && (Number(o.payment_cash) || 0) > 0 && !o.cash_handover_id && o.driver_id) {
        if (!byDriver[o.driver_id]) byDriver[o.driver_id] = { driverId: o.driver_id, name: o.driver_name || '—', amount: 0, count: 0 };
        byDriver[o.driver_id].amount += Number(o.payment_cash) || 0;
        byDriver[o.driver_id].count += 1;
      }
    });
    return Object.values(byDriver).sort((a,b)=>b.amount-a.amount);
  }, [orders]);
  const driverCashOnHandTotal = driverCashOnHand.reduce((s,d)=>s+d.amount,0);

  const stockStats = products.reduce((acc,p)=>{
    acc.total++;
    // Та же проверка, что решает "в наличии"/"нет" у каждой карточки ниже
    // (stockIsOut учитывает вес для весового товара) — раньше здесь была
    // отдельная упрощённая проверка по p.stock>0, которая для весового
    // товара всегда ложная (1С коробов для него не шлёт вовсе, см.
    // /api/stock/sync), и в сводке он ошибочно уходил в "нет в наличии",
    // хотя в списке ниже та же позиция показана в наличии по весу.
    if (!stockIsOut(p)) acc.inStock++; else acc.outOfStock++;
    return acc;
  }, {total:0,inStock:0,outOfStock:0});

  const stockCategories = Array.from(new Set(products.map(p=>p.group).filter(Boolean))).sort((a,b)=>a.localeCompare(b));

  const q = stockSearch.trim().toLowerCase();
  const filteredProducts = products
    .filter(p => !q || (p.display_name||p.name||'').toLowerCase().includes(q) || (p.code||'').includes(q))
    .filter(p => !stockCategory || p.group===stockCategory)
    .filter(p => !hideEmpty || !stockIsOut(p))
    .slice()
    .sort((a,b)=>{
      const aOut = stockIsOut(a), bOut = stockIsOut(b);
      if (aOut!==bOut) return aOut?1:-1;
      return (a.display_name||a.name||'').localeCompare(b.display_name||b.name||'');
    });

  // Вкладка "Заявки" зав. склада — просмотр плюс одно исключение: заявки
  // самовывоза (см. canWarehousePickup в OrderDetail) зав. склад может сам
  // взять в работу и закрыть при выдаче товара. На остальные заявки ни
  // onDeleteOrder/onFixItemCost/onFixItemWeight, ни другие кнопки
  // изменения не показываются ни для одной роли, кроме перечисленных явно.
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [orderSearch, setOrderSearch] = useState("");
  const [orderFilter, setOrderFilter] = useState("all");
  const [pickupOnly, setPickupOnly] = useState(false);
  const ORDER_FILTERS = [["all","Все"],["new","Ожидает"],["in_transit","В работе"],["delivered","Доставлено"],["cancelled","Отказ"],["returned","Возврат"],["revoked","Отозвана"]];
  const oq = orderSearch.trim().toLowerCase();
  const filteredOrders = orders
    .filter(o=>orderFilter==="all"||o.status===orderFilter)
    .filter(o=>!pickupOnly || o.time_slot===PICKUP_SLOT)
    .filter(o=>!oq || String(o.id).includes(oq) || (o.client_name||'').toLowerCase().includes(oq) || (o.sales_name||'').toLowerCase().includes(oq));

  const [driverFilter, setDriverFilter] = useState("");
  const queueOrders = orders.filter(o=>o.status==="new");
  const activeOrders = orders.filter(o=>o.status==="in_transit");
  const byDriver = {};
  activeOrders.forEach(o=>{
    const key = o.driver_id || 'unassigned';
    if (!byDriver[key]) byDriver[key] = { key, name: o.driver_name || 'Без назначенного водителя', orders: [] };
    byDriver[key].orders.push(o);
  });
  const driverGroups = Object.values(byDriver)
    .filter(g=>!driverFilter || String(g.key)===driverFilter)
    .sort((a,b)=>b.orders.length-a.orders.length);
  const allDriverGroups = Object.values(byDriver).sort((a,b)=>b.orders.length-a.orders.length);

  // Факт. вес — интерактивный аналог бумажного загрузочного листа: вместо
  // ручки на распечатке зав. склад вписывает вес прямо здесь, по каждой
  // позиции каждой заявки отдельно (не суммарно по водителю — у разных
  // заявок вес своей партии, усреднять/схлопывать нельзя).
  const [expandedWeightsFor, setExpandedWeightsFor] = useState(null);
  const [weightForm, setWeightForm] = useState({});
  const [savingWeights, setSavingWeights] = useState(false);
  const orderItemsOf = (o) => typeof o.items === 'string' ? JSON.parse(o.items||'[]') : (o.items||[]);
  // it.is_weight_item — снимок на момент создания заявки; у заявок, оформленных
  // до того как товар отметили "Весовой" в карточке, снимок остался false, хотя
  // товар физически весовой. Подстраховываемся текущим состоянием карточки
  // товара (products грузится из /api/products и содержит priced_by_weight),
  // иначе такие заявки молча пропадают из формы ввода веса (сервер их тоже
  // принимает по этой же живой проверке, см. POST /api/orders/weights).
  const productByCode = useMemo(() => {
    const m = {}; products.forEach(p => { m[p.code] = p; }); return m;
  }, [products]);
  const isWeightItem = (it) => !!(it.is_weight_item || (productByCode[it.code] && productByCode[it.code].priced_by_weight));
  // Код->название из 1С для печати накладной на возврат (см.
  // buildReturnWaybillInnerHtml) — позиция возврата хранит псевдоним,
  // унаследованный от позиции заявки, а не название из 1С.
  const productNameByCode = useMemo(() => {
    const m = {}; products.forEach(p => { m[p.code] = p.name; }); return m;
  }, [products]);
  const saveWeights = async (group) => {
    const entries = [];
    group.orders.forEach(o=>{
      orderItemsOf(o).filter(isWeightItem).forEach(it=>{
        const key = `${o.id}_${it.code}`;
        const val = weightForm[key];
        if (val !== undefined && val !== '') entries.push({ orderId: o.id, code: it.code, weight: val });
      });
    });
    if (entries.length === 0) { alert('Введите хотя бы одно значение веса'); return; }
    // Проверка веса перед сохранением важна вдвойне: после подтверждения
    // склад сам исправить его уже не сможет (см. canOverride на сервере) —
    // только admin через карточку заявки.
    if (!window.confirm(`Проверьте вес ещё раз — сохранить нельзя будет изменить.\n\nСохранить фактический вес по ${entries.length} ${entries.length===1?'позиции':'позициям'}? Суммы заявок пересчитаются.`)) return;
    setSavingWeights(true);
    try {
      const res = await apiCall('POST', '/api/orders/weights', { entries });
      if (res.errors && res.errors.length) {
        alert('Часть значений не сохранена:\n' + res.errors.join('\n'));
      }
      // Очищаем поле ввода только для реально принятых сервером позиций
      // (res.applied) — иначе отклонённое значение (см. errors выше, например
      // некорректный вес или нехватка остатка) тихо стиралось бы из формы,
      // выглядя как ещё не введённое, хотя сотрудник его уже вписывал.
      const appliedKeys = new Set((res.applied || []).map(a => `${a.orderId}_${a.code}`));
      setWeightForm(f=>{ const next={...f}; entries.forEach(e=>{ const key=`${e.orderId}_${e.code}`; if (appliedKeys.has(key)) delete next[key]; }); return next; });
      setExpandedWeightsFor(null);
      loadOrders();
    } catch(e) { alert(e.message); }
    setSavingWeights(false);
  };

  return (
    <div style={{paddingBottom:72}}>
      <div style={S.page}>
        {tab==="stock"&&<>
          {showMovements&&<StockMovementsReport onClose={()=>setShowMovements(false)}/>}
          {showStatement&&<MaterialStatementReport onClose={()=>setShowStatement(false)}/>}
          {showReconcile&&<Reconcile1CReport onClose={()=>setShowReconcile(false)}/>}
          <div style={{...S.row,marginBottom:4}}>
            <p style={{...S.sectionTitle,margin:0}}>Остатки на складе</p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button style={{...S.btnOutline,width:"auto",padding:"6px 12px",fontSize:13}} onClick={()=>setShowMovements(true)}>📊 Отчёт по движению</button>
              <button style={{...S.btnOutline,width:"auto",padding:"6px 12px",fontSize:13}} onClick={()=>setShowStatement(true)}>📋 Ведомость</button>
              <button style={{...S.btnOutline,width:"auto",padding:"6px 12px",fontSize:13}} onClick={()=>setShowReconcile(true)}>🔍 Сверка с 1С</button>
            </div>
          </div>
          {!loadingProducts && products.length>0 && (
            <div style={S.statsRow}>
              <div style={S.statCard()}><p style={S.statNum()}>{stockStats.total}</p><p style={S.statLabel}>Всего позиций</p></div>
              <div style={S.statCard()}><p style={S.statNum(C.green)}>{stockStats.inStock}</p><p style={S.statLabel}>В наличии</p></div>
              <div style={S.statCard()}><p style={S.statNum(C.red)}>{stockStats.outOfStock}</p><p style={S.statLabel}>Нет в наличии</p></div>
            </div>
          )}
          <input
            style={{...S.input,marginBottom:12}}
            placeholder="Поиск по названию или коду..."
            value={stockSearch}
            onChange={e=>setStockSearch(e.target.value)}
          />
          <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap",alignItems:"center"}}>
            {stockCategories.length>1&&<>
              <button onClick={()=>setStockCategory("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${stockCategory===""?C.navy:C.border}`,background:stockCategory===""?C.navy:C.white,color:stockCategory===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все разделы</button>
              {stockCategories.map(cat=>(
                <button key={cat} onClick={()=>setStockCategory(cat)} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${stockCategory===cat?C.navy:C.border}`,background:stockCategory===cat?C.navy:C.white,color:stockCategory===cat?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{cat}</button>
              ))}
            </>}
            <button onClick={()=>setHideEmpty(h=>!h)} style={{marginLeft:"auto",padding:"5px 12px",borderRadius:99,border:`1px solid ${hideEmpty?C.green:C.border}`,background:hideEmpty?"#EAF5EE":C.white,color:hideEmpty?C.green:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>{hideEmpty?"✓ ":""}Только в наличии</button>
          </div>
          {loadingProducts?<div style={S.loadingWrap}>Загрузка...</div>
            :filteredProducts.length===0?<div style={{textAlign:"center",padding:"40px 0",color:C.textFaint}}>Ничего не найдено</div>
            :filteredProducts.map(p=>{
              const out = stockIsOut(p);
              const amt = stockAmount(p);
              const low = !out && amt!=null && amt<=5;
              const dot = out?C.red:(low?C.amber:C.green);
              const label = stockLabel(p);
              return (
                <div key={p.code} style={{...S.card,opacity:out?0.7:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:10}}>
                    <div style={{display:"flex",alignItems:"center",gap:10,minWidth:0}}>
                      <span style={{width:9,height:9,borderRadius:"50%",background:dot,flexShrink:0}}/>
                      <div style={{minWidth:0}}>
                        <p style={{...S.cardTitle,overflowWrap:"anywhere"}}>{p.display_name||p.name}</p>
                        <p style={S.cardSub}>Код: {p.code}{p.group?' · '+p.group:''}</p>
                      </div>
                    </div>
                    <div style={{textAlign:"right",flexShrink:0}}>
                      <span style={{display:"inline-block",padding:"4px 10px",borderRadius:8,fontWeight:800,fontFamily:FH,fontSize:17,background:out?C.redSoft:(low?"#FEF3C7":"#EAF5EE"),color:out?C.red:(low?C.amber:C.green)}}>{label!=null?label:'—'}</span>
                      {!p.priced_by_weight&&<p style={{margin:"4px 0 0",fontSize:13,color:C.textFaint}}>{p.stock_unit||''}</p>}
                    </div>
                  </div>
                  {p.stock_reserved>0&&<p style={{margin:"6px 0 0",fontSize:13,color:C.textFaint}}>Из 1С: {round2(p.stock_raw)} · в заявках: {round2(p.stock_reserved)} · доступно: {round2(p.stock)}</p>}
                  {p.stock_weight_kg_reserved>0&&<p style={{margin:"6px 0 0",fontSize:13,color:C.textFaint}}>Из 1С: {round2(p.stock_weight_kg)} кг · в заявках: {round2(p.stock_weight_kg_reserved)} кг · доступно: {round2(Math.max(0,p.stock_weight_kg-p.stock_weight_kg_reserved))} кг</p>}
                  <ProductHistoryToggle code={p.code}/>
                </div>
              );
            })
          }
        </>}
        {tab==="orders"&&<>
          <p style={S.sectionTitle}>Заявки</p>
          <input type="search" style={{...S.input,marginBottom:12}} placeholder="Поиск по номеру, клиенту, торговому…" value={orderSearch} onChange={e=>setOrderSearch(e.target.value)} autoComplete="off"/>
          <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
            {ORDER_FILTERS.map(([k,lb])=>(
              <button key={k} onClick={()=>setOrderFilter(k)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${orderFilter===k?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:orderFilter===k?C.navy:C.white,color:orderFilter===k?C.white:C.textMid}}>{lb}</button>
            ))}
          </div>
          <div style={{marginBottom:16}}>
            <button onClick={()=>setPickupOnly(p=>!p)} style={{padding:"6px 13px",borderRadius:99,border:`1px solid ${pickupOnly?C.navy:C.border}`,cursor:"pointer",fontSize:14,fontWeight:600,background:pickupOnly?C.navy:C.white,color:pickupOnly?C.white:C.textMid}}>🏬 Только самовывоз</button>
          </div>
          {loadingOrders?<div style={S.loadingWrap}>Загрузка...</div>
            :filteredOrders.length===0
              ?<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}><div style={{fontSize:40,marginBottom:12}}>📋</div><p>Заявок нет</p></div>
              :filteredOrders.map(o=><OrderCard key={o.id} order={o} onOpen={setSelectedOrder}/>)
          }
        </>}
        {tab==="shipping"&&<>
          <p style={S.sectionTitle}>Отгрузка</p>
          {queueOrders.length>0&&(
            <div style={{...S.card,background:C.redSoft,marginBottom:12}}>
              <p style={{margin:0,fontSize:15,fontWeight:600,color:C.accentDark}}>⏳ Ожидают назначения водителя: {queueOrders.length}</p>
            </div>
          )}
          {allDriverGroups.length>1&&(
            <div style={{display:"flex",gap:6,marginBottom:12,flexWrap:"wrap"}}>
              <button onClick={()=>setDriverFilter("")} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${driverFilter===""?C.navy:C.border}`,background:driverFilter===""?C.navy:C.white,color:driverFilter===""?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>Все водители</button>
              {allDriverGroups.map(g=>(
                <button key={g.key} onClick={()=>setDriverFilter(String(g.key))} style={{padding:"5px 12px",borderRadius:99,border:`1px solid ${driverFilter===String(g.key)?C.navy:C.border}`,background:driverFilter===String(g.key)?C.navy:C.white,color:driverFilter===String(g.key)?C.white:C.textMid,fontSize:14,fontWeight:600,cursor:"pointer"}}>{g.name}</button>
              ))}
            </div>
          )}
          {loadingOrders?<div style={S.loadingWrap}>Загрузка...</div>
            :driverGroups.length===0?<div style={{textAlign:"center",padding:"48px 0",color:C.textFaint}}><div style={{fontSize:40,marginBottom:12}}>🚚</div><p>Нет заявок в работе</p></div>
            :driverGroups.map((g)=>{
              const expanded = expandedWeightsFor===g.key;
              return (
              <div key={g.key} style={S.card}>
                <p style={S.cardTitle}>{g.name}</p>
                <p style={S.cardSub}>{g.orders.length} {g.orders.length===1?'заявка':'заявок'} в работе</p>
                <div style={{display:"flex",gap:8,marginTop:10}}>
                  <button onClick={()=>printLoadingList(g.orders,g.name,productByCode)} style={{flex:1,padding:"11px",background:C.navy,color:C.white,border:"none",borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer"}}>🧾 Загрузочный лист</button>
                  <button onClick={()=>setExpandedWeightsFor(k=>k===g.key?null:g.key)} style={{flex:1,padding:"11px",background:expanded?C.debtAmber:C.white,color:expanded?"#92400E":C.navy,border:`1.5px solid ${C.navy}`,borderRadius:10,fontSize:15,fontWeight:700,cursor:"pointer"}}>⚖️ {expanded?"Скрыть":"Ввести вес"}</button>
                </div>
                {expanded&&(()=>{
                  // Показываем только весовые позиции — у остальных qty
                  // остаётся в коробах/штуках, и это поле не для них
                  // (раньше показывалось для любого товара заявки, подписанное
                  // просто "кг", хотя вводить туда следовало только факт. вес
                  // весового товара). isWeightItem учитывает и снимок на
                  // заявке, и текущую карточку товара — старые заявки, у
                  // которых снимок не проставился, тоже не пропадают отсюда.
                  const ordersWithWeightItems = g.orders
                    .map(o=>({ order:o, weightItems: orderItemsOf(o).filter(isWeightItem) }))
                    .filter(x=>x.weightItems.length>0);
                  if (ordersWithWeightItems.length===0) {
                    return (
                      <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                        <p style={{margin:0,fontSize:14,color:C.textFaint}}>В заявках этого водителя нет весовых товаров — вводить вес не нужно.</p>
                      </div>
                    );
                  }
                  return (
                  <div style={{marginTop:12,paddingTop:12,borderTop:`1px solid ${C.border}`}}>
                    {ordersWithWeightItems.map(({order:o,weightItems})=>(
                      <div key={o.id} style={{marginBottom:12}}>
                        <p style={{margin:"0 0 6px",fontSize:14,fontWeight:700,color:C.textSub}}>№ {o.id} · {o.client_name}</p>
                        {weightItems.map(it=>(
                          <div key={it.code} style={{display:"flex",alignItems:"flex-start",gap:8,marginBottom:6}}>
                            <span style={{flex:1,minWidth:0,fontSize:14,color:C.textMid,overflowWrap:"anywhere"}}>
                              {it.name} {!it.weight_confirmed&&<span style={{color:C.textFaint}}>(заявка {it.qty} кг)</span>}
                              {it.weight_confirmed&&it.weighed_by_name&&<span style={{display:"block",fontSize:12,color:C.textFaint}}>Взвесил: {it.weighed_by_name}{it.weighed_at?', '+new Date(it.weighed_at).toLocaleString('ru-RU'):''}</span>}
                            </span>
                            {it.weight_confirmed ? (
                              // Вес зафиксирован сервером один раз и правке больше не
                              // подлежит (см. POST /api/orders/weights) — вместо поля
                              // ввода показываем итог как факт, а не как черновик.
                              <span style={{width:80,flexShrink:0,padding:"6px 8px",fontSize:14,fontWeight:700,color:C.green,textAlign:"right"}}>✓ {it.qty} кг</span>
                            ) : (
                              <input
                                type="number"
                                placeholder="кг"
                                style={{...S.input,width:80,flexShrink:0,padding:"6px 8px",fontSize:14}}
                                value={weightForm[`${o.id}_${it.code}`]||''}
                                onChange={e=>setWeightForm(f=>({...f,[`${o.id}_${it.code}`]:e.target.value}))}
                                onFocus={e=>e.target.select()}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    ))}
                    <button onClick={()=>saveWeights(g)} disabled={savingWeights} style={{...S.btnPrimary,marginTop:4,opacity:savingWeights?0.6:1}}>{savingWeights?"Сохраняю...":"Сохранить вес"}</button>
                  </div>
                  );
                })()}
              </div>
              );
            })
          }
          <WeighLogPanel/>
        </>}
        {tab==="cash"&&<>
          <p style={S.sectionTitle}>Наличка на руках у водителей</p>
          <p style={{margin:"0 0 10px",fontSize:13,color:C.textFaint}}>Для информации — ещё не сдано складу, принять можно только после того, как водитель оформит сдачу ниже.</p>
          {loadingOrders?<div style={S.loadingWrap}>Загрузка...</div>
            : driverCashOnHand.length===0
              ? <div style={{...S.card,marginBottom:16,textAlign:"center",color:C.textFaint}}>Ни у кого нет неучтённой налички</div>
              : <div style={{...S.card,marginBottom:16}}>
                  <div style={{...S.row,marginBottom:driverCashOnHand.length>0?10:0,paddingBottom:10,borderBottom:`1px solid ${C.border}`}}>
                    <span style={{fontSize:14,fontWeight:700,color:C.textSub}}>Итого на руках</span>
                    <span style={{fontSize:19,fontWeight:800,fontFamily:FH,color:"#15803D"}}>{driverCashOnHandTotal.toLocaleString()} ₸</span>
                  </div>
                  {driverCashOnHand.map(d=>(
                    <div key={d.driverId} style={{...S.row,marginBottom:6}}>
                      <span style={{fontSize:15,color:C.text}}>{d.name} <span style={{color:C.textFaint,fontSize:13}}>({d.count} {d.count===1?'заявка':'заявок'})</span></span>
                      <span style={{fontSize:15,fontWeight:700,fontFamily:FH}}>{d.amount.toLocaleString()} ₸</span>
                    </div>
                  ))}
                </div>
          }
          <p style={{...S.sectionTitle,marginTop:20}}>Приём налички от водителей</p>
          {loadingHandovers?<div style={S.loadingWrap}>Загрузка...</div>:<>
            {pendingHandovers.length===0
              ? <div style={{textAlign:"center",padding:"40px 0",color:C.textFaint}}>Ожидающих сдач нет</div>
              : pendingHandovers.map(h=>(
                <div key={h.id} style={{...S.card,background:"#FFFBEB",border:"1px solid #FDE68A"}}>
                  <div style={S.row}>
                    <div>
                      <p style={S.cardTitle}>{h.driver_name}</p>
                      <p style={S.cardSub}>{h.date} · заявок: {h.order_ids.length}</p>
                    </div>
                    <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:"#92400E"}}>{h.expected_amount.toLocaleString()} ₸</p>
                  </div>
                  {confirmingId!==h.id ? (
                    <button onClick={()=>startConfirm(h)} style={{...S.btnPrimary,marginTop:10}}>Принять и подтвердить</button>
                  ) : (
                    <div style={{marginTop:10,paddingTop:10,borderTop:`1px solid ${C.border}`}}>
                      <label style={{...S.label,fontSize:12}}>Сколько реально принято, ₸</label>
                      <input type="number" style={{...S.input,marginBottom:8}} value={confirmForm.actualAmount} onChange={e=>setConfirmForm(f=>({...f,actualAmount:e.target.value}))} onFocus={e=>e.target.select()}/>
                      <label style={{...S.label,fontSize:12}}>Комментарий, необязательно</label>
                      <textarea style={{...S.textarea,marginBottom:8}} placeholder="Например: причина недостачи" value={confirmForm.comment} onChange={e=>setConfirmForm(f=>({...f,comment:e.target.value}))}/>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={()=>submitConfirm(h.id)} disabled={savingConfirm} style={{...S.btnPrimary,marginTop:0,opacity:savingConfirm?0.6:1}}>{savingConfirm?"Сохраняю...":"Подтвердить"}</button>
                        <button onClick={()=>setConfirmingId(null)} disabled={savingConfirm} style={{...S.btnSecondary,marginTop:0}}>Отмена</button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            }
            {confirmedHandovers.length>0&&(
              <>
                <p style={{...S.sectionTitle,fontSize:17,marginTop:20}}>История</p>
                {confirmedHandovers.map(h=>(
                  <div key={h.id} style={S.card}>
                    <div style={S.row}>
                      <div>
                        <p style={S.cardTitle}>{h.driver_name}</p>
                        <p style={S.cardSub}>{h.date} · ожидалось {h.expected_amount.toLocaleString()} ₸ · принято {h.actual_amount.toLocaleString()} ₸</p>
                      </div>
                      {h.difference!==0&&(
                        <span style={{fontSize:13,fontWeight:700,padding:"3px 9px",borderRadius:99,background:h.difference<0?C.redSoft:"#EAF5EE",color:h.difference<0?C.red:C.green}}>
                          {h.difference<0?`Недостача ${Math.abs(h.difference).toLocaleString()}`:`Излишек ${h.difference.toLocaleString()}`} ₸
                        </span>
                      )}
                    </div>
                    {h.comment&&<p style={{margin:"6px 0 0",fontSize:13,color:C.textFaint}}>{h.comment}</p>}
                  </div>
                ))}
              </>
            )}
          </>}
        </>}
        {tab==="returns"&&<>
          <p style={S.sectionTitle}>Возвраты от водителей</p>
          <p style={{margin:"0 0 16px",fontSize:13,color:C.textFaint}}>Подтвердите, только когда товар физически принят — до этого остаток по нему не пополняется.</p>
          {loadingReturns?<div style={S.loadingWrap}>Загрузка...</div>:<>
            {pendingReturns.length===0
              ? <div style={{textAlign:"center",padding:"40px 0",color:C.textFaint}}>Ожидающих возвратов нет</div>
              : pendingReturns.map(r=>(
                <div key={r.id} style={{...S.card,background:"#FFFBEB",border:"1px solid #FDE68A"}}>
                  <div style={S.row}>
                    <div>
                      <p style={S.cardTitle}>{r.client_name}{r.order_id?` · заявка №${r.order_id}`:''}</p>
                      <p style={S.cardSub}>{r.date} · оформил {r.created_by_name}</p>
                    </div>
                    <p style={{margin:0,fontSize:19,fontWeight:800,fontFamily:FH,color:"#92400E"}}>{r.total.toLocaleString()} ₸</p>
                  </div>
                  <p style={{margin:"8px 0 0",fontSize:14,color:C.textSub}}>{r.items.map(it=>`${it.name} × ${it.qty}`).join(', ')}</p>
                  {r.reason&&<p style={{margin:"4px 0 0",fontSize:13,color:C.textFaint}}>Причина: {r.reason}</p>}
                  <button onClick={()=>confirmReturn(r.id)} disabled={confirmingReturnId===r.id} style={{...S.btnPrimary,marginTop:10,opacity:confirmingReturnId===r.id?0.6:1}}>{confirmingReturnId===r.id?"Подтверждаю...":"✓ Принял, подтвердить"}</button>
                </div>
              ))
            }
            {confirmedReturns.length>0&&(
              <>
                <p style={{...S.sectionTitle,fontSize:17,marginTop:20}}>История</p>
                {confirmedReturns.map(r=>(
                  <div key={r.id} style={S.card}>
                    <div style={S.row}>
                      <div>
                        <p style={S.cardTitle}>{r.client_name}{r.order_id?` · заявка №${r.order_id}`:''}</p>
                        <p style={S.cardSub}>{r.date} · принял {r.confirmed_by_name}</p>
                      </div>
                      <p style={{margin:0,fontSize:17,fontWeight:800,fontFamily:FH,color:C.text}}>{r.total.toLocaleString()} ₸</p>
                    </div>
                    <p style={{margin:"8px 0 0",fontSize:14,color:C.textSub}}>{r.items.map(it=>`${it.name} × ${it.qty}`).join(', ')}</p>
                    <button onClick={()=>printReturnWaybill(r,productNameByCode)} style={{...S.btnOutline,marginTop:10,width:"auto",padding:"8px 14px",fontSize:14}}>🖨 Печать накладной</button>
                  </div>
                ))}
              </>
            )}
          </>}
        </>}
      </div>
      {selectedOrder&&<OrderDetail order={selectedOrder} onClose={()=>setSelectedOrder(null)} onUpdateStatus={handleUpdate} currentUser={user} products={products}/>}
      <div style={S.nav}>
        {[["stock","📦","Остатки"],["orders","📋","Заявки"],["shipping","🚚","Отгрузка"],["cash","💰","Инкассация"],["returns","↩️","Возвраты"]].map(([k,ic,lb])=>(
          <button key={k} style={{...S.navBtn(tab===k),flex:1,position:"relative"}} onClick={()=>setTab(k)}>
            <span style={S.navIcon}>{ic}</span><span style={S.navLabel(tab===k)}>{lb}</span>
            {k==="cash"&&pendingHandovers.length>0&&<span style={{position:"absolute",top:2,right:"22%",background:C.red,color:C.white,fontSize:10,fontWeight:700,borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{pendingHandovers.length}</span>}
            {k==="returns"&&pendingReturns.length>0&&<span style={{position:"absolute",top:2,right:"22%",background:C.red,color:C.white,fontSize:10,fontWeight:700,borderRadius:99,minWidth:16,height:16,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>{pendingReturns.length}</span>}
          </button>
        ))}
      </div>
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(() => {
    try {
      const msg = sessionStorage.getItem('forcedLogoutMessage');
      if (msg) sessionStorage.removeItem('forcedLogoutMessage');
      return msg || "";
    } catch(e) { return ""; }
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pushStatus, setPushStatus] = useState(
    (typeof Notification !== 'undefined') ? Notification.permission : 'unsupported'
  );
  const [pushMsg, setPushMsg] = useState('');
  const isDesktop = useIsDesktop();
  const [loginHints, setLoginHints] = useState([]);
  const [showLoginDrop, setShowLoginDrop] = useState(false);

  useEffect(() => {
    fetch('/api/login-hints').then(r=>r.json()).then(setLoginHints).catch(()=>{});
  }, []);

  // На части устройств/браузеров Notification.permission на свежей загрузке
  // страницы иногда читается как "default", даже когда уже есть живая и
  // рабочая PushSubscription (пуши при этом реально доходят) — это
  // рассинхрон между разрешением и подпиской, встречается не только на iOS.
  // pushStatus (и, значит, баннер "Включите уведомления") опирается только
  // на этот хрупкий Notification.permission — из-за чего баннер лез каждый
  // раз, хотя всё уже работает. Подстраховываемся: если подписка реально
  // есть, считаем пуш включённым независимо от того, что говорит permission.
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    navigator.serviceWorker.ready
      .then(reg => reg.pushManager.getSubscription())
      .then(sub => { if (sub) setPushStatus('granted'); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const parts = token.split('.');
        const base64 = parts[1].replace(/-/g,'+').replace(/_/g,'/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const payload = JSON.parse(jsonPayload);
        if (payload.exp * 1000 > Date.now()) {
          setUser({ id: payload.id, name: payload.name, role: payload.role, region: payload.region });
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            trySilentSubscribe();
          }
        } else {
          removeToken();
        }
      } catch(e) {
        removeToken();
      }
    }
    setChecking(false);
  }, []);

  // Кнопка/жест "назад" в установленном PWA (или просто в мобильном
  // браузере) на самом первом экране после логина не находит в истории
  // вкладки ничего своего и закрывает приложение целиком — история
  // сессии там пуста (одна запись из самой загрузки страницы). Держим
  // "пол": сразу после логина добавляем одну свою запись истории, а при
  // попытке уйти ниже нее (реальный выход) тут же восстанавливаем её —
  // синхронно внутри обработчика popstate это отменяет выход. Экраны со
  // своим pushState/popstate (например, "Новая заявка") отрабатывают на
  // том же событии первыми и этим не задеты — увидят свою запись и не
  // тронут этот "пол".
  //
  // Раньше попытка выйти просто беззвучно гасилась — по просьбе заказчика
  // сначала спрашиваем подтверждение. Веб-страница не может сама закрыть
  // вкладку/установленное приложение (это отдаёт браузер только тем, что
  // сам открыл через window.open) — ближайший осмысленный аналог "выйти"
  // здесь: разлогинить и вернуть на экран входа.
  useEffect(() => {
    if (!user) return;
    window.history.pushState({ appFloor: true }, '', '');
    const trapBack = () => {
      if (!window.history.state || !window.history.state.appFloor) {
        if (window.confirm('Вы действительно хотите выйти из приложения?')) {
          handleLogout();
        } else {
          window.history.pushState({ appFloor: true }, '', '');
        }
      }
    };
    window.addEventListener('popstate', trapBack);
    return () => window.removeEventListener('popstate', trapBack);
  }, [!!user]);

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const data = await apiCall('POST', '/api/login', { login, password });
      setToken(data.token);
      setUser(data.user);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        trySilentSubscribe();
      }
    } catch(e) {
      setError(e.message);
    }
    setLoading(false);
  };

  const handleLogout = () => {
    unsubscribeFromPush();
    // Best-effort: освобождаем сессию на сервере сразу (см. POST /api/logout),
    // чтобы не ждать SESSION_IDLE_MS простоя, прежде чем кто-то другой сможет
    // войти в этот же аккаунт. Не блокируем сам выход, если запрос не прошёл
    // (например, токен уже истёк) — локально из приложения всё равно выходим.
    apiCall('POST', '/api/logout').catch(()=>{});
    removeToken();
    setUser(null);
  };
  const enablePush = () => {
    setPushMsg('Подключаем...');
    subscribeToPush().then((result) => {
      if (typeof Notification !== 'undefined') setPushStatus(Notification.permission);
      setPushMsg(result.ok ? 'Уведомления включены ✓' : 'Ошибка: ' + result.error);
      setTimeout(() => setPushMsg(''), 6000);
    });
  };
  const trySilentSubscribe = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    setPushMsg('Проверяем подписку...');
    subscribeToPush().then((result) => {
      if (result.ok) setPushStatus('granted');
      setPushMsg(result.ok ? 'Подписка активна ✓' : 'Ошибка подписки: ' + result.error);
      setTimeout(() => setPushMsg(''), 8000);
    });
  };
  const ROLE_LABEL = { sales:"Торговый представитель", senior_sales:"Старший торговый представитель", driver:"Водитель", cashier:"Кассир", warehouse:"Зав. склад", operator:"Оператор", admin:"Администратор", manager:"Менеджер", store:"Магазин" };

  if (checking) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.surface}}>
      <div style={{fontSize:16,color:C.textSub}}>Загрузка...</div>
    </div>
  );

  if (!user) return (
    <div style={S.loginWrap}>
      <div style={S.loginCard}>
        <img src="/icon-192.png" alt="" style={{width:76,height:76,display:"block",margin:"0 auto 14px"}}/>
        <h1 style={{...S.logoTitle,textAlign:"center"}}>Жайық Ақтау</h1>
        <p style={{...S.logoSub,textAlign:"center"}}>құс өнімі · система заявок</p>
        {error&&<div style={S.errorBox}>{error}</div>}
        <div style={S.formGroup}>
          <label style={S.label}>Логин</label>
          <div style={{position:"relative"}}>
            <input
              style={S.input}
              value={login}
              onChange={e=>{setLogin(e.target.value); setShowLoginDrop(true);}}
              onFocus={()=>setShowLoginDrop(true)}
              onBlur={()=>setTimeout(()=>setShowLoginDrop(false),180)}
              placeholder="Введите логин"
              autoComplete="off"
            />
            {showLoginDrop && (()=>{
              const q = login.toLowerCase();
              const matched = q ? loginHints.filter(u=>u.login.toLowerCase().includes(q)||u.name.toLowerCase().includes(q)) : loginHints;
              return matched.length>0 && (
                <div style={{position:"absolute",top:"100%",left:0,right:0,background:C.white,border:`1px solid ${C.border}`,borderRadius:8,boxShadow:"0 4px 16px rgba(0,0,0,0.1)",zIndex:50,maxHeight:240,overflowY:"auto",marginTop:4}}>
                  {matched.map(u=>(
                    <div
                      key={u.login}
                      onMouseDown={()=>{setLogin(u.login);setShowLoginDrop(false);document.getElementById('loginPasswordInput')?.focus();}}
                      style={{padding:"10px 12px",cursor:"pointer",borderBottom:`1px solid ${C.border}`,fontSize:15}}
                    >
                      <div style={{fontWeight:600,color:C.text}}>{u.name}</div>
                      <div style={{fontSize:13,color:C.textFaint}}>{u.login}</div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
        <div style={{...S.formGroup,marginBottom:20}}><label style={S.label}>Пароль</label><input id="loginPasswordInput" style={S.input} type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Введите пароль" onKeyDown={e=>e.key==="Enter"&&handleLogin()}/></div>
        <button style={{...S.btnPrimary,opacity:loading?0.7:1}} onClick={handleLogin} disabled={loading}>{loading?"Вход...":"Войти"}</button>
      </div>
    </div>
  );

  // менеджер/админ/оператор на большом экране — версия с сайдбаром
  if ((user.role==="admin"||user.role==="manager"||user.role==="operator") && isDesktop) {
    return (
      <div style={S.app}>
        {(pushStatus==="default" || pushMsg) && (
          <div style={{background:C.accent,color:"#fff",padding:"10px 16px",fontSize:15}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <span>Включите уведомления, чтобы не пропускать новые заявки</span>
              <button onClick={enablePush} style={{background:"#fff",color:C.accent,border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Включить</button>
            </div>
            {pushMsg && <div style={{marginTop:6,fontSize:14,opacity:0.95}}>{pushMsg}</div>}
          </div>
        )}
        {pushStatus==="denied" && (
          <div style={{background:"#78716C",color:"#fff",padding:"10px 16px",fontSize:14,lineHeight:1.4}}>
            Уведомления заблокированы в настройках телефона. Зайдите в настройки уведомлений приложения "Жайык" в системе и разрешите их вручную.
          </div>
        )}
        <AdminCabinet user={user} onLogout={handleLogout} desktop={true}/>
      </div>
    );
  }

  // магазин на большом экране — тоже версия с сайдбаром
  if (user.role==="store" && isDesktop) {
    return (
      <div style={S.app}>
        {(pushStatus==="default" || pushMsg) && (
          <div style={{background:C.accent,color:"#fff",padding:"10px 16px",fontSize:15}}>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
              <span>Включите уведомления, чтобы не пропускать статус заказов</span>
              <button onClick={enablePush} style={{background:"#fff",color:C.accent,border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Включить</button>
            </div>
            {pushMsg && <div style={{marginTop:6,fontSize:14,opacity:0.95}}>{pushMsg}</div>}
          </div>
        )}
        {pushStatus==="denied" && (
          <div style={{background:"#78716C",color:"#fff",padding:"10px 16px",fontSize:14,lineHeight:1.4}}>
            Уведомления заблокированы в настройках телефона. Зайдите в настройки уведомлений приложения "Жайык" в системе и разрешите их вручную.
          </div>
        )}
        <StoreCabinet user={user} onLogout={handleLogout} desktop={true}/>
      </div>
    );
  }

  return (
    <div style={S.app}>
      {(pushStatus==="default" || pushMsg) && (
        <div style={{background:C.accent,color:"#fff",padding:"10px 16px",fontSize:15}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
            <span>Включите уведомления о заявках</span>
            <button onClick={enablePush} style={{background:"#fff",color:C.accent,border:"none",borderRadius:8,padding:"6px 14px",fontWeight:700,cursor:"pointer",whiteSpace:"nowrap"}}>Включить</button>
          </div>
          {pushMsg && <div style={{marginTop:6,fontSize:14,opacity:0.95}}>{pushMsg}</div>}
        </div>
      )}
      {pushStatus==="denied" && (
        <div style={{background:"#78716C",color:"#fff",padding:"10px 16px",fontSize:14,lineHeight:1.4}}>
          Уведомления заблокированы в настройках телефона. Зайдите в настройки уведомлений приложения "Жайык" в системе и разрешите их вручную.
        </div>
      )}
      <div style={S.header}>
        <Brand size={40}/>
        <div style={{textAlign:"right"}}>
          <div style={{fontSize:15,fontWeight:700,color:C.text}}>{user.name}</div>
          <div style={{fontSize:13,color:C.textSub}}>{ROLE_LABEL[user.role]} · <button style={S.logoutBtn} onClick={handleLogout}>Выйти</button></div>
        </div>
      </div>
      {(user.role==="sales"||user.role==="senior_sales")&&<SalesCabinet user={user} onLogout={handleLogout}/>}
      {user.role==="store"&&<StoreCabinet user={user} onLogout={handleLogout}/>}
      {user.role==="driver"&&<DriverCabinet user={user} onLogout={handleLogout}/>}
      {user.role==="cashier"&&<CashierCabinet user={user} onLogout={handleLogout}/>}
      {user.role==="warehouse"&&<WarehouseCabinet user={user} onLogout={handleLogout}/>}
      {(user.role==="admin"||user.role==="manager"||user.role==="operator")&&<AdminCabinet user={user} onLogout={handleLogout} desktop={false}/>}
    </div>
  );
}

ReactDOM.render(<App/>, document.getElementById('root'));
