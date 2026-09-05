const {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo
} = React;
const API = '';
const FH = "'Manrope', sans-serif"; /* шрифт заголовков и цифр */

const TIME_SLOTS = ["До обеда (09:00 – 14:00)", "После обеда (14:00 – 19:00)"];
const PICKUP_SLOT = "Самовывоз";
const SL = {
  new: "Ожидает",
  in_transit: "В работе",
  delivered: "Доставлено",
  cancelled: "Отказ при получении",
  returned: "Возврат",
  revoked: "Отозвана"
};
const SC = {
  new: "#DA1A10",
  in_transit: "#B45309",
  delivered: "#15803D",
  cancelled: "#DC2626",
  returned: "#7C3AED",
  revoked: "#6B7280"
};
const SB = {
  new: "#FCEBEA",
  in_transit: "#FBF3E6",
  delivered: "#EAF5EE",
  cancelled: "#FEF2F2",
  returned: "#F5F3FF",
  revoked: "#F3F4F6"
};
const C = {
  navy: "#1C1917",
  accent: "#1DA851",
  accentDark: "#157E3C",
  redSoft: "#FCEBEA",
  white: "#FFFFFF",
  surface: "#F5F3F0",
  border: "#E7E3DE",
  text: "#1C1917",
  textMid: "#44403C",
  textSub: "#79716B",
  textFaint: "#A8A29E",
  green: "#15803D",
  amber: "#B45309",
  red: "#DC2626",
  // "Новых"/"Ожидают" в статистике — отдельный от бренда цвет (раньше accent
  // и он же совпадал с этим статусом; после ребрендинга в зелёный оставляем
  // тёплый оттенок, иначе не отличить от зелёного "Доставлено" рядом).
  pending: "#DA1A10",
  cashGreen: "#DCFCE7",
  qrBlue: "#DBEAFE",
  debtAmber: "#FEF3C7"
};
const R = 14;
const S = {
  app: {
    fontFamily: "inherit",
    minHeight: "100vh",
    background: C.surface,
    color: C.text,
    fontSize: 17
  },
  loginWrap: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    background: C.surface
  },
  loginCard: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: "44px 36px",
    width: "100%",
    maxWidth: 380,
    boxShadow: "0 4px 24px rgba(28,25,23,0.07)"
  },
  logoTitle: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 26,
    fontWeight: 800,
    color: C.navy,
    margin: "0 0 4px",
    letterSpacing: "-0.01em"
  },
  logoSub: {
    fontSize: 13,
    color: C.accent,
    margin: "0 0 32px",
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase"
  },
  label: {
    display: "block",
    fontSize: 14,
    fontWeight: 600,
    color: C.textMid,
    marginBottom: 6,
    letterSpacing: "0.04em",
    textTransform: "uppercase"
  },
  input: {
    width: "100%",
    padding: "13px 14px",
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 18,
    outline: "none",
    boxSizing: "border-box",
    background: C.white,
    color: C.text
  },
  btnPrimary: {
    width: "100%",
    padding: "15px",
    background: C.accent,
    color: C.white,
    border: "none",
    borderRadius: R,
    fontFamily: FH,
    fontSize: 18,
    fontWeight: 800,
    cursor: "pointer",
    marginTop: 4,
    boxShadow: "0 6px 18px rgba(29,168,81,0.28)"
  },
  errorBox: {
    background: "#FEF2F2",
    color: C.red,
    border: "1px solid #FECACA",
    padding: "10px 13px",
    borderRadius: 8,
    fontSize: 15,
    marginBottom: 16
  },
  header: {
    background: C.white,
    color: C.text,
    padding: "0 18px",
    height: 62,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    position: "sticky",
    top: 0,
    zIndex: 100,
    borderBottom: `1px solid ${C.border}`
  },
  headerMark: {
    fontFamily: "'Inter', sans-serif",
    fontSize: 19,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: C.navy,
    lineHeight: 1.1
  },
  headerSub: {
    fontSize: 12,
    color: C.accent,
    fontWeight: 700,
    letterSpacing: "0.14em",
    textTransform: "uppercase",
    marginTop: 2
  },
  logoutBtn: {
    background: "transparent",
    border: "none",
    color: C.accent,
    padding: 0,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 600
  },
  page: {
    padding: "20px 16px 80px",
    maxWidth: 520,
    margin: "0 auto"
  },
  card: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: R,
    padding: "14px 16px",
    marginBottom: 10
  },
  cardTitle: {
    fontFamily: FH,
    fontSize: 18,
    fontWeight: 800,
    color: C.text,
    margin: "0 0 3px"
  },
  cardSub: {
    fontSize: 15,
    color: C.textSub,
    margin: 0
  },
  badge: s => ({
    display: "inline-block",
    padding: "4px 11px",
    borderRadius: 99,
    fontSize: 14,
    fontWeight: 700,
    color: SC[s],
    background: SB[s]
  }),
  statsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 10,
    marginBottom: 18
  },
  statCard: a => ({
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: R,
    padding: "12px 14px 10px"
  }),
  statNum: a => ({
    fontFamily: FH,
    fontSize: 26,
    fontWeight: 800,
    color: a || C.navy,
    margin: "0 0 2px",
    fontVariantNumeric: "tabular-nums"
  }),
  statLabel: {
    fontSize: 14,
    color: C.textSub,
    margin: 0,
    fontWeight: 500
  },
  nav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    background: C.white,
    borderTop: `1px solid ${C.border}`,
    display: "flex",
    zIndex: 100
  },
  navBtn: a => ({
    flex: 1,
    padding: "12px 0 10px",
    border: "none",
    background: "none",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    color: a ? C.accent : C.textFaint,
    borderTop: a ? `2.5px solid ${C.accent}` : "2.5px solid transparent"
  }),
  navIcon: {
    fontSize: 23
  },
  navLabel: a => ({
    fontSize: 13,
    fontWeight: a ? 700 : 500
  }),
  formGroup: {
    marginBottom: 16
  },
  select: {
    width: "100%",
    padding: "13px 14px",
    border: `1.5px solid ${C.border}`,
    borderRadius: 10,
    fontSize: 18,
    outline: "none",
    boxSizing: "border-box",
    background: C.white
  },
  textarea: {
    width: "100%",
    padding: "11px 13px",
    border: `1.5px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 15,
    outline: "none",
    boxSizing: "border-box",
    resize: "vertical",
    minHeight: 70,
    background: C.white
  },
  btnSuccess: {
    width: "100%",
    padding: "15px",
    background: C.green,
    color: C.white,
    border: "none",
    borderRadius: R,
    fontFamily: FH,
    fontSize: 18,
    fontWeight: 800,
    cursor: "pointer"
  },
  btnDanger: {
    width: "100%",
    padding: "14px",
    background: C.white,
    color: C.red,
    border: `1.5px solid ${C.red}`,
    borderRadius: R,
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8
  },
  btnSecondary: {
    padding: "7px 14px",
    background: C.surface,
    color: C.textMid,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    fontSize: 15,
    cursor: "pointer"
  },
  btnOutline: {
    width: "100%",
    padding: "14px",
    background: C.white,
    color: C.navy,
    border: `1.5px solid ${C.navy}`,
    borderRadius: R,
    fontSize: 17,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 8
  },
  divider: {
    border: "none",
    borderTop: `1px solid ${C.border}`,
    margin: "14px 0"
  },
  sectionTitle: {
    fontFamily: FH,
    fontSize: 19,
    fontWeight: 800,
    color: C.navy,
    margin: "0 0 14px"
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between"
  },
  alertSuccess: {
    background: "#EAF5EE",
    color: C.green,
    border: "1px solid #BBF7D0",
    padding: "11px 14px",
    borderRadius: 10,
    fontSize: 15,
    fontWeight: 600,
    marginBottom: 16
  },
  revenueCard: {
    background: C.white,
    border: `1px solid ${C.border}`,
    borderRadius: R,
    padding: "16px",
    marginBottom: 12
  },
  revenueLabel: {
    margin: "0 0 4px",
    fontSize: 13,
    color: C.textSub,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em"
  },
  revenueNum: {
    fontFamily: FH,
    margin: 0,
    fontSize: 28,
    fontWeight: 800,
    color: C.accent,
    fontVariantNumeric: "tabular-nums"
  },
  bigCreate: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    width: "100%",
    minHeight: 56,
    background: C.accent,
    color: C.white,
    border: "none",
    borderRadius: R,
    fontFamily: FH,
    fontWeight: 800,
    fontSize: 19,
    cursor: "pointer",
    boxShadow: "0 6px 18px rgba(29,168,81,0.28)",
    marginBottom: 16
  },
  bigCreatePlus: {
    width: 26,
    height: 26,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.22)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 20,
    fontWeight: 700,
    lineHeight: 1
  },
  // десктоп: сайдбар менеджера
  side: {
    width: 240,
    flexShrink: 0,
    background: C.white,
    color: C.text,
    padding: "26px 20px",
    display: "flex",
    flexDirection: "column",
    position: "sticky",
    top: 0,
    height: "100vh",
    borderRight: `1px solid ${C.border}`
  },
  sideLink: a => ({
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "12px 14px",
    marginBottom: 4,
    borderRadius: 10,
    color: a ? "#fff" : C.textMid,
    background: a ? C.accent : "transparent",
    textDecoration: "none",
    fontSize: 16,
    fontWeight: a ? 700 : 500,
    cursor: "pointer",
    border: "none",
    width: "100%",
    textAlign: "left"
  }),
  main: {
    flex: 1,
    padding: "34px 42px",
    minWidth: 0
  },
  h1: {
    fontFamily: FH,
    fontSize: 24,
    fontWeight: 800,
    letterSpacing: "-0.01em",
    color: C.navy,
    margin: 0
  },
  h1sub: {
    color: C.textSub,
    fontSize: 16,
    marginTop: 4
  },
  th: {
    textAlign: "left",
    fontSize: 13,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: C.textSub,
    fontWeight: 700,
    padding: "13px 18px",
    background: "#FAF9F7",
    borderBottom: `1px solid ${C.border}`
  },
  td: {
    padding: "14px 18px",
    borderBottom: `1px solid ${C.border}`,
    fontSize: 16,
    verticalAlign: "middle"
  },
  loadingWrap: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "48px 0",
    color: C.textFaint
  }
};
function useIsDesktop() {
  const [d, setD] = useState(() => window.matchMedia('(min-width: 900px)').matches);
  useEffect(() => {
    const m = window.matchMedia('(min-width: 900px)');
    const h = e => setD(e.matches);
    if (m.addEventListener) m.addEventListener('change', h);else m.addListener(h);
    return () => {
      if (m.removeEventListener) m.removeEventListener('change', h);else m.removeListener(h);
    };
  }, []);
  return d;
}
function getToken() {
  return localStorage.getItem('token');
}
function setToken(t) {
  localStorage.setItem('token', t);
}
function removeToken() {
  localStorage.removeItem('token');
}
async function apiCall(method, path, body) {
  const opts = {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${getToken()}`
    }
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
      try {
        sessionStorage.setItem('forcedLogoutMessage', data.error || 'Сессия завершена, войдите заново');
      } catch (e) {}
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
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      let w = img.width,
        h = img.height;
      if (w > maxSide || h > maxSide) {
        if (w > h) {
          h = Math.round(h * maxSide / w);
          w = maxSide;
        } else {
          w = Math.round(w * maxSide / h);
          h = maxSide;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
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
    return {
      ok: false,
      error: 'Push API не поддерживается этим браузером'
    };
  }
  let permission;
  try {
    permission = await Notification.requestPermission();
  } catch (e) {
    return {
      ok: false,
      error: 'requestPermission: ' + e.message
    };
  }
  if (permission !== 'granted') {
    return {
      ok: false,
      error: 'Разрешение не выдано (' + permission + ')'
    };
  }
  try {
    const reg = await navigator.serviceWorker.ready;
    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      const {
        publicKey
      } = await apiCall('GET', '/api/push/vapid-public-key');
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
    }
    await apiCall('POST', '/api/push/subscribe', {
      subscription: sub
    });
    return {
      ok: true
    };
  } catch (e) {
    return {
      ok: false,
      error: e && e.message || String(e)
    };
  }
}
async function unsubscribeFromPush() {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await apiCall('POST', '/api/push/unsubscribe', {
        endpoint: sub.endpoint
      });
      await sub.unsubscribe();
    }
  } catch (e) {
    console.error('Push unsubscribe failed:', e);
  }
}
function Brand({
  light,
  size
}) {
  const s = size || 42;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 11
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: "/icon-192.png",
    alt: "",
    style: {
      width: s,
      height: s,
      flexShrink: 0
    }
  }), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.headerMark,
      color: light ? "#fff" : C.navy
    }
  }, "\u0416\u0430\u0439\u044B\u049B \u0410\u049B\u0442\u0430\u0443"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.headerSub,
      color: light ? "#F1AAA6" : C.accent
    }
  }, "\u049B\u04B1\u0441 \u04E9\u043D\u0456\u043C\u0456")));
}
function StatusBadge({
  status
}) {
  return /*#__PURE__*/React.createElement("span", {
    style: S.badge(status)
  }, SL[status] || status);
}
function PaymentTags({
  payment
}) {
  if (!payment) return null;
  const tags = [];
  if (payment.cash > 0) tags.push({
    label: `Нал: ${payment.cash.toLocaleString()} ₸`,
    bg: C.cashGreen,
    color: "#15803D"
  });
  if (payment.qr > 0) tags.push({
    label: `QR: ${payment.qr.toLocaleString()} ₸`,
    bg: C.qrBlue,
    color: "#1D4ED8"
  });
  if (payment.debt > 0) tags.push({
    label: `Долг: ${payment.debt.toLocaleString()} ₸`,
    bg: C.debtAmber,
    color: "#92400E"
  });
  return /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      flexWrap: "wrap",
      marginTop: 6
    }
  }, tags.map((t, i) => /*#__PURE__*/React.createElement("span", {
    key: i,
    style: {
      fontSize: 13,
      fontWeight: 600,
      padding: "2px 8px",
      borderRadius: 5,
      background: t.bg,
      color: t.color,
      whiteSpace: "nowrap"
    }
  }, t.label)));
}

// Приманка для автозаполнения браузера: на странице сохранён пароль от
// сайта, и некоторые браузеры (Edge) игнорируют autocomplete="off"/
// type="search" на обычных полях поиска и всё равно подставляют туда
// сохранённый логин. Скрытая пара username/password перед реальным
// контентом отдаёт браузеру "законную" цель для автозаполнения вместо
// поля поиска.
function AutofillDecoy() {
  const hidden = {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    clip: "rect(0,0,0,0)",
    whiteSpace: "nowrap",
    border: 0
  };
  return /*#__PURE__*/React.createElement("div", {
    "aria-hidden": "true",
    style: hidden
  }, /*#__PURE__*/React.createElement("input", {
    type: "text",
    name: "username",
    autoComplete: "username",
    tabIndex: "-1"
  }), /*#__PURE__*/React.createElement("input", {
    type: "password",
    name: "password",
    autoComplete: "current-password",
    tabIndex: "-1"
  }));
}
function OrderCard({
  order,
  onOpen,
  onEdit
}) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : order.items || [];
  const payment = typeof order.payment === 'string' ? JSON.parse(order.payment || '{}') : order.payment || {
    cash: order.payment_cash || 0,
    qr: order.payment_qr || 0,
    debt: order.payment_debt || 0
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      borderLeft: `4px solid ${SC[order.status] || '#999'}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      cursor: "pointer"
    },
    onClick: () => onOpen(order)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      marginRight: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, "\u2116 ", order.id, " \xB7 ", order.client_name || order.clientName), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, order.address, " \xB7 ", order.time_slot || order.timeSlot), order.sales_name && /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.cardSub,
      marginTop: 2
    }
  }, "\uD83D\uDC64 ", order.sales_name)), /*#__PURE__*/React.createElement(StatusBadge, {
    status: order.status
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 4px",
      fontSize: 15,
      color: C.textSub
    }
  }, "\u041F\u043E\u0437\u0438\u0446\u0438\u0439: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.text
    }
  }, items.length), " \xB7 \u0421\u0443\u043C\u043C\u0430: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.text,
      fontFamily: FH,
      fontVariantNumeric: "tabular-nums"
    }
  }, (order.total || 0).toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement(PaymentTags, {
    payment: payment
  }), onEdit && order.status === "new" && /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      onEdit(order);
    },
    style: {
      marginTop: 8,
      padding: "6px 14px",
      background: C.surface,
      color: C.navy,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u270F\uFE0F \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C"));
}
function DriverPaymentBlock({
  order,
  onUpdateStatus
}) {
  const [payType, setPayType] = useState({
    cash: false,
    qr: false,
    debt: false
  });
  const [payAmounts, setPayAmt] = useState({
    cash: "",
    qr: ""
  });
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
  const total = order.total || 0;
  const cashPaid = payType.cash ? Number(payAmounts.cash) || 0 : 0;
  const qrPaid = payType.qr ? Number(payAmounts.qr) || 0 : 0;
  const remainder = Math.max(0, total - cashPaid - qrPaid);
  const debtAmount = payType.debt ? remainder : 0;
  const hasSelection = payType.cash || payType.qr || payType.debt;
  // Пока склад не подтвердил факт. вес весовой позиции (см. POST
  // /api/orders/weights), сумма заявки — ещё оценка, а не факт: довезти
  // такую заявку нельзя, иначе оценка навсегда останется финальной (сервер
  // это тоже блокирует, см. PUT /api/orders/:id/status — здесь только
  // чтобы водитель видел причину сразу, не отправляя запрос).
  const orderItems = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : order.items || [];
  const pendingWeightItems = orderItems.filter(it => it.is_weight_item && !it.weight_confirmed);
  const canConfirm = hasSelection && (payType.debt || remainder === 0) && !!photoUrl && (!payType.cash || !!cashPhotoUrl) && (!payType.qr || !!qrPhotoUrl) && pendingWeightItems.length === 0;
  const toggleCashQr = key => {
    const turningOn = !payType[key];
    if (turningOn && payAmounts[key] === "") {
      const otherKey = key === 'cash' ? 'qr' : 'cash';
      const otherAmt = payType[otherKey] ? Number(payAmounts[otherKey]) || 0 : 0;
      setPayAmt(a => ({
        ...a,
        [key]: String(Math.max(0, total - otherAmt))
      }));
    } else if (!turningOn) {
      setPayAmt(a => ({
        ...a,
        [key]: ""
      }));
    }
    setPayType(pt => ({
      ...pt,
      [key]: turningOn
    }));
  };
  const onPhotoSelected = async e => {
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
      const res = await apiCall('POST', `/api/orders/${order.id}/photo`, {
        imageBase64: compressed
      });
      setPhotoUrl(res.url);
    } catch (err) {
      setPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setPhotoUploading(false);
  };
  const onCashPhotoSelected = async e => {
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
      const res = await apiCall('POST', `/api/orders/${order.id}/cash-photo`, {
        imageBase64: compressed
      });
      setCashPhotoUrl(res.url);
    } catch (err) {
      setCashPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setCashPhotoUploading(false);
  };
  const onQrPhotoSelected = async e => {
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
      const res = await apiCall('POST', `/api/orders/${order.id}/qr-photo`, {
        imageBase64: compressed
      });
      setQrPhotoUrl(res.url);
    } catch (err) {
      setQrPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setQrPhotoUploading(false);
  };
  const changeStatus = async (status, payment, confirmMsg) => {
    if (statusBusy) return;
    if (confirmMsg && !window.confirm(confirmMsg)) return;
    setStatusBusy(true);
    try {
      await onUpdateStatus(order.id, status, payment);
    } finally {
      setStatusBusy(false);
    }
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, pendingWeightItems.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FEF3C7",
      border: "1px solid #FDE68A",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 14,
      fontSize: 14,
      color: "#92400E",
      fontWeight: 600
    }
  }, "\u2696\uFE0F \u0421\u043A\u043B\u0430\u0434 \u0435\u0449\u0451 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u043B \u0444\u0430\u043A\u0442. \u0432\u0435\u0441: ", pendingWeightItems.map(it => it.name).join(', '), ". \u0414\u043E\u0441\u0442\u0430\u0432\u043A\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u043D\u0430, \u043F\u043E\u043A\u0430 \u0441\u043A\u043B\u0430\u0434 \u043D\u0435 \u0432\u0432\u0435\u0434\u0451\u0442 \u0432\u0435\u0441."), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 12px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u0421\u043F\u043E\u0441\u043E\u0431 \u043E\u043F\u043B\u0430\u0442\u044B: ", !hasSelection && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontWeight: 400
    }
  }, "(\u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u0438\u043D)")), [{
    key: "cash",
    label: "Наличка",
    icon: "💵",
    bg: C.cashGreen,
    col: "#15803D"
  }, {
    key: "qr",
    label: "QR код",
    icon: "📲",
    bg: C.qrBlue,
    col: "#1D4ED8"
  }].map(({
    key,
    label,
    icon,
    bg,
    col
  }) => /*#__PURE__*/React.createElement("div", {
    key: key,
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => toggleCashQr(key),
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      border: `2px solid ${payType[key] ? col : C.border}`,
      background: payType[key] ? col : C.white,
      cursor: "pointer",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, payType[key] && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.white,
      fontSize: 15,
      fontWeight: 700
    }
  }, "\u2713")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: payType[key] ? col : C.textMid
    }
  }, icon, " ", label), payType[key] && /*#__PURE__*/React.createElement("input", {
    style: {
      flex: 1,
      border: `1.5px solid ${col}40`,
      borderRadius: 6,
      padding: "6px 10px",
      fontSize: 16,
      fontWeight: 600,
      outline: "none",
      background: bg,
      color: col
    },
    placeholder: "\u0421\u0443\u043C\u043C\u0430 \u20B8",
    value: payAmounts[key],
    onFocus: e => e.target.select(),
    onChange: e => setPayAmt(a => ({
      ...a,
      [key]: e.target.value
    }))
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setPayType(pt => ({
      ...pt,
      debt: !pt.debt
    })),
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      border: `2px solid ${payType.debt ? "#92400E" : C.border}`,
      background: payType.debt ? "#92400E" : C.white,
      cursor: "pointer",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, payType.debt && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.white,
      fontSize: 15,
      fontWeight: 700
    }
  }, "\u2713")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: payType.debt ? "#92400E" : C.textMid
    }
  }, "\uD83D\uDCCB \u0414\u043E\u043B\u0433 ", payType.debt && `(${remainder.toLocaleString()} ₸ — остаток посчитан сам)`))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 14px",
      borderRadius: 10,
      background: C.surface,
      border: `1px solid ${C.border}`,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textSub
    }
  }, "\u0421\u0443\u043C\u043C\u0430 \u0437\u0430\u044F\u0432\u043A\u0438"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontFamily: FH
    }
  }, total.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      paddingTop: 6,
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: debtAmount > 0 ? "#92400E" : remainder > 0 ? C.red : C.green
    }
  }, debtAmount > 0 ? "📋 Долг" : remainder > 0 ? "⚠️ Не хватает суммы" : "✅ Полностью оплачено"), (debtAmount > 0 || remainder > 0) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 17,
      fontFamily: FH,
      color: debtAmount > 0 ? "#92400E" : C.red
    }
  }, (debtAmount > 0 ? debtAmount : remainder).toLocaleString(), " \u20B8"))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u0424\u043E\u0442\u043E \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D\u043D\u043E\u0439 \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u043E\u0439: ", !photoUrl && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontWeight: 400
    }
  }, "(\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)")), photoUrl && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: photoUrl,
    style: {
      width: "100%",
      maxHeight: 220,
      objectFit: "cover",
      borderRadius: 10,
      border: `1px solid ${C.border}`
    }
  })), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    id: `photoInput_${order.id}`,
    style: {
      display: "none"
    },
    onChange: onPhotoSelected
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: photoUploading,
    onClick: () => document.getElementById(`photoInput_${order.id}`).click(),
    style: {
      ...S.btnOutline,
      opacity: photoUploading ? 0.5 : 1,
      cursor: photoUploading ? "not-allowed" : "pointer"
    }
  }, photoUploading ? "Загрузка..." : photoUrl ? "📷 Переснять фото" : "📷 Сфотографировать накладную"), photoError && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 14,
      color: C.red
    }
  }, photoError)), payType.cash && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u0424\u043E\u0442\u043E \u043F\u043E\u043B\u0443\u0447\u0435\u043D\u043D\u043E\u0439 \u043D\u0430\u043B\u0438\u0447\u043D\u043E\u0441\u0442\u0438: ", !cashPhotoUrl && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontWeight: 400
    }
  }, "(\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u0440\u0438 \u043E\u043F\u043B\u0430\u0442\u0435 \u043D\u0430\u043B\u043E\u043C)")), cashPhotoUrl && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: cashPhotoUrl,
    style: {
      width: "100%",
      maxHeight: 220,
      objectFit: "cover",
      borderRadius: 10,
      border: `1px solid ${C.border}`
    }
  })), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    id: `cashPhotoInput_${order.id}`,
    style: {
      display: "none"
    },
    onChange: onCashPhotoSelected
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: cashPhotoUploading,
    onClick: () => document.getElementById(`cashPhotoInput_${order.id}`).click(),
    style: {
      ...S.btnOutline,
      opacity: cashPhotoUploading ? 0.5 : 1,
      cursor: cashPhotoUploading ? "not-allowed" : "pointer"
    }
  }, cashPhotoUploading ? "Загрузка..." : cashPhotoUrl ? "💵 Переснять фото" : "💵 Сфотографировать наличность"), cashPhotoError && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 14,
      color: C.red
    }
  }, cashPhotoError)), payType.qr && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u0424\u043E\u0442\u043E \u0447\u0435\u043A\u0430 \u043E\u043F\u043B\u0430\u0442\u044B \u043F\u043E QR: ", !qrPhotoUrl && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontWeight: 400
    }
  }, "(\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E \u043F\u0440\u0438 \u043E\u043F\u043B\u0430\u0442\u0435 \u043F\u043E QR)")), qrPhotoUrl && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("img", {
    src: qrPhotoUrl,
    style: {
      width: "100%",
      maxHeight: 220,
      objectFit: "cover",
      borderRadius: 10,
      border: `1px solid ${C.border}`
    }
  })), /*#__PURE__*/React.createElement("input", {
    type: "file",
    accept: "image/*",
    capture: "environment",
    id: `qrPhotoInput_${order.id}`,
    style: {
      display: "none"
    },
    onChange: onQrPhotoSelected
  }), /*#__PURE__*/React.createElement("button", {
    type: "button",
    disabled: qrPhotoUploading,
    onClick: () => document.getElementById(`qrPhotoInput_${order.id}`).click(),
    style: {
      ...S.btnOutline,
      opacity: qrPhotoUploading ? 0.5 : 1,
      cursor: qrPhotoUploading ? "not-allowed" : "pointer"
    }
  }, qrPhotoUploading ? "Загрузка..." : qrPhotoUrl ? "📲 Переснять фото" : "📲 Сфотографировать чек"), qrPhotoError && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 14,
      color: C.red
    }
  }, qrPhotoError)), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSuccess,
      opacity: canConfirm && !statusBusy ? 1 : 0.4,
      cursor: canConfirm && !statusBusy ? "pointer" : "not-allowed"
    },
    disabled: !canConfirm || statusBusy,
    onClick: () => changeStatus("delivered", {
      cash: cashPaid,
      qr: qrPaid,
      debt: debtAmount
    })
  }, statusBusy ? "Сохранение..." : "✅ Подтвердить доставку"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnOutline,
      borderColor: "#7C3AED",
      color: "#7C3AED",
      marginTop: 8,
      opacity: statusBusy ? 0.5 : 1,
      cursor: statusBusy ? "not-allowed" : "pointer"
    },
    disabled: statusBusy,
    onClick: () => changeStatus("returned", null, `Оформить возврат по заявке № ${order.id}? Действие нельзя отменить.`)
  }, "\u21A9\uFE0F \u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442"));
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
// Общая формула для обоих мест, где кг-остаток весового товара показывается
// персоналу в виде "≈ N кор (W кг)" (stockLabel ниже и строка товара в
// SalesCabinet, у которой поля называются иначе, чем в карточке товара) —
// один разошедшийся дубль формулы уже приводил к рассинхрону округления.
function formatWeightStock(amountKg, avgBoxWeight) {
  if (amountKg == null) return null;
  if (avgBoxWeight > 0) {
    const boxes = Math.floor(amountKg / avgBoxWeight);
    return `≈ ${boxes} кор (${amountKg} кг)`;
  }
  return `${amountKg} кг`;
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
function DebtsPanel({
  readOnly
}) {
  const [debts, setDebts] = useState([]);
  const [loadingDebts, setLoadingDebts] = useState(true);
  const [settleAmounts, setSettleAmounts] = useState({});
  const [settleMethod, setSettleMethod] = useState({});
  const [savingId, setSavingId] = useState(null);
  const loadDebts = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/debts');
      setDebts(data);
    } catch (e) {}
    setLoadingDebts(false);
  }, []);
  useEffect(() => {
    loadDebts();
  }, []);

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
  const groupKey = d => d.client_code ? `c${d.client_code}` : d.order_id ? `o${d.order_id}` : `s${d.sale_id}`;
  const totalsByClient = useMemo(() => {
    const totals = {},
      counts = {};
    debts.forEach(d => {
      const key = groupKey(d);
      totals[key] = (totals[key] || 0) + d.remaining;
      counts[key] = (counts[key] || 0) + 1;
    });
    return {
      totals,
      counts
    };
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
    debts.forEach(d => {
      if (d.sales_id) map[d.sales_id] = d.sales_name;
    });
    return Object.entries(map).map(([id, name]) => ({
      id,
      name
    })).sort((a, b) => a.name.localeCompare(b.name, 'ru'));
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
  const visibleDebts = salesFilter ? debts.filter(d => !d.sales_id || String(d.sales_id) === salesFilter) : debts;
  const settle = async d => {
    const key = d.order_id ? `o${d.order_id}` : `s${d.sale_id}`;
    const amount = Number(settleAmounts[key] ?? d.remaining);
    const method = settleMethod[key] || 'cash';
    if (!amount || amount <= 0) return;
    const full = amount >= d.remaining;
    if (!window.confirm(`Погасить ${full ? 'весь' : 'частично'} долг «${d.client_name}» на ${amount.toLocaleString()} ₸ (${method === 'cash' ? 'наличными' : 'безналом'})?`)) return;
    setSavingId(key);
    try {
      await apiCall('POST', '/api/debts/settle', {
        orderId: d.order_id || undefined,
        saleId: d.sale_id || undefined,
        amount,
        method
      });
      await loadDebts();
      setSettleAmounts(a => ({
        ...a,
        [key]: ''
      }));
    } catch (e) {
      alert(e.message);
    }
    setSavingId(null);
  };
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u0414\u043E\u043B\u0436\u043D\u0438\u043A\u0438"), /*#__PURE__*/React.createElement("select", {
    style: {
      ...S.select,
      marginBottom: 12,
      width: "auto",
      minWidth: 200
    },
    value: salesFilter,
    onChange: e => setSalesFilter(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u0412\u0441\u0435 \u0442\u043E\u0440\u0433\u043E\u0432\u044B\u0435"), salesReps.map(r => /*#__PURE__*/React.createElement("option", {
    key: r.id,
    value: r.id
  }, r.name))), loadingDebts ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : visibleDebts.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "24px 0",
      color: C.textFaint
    }
  }, "\u0414\u043E\u043B\u0433\u043E\u0432 \u043D\u0435\u0442") : visibleDebts.map(d => {
    const key = d.order_id ? `o${d.order_id}` : `s${d.sale_id}`;
    return /*#__PURE__*/React.createElement("div", {
      key: key,
      style: {
        ...S.card,
        borderLeft: d.overdue ? `4px solid ${C.red}` : "4px solid #F59E0B",
        background: d.overdue ? "#FEF2F2" : C.white
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: S.row
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: S.cardTitle
    }, d.client_name, " ", d.overdue && /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.red,
        fontSize: 13,
        fontWeight: 700
      }
    }, "\xB7 \u041F\u0420\u041E\u0421\u0420\u041E\u0427\u0415\u041D")), /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.cardSub,
        color: d.overdue ? "#B91C1C" : C.textSub
      }
    }, d.order_id ? `№ ${d.order_id}` : `Касса № ${d.sale_id}`, " \xB7 ", d.date, " \xB7 ", d.days_ago === 0 ? 'сегодня' : `${d.days_ago} ${daysWord(d.days_ago)}`, d.settled > 0 ? ` · погашено ${d.settled.toLocaleString()} ₸` : ''), totalsByClient.counts[groupKey(d)] > 1 && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "2px 0 0",
        fontSize: 13,
        fontWeight: 700,
        color: C.textFaint
      }
    }, "\u0412\u0441\u0435\u0433\u043E \u043F\u043E \u043A\u043B\u0438\u0435\u043D\u0442\u0443: ", totalsByClient.totals[groupKey(d)].toLocaleString(), " \u20B8 \xB7 ", totalsByClient.counts[groupKey(d)], " \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u044B\u043C")), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontWeight: 800,
        fontFamily: FH,
        color: d.overdue ? C.red : "#92400E"
      }
    }, d.remaining.toLocaleString(), " \u20B8")), d.delivery_photo && /*#__PURE__*/React.createElement("a", {
      href: d.delivery_photo,
      target: "_blank",
      rel: "noopener noreferrer",
      download: true,
      style: {
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        marginTop: 8,
        fontSize: 14,
        fontWeight: 600,
        color: C.navy,
        textDecoration: "none"
      }
    }, "\uD83D\uDCC4 \u041D\u0430\u043A\u043B\u0430\u0434\u043D\u0430\u044F"), !readOnly && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("input", {
      type: "number",
      style: {
        ...S.input,
        padding: "7px 8px",
        fontSize: 14
      },
      placeholder: `До ${d.remaining}`,
      value: settleAmounts[key] || '',
      onFocus: e => e.target.select(),
      onChange: e => setSettleAmounts(a => ({
        ...a,
        [key]: e.target.value
      }))
    }), /*#__PURE__*/React.createElement("select", {
      style: {
        ...S.select,
        padding: "7px 8px",
        fontSize: 14,
        width: 110
      },
      value: settleMethod[key] || 'cash',
      onChange: e => setSettleMethod(m => ({
        ...m,
        [key]: e.target.value
      }))
    }, /*#__PURE__*/React.createElement("option", {
      value: "cash"
    }, "\u041D\u0430\u043B"), /*#__PURE__*/React.createElement("option", {
      value: "qr"
    }, "\u0411\u0435\u0437\u043D\u0430\u043B")), /*#__PURE__*/React.createElement("button", {
      style: {
        ...S.btnPrimary,
        padding: "7px 14px",
        fontSize: 14,
        width: "auto",
        whiteSpace: "nowrap",
        marginTop: 0,
        boxShadow: "none",
        opacity: savingId === key ? 0.5 : 1
      },
      disabled: savingId === key,
      onClick: () => settle(d)
    }, "\u041F\u043E\u0433\u0430\u0441\u0438\u0442\u044C")));
  }));
}

// Возврат — отдельная от статуса заявки сущность (см. POST /api/returns):
// либо конкретные позиции/количество из уже ДОСТАВЛЕННОЙ заявки (магазин
// вернул 1 из 5 коробок), либо совсем без заявки — товар без привязки
// к конкретной поставке (например, порчу заметили через неделю). И то, и
// другое доступно водителю (обнаружил на месте) и admin/manager/operator.
function ReturnFormModal({
  user,
  onClose,
  onCreated
}) {
  const canAttributeSales = ['admin', 'manager'].includes(user.role); // GET /api/users не отдаёт operator/driver
  const [mode, setMode] = useState('order');

  // ===== режим "по заявке" =====
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const [orderSearch, setOrderSearch] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [returnQtys, setReturnQtys] = useState({});
  const [alreadyReturned, setAlreadyReturned] = useState({});
  useEffect(() => {
    apiCall('GET', '/api/orders').then(all => {
      let delivered = all.filter(o => o.status === "delivered");
      // Водитель возвращает только по своим доставкам — не видит доставки других водителей
      if (user.role === "driver") delivered = delivered.filter(o => o.driver_id === user.id);
      setOrders(delivered);
      setLoadingOrders(false);
    }).catch(() => setLoadingOrders(false));
  }, []);
  const pickOrder = o => {
    setSelectedOrder(o);
    setReturnQtys({});
    apiCall('GET', '/api/returns').then(list => {
      const map = {};
      list.filter(r => r.order_id === o.id).forEach(r => (r.items || []).forEach(it => {
        if (it.code) map[it.code] = (map[it.code] || 0) + (Number(it.qty) || 0);
      }));
      setAlreadyReturned(map);
    }).catch(() => setAlreadyReturned({}));
  };
  const orderItems = selectedOrder ? typeof selectedOrder.items === "string" ? JSON.parse(selectedOrder.items || "[]") : selectedOrder.items || [] : [];
  const q = orderSearch.trim().toLowerCase();
  const matchedOrders = q ? orders.filter(o => (o.client_name || "").toLowerCase().includes(q) || String(o.id).includes(q)) : orders.slice(0, 20);

  // ===== режим "без заявки" =====
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState('');
  const [clientCode, setClientCode] = useState('');
  const [salesUsers, setSalesUsers] = useState([]);
  const [salesId, setSalesId] = useState('');
  const [freeRows, setFreeRows] = useState([{
    name: "",
    qty: "",
    price: ""
  }]);
  useEffect(() => {
    if (mode !== "freeform") return;
    apiCall('GET', '/api/clients').then(setClients).catch(() => {});
    if (canAttributeSales) {
      apiCall('GET', '/api/users').then(us => setSalesUsers(us.filter(u => ["sales", "senior_sales"].includes(u.role) && u.active !== false))).catch(() => {});
    }
  }, [mode]);
  const cq = clientSearch.trim().toLowerCase();
  const matchedClients = cq ? clients.filter(c => (c.name || "").toLowerCase().includes(cq)) : [];
  const updateFreeRow = (i, patch) => setFreeRows(rs => rs.map((r, idx) => idx === i ? {
    ...r,
    ...patch
  } : r));
  const addFreeRow = () => setFreeRows(rs => [...rs, {
    name: "",
    qty: "",
    price: ""
  }]);
  const removeFreeRow = i => setFreeRows(rs => rs.length > 1 ? rs.filter((_, idx) => idx !== i) : rs);

  // ===== общее =====
  const [reason, setReason] = useState('');
  const [refundCash, setRefundCash] = useState('');
  const [refundQr, setRefundQr] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const canSubmitOrder = !!selectedOrder && orderItems.some(it => Number(returnQtys[it.code]) > 0);
  const canSubmitFree = !!clientCode && freeRows.some(r => r.name.trim() && Number(r.qty) > 0);
  const canSubmit = mode === "order" ? canSubmitOrder : canSubmitFree;
  const submit = async () => {
    if (!canSubmit || submitting) return;
    setError("");
    setSubmitting(true);
    try {
      let payload;
      if (mode === "order") {
        const items = orderItems.filter(it => Number(returnQtys[it.code]) > 0).map(it => ({
          code: it.code,
          name: it.name,
          price: it.price,
          qty: Number(returnQtys[it.code])
        }));
        payload = {
          orderId: selectedOrder.id,
          items,
          reason,
          refundCash: Number(refundCash) || 0,
          refundQr: Number(refundQr) || 0
        };
      } else {
        const client = clients.find(c => c.code === clientCode);
        const items = freeRows.filter(r => r.name.trim() && Number(r.qty) > 0).map(r => ({
          name: r.name.trim(),
          qty: Number(r.qty),
          price: Number(r.price) || 0
        }));
        payload = {
          clientCode,
          clientName: client ? client.name : clientCode,
          salesId: salesId || undefined,
          items,
          reason,
          refundCash: Number(refundCash) || 0,
          refundQr: Number(refundQr) || 0
        };
      }
      await apiCall('POST', '/api/returns', payload);
      if (onCreated) onCreated();
      onClose();
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(28,25,23,0.45)",
      zIndex: 200,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      margin: "16px",
      borderRadius: 16,
      padding: 20,
      maxWidth: 480,
      marginLeft: "auto",
      marginRight: "auto",
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 19,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, "\u21A9\uFE0F \u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442"), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: onClose
  }, "\u2715")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setMode("order"),
    style: {
      flex: 1,
      padding: "9px",
      borderRadius: 8,
      border: `1px solid ${mode === "order" ? C.navy : C.border}`,
      background: mode === "order" ? C.navy : C.white,
      color: mode === "order" ? C.white : C.textMid,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u041F\u043E \u0437\u0430\u044F\u0432\u043A\u0435"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setMode("freeform"),
    style: {
      flex: 1,
      padding: "9px",
      borderRadius: 8,
      border: `1px solid ${mode === "freeform" ? C.navy : C.border}`,
      background: mode === "freeform" ? C.navy : C.white,
      color: mode === "freeform" ? C.white : C.textMid,
      fontSize: 13,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0411\u0435\u0437 \u0437\u0430\u044F\u0432\u043A\u0438")), mode === "order" ? !selectedOrder ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      marginBottom: 10
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043A\u043B\u0438\u0435\u043D\u0442\u0443 \u0438\u043B\u0438 \u2116 \u0437\u0430\u044F\u0432\u043A\u0438...",
    value: orderSearch,
    onChange: e => setOrderSearch(e.target.value)
  }), loadingOrders ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : matchedOrders.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: C.textFaint,
      textAlign: "center",
      padding: "16px 0"
    }
  }, "\u0414\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u044F\u0432\u043E\u043A \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E") : /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 280,
      overflowY: "auto",
      border: `1px solid ${C.border}`,
      borderRadius: 10
    }
  }, matchedOrders.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.id,
    onClick: () => pickOrder(o),
    style: {
      padding: "10px 12px",
      borderBottom: `1px solid ${C.border}`,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 700
    }
  }, "\u2116 ", o.id, " \xB7 ", o.client_name), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 12,
      color: C.textFaint
    }
  }, o.date, " \xB7 ", (o.total || 0).toLocaleString(), " \u20B8"))))) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      fontWeight: 700
    }
  }, "\u2116 ", selectedOrder.id, " \xB7 ", selectedOrder.client_name), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => setSelectedOrder(null)
  }, "\u0421\u043C\u0435\u043D\u0438\u0442\u044C")), orderItems.map(it => {
    const delivered = Number(it.qty) || 0;
    const already = alreadyReturned[it.code] || 0;
    const maxQty = Math.max(0, delivered - already);
    return /*#__PURE__*/React.createElement("div", {
      key: it.code,
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        flex: 1,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 14,
        overflowWrap: "anywhere"
      }
    }, it.name), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 12,
        color: C.textFaint
      }
    }, "\u0414\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E ", delivered, already > 0 ? `, уже возвращено ${already}` : '', maxQty === 0 ? ' · весь объём уже возвращён' : '')), /*#__PURE__*/React.createElement("input", {
      type: "number",
      disabled: maxQty === 0,
      min: "0",
      max: maxQty,
      style: {
        ...S.input,
        width: 70,
        flexShrink: 0,
        padding: "6px 8px",
        fontSize: 14,
        textAlign: "center",
        opacity: maxQty === 0 ? 0.5 : 1
      },
      placeholder: "0",
      value: returnQtys[it.code] || '',
      onChange: e => {
        let v = e.target.value;
        if (Number(v) > maxQty) v = String(maxQty);
        setReturnQtys(qm => ({
          ...qm,
          [it.code]: v
        }));
      },
      onFocus: e => e.target.select()
    }));
  })) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041A\u043B\u0438\u0435\u043D\u0442"), !clientCode ? /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      marginBottom: 6
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043A\u043B\u0438\u0435\u043D\u0442\u0430...",
    value: clientSearch,
    onChange: e => setClientSearch(e.target.value)
  }), cq && /*#__PURE__*/React.createElement("div", {
    style: {
      maxHeight: 180,
      overflowY: "auto",
      border: `1px solid ${C.border}`,
      borderRadius: 10,
      marginBottom: 10
    }
  }, matchedClients.length === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: C.textFaint,
      padding: "10px 12px",
      margin: 0
    }
  }, "\u041D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E") : matchedClients.map(c => /*#__PURE__*/React.createElement("div", {
    key: c.code,
    onClick: () => {
      setClientCode(c.code);
      setClientSearch(c.name);
    },
    style: {
      padding: "9px 12px",
      borderBottom: `1px solid ${C.border}`,
      cursor: "pointer",
      fontSize: 14
    }
  }, c.name)))) : /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 10,
      padding: "8px 12px",
      background: C.surface,
      borderRadius: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600
    }
  }, (clients.find(c => c.code === clientCode) || {}).name || clientCode), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => {
      setClientCode('');
      setClientSearch('');
    }
  }, "\u0421\u043C\u0435\u043D\u0438\u0442\u044C")), canAttributeSales && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u0422\u043E\u0440\u0433\u043E\u0432\u044B\u0439 (\u0434\u043B\u044F \u0431\u043E\u043D\u0443\u0441\u0430), \u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E"), /*#__PURE__*/React.createElement("select", {
    style: S.select,
    value: salesId,
    onChange: e => setSalesId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 \u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D \u2014"), salesUsers.map(u => /*#__PURE__*/React.createElement("option", {
    key: u.id,
    value: u.id
  }, u.name)))), /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041F\u043E\u0437\u0438\u0446\u0438\u0438"), freeRows.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 64px 80px 28px",
      gap: 6,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 14
    },
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0442\u043E\u0432\u0430\u0440\u0430",
    value: r.name,
    onChange: e => updateFreeRow(i, {
      name: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    type: "number",
    style: {
      ...S.input,
      padding: "8px 6px",
      fontSize: 14,
      textAlign: "center"
    },
    placeholder: "\u043A\u043E\u043B-\u0432\u043E",
    value: r.qty,
    onChange: e => updateFreeRow(i, {
      qty: e.target.value
    })
  }), /*#__PURE__*/React.createElement("input", {
    type: "number",
    style: {
      ...S.input,
      padding: "8px 6px",
      fontSize: 14,
      textAlign: "right"
    },
    placeholder: "\u0446\u0435\u043D\u0430",
    value: r.price,
    onChange: e => updateFreeRow(i, {
      price: e.target.value
    })
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeFreeRow(i),
    style: {
      width: 28,
      height: 34,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      background: C.surface,
      cursor: "pointer",
      fontSize: 14,
      color: C.textFaint
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("button", {
    onClick: addFreeRow,
    style: {
      ...S.btnSecondary,
      marginBottom: 10
    }
  }, "+ \u041F\u043E\u0437\u0438\u0446\u0438\u044F")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041F\u0440\u0438\u0447\u0438\u043D\u0430 \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430"), /*#__PURE__*/React.createElement("textarea", {
    style: S.textarea,
    value: reason,
    onChange: e => setReason(e.target.value),
    placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u0442\u043E\u0432\u0430\u0440 \u0438\u0441\u043F\u043E\u0440\u0447\u0435\u043D, \u043F\u0440\u0438\u0432\u0435\u0437\u043B\u0438 \u043B\u0438\u0448\u043D\u0435\u0435 \u0438 \u0442.\u043F."
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr",
      gap: 8,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430\u043B\u043E\u043C, \u20B8"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    style: S.input,
    placeholder: "0",
    value: refundCash,
    onChange: e => setRefundCash(e.target.value)
  })), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u0412\u0435\u0440\u043D\u0443\u0442\u044C \u043D\u0430 QR/\u043A\u0430\u0440\u0442\u0443, \u20B8"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    style: S.input,
    placeholder: "0",
    value: refundQr,
    onChange: e => setRefundQr(e.target.value)
  }))), error && /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.errorBox,
      marginTop: 12,
      marginBottom: 0
    }
  }, error), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnDanger,
      marginTop: 16,
      opacity: canSubmit && !submitting ? 1 : 0.5,
      cursor: canSubmit && !submitting ? "pointer" : "not-allowed"
    },
    disabled: !canSubmit || submitting,
    onClick: submit
  }, submitting ? "Сохранение..." : "↩️ Оформить возврат")));
}

// История взвешивания — кто и когда ввёл факт. вес по позиции заявки, см.
// GET /api/weigh-log. Самодостаточная панель — сама грузит данные, ничего
// не делит с родителем.
function WeighLogPanel() {
  const [log, setLog] = useState([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    try {
      setLog(await apiCall('GET', '/api/weigh-log'));
    } catch (e) {}
    setLoading(false);
  }, []);
  useEffect(() => {
    load();
  }, []);
  useRefetchOnVisible(load);
  const [open, setOpen] = useState(false);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      padding: 0,
      marginTop: 16,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => setOpen(o => !o),
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "13px 14px",
      cursor: "pointer",
      background: C.surface
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u2696\uFE0F \u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0432\u0437\u0432\u0435\u0448\u0438\u0432\u0430\u043D\u0438\u044F"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textFaint
    }
  }, open ? "▲ Свернуть" : "▼ Показать")), open && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: 10,
      maxHeight: 420,
      overflowY: "auto",
      borderTop: `1px solid ${C.border}`
    }
  }, loading ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : log.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint
    }
  }, "\u0417\u0430\u043F\u0438\u0441\u0435\u0439 \u043F\u043E\u043A\u0430 \u043D\u0435\u0442") : log.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.id,
    style: {
      padding: "8px 0",
      borderBottom: `1px solid ${C.border}`,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.text,
      fontWeight: 600,
      overflowWrap: "anywhere"
    }
  }, l.item_name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.navy,
      fontWeight: 700,
      whiteSpace: "nowrap"
    }
  }, l.weight, " \u043A\u0433")), /*#__PURE__*/React.createElement("div", {
    style: {
      color: C.textFaint,
      fontSize: 13,
      marginTop: 2
    }
  }, "\u0417\u0430\u044F\u0432\u043A\u0430 \u2116", l.order_id, " \xB7 ", l.weighed_by_name, " \xB7 ", new Date(l.weighed_at).toLocaleString('ru-RU'), l.prev_weight != null && ` · было ${l.prev_weight} кг`)))));
}
const COMPANY_INFO = {
  name: 'ИП ЖАЙЫК АКТАУ',
  address: 'Уральск Г.А., Уральск, МИКРОРАЙОН ЖЕҢІС, дом 8/1, кв/офис 73',
  bin: '491219400991',
  bank: 'АО "Kaspi Bank"',
  bik: 'CASPKZKA',
  account: 'KZ33722S000046085888'
};
function buildWaybillInnerHtml(order) {
  const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : order.items || [];
  const totalNds = 0;
  const rows = items.map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${it.name}</td>
      <td style="text-align:center">${it.code || ''}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:center">${it.qty}</td>
      <td style="text-align:right">${Number(it.price).toLocaleString()}</td>
      <td style="text-align:right">${(Number(it.qty) * Number(it.price)).toLocaleString()}</td>
      <td style="text-align:right">0</td>
    </tr>`).join('');
  return `
    <div class="topright">Приложение 26<br>к приказу Министра финансов<br>Республики Казахстан<br>от 20 декабря 2012 года № 562</div>
    <div class="toprow"><span>Организация (индивидуальный предприниматель) <b>${COMPANY_INFO.name}</b></span><span>ИИН/БИН <b>${COMPANY_INFO.bin}</b></span></div>
    <h1>НАКЛАДНАЯ НА ОТПУСК ЗАПАСОВ НА СТОРОНУ<br><span style="font-weight:400;font-size:12px">Форма З-2 · № ${order.id} от ${order.date}</span></h1>
    <div class="headrow">
      <div><div class="label">ОРГАНИЗАЦИЯ — ОТПРАВИТЕЛЬ</div>${COMPANY_INFO.name}</div>
      <div><div class="label">ОРГАНИЗАЦИЯ — ПОЛУЧАТЕЛЬ</div>${order.client_name || ''}</div>
      <div><div class="label">ОТВЕТСТВЕННЫЙ ЗА ПОСТАВКУ (Ф.И.О.)</div>${order.driver_name || ''}</div>
      <div><div class="label">АДРЕС ДОСТАВКИ</div>${order.address || ''}${order.contact_phone ? '<br>Тел: ' + order.contact_phone : ''}</div>
    </div>
    <table>
      <tr><th>№</th><th>Наименование</th><th>Номенкл. №</th><th>Кол-во<br>подлежит<br>отпуску</th><th>Кол-во<br>отпущено</th><th>Цена за ед., ₸</th><th>Сумма, ₸</th><th>Сумма НДС, ₸</th></tr>
      ${rows}
      <tr><td colspan="6" style="text-align:right;font-weight:700">Итого</td><td style="text-align:right;font-weight:700">${(order.total || 0).toLocaleString()}</td><td style="text-align:right;font-weight:700">${totalNds}</td></tr>
    </table>
    <div class="totals">Всего отпущено на сумму: <b>${(order.total || 0).toLocaleString()} ₸</b></div>
    <div class="sign">
      <p>Отпуск разрешил: <span class="signline">&nbsp;</span> должность / подпись / <b>Администратор</b></p>
      <p>Отпустил (водитель): <span class="signline">${order.driver_name || ''}</span> подпись</p>
      <p>Запасы получил: <span class="signline">&nbsp;</span> подпись / расшифровка подписи</p>
    </div>`;
}

// Стили печатных форм (накладная/загрузочный лист) — селекторы намеренно
// со scope-префиксом .printScope, а не голые body/table/h1: раньше эти
// правила жили в HTML-документе отдельного window.open()-окна (там body{}
// матчил только body ЭТОГО окна), но с переходом на оверлей в текущем
// окне (см. openPrintOverlay ниже) голый body{}/table{}/h1{} наложился бы
// на весь остальной сайт, пока оверлей открыт.
const WAYBILL_STYLE = `
    .printScope{font-family:Arial, sans-serif; font-size:12px; padding:20px; color:#111; max-width:900px; margin:0 auto; background:#fff;}
    .printScope .topright{text-align:right; font-size:11px; line-height:1.4; margin-bottom:10px;}
    .printScope h1{font-size:15px; text-align:center; margin:16px 0;}
    .printScope table{width:100%; border-collapse:collapse; margin:10px 0;}
    .printScope th,.printScope td{border:1px solid #333; padding:5px 6px; font-size:11px;}
    .printScope th{background:#f0f0f0; text-align:center;}
    .printScope .headrow{display:flex; border:1px solid #333; margin-top:14px;}
    .printScope .headrow > div{flex:1; border-right:1px solid #333; padding:6px;}
    .printScope .headrow > div:last-child{border-right:none;}
    .printScope .headrow .label{font-size:10px; color:#444; margin-bottom:4px;}
    .printScope .toprow{display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:6px;}
    .printScope .totals{margin-top:8px; font-size:12px;}
    .printScope .sign{margin-top:24px;}
    .printScope .sign p{margin:14px 0 2px;}
    .printScope .signline{display:inline-block; min-width:220px; border-bottom:1px solid #333; margin:0 6px;}
    .printScope .btnbar{text-align:center; margin-bottom:20px; display:flex; gap:10px; justify-content:center;}
    .printScope .btnbar button{padding:12px 24px; font-size:15px; font-weight:700; cursor:pointer; border-radius:8px; border:none; color:#fff;}
    @media print { .printScope .btnbar{display:none;} }`;

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
function printWaybill(order) {
  openPrintOverlay(buildWaybillInnerHtml(order), WAYBILL_STYLE, true);
}

// Пачка накладных сразу по нескольким заявкам (например, по всем заявкам
// одного водителя за день, после отбора по водителю в списке заявок) — та
// же накладная, что печатается по одной (buildWaybillInnerHtml), просто
// несколько подряд в одном оверлее с разрывом страницы между ними, чтобы
// при печати/сохранении в PDF каждая ушла на свою страницу.
function printWaybillsBatch(orders) {
  if (!orders.length) {
    alert('Нет заявок для печати');
    return;
  }
  const pendingOrders = orders.filter(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
    return items.some(it => it.is_weight_item && !it.weight_confirmed);
  });
  if (pendingOrders.length > 0) {
    if (!window.confirm(`По ${pendingOrders.length} ${pendingOrders.length === 1 ? 'заявке' : 'заявкам'} (№${pendingOrders.map(o => o.id).join(', №')}) вес ещё не подтверждён складом — суммы могут быть неточными.\n\nВсё равно напечатать накладные по всем ${orders.length}?`)) return;
  } else if (!window.confirm(`Напечатать накладные по ${orders.length} ${orders.length === 1 ? 'заявке' : 'заявкам'}?`)) {
    return;
  }
  const html = orders.map((o, i) => `<div${i < orders.length - 1 ? ' style="page-break-after:always;"' : ''}>${buildWaybillInnerHtml(o)}</div>`).join('');
  openPrintOverlay(html, WAYBILL_STYLE, true);
}
function buildLoadingListHtml(orders, driverName) {
  const totals = {};
  orders.forEach(o => {
    const items = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
    items.forEach(it => {
      const key = it.code || it.name;
      if (!totals[key]) totals[key] = {
        name: it.name,
        code: it.code || '',
        qty: 0
      };
      totals[key].qty += Number(it.qty) || 0;
    });
  });
  const rows = Object.values(totals).sort((a, b) => a.name.localeCompare(b.name)).map((it, i) => `
    <tr>
      <td style="text-align:center">${i + 1}</td>
      <td>${it.name}</td>
      <td style="text-align:center">${it.code}</td>
      <td style="text-align:center">${it.qty}</td>
      <td></td>
      <td></td>
    </tr>`).join('');
  const now = new Date();
  const orderNumbers = orders.map(o => '№' + o.id).join(', ');
  return `
    <h1>ЗАГРУЗОЧНЫЙ ЛИСТ<br><span style="font-weight:400;font-size:12px">${now.toLocaleDateString('ru-RU')} · Водитель: ${driverName}</span></h1>
    <div class="headrow">
      <div><div class="label">ОРГАНИЗАЦИЯ</div>${COMPANY_INFO.name}</div>
      <div><div class="label">ВОДИТЕЛЬ</div>${driverName}</div>
      <div><div class="label">ЗАЯВОК В ПАРТИИ</div>${orders.length} шт (${orderNumbers})</div>
    </div>
    <div class="tablewrap">
    <table>
      <tr><th>№</th><th>Наименование</th><th>Номенкл. №</th><th>Кол-во к отгрузке</th><th>Вес, кг</th><th>Отметка склада</th></tr>
      ${rows}
    </table>
    </div>
    <div class="sign">
      <p>Выдал (складовщик): <span class="signline">&nbsp;</span> подпись</p>
      <p>Принял (водитель): <span class="signline">${driverName}</span> подпись</p>
      <p>Дата/время выдачи: <span class="signline">&nbsp;</span></p>
    </div>`;
}
function printLoadingList(orders, driverName) {
  if (!orders.length) {
    alert('Нет заявок в статусе "В работе" для формирования листа');
    return;
  }
  openPrintOverlay(buildLoadingListHtml(orders, driverName), LOADING_LIST_STYLE, false);
}
async function shareWaybillPdf(order) {
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
  contentDiv.innerHTML = buildWaybillInnerHtml(order);
  container.appendChild(contentDiv);
  overlay.appendChild(label);
  overlay.appendChild(container);
  document.body.appendChild(overlay);
  try {
    await new Promise(r => setTimeout(r, 50));
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true
    });
    document.body.removeChild(overlay);
    const {
      jsPDF
    } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const margin = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const imgWidth = pageWidth - margin * 2;
    const imgHeight = canvas.height * imgWidth / canvas.width;
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
    const file = new File([blob], fileName, {
      type: 'application/pdf'
    });
    if (navigator.canShare && navigator.canShare({
      files: [file]
    })) {
      await navigator.share({
        files: [file],
        title: `Накладная №${order.id}`
      });
      return;
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    alert('PDF скачан. На компьютере системная отправка в WhatsApp недоступна — прикрепите файл вручную. На телефоне эта же кнопка сразу откроет "Поделиться".');
  } catch (e) {
    if (document.body.contains(overlay)) document.body.removeChild(overlay);
    if (e && e.name === 'AbortError') return;
    alert('Не удалось сформировать PDF: ' + e.message);
  }
}
function OrderDetail({
  order,
  onClose,
  onUpdateStatus,
  onDeleteOrder,
  currentUser,
  drivers
}) {
  const [selectedDriverId, setSelectedDriverId] = useState("");
  const items = typeof order.items === 'string' ? JSON.parse(order.items || '[]') : order.items || [];
  const payment = typeof order.payment === 'string' ? JSON.parse(order.payment || '{}') : order.payment || {
    cash: order.payment_cash || 0,
    qr: order.payment_qr || 0,
    debt: order.payment_debt || 0
  };
  // Весовые позиции, вес которых ещё не подтверждён складом (см.
  // POST /api/orders/weights) — до этого кол-во в заявке условное, и
  // накладная/PDF с текущей суммой могут оказаться неточными.
  const pendingWeightItems = items.filter(it => it.is_weight_item && !it.weight_confirmed);
  const confirmPrintIfPending = fn => {
    if (pendingWeightItems.length > 0 && !window.confirm(`Вес по ${pendingWeightItems.length === 1 ? 'позиции' : 'позициям'} (${pendingWeightItems.map(it => it.name).join(', ')}) ещё не подтверждён складом — сумма может быть неточной. Всё равно напечатать?`)) return;
    fn();
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(28,25,23,0.45)",
      zIndex: 200,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      margin: "16px",
      borderRadius: 16,
      padding: 20,
      maxWidth: 480,
      marginLeft: "auto",
      marginRight: "auto",
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: C.textFaint,
      fontWeight: 600,
      textTransform: "uppercase"
    }
  }, "\u0417\u0430\u044F\u0432\u043A\u0430"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, "\u2116 ", order.id)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement(StatusBadge, {
    status: order.status
  }), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: onClose
  }, "\u2715"))), pendingWeightItems.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#FEF3C7",
      border: "1px solid #FDE68A",
      borderRadius: 10,
      padding: "10px 12px",
      marginBottom: 12,
      fontSize: 14,
      color: "#92400E",
      fontWeight: 600
    }
  }, "\u2696\uFE0F \u0412\u0435\u0441 \u043D\u0435 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0451\u043D \u0441\u043A\u043B\u0430\u0434\u043E\u043C: ", pendingWeightItems.map(it => it.name).join(', '), ". \u0421\u0443\u043C\u043C\u0430 \u0437\u0430\u044F\u0432\u043A\u0438 \u043C\u043E\u0436\u0435\u0442 \u0438\u0437\u043C\u0435\u043D\u0438\u0442\u044C\u0441\u044F."), currentUser.role !== "driver" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      flex: 1,
      padding: "11px",
      background: C.navy,
      color: C.white,
      border: "none",
      borderRadius: 10,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6
    },
    onClick: () => confirmPrintIfPending(() => printWaybill(order))
  }, "\uD83D\uDDA8 \u041F\u0435\u0447\u0430\u0442\u044C \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u043E\u0439"), /*#__PURE__*/React.createElement("button", {
    style: {
      flex: 1,
      padding: "11px",
      background: "#25D366",
      color: C.white,
      border: "none",
      borderRadius: 10,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      gap: 6
    },
    onClick: () => confirmPrintIfPending(() => shareWaybillPdf(order))
  }, "\uD83D\uDCF2 \u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C PDF")), /*#__PURE__*/React.createElement("hr", {
    style: S.divider
  }), [["Клиент", order.client_name || order.clientName], ["Адрес", order.address], ["Торговый", order.sales_name || order.salesName], ["Дата", order.date], ["Доставка", order.time_slot || order.timeSlot], ...(order.driver_name ? [["Водитель", order.driver_name]] : []), ...(order.contact_name ? [["Контакт", order.contact_name]] : []), ...(order.contact_phone ? [["Телефон", order.contact_phone]] : []), ...(order.comment ? [["Комментарий", order.comment]] : [])].map(([k, v]) => /*#__PURE__*/React.createElement("div", {
    key: k,
    style: {
      ...S.row,
      marginBottom: 8,
      alignItems: "flex-start"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textFaint,
      fontWeight: 600,
      minWidth: 90,
      textTransform: "uppercase"
    }
  }, k), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.text,
      textAlign: "right",
      flex: 1
    }
  }, v))), /*#__PURE__*/React.createElement("hr", {
    style: S.divider
  }), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 10px",
      fontSize: 14,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, "\u0421\u043E\u0441\u0442\u0430\u0432"), items.map((item, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      ...S.row,
      marginBottom: 8,
      fontSize: 15
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textMid
    }
  }, item.name), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textSub
    }
  }, item.qty, " \xD7 ", item.price, " \u20B8 = ", /*#__PURE__*/React.createElement("strong", {
    style: {
      color: C.text
    }
  }, (item.qty * item.price).toLocaleString(), " \u20B8")))), /*#__PURE__*/React.createElement("hr", {
    style: S.divider
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      fontSize: 17,
      fontWeight: 700,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textMid
    }
  }, "\u0418\u0442\u043E\u0433\u043E"), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.navy,
      fontFamily: FH,
      fontWeight: 800
    }
  }, (order.total || 0).toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 14,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, "\u041E\u043F\u043B\u0430\u0442\u0430"), /*#__PURE__*/React.createElement(PaymentTags, {
    payment: payment
  }), order.delivery_photo && !(currentUser.role === "driver" && order.status === "in_transit") && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 14,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, "\u0424\u043E\u0442\u043E \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u043E\u0439"), /*#__PURE__*/React.createElement("a", {
    href: order.delivery_photo,
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement("img", {
    src: order.delivery_photo,
    style: {
      width: "100%",
      maxHeight: 220,
      objectFit: "cover",
      borderRadius: 10,
      border: `1px solid ${C.border}`
    }
  }))), order.cash_photo && !(currentUser.role === "driver" && order.status === "in_transit") && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 14,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, "\u0424\u043E\u0442\u043E \u043D\u0430\u043B\u0438\u0447\u043D\u043E\u0441\u0442\u0438"), /*#__PURE__*/React.createElement("a", {
    href: order.cash_photo,
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement("img", {
    src: order.cash_photo,
    style: {
      width: "100%",
      maxHeight: 220,
      objectFit: "cover",
      borderRadius: 10,
      border: `1px solid ${C.border}`
    }
  }))), order.qr_photo && !(currentUser.role === "driver" && order.status === "in_transit") && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 8px",
      fontSize: 14,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, "\u0424\u043E\u0442\u043E \u0447\u0435\u043A\u0430 QR"), /*#__PURE__*/React.createElement("a", {
    href: order.qr_photo,
    target: "_blank",
    rel: "noopener noreferrer"
  }, /*#__PURE__*/React.createElement("img", {
    src: order.qr_photo,
    style: {
      width: "100%",
      maxHeight: 220,
      objectFit: "cover",
      borderRadius: 10,
      border: `1px solid ${C.border}`
    }
  }))), currentUser.role === "driver" && order.status === "in_transit" && order.driver_id === currentUser.id && /*#__PURE__*/React.createElement(DriverPaymentBlock, {
    order: order,
    onUpdateStatus: onUpdateStatus
  }), currentUser.role === "driver" && order.status === "in_transit" && order.driver_id === currentUser.id && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnOutline,
      borderColor: "#6B7280",
      color: "#6B7280"
    },
    onClick: () => {
      if (window.confirm('Вернуть заявку в очередь? Другой водитель сможет её забрать.')) onUpdateStatus(order.id, "new", null);
    }
  }, "\uD83D\uDD04 \u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u044C")), currentUser.role === "driver" && order.status === "new" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: S.btnPrimary,
    onClick: () => onUpdateStatus(order.id, "in_transit", null)
  }, "\uD83D\uDE9A \u0412\u0437\u044F\u0442\u044C \u0432 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0443")), (currentUser.role === "sales" || currentUser.role === "store" || currentUser.role === "senior_sales" && order.sales_id === currentUser.id) && order.status === "new" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: S.btnDanger,
    onClick: () => {
      if (window.confirm('Отозвать заявку № ' + order.id + '? Действие нельзя отменить.')) onUpdateStatus(order.id, "revoked", null);
    }
  }, "\uD83D\uDDD1 \u041E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443")), (currentUser.role === "admin" || currentUser.role === "manager" || currentUser.role === "operator") && order.status === "new" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 6
    }
  }, "\u041D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F"), /*#__PURE__*/React.createElement("select", {
    style: {
      ...S.select,
      marginBottom: 10
    },
    value: selectedDriverId,
    onChange: e => setSelectedDriverId(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: ""
  }, "\u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F \u2014"), (drivers || []).map(d => /*#__PURE__*/React.createElement("option", {
    key: d.id,
    value: d.id
  }, d.name))), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnOutline,
      opacity: selectedDriverId ? 1 : 0.5,
      cursor: selectedDriverId ? "pointer" : "not-allowed"
    },
    disabled: !selectedDriverId,
    onClick: () => {
      const driverName = (drivers || []).find(d => String(d.id) === String(selectedDriverId))?.name || '';
      if (!window.confirm(`Передать заявку № ${order.id} водителю «${driverName}»?`)) return;
      onUpdateStatus(order.id, "in_transit", null, Number(selectedDriverId));
    }
  }, "\uD83D\uDE9A \u041F\u0435\u0440\u0435\u0434\u0430\u0442\u044C \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044E"), (!drivers || drivers.length === 0) && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      fontSize: 14,
      color: C.red
    }
  }, "\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u0439 \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435")), (currentUser.role === "admin" || currentUser.role === "manager" || currentUser.role === "operator") && order.status === "in_transit" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnOutline,
      borderColor: "#6B7280",
      color: "#6B7280"
    },
    onClick: () => {
      if (window.confirm('Вернуть заявку в очередь? Другой водитель сможет её забрать.')) onUpdateStatus(order.id, "new", null);
    }
  }, "\uD83D\uDD04 \u0412\u0435\u0440\u043D\u0443\u0442\u044C \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u044C"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnOutline,
      borderColor: "#7C3AED",
      color: "#7C3AED"
    },
    onClick: () => {
      if (window.confirm('Оформить возврат по заявке № ' + order.id + '? Действие нельзя отменить.')) onUpdateStatus(order.id, "returned", null);
    }
  }, "\u21A9\uFE0F \u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442")), currentUser.role === "admin" && onDeleteOrder && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20,
      paddingTop: 16,
      borderTop: `1px dashed ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnDanger,
      width: "100%",
      opacity: 0.85
    },
    onClick: () => {
      if (window.confirm(`Удалить заявку №${order.id} без возможности восстановления?`)) onDeleteOrder(order.id);
    }
  }, "\uD83D\uDDD1 \u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443 \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430"))));
}
function SalesCabinet({
  user,
  token,
  onLogout
}) {
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
  const newLine = () => ({
    uid: Math.random(),
    productId: null,
    name: "",
    qty: "",
    price: "",
    search: "",
    showDrop: false,
    pricedByWeight: false,
    weightPerBox: ""
  });
  const [lines, setLines] = useState([newLine()]);
  const [clients, setClients] = useState([]);
  const [clientSearchText, setClientSearchText] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  useEffect(() => {
    apiCall('GET', '/api/clients').then(setClients).catch(() => {});
  }, []);
  const [debts, setDebts] = useState([]);
  const loadDebts = useCallback(() => {
    apiCall('GET', '/api/debts').then(setDebts).catch(() => {});
  }, []);
  useEffect(() => {
    loadDebts();
  }, []);
  useRefetchOnVisible(loadDebts);
  const selectedClientDebt = clientId ? debts.filter(d => d.client_name === clients.find(c => c.code === clientId)?.name && d.overdue).reduce((s, d) => s + d.remaining, 0) : 0;
  const [products, setProducts] = useState([]);
  const loadProducts = useCallback(() => {
    fetch('/api/products').then(r => r.json()).then(data => setProducts(data.filter(p => p.has_alias).map((p, i) => ({
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
      avgWeightPerBox: p.avg_box_weight != null ? p.avg_box_weight : p.stock_weight_kg != null && p.stock > 0 ? p.stock_weight_kg / p.stock : null,
      // Snake_case-дубли — их читают общие хелперы stockAmount/stockLabel/
      // stockIsOut (см. выше), которые проверяют именно priced_by_weight/
      // stock_weight_kg, как отдаёт /api/products. Без этого хелперы решали
      // бы, что товар не весовой, и молча возвращались бы к протухшим коробам.
      priced_by_weight: !!p.priced_by_weight,
      stock_weight_kg: p.stock_weight_kg != null ? p.stock_weight_kg : null,
      avg_box_weight: p.avg_box_weight != null ? p.avg_box_weight : null
    })))).catch(() => {});
  }, []);
  useEffect(() => {
    loadProducts();
  }, []);
  useRefetchOnVisible(loadProducts);
  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch (e) {
      if (e.message.includes('токен')) onLogout();
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    loadOrders();
  }, []);
  useRefetchOnVisible(loadOrders);
  const updateLine = (uid, patch) => setLines(ls => ls.map(l => l.uid === uid ? {
    ...l,
    ...patch
  } : l));
  const removeLine = uid => setLines(ls => ls.length > 1 ? ls.filter(l => l.uid !== uid) : ls);
  const addLine = () => setLines(ls => [...ls, newLine()]);
  const selectProduct = (uid, prod) => {
    if (stockIsOut(prod)) return;
    updateLine(uid, {
      productId: prod.id,
      code: prod.code,
      name: prod.name,
      price: prod.priceOptions && prod.priceOptions.length === 1 ? prod.priceOptions[0] : "",
      search: prod.name,
      showDrop: false,
      qty: "",
      priceOptions: prod.priceOptions || [],
      commission: prod.commission || 0,
      stock: prod.stock,
      stockWeightKg: prod.stock_weight_kg,
      avgBoxWeight: prod.avg_box_weight,
      pricedByWeight: !!prod.pricedByWeight,
      weightPerBox: prod.avgWeightPerBox != null ? String(Math.round(prod.avgWeightPerBox * 100) / 100) : ""
    });
  };

  // Для весового товара (короб/тара, цена за кг) реальный вес заявки — это
  // кол-во коробов × примерный вес короба, который торговый вписывает сам
  // (см. selectProduct — предзаполняется средним по остатку, если известен).
  // Это только оценка для суммы заявки на этом этапе: факт. вес всё равно
  // потом подтверждает склад при отгрузке (POST /api/orders/weights) и
  // сумма заявки пересчитывается по нему.
  const estWeightOf = l => l.pricedByWeight ? (Number(l.qty) || 0) * (Number(l.weightPerBox) || 0) : Number(l.qty) || 0;
  const filledLines = lines.filter(l => l.name && Number(l.qty) > 0 && Number(l.price) > 0 && (!l.pricedByWeight || Number(l.weightPerBox) > 0));
  const total = filledLines.reduce((s, l) => s + estWeightOf(l) * Number(l.price), 0);
  const handleSubmit = async () => {
    if (submitting) return;
    if (!clientId || filledLines.length === 0 || !timeSlot || !contactPhone.trim()) return;
    const client = clients.find(c => c.code === clientId);
    const items = filledLines.map(l => l.pricedByWeight ? {
      id: l.productId,
      code: l.code,
      name: l.name,
      qty: estWeightOf(l),
      boxes: Number(l.qty),
      price: Number(l.price),
      commission: l.commission || 0
    } : {
      id: l.productId,
      code: l.code,
      name: l.name,
      qty: Number(l.qty),
      price: Number(l.price),
      commission: l.commission || 0
    });
    setSubmitting(true);
    try {
      await apiCall('POST', '/api/orders', {
        clientName: client.name,
        clientCode: client.code,
        address: client.address || '',
        timeSlot,
        items,
        total,
        paymentCash: 0,
        paymentQr: 0,
        paymentDebt: 0,
        comment,
        contactName,
        contactPhone
      });
      setLines([newLine()]);
      setClientId("");
      setClientSearchText("");
      setTimeSlot("");
      setComment("");
      setContactName("");
      setContactPhone("");
      setSubmitted(true);
      setTab("orders");
      loadOrders();
      apiCall('GET', '/api/clients').then(setClients).catch(() => {});
      setTimeout(() => setSubmitted(false), 4000);
    } catch (e) {
      alert(e.message);
    }
    setSubmitting(false);
  };
  const handleUpdateStatus = async (id, status, payment) => {
    try {
      await apiCall('PUT', `/api/orders/${id}/status`, {
        status
      });
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
  };
  const todayStr = new Date().toISOString().slice(0, 10);
  const [salesDateFrom, setSalesDateFrom] = useState(todayStr);
  const [salesDateTo, setSalesDateTo] = useState(todayStr);
  const [salesPreset, setSalesPreset] = useState("day");
  const applySalesPreset = preset => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);else if (preset === "month") from.setDate(now.getDate() - 29);
    setSalesPreset(preset);
    if (preset !== "custom") {
      setSalesDateFrom(from.toISOString().slice(0, 10));
      setSalesDateTo(todayStr);
    }
  };
  const [salesRepFilter, setSalesRepFilter] = useState("");
  const salesReps = useMemo(() => {
    if (user.role !== "senior_sales") return [];
    const map = {};
    orders.forEach(o => {
      if (o.sales_id != null) map[o.sales_id] = o.sales_name || map[o.sales_id];
    });
    return Object.entries(map).map(([id, name]) => ({
      id,
      name
    })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  }, [orders, user.role]);
  const scopedOrders = user.role === "senior_sales" && salesRepFilter ? orders.filter(o => String(o.sales_id) === salesRepFilter) : orders;
  const visibleOrders = scopedOrders.filter(o => o.status === "new" || o.status === "in_transit" || ["cancelled", "returned"].includes(o.status) && o.date === todayStr);
  const stats = {
    total: visibleOrders.length,
    delivered: visibleOrders.filter(o => o.status === "delivered").length,
    inTransit: visibleOrders.filter(o => o.status === "in_transit").length,
    new: visibleOrders.filter(o => o.status === "new").length
  };
  const periodDeliveredOrders = scopedOrders.filter(o => o.status === "delivered" && o.date >= salesDateFrom && o.date <= salesDateTo);
  const todaySales = periodDeliveredOrders.reduce((s, o) => s + (o.total || 0), 0);
  const [showSalesList, setShowSalesList] = useState(false);
  const [expandedClients, setExpandedClients] = useState({});
  const clientBreakdown = {};
  periodDeliveredOrders.forEach(o => {
    const key = o.client_name;
    if (!clientBreakdown[key]) clientBreakdown[key] = {
      name: o.client_name,
      revenue: 0,
      items: []
    };
    clientBreakdown[key].revenue += o.total || 0;
    const its = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
    its.forEach(it => clientBreakdown[key].items.push({
      name: it.name,
      qty: it.qty,
      price: it.price
    }));
  });
  const clientList = Object.values(clientBreakdown).sort((a, b) => b.revenue - a.revenue);

  // Долги "своих" клиентов — для обычного торгового (не старшего): бэкенд
  // уже отдаёт ему только его заявки (см. GET /api/orders), поэтому долг
  // считается "свой", если он привязан к заявке из этого списка. Кассовые
  // долги (sale_id) сюда не попадают — их пробивает кассир, не торговый.
  const [showMyDebts, setShowMyDebts] = useState(false);
  const myOrderIds = useMemo(() => new Set(orders.map(o => o.id)), [orders]);
  const myDebts = user.role === "sales" ? debts.filter(d => d.order_id && myOrderIds.has(d.order_id)) : [];
  const myDebtsTotal = myDebts.reduce((s, d) => s + d.remaining, 0);
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 72
    }
  }, selectedOrder && /*#__PURE__*/React.createElement(OrderDetail, {
    order: selectedOrder,
    onClose: () => setSelectedOrder(null),
    onUpdateStatus: handleUpdateStatus,
    currentUser: user
  }), editOrder && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(28,25,23,0.45)",
      zIndex: 200,
      overflowY: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#fff",
      margin: "16px",
      borderRadius: 16,
      padding: 20,
      maxWidth: 480,
      marginLeft: "auto",
      marginRight: "auto"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 19,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, "\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u0435 \u2116 ", editOrder.id), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => setEditOrder(null)
  }, "\u2715")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 15,
      color: C.textSub,
      marginBottom: 16
    }
  }, "\u0414\u043B\u044F \u0440\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u0438\u044F \u043E\u0442\u0437\u043E\u0432\u0438\u0442\u0435 \u0437\u0430\u044F\u0432\u043A\u0443 \u0438 \u0441\u043E\u0437\u0434\u0430\u0439\u0442\u0435 \u043D\u043E\u0432\u0443\u044E"), /*#__PURE__*/React.createElement("button", {
    style: S.btnDanger,
    onClick: async () => {
      try {
        await apiCall('PUT', `/api/orders/${editOrder.id}/status`, {
          status: "revoked"
        });
        setEditOrder(null);
        loadOrders();
      } catch (e) {
        alert(e.message);
      }
    }
  }, "\uD83D\uDDD1 \u041E\u0442\u043E\u0437\u0432\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnOutline,
      marginTop: 8
    },
    onClick: () => {
      setEditOrder(null);
      setTab("new");
    }
  }, "\uD83D\uDCDD \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043D\u043E\u0432\u0443\u044E \u0437\u0430\u044F\u0432\u043A\u0443"))), /*#__PURE__*/React.createElement("div", {
    style: S.page
  }, tab === "orders" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    style: S.bigCreate,
    onClick: () => {
      window.history.pushState({
        view: 'new'
      }, '', '');
      setTab("new");
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: S.bigCreatePlus
  }, "+"), " \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u0437\u0430\u044F\u0432\u043A\u0443"), submitted && /*#__PURE__*/React.createElement("div", {
    style: S.alertSuccess
  }, "\u0417\u0430\u044F\u0432\u043A\u0430 \u0443\u0441\u043F\u0435\u0448\u043D\u043E \u0441\u043E\u0437\u0434\u0430\u043D\u0430!"), loading ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : /*#__PURE__*/React.createElement(React.Fragment, null, salesReps.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setSalesRepFilter(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${salesRepFilter === "" ? C.navy : C.border}`,
      background: salesRepFilter === "" ? C.navy : C.white,
      color: salesRepFilter === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435 \u0442\u043E\u0440\u0433\u043E\u0432\u044B\u0435"), salesReps.map(r => /*#__PURE__*/React.createElement("button", {
    key: r.id,
    onClick: () => setSalesRepFilter(String(r.id)),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${salesRepFilter === String(r.id) ? C.navy : C.border}`,
      background: salesRepFilter === String(r.id) ? C.navy : C.white,
      color: salesRepFilter === String(r.id) ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, r.name))), /*#__PURE__*/React.createElement("div", {
    style: S.statsRow
  }, /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum()
  }, stats.total), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412\u0441\u0435\u0433\u043E \u0437\u0430\u044F\u0432\u043E\u043A")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.green)
  }, stats.delivered), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0414\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.amber)
  }, stats.inTransit), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412 \u0440\u0430\u0431\u043E\u0442\u0435")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.pending)
  }, stats.new), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u041D\u043E\u0432\u044B\u0445"))), /*#__PURE__*/React.createElement("div", {
    style: S.revenueCard
  }, /*#__PURE__*/React.createElement("p", {
    style: S.revenueLabel
  }, "\u041F\u0440\u043E\u0434\u0430\u0436\u0438 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434"), /*#__PURE__*/React.createElement("p", {
    style: S.revenueNum
  }, todaySales.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 12,
      marginBottom: 4
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, [["day", "День"], ["week", "Неделя"], ["month", "Месяц"], ["custom", "Свободный отбор"]].map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => applySalesPreset(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${salesPreset === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: salesPreset === k ? C.navy : C.white,
      color: salesPreset === k ? C.white : C.textMid
    }
  }, lb))), salesPreset === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u0421"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: salesDateFrom,
    onChange: e => setSalesDateFrom(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u041F\u043E"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: salesDateTo,
    onChange: e => setSalesDateTo(e.target.value)
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      cursor: "pointer",
      marginTop: 12,
      marginBottom: showSalesList ? 8 : 0
    },
    onClick: () => setShowSalesList(s => !s)
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17,
      margin: 0
    }
  }, "\u041F\u0440\u043E\u0434\u0430\u043D\u043E \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      color: C.textFaint
    }
  }, showSalesList ? "▲ Свернуть" : "▼ Показать")), showSalesList && clientList.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u044F\u0432\u043E\u043A \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434"), showSalesList && clientList.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, clientList.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      cursor: "pointer"
    },
    onClick: () => setExpandedClients(e => ({
      ...e,
      [i]: !e[i]
    }))
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, c.name), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, c.items.length, " \u043F\u043E\u0437.")), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, c.revenue.toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: C.textFaint
    }
  }, expandedClients[i] ? "▲ Свернуть" : "▼ Подробнее"))), expandedClients[i] && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${C.border}`
    }
  }, c.items.map((it, j) => /*#__PURE__*/React.createElement("div", {
    key: j,
    style: {
      ...S.row,
      marginBottom: 6,
      fontSize: 14
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textMid
    }
  }, it.name, " ", /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textFaint
    }
  }, "\xD7", it.qty)), /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textSub
    }
  }, it.price, " \u20B8"))))))), user.role === "sales" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      cursor: "pointer",
      marginTop: 20,
      marginBottom: showMyDebts ? 8 : 0
    },
    onClick: () => setShowMyDebts(s => !s)
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17,
      margin: 0
    }
  }, "\u041C\u043E\u0438 \u0434\u043E\u043B\u0436\u043D\u0438\u043A\u0438", myDebtsTotal > 0 ? ` · ${myDebtsTotal.toLocaleString()} ₸` : ''), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      color: C.textFaint
    }
  }, showMyDebts ? "▲ Свернуть" : "▼ Показать")), showMyDebts && myDebts.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u0414\u043E\u043B\u0433\u043E\u0432 \u043D\u0435\u0442"), showMyDebts && myDebts.map(d => /*#__PURE__*/React.createElement("div", {
    key: d.order_id,
    style: {
      ...S.card,
      borderLeft: d.overdue ? `4px solid ${C.red}` : "4px solid #F59E0B",
      background: d.overdue ? "#FEF2F2" : C.white
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, d.client_name, " ", d.overdue && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontSize: 13,
      fontWeight: 700
    }
  }, "\xB7 \u041F\u0420\u041E\u0421\u0420\u041E\u0427\u0415\u041D")), /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.cardSub,
      color: d.overdue ? "#B91C1C" : C.textSub
    }
  }, "\u2116 ", d.order_id, " \xB7 ", d.date, " \xB7 ", d.days_ago === 0 ? 'сегодня' : `${d.days_ago} ${daysWord(d.days_ago)}`, d.settled > 0 ? ` · погашено ${d.settled.toLocaleString()} ₸` : '')), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 800,
      fontFamily: FH,
      color: d.overdue ? C.red : "#92400E"
    }
  }, d.remaining.toLocaleString(), " \u20B8"))))), /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17,
      marginTop: 20
    }
  }, user.role === "senior_sales" ? salesRepFilter ? `Заявки: ${salesReps.find(r => r.id === salesRepFilter)?.name || ''}` : "Заявки всех торговых" : "Мои заявки"), visibleOrders.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDCCB"), /*#__PURE__*/React.createElement("p", null, "\u0417\u0430\u044F\u0432\u043E\u043A \u043F\u043E\u043A\u0430 \u043D\u0435\u0442")) : visibleOrders.map(o => /*#__PURE__*/React.createElement(OrderCard, {
    key: o.id,
    order: o,
    onOpen: setSelectedOrder,
    onEdit: o.status === "new" && (user.role !== "senior_sales" || o.sales_id === user.id) ? setEditOrder : null
  })))), tab === "new" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      margin: 0
    }
  }, "\u041D\u043E\u0432\u0430\u044F \u0437\u0430\u044F\u0432\u043A\u0430"), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => setTab("orders")
  }, "\u2190 \u041D\u0430\u0437\u0430\u0434")), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442 ", clients.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.green,
      fontWeight: 400,
      fontSize: 13
    }
  }, "(", clients.length, " \u0438\u0437 1\u0421)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      paddingRight: clientSearchText ? 38 : 14
    },
    placeholder: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435...",
    value: clientSearchText,
    onChange: e => {
      setClientSearchText(e.target.value);
      setClientId("");
      setShowClientDrop(true);
    },
    onFocus: () => setShowClientDrop(true),
    onBlur: () => setTimeout(() => setShowClientDrop(false), 180)
  }), clientSearchText && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onMouseDown: e => e.preventDefault(),
    onClick: () => {
      setClientSearchText("");
      setClientId("");
      setContactName("");
      setContactPhone("");
    },
    style: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: 20,
      color: C.textFaint,
      padding: 4,
      lineHeight: 1
    }
  }, "\xD7"), showClientDrop && (() => {
    const matched = clientSearchText.length > 0 ? clients.filter(c => c.name.toLowerCase().includes(clientSearchText.toLowerCase())) : clients.slice(0, 50);
    return matched.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        zIndex: 50,
        maxHeight: 220,
        overflowY: "auto"
      }
    }, matched.map(c => /*#__PURE__*/React.createElement("div", {
      key: c.code,
      onMouseDown: () => {
        setClientId(c.code);
        setClientSearchText(c.name);
        setShowClientDrop(false);
        setContactName(c.contact_name || '');
        setContactPhone(c.contact_phone || '');
      },
      style: {
        padding: "9px 12px",
        cursor: "pointer",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 15
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600
      }
    }, c.name), c.address && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.textFaint
      }
    }, "\uD83D\uDCCD ", c.address))));
  })()), clientId && clients.find(c => c.code === clientId)?.address && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 14,
      color: C.textSub
    }
  }, "\uD83D\uDCCD ", clients.find(c => c.code === clientId)?.address), selectedClientDebt > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      padding: "10px 12px",
      background: "#FEF2F2",
      border: "1px solid #FECACA",
      borderRadius: 8,
      fontSize: 14,
      color: C.red,
      fontWeight: 600
    }
  }, "\u26A0\uFE0F \u0423 \u043A\u043E\u043D\u0442\u0440\u0430\u0433\u0435\u043D\u0442\u0430 \u043D\u0435\u043F\u043E\u0433\u0430\u0448\u0435\u043D\u043D\u044B\u0439 \u0434\u043E\u043B\u0433 \u0431\u043E\u043B\u0435\u0435 7 \u0434\u043D\u0435\u0439: ", selectedClientDebt.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u043E\u0435 \u043B\u0438\u0446\u043E"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      paddingRight: contactPhone ? 38 : 14
    },
    placeholder: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D",
    value: contactPhone,
    onChange: e => setContactPhone(e.target.value)
  }), contactPhone && /*#__PURE__*/React.createElement("button", {
    type: "button",
    onClick: () => setContactPhone(""),
    style: {
      position: "absolute",
      right: 10,
      top: "50%",
      transform: "translateY(-50%)",
      background: "none",
      border: "none",
      cursor: "pointer",
      fontSize: 20,
      color: C.textFaint,
      padding: 4,
      lineHeight: 1
    }
  }, "\xD7"))), /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u0412\u0440\u0435\u043C\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, [...TIME_SLOTS, PICKUP_SLOT].map(slot => /*#__PURE__*/React.createElement("button", {
    key: slot,
    onClick: () => setTimeSlot(slot),
    style: {
      padding: "12px",
      borderRadius: 10,
      border: `1.5px solid ${timeSlot === slot ? C.navy : C.border}`,
      background: timeSlot === slot ? C.navy : C.white,
      color: timeSlot === slot ? C.white : C.textMid,
      fontSize: 16,
      fontWeight: 500,
      cursor: "pointer",
      textAlign: "left"
    }
  }, slot))))), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u0430 ", products.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.green,
      fontWeight: 400,
      fontSize: 13
    }
  }, "(", products.length, " \u043F\u043E\u0437. \u0438\u0437 1\u0421)")), /*#__PURE__*/React.createElement("button", {
    onClick: addLine,
    style: {
      background: C.navy,
      color: C.white,
      border: "none",
      borderRadius: 8,
      padding: "4px 12px",
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "+ \u0422\u043E\u0432\u0430\u0440")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 64px 80px 28px",
      gap: 6,
      marginBottom: 6
    }
  }, ["Наименование", "Кол-во", "Цена ₸", ""].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, h))), lines.map(line => {
    const inStock = products.filter(p => !stockIsOut(p));
    const matched = line.search.length > 0 ? inStock.filter(p => p.name.toLowerCase().includes(line.search.toLowerCase())) : inStock.slice(0, 50);
    const lineWeight = estWeightOf(line);
    const lineTotal = lineWeight > 0 && Number(line.price) > 0 ? lineWeight * Number(line.price) : null;
    return /*#__PURE__*/React.createElement("div", {
      key: line.uid,
      style: {
        marginBottom: 8
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 64px 80px 28px",
        gap: 6,
        alignItems: "center"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative"
      }
    }, /*#__PURE__*/React.createElement("input", {
      style: {
        ...S.input,
        padding: "8px 10px",
        fontSize: 15
      },
      placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440...",
      value: line.search,
      onChange: e => updateLine(line.uid, {
        search: e.target.value,
        name: e.target.value,
        productId: null,
        price: "",
        showDrop: true
      }),
      onFocus: () => updateLine(line.uid, {
        showDrop: true
      }),
      onBlur: () => setTimeout(() => updateLine(line.uid, {
        showDrop: false
      }), 180)
    }), line.showDrop && matched.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        zIndex: 50,
        maxHeight: 180,
        overflowY: "auto"
      }
    }, matched.map(p => {
      const outOfStock = stockIsOut(p);
      const stockLbl = stockLabel(p);
      return /*#__PURE__*/React.createElement("div", {
        key: p.id,
        onMouseDown: () => selectProduct(line.uid, p),
        style: {
          padding: "9px 12px",
          cursor: outOfStock ? "not-allowed" : "pointer",
          borderBottom: `1px solid ${C.border}`,
          fontSize: 15,
          opacity: outOfStock ? 0.5 : 1,
          background: outOfStock ? C.surface : C.white
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: {
          fontWeight: 600
        }
      }, p.name), /*#__PURE__*/React.createElement("div", {
        style: {
          fontSize: 13,
          color: outOfStock ? C.red : C.textFaint
        }
      }, p.price > 0 ? p.price.toLocaleString() + ' ₸ / ' : '', p.unit, p.group ? ' · ' + p.group : '', stockLbl != null ? outOfStock ? ' · Нет в наличии' : ' · Остаток: ' + stockLbl : ''));
    }))), /*#__PURE__*/React.createElement("input", {
      style: {
        ...S.input,
        padding: "8px 6px",
        fontSize: 15,
        textAlign: "center"
      },
      placeholder: line.pricedByWeight ? "кор" : "кол",
      value: line.qty,
      type: "number",
      min: "1",
      max: !line.pricedByWeight && line.stock != null ? line.stock : undefined,
      onChange: e => {
        // Короба весового товара — только оценка торгового (1С их
        // не считает вообще, см. /api/stock/sync), ограничивать
        // ввод остатком коробов не нужно (сервер тоже не проверяет,
        // см. POST /api/orders) — точный расход выяснится на весах.
        let v = e.target.value;
        if (!line.pricedByWeight && line.stock != null && Number(v) > line.stock) v = String(line.stock);
        updateLine(line.uid, {
          qty: v
        });
      },
      onFocus: e => e.target.select()
    }), /*#__PURE__*/React.createElement("input", {
      style: {
        ...S.input,
        padding: "8px 6px",
        fontSize: 15,
        textAlign: "right",
        background: line.priceOptions && line.priceOptions.length > 0 ? C.surface : C.white,
        color: line.priceOptions && line.priceOptions.length > 0 ? C.textSub : C.text
      },
      placeholder: "\u0446\u0435\u043D\u0430",
      value: line.price,
      type: "number",
      disabled: line.priceOptions && line.priceOptions.length > 0,
      onChange: e => updateLine(line.uid, {
        price: e.target.value
      }),
      onFocus: e => e.target.select()
    }), /*#__PURE__*/React.createElement("button", {
      onClick: () => removeLine(line.uid),
      style: {
        width: 28,
        height: 34,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: C.surface,
        cursor: "pointer",
        fontSize: 16,
        color: C.textFaint
      }
    }, "\xD7")), line.pricedByWeight ? line.stockWeightKg != null && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.textFaint,
        marginTop: 2
      }
    }, "\u041D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435: ", formatWeightStock(line.stockWeightKg, line.avgBoxWeight)) : line.stock != null && /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.textFaint,
        marginTop: 2
      }
    }, "\u041D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435: ", line.stock), line.pricedByWeight && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginTop: 6
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.textSub,
        whiteSpace: "nowrap"
      }
    }, "\u2696\uFE0F \u0412\u0435\u0441 \u043A\u043E\u0440\u043E\u0431\u0430, \u043A\u0433 (\u043F\u0440\u0438\u043C\u0435\u0440\u043D\u043E)"), /*#__PURE__*/React.createElement("input", {
      style: {
        ...S.input,
        width: 80,
        padding: "6px 8px",
        fontSize: 14,
        textAlign: "center"
      },
      placeholder: "\u043A\u0433",
      value: line.weightPerBox,
      type: "number",
      onChange: e => updateLine(line.uid, {
        weightPerBox: e.target.value
      }),
      onFocus: e => e.target.select()
    }), lineWeight > 0 && /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.textFaint
      }
    }, "\u2248 ", lineWeight.toLocaleString(), " \u043A\u0433")), lineTotal && /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right",
        fontSize: 13,
        color: C.textSub,
        marginTop: 2,
        paddingRight: 34
      }
    }, "= ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: C.navy
      }
    }, lineTotal.toLocaleString(), " \u20B8")), line.priceOptions && line.priceOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6,
        marginTop: 6,
        flexWrap: "wrap"
      }
    }, line.priceOptions.map((pr, i) => /*#__PURE__*/React.createElement("button", {
      key: i,
      onClick: () => updateLine(line.uid, {
        price: pr
      }),
      style: {
        padding: "5px 12px",
        borderRadius: 8,
        border: `1px solid ${Number(line.price) === pr ? C.navy : C.border}`,
        background: Number(line.price) === pr ? C.navy : C.white,
        color: Number(line.price) === pr ? C.white : C.textMid,
        fontSize: 14,
        fontWeight: 600,
        cursor: "pointer"
      }
    }, pr.toLocaleString(), " \u20B8"))));
  }), filledLines.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("hr", {
    style: {
      ...S.divider,
      marginTop: 8
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.textSub
    }
  }, "\u0418\u0442\u043E\u0433\u043E"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, total.toLocaleString(), " \u20B8")))), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439"), /*#__PURE__*/React.createElement("textarea", {
    style: S.textarea,
    value: comment,
    onChange: e => setComment(e.target.value),
    placeholder: "\u041E\u0441\u043E\u0431\u044B\u0435 \u043F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F..."
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      opacity: submitting || !clientId || filledLines.length === 0 || !timeSlot || !contactPhone.trim() ? 0.45 : 1
    },
    onClick: handleSubmit,
    disabled: submitting || !clientId || filledLines.length === 0 || !timeSlot || !contactPhone.trim()
  }, submitting ? "Отправка..." : "Отправить заявку"))), tab === "cashbox" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041A\u0430\u0441\u0441\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.debtAmber,
      borderRadius: 10,
      padding: "12px",
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 13,
      color: "#92400E",
      fontWeight: 600
    }
  }, "\u0412\u0421\u0415\u0413\u041E \u0412 \u0414\u041E\u041B\u0413\u0410\u0425 (\u0432\u0441\u0435 \u0442\u043E\u0440\u0433\u043E\u0432\u044B\u0435)"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 800,
      fontFamily: FH,
      color: "#92400E"
    }
  }, debts.reduce((s, d) => s + d.remaining, 0).toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement(DebtsPanel, {
    readOnly: true
  })), tab === "aliases" && /*#__PURE__*/React.createElement(ProductAliasesPanel, null), tab === "stock" && /*#__PURE__*/React.createElement(StockPanel, null)), user.role === "senior_sales" && tab !== "new" && /*#__PURE__*/React.createElement("div", {
    style: S.nav
  }, [["orders", "📋", "Заявки"], ["cashbox", "💵", "Касса"], ["aliases", "🏷", "Товары"], ["stock", "📦", "Остатки"]].map(([k, ic, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    style: {
      ...S.navBtn(tab === k),
      flex: 1
    },
    onClick: () => setTab(k)
  }, /*#__PURE__*/React.createElement("span", {
    style: S.navIcon
  }, ic), /*#__PURE__*/React.createElement("span", {
    style: S.navLabel(tab === k)
  }, lb)))));
}
const STORE_TABS = [["orders", "📋", "Заказы"], ["new", "➕", "Новый заказ"], ["report", "📊", "Отчёт"], ["profile", "🏬", "Профиль"]];
const STORE_TAB_TITLES = {
  orders: "Заказы",
  new: "Новый заказ",
  report: "Отчёт о закупках",
  profile: "Профиль магазина"
};
const STORE_FILTERS = [["all", "Все"], ["new", "Ожидает"], ["in_transit", "В работе"], ["delivered", "Доставлено"], ["cancelled", "Отказ"], ["returned", "Возврат"]];
function StoreCabinet({
  user,
  onLogout,
  desktop
}) {
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
    } catch (e) {}
    setProfileLoading(false);
  }, []);
  useEffect(() => {
    loadProfile();
  }, []);
  const address = profile?.address || '';
  const contactName = profile?.contactName || '';
  const contactPhone = profile?.contactPhone || '';
  const profileComplete = !!(address.trim() && contactPhone.trim());
  const [profileForm, setProfileForm] = useState({
    address: '',
    contactName: '',
    contactPhone: ''
  });
  useEffect(() => {
    if (profile) setProfileForm({
      address: profile.address || '',
      contactName: profile.contactName || '',
      contactPhone: profile.contactPhone || ''
    });
  }, [profile]);
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const saveProfile = async () => {
    if (!profileForm.contactPhone.trim()) return;
    setSavingProfile(true);
    try {
      const saved = await apiCall('PUT', '/api/my-client', profileForm);
      setProfile(p => ({
        ...p,
        ...saved
      }));
      setProfileSaved(true);
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (e) {
      alert(e.message);
    }
    setSavingProfile(false);
  };
  const [products, setProducts] = useState([]);
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(data => setProducts(data.filter(p => p.has_alias && p.price1 != null).map((p, i) => ({
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
    })))).catch(() => {});
  }, []);
  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch (e) {
      if (e.message.includes('токен')) onLogout();
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    loadOrders();
  }, []);
  useRefetchOnVisible(loadOrders);
  const updateLine = (uid, patch) => setLines(ls => ls.map(l => l.uid === uid ? {
    ...l,
    ...patch
  } : l));
  const removeLine = uid => setLines(ls => ls.filter(l => l.uid !== uid));

  // Клик по карточке в каталоге: товар уже в корзине — увеличиваем кол-во
  // (не больше остатка), иначе добавляем новую строку с qty=1. Первое
  // добавление товара требует подтверждения — повторные клики (увеличение
  // кол-ва уже выбранного товара) больше не переспрашивают.
  const addProductToCart = prod => {
    if (stockIsOut(prod)) return;
    const alreadyInCart = lines.some(l => l.productId === prod.id);
    if (!alreadyInCart && !window.confirm(`Добавить «${prod.name}» в заказ?`)) return;
    setLines(ls => {
      const existing = ls.find(l => l.productId === prod.id);
      if (existing) {
        const nextQty = (Number(existing.qty) || 0) + 1;
        const avail = stockAmount(prod);
        const capped = avail != null ? Math.min(nextQty, avail) : nextQty;
        return ls.map(l => l.productId === prod.id ? {
          ...l,
          qty: String(capped)
        } : l);
      }
      // stock здесь — уже разрешённый остаток (кг для весового товара, короба́
      // для обычного, см. stockAmount) — им же ограничивает ручной ввод кол-ва
      // в корзине ниже (то же поле line.stock, отдельного кг-поля тут нет:
      // в отличие от SalesCabinet, здесь qty и так в единице p.unit, не в коробах).
      return [...ls, {
        uid: Math.random(),
        productId: prod.id,
        code: prod.code,
        name: prod.name,
        price: prod.price,
        search: prod.name,
        showDrop: false,
        qty: "1",
        stock: stockAmount(prod)
      }];
    });
  };
  const categories = useMemo(() => [...new Set(products.map(p => p.group).filter(Boolean))].sort(), [products]);
  const filteredCatalog = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    const list = products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.code || '').includes(q) || (p.barcode || '').includes(q)) && (!catalogCategory || p.group === catalogCategory));
    const sorted = list.slice();
    if (catalogSort === "group") sorted.sort((a, b) => (a.group || "").localeCompare(b.group || "", 'ru') || a.name.localeCompare(b.name, 'ru'));else sorted.sort((a, b) => a.name.localeCompare(b.name, 'ru'));
    return sorted;
  }, [products, catalogSearch, catalogCategory, catalogSort]);
  const filledLines = lines.filter(l => l.name && Number(l.qty) > 0 && Number(l.price) > 0);
  const total = filledLines.reduce((s, l) => s + Number(l.qty) * Number(l.price), 0);
  const handleSubmit = async () => {
    if (submitting) return;
    if (filledLines.length === 0 || !timeSlot || !contactPhone.trim()) return;
    const items = filledLines.map(l => ({
      id: l.productId,
      code: l.code,
      name: l.name,
      qty: Number(l.qty),
      price: Number(l.price)
    }));
    setSubmitting(true);
    try {
      await apiCall('POST', '/api/orders', {
        address,
        timeSlot,
        items,
        total,
        comment,
        contactName,
        contactPhone
      });
      setLines([]);
      setTimeSlot("");
      setComment("");
      setSubmitted(true);
      setTab("orders");
      loadOrders();
      setTimeout(() => setSubmitted(false), 4000);
    } catch (e) {
      alert(e.message);
    }
    setSubmitting(false);
  };
  const handleUpdateStatus = async (id, status, payment) => {
    try {
      await apiCall('PUT', `/api/orders/${id}/status`, {
        status
      });
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
  };
  const todayStr = new Date().toISOString().slice(0, 10);
  const monthAgoStr = (() => {
    const d = new Date();
    d.setDate(d.getDate() - 29);
    return d.toISOString().slice(0, 10);
  })();
  const [storeDateFrom, setStoreDateFrom] = useState(monthAgoStr);
  const [storeDateTo, setStoreDateTo] = useState(todayStr);
  const [storePreset, setStorePreset] = useState("month");
  const [filter, setFilter] = useState("all");
  const applyStorePreset = preset => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);else if (preset === "month") from.setDate(now.getDate() - 29);
    setStorePreset(preset);
    if (preset !== "custom") {
      setStoreDateFrom(from.toISOString().slice(0, 10));
      setStoreDateTo(todayStr);
    }
  };
  const periodOrders = useMemo(() => orders.filter(o => o.date >= storeDateFrom && o.date <= storeDateTo), [orders, storeDateFrom, storeDateTo]);
  const filteredOrders = filter === "all" ? periodOrders : periodOrders.filter(o => o.status === filter);
  const stats = {
    total: periodOrders.length,
    delivered: periodOrders.filter(o => o.status === "delivered").length,
    inTransit: periodOrders.filter(o => o.status === "in_transit").length,
    new: periodOrders.filter(o => o.status === "new").length,
    cancelled: periodOrders.filter(o => o.status === "cancelled").length,
    returned: periodOrders.filter(o => o.status === "returned").length,
    spent: periodOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0),
    cashTotal: periodOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.payment_cash || 0), 0),
    qrTotal: periodOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.payment_qr || 0), 0),
    debtTotal: periodOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.payment_debt || 0), 0)
  };

  // Отчёт о закупках: что и сколько магазин купил за период (только по
  // доставленным заказам — отменённые/возвраты в закуп не считаем).
  const productBreakdown = useMemo(() => {
    const map = {};
    periodOrders.filter(o => o.status === "delivered").forEach(o => {
      const its = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
      its.forEach(it => {
        const key = it.code || it.name;
        if (!map[key]) map[key] = {
          name: it.name,
          qty: 0,
          sum: 0
        };
        map[key].qty += Number(it.qty) || 0;
        map[key].sum += (Number(it.qty) || 0) * (Number(it.price) || 0);
      });
    });
    return Object.values(map).sort((a, b) => b.sum - a.sum);
  }, [periodOrders]);
  const dateRangeInputs = /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, [["day", "День"], ["week", "Неделя"], ["month", "Месяц"], ["custom", "Свободный отбор"]].map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => applyStorePreset(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${storePreset === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: storePreset === k ? C.navy : C.white,
      color: storePreset === k ? C.white : C.textMid
    }
  }, lb))), storePreset === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u0421"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: storeDateFrom,
    onChange: e => setStoreDateFrom(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u041F\u043E"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: storeDateTo,
    onChange: e => setStoreDateTo(e.target.value)
  }))));
  const filterChips = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 16,
      flexWrap: "wrap"
    }
  }, STORE_FILTERS.map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setFilter(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${filter === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: filter === k ? C.navy : C.white,
      color: filter === k ? C.white : C.textMid
    }
  }, lb)));
  const ordersTable = /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: R,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["№", "Дата", "Адрес / время", "Позиций", "Сумма", "Оплата", "Водитель", "Статус"].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: S.th
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filteredOrders.map(o => {
    const payment = {
      cash: o.payment_cash || 0,
      qr: o.payment_qr || 0,
      debt: o.payment_debt || 0
    };
    const its = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
    return /*#__PURE__*/React.createElement("tr", {
      key: o.id,
      className: "rowh",
      onClick: () => setSelectedOrder(o),
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        ...S.td,
        fontFamily: FH,
        fontWeight: 800
      }
    }, o.id), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, o.date), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.textSub
      }
    }, o.address), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.textFaint
      }
    }, o.time_slot)), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, its.length), /*#__PURE__*/React.createElement("td", {
      style: {
        ...S.td,
        fontFamily: FH,
        fontWeight: 800,
        whiteSpace: "nowrap"
      }
    }, (o.total || 0).toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, /*#__PURE__*/React.createElement(PaymentTags, {
      payment: payment
    })), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, o.driver_name || /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.textSub,
        fontStyle: "italic",
        fontSize: 15
      }
    }, "\u2014")), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, /*#__PURE__*/React.createElement(StatusBadge, {
      status: o.status
    })));
  }), filteredOrders.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "8",
    style: {
      ...S.td,
      textAlign: "center",
      color: C.textFaint,
      padding: "40px 0"
    }
  }, "\u0417\u0430\u043A\u0430\u0437\u043E\u0432 \u043D\u0435\u0442"))))));

  // ===== "Новый заказ" — каталог в стиле кассы (см. CashierCabinet): большая
  // сетка товаров слева, липкая колонка адреса/корзины/оформления справа на
  // десктопе. На мобильном остаётся прежний порядок карточек друг под другом.
  const newOrderAddressCard = /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u0410\u0434\u0440\u0435\u0441 \u0438 \u043A\u043E\u043D\u0442\u0430\u043A\u0442"), /*#__PURE__*/React.createElement("button", {
    style: {
      background: "transparent",
      border: "none",
      color: C.navy,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      padding: 0
    },
    onClick: () => setTab("profile")
  }, "\u0418\u0437\u043C\u0435\u043D\u0438\u0442\u044C")), profileComplete ? /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.textMid,
      lineHeight: 1.5
    }
  }, address, /*#__PURE__*/React.createElement("br", null), contactName && /*#__PURE__*/React.createElement(React.Fragment, null, contactName, ", "), contactPhone) : /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.textFaint,
      fontStyle: "italic"
    }
  }, "\u041D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043E")), /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u0412\u0440\u0435\u043C\u044F \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, TIME_SLOTS.map(slot => /*#__PURE__*/React.createElement("button", {
    key: slot,
    onClick: () => setTimeSlot(slot),
    style: {
      padding: "12px",
      borderRadius: 10,
      border: `1.5px solid ${timeSlot === slot ? C.navy : C.border}`,
      background: timeSlot === slot ? C.navy : C.white,
      color: timeSlot === slot ? C.white : C.textMid,
      fontSize: 16,
      fontWeight: 500,
      cursor: "pointer",
      textAlign: "left"
    }
  }, slot)))));
  const newOrderCatalogCard = /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041A\u0430\u0442\u0430\u043B\u043E\u0433 ", products.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.green,
      fontWeight: 400,
      fontSize: 13
    }
  }, "(", products.length, " \u043F\u043E\u0437.)")), filledLines.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 700,
      color: C.navy,
      background: C.surface,
      padding: "4px 10px",
      borderRadius: 99,
      whiteSpace: "nowrap"
    }
  }, "\uD83D\uDED2 ", filledLines.length)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      flex: 1,
      minWidth: 160
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043A\u043E\u0434\u0443 \u0438\u043B\u0438 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443...",
    value: catalogSearch,
    onChange: e => setCatalogSearch(e.target.value),
    autoComplete: "off",
    name: "catalog-search"
  }), /*#__PURE__*/React.createElement("select", {
    style: {
      ...S.select,
      width: "auto"
    },
    value: catalogSort,
    onChange: e => setCatalogSort(e.target.value)
  }, /*#__PURE__*/React.createElement("option", {
    value: "name_asc"
  }, "\u041F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E"), /*#__PURE__*/React.createElement("option", {
    value: "group"
  }, "\u041F\u043E \u043E\u0442\u0434\u0435\u043B\u0430\u043C"))), categories.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCatalogCategory(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${catalogCategory === "" ? C.navy : C.border}`,
      background: catalogCategory === "" ? C.navy : C.white,
      color: catalogCategory === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435"), categories.map(cat => /*#__PURE__*/React.createElement("button", {
    key: cat,
    onClick: () => setCatalogCategory(cat),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${catalogCategory === cat ? C.navy : C.border}`,
      background: catalogCategory === cat ? C.navy : C.white,
      color: catalogCategory === cat ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, cat))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: desktop ? "repeat(auto-fill, minmax(150px,1fr))" : "1fr 1fr",
      gap: 10
    }
  }, filteredCatalog.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1/-1",
      textAlign: "center",
      padding: "28px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, products.length === 0 ? "Товары ещё не загружены" : "Ничего не найдено"), filteredCatalog.map(p => {
    const outOfStock = stockIsOut(p);
    const lowStock = !outOfStock && !p.priced_by_weight && p.stock !== null && p.stock !== undefined && p.stock <= 5;
    const inCart = lines.find(l => l.productId === p.id);
    return /*#__PURE__*/React.createElement("div", {
      key: p.id,
      style: {
        border: `1px solid ${C.border}`,
        borderRadius: R,
        overflow: "hidden",
        background: C.white,
        opacity: outOfStock ? 0.55 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        position: "relative",
        aspectRatio: "1",
        background: C.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 8,
        boxSizing: "border-box"
      }
    }, p.photo ? /*#__PURE__*/React.createElement("img", {
      src: p.photo,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "contain"
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 26,
        color: C.textFaint
      }
    }, "\uD83D\uDCE6"), lowStock && /*#__PURE__*/React.createElement("span", {
      style: {
        position: "absolute",
        top: 6,
        left: 6,
        background: "#FEF3C7",
        color: C.amber,
        fontSize: 11,
        fontWeight: 700,
        padding: "3px 7px",
        borderRadius: 99
      }
    }, "\u041E\u0441\u0442\u0430\u043B\u043E\u0441\u044C ", p.stock)), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 10px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 600,
        color: C.text,
        marginBottom: 6,
        minHeight: 32,
        lineHeight: 1.3
      }
    }, p.name), outOfStock ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.red,
        textAlign: "center",
        padding: "7px 0"
      }
    }, "\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438") : inCart ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: C.surface,
        borderRadius: 8,
        padding: "3px"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const nextQty = (Number(inCart.qty) || 0) - 1;
        if (nextQty <= 0) removeLine(inCart.uid);else updateLine(inCart.uid, {
          qty: String(nextQty)
        });
      },
      style: {
        width: 26,
        height: 26,
        border: "none",
        borderRadius: 6,
        background: C.white,
        boxShadow: `0 0 0 1px ${C.border}`,
        fontSize: 17,
        fontWeight: 700,
        color: C.navy,
        cursor: "pointer"
      }
    }, "\u2212"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 800,
        color: C.navy
      }
    }, inCart.qty || 0), /*#__PURE__*/React.createElement("button", {
      onClick: () => {
        const nextQty = (Number(inCart.qty) || 0) + 1;
        const availP = stockAmount(p);
        updateLine(inCart.uid, {
          qty: String(availP != null ? Math.min(nextQty, availP) : nextQty)
        });
      },
      style: {
        width: 26,
        height: 26,
        border: "none",
        borderRadius: 6,
        background: C.white,
        boxShadow: `0 0 0 1px ${C.border}`,
        fontSize: 17,
        fontWeight: 700,
        color: C.navy,
        cursor: "pointer"
      }
    }, "+")) : /*#__PURE__*/React.createElement("button", {
      onClick: () => addProductToCart(p),
      style: {
        width: "100%",
        padding: "7px",
        border: "none",
        borderRadius: 8,
        background: C.navy,
        color: C.white,
        fontSize: 14,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C")));
  })));
  const newOrderCartCard = filledLines.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 10,
      display: "block"
    }
  }, "\u041A\u043E\u0440\u0437\u0438\u043D\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 52px 26px",
      gap: 6,
      marginBottom: 6
    }
  }, ["Товар", "Кол-во", ""].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 12,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, h))), lines.filter(l => l.productId).map(line => /*#__PURE__*/React.createElement("div", {
    key: line.uid,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 52px 26px",
      gap: 6,
      alignItems: "center",
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      color: C.textMid
    }
  }, line.name), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "6px 4px",
      fontSize: 14,
      textAlign: "center"
    },
    type: "number",
    min: "1",
    max: line.stock != null ? line.stock : undefined,
    value: line.qty,
    onChange: e => {
      let v = e.target.value;
      if (line.stock != null && Number(v) > line.stock) v = String(line.stock);
      updateLine(line.uid, {
        qty: v
      });
    },
    onFocus: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeLine(line.uid),
    style: {
      width: 26,
      height: 30,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      background: C.surface,
      cursor: "pointer",
      fontSize: 15,
      color: C.textFaint
    }
  }, "\xD7"))));
  const newOrderCommentCard = /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439"), /*#__PURE__*/React.createElement("textarea", {
    style: S.textarea,
    value: comment,
    onChange: e => setComment(e.target.value),
    placeholder: "\u041E\u0441\u043E\u0431\u044B\u0435 \u043F\u043E\u0436\u0435\u043B\u0430\u043D\u0438\u044F..."
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      opacity: submitting || filledLines.length === 0 || !timeSlot || !contactPhone.trim() ? 0.45 : 1
    },
    onClick: handleSubmit,
    disabled: submitting || filledLines.length === 0 || !timeSlot || !contactPhone.trim()
  }, submitting ? "Отправка..." : "Отправить заказ"));
  const content = /*#__PURE__*/React.createElement(React.Fragment, null, tab === "orders" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u0417\u0430\u043A\u0430\u0437\u044B"), !desktop && /*#__PURE__*/React.createElement("button", {
    style: S.bigCreate,
    onClick: () => {
      window.history.pushState({
        view: 'new'
      }, '', '');
      setTab("new");
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: S.bigCreatePlus
  }, "+"), " \u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437"), submitted && /*#__PURE__*/React.createElement("div", {
    style: S.alertSuccess
  }, "\u0417\u0430\u043A\u0430\u0437 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D! \u041C\u0435\u043D\u0435\u0434\u0436\u0435\u0440 \u043D\u0430\u043F\u0440\u0430\u0432\u0438\u0442 \u0435\u0433\u043E \u0432 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0443."), dateRangeInputs, loading ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.statsRow,
      gridTemplateColumns: desktop ? "repeat(6, minmax(0,1fr))" : "1fr 1fr"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum()
  }, stats.total), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412\u0441\u0435\u0433\u043E")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.green)
  }, stats.delivered), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0414\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.amber)
  }, stats.inTransit), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412 \u0440\u0430\u0431\u043E\u0442\u0435")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.pending)
  }, stats.new), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u041D\u043E\u0432\u044B\u0445")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.red)
  }, stats.cancelled), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u041E\u0442\u043A\u0430\u0437")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum("#7C3AED")
  }, stats.returned), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412\u043E\u0437\u0432\u0440\u0430\u0442"))), filterChips, desktop ? ordersTable : filteredOrders.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDCCB"), /*#__PURE__*/React.createElement("p", null, "\u0417\u0430\u043A\u0430\u0437\u043E\u0432 \u043D\u0435\u0442")) : filteredOrders.map(o => /*#__PURE__*/React.createElement(OrderCard, {
    key: o.id,
    order: o,
    onOpen: setSelectedOrder
  })))), tab === "report" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041E\u0442\u0447\u0451\u0442 \u043E \u0437\u0430\u043A\u0443\u043F\u043A\u0430\u0445"), dateRangeInputs, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.revenueCard,
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: S.revenueLabel
  }, "\u041F\u043E\u0442\u0440\u0430\u0447\u0435\u043D\u043E \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.revenueNum,
      marginBottom: 14
    }
  }, stats.spent.toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8
    }
  }, [{
    label: "Наличка",
    val: stats.cashTotal,
    bg: C.cashGreen,
    col: "#15803D"
  }, {
    label: "QR код",
    val: stats.qrTotal,
    bg: C.qrBlue,
    col: "#1D4ED8"
  }, {
    label: "Долг",
    val: stats.debtTotal,
    bg: C.debtAmber,
    col: "#92400E"
  }].map(({
    label,
    val,
    bg,
    col
  }) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      background: bg,
      borderRadius: 10,
      padding: "10px 8px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: col,
      fontWeight: 700
    }
  }, label.toUpperCase()), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 800,
      fontFamily: FH,
      color: col
    }
  }, (val || 0).toLocaleString(), " \u20B8"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17,
      marginTop: 8
    }
  }, "\u041F\u043E \u0442\u043E\u0432\u0430\u0440\u0430\u043C"), productBreakdown.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "32px 0",
      color: C.textFaint
    }
  }, "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434") : productBreakdown.map((p, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, p.name), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, p.qty.toLocaleString(), " \u0448\u0442/\u043A\u0433")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, p.sum.toLocaleString(), " \u20B8")))))), tab === "new" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 14
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      margin: 0
    }
  }, "\u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437"), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => setTab("orders")
  }, "\u2190 \u041D\u0430\u0437\u0430\u0434")), !profileLoading && !profileComplete && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.alertSuccess,
      background: "#FEF3C7",
      color: "#92400E",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      gap: 10,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0430\u0434\u0440\u0435\u0441 \u0438 \u0442\u0435\u043B\u0435\u0444\u043E\u043D \u0432 \u043F\u0440\u043E\u0444\u0438\u043B\u0435 \u2014 \u0442\u043E\u0433\u0434\u0430 \u043D\u0435 \u043F\u0440\u0438\u0434\u0451\u0442\u0441\u044F \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u0438\u0445 \u0432 \u043A\u0430\u0436\u0434\u043E\u043C \u0437\u0430\u043A\u0430\u0437\u0435."), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      width: "auto",
      whiteSpace: "nowrap"
    },
    onClick: () => setTab("profile")
  }, "\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0444\u0438\u043B\u044C")), desktop ?
  /*#__PURE__*/
  // Каталог слева + липкая колонка адрес/корзина/оформление справа —
  // та же раскладка, что у кассы (CashierCabinet), чтобы магазин
  // видел чек и мог оформить продажу, не прокручивая страницу вниз.
  React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "minmax(0,1fr) 380px",
      gap: 16,
      alignItems: "start"
    }
  }, newOrderCatalogCard, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "sticky",
      top: 20,
      display: "flex",
      flexDirection: "column",
      gap: 16
    }
  }, newOrderAddressCard, newOrderCartCard, newOrderCommentCard)) : /*#__PURE__*/React.createElement(React.Fragment, null, newOrderAddressCard, newOrderCatalogCard, newOrderCartCard, newOrderCommentCard)), tab === "profile" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 480 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: C.textSub,
      marginTop: desktop ? 0 : -8,
      marginBottom: 14
    }
  }, "\u042D\u0442\u0438 \u0434\u0430\u043D\u043D\u044B\u0435 \u043F\u043E\u0434\u0441\u0442\u0430\u0432\u043B\u044F\u044E\u0442\u0441\u044F \u0432 \u043A\u0430\u0436\u0434\u044B\u0439 \u043D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437 \u2014 \u0437\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043E\u0434\u0438\u043D \u0440\u0430\u0437, \u0438 \u043D\u0435 \u043F\u0440\u0438\u0434\u0451\u0442\u0441\u044F \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u0438\u0445 \u0437\u0430\u043D\u043E\u0432\u043E."), profileLoading ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, profileSaved && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.alertSuccess,
      marginBottom: 14
    }
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E"), /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u0410\u0434\u0440\u0435\u0441 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438"), /*#__PURE__*/React.createElement("input", {
    style: S.input,
    placeholder: "\u0410\u0434\u0440\u0435\u0441",
    value: profileForm.address,
    onChange: e => setProfileForm(f => ({
      ...f,
      address: e.target.value
    }))
  })), /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u043D\u043E\u0435 \u043B\u0438\u0446\u043E"), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      marginBottom: 8
    },
    placeholder: "\u0418\u043C\u044F",
    value: profileForm.contactName,
    onChange: e => setProfileForm(f => ({
      ...f,
      contactName: e.target.value
    }))
  }), /*#__PURE__*/React.createElement("input", {
    style: S.input,
    placeholder: "\u0422\u0435\u043B\u0435\u0444\u043E\u043D",
    value: profileForm.contactPhone,
    onChange: e => setProfileForm(f => ({
      ...f,
      contactPhone: e.target.value
    }))
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      opacity: savingProfile || !profileForm.contactPhone.trim() ? 0.45 : 1
    },
    onClick: saveProfile,
    disabled: savingProfile || !profileForm.contactPhone.trim()
  }, savingProfile ? "Сохранение..." : "Сохранить")))));
  if (desktop) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        minHeight: "100vh",
        background: C.surface,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement(AutofillDecoy, null), selectedOrder && /*#__PURE__*/React.createElement(OrderDetail, {
      order: selectedOrder,
      onClose: () => setSelectedOrder(null),
      onUpdateStatus: handleUpdateStatus,
      currentUser: user
    }), /*#__PURE__*/React.createElement("aside", {
      style: S.side
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 34
      }
    }, /*#__PURE__*/React.createElement(Brand, {
      size: 44
    })), /*#__PURE__*/React.createElement("nav", {
      style: {
        flex: 1
      }
    }, STORE_TABS.map(([k, ic, lb]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      style: S.sideLink(tab === k),
      onClick: () => setTab(k)
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18
      }
    }, ic), lb))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "#8B8681",
        lineHeight: 1.6
      }
    }, "\u041C\u0430\u0433\u0430\u0437\u0438\u043D \xB7 ", user.name, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("button", {
      style: {
        background: "transparent",
        border: `1px solid ${C.border}`,
        color: C.textMid,
        padding: "6px 14px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 14,
        marginTop: 8
      },
      onClick: onLogout
    }, "\u0412\u044B\u0439\u0442\u0438"))), /*#__PURE__*/React.createElement("main", {
      style: S.main
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.row,
        marginBottom: 22,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("h1", {
      style: S.h1
    }, STORE_TAB_TITLES[tab]), /*#__PURE__*/React.createElement("div", {
      style: S.h1sub
    }, new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }))), tab !== "new" && /*#__PURE__*/React.createElement("button", {
      style: {
        ...S.btnPrimary,
        width: "auto",
        padding: "12px 20px",
        marginTop: 0,
        boxShadow: "none"
      },
      onClick: () => setTab("new")
    }, "+ \u041D\u043E\u0432\u044B\u0439 \u0437\u0430\u043A\u0430\u0437")), content));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 72
    }
  }, selectedOrder && /*#__PURE__*/React.createElement(OrderDetail, {
    order: selectedOrder,
    onClose: () => setSelectedOrder(null),
    onUpdateStatus: handleUpdateStatus,
    currentUser: user
  }), /*#__PURE__*/React.createElement("div", {
    style: S.page
  }, content), /*#__PURE__*/React.createElement("div", {
    style: S.nav
  }, STORE_TABS.map(([k, ic, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    style: {
      ...S.navBtn(tab === k),
      flex: 1
    },
    onClick: () => setTab(k)
  }, /*#__PURE__*/React.createElement("span", {
    style: S.navIcon
  }, ic), /*#__PURE__*/React.createElement("span", {
    style: S.navLabel(tab === k)
  }, lb)))));
}
function DriverCabinet({
  user,
  onLogout
}) {
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
    } catch (e) {
      if (e.message.includes('токен')) onLogout();
    }
    setLoading(false);
  }, []);

  // Сдача налички складу (инкассация) — см. POST /api/cash-handovers.
  // Сумма считается на сервере из тех же orders, что уже загружены здесь
  // (для мгновенного отображения без лишнего запроса), но окончательное
  // решение — за сервером: тот же расчёт там продублирован намеренно.
  const [cashHandovers, setCashHandovers] = useState([]);
  const loadCashHandovers = useCallback(async () => {
    try {
      setCashHandovers(await apiCall('GET', '/api/cash-handovers'));
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadCashHandovers();
  }, []);
  useRefetchOnVisible(loadCashHandovers);
  const [handingOver, setHandingOver] = useState(false);
  const pendingCashOrders = orders.filter(o => o.driver_id === user.id && o.status === "delivered" && (Number(o.payment_cash) || 0) > 0 && !o.cash_handover_id);
  const pendingCashAmount = pendingCashOrders.reduce((s, o) => s + (Number(o.payment_cash) || 0), 0);
  const handOverCash = async () => {
    if (handingOver || pendingCashAmount <= 0) return;
    if (!window.confirm(`Сдать складу ${pendingCashAmount.toLocaleString()} ₸? Склад пересчитает и подтвердит фактическую сумму.`)) return;
    setHandingOver(true);
    try {
      await apiCall('POST', '/api/cash-handovers', {});
      loadOrders();
      loadCashHandovers();
    } catch (e) {
      alert(e.message);
    }
    setHandingOver(false);
  };
  useEffect(() => {
    loadOrders();
  }, []);
  useRefetchOnVisible(loadOrders);
  const handleUpdate = async (id, status, payment) => {
    try {
      await apiCall('PUT', `/api/orders/${id}/status`, {
        status,
        payment
      });
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
  };
  const todayStr = new Date().toISOString().slice(0, 10);
  const [driverDateFrom, setDriverDateFrom] = useState(todayStr);
  const [driverDateTo, setDriverDateTo] = useState(todayStr);
  const [driverPreset, setDriverPreset] = useState("day");
  const applyDriverPreset = preset => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);else if (preset === "month") from.setDate(now.getDate() - 29);
    setDriverPreset(preset);
    if (preset !== "custom") {
      setDriverDateFrom(from.toISOString().slice(0, 10));
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
  // видна в queueActive/myActive — иначе подтвердить её "Доставлено"
  // (единственный путь для этого — DriverPaymentBlock у назначенного
  // водителя, см. ниже) стало бы физически некому: у admin/manager в
  // OrderDetail для in_transit нет своей кнопки завершения.
  const queueAll = orders.filter(o => o.status === "new" && o.source !== "store" && o.time_slot !== PICKUP_SLOT || o.status === "in_transit");
  const queueNew = orders.filter(o => o.status === "new" && o.source !== "store" && o.time_slot !== PICKUP_SLOT);
  const queueActive = orders.filter(o => o.status === "in_transit");
  const myActive = orders.filter(o => o.status === "in_transit" && o.driver_id === user.id);
  const myDoneAll = orders.filter(o => o.driver_id === user.id && o.date >= driverDateFrom && o.date <= driverDateTo && ["delivered", "cancelled", "returned"].includes(o.status));
  const myDelivered = myDoneAll.filter(o => o.status === "delivered");
  const myCancelled = myDoneAll.filter(o => o.status === "cancelled");
  const myReturned = myDoneAll.filter(o => o.status === "returned");
  const combinedAll = [...queueAll, ...myDoneAll].sort((a, b) => b.id - a.id);
  const FILTERS = [["all", "Все"], ["new", "Ожидает"], ["in_transit", "В работе"], ["delivered", "Доставлено"], ["cancelled", "Отказ"], ["returned", "Возврат"]];
  const filterShown = filter === "all" ? combinedAll : filter === "new" ? queueNew : filter === "in_transit" ? queueActive : filter === "delivered" ? myDelivered : filter === "cancelled" ? myCancelled : myReturned;
  const [showMyClients, setShowMyClients] = useState(false);
  const myCashTotal = myDelivered.reduce((s, o) => s + (o.payment_cash || 0), 0);
  const myQrTotal = myDelivered.reduce((s, o) => s + (o.payment_qr || 0), 0);
  const myDebtTotal = myDelivered.reduce((s, o) => s + (o.payment_debt || 0), 0);
  const myClientBreakdown = {};
  myDelivered.forEach(o => {
    const key = o.client_name;
    if (!myClientBreakdown[key]) myClientBreakdown[key] = {
      name: o.client_name,
      cash: 0,
      qr: 0,
      debt: 0
    };
    myClientBreakdown[key].cash += o.payment_cash || 0;
    myClientBreakdown[key].qr += o.payment_qr || 0;
    myClientBreakdown[key].debt += o.payment_debt || 0;
  });
  const myClientList = Object.values(myClientBreakdown).sort((a, b) => b.cash + b.qr + b.debt - (a.cash + a.qr + a.debt));
  const driverDateFilter = /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, [["day", "День"], ["week", "Неделя"], ["month", "Месяц"], ["custom", "Свободный отбор"]].map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => applyDriverPreset(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${driverPreset === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: driverPreset === k ? C.navy : C.white,
      color: driverPreset === k ? C.white : C.textMid
    }
  }, lb))), driverPreset === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u0421"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: driverDateFrom,
    onChange: e => setDriverDateFrom(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u041F\u043E"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: driverDateTo,
    onChange: e => setDriverDateTo(e.target.value)
  }))));
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 72
    }
  }, selectedOrder && /*#__PURE__*/React.createElement(OrderDetail, {
    order: selectedOrder,
    onClose: () => setSelectedOrder(null),
    onUpdateStatus: handleUpdate,
    currentUser: user
  }), showReturnModal && /*#__PURE__*/React.createElement(ReturnFormModal, {
    user: user,
    onClose: () => setShowReturnModal(false),
    onCreated: loadOrders
  }), /*#__PURE__*/React.createElement("div", {
    style: S.page
  }, tab === "queue" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: S.statsRow
  }, /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.pending)
  }, queueNew.length), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u041E\u0436\u0438\u0434\u0430\u044E\u0442")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.amber)
  }, queueActive.length), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412 \u0440\u0430\u0431\u043E\u0442\u0435"))), /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u0417\u0430\u044F\u0432\u043A\u0438"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowReturnModal(true),
    style: {
      ...S.btnOutline,
      borderColor: "#7C3AED",
      color: "#7C3AED",
      marginTop: 0,
      marginBottom: 14
    }
  }, "\u21A9\uFE0F \u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442"), myActive.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => printLoadingList(myActive, user.name),
    style: {
      width: "100%",
      marginBottom: 14,
      padding: "12px",
      background: C.navy,
      color: C.white,
      border: "none",
      borderRadius: 10,
      fontSize: 16,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "\uD83E\uDDFE \u0417\u0430\u0433\u0440\u0443\u0437\u043E\u0447\u043D\u044B\u0439 \u043B\u0438\u0441\u0442 (", myActive.length, " ", myActive.length === 1 ? 'заявка' : 'заявок', ")"), driverDateFilter, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 16,
      flexWrap: "wrap"
    }
  }, FILTERS.map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setFilter(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${filter === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: filter === k ? C.navy : C.white,
      color: filter === k ? C.white : C.textMid
    }
  }, lb))), loading ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : filterShown.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDE97"), /*#__PURE__*/React.createElement("p", null, "\u041D\u0435\u0442 \u0437\u0430\u044F\u0432\u043E\u043A")) : filterShown.map(o => /*#__PURE__*/React.createElement("div", {
    key: o.id,
    style: {
      ...S.card,
      cursor: "pointer",
      borderLeft: `4px solid ${SC[o.status] || '#999'}`
    },
    onClick: () => setSelectedOrder(o)
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      marginRight: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, "\u2116 ", o.id, " \xB7 ", o.client_name), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, o.address), /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.cardSub,
      marginTop: 2
    }
  }, "\uD83D\uDD50 ", o.time_slot, " \xB7 ", o.sales_name)), /*#__PURE__*/React.createElement(StatusBadge, {
    status: o.status
  })), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 4px",
      fontSize: 15,
      color: C.textSub
    }
  }, "\u0421\u0443\u043C\u043C\u0430: ", /*#__PURE__*/React.createElement("b", {
    style: {
      color: C.text,
      fontFamily: FH
    }
  }, (o.total || 0).toLocaleString(), " \u20B8")), o.status === "new" && /*#__PURE__*/React.createElement("button", {
    onClick: e => {
      e.stopPropagation();
      handleUpdate(o.id, "in_transit", null);
    },
    style: {
      marginTop: 10,
      width: "100%",
      padding: "11px",
      background: C.navy,
      color: C.white,
      border: "none",
      borderRadius: 10,
      fontSize: 15,
      fontWeight: 700,
      cursor: "pointer"
    }
  }, "\uD83D\uDE9A \u0412\u0437\u044F\u0442\u044C \u0432 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0443")))), tab === "cashbox" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginBottom: 16,
      background: pendingCashAmount > 0 ? C.cashGreen : C.surface
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: pendingCashAmount > 0 ? 8 : 0
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      fontWeight: 700,
      color: pendingCashAmount > 0 ? "#15803D" : C.textFaint,
      textTransform: "uppercase"
    }
  }, "\u041D\u0430\u043B\u0438\u0447\u043A\u0430 \u043D\u0430 \u0440\u0443\u043A\u0430\u0445"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "2px 0 0",
      fontSize: 22,
      fontWeight: 800,
      fontFamily: FH,
      color: pendingCashAmount > 0 ? "#15803D" : C.textSub
    }
  }, pendingCashAmount.toLocaleString(), " \u20B8")), pendingCashAmount > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: handOverCash,
    disabled: handingOver,
    style: {
      ...S.btnPrimary,
      width: "auto",
      marginTop: 0,
      boxShadow: "none",
      padding: "11px 18px",
      opacity: handingOver ? 0.6 : 1
    }
  }, handingOver ? "Оформляю..." : "💰 Сдать наличку")), pendingCashAmount > 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13,
      color: "#15803D"
    }
  }, pendingCashOrders.length, " ", pendingCashOrders.length === 1 ? 'доставленная заявка' : 'доставленных заявок', " \u0441 \u043E\u043F\u043B\u0430\u0442\u043E\u0439 \u043D\u0430\u043B\u043E\u043C \u0435\u0449\u0451 \u043D\u0435 \u0441\u0434\u0430\u043D\u044B \u0441\u043A\u043B\u0430\u0434\u0443")), cashHandovers.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17
    }
  }, "\u041C\u043E\u0438 \u0441\u0434\u0430\u0447\u0438 \u043D\u0430\u043B\u0438\u0447\u043A\u0438"), cashHandovers.map(h => /*#__PURE__*/React.createElement("div", {
    key: h.id,
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: C.textSub
    }
  }, h.date), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      padding: "3px 9px",
      borderRadius: 99,
      background: h.status === "pending" ? "#FFFBEB" : h.difference < 0 ? C.redSoft : "#EAF5EE",
      color: h.status === "pending" ? "#92400E" : h.difference < 0 ? C.red : C.green
    }
  }, h.status === "pending" ? "⏳ Ожидает" : h.difference < 0 ? `Недостача ${Math.abs(h.difference).toLocaleString()} ₸` : h.difference > 0 ? `Излишек ${h.difference.toLocaleString()} ₸` : "✓ Сошлось")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 15
    }
  }, "\u041E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C: ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: FH
    }
  }, h.expected_amount.toLocaleString(), " \u20B8"), h.status === "confirmed" && /*#__PURE__*/React.createElement(React.Fragment, null, " \xB7 \u041F\u0440\u0438\u043D\u044F\u0442\u043E: ", /*#__PURE__*/React.createElement("b", {
    style: {
      fontFamily: FH
    }
  }, h.actual_amount.toLocaleString(), " \u20B8"))), h.comment && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "4px 0 0",
      fontSize: 13,
      color: C.textFaint
    }
  }, h.comment)))), /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041A\u0430\u0441\u0441\u0430 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434"), driverDateFilter, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.cashGreen,
      borderRadius: 10,
      padding: "10px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: "#15803D",
      fontWeight: 600
    }
  }, "\u041D\u0410\u041B\u0418\u0427\u041A\u0410"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: "#15803D"
    }
  }, myCashTotal.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.qrBlue,
      borderRadius: 10,
      padding: "10px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: "#1D4ED8",
      fontWeight: 600
    }
  }, "QR"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: "#1D4ED8"
    }
  }, myQrTotal.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.debtAmber,
      borderRadius: 10,
      padding: "10px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: "#92400E",
      fontWeight: 600
    }
  }, "\u0414\u041E\u041B\u0413"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: "#92400E"
    }
  }, myDebtTotal.toLocaleString(), " \u20B8"))), myClientList.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      cursor: "pointer",
      marginBottom: 8
    },
    onClick: () => setShowMyClients(s => !s)
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17,
      margin: 0
    }
  }, "\u041F\u043E \u0442\u043E\u0447\u043A\u0430\u043C \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      color: C.textFaint
    }
  }, showMyClients ? "▲ Свернуть" : "▼ Показать")), showMyClients && myClientList.map((c, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, c.name), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: "#15803D"
    }
  }, "\u041D\u0430\u043B: ", c.cash.toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: "#1D4ED8"
    }
  }, "QR: ", c.qr.toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: "#92400E"
    }
  }, "\u0414\u043E\u043B\u0433: ", c.debt.toLocaleString(), " \u20B8"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(DebtsPanel, {
    readOnly: true
  })))), /*#__PURE__*/React.createElement("div", {
    style: S.nav
  }, [["queue", "📋", "Заявки"], ["cashbox", "💰", "Касса"]].map(([k, ic, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    style: {
      ...S.navBtn(tab === k),
      flex: 1
    },
    onClick: () => setTab(k)
  }, /*#__PURE__*/React.createElement("span", {
    style: S.navIcon
  }, ic), /*#__PURE__*/React.createElement("span", {
    style: S.navLabel(tab === k)
  }, lb)))));
}

// Мемоизированная карточка товара для вкладки "Товары" (псевдонимы/цены).
// Раньше все карточки рендерились заново на каждое нажатие клавиши в любом
// поле — из-за этого набор текста подтормаживал, особенно когда открыт список
// из 150+ позиций. React.memo + стабильные (useCallback) колбэки в
// AdminCabinet означают, что перерисовывается только та карточка, в которой
// реально поменялось значение.
const ProductAliasCard = memo(function ProductAliasCard({
  p,
  locked,
  saving,
  alias,
  price1,
  price2,
  price3,
  commission,
  cost,
  pricedByWeight,
  avgBoxWeight,
  onChange,
  onEditRequest,
  onSave
}) {
  return /*#__PURE__*/React.createElement("div", {
    id: `product-card-${p.code}`,
    style: {
      ...S.card,
      padding: 10,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 10,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      width: 52,
      height: 52,
      borderRadius: 8,
      flex: "none",
      overflow: "hidden",
      background: C.surface,
      border: `1px solid ${C.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, p.photo ? /*#__PURE__*/React.createElement("img", {
    src: p.photo,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "cover"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 20,
      color: C.textFaint
    }
  }, "\uD83D\uDCF7")), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.textFaint,
      marginBottom: 2
    }
  }, "\u041A\u043E\u0434 1\u0421: ", p.code, " ", p.group ? ' · ' + p.group : ''), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.textMid
    }
  }, p.name))), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 10px",
      fontSize: 15,
      marginBottom: 6,
      background: locked ? C.surface : C.white,
      color: locked ? C.textSub : C.text
    },
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0434\u043B\u044F \u0441\u0430\u0439\u0442\u0430 (\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)",
    disabled: locked,
    value: alias,
    onChange: e => onChange(p.code, 'alias', e.target.value)
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      marginBottom: 6,
      cursor: locked ? "default" : "pointer",
      fontSize: 14,
      color: locked ? C.textFaint : C.textMid
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    disabled: locked,
    checked: pricedByWeight,
    onChange: e => onChange(p.code, 'priced_by_weight', e.target.checked)
  }), "\u0412\u0435\u0441\u043E\u0432\u043E\u0439 \u0442\u043E\u0432\u0430\u0440 (\u0446\u0435\u043D\u0430 \u0437\u0430 \u043A\u0433, \u043A\u043E\u043B-\u0432\u043E \u0432 \u0437\u0430\u044F\u0432\u043A\u0435 \u2014 \u0434\u043E \u0444\u0430\u043A\u0442. \u0432\u0437\u0432\u0435\u0448\u0438\u0432\u0430\u043D\u0438\u044F \u043D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435)"), pricedByWeight && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 8,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: locked ? C.textFaint : C.textMid,
      whiteSpace: "nowrap"
    }
  }, "\u0421\u0440\u0435\u0434\u043D\u0438\u0439 \u0432\u0435\u0441 \u043A\u043E\u0440\u043E\u0431\u0430, \u043A\u0433"), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      width: 80,
      padding: "6px 8px",
      fontSize: 14,
      textAlign: "center",
      background: locked ? C.surface : C.white,
      color: locked ? C.textSub : C.text
    },
    placeholder: "\u043A\u0433",
    type: "number",
    disabled: locked,
    value: avgBoxWeight,
    onFocus: e => e.target.select(),
    onChange: e => onChange(p.code, 'avg_box_weight', e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 12,
      color: C.textFaint
    }
  }, "\u0434\u043B\u044F \u043E\u0446\u0435\u043D\u043A\u0438 \u043A\u043E\u043B-\u0432\u0430 \u043A\u043E\u0440\u043E\u0431\u043E\u0432 \u043F\u043E \u043A\u0433-\u043E\u0441\u0442\u0430\u0442\u043A\u0443 (\u0432\u0435\u0441 \u043A\u0430\u0436\u0434\u044B\u0439 \u0440\u0430\u0437 \u0440\u0430\u0437\u043D\u044B\u0439, \u044D\u0442\u043E \u043F\u0440\u0438\u043A\u0438\u0434\u043A\u0430)")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr 1fr 70px auto",
      gap: 6,
      marginBottom: 1
    }
  }, ["Цена 1", "Цена 2", "Цена 3", "Закупка", "₸ торговому", ""].map((h, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    style: {
      fontSize: 11,
      fontWeight: 600,
      color: C.textFaint,
      textTransform: "uppercase"
    }
  }, h))), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 12,
      color: C.textFaint,
      marginBottom: 4
    }
  }, "\u0426\u0435\u043D\u0430 1 \u2014 \u0432\u0438\u0434\u044F\u0442 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u044B \u0432 \u0441\u0432\u043E\u0451\u043C \u043A\u0430\u0431\u0438\u043D\u0435\u0442\u0435. \u0426\u0435\u043D\u0430 2/3 \u2014 \u043D\u0430 \u0432\u044B\u0431\u043E\u0440 \u0442\u043E\u0440\u0433\u043E\u0432\u043E\u0433\u043E \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043B\u044F. \u0417\u0430\u043A\u0443\u043F\u043A\u0430 \u2014 \u0434\u043B\u044F \u0440\u0430\u0441\u0447\u0451\u0442\u0430 \u043F\u0440\u0438\u0431\u044B\u043B\u0438 \u0432 \u043E\u0442\u0447\u0451\u0442\u0430\u0445, \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044C \u0435\u0451 \u043D\u0435 \u0432\u0438\u0434\u0438\u0442."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 8px",
      fontSize: 14,
      background: locked ? C.surface : C.white,
      color: locked ? C.textSub : C.text
    },
    placeholder: "\u0426\u0435\u043D\u0430 1",
    type: "number",
    disabled: locked,
    value: price1,
    onFocus: e => e.target.select(),
    onChange: e => onChange(p.code, 'price1', e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 8px",
      fontSize: 14,
      background: locked ? C.surface : C.white,
      color: locked ? C.textSub : C.text
    },
    placeholder: "\u0426\u0435\u043D\u0430 2",
    type: "number",
    disabled: locked,
    value: price2,
    onFocus: e => e.target.select(),
    onChange: e => onChange(p.code, 'price2', e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 8px",
      fontSize: 14,
      background: locked ? C.surface : C.white,
      color: locked ? C.textSub : C.text
    },
    placeholder: "\u0426\u0435\u043D\u0430 3",
    type: "number",
    disabled: locked,
    value: price3,
    onFocus: e => e.target.select(),
    onChange: e => onChange(p.code, 'price3', e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 8px",
      fontSize: 14,
      background: locked ? C.surface : "#F0F9F4",
      color: locked ? C.textSub : "#157E3C",
      fontWeight: 600
    },
    placeholder: "\u0417\u0430\u043A\u0443\u043F\u043A\u0430",
    type: "number",
    disabled: locked,
    value: cost,
    onFocus: e => e.target.select(),
    onChange: e => onChange(p.code, 'cost', e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: 70
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 20px 7px 8px",
      fontSize: 14,
      background: locked ? C.surface : "#FFFBEB",
      color: locked ? C.textSub : "#92400E",
      fontWeight: 700,
      borderColor: locked ? C.border : "#FDE68A",
      width: 70
    },
    placeholder: "0",
    type: "number",
    disabled: locked,
    value: commission,
    onFocus: e => e.target.select(),
    onChange: e => onChange(p.code, 'commission', e.target.value)
  }), /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      right: 8,
      top: "50%",
      transform: "translateY(-50%)",
      fontSize: 14,
      fontWeight: 700,
      color: locked ? C.textFaint : "#92400E",
      pointerEvents: "none"
    }
  }, "\u20B8")), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      padding: "7px 14px",
      fontSize: 14,
      marginTop: 0,
      boxShadow: "none",
      opacity: saving ? 0.5 : 1,
      width: "auto",
      whiteSpace: "nowrap"
    },
    disabled: saving,
    onClick: () => {
      if (locked) {
        onEditRequest(p.code);
      } else {
        onSave(p);
      }
    }
  }, locked ? "Редакт." : "Сохр.")));
});

// Экран "Товары" (псевдонимы/цены/себестоимость/комиссия) — тот же
// набор полей и логика сохранения, что у менеджера/админа (см. вкладку
// "aliases" в AdminCabinet), вынесен в отдельный самодостаточный
// компонент, чтобы его же мог открыть у себя старший торговый
// представитель (см. SalesCabinet), не дублируя код руками. Компонент
// сам грузит /api/products и сам знает, как сохранять правки — не
// делит состояние с AdminCabinet (та вкладка остаётся работать как
// была, отдельным куском состояния).
function ProductAliasesPanel({
  desktop
}) {
  const [products, setProducts] = useState([]);
  const [aliasSearch, setAliasSearch] = useState("");
  const [edits, setEdits] = useState({});
  const [savingCode, setSavingCode] = useState(null);
  const [editingCodes, setEditingCodes] = useState({});
  const [aliasSectionsOpen, setAliasSectionsOpen] = useState({
    unset: true,
    set: false
  });
  const loadProducts = useCallback(async () => {
    try {
      setProducts(await fetch('/api/products').then(r => r.json()));
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadProducts();
  }, []);
  useRefetchOnVisible(loadProducts);
  const getField = (p, field) => {
    if (edits[p.code] && edits[p.code][field] !== undefined) return edits[p.code][field];
    if (field === 'alias') return p.has_alias ? p.display_name : '';
    if (field === 'priced_by_weight') return !!p.priced_by_weight;
    return p[field] != null ? String(p[field]) : '';
  };
  const updateField = useCallback((code, field, value) => setEdits(e => ({
    ...e,
    [code]: {
      ...e[code],
      [field]: value
    }
  })), []);
  const onEditRequest = useCallback(code => setEditingCodes(e => ({
    ...e,
    [code]: true
  })), []);
  const editsRef = useRef(edits);
  useEffect(() => {
    editsRef.current = edits;
  }, [edits]);
  const saveAlias = useCallback(async p => {
    const code = p.code;
    const fieldsFromEdits = editsRef.current[code] || {};
    const resolve = field => fieldsFromEdits[field] !== undefined ? fieldsFromEdits[field] : field === 'alias' ? p.has_alias ? p.display_name : '' : field === 'priced_by_weight' ? !!p.priced_by_weight : p[field] != null ? String(p[field]) : '';
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
        code,
        alias,
        price1: price1 === '' ? null : Number(price1),
        price2: price2 === '' ? null : Number(price2),
        price3: price3 === '' ? null : Number(price3),
        commission: commission === '' ? 0 : Number(commission),
        cost: cost === '' ? null : Number(cost),
        priced_by_weight: !!pricedByWeight,
        avg_box_weight: avgBoxWeight === '' ? null : Number(avgBoxWeight)
      });
      await loadProducts();
      setEditingCodes(e => {
        const n = {
          ...e
        };
        delete n[code];
        return n;
      });
    } catch (e) {
      alert(e.message);
    }
    setSavingCode(null);
  }, [loadProducts]);
  const renderProductCard = p => {
    const locked = p.has_alias && !editingCodes[p.code];
    return /*#__PURE__*/React.createElement(ProductAliasCard, {
      key: p.code,
      p: p,
      locked: locked,
      saving: savingCode === p.code,
      alias: getField(p, 'alias'),
      price1: getField(p, 'price1'),
      price2: getField(p, 'price2'),
      price3: getField(p, 'price3'),
      commission: getField(p, 'commission'),
      cost: getField(p, 'cost'),
      pricedByWeight: getField(p, 'priced_by_weight'),
      avgBoxWeight: getField(p, 'avg_box_weight'),
      onChange: updateField,
      onEditRequest: onEditRequest,
      onSave: saveAlias
    });
  };

  // Та же защита от лишнего размонтирования карточек при вводе, что и в
  // AdminCabinet — обычная функция, а не JSX-компонент, см. её комментарий там.
  const renderAliasSection = ({
    id,
    title,
    badgeColor,
    list
  }) => {
    const open = !!aliasSectionsOpen[id];
    return /*#__PURE__*/React.createElement("div", {
      key: id,
      style: {
        ...S.card,
        padding: 0,
        marginBottom: 12,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      onClick: () => setAliasSectionsOpen(s => ({
        ...s,
        [id]: !s[id]
      })),
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "13px 14px",
        cursor: "pointer",
        background: C.surface
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        fontWeight: 700,
        color: C.navy,
        display: "flex",
        alignItems: "center",
        gap: 8
      }
    }, title, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: badgeColor,
        background: badgeColor + "22",
        padding: "2px 8px",
        borderRadius: 99
      }
    }, list.length)), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        color: C.textFaint
      }
    }, open ? "▲ Свернуть" : "▼ Развернуть")), open && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: 10,
        maxHeight: 520,
        overflowY: "auto",
        borderTop: `1px solid ${C.border}`
      }
    }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "20px 0",
        color: C.textFaint,
        fontSize: 15
      }
    }, aliasSearch.trim() ? "Ничего не найдено" : "Пусто") : list.map(renderProductCard)));
  };
  const q = aliasSearch.trim().toLowerCase();
  const filtered = products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.code || '').includes(q));
  const withoutAlias = filtered.filter(p => !p.has_alias);
  const withAlias = filtered.filter(p => p.has_alias);
  return /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u0442\u043E\u0432\u0430\u0440\u043E\u0432"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 720 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: C.textSub,
      marginTop: desktop ? 0 : -8,
      marginBottom: 12
    }
  }, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438\u0437 1\u0421 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438 \u043A \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0435 \u2014 \u0437\u0430\u0434\u0430\u0439 \u0437\u0434\u0435\u0441\u044C \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0435 \u0438\u043C\u044F, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0443\u0432\u0438\u0434\u044F\u0442 \u0442\u043E\u0440\u0433\u043F\u0440\u0435\u0434\u044B."), /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      marginBottom: 12
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u043A\u043E\u0434\u0443...",
    value: aliasSearch,
    onChange: e => setAliasSearch(e.target.value),
    autoComplete: "off",
    name: "alias-search"
  }), renderAliasSection({
    id: "unset",
    title: "⚠️ Цены не установлены",
    badgeColor: C.red,
    list: withoutAlias
  }), renderAliasSection({
    id: "set",
    title: "✅ Цены установлены",
    badgeColor: C.green,
    list: withAlias
  }), products.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, "\u041D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0438\u0437 1\u0421")));
}

// Экран "Остатки на складе" — тот же, что у зав. склада (см.
// WarehouseCabinet), вынесен в отдельный самодостаточный компонент по
// той же причине, что и ProductAliasesPanel выше: старшему торговому
// представителю нужен тот же экран у себя в кабинете.
function StockPanel() {
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);
  const loadProducts = useCallback(async () => {
    try {
      setProducts(await fetch('/api/products').then(r => r.json()));
    } catch (e) {}
    setLoadingProducts(false);
  }, []);
  useEffect(() => {
    loadProducts();
  }, []);
  useRefetchOnVisible(loadProducts);
  const stockStats = products.reduce((acc, p) => {
    acc.total++;
    if (p.stock != null && p.stock > 0) acc.inStock++;else acc.outOfStock++;
    return acc;
  }, {
    total: 0,
    inStock: 0,
    outOfStock: 0
  });
  const stockCategories = Array.from(new Set(products.map(p => p.group).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const q = stockSearch.trim().toLowerCase();
  const filteredProducts = products.filter(p => !q || (p.display_name || p.name || '').toLowerCase().includes(q) || (p.code || '').includes(q)).filter(p => !stockCategory || p.group === stockCategory).filter(p => !hideEmpty || p.stock != null && p.stock > 0).slice().sort((a, b) => {
    const aOut = !(a.stock > 0),
      bOut = !(b.stock > 0);
    if (aOut !== bOut) return aOut ? 1 : -1;
    return (a.display_name || a.name || '').localeCompare(b.display_name || b.name || '');
  });
  return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435 ", /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 400,
      fontSize: 13,
      color: C.textFaint
    }
  }, "(\u0442\u043E\u043B\u044C\u043A\u043E \u0438\u0437 1\u0421)")), !loadingProducts && products.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: S.statsRow
  }, /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum()
  }, stockStats.total), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412\u0441\u0435\u0433\u043E \u043F\u043E\u0437\u0438\u0446\u0438\u0439")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.green)
  }, stockStats.inStock), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412 \u043D\u0430\u043B\u0438\u0447\u0438\u0438")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.red)
  }, stockStats.outOfStock), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438"))), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      marginBottom: 12
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u043A\u043E\u0434\u0443...",
    value: stockSearch,
    onChange: e => setStockSearch(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, stockCategories.length > 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStockCategory(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${stockCategory === "" ? C.navy : C.border}`,
      background: stockCategory === "" ? C.navy : C.white,
      color: stockCategory === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B"), stockCategories.map(cat => /*#__PURE__*/React.createElement("button", {
    key: cat,
    onClick: () => setStockCategory(cat),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${stockCategory === cat ? C.navy : C.border}`,
      background: stockCategory === cat ? C.navy : C.white,
      color: stockCategory === cat ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, cat))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHideEmpty(h => !h),
    style: {
      marginLeft: "auto",
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${hideEmpty ? C.green : C.border}`,
      background: hideEmpty ? "#EAF5EE" : C.white,
      color: hideEmpty ? C.green : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, hideEmpty ? "✓ " : "", "\u0422\u043E\u043B\u044C\u043A\u043E \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438")), loadingProducts ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : filteredProducts.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.textFaint
    }
  }, "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E") : filteredProducts.map(p => {
    const out = !(p.stock > 0);
    const low = !out && p.stock <= 5;
    const dot = out ? C.red : low ? C.amber : C.green;
    return /*#__PURE__*/React.createElement("div", {
      key: p.code,
      style: {
        ...S.card,
        opacity: out ? 0.7 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: dot,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.cardTitle,
        overflowWrap: "anywhere"
      }
    }, p.display_name || p.name), /*#__PURE__*/React.createElement("p", {
      style: S.cardSub
    }, "\u041A\u043E\u0434: ", p.code, p.group ? ' · ' + p.group : ''))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right",
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 8,
        fontWeight: 800,
        fontFamily: FH,
        fontSize: 17,
        background: out ? C.redSoft : low ? "#FEF3C7" : "#EAF5EE",
        color: out ? C.red : low ? C.amber : C.green
      }
    }, p.stock != null ? p.stock : '—'), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "4px 0 0",
        fontSize: 13,
        color: C.textFaint
      }
    }, p.stock_unit || ''))), p.stock_reserved > 0 && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "6px 0 0",
        fontSize: 13,
        color: C.textFaint
      }
    }, "\u0418\u0437 1\u0421: ", p.stock_raw, " \xB7 \u0432 \u0437\u0430\u044F\u0432\u043A\u0430\u0445: ", p.stock_reserved, " \xB7 \u0434\u043E\u0441\u0442\u0443\u043F\u043D\u043E: ", p.stock), p.stock_weight_kg != null && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "6px 0 0",
        fontSize: 14,
        color: C.textSub,
        fontWeight: 600
      }
    }, "\u2696\uFE0F \u0412\u0435\u0441: ", p.stock_weight_kg, " \u043A\u0433", p.stock_weight_kg_reserved > 0 ? ` (в заявках: ${p.stock_weight_kg_reserved} кг, доступно: ${Math.max(0, p.stock_weight_kg - p.stock_weight_kg_reserved)} кг)` : ''));
  }));
}

// Раздел (для каталога) и фото — отдельно от цен, во вкладке "Каталог"
// (её видят и admin, и manager — они уже используют один и тот же
// AdminCabinet). Название товара здесь не редактируется — это делает
// "Товары" (алиас для сайта), а тут только то, что видно покупателю
// при выборе: картинка и раздел.
const ProductCatalogCard = memo(function ProductCatalogCard({
  p,
  category,
  barcode,
  categoryOptions,
  saving,
  onChangeCategory,
  onSaveCategory,
  onUploadPhoto,
  onRemovePhoto
}) {
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const fileInputId = `catalog-photo-input-${p.code}`;
  const categoryListId = `catalog-category-options-${p.code}`;
  const onPhotoSelected = async e => {
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
    } catch (err) {
      setPhotoError(err.message || 'Не удалось загрузить фото');
    }
    setPhotoUploading(false);
  };
  const removePhoto = async e => {
    e.preventDefault();
    e.stopPropagation();
    if (!window.confirm('Удалить фото товара?')) return;
    setPhotoError("");
    setPhotoUploading(true);
    try {
      await onRemovePhoto(p.code);
    } catch (err) {
      setPhotoError(err.message || 'Не удалось удалить фото');
    }
    setPhotoUploading(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      padding: 10,
      marginBottom: 0,
      display: "flex",
      flexDirection: "column"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative",
      width: "100%",
      aspectRatio: "1"
    }
  }, /*#__PURE__*/React.createElement("label", {
    htmlFor: fileInputId,
    style: {
      width: "100%",
      height: "100%",
      borderRadius: 8,
      cursor: "pointer",
      overflow: "hidden",
      background: C.white,
      border: `1px solid ${C.border}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 8,
      boxSizing: "border-box"
    }
  }, photoUploading ? /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textFaint
    }
  }, "...") : p.photo ? /*#__PURE__*/React.createElement("img", {
    src: p.photo,
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain"
    }
  }) : /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 40,
      color: C.textFaint
    }
  }, "\uD83D\uDCF7")), p.photo && !photoUploading && /*#__PURE__*/React.createElement("button", {
    onClick: removePhoto,
    title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0444\u043E\u0442\u043E",
    style: {
      position: "absolute",
      top: 6,
      right: 6,
      width: 22,
      height: 22,
      borderRadius: "50%",
      border: `1px solid ${C.border}`,
      background: C.white,
      color: C.red,
      fontSize: 14,
      lineHeight: 1,
      cursor: "pointer",
      padding: 0
    }
  }, "\u2715")), /*#__PURE__*/React.createElement("input", {
    id: fileInputId,
    type: "file",
    accept: "image/*",
    style: {
      display: "none"
    },
    onChange: onPhotoSelected
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8,
      marginBottom: 8,
      minWidth: 0
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      gap: 6,
      marginBottom: 2
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      color: C.textFaint
    }
  }, "\u041A\u043E\u0434 1\u0421: ", p.code), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy,
      whiteSpace: "nowrap"
    }
  }, p.price1 > 0 ? p.price1.toLocaleString() + ' ₸' : '—')), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 600,
      color: C.textMid
    }
  }, p.name), photoError && /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.red,
      marginTop: 2
    }
  }, photoError)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 6,
      marginTop: "auto"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 10px",
      fontSize: 15
    },
    placeholder: "\u0428\u0442\u0440\u0438\u0445\u043A\u043E\u0434",
    value: barcode,
    onChange: e => onChangeCategory(p.code, 'barcode', e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 10px",
      fontSize: 15,
      flex: 1
    },
    placeholder: "\u0420\u0430\u0437\u0434\u0435\u043B \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430 (\u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u041F\u043E\u0441\u0443\u0434\u0430)",
    value: category,
    list: categoryListId,
    onChange: e => onChangeCategory(p.code, 'category', e.target.value)
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      padding: "7px 14px",
      fontSize: 14,
      marginTop: 0,
      boxShadow: "none",
      opacity: saving ? 0.5 : 1,
      width: "auto",
      whiteSpace: "nowrap"
    },
    disabled: saving,
    onClick: () => onSaveCategory(p)
  }, "\u0421\u043E\u0445\u0440."))), /*#__PURE__*/React.createElement("datalist", {
    id: categoryListId
  }, categoryOptions.map(c => /*#__PURE__*/React.createElement("option", {
    key: c,
    value: c
  }))));
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
    return raw ? JSON.parse(raw) : {
      url: 'http://127.0.0.1:8080',
      kkmOfdId: '',
      auth: ''
    };
  } catch {
    return {
      url: 'http://127.0.0.1:8080',
      kkmOfdId: '',
      auth: ''
    };
  }
}
function saveCashcoreSettings(s) {
  try {
    localStorage.setItem(CASHCORE_STORAGE_KEY, JSON.stringify(s));
  } catch {}
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
  if (sale.payment_cash > 0) payments.push({
    type: 0,
    sum: sale.payment_cash
  });
  if (sale.payment_qr > 0) payments.push({
    type: 1,
    sum: sale.payment_qr
  });
  const body = {
    kkm_ofd_id: Number(s.kkmOfdId),
    is_printable: true,
    // 2 = OPERATION_SELL (продажа), 3 = OPERATION_SELL_RETURN (возврат
    // продажи — см. voidSale в AdminCabinet: чек возврата для уже
    // пробитой продажи, теми же позициями и оплатой).
    operation,
    items: (sale.items || []).map(it => ({
      type: 1,
      // ItemTypeEnum.ITEM_TYPE_COMMODITY
      commodity: {
        name: it.name,
        quantity: it.qty,
        price: it.price,
        sum: it.qty * it.price
      }
    })),
    payments
  };
  let resp;
  try {
    resp = await fetch(`${s.url.replace(/\/$/, '')}/TradeOperation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(s.auth ? {
          Authorization: s.auth
        } : {})
      },
      body: JSON.stringify(body)
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
  return {
    fiscal_id: r.fiscal_id,
    qr_code: r.qr_code,
    ofd_name: r.ofd_name
  };
}
function CashcoreSettingsForm({
  initial,
  onSave,
  onClose
}) {
  const [url, setUrl] = useState(initial.url || 'http://127.0.0.1:8080');
  const [kkmOfdId, setKkmOfdId] = useState(initial.kkmOfdId || '');
  const [auth, setAuth] = useState(initial.auth || '');
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginBottom: 16,
      background: C.surface
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 10px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u2699 \u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u043A\u0430\u0441\u0441\u043E\u0432\u043E\u0433\u043E \u044F\u0434\u0440\u0430 (CashCore)"), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: C.textSub,
      marginBottom: 10
    }
  }, "\u0417\u0430\u043F\u043E\u043B\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0434\u0438\u043D \u0440\u0430\u0437 \u043D\u0430 \u044D\u0442\u043E\u043C \u043A\u043E\u043C\u043F\u044C\u044E\u0442\u0435\u0440\u0435 (\u0434\u0430\u043D\u043D\u044B\u0435 \u043D\u0435 \u0443\u0445\u043E\u0434\u044F\u0442 \u043D\u0430 \u0441\u0435\u0440\u0432\u0435\u0440, \u0445\u0440\u0430\u043D\u044F\u0442\u0441\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0432 \u044D\u0442\u043E\u043C \u0431\u0440\u0430\u0443\u0437\u0435\u0440\u0435). \u0410\u0434\u0440\u0435\u0441 \u2014 \u043E\u0431\u044B\u0447\u043D\u043E http://127.0.0.1:8080, \u0435\u0441\u043B\u0438 CashCore \u0437\u0430\u043F\u0443\u0449\u0435\u043D \u043D\u0430 \u044D\u0442\u043E\u043C \u0436\u0435 \u041F\u041A. ID \u043A\u0430\u0441\u0441\u044B \u0438 \u0442\u043E\u043A\u0435\u043D/\u041F\u0418\u041D \u2014 \u0438\u0437 \u043A\u043E\u043D\u0444\u0438\u0433\u0443\u0440\u0430\u0442\u043E\u0440\u0430 CashCoreConfig \u0438 \u043B\u0438\u0447\u043D\u043E\u0433\u043E \u043A\u0430\u0431\u0438\u043D\u0435\u0442\u0430 \u041E\u0424\u0414."), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      flexDirection: "column",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 10px",
      fontSize: 15
    },
    placeholder: "\u0410\u0434\u0440\u0435\u0441 CashCore (http://127.0.0.1:8080)",
    value: url,
    onChange: e => setUrl(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 10px",
      fontSize: 15
    },
    placeholder: "ID \u043A\u0430\u0441\u0441\u044B \u0432 \u041E\u0424\u0414 (kkm_ofd_id)",
    value: kkmOfdId,
    onChange: e => setKkmOfdId(e.target.value)
  }), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 10px",
      fontSize: 15
    },
    placeholder: "\u041F\u0418\u041D-\u043A\u043E\u0434 \u0438\u043B\u0438 Bearer-\u0442\u043E\u043A\u0435\u043D \u0434\u043B\u044F \u0437\u0430\u0433\u043E\u043B\u043E\u0432\u043A\u0430 Authorization",
    value: auth,
    onChange: e => setAuth(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      width: "auto",
      padding: "7px 16px",
      marginTop: 0,
      boxShadow: "none"
    },
    onClick: () => {
      const next = {
        url: url.trim(),
        kkmOfdId: kkmOfdId.trim(),
        auth: auth.trim()
      };
      onSave(next);
    }
  }, "\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      width: "auto",
      padding: "7px 16px"
    },
    onClick: onClose
  }, "\u041E\u0442\u043C\u0435\u043D\u0430")));
}

// Касса — мгновенная продажа по каталогу (без адреса/времени доставки).
// Пишет в /api/sales, которая делит остаток с обычными заявками и
// сводится в тот же отчёт "Касса" — см. AdminCabinet.
function PosSaleModal({
  products,
  clients,
  onClose,
  onCompleted
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [cart, setCart] = useState([]);
  const [clientSearchText, setClientSearchText] = useState("");
  const [clientId, setClientId] = useState("");
  const [showClientDrop, setShowClientDrop] = useState(false);
  const [payType, setPayType] = useState({
    cash: true,
    qr: false
  });
  const [payAmounts, setPayAmounts] = useState({
    cash: "",
    qr: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [showCashcoreSettings, setShowCashcoreSettings] = useState(false);
  // Пока saleResult===null — обычная форма продажи. После оформления —
  // экран с результатом фискализации (успех/долг/ошибка), закрывается
  // отдельной кнопкой "Готово", чтобы кассир успел увидеть, пробился чек
  // или нет, прежде чем модалка закроется и это станет незаметно.
  const [saleResult, setSaleResult] = useState(null);
  const [fiscalizing, setFiscalizing] = useState(false);
  const categories = useMemo(() => [...new Set(products.map(p => p.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [products]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.code || '').includes(q) || (p.barcode || '').includes(q)) && (!category || p.group === category));
  }, [products, search, category]);
  const addToCart = p => {
    setCart(c => {
      const existing = c.find(l => l.code === p.code);
      const avail = stockAmount(p);
      if (existing) {
        const nextQty = existing.qty + 1;
        const capped = avail != null ? Math.min(nextQty, avail) : nextQty;
        return c.map(l => l.code === p.code ? {
          ...l,
          qty: capped
        } : l);
      }
      return [...c, {
        code: p.code,
        name: p.name,
        price: p.price1 || 0,
        qty: 1,
        stock: avail
      }];
    });
  };
  const changeQty = (code, delta) => {
    setCart(c => c.map(l => {
      if (l.code !== code) return l;
      const next = l.qty + delta;
      const capped = l.stock != null ? Math.min(next, l.stock) : next;
      return {
        ...l,
        qty: Math.max(0, capped)
      };
    }).filter(l => l.qty > 0));
  };
  const changePrice = (code, price) => setCart(c => c.map(l => l.code === code ? {
    ...l,
    price: Number(price) || 0
  } : l));
  const removeFromCart = code => setCart(c => c.filter(l => l.code !== code));
  const total = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const cashAmt = payType.cash ? Number(payAmounts.cash) || 0 : 0;
  const qrAmt = payType.qr ? Number(payAmounts.qr) || 0 : 0;
  const remainder = Math.max(0, total - cashAmt - qrAmt);
  const overpaid = cashAmt + qrAmt > total;
  const toggleCashQr = key => {
    setPayType(pt => {
      const next = {
        ...pt,
        [key]: !pt[key]
      };
      if (!next[key]) setPayAmounts(a => ({
        ...a,
        [key]: ""
      }));
      return next;
    });
  };
  useEffect(() => {
    // Пока не тронули суммы вручную — наличкой закрываем всю сумму по умолчанию (частый случай).
    if (payType.cash && payAmounts.cash === "" && !payType.qr) {
      setPayAmounts(a => ({
        ...a,
        cash: total ? String(total) : ""
      }));
    }
  }, [total, payType.cash, payType.qr]);
  const canSubmit = cart.length > 0 && !submitting && (remainder <= 0 || clientId) && !overpaid;
  const runFiscalize = async sale => {
    setFiscalizing(true);
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      setSaleResult(r => ({
        ...r,
        fiscal,
        fiscalError: null
      }));
    } catch (fe) {
      setSaleResult(r => ({
        ...r,
        fiscal: null,
        fiscalError: fe.message
      }));
    }
    setFiscalizing(false);
  };
  const submit = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const sale = await apiCall('POST', '/api/sales', {
        items: cart.map(l => ({
          code: l.code,
          name: l.name,
          qty: l.qty,
          price: l.price
        })),
        paymentCash: cashAmt,
        paymentQr: qrAmt,
        paymentDebt: remainder,
        clientCode: clientId || undefined
      });
      // Продажа с долгом (remainder>0) не фискализируем автоматически — в
      // ККМ нет типа платежа "в долг", чек с неполной оплатой был бы
      // некорректен. Пробивается вручную после погашения.
      if (remainder > 0) {
        setSaleResult({
          sale,
          fiscal: null,
          fiscalError: null,
          skippedDebt: true
        });
      } else {
        setSaleResult({
          sale,
          fiscal: null,
          fiscalError: null,
          skippedDebt: false
        });
        await runFiscalize(sale);
      }
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(28,25,23,0.45)",
      zIndex: 200,
      overflowY: "auto"
    },
    onClick: e => {
      if (e.target === e.currentTarget) onClose();
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.surface,
      margin: "16px auto",
      borderRadius: 16,
      padding: 20,
      maxWidth: 900,
      minHeight: "calc(100vh - 32px)"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 20,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, "\uD83D\uDCB5 \u041D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0434\u0430\u0436\u0430"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, !saleResult && /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => setShowCashcoreSettings(s => !s),
    title: "\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430 \u043A\u0430\u0441\u0441\u043E\u0432\u043E\u0433\u043E \u044F\u0434\u0440\u0430"
  }, "\u2699 \u041A\u041A\u041C"), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: onClose
  }, "\u2715 \u0417\u0430\u043A\u0440\u044B\u0442\u044C"))), saleResult ? /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 10px",
      fontSize: 17,
      fontWeight: 800,
      color: C.navy
    }
  }, "\u2705 \u041F\u0440\u043E\u0434\u0430\u0436\u0430 \u2116", saleResult.sale.id, " \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0430 \u2014 ", saleResult.sale.total.toLocaleString(), " \u20B8"), saleResult.skippedDebt && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.errorBox,
      background: "#FEF3E6",
      color: "#92400E",
      marginBottom: 10
    }
  }, "\u0412 \u043F\u0440\u043E\u0434\u0430\u0436\u0435 \u0435\u0441\u0442\u044C \u0434\u043E\u043B\u0433 \u2014 \u0447\u0435\u043A \u043D\u0435 \u043F\u0440\u043E\u0431\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 (\u0432 \u041A\u041A\u041C \u043D\u0435\u0442 \u0442\u0438\u043F\u0430 \u043E\u043F\u043B\u0430\u0442\u044B \"\u0432 \u0434\u043E\u043B\u0433\"). \u041F\u0440\u043E\u0431\u0435\u0439\u0442\u0435 \u0447\u0435\u043A \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0433\u0430\u0448\u0435\u043D\u0438\u044F."), fiscalizing && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 0",
      color: C.textSub,
      fontSize: 15
    }
  }, "\u041F\u0440\u043E\u0431\u0438\u0432\u0430\u044E \u0447\u0435\u043A \u0447\u0435\u0440\u0435\u0437 \u041A\u041A\u041C..."), !fiscalizing && saleResult.fiscal && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.errorBox,
      background: "#EAF5EE",
      color: "#15803D",
      marginBottom: 10
    }
  }, "\uD83E\uDDFE \u0427\u0435\u043A \u043F\u0440\u043E\u0431\u0438\u0442. \u0424\u0438\u0441\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0438\u0437\u043D\u0430\u043A: ", saleResult.fiscal.fiscal_id, saleResult.fiscal.ofd_name ? ` (${saleResult.fiscal.ofd_name})` : ''), !fiscalizing && saleResult.fiscalError && /*#__PURE__*/React.createElement("div", {
    style: S.errorBox
  }, "\u26A0\uFE0F \u0427\u0435\u043A \u043D\u0435 \u043F\u0440\u043E\u0431\u0438\u0442: ", saleResult.fiscalError, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      width: "auto",
      padding: "6px 14px",
      fontSize: 14
    },
    onClick: () => runFiscalize(saleResult.sale)
  }, "\uD83D\uDD01 \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C"))), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      marginTop: 10
    },
    onClick: onCompleted
  }, "\u0413\u043E\u0442\u043E\u0432\u043E")) : /*#__PURE__*/React.createElement(React.Fragment, null, showCashcoreSettings && /*#__PURE__*/React.createElement(CashcoreSettingsForm, {
    initial: getCashcoreSettings(),
    onSave: next => {
      saveCashcoreSettings(next);
      setShowCashcoreSettings(false);
    },
    onClose: () => setShowCashcoreSettings(false)
  }), /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      marginBottom: 10
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043A\u043E\u0434\u0443 \u0438\u043B\u0438 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443...",
    value: search,
    onChange: e => setSearch(e.target.value),
    autoComplete: "off",
    name: "pos-search"
  }), categories.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCategory(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${category === "" ? C.navy : C.border}`,
      background: category === "" ? C.navy : C.white,
      color: category === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435"), categories.map(cat => /*#__PURE__*/React.createElement("button", {
    key: cat,
    onClick: () => setCategory(cat),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${category === cat ? C.navy : C.border}`,
      background: category === cat ? C.navy : C.white,
      color: category === cat ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, cat))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))",
      gap: 10,
      marginBottom: 20,
      maxHeight: 320,
      overflowY: "auto",
      padding: 2
    }
  }, filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1/-1",
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"), filtered.map(p => {
    const outOfStock = stockIsOut(p);
    const inCart = cart.find(l => l.code === p.code);
    return /*#__PURE__*/React.createElement("div", {
      key: p.code,
      style: {
        border: `1px solid ${C.border}`,
        borderRadius: R,
        overflow: "hidden",
        background: C.white,
        opacity: outOfStock ? 0.5 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        aspectRatio: "1",
        background: C.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
        boxSizing: "border-box"
      }
    }, p.photo ? /*#__PURE__*/React.createElement("img", {
      src: p.photo,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "contain"
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 23,
        color: C.textFaint
      }
    }, "\uD83D\uDCE6")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "6px 8px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: C.text,
        marginBottom: 2,
        minHeight: 28,
        lineHeight: 1.3
      }
    }, p.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        fontFamily: FH,
        color: C.navy,
        marginBottom: 6
      }
    }, p.price1 > 0 ? p.price1.toLocaleString() + ' ₸' : '—'), outOfStock ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.red,
        textAlign: "center",
        padding: "6px 0"
      }
    }, "\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438") : inCart ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: C.surface,
        borderRadius: 8,
        padding: "2px"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => changeQty(p.code, -1),
      style: {
        width: 24,
        height: 24,
        border: "none",
        borderRadius: 6,
        background: C.white,
        boxShadow: `0 0 0 1px ${C.border}`,
        fontSize: 16,
        fontWeight: 700,
        color: C.navy,
        cursor: "pointer"
      }
    }, "\u2212"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: C.navy
      }
    }, inCart.qty), /*#__PURE__*/React.createElement("button", {
      onClick: () => changeQty(p.code, 1),
      style: {
        width: 24,
        height: 24,
        border: "none",
        borderRadius: 6,
        background: C.white,
        boxShadow: `0 0 0 1px ${C.border}`,
        fontSize: 16,
        fontWeight: 700,
        color: C.navy,
        cursor: "pointer"
      }
    }, "+")) : /*#__PURE__*/React.createElement("button", {
      onClick: () => addToCart(p),
      style: {
        width: "100%",
        padding: "6px",
        border: "none",
        borderRadius: 8,
        background: C.navy,
        color: C.white,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C")));
  })), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.label,
      marginBottom: 10,
      display: "block"
    }
  }, "\u041A\u043E\u0440\u0437\u0438\u043D\u0430"), cart.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "16px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u041F\u0443\u0441\u0442\u043E \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u044B \u0432\u044B\u0448\u0435") : cart.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.code,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 56px 80px 28px",
      gap: 6,
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.textMid,
      fontWeight: 600
    }
  }, l.name), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 6px",
      fontSize: 15,
      textAlign: "center"
    },
    type: "number",
    min: "1",
    max: l.stock != null ? l.stock : undefined,
    value: l.qty,
    onChange: e => {
      let v = Number(e.target.value) || 0;
      if (l.stock != null) v = Math.min(v, l.stock);
      setCart(c => c.map(x => x.code === l.code ? {
        ...x,
        qty: Math.max(0, v)
      } : x));
    },
    onFocus: e => e.target.select()
  }), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 6px",
      fontSize: 15,
      textAlign: "right"
    },
    type: "number",
    value: l.price,
    onChange: e => changePrice(l.code, e.target.value),
    onFocus: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeFromCart(l.code),
    style: {
      width: 28,
      height: 34,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      background: C.surface,
      cursor: "pointer",
      fontSize: 16,
      color: C.textFaint
    }
  }, "\xD7"))), cart.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("hr", {
    style: {
      ...S.divider,
      marginTop: 4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.textSub
    }
  }, "\u0418\u0442\u043E\u0433\u043E"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, total.toLocaleString(), " \u20B8")))), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.label,
      marginBottom: 10,
      display: "block"
    }
  }, "\u041A\u043B\u0438\u0435\u043D\u0442 ", remainder > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontWeight: 400
    }
  }, "(\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D \u0434\u043B\u044F \u0434\u043E\u043B\u0433\u0430)") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textFaint,
      fontWeight: 400
    }
  }, "(\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    placeholder: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435...",
    value: clientSearchText,
    onChange: e => {
      setClientSearchText(e.target.value);
      setClientId("");
      setShowClientDrop(true);
    },
    onFocus: () => setShowClientDrop(true),
    onBlur: () => setTimeout(() => setShowClientDrop(false), 180)
  }), showClientDrop && (() => {
    const matched = clientSearchText.length > 0 ? clients.filter(c => c.name.toLowerCase().includes(clientSearchText.toLowerCase())) : clients.slice(0, 50);
    return matched.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        zIndex: 50,
        maxHeight: 200,
        overflowY: "auto"
      }
    }, matched.map(c => /*#__PURE__*/React.createElement("div", {
      key: c.code,
      onMouseDown: () => {
        setClientId(c.code);
        setClientSearchText(c.name);
        setShowClientDrop(false);
      },
      style: {
        padding: "9px 12px",
        cursor: "pointer",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 15
      }
    }, c.name)));
  })())), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 12px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u041E\u043F\u043B\u0430\u0442\u0430"), [{
    key: "cash",
    label: "Наличка",
    icon: "💵",
    bg: C.cashGreen,
    col: "#15803D"
  }, {
    key: "qr",
    label: "QR код",
    icon: "📲",
    bg: C.qrBlue,
    col: "#1D4ED8"
  }].map(({
    key,
    label,
    icon,
    bg,
    col
  }) => /*#__PURE__*/React.createElement("div", {
    key: key,
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => toggleCashQr(key),
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      border: `2px solid ${payType[key] ? col : C.border}`,
      background: payType[key] ? col : C.white,
      cursor: "pointer",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, payType[key] && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.white,
      fontSize: 15,
      fontWeight: 700
    }
  }, "\u2713")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: payType[key] ? col : C.textMid
    }
  }, icon, " ", label), payType[key] && /*#__PURE__*/React.createElement("input", {
    style: {
      flex: 1,
      border: `1.5px solid ${col}40`,
      borderRadius: 6,
      padding: "6px 10px",
      fontSize: 16,
      fontWeight: 600,
      outline: "none",
      background: bg,
      color: col
    },
    placeholder: "\u0421\u0443\u043C\u043C\u0430 \u20B8",
    value: payAmounts[key],
    onFocus: e => e.target.select(),
    onChange: e => setPayAmounts(a => ({
      ...a,
      [key]: e.target.value
    }))
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 14px",
      borderRadius: 10,
      background: C.surface,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textSub
    }
  }, "\u0421\u0443\u043C\u043C\u0430 \u043F\u0440\u043E\u0434\u0430\u0436\u0438"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontFamily: FH
    }
  }, total.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      paddingTop: 6,
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: overpaid ? C.red : remainder > 0 ? "#92400E" : C.green
    }
  }, overpaid ? "⚠️ Оплачено больше суммы" : remainder > 0 ? "📋 Долг" : "✅ Полностью оплачено"), (remainder > 0 || overpaid) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 17,
      fontFamily: FH,
      color: overpaid ? C.red : "#92400E"
    }
  }, (overpaid ? cashAmt + qrAmt - total : remainder).toLocaleString(), " \u20B8")))), error && /*#__PURE__*/React.createElement("div", {
    style: S.errorBox
  }, error), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSuccess,
      opacity: canSubmit ? 1 : 0.45,
      cursor: canSubmit ? "pointer" : "not-allowed"
    },
    disabled: !canSubmit,
    onClick: submit
  }, submitting ? "Оформление..." : "✅ Оформить продажу"))));
}

// Считает выручку/себестоимость/прибыль по списку заявок или продаж (у
// обеих items — либо массив, либо JSON-строка). cost — снимок закупочной
// цены на момент продажи (см. getCostMap на сервере), а не текущая цена
// товара, поэтому прошлые продажи не "плывут" при правке закупки задним
// числом. Если у части позиций cost ещё не заведён — они не портят сумму
// (просто не входят в себестоимость), но считаются в missingCostLines,
// чтобы отчёт мог честно предупредить "прибыль занижена".
function sumItemsProfit(list) {
  let revenue = 0,
    cost = 0,
    missingCostLines = 0;
  (list || []).forEach(o => {
    const its = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
    its.forEach(it => {
      const qty = Number(it.qty) || 0,
        price = Number(it.price) || 0;
      revenue += qty * price;
      if (it.cost != null) cost += qty * Number(it.cost);else missingCostLines += 1;
    });
  });
  return {
    revenue,
    cost,
    profit: revenue - cost,
    missingCostLines
  };
}

// Блок "Прибыль" — переиспользуется в "Отчёте" (только заявки), "Кассе"
// (только продажи по кассе) и как общий свод (заявки+касса вместе).
// missingLines>0 означает, что у части проданных позиций ещё не заведена
// закупочная цена (см. вкладку "Товары") — тогда прибыль занижена, честно
// показываем это отдельной строкой вместо того, чтобы выдать неполную
// цифру за точную.
function ProfitBlock({
  revenue,
  cost,
  profit,
  missingLines
}) {
  const margin = revenue > 0 ? profit / revenue * 100 : 0;
  return /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: C.textFaint,
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, "\u0421\u0435\u0431\u0435\u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: C.textMid
    }
  }, cost.toLocaleString(undefined, {
    maximumFractionDigits: 0
  }), " \u20B8")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: C.textFaint,
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, "\u041F\u0440\u0438\u0431\u044B\u043B\u044C"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: profit >= 0 ? C.green : C.red
    }
  }, profit.toLocaleString(undefined, {
    maximumFractionDigits: 0
  }), " \u20B8")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: C.textFaint,
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, "\u041C\u0430\u0440\u0436\u0430"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: profit >= 0 ? C.green : C.red
    }
  }, margin.toFixed(1), "%"))), missingLines > 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "10px 0 0",
      fontSize: 13.5,
      color: "#92400E",
      background: "#FFFBEB",
      border: "1px solid #FDE68A",
      borderRadius: 8,
      padding: "7px 10px"
    }
  }, "\u26A0\uFE0F \u0423 ", missingLines, " ", missingLines === 1 ? 'позиции' : 'позиций', " \u043D\u0435\u0442 \u0437\u0430\u043A\u0443\u043F\u043E\u0447\u043D\u043E\u0439 \u0446\u0435\u043D\u044B \u2014 \u043F\u0440\u0438\u0431\u044B\u043B\u044C \u0437\u0430\u043D\u0438\u0436\u0435\u043D\u0430. \u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043D\u0430 \u0432\u043A\u043B\u0430\u0434\u043A\u0435 \xAB\u0422\u043E\u0432\u0430\u0440\u044B\xBB."));
}

// Кабинет кассира — постоянный экран кассы: каталог и текущий чек всегда
// на экране (не нужно нажимать "Новая продажа" каждый раз, как торговый
// жмёт "Создать заявку"), плюс смена — пока не открыта, кассы не видно.
function CashierCabinet({
  user,
  onLogout
}) {
  const isDesktop = useIsDesktop();
  const [shift, setShift] = useState(undefined); // undefined = грузится, null = смены нет
  const [openingShift, setOpeningShift] = useState(false);
  const [closingShift, setClosingShift] = useState(false);
  const loadShift = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/cashier-shift/current');
      setShift(data);
    } catch (e) {
      if (e.message.includes('токен')) onLogout();
    }
  }, []);
  useEffect(() => {
    loadShift();
  }, []);
  const [sales, setSales] = useState([]);
  const [products, setProducts] = useState([]);
  const [clients, setClients] = useState([]);
  const loadSales = useCallback(async () => {
    try {
      setSales(await apiCall('GET', '/api/sales'));
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadSales();
  }, []);
  useEffect(() => {
    fetch('/api/products').then(r => r.json()).then(setProducts).catch(() => {});
  }, []);
  useEffect(() => {
    apiCall('GET', '/api/clients').then(setClients).catch(() => {});
  }, []);
  const openShift = async () => {
    setOpeningShift(true);
    try {
      setShift(await apiCall('POST', '/api/cashier-shift/open', {}));
    } catch (e) {
      alert(e.message);
    }
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
    const cash = myShiftSales.reduce((s, o) => s + (o.payment_cash || 0), 0);
    const qr = myShiftSales.reduce((s, o) => s + (o.payment_qr || 0), 0);
    const debt = myShiftSales.reduce((s, o) => s + (o.payment_debt || 0), 0);
    if (!window.confirm(`Закрыть смену?\n\nПродаж: ${myShiftSales.length}\nНаличка: ${cash.toLocaleString()} ₸\nQR: ${qr.toLocaleString()} ₸\nДолг: ${debt.toLocaleString()} ₸`)) return;
    setClosingShift(true);
    try {
      await apiCall('POST', `/api/cashier-shift/${shift.id}/close`, {});
      setShift(null);
    } catch (e) {
      alert(e.message);
    }
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
  const [payType, setPayType] = useState({
    cash: true,
    qr: false
  });
  const [payAmounts, setPayAmounts] = useState({
    cash: "",
    qr: ""
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [saleResult, setSaleResult] = useState(null);
  const [fiscalizing, setFiscalizing] = useState(false);
  const [showCashcoreSettings, setShowCashcoreSettings] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [fiscalizingSaleId, setFiscalizingSaleId] = useState(null);
  const [fiscalErrorBySale, setFiscalErrorBySale] = useState({});
  const categories = useMemo(() => [...new Set(products.map(p => p.group).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [products]);
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.code || '').includes(q) || (p.barcode || '').includes(q)) && (!category || p.group === category));
  }, [products, search, category]);
  const addToCart = p => {
    setCart(c => {
      const existing = c.find(l => l.code === p.code);
      const avail = stockAmount(p);
      if (existing) {
        const nextQty = existing.qty + 1;
        const capped = avail != null ? Math.min(nextQty, avail) : nextQty;
        return c.map(l => l.code === p.code ? {
          ...l,
          qty: capped
        } : l);
      }
      return [...c, {
        code: p.code,
        name: p.name,
        price: p.price1 || 0,
        qty: 1,
        stock: avail
      }];
    });
  };
  const changeQty = (code, delta) => {
    setCart(c => c.map(l => {
      if (l.code !== code) return l;
      const next = l.qty + delta;
      const capped = l.stock != null ? Math.min(next, l.stock) : next;
      return {
        ...l,
        qty: Math.max(0, capped)
      };
    }).filter(l => l.qty > 0));
  };
  const changePrice = (code, price) => setCart(c => c.map(l => l.code === code ? {
    ...l,
    price: Number(price) || 0
  } : l));
  const removeFromCart = code => setCart(c => c.filter(l => l.code !== code));
  const clearCart = () => {
    setCart([]);
    setClientId("");
    setClientSearchText("");
    setPayAmounts({
      cash: "",
      qr: ""
    });
  };
  const total = cart.reduce((s, l) => s + l.qty * l.price, 0);
  const cashAmt = payType.cash ? Number(payAmounts.cash) || 0 : 0;
  const qrAmt = payType.qr ? Number(payAmounts.qr) || 0 : 0;
  const remainder = Math.max(0, total - cashAmt - qrAmt);
  const overpaid = cashAmt + qrAmt > total;
  const toggleCashQr = key => {
    setPayType(pt => {
      const next = {
        ...pt,
        [key]: !pt[key]
      };
      if (!next[key]) setPayAmounts(a => ({
        ...a,
        [key]: ""
      }));
      return next;
    });
  };
  useEffect(() => {
    if (payType.cash && payAmounts.cash === "" && !payType.qr) {
      setPayAmounts(a => ({
        ...a,
        cash: total ? String(total) : ""
      }));
    }
  }, [total, payType.cash, payType.qr]);
  const canSubmit = cart.length > 0 && !submitting && (remainder <= 0 || clientId) && !overpaid;
  const runFiscalize = async sale => {
    setFiscalizing(true);
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      setSaleResult(r => ({
        ...r,
        fiscal,
        fiscalError: null
      }));
    } catch (fe) {
      setSaleResult(r => ({
        ...r,
        fiscal: null,
        fiscalError: fe.message
      }));
    }
    setFiscalizing(false);
  };
  const submit = async () => {
    if (!canSubmit) return;
    setError("");
    setSubmitting(true);
    try {
      const sale = await apiCall('POST', '/api/sales', {
        items: cart.map(l => ({
          code: l.code,
          name: l.name,
          qty: l.qty,
          price: l.price
        })),
        paymentCash: cashAmt,
        paymentQr: qrAmt,
        paymentDebt: remainder,
        clientCode: clientId || undefined
      });
      clearCart();
      loadSales();
      if (remainder > 0) {
        setSaleResult({
          sale,
          fiscal: null,
          fiscalError: null,
          skippedDebt: true
        });
      } else {
        setSaleResult({
          sale,
          fiscal: null,
          fiscalError: null,
          skippedDebt: false
        });
        await runFiscalize(sale);
      }
    } catch (e) {
      setError(e.message);
    }
    setSubmitting(false);
  };
  const retryFiscal = useCallback(async sale => {
    setFiscalizingSaleId(sale.id);
    setFiscalErrorBySale(e => ({
      ...e,
      [sale.id]: null
    }));
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      await loadSales();
    } catch (e) {
      setFiscalErrorBySale(er => ({
        ...er,
        [sale.id]: e.message
      }));
    }
    setFiscalizingSaleId(null);
  }, [loadSales]);
  const voidSale = useCallback(async sale => {
    if (!window.confirm(`Отменить продажу № ${sale.id} на ${sale.total.toLocaleString()} ₸? Остаток вернётся на склад.`)) return;
    try {
      let fiscalReturn = {};
      if (sale.fiscal_id) {
        try {
          const r = await fiscalizeSale(sale, 3); // OPERATION_SELL_RETURN
          fiscalReturn = {
            fiscal_return_id: r.fiscal_id,
            fiscal_return_qr: r.qr_code
          };
        } catch (fe) {
          alert(`Не удалось пробить чек возврата: ${fe.message}\n\nПродажа НЕ отменена — иначе в ОФД останется чек без документа возврата. Попробуйте ещё раз, когда касса будет доступна.`);
          return;
        }
      }
      await apiCall('POST', `/api/sales/${sale.id}/void`, fiscalReturn);
      await loadSales();
    } catch (e) {
      alert(e.message);
    }
  }, [loadSales]);
  const todayStr = new Date().toISOString().slice(0, 10);
  const historyList = useMemo(() => sales.filter(s => s.date === todayStr).slice().sort((a, b) => b.id - a.id), [sales, todayStr]);
  if (shift === undefined) {
    return /*#__PURE__*/React.createElement("div", {
      style: S.loadingWrap
    }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...");
  }
  if (!shift) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.card,
        maxWidth: 360,
        width: "100%",
        textAlign: "center",
        padding: "32px 24px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 44,
        marginBottom: 12
      }
    }, "\uD83D\uDD12"), /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.cardTitle,
        fontSize: 20,
        marginBottom: 6
      }
    }, "\u041A\u0430\u0441\u0441\u0430 \u0437\u0430\u043A\u0440\u044B\u0442\u0430"), /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.cardSub,
        marginBottom: 20
      }
    }, "\u041E\u0442\u043A\u0440\u043E\u0439\u0442\u0435 \u0441\u043C\u0435\u043D\u0443, \u0447\u0442\u043E\u0431\u044B \u043D\u0430\u0447\u0430\u0442\u044C \u043F\u0440\u043E\u0434\u0430\u0436\u0438"), /*#__PURE__*/React.createElement("button", {
      style: S.btnSuccess,
      disabled: openingShift,
      onClick: openShift
    }, openingShift ? "Открываем..." : "▶ Начать смену")));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      padding: isDesktop ? "20px 24px 40px" : "16px 12px 90px"
    }
  }, showCashcoreSettings && /*#__PURE__*/React.createElement(CashcoreSettingsForm, {
    initial: getCashcoreSettings(),
    onSave: next => {
      saveCashcoreSettings(next);
      setShowCashcoreSettings(false);
    },
    onClose: () => setShowCashcoreSettings(false)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 16,
      flexWrap: "wrap",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 14,
      color: C.textSub,
      display: "flex",
      alignItems: "center",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      width: 8,
      height: 8,
      borderRadius: "50%",
      background: C.green,
      display: "inline-block"
    }
  }), " \u041A\u0430\u0441\u0441\u0430 \u043E\u0442\u043A\u0440\u044B\u0442\u0430 \xB7 \u0441\u043C\u0435\u043D\u0430 \u2116", shift.id), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 14,
      color: C.textFaint
    }
  }, "\u0441 ", new Date(shift.opened_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }), " \xB7 ", user.name)), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => setShowCashcoreSettings(s => !s)
  }, "\u2699 \u041A\u041A\u041C"), /*#__PURE__*/React.createElement("button", {
    style: S.btnSecondary,
    onClick: () => setShowHistory(s => !s)
  }, showHistory ? "✕ Скрыть историю" : "🧾 История"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      color: C.red,
      borderColor: "#FCA5A5"
    },
    disabled: closingShift,
    onClick: closeShift
  }, closingShift ? "Закрываем..." : "⏹ Закончить смену"))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: isDesktop ? "grid" : "block",
      gridTemplateColumns: isDesktop ? "minmax(0,1fr) 380px" : undefined,
      gap: 16,
      alignItems: "start"
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      marginBottom: 10
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043A\u043E\u0434\u0443 \u0438\u043B\u0438 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443...",
    value: search,
    onChange: e => setSearch(e.target.value),
    autoComplete: "off",
    name: "cashier-pos-search"
  }), categories.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCategory(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${category === "" ? C.navy : C.border}`,
      background: category === "" ? C.navy : C.white,
      color: category === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435"), categories.map(cat => /*#__PURE__*/React.createElement("button", {
    key: cat,
    onClick: () => setCategory(cat),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${category === cat ? C.navy : C.border}`,
      background: category === cat ? C.navy : C.white,
      color: category === cat ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, cat))), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "repeat(auto-fill, minmax(140px,1fr))",
      gap: 10
    }
  }, filtered.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      gridColumn: "1/-1",
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"), filtered.map(p => {
    const outOfStock = stockIsOut(p);
    const inCart = cart.find(l => l.code === p.code);
    return /*#__PURE__*/React.createElement("div", {
      key: p.code,
      style: {
        border: `1px solid ${C.border}`,
        borderRadius: R,
        overflow: "hidden",
        background: C.white,
        opacity: outOfStock ? 0.5 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        aspectRatio: "1",
        background: C.white,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 6,
        boxSizing: "border-box"
      }
    }, p.photo ? /*#__PURE__*/React.createElement("img", {
      src: p.photo,
      style: {
        width: "100%",
        height: "100%",
        objectFit: "contain"
      }
    }) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 23,
        color: C.textFaint
      }
    }, "\uD83D\uDCE6")), /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "6px 8px"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        fontWeight: 600,
        color: C.text,
        marginBottom: 2,
        minHeight: 28,
        lineHeight: 1.3
      }
    }, p.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        fontFamily: FH,
        color: C.navy,
        marginBottom: 6
      }
    }, p.price1 > 0 ? p.price1.toLocaleString() + ' ₸' : '—'), outOfStock ? /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 12,
        color: C.red,
        textAlign: "center",
        padding: "6px 0"
      }
    }, "\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438") : inCart ? /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        background: C.surface,
        borderRadius: 8,
        padding: "2px"
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => changeQty(p.code, -1),
      style: {
        width: 24,
        height: 24,
        border: "none",
        borderRadius: 6,
        background: C.white,
        boxShadow: `0 0 0 1px ${C.border}`,
        fontSize: 16,
        fontWeight: 700,
        color: C.navy,
        cursor: "pointer"
      }
    }, "\u2212"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 14,
        fontWeight: 800,
        color: C.navy
      }
    }, inCart.qty), /*#__PURE__*/React.createElement("button", {
      onClick: () => changeQty(p.code, 1),
      style: {
        width: 24,
        height: 24,
        border: "none",
        borderRadius: 6,
        background: C.white,
        boxShadow: `0 0 0 1px ${C.border}`,
        fontSize: 16,
        fontWeight: 700,
        color: C.navy,
        cursor: "pointer"
      }
    }, "+")) : /*#__PURE__*/React.createElement("button", {
      onClick: () => addToCart(p),
      style: {
        width: "100%",
        padding: "6px",
        border: "none",
        borderRadius: 8,
        background: C.navy,
        color: C.white,
        fontSize: 13,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C")));
  })), showHistory && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 24
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17
    }
  }, "\u041F\u0440\u043E\u0434\u0430\u0436\u0438 \u0441\u0435\u0433\u043E\u0434\u043D\u044F (", historyList.length, ")"), historyList.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u041F\u0440\u043E\u0434\u0430\u0436 \u043F\u043E\u043A\u0430 \u043D\u0435 \u0431\u044B\u043B\u043E") : historyList.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, "\u2116 ", s.id, " \xB7 ", s.client_name || "Без клиента"), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, s.items.length, " \u043F\u043E\u0437. \xB7 ", s.created_by_name, " \xB7 ", new Date(s.created_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, s.total.toLocaleString(), " \u20B8")), s.status === "voided" ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      fontSize: 13,
      color: C.red
    }
  }, "\u041E\u0442\u043C\u0435\u043D\u0435\u043D\u0430") : s.fiscal_id ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      fontSize: 13,
      color: C.green
    }
  }, "\uD83E\uDDFE \u0427\u0435\u043A \u043F\u0440\u043E\u0431\u0438\u0442 \xB7 \u043F\u0440\u0438\u0437\u043D\u0430\u043A ", s.fiscal_id, s.fiscal_return_id && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), "\u21A9\uFE0F \u0427\u0435\u043A \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u043F\u0440\u043E\u0431\u0438\u0442 \xB7 \u043F\u0440\u0438\u0437\u043D\u0430\u043A ", s.fiscal_return_id)) : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 6px",
      fontSize: 13,
      color: s.payment_debt > 0 ? C.textFaint : C.red
    }
  }, s.payment_debt > 0 ? "Чек не пробит (продажа с долгом — пробить можно после погашения)" : "⚠️ Чек не пробит"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      padding: "6px 14px",
      fontSize: 14,
      width: "auto",
      opacity: fiscalizingSaleId === s.id ? 0.6 : 1
    },
    disabled: fiscalizingSaleId === s.id,
    onClick: () => retryFiscal(s)
  }, fiscalizingSaleId === s.id ? "Пробиваю..." : "🔁 Пробить чек"), fiscalErrorBySale[s.id] && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 13,
      color: C.red
    }
  }, fiscalErrorBySale[s.id])), s.status !== "voided" && /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnDanger,
      marginTop: 10,
      padding: "8px",
      fontSize: 14
    },
    onClick: () => voidSale(s)
  }, "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0434\u0430\u0436\u0443"))))), /*#__PURE__*/React.createElement("div", null, saleResult ? /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 10px",
      fontSize: 17,
      fontWeight: 800,
      color: C.navy
    }
  }, "\u2705 \u041F\u0440\u043E\u0434\u0430\u0436\u0430 \u2116", saleResult.sale.id, " \u043E\u0444\u043E\u0440\u043C\u043B\u0435\u043D\u0430 \u2014 ", saleResult.sale.total.toLocaleString(), " \u20B8"), saleResult.skippedDebt && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.errorBox,
      background: "#FEF3E6",
      color: "#92400E",
      marginBottom: 10
    }
  }, "\u0412 \u043F\u0440\u043E\u0434\u0430\u0436\u0435 \u0435\u0441\u0442\u044C \u0434\u043E\u043B\u0433 \u2014 \u0447\u0435\u043A \u043D\u0435 \u043F\u0440\u043E\u0431\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0447\u0435\u0441\u043A\u0438 (\u0432 \u041A\u041A\u041C \u043D\u0435\u0442 \u0442\u0438\u043F\u0430 \u043E\u043F\u043B\u0430\u0442\u044B \"\u0432 \u0434\u043E\u043B\u0433\"). \u041F\u0440\u043E\u0431\u0435\u0439\u0442\u0435 \u0447\u0435\u043A \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043F\u043E\u0441\u043B\u0435 \u043F\u043E\u0433\u0430\u0448\u0435\u043D\u0438\u044F."), fiscalizing && /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "10px 0",
      color: C.textSub,
      fontSize: 15
    }
  }, "\u041F\u0440\u043E\u0431\u0438\u0432\u0430\u044E \u0447\u0435\u043A \u0447\u0435\u0440\u0435\u0437 \u041A\u041A\u041C..."), !fiscalizing && saleResult.fiscal && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.errorBox,
      background: "#EAF5EE",
      color: "#15803D",
      marginBottom: 10
    }
  }, "\uD83E\uDDFE \u0427\u0435\u043A \u043F\u0440\u043E\u0431\u0438\u0442. \u0424\u0438\u0441\u043A\u0430\u043B\u044C\u043D\u044B\u0439 \u043F\u0440\u0438\u0437\u043D\u0430\u043A: ", saleResult.fiscal.fiscal_id, saleResult.fiscal.ofd_name ? ` (${saleResult.fiscal.ofd_name})` : ''), !fiscalizing && saleResult.fiscalError && /*#__PURE__*/React.createElement("div", {
    style: S.errorBox
  }, "\u26A0\uFE0F \u0427\u0435\u043A \u043D\u0435 \u043F\u0440\u043E\u0431\u0438\u0442: ", saleResult.fiscalError, /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      width: "auto",
      padding: "6px 14px",
      fontSize: 14
    },
    onClick: () => runFiscalize(saleResult.sale)
  }, "\uD83D\uDD01 \u041F\u043E\u0432\u0442\u043E\u0440\u0438\u0442\u044C"))), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      marginTop: 10
    },
    onClick: () => setSaleResult(null)
  }, "\u041D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0434\u0430\u0436\u0430")) : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      color: C.navy
    }
  }, "\u0422\u0435\u043A\u0443\u0449\u0438\u0439 \u0447\u0435\u043A"), cart.length > 0 && /*#__PURE__*/React.createElement("button", {
    style: {
      background: "none",
      border: "none",
      color: C.red,
      fontSize: 14,
      cursor: "pointer"
    },
    onClick: clearCart
  }, "\u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C")), cart.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "30px 0",
      color: C.textFaint
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 36,
      marginBottom: 8
    }
  }, "\uD83D\uDED2"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15
    }
  }, "\u0427\u0435\u043A \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442 \u2014", /*#__PURE__*/React.createElement("br", null), "\u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u043E\u0432\u0430\u0440\u044B \u0441\u043B\u0435\u0432\u0430")) : cart.map(l => /*#__PURE__*/React.createElement("div", {
    key: l.code,
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 56px 80px 28px",
      gap: 6,
      alignItems: "center",
      marginBottom: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      color: C.textMid,
      fontWeight: 600
    }
  }, l.name), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 6px",
      fontSize: 15,
      textAlign: "center"
    },
    type: "number",
    min: "1",
    max: l.stock != null ? l.stock : undefined,
    value: l.qty,
    onChange: e => {
      let v = Number(e.target.value) || 0;
      if (l.stock != null) v = Math.min(v, l.stock);
      setCart(c => c.map(x => x.code === l.code ? {
        ...x,
        qty: Math.max(0, v)
      } : x));
    },
    onFocus: e => e.target.select()
  }), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 6px",
      fontSize: 15,
      textAlign: "right"
    },
    type: "number",
    value: l.price,
    onChange: e => changePrice(l.code, e.target.value),
    onFocus: e => e.target.select()
  }), /*#__PURE__*/React.createElement("button", {
    onClick: () => removeFromCart(l.code),
    style: {
      width: 28,
      height: 34,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      background: C.surface,
      cursor: "pointer",
      fontSize: 16,
      color: C.textFaint
    }
  }, "\xD7"))), cart.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("hr", {
    style: {
      ...S.divider,
      marginTop: 4
    }
  }), /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.textSub
    }
  }, "\u0418\u0442\u043E\u0433\u043E"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 19,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, total.toLocaleString(), " \u20B8")))), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.label,
      marginBottom: 10,
      display: "block"
    }
  }, "\u041A\u043B\u0438\u0435\u043D\u0442 ", remainder > 0 ? /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.red,
      fontWeight: 400
    }
  }, "(\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u0435\u043D \u0434\u043B\u044F \u0434\u043E\u043B\u0433\u0430)") : /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.textFaint,
      fontWeight: 400
    }
  }, "(\u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E)")), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    placeholder: "\u041D\u0430\u0447\u043D\u0438\u0442\u0435 \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u0435...",
    value: clientSearchText,
    onChange: e => {
      setClientSearchText(e.target.value);
      setClientId("");
      setShowClientDrop(true);
    },
    onFocus: () => setShowClientDrop(true),
    onBlur: () => setTimeout(() => setShowClientDrop(false), 180)
  }), showClientDrop && (() => {
    const matched = clientSearchText.length > 0 ? clients.filter(c => c.name.toLowerCase().includes(clientSearchText.toLowerCase())) : clients.slice(0, 50);
    return matched.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        zIndex: 50,
        maxHeight: 200,
        overflowY: "auto"
      }
    }, matched.map(c => /*#__PURE__*/React.createElement("div", {
      key: c.code,
      onMouseDown: () => {
        setClientId(c.code);
        setClientSearchText(c.name);
        setShowClientDrop(false);
      },
      style: {
        padding: "9px 12px",
        cursor: "pointer",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 15
      }
    }, c.name)));
  })())), /*#__PURE__*/React.createElement("div", {
    style: S.card
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 12px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u041E\u043F\u043B\u0430\u0442\u0430"), [{
    key: "cash",
    label: "Наличка",
    icon: "💵",
    bg: C.cashGreen,
    col: "#15803D"
  }, {
    key: "qr",
    label: "QR код",
    icon: "📲",
    bg: C.qrBlue,
    col: "#1D4ED8"
  }].map(({
    key,
    label,
    icon,
    bg,
    col
  }) => /*#__PURE__*/React.createElement("div", {
    key: key,
    style: {
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => toggleCashQr(key),
    style: {
      width: 22,
      height: 22,
      borderRadius: 6,
      border: `2px solid ${payType[key] ? col : C.border}`,
      background: payType[key] ? col : C.white,
      cursor: "pointer",
      flexShrink: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center"
    }
  }, payType[key] && /*#__PURE__*/React.createElement("span", {
    style: {
      color: C.white,
      fontSize: 15,
      fontWeight: 700
    }
  }, "\u2713")), /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 600,
      color: payType[key] ? col : C.textMid
    }
  }, icon, " ", label), payType[key] && /*#__PURE__*/React.createElement("input", {
    style: {
      flex: 1,
      border: `1.5px solid ${col}40`,
      borderRadius: 6,
      padding: "6px 10px",
      fontSize: 16,
      fontWeight: 600,
      outline: "none",
      background: bg,
      color: col
    },
    placeholder: "\u0421\u0443\u043C\u043C\u0430 \u20B8",
    value: payAmounts[key],
    onFocus: e => e.target.select(),
    onChange: e => setPayAmounts(a => ({
      ...a,
      [key]: e.target.value
    }))
  })))), /*#__PURE__*/React.createElement("div", {
    style: {
      padding: "12px 14px",
      borderRadius: 10,
      background: C.surface,
      border: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 6
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textSub
    }
  }, "\u0421\u0443\u043C\u043C\u0430 \u043F\u0440\u043E\u0434\u0430\u0436\u0438"), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      fontFamily: FH
    }
  }, total.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      paddingTop: 6,
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: overpaid ? C.red : remainder > 0 ? "#92400E" : C.green
    }
  }, overpaid ? "⚠️ Оплачено больше суммы" : remainder > 0 ? "📋 Долг" : "✅ Полностью оплачено"), (remainder > 0 || overpaid) && /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 800,
      fontSize: 17,
      fontFamily: FH,
      color: overpaid ? C.red : "#92400E"
    }
  }, (overpaid ? cashAmt + qrAmt - total : remainder).toLocaleString(), " \u20B8")))), error && /*#__PURE__*/React.createElement("div", {
    style: S.errorBox
  }, error), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSuccess,
      opacity: canSubmit ? 1 : 0.45,
      cursor: canSubmit ? "pointer" : "not-allowed"
    },
    disabled: !canSubmit,
    onClick: submit
  }, submitting ? "Оформление..." : "✅ Оплатить")))));
}
function AdminCabinet({
  user,
  onLogout,
  desktop
}) {
  const [tab, setTab] = useState("all");
  const [filter, setFilter] = useState("all");
  const [driverFilter, setDriverFilter] = useState("");
  const [salesFilter, setSalesFilter] = useState("");
  const [orderSearch, setOrderSearch] = useState("");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [products, setProducts] = useState([]);
  const loadProducts = useCallback(async () => {
    try {
      const data = await fetch('/api/products').then(r => r.json());
      setProducts(data);
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadProducts();
  }, []);
  const [aliasSearch, setAliasSearch] = useState("");
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
    if (targets.length === 0) {
      alert('Нет товаров со штрихкодом без кода НКТ');
      return;
    }
    setNktRunning(true);
    nktStopRef.current = false;
    const summary = {
      done: 0,
      total: targets.length,
      matched: 0,
      notFound: 0,
      noBarcode: 0,
      errors: 0
    };
    setNktProgress({
      ...summary
    });
    for (let i = 0; i < targets.length; i += 25) {
      if (nktStopRef.current) break;
      const batch = targets.slice(i, i + 25).map(p => p.code);
      try {
        const {
          results
        } = await apiCall('POST', '/api/nkt/match-batch', {
          codes: batch
        });
        results.forEach(r => {
          summary.done++;
          if (r.status === 'matched') summary.matched++;else if (r.status === 'not_found') summary.notFound++;else if (r.status === 'no_barcode') summary.noBarcode++;else summary.errors++;
        });
      } catch (e) {
        summary.done += batch.length;
        summary.errors += batch.length;
      }
      setNktProgress({
        ...summary
      });
    }
    await loadProducts();
    setNktRunning(false);
  }, [products, loadProducts]);
  const searchNktForProduct = useCallback(async p => {
    setNktPicker({
      code: p.code,
      loading: true,
      results: [],
      error: ''
    });
    try {
      const params = p.barcode ? `gtin=${encodeURIComponent(p.barcode)}` : `q=${encodeURIComponent(p.name)}`;
      const {
        results
      } = await apiCall('GET', `/api/nkt/search?${params}`);
      setNktPicker({
        code: p.code,
        loading: false,
        results,
        error: results.length === 0 ? 'Ничего не найдено' : ''
      });
    } catch (e) {
      setNktPicker({
        code: p.code,
        loading: false,
        results: [],
        error: e.message
      });
    }
  }, []);
  const pickNktResult = useCallback(async (code, ntinCode) => {
    try {
      await apiCall('POST', '/api/product-aliases', {
        code,
        nkt_code: ntinCode
      });
      await loadProducts();
    } catch (e) {
      alert(e.message);
    }
    setNktPicker(null);
  }, [loadProducts]);
  const saveNktCodeManually = useCallback(async (code, value) => {
    try {
      await apiCall('POST', '/api/product-aliases', {
        code,
        nkt_code: value
      });
      await loadProducts();
    } catch (e) {
      alert(e.message);
    }
  }, [loadProducts]);
  const [edits, setEdits] = useState({});
  const [savingCode, setSavingCode] = useState(null);
  const [editingCodes, setEditingCodes] = useState({});
  const [aliasSectionsOpen, setAliasSectionsOpen] = useState({
    unset: true,
    set: false
  });
  const [clients, setClients] = useState([]);
  const [clientSearch, setClientSearch] = useState("");
  const [clientEdits, setClientEdits] = useState({});
  const [savingClientCode, setSavingClientCode] = useState(null);
  const [editingClientCodes, setEditingClientCodes] = useState({});
  const todayStr = new Date().toISOString().slice(0, 10);
  const [dateFrom, setDateFrom] = useState(todayStr);
  const [dateTo, setDateTo] = useState(todayStr);
  const [adminPreset, setAdminPreset] = useState("day");
  const applyAdminPreset = preset => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);else if (preset === "month") from.setDate(now.getDate() - 29);
    setAdminPreset(preset);
    if (preset !== "custom") {
      setDateFrom(from.toISOString().slice(0, 10));
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
  const applyOrderDatePreset = preset => {
    const now = new Date();
    let from = new Date(now);
    if (preset === "week") from.setDate(now.getDate() - 6);else if (preset === "month") from.setDate(now.getDate() - 29);
    setOrderDatePreset(preset);
    if (preset !== "custom" && preset !== "all") {
      setOrderDateFrom(from.toISOString().slice(0, 10));
      setOrderDateTo(todayStr);
    }
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
  const [empSectionsOpen, setEmpSectionsOpen] = useState({
    noAccount: true,
    accounts: true,
    noStoreAccount: false
  });
  const loadEmployees = useCallback(async () => {
    try {
      setEmployees(await apiCall('GET', '/api/employees'));
    } catch (e) {}
  }, []);
  const loadUsers = useCallback(async () => {
    try {
      setUsers(await apiCall('GET', '/api/users'));
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadEmployees();
    loadUsers();
  }, []);
  const ROLE_OPTIONS = [["sales", "Торговый представитель"], ["senior_sales", "Старший торговый представитель"], ["driver", "Водитель"], ["cashier", "Кассир"], ["warehouse", "Зав. склад"], ["operator", "Оператор"], ["manager", "Менеджер"], ["admin", "Администратор"], ["store", "Магазин"]];
  const updateEmpForm = (formKey, field, value) => setEmpForm(f => ({
    ...f,
    [formKey]: {
      ...f[formKey],
      [field]: value
    }
  }));
  const createEmpAccount = async (emp, formKey) => {
    const form = empForm[formKey] || {};
    if (!form.login || !form.password || !form.role) {
      alert('Заполните логин, пароль и роль');
      return;
    }
    if (form.password.length < 4) {
      alert('Пароль минимум 4 символа');
      return;
    }
    setSavingEmp(formKey);
    try {
      await apiCall('POST', '/api/users', {
        login: form.login,
        password: form.password,
        name: emp.name,
        role: form.role,
        region: form.region || '',
        employee_code: emp.code
      });
      await loadEmployees();
      await loadUsers();
      setEmpForm(f => ({
        ...f,
        [formKey]: {}
      }));
    } catch (e) {
      alert(e.message);
    }
    setSavingEmp(null);
  };
  const createStoreAccount = async (client, formKey) => {
    const form = empForm[formKey] || {};
    if (!form.login || !form.password) {
      alert('Заполните логин и пароль');
      return;
    }
    if (form.password.length < 4) {
      alert('Пароль минимум 4 символа');
      return;
    }
    setSavingEmp(formKey);
    try {
      await apiCall('POST', '/api/users', {
        login: form.login,
        password: form.password,
        name: client.name,
        role: 'store',
        client_code: client.code
      });
      await loadClients();
      await loadUsers();
      setEmpForm(f => ({
        ...f,
        [formKey]: {}
      }));
    } catch (e) {
      alert(e.message);
    }
    setSavingEmp(null);
  };
  const toggleUser = async u => {
    if (!window.confirm(`${u.active === false ? 'Включить' : 'Отключить'} доступ для «${u.name}»?`)) return;
    setTogglingUser(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/toggle`, {});
      await loadUsers();
    } catch (e) {
      alert(e.message);
    }
    setTogglingUser(null);
  };
  const changeRole = async u => {
    const role = roleEdits[u.id];
    if (!role || role === u.role) return;
    if (!window.confirm(`Сменить роль «${u.name}» на «${ROLE_LABEL[role] || role}»?`)) return;
    setSavingRole(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/role`, {
        role
      });
      await loadUsers();
      setRoleEdits(r => {
        const n = {
          ...r
        };
        delete n[u.id];
        return n;
      });
    } catch (e) {
      alert(e.message);
    }
    setSavingRole(null);
  };
  const changePassword = async u => {
    const pwd = (passwordEdits[u.id] || '').trim();
    if (!pwd || pwd.length < 4) {
      alert('Пароль минимум 4 символа');
      return;
    }
    if (!window.confirm(`Сменить пароль для «${u.name}»?`)) return;
    setChangingPwd(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/password`, {
        password: pwd
      });
      setPasswordEdits(p => ({
        ...p,
        [u.id]: ''
      }));
    } catch (e) {
      alert(e.message);
    }
    setChangingPwd(null);
  };
  const resetUserSession = async u => {
    if (!window.confirm(`Сбросить активную сессию «${u.name}»? Это позволит войти с другого устройства прямо сейчас.`)) return;
    setResettingSession(u.id);
    try {
      await apiCall('PUT', `/api/users/${u.id}/reset-session`, {});
      await loadUsers();
    } catch (e) {
      alert(e.message);
    }
    setResettingSession(null);
  };
  const loadClients = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/clients');
      setClients(data);
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadClients();
  }, []);
  const getClientField = (c, field) => {
    if (clientEdits[c.code] && clientEdits[c.code][field] !== undefined) return clientEdits[c.code][field];
    return c[field] || '';
  };
  const updateClientField = (code, field, value) => setClientEdits(e => ({
    ...e,
    [code]: {
      ...e[code],
      [field]: value
    }
  }));
  const saveClientAddress = async c => {
    const code = c.code;
    const address = getClientField(c, 'address');
    setSavingClientCode(code);
    try {
      await apiCall('POST', '/api/client-addresses', {
        code,
        address
      });
      await loadClients();
      setEditingClientCodes(e => {
        const n = {
          ...e
        };
        delete n[code];
        return n;
      });
    } catch (e) {
      alert(e.message);
    }
    setSavingClientCode(null);
  };
  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch (e) {
      if (e.message.includes('токен')) onLogout();
    }
    setLoading(false);
  }, []);
  useEffect(() => {
    loadOrders();
  }, []);
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
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadCategories();
  }, []);
  const createCategory = useCallback(async name => {
    const trimmed = (name || '').trim();
    if (!trimmed) return;
    try {
      await apiCall('POST', '/api/categories', {
        name: trimmed
      });
      await loadCategories();
    } catch (e) {
      alert(e.message);
    }
  }, [loadCategories]);
  const renameCategory = useCallback(async (oldName, newName) => {
    const trimmed = (newName || '').trim();
    if (!trimmed || trimmed === oldName) return;
    try {
      await apiCall('PUT', `/api/categories/${encodeURIComponent(oldName)}`, {
        name: trimmed
      });
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (e) {
      alert(e.message);
    }
  }, [loadCategories, loadProducts]);
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState("");
  const deleteCategory = useCallback(async name => {
    if (!window.confirm(`Удалить раздел «${name}»? У товаров этот раздел будет снят (станут «Без раздела»).`)) return;
    try {
      await apiCall('DELETE', `/api/categories/${encodeURIComponent(name)}`);
      await Promise.all([loadCategories(), loadProducts()]);
    } catch (e) {
      alert(e.message);
    }
  }, [loadCategories, loadProducts]);

  // Касса — продажа по каталогу (мгновенная, без доставки). См. /api/sales
  // на сервере: отдельная от orders коллекция, но делит остаток и сводится
  // в один отчёт с заявками ниже (salesReport).
  const [sales, setSales] = useState([]);
  const [showPosModal, setShowPosModal] = useState(false);
  const loadSales = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/sales');
      setSales(data);
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadSales();
  }, []);

  // Погашения долгов (нал/QR) — нужны, чтобы в отчёте долг показывался как
  // остаток на сейчас, а не как изначально выданная сумма, и чтобы
  // погашенное наличкой/QR добавлялось в кассовую выручку того же периода.
  const [debtSettlements, setDebtSettlements] = useState([]);
  const loadDebtSettlements = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/debt-settlements');
      setDebtSettlements(data);
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadDebtSettlements();
  }, []);
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
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadReturns();
  }, []);
  useRefetchOnVisible(loadReturns);

  // Сдача налички водителями (инкассация) — см. POST/PUT /api/cash-handovers.
  const [cashHandovers, setCashHandovers] = useState([]);
  const loadCashHandovers = useCallback(async () => {
    try {
      setCashHandovers(await apiCall('GET', '/api/cash-handovers'));
    } catch (e) {}
  }, []);
  useEffect(() => {
    loadCashHandovers();
  }, []);
  useRefetchOnVisible(loadCashHandovers);
  const [fiscalizingSaleId, setFiscalizingSaleId] = useState(null);
  const [fiscalErrorBySale, setFiscalErrorBySale] = useState({});
  const retryFiscal = useCallback(async sale => {
    setFiscalizingSaleId(sale.id);
    setFiscalErrorBySale(e => ({
      ...e,
      [sale.id]: null
    }));
    try {
      const fiscal = await fiscalizeSale(sale);
      await apiCall('POST', `/api/sales/${sale.id}/fiscal`, fiscal);
      await loadSales();
    } catch (e) {
      setFiscalErrorBySale(er => ({
        ...er,
        [sale.id]: e.message
      }));
    }
    setFiscalizingSaleId(null);
  }, [loadSales]);
  const voidSale = useCallback(async sale => {
    if (!window.confirm(`Отменить продажу № ${sale.id} на ${sale.total.toLocaleString()} ₸? Остаток вернётся на склад.`)) return;
    try {
      let fiscalReturn = {};
      if (sale.fiscal_id) {
        // Чек уже пробит в ККМ/ОФД — без обратного чека возврата отмена в
        // самом CashCore/налоговой не отразится, сервер это тоже проверит
        // и откажет, но лучше объяснить кассиру заранее.
        try {
          const r = await fiscalizeSale(sale, 3); // OPERATION_SELL_RETURN
          fiscalReturn = {
            fiscal_return_id: r.fiscal_id,
            fiscal_return_qr: r.qr_code
          };
        } catch (fe) {
          alert(`Не удалось пробить чек возврата: ${fe.message}\n\nПродажа НЕ отменена — иначе в ОФД останется чек без документа возврата. Попробуйте ещё раз, когда касса будет доступна.`);
          return;
        }
      }
      await apiCall('POST', `/api/sales/${sale.id}/void`, fiscalReturn);
      await loadSales();
    } catch (e) {
      alert(e.message);
    }
  }, [loadSales]);
  const getField = (p, field) => {
    if (edits[p.code] && edits[p.code][field] !== undefined) return edits[p.code][field];
    if (field === 'alias') return p.has_alias ? p.display_name : '';
    if (field === 'category') return p.group || '';
    if (field === 'priced_by_weight') return !!p.priced_by_weight;
    return p[field] != null ? String(p[field]) : '';
  };
  const categoryOptions = useMemo(() => [...new Set([...products.map(p => p.group).filter(Boolean), ...categories])].sort((a, b) => a.localeCompare(b, 'ru')), [products, categories]);
  // updateField передаётся вниз в 150+ мемоизированных карточек, поэтому
  // должен иметь стабильную ссылку (useCallback без зависимостей, только
  // функциональный setState) — иначе React.memo на карточках бесполезен.
  const updateField = useCallback((code, field, value) => setEdits(e => ({
    ...e,
    [code]: {
      ...e[code],
      [field]: value
    }
  })), []);
  const onEditRequest = useCallback(code => setEditingCodes(e => ({
    ...e,
    [code]: true
  })), []);

  // saveAlias тоже должен быть стабильным, поэтому актуальные edits/products
  // читаем из ref, а не из замыкания над состоянием.
  const editsRef = useRef(edits);
  useEffect(() => {
    editsRef.current = edits;
  }, [edits]);
  const saveAlias = useCallback(async p => {
    const code = p.code;
    const fieldsFromEdits = editsRef.current[code] || {};
    const resolve = field => fieldsFromEdits[field] !== undefined ? fieldsFromEdits[field] : field === 'alias' ? p.has_alias ? p.display_name : '' : field === 'priced_by_weight' ? !!p.priced_by_weight : p[field] != null ? String(p[field]) : '';
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
        code,
        alias,
        price1: price1 === '' ? null : Number(price1),
        price2: price2 === '' ? null : Number(price2),
        price3: price3 === '' ? null : Number(price3),
        commission: commission === '' ? 0 : Number(commission),
        cost: cost === '' ? null : Number(cost),
        priced_by_weight: !!pricedByWeight,
        avg_box_weight: avgBoxWeight === '' ? null : Number(avgBoxWeight)
      });
      await loadProducts();
      setEditingCodes(e => {
        const n = {
          ...e
        };
        delete n[code];
        return n;
      });
    } catch (e) {
      alert(e.message);
    }
    setSavingCode(null);
  }, [loadProducts]);

  // Раздел (вкладка "Каталог") сохраняется отдельно от цен/названия — своя
  // кнопка "Сохр.", без запроса на разблокировку. Сервер шлёт только
  // {code, category}, alias в этот запрос не попадает (см. фикс в
  // POST /api/product-aliases — иначе тихо стёрло бы название сайта).
  const [savingCategoryCode, setSavingCategoryCode] = useState(null);
  const saveCategory = useCallback(async p => {
    const code = p.code;
    const fieldsFromEdits = editsRef.current[code] || {};
    const category = fieldsFromEdits.category !== undefined ? fieldsFromEdits.category : p.group || '';
    const barcode = fieldsFromEdits.barcode !== undefined ? fieldsFromEdits.barcode : p.barcode || '';
    setSavingCategoryCode(code);
    try {
      await apiCall('POST', '/api/product-aliases', {
        code,
        category,
        barcode
      });
      await loadProducts();
    } catch (e) {
      alert(e.message);
    }
    setSavingCategoryCode(null);
  }, [loadProducts]);

  // Стабильная ссылка (как saveAlias) — передаётся в 150+ мемоизированных
  // ProductCatalogCard. Ответственность карточки — сжать фото и показать
  // ошибку/спиннер; загрузка на сервер и обновление списка — здесь.
  const uploadProductPhoto = useCallback(async (code, imageBase64) => {
    await apiCall('POST', `/api/products/${code}/photo`, {
      imageBase64
    });
    await loadProducts();
  }, [loadProducts]);
  const removeProductPhoto = useCallback(async code => {
    await apiCall('DELETE', `/api/products/${code}/photo`);
    await loadProducts();
  }, [loadProducts]);
  const handleUpdate = async (id, status, payment, driverId) => {
    try {
      await apiCall('PUT', `/api/orders/${id}/status`, {
        status,
        payment,
        driverId
      });
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
  };
  const handleDelete = async id => {
    try {
      await apiCall('DELETE', `/api/orders/${id}`);
      setSelectedOrder(null);
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
  };
  const [expandedSales, setExpandedSales] = useState({});
  const [cashboxGroupBy, setCashboxGroupBy] = useState("driver");
  // Клик по кругляшкам НАЛ/QR/ДОЛГ в сводке "Касса за период" прокручивает
  // к соответствующему разделу ниже — вместо того чтобы заставлять
  // оператора искать долги/сдачу кассы листанием вручную.
  const debtorsSectionRef = useRef(null);
  const cashHandoverSectionRef = useRef(null);
  const scrollToSection = ref => ref.current && ref.current.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

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
    orders.forEach(o => {
      if (o.driver_id) map[o.driver_id] = o.driver_name;
    });
    return Object.entries(map).map(([id, name]) => ({
      id,
      name
    })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  }, [orders]);

  // Список торговых для отбора — из самих заявок, тем же паттерном, что и
  // driverOptions: только те, кто реально оформил хотя бы одну заявку.
  const salesOptions = useMemo(() => {
    const map = {};
    orders.forEach(o => {
      if (o.sales_id) map[o.sales_id] = o.sales_name;
    });
    return Object.entries(map).map(([id, name]) => ({
      id,
      name
    })).sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru'));
  }, [orders]);
  const q = orderSearch.trim().toLowerCase();
  const filtered = useMemo(() => orders.filter(o => filter === "all" || o.status === filter).filter(o => !driverFilter || String(o.driver_id) === driverFilter).filter(o => !salesFilter || String(o.sales_id) === salesFilter).filter(o => orderDatePreset === "all" || o.date >= orderDateFrom && o.date <= orderDateTo).filter(o => !q || String(o.id).includes(q) || (o.client_name || '').toLowerCase().includes(q) || (o.sales_name || '').toLowerCase().includes(q) || (o.driver_name || '').toLowerCase().includes(q) || (o.address || '').toLowerCase().includes(q)), [orders, filter, driverFilter, salesFilter, orderDatePreset, orderDateFrom, orderDateTo, q]);
  const {
    stats,
    repList,
    storeList,
    driverCashList,
    repCashList,
    posReport,
    returnsInfo
  } = useMemo(() => {
    // Погашение долга нал/QR "перетекает" из долга в наличку/QR того же
    // заказа/продажи — иначе касса за период не сходится с тем, что
    // оператор реально погасил, а долг в сводке зависает на изначальной
    // сумме, даже если по нему уже расплатились.
    const settledByOrder = {};
    const settledBySale = {};
    debtSettlements.forEach(s => {
      const bucket = s.order_id ? settledByOrder : settledBySale;
      const key = s.order_id || s.sale_id;
      if (!bucket[key]) bucket[key] = {
        cash: 0,
        qr: 0,
        total: 0
      };
      if (s.method === 'qr') bucket[key].qr += s.amount;else bucket[key].cash += s.amount;
      bucket[key].total += s.amount;
    });
    const orderSettledCash = o => (settledByOrder[o.id] || {}).cash || 0;
    const orderSettledQr = o => (settledByOrder[o.id] || {}).qr || 0;
    const orderRemainingDebt = o => Math.max(0, (o.payment_debt || 0) - ((settledByOrder[o.id] || {}).total || 0));
    const saleSettledCash = s => (settledBySale[s.id] || {}).cash || 0;
    const saleSettledQr = s => (settledBySale[s.id] || {}).qr || 0;
    const saleRemainingDebt = s => Math.max(0, (s.payment_debt || 0) - ((settledBySale[s.id] || {}).total || 0));
    const periodOrders = orders.filter(o => o.date >= dateFrom && o.date <= dateTo);
    const stats = {
      total: periodOrders.length,
      delivered: periodOrders.filter(o => o.status === "delivered").length,
      inTransit: periodOrders.filter(o => o.status === "in_transit").length,
      cancelled: periodOrders.filter(o => o.status === "cancelled").length,
      returned: periodOrders.filter(o => o.status === "returned").length,
      revenue: periodOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.total || 0), 0),
      cashTotal: periodOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.payment_cash || 0) + orderSettledCash(o), 0),
      qrTotal: periodOrders.filter(o => o.status === "delivered").reduce((s, o) => s + (o.payment_qr || 0) + orderSettledQr(o), 0),
      debtTotal: periodOrders.reduce((s, o) => s + orderRemainingDebt(o), 0)
    };
    const deliveredOrders = periodOrders.filter(o => o.status === "delivered");
    const ordersProfit = sumItemsProfit(deliveredOrders);
    stats.costTotal = ordersProfit.cost;
    stats.profit = ordersProfit.profit;
    stats.profitMissingLines = ordersProfit.missingCostLines;

    // Продажи по кассе за тот же период — отдельно от заявок на доставку,
    // но объединяем в общую сумму (combinedCash/Qr/Debt) ниже, чтобы
    // менеджер видел одну кассовую сумму, а не считал вручную по двум местам.
    const periodSales = sales.filter(s => s.date >= dateFrom && s.date <= dateTo && s.status !== "voided");
    const posReport = {
      count: periodSales.length,
      revenue: periodSales.reduce((s, o) => s + (o.total || 0), 0),
      cashTotal: periodSales.reduce((s, o) => s + (o.payment_cash || 0) + saleSettledCash(o), 0),
      qrTotal: periodSales.reduce((s, o) => s + (o.payment_qr || 0) + saleSettledQr(o), 0),
      debtTotal: periodSales.reduce((s, o) => s + saleRemainingDebt(o), 0),
      list: periodSales.slice().sort((a, b) => b.id - a.id),
      combinedCash: stats.cashTotal + periodSales.reduce((s, o) => s + (o.payment_cash || 0) + saleSettledCash(o), 0),
      combinedQr: stats.qrTotal + periodSales.reduce((s, o) => s + (o.payment_qr || 0) + saleSettledQr(o), 0),
      combinedDebt: stats.debtTotal + periodSales.reduce((s, o) => s + saleRemainingDebt(o), 0),
      combinedRevenue: stats.revenue + periodSales.reduce((s, o) => s + (o.total || 0), 0)
    };
    const salesProfit = sumItemsProfit(periodSales);
    posReport.costTotal = salesProfit.cost;
    posReport.profit = salesProfit.profit;
    posReport.profitMissingLines = salesProfit.missingCostLines;
    posReport.combinedCost = stats.costTotal + salesProfit.cost;
    posReport.combinedProfit = stats.profit + salesProfit.profit;
    posReport.combinedProfitMissingLines = stats.profitMissingLines + salesProfit.missingCostLines;
    const commissionByCode = {};
    products.forEach(p => {
      commissionByCode[p.code] = p.commission || 0;
    });
    // Разбито на два свода по order.source: "sales" — реальные торгпреды
    // (у них комиссия — их заработок), "store" — магазины, оформившие
    // заказ сами себе (sales_id там — это аккаунт самого магазина, не
    // сотрудник; раньше оба вида смешивались в одном списке под общим
    // заголовком "По торговым представителям", отличить можно было только
    // по имени в списке).
    const repBreakdown = {};
    const storeBreakdown = {};
    periodOrders.filter(o => o.status === "delivered").forEach(o => {
      const bucket = o.source === "store" ? storeBreakdown : repBreakdown;
      const key = o.sales_id;
      if (!bucket[key]) bucket[key] = {
        name: o.sales_name,
        revenue: 0,
        items: [],
        cash: 0,
        qr: 0,
        debt: 0,
        orders: 0
      };
      bucket[key].revenue += o.total || 0;
      bucket[key].cash += (o.payment_cash || 0) + orderSettledCash(o);
      bucket[key].qr += (o.payment_qr || 0) + orderSettledQr(o);
      bucket[key].debt += orderRemainingDebt(o);
      bucket[key].orders += 1;
      const orderItems = typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
      orderItems.forEach(it => {
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
        const frozenCommission = it.commission != null ? Number(it.commission) : it.code && commissionByCode[it.code] !== undefined ? commissionByCode[it.code] : 0;
        bucket[key].items.push({
          name: it.name,
          qty: it.qty,
          price: it.price,
          commission: frozenCommission,
          // Комиссия — фиксированная сумма в ₸ за единицу товара, а не % от
          // суммы строки (раньше было qty*price*commission/100).
          bonus: (Number(it.qty) || 0) * frozenCommission
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
    const periodReturns = returnsList.filter(r => r.date >= dateFrom && r.date <= dateTo);
    const returnsItemized = {
      count: periodReturns.length,
      revenue: periodReturns.reduce((s, r) => s + (r.total || 0), 0),
      cost: periodReturns.reduce((s, r) => s + (r.items || []).reduce((ss, it) => ss + (it.cost != null ? (Number(it.qty) || 0) * it.cost : 0), 0), 0),
      bonus: periodReturns.reduce((s, r) => s + (r.items || []).reduce((ss, it) => ss + (Number(it.qty) || 0) * (Number(it.commission) || 0), 0), 0),
      unattributed: periodReturns.filter(r => r.sales_id == null).reduce((s, r) => s + (r.total || 0), 0),
      list: periodReturns.slice().sort((a, b) => b.date.localeCompare(a.date))
    };
    periodReturns.forEach(r => {
      if (r.sales_id == null) return; // без привязки к торговому — только в общем итоге, бонус вычесть не у кого
      const key = r.sales_id;
      const targetBucket = storeBreakdown[key] ? storeBreakdown : repBreakdown;
      if (!targetBucket[key]) targetBucket[key] = {
        name: r.sales_name || '#' + key,
        revenue: 0,
        items: [],
        cash: 0,
        qr: 0,
        debt: 0,
        orders: 0
      };
      targetBucket[key].revenue -= r.total || 0;
      (r.items || []).forEach(it => {
        targetBucket[key].items.push({
          name: `↩️ Возврат: ${it.name}`,
          qty: -(Number(it.qty) || 0),
          price: it.price,
          commission: it.commission || 0,
          bonus: -(Number(it.qty) || 0) * (Number(it.commission) || 0)
        });
      });
    });
    const toList = breakdown => Object.entries(breakdown).map(([id, v]) => ({
      id,
      ...v,
      totalBonus: v.items.reduce((s, it) => s + it.bonus, 0)
    })).sort((a, b) => b.revenue - a.revenue);
    const repList = toList(repBreakdown);
    const storeList = toList(storeBreakdown);

    // Общий итог (combined*) — тоже за вычетом итемизированных возвратов,
    // иначе выручка/прибыль в сводке не сходится с тем, что уже вычтено
    // из бонусов торговых выше.
    posReport.combinedRevenue -= returnsItemized.revenue;
    posReport.combinedCost -= returnsItemized.cost;
    posReport.combinedProfit -= returnsItemized.revenue - returnsItemized.cost;

    // Возвраты за период: отказы/возвраты заявок (доставка не состоялась
    // или товар вернули) плюс отменённые продажи кассы. И то, и другое уже
    // снимает резерв остатка (см. computeAvailableStock на сервере), но
    // нигде не суммировалось как "сколько выручки не случилось из-за
    // возвратов" — только этот блок это считает.
    const lostOrders = periodOrders.filter(o => o.status === "cancelled" || o.status === "returned");
    const lostOrdersRevenue = lostOrders.reduce((s, o) => s + (o.total || 0), 0);
    const voidedSales = sales.filter(s => s.date >= dateFrom && s.date <= dateTo && s.status === "voided");
    const voidedSalesRevenue = voidedSales.reduce((s, o) => s + (o.total || 0), 0);
    // Плюс итемизированные возвраты (частично/после доставки, см. выше) —
    // раньше в эту сумму попадали только целиком отменённые заявки/продажи.
    const returnsRevenue = lostOrdersRevenue + voidedSalesRevenue + returnsItemized.revenue;
    const successfulRevenue = stats.revenue + periodSales.reduce((s, o) => s + (o.total || 0), 0);
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
      share: successfulRevenue + returnsRevenue > 0 ? returnsRevenue / (successfulRevenue + returnsRevenue) * 100 : 0
    };
    const cashByDriver = {};
    periodOrders.filter(o => o.status === "delivered" && o.driver_id).forEach(o => {
      const key = o.driver_id;
      if (!cashByDriver[key]) cashByDriver[key] = {
        name: o.driver_name,
        cash: 0,
        qr: 0,
        debt: 0,
        orders: 0
      };
      cashByDriver[key].cash += (o.payment_cash || 0) + orderSettledCash(o);
      cashByDriver[key].qr += (o.payment_qr || 0) + orderSettledQr(o);
      cashByDriver[key].debt += orderRemainingDebt(o);
      cashByDriver[key].orders += 1;
    });
    const driverCashList = Object.values(cashByDriver).sort((a, b) => b.cash - a.cash);
    // Та же сдача кассы, но сгруппированная по торговым представителям —
    // переключатель в разделе "Сдача кассы" даёт выбрать разрез (по
    // водителям, кто физически привёз наличку, или по торговым, чьи это
    // продажи и кому считать план/бонус).
    const repCashList = Object.entries(repBreakdown).map(([id, v]) => ({
      id,
      name: v.name,
      cash: v.cash,
      qr: v.qr,
      debt: v.debt,
      orders: v.orders
    })).sort((a, b) => b.cash - a.cash);
    return {
      stats,
      repList,
      storeList,
      driverCashList,
      repCashList,
      posReport,
      returnsInfo
    };
  }, [orders, sales, products, dateFrom, dateTo, debtSettlements, returnsList]);
  const FILTERS = [["all", "Все"], ["new", "Ожидает"], ["in_transit", "В работе"], ["delivered", "Доставлено"], ["cancelled", "Отказ"], ["returned", "Возврат"], ["revoked", "Отозвана"]];
  // Оператор — урезанная версия менеджера: только заявки/отчёт/касса, без
  // товаров/каталога/НКТ/сотрудников (и бэкенд эти эндпоинты ему не отдаёт).
  const TABS = user.role === "operator" ? [["all", "📋", "Заявки"], ["report", "📊", "Отчёт"], ["cashbox", "💵", "Касса"]] : [["all", "📋", "Заявки"], ["report", "📊", "Отчёт"], ["cashbox", "💵", "Касса"], ["aliases", "🏷", "Товары"], ["stock", "📦", "Остатки"], ["employees", "👤", "Сотрудники"]];
  const TAB_TITLES = {
    all: "Заявки",
    report: "Отчёт",
    cashbox: "Касса",
    aliases: "Псевдонимы товаров",
    stock: "Остатки",
    catalog: "Каталог",
    nkt: "Коды НКТ",
    employees: "Сотрудники"
  };
  const dateRangeInputs = /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16,
      maxWidth: 420
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 10,
      flexWrap: "wrap"
    }
  }, [["day", "День"], ["week", "Неделя"], ["month", "Месяц"], ["custom", "Свободный отбор"]].map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => applyAdminPreset(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${adminPreset === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: adminPreset === k ? C.navy : C.white,
      color: adminPreset === k ? C.white : C.textMid
    }
  }, lb))), adminPreset === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u0421"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: dateFrom,
    onChange: e => setDateFrom(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u041F\u043E"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: dateTo,
    onChange: e => setDateTo(e.target.value)
  }))));
  const filterChips = /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 16,
      flexWrap: "wrap"
    }
  }, FILTERS.map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => setFilter(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${filter === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: filter === k ? C.navy : C.white,
      color: filter === k ? C.white : C.textMid
    }
  }, lb)));
  const orderDateFilterUI = /*#__PURE__*/React.createElement("div", {
    style: {
      marginBottom: 16
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: orderDatePreset === "custom" ? 10 : 0,
      flexWrap: "wrap"
    }
  }, [["all", "Все"], ["day", "День"], ["week", "Неделя"], ["month", "Месяц"], ["custom", "Свободный отбор"]].map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    onClick: () => applyOrderDatePreset(k),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${orderDatePreset === k ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: orderDatePreset === k ? C.navy : C.white,
      color: orderDatePreset === k ? C.white : C.textMid
    }
  }, lb))), orderDatePreset === "custom" && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap",
      maxWidth: 420
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u0421"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: orderDateFrom,
    onChange: e => setOrderDateFrom(e.target.value)
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      flex: 1,
      minWidth: 120
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      marginBottom: 4
    }
  }, "\u041F\u043E"), /*#__PURE__*/React.createElement("input", {
    type: "date",
    style: {
      ...S.input,
      padding: "8px 10px",
      fontSize: 15
    },
    value: orderDateTo,
    onChange: e => setOrderDateTo(e.target.value)
  }))));
  const driverFilterChips = driverOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 16,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textFaint,
      fontWeight: 600
    }
  }, "\u0412\u043E\u0434\u0438\u0442\u0435\u043B\u044C:"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setDriverFilter(""),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${driverFilter === "" ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: driverFilter === "" ? C.navy : C.white,
      color: driverFilter === "" ? C.white : C.textMid
    }
  }, "\u0412\u0441\u0435"), driverOptions.map(d => /*#__PURE__*/React.createElement("button", {
    key: d.id,
    onClick: () => setDriverFilter(String(d.id)),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${driverFilter === String(d.id) ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: driverFilter === String(d.id) ? C.navy : C.white,
      color: driverFilter === String(d.id) ? C.white : C.textMid
    }
  }, d.name)));
  const salesFilterChips = salesOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 16,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textFaint,
      fontWeight: 600
    }
  }, "\u0422\u043E\u0440\u0433\u043E\u0432\u044B\u0439:"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setSalesFilter(""),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${salesFilter === "" ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: salesFilter === "" ? C.navy : C.white,
      color: salesFilter === "" ? C.white : C.textMid
    }
  }, "\u0412\u0441\u0435"), salesOptions.map(s => /*#__PURE__*/React.createElement("button", {
    key: s.id,
    onClick: () => setSalesFilter(String(s.id)),
    style: {
      padding: "6px 13px",
      borderRadius: 99,
      border: `1px solid ${salesFilter === String(s.id) ? C.navy : C.border}`,
      cursor: "pointer",
      fontSize: 14,
      fontWeight: 600,
      background: salesFilter === String(s.id) ? C.navy : C.white,
      color: salesFilter === String(s.id) ? C.white : C.textMid
    }
  }, s.name)));
  const searchInput = /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      maxWidth: desktop ? 360 : "100%",
      marginBottom: 12
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u043E\u043C\u0435\u0440\u0443, \u043A\u043B\u0438\u0435\u043D\u0442\u0443, \u0442\u043E\u0440\u0433\u043E\u0432\u043E\u043C\u0443\u2026",
    value: orderSearch,
    onChange: e => setOrderSearch(e.target.value),
    autoComplete: "off",
    name: "order-search"
  });
  const ordersTable = /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.white,
      border: `1px solid ${C.border}`,
      borderRadius: R,
      overflow: "hidden"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      overflowX: "auto"
    }
  }, /*#__PURE__*/React.createElement("table", {
    style: {
      width: "100%",
      borderCollapse: "collapse"
    }
  }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", null, ["№", "Клиент", "Торговый", "Взял на доставку", "Сумма", "Оплата", "Статус"].map((h, i) => /*#__PURE__*/React.createElement("th", {
    key: i,
    style: S.th
  }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.map(o => {
    const payment = {
      cash: o.payment_cash || 0,
      qr: o.payment_qr || 0,
      debt: o.payment_debt || 0
    };
    return /*#__PURE__*/React.createElement("tr", {
      key: o.id,
      className: "rowh",
      onClick: () => setSelectedOrder(o),
      style: {
        cursor: "pointer"
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        ...S.td,
        fontFamily: FH,
        fontWeight: 800
      }
    }, o.id), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600
      }
    }, o.client_name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: C.textSub
      }
    }, o.address, o.time_slot ? ' · ' + o.time_slot : '')), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, o.sales_name), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, o.driver_name || /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.textSub,
        fontStyle: "italic",
        fontSize: 15
      }
    }, "\u043D\u0435 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D"), o.delivery_photo && /*#__PURE__*/React.createElement("span", {
      title: "\u0415\u0441\u0442\u044C \u0444\u043E\u0442\u043E \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u043E\u0439",
      style: {
        marginLeft: 6
      }
    }, "\uD83D\uDCF7")), /*#__PURE__*/React.createElement("td", {
      style: {
        ...S.td,
        fontFamily: FH,
        fontWeight: 800,
        whiteSpace: "nowrap"
      }
    }, (o.total || 0).toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, /*#__PURE__*/React.createElement(PaymentTags, {
      payment: payment
    })), /*#__PURE__*/React.createElement("td", {
      style: S.td
    }, /*#__PURE__*/React.createElement(StatusBadge, {
      status: o.status
    })));
  }), filtered.length === 0 && /*#__PURE__*/React.createElement("tr", null, /*#__PURE__*/React.createElement("td", {
    colSpan: "7",
    style: {
      ...S.td,
      textAlign: "center",
      color: C.textFaint,
      padding: "40px 0"
    }
  }, "\u0417\u0430\u044F\u0432\u043E\u043A \u043D\u0435\u0442"))))));
  const content = /*#__PURE__*/React.createElement(React.Fragment, null, tab === "all" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u0412\u0441\u0435 \u0437\u0430\u044F\u0432\u043A\u0438"), searchInput, orderDateFilterUI, filterChips, driverFilterChips, salesFilterChips, !loading && filtered.length > 0 && /*#__PURE__*/React.createElement("button", {
    onClick: () => printWaybillsBatch(filtered),
    style: {
      ...S.btnOutline,
      width: "auto",
      marginTop: 0,
      marginBottom: 16,
      padding: "9px 16px",
      fontSize: 14
    }
  }, "\uD83D\uDDA8 \u041F\u0435\u0447\u0430\u0442\u044C \u043D\u0430\u043A\u043B\u0430\u0434\u043D\u044B\u0445 (", filtered.length, ")"), loading ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : desktop ? ordersTable : filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDCCB"), /*#__PURE__*/React.createElement("p", null, "\u0417\u0430\u044F\u0432\u043E\u043A \u043D\u0435\u0442")) : filtered.map(o => /*#__PURE__*/React.createElement(OrderCard, {
    key: o.id,
    order: o,
    onOpen: setSelectedOrder
  }))), tab === "report" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041E\u0442\u0447\u0451\u0442"), dateRangeInputs, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.statsRow,
      gridTemplateColumns: desktop ? "repeat(5, minmax(0,1fr))" : "1fr 1fr",
      maxWidth: desktop ? 900 : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum()
  }, stats.total), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412\u0441\u0435\u0433\u043E")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.green)
  }, stats.delivered), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0414\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.amber)
  }, stats.inTransit), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412 \u0440\u0430\u0431\u043E\u0442\u0435")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.red)
  }, stats.cancelled), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u041D\u0435 \u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum("#7C3AED")
  }, stats.returned), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412\u043E\u0437\u0432\u0440\u0430\u0442\u043E\u0432"))), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.revenueCard,
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: S.revenueLabel
  }, "\u041E\u0431\u0449\u0430\u044F \u0432\u044B\u0440\u0443\u0447\u043A\u0430"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.revenueNum,
      marginBottom: 14
    }
  }, stats.revenue.toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8
    }
  }, [{
    label: "Наличка",
    val: stats.cashTotal,
    bg: C.cashGreen,
    col: "#15803D"
  }, {
    label: "QR код",
    val: stats.qrTotal,
    bg: C.qrBlue,
    col: "#1D4ED8"
  }, {
    label: "Долг",
    val: stats.debtTotal,
    bg: C.debtAmber,
    col: "#92400E"
  }].map(({
    label,
    val,
    bg,
    col
  }) => /*#__PURE__*/React.createElement("div", {
    key: label,
    style: {
      background: bg,
      borderRadius: 10,
      padding: "10px 8px"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: col,
      fontWeight: 700
    }
  }, label.toUpperCase()), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 800,
      fontFamily: FH,
      color: col
    }
  }, (val || 0).toLocaleString(), " \u20B8"))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement(ProfitBlock, {
    revenue: stats.revenue,
    cost: stats.costTotal,
    profit: stats.profit,
    missingLines: stats.profitMissingLines
  })), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u0412\u043E\u0437\u0432\u0440\u0430\u0442\u044B \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowReturnModal(true),
    style: {
      padding: "6px 12px",
      borderRadius: 8,
      border: `1.5px solid #7C3AED`,
      background: C.white,
      color: "#7C3AED",
      fontSize: 13,
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "\u21A9\uFE0F \u041E\u0444\u043E\u0440\u043C\u0438\u0442\u044C \u0432\u043E\u0437\u0432\u0440\u0430\u0442")), returnsInfo.count === 0 ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      color: C.textSub
    }
  }, "\u0412\u043E\u0437\u0432\u0440\u0430\u0442\u043E\u0432 \u0438 \u043E\u0442\u043A\u0430\u0437\u043E\u0432 \u043D\u0435 \u0431\u044B\u043B\u043E.") : /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: C.textFaint,
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, "\u0421\u043B\u0443\u0447\u0430\u0435\u0432"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: C.text
    }
  }, returnsInfo.count)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: C.textFaint,
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, "\u0421\u0443\u043C\u043C\u0430"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: C.red
    }
  }, returnsInfo.revenue.toLocaleString(undefined, {
    maximumFractionDigits: 0
  }), " \u20B8")), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: C.textFaint,
      fontWeight: 700,
      textTransform: "uppercase"
    }
  }, "\u0414\u043E\u043B\u044F \u043E\u0431\u043E\u0440\u043E\u0442\u0430"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 17,
      fontWeight: 800,
      fontFamily: FH,
      color: C.red
    }
  }, returnsInfo.share.toFixed(1), "%"))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 13.5,
      color: C.textSub
    }
  }, "\u0417\u0430\u044F\u0432\u043A\u0438 (\u043E\u0442\u043A\u0430\u0437/\u0432\u043E\u0437\u0432\u0440\u0430\u0442 \u0446\u0435\u043B\u0438\u043A\u043E\u043C): ", returnsInfo.ordersCount, " \u043D\u0430 ", returnsInfo.ordersRevenue.toLocaleString(), " \u20B8 \xB7", " ", "\u041E\u0442\u043C\u0435\u043D\u0451\u043D\u043D\u044B\u0435 \u043F\u0440\u043E\u0434\u0430\u0436\u0438 \u043A\u0430\u0441\u0441\u044B: ", returnsInfo.salesCount, " \u043D\u0430 ", returnsInfo.salesRevenue.toLocaleString(), " \u20B8 \xB7", " ", "\u0427\u0430\u0441\u0442\u0438\u0447\u043D\u044B\u0435/\u043F\u043E\u0441\u043B\u0435 \u0434\u043E\u0441\u0442\u0430\u0432\u043A\u0438: ", returnsInfo.itemized.count, " \u043D\u0430 ", returnsInfo.itemized.revenue.toLocaleString(), " \u20B8"), returnsInfo.itemized.unattributed > 0 && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 12.5,
      color: "#92400E",
      background: "#FFFBEB",
      border: "1px solid #FDE68A",
      borderRadius: 8,
      padding: "7px 10px"
    }
  }, "\u26A0\uFE0F \u0418\u0437 \u043D\u0438\u0445 ", returnsInfo.itemized.unattributed.toLocaleString(), " \u20B8 \u2014 \u0431\u0435\u0437 \u043F\u0440\u0438\u0432\u044F\u0437\u043A\u0438 \u043A \u0442\u043E\u0440\u0433\u043E\u0432\u043E\u043C\u0443 (\u043D\u0435 \u0441 \u043A\u043E\u0433\u043E \u0441\u043F\u0438\u0441\u0430\u0442\u044C \u0431\u043E\u043D\u0443\u0441)."), returnsInfo.itemized.list.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${C.border}`
    }
  }, returnsInfo.itemized.list.map(r => /*#__PURE__*/React.createElement("div", {
    key: r.id,
    style: {
      marginBottom: 8,
      fontSize: 13
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 600
    }
  }, r.date, " \xB7 ", r.client_name, r.order_id ? ` (заявка №${r.order_id})` : ''), /*#__PURE__*/React.createElement("span", {
    style: {
      fontWeight: 700,
      color: C.red
    }
  }, "\u2212", r.total.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "2px 0 0",
      fontSize: 12,
      color: C.textFaint
    }
  }, r.items.map(it => `${it.name} × ${it.qty}`).join(', '), r.sales_name ? ` · торговый: ${r.sales_name}` : ' · без торгового', r.reason ? ` · причина: ${r.reason}` : ''))))))), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginTop: 10
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 10px",
      fontSize: 15,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u0421\u0434\u0430\u0447\u0430 \u043D\u0430\u043B\u0438\u0447\u043A\u0438 \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F\u043C\u0438"), (() => {
    const periodHandovers = cashHandovers.filter(h => h.date >= dateFrom && h.date <= dateTo);
    const pending = periodHandovers.filter(h => h.status === "pending");
    const confirmed = periodHandovers.filter(h => h.status === "confirmed");
    const shortfalls = confirmed.filter(h => h.difference < 0);
    if (periodHandovers.length === 0) return /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 15,
        color: C.textSub
      }
    }, "\u0417\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u0441\u0434\u0430\u0447 \u043D\u0435 \u0431\u044B\u043B\u043E.");
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        marginBottom: 10
      }
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: C.textFaint,
        fontWeight: 700,
        textTransform: "uppercase"
      }
    }, "\u0421\u0434\u0430\u0447"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 17,
        fontWeight: 800,
        fontFamily: FH,
        color: C.text
      }
    }, periodHandovers.length)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: C.textFaint,
        fontWeight: 700,
        textTransform: "uppercase"
      }
    }, "\u041E\u0436\u0438\u0434\u0430\u044E\u0442"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 17,
        fontWeight: 800,
        fontFamily: FH,
        color: pending.length > 0 ? "#92400E" : C.text
      }
    }, pending.length)), /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: C.textFaint,
        fontWeight: 700,
        textTransform: "uppercase"
      }
    }, "\u041D\u0435\u0434\u043E\u0441\u0442\u0430\u0447"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 17,
        fontWeight: 800,
        fontFamily: FH,
        color: shortfalls.length > 0 ? C.red : C.text
      }
    }, shortfalls.length))), periodHandovers.slice().sort((a, b) => b.id - a.id).map(h => /*#__PURE__*/React.createElement("div", {
      key: h.id,
      style: {
        marginBottom: 8,
        fontSize: 13.5,
        paddingBottom: 8,
        borderBottom: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: S.row
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 600
      }
    }, h.date, " \xB7 ", h.driver_name), /*#__PURE__*/React.createElement("span", {
      style: {
        fontWeight: 700,
        color: h.status === "pending" ? "#92400E" : h.difference < 0 ? C.red : h.difference > 0 ? C.green : C.textSub
      }
    }, h.status === "pending" ? "⏳ Ожидает" : h.difference === 0 ? "✓ Сошлось" : `${h.difference < 0 ? '−' : '+'}${Math.abs(h.difference).toLocaleString()} ₸`)), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "2px 0 0",
        fontSize: 12,
        color: C.textFaint
      }
    }, "\u041E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ", h.expected_amount.toLocaleString(), " \u20B8", h.status === "confirmed" ? ` · принято ${h.actual_amount.toLocaleString()} ₸` : '', h.comment ? ` · ${h.comment}` : ''))));
  })())), (() => {
    // Обычная функция, возвращающая JSX (не JSX-компонент) — тот же
    // приём, что и renderAliasSection/renderEmpSection выше: если
    // объявить как <RenderSalesEntity/>, React считает её новым типом
    // компонента на каждый рендер AdminCabinet и сбрасывает
    // expandedSales/раскрытые карточки.
    const renderSalesEntity = s => /*#__PURE__*/React.createElement("div", {
      key: s.id,
      style: S.card
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.row,
        cursor: "pointer"
      },
      onClick: () => setExpandedSales(e => ({
        ...e,
        [s.id]: !e[s.id]
      }))
    }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
      style: S.cardTitle
    }, s.name), /*#__PURE__*/React.createElement("p", {
      style: S.cardSub
    }, s.items.length, " \u043F\u043E\u0437. \u043F\u0440\u043E\u0434\u0430\u043D\u043E")), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontWeight: 800,
        fontFamily: FH,
        color: C.navy
      }
    }, s.revenue.toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 13,
        color: C.textFaint
      }
    }, expandedSales[s.id] ? "▲ Свернуть" : "▼ Подробнее"))), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.cashGreen,
        borderRadius: 10,
        padding: "8px 10px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: "#15803D",
        fontWeight: 700
      }
    }, "\u041D\u0410\u041B\u0418\u0427\u041A\u0410"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 16,
        fontWeight: 800,
        fontFamily: FH,
        color: "#15803D"
      }
    }, (s.cash || 0).toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.qrBlue,
        borderRadius: 10,
        padding: "8px 10px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: "#1D4ED8",
        fontWeight: 700
      }
    }, "QR"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 16,
        fontWeight: 800,
        fontFamily: FH,
        color: "#1D4ED8"
      }
    }, (s.qr || 0).toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.debtAmber,
        borderRadius: 10,
        padding: "8px 10px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: "#92400E",
        fontWeight: 700
      }
    }, "\u0414\u041E\u041B\u0413"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 16,
        fontWeight: 800,
        fontFamily: FH,
        color: "#92400E"
      }
    }, (s.debt || 0).toLocaleString(), " \u20B8"))), expandedSales[s.id] && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 10,
        paddingTop: 10,
        borderTop: `1px solid ${C.border}`
      }
    }, s.items.map((it, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: {
        ...S.row,
        marginBottom: 6,
        fontSize: 14,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.textMid,
        flex: 1
      }
    }, it.name, " ", /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.textFaint
      }
    }, "\xD7", it.qty)), /*#__PURE__*/React.createElement("span", {
      style: {
        color: C.textSub,
        textAlign: "right"
      }
    }, it.commission, " \u20B8 \xD7 ", it.qty, " = ", /*#__PURE__*/React.createElement("strong", {
      style: {
        color: C.green
      }
    }, it.bonus.toLocaleString(undefined, {
      maximumFractionDigits: 0
    }), " \u20B8")))), /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.row,
        marginTop: 8,
        paddingTop: 8,
        borderTop: `1px solid ${C.border}`,
        fontWeight: 700
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 15,
        color: C.textMid
      }
    }, "\u0418\u0442\u043E\u0433\u043E \u0431\u043E\u043D\u0443\u0441"), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 17,
        fontFamily: FH,
        fontWeight: 800,
        color: C.green
      }
    }, s.totalBonus.toLocaleString(undefined, {
      maximumFractionDigits: 0
    }), " \u20B8"))));
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: desktop ? 560 : "none"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.sectionTitle,
        fontSize: 17,
        marginTop: 8
      }
    }, "\u041F\u043E \u0442\u043E\u0440\u0433\u043E\u0432\u044B\u043C \u043F\u0440\u0435\u0434\u0441\u0442\u0430\u0432\u0438\u0442\u0435\u043B\u044F\u043C"), repList.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "32px 0",
        color: C.textFaint
      }
    }, "\u041D\u0435\u0442 \u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043D\u044B\u0445 \u0437\u0430\u044F\u0432\u043E\u043A \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434") : repList.map(renderSalesEntity)), /*#__PURE__*/React.createElement("div", {
      style: {
        maxWidth: desktop ? 560 : "none"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.sectionTitle,
        fontSize: 17,
        marginTop: 20
      }
    }, "\u041C\u0430\u0433\u0430\u0437\u0438\u043D\u044B (\u0441\u0430\u043C\u043E\u0437\u0430\u043A\u0430\u0437)"), storeList.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "32px 0",
        color: C.textFaint
      }
    }, "\u041D\u0435\u0442 \u0441\u0430\u043C\u043E\u0441\u0442\u043E\u044F\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u0437\u0430\u043A\u0430\u0437\u043E\u0432 \u043E\u0442 \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u043E\u0432 \u0437\u0430 \u044D\u0442\u043E\u0442 \u043F\u0435\u0440\u0438\u043E\u0434") : storeList.map(renderSalesEntity)));
  })()), tab === "cashbox" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041A\u0430\u0441\u0441\u0430"), user.role !== "operator" && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.bigCreate,
      marginBottom: 16
    },
    onClick: () => setShowPosModal(true)
  }, /*#__PURE__*/React.createElement("span", {
    style: S.bigCreatePlus
  }, "+"), " \u041D\u043E\u0432\u0430\u044F \u043F\u0440\u043E\u0434\u0430\u0436\u0430")), dateRangeInputs, /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17
    }
  }, "\u041A\u0430\u0441\u0441\u0430 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 (\u0437\u0430\u044F\u0432\u043A\u0438 + \u043F\u0440\u043E\u0434\u0430\u0436\u0438)"), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.revenueCard
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: S.revenueLabel
  }, "\u041E\u0431\u0449\u0430\u044F \u0432\u044B\u0440\u0443\u0447\u043A\u0430"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.revenueNum,
      marginBottom: 14
    }
  }, posReport.combinedRevenue.toLocaleString(), " \u20B8"), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "grid",
      gridTemplateColumns: "1fr 1fr 1fr",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    onClick: () => scrollToSection(cashHandoverSectionRef),
    style: {
      background: C.cashGreen,
      borderRadius: 10,
      padding: "10px 8px",
      cursor: "pointer"
    },
    title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u043E \u0442\u043E\u0440\u0433\u043E\u0432\u044B\u043C/\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F\u043C"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: "#15803D",
      fontWeight: 700
    }
  }, "\u041D\u0410\u041B\u0418\u0427\u041A\u0410"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 800,
      fontFamily: FH,
      color: "#15803D"
    }
  }, posReport.combinedCash.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    onClick: () => scrollToSection(cashHandoverSectionRef),
    style: {
      background: C.qrBlue,
      borderRadius: 10,
      padding: "10px 8px",
      cursor: "pointer"
    },
    title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u043F\u043E \u0442\u043E\u0440\u0433\u043E\u0432\u044B\u043C/\u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F\u043C"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: "#1D4ED8",
      fontWeight: 700
    }
  }, "QR"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 800,
      fontFamily: FH,
      color: "#1D4ED8"
    }
  }, posReport.combinedQr.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
    onClick: () => scrollToSection(debtorsSectionRef),
    style: {
      background: C.debtAmber,
      borderRadius: 10,
      padding: "10px 8px",
      cursor: "pointer"
    },
    title: "\u041F\u043E\u043A\u0430\u0437\u0430\u0442\u044C \u0434\u043E\u043B\u0436\u043D\u0438\u043A\u043E\u0432"
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 2px",
      fontSize: 12,
      color: "#92400E",
      fontWeight: 700
    }
  }, "\u0414\u041E\u041B\u0413"), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 800,
      fontFamily: FH,
      color: "#92400E"
    }
  }, posReport.combinedDebt.toLocaleString(), " \u20B8")))), /*#__PURE__*/React.createElement(ProfitBlock, {
    revenue: posReport.combinedRevenue,
    cost: posReport.combinedCost,
    profit: posReport.combinedProfit,
    missingLines: posReport.combinedProfitMissingLines
  })), user.role !== "operator" && /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17,
      marginTop: 20
    }
  }, "\u041F\u0440\u043E\u0434\u0430\u0436\u0438 \u043F\u043E \u043A\u0430\u0441\u0441\u0435 (", posReport.count, ")"), posReport.list.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u041F\u0440\u043E\u0434\u0430\u0436 \u0437\u0430 \u043F\u0435\u0440\u0438\u043E\u0434 \u043D\u0435 \u0431\u044B\u043B\u043E") : posReport.list.map(s => /*#__PURE__*/React.createElement("div", {
    key: s.id,
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, "\u2116 ", s.id, " \xB7 ", s.client_name || "Без клиента"), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, s.items.length, " \u043F\u043E\u0437. \xB7 ", s.created_by_name, " \xB7 ", new Date(s.created_at).toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  }))), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontWeight: 800,
      fontFamily: FH,
      color: C.navy
    }
  }, s.total.toLocaleString(), " \u20B8")), s.fiscal_id ? /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "8px 0 0",
      fontSize: 13,
      color: C.green
    }
  }, "\uD83E\uDDFE \u0427\u0435\u043A \u043F\u0440\u043E\u0431\u0438\u0442 \xB7 \u043F\u0440\u0438\u0437\u043D\u0430\u043A ", s.fiscal_id, s.fiscal_return_id && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("br", null), "\u21A9\uFE0F \u0427\u0435\u043A \u0432\u043E\u0437\u0432\u0440\u0430\u0442\u0430 \u043F\u0440\u043E\u0431\u0438\u0442 \xB7 \u043F\u0440\u0438\u0437\u043D\u0430\u043A ", s.fiscal_return_id)) : s.status !== "voided" && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 8
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "0 0 6px",
      fontSize: 13,
      color: s.payment_debt > 0 ? C.textFaint : C.red
    }
  }, s.payment_debt > 0 ? "Чек не пробит (продажа с долгом — пробить можно после погашения)" : "⚠️ Чек не пробит"), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      padding: "6px 14px",
      fontSize: 14,
      width: "auto",
      opacity: fiscalizingSaleId === s.id ? 0.6 : 1
    },
    disabled: fiscalizingSaleId === s.id,
    onClick: () => retryFiscal(s)
  }, fiscalizingSaleId === s.id ? "Пробиваю..." : "🔁 Пробить чек"), fiscalErrorBySale[s.id] && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 13,
      color: C.red
    }
  }, fiscalErrorBySale[s.id])), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnDanger,
      marginTop: 10,
      padding: "8px",
      fontSize: 14
    },
    onClick: () => voidSale(s)
  }, "\u041E\u0442\u043C\u0435\u043D\u0438\u0442\u044C \u043F\u0440\u043E\u0434\u0430\u0436\u0443")))), /*#__PURE__*/React.createElement("div", {
    ref: debtorsSectionRef,
    style: {
      maxWidth: desktop ? 560 : "none",
      marginTop: 20
    }
  }, /*#__PURE__*/React.createElement(DebtsPanel, null)), /*#__PURE__*/React.createElement("div", {
    ref: cashHandoverSectionRef,
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, (() => {
    // Оператору "по водителям" не нужен — он работает с торговыми
    // (заявки/долги/аналитика), сдачу наличности от водителей
    // курирует менеджер/админ, поэтому у оператора переключателя
    // нет вовсе, всегда разрез по торговым.
    const groupBy = user.role === "operator" ? "rep" : cashboxGroupBy;
    const list = groupBy === "driver" ? driverCashList : repCashList;
    return /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: 8,
        marginTop: 20
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.sectionTitle,
        fontSize: 17,
        margin: 0
      }
    }, groupBy === "driver" ? "Сдача кассы по водителям" : "Сдача кассы по торговым"), user.role !== "operator" && /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 6
      }
    }, [["driver", "По водителям"], ["rep", "По торговым"]].map(([k, lb]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      onClick: () => setCashboxGroupBy(k),
      style: {
        padding: "5px 11px",
        borderRadius: 99,
        border: `1px solid ${cashboxGroupBy === k ? C.navy : C.border}`,
        cursor: "pointer",
        fontSize: 13.5,
        fontWeight: 600,
        background: cashboxGroupBy === k ? C.navy : C.white,
        color: cashboxGroupBy === k ? C.white : C.textMid
      }
    }, lb)))), list.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "24px 0",
        color: C.textFaint
      }
    }, groupBy === "driver" ? "Нет закрытых водителями заявок за период" : "Нет доставленных заявок по торговым за период") : list.map((d, i) => /*#__PURE__*/React.createElement("div", {
      key: i,
      style: S.card
    }, /*#__PURE__*/React.createElement("p", {
      style: S.cardTitle
    }, d.name), /*#__PURE__*/React.createElement("p", {
      style: S.cardSub
    }, d.orders, " \u0437\u0430\u044F\u0432\u043E\u043A \u0434\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u043E"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr 1fr",
        gap: 8,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.cashGreen,
        borderRadius: 10,
        padding: "8px 10px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: "#15803D",
        fontWeight: 700
      }
    }, "\u041D\u0410\u041B\u0418\u0427\u041A\u0410"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 16,
        fontWeight: 800,
        fontFamily: FH,
        color: "#15803D"
      }
    }, d.cash.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.qrBlue,
        borderRadius: 10,
        padding: "8px 10px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: "#1D4ED8",
        fontWeight: 700
      }
    }, "QR"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 16,
        fontWeight: 800,
        fontFamily: FH,
        color: "#1D4ED8"
      }
    }, d.qr.toLocaleString(), " \u20B8")), /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.debtAmber,
        borderRadius: 10,
        padding: "8px 10px"
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "0 0 2px",
        fontSize: 12,
        color: "#92400E",
        fontWeight: 700
      }
    }, "\u0414\u041E\u041B\u0413"), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: 0,
        fontSize: 16,
        fontWeight: 800,
        fontFamily: FH,
        color: "#92400E"
      }
    }, d.debt.toLocaleString(), " \u20B8"))))));
  })())), tab === "aliases" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041F\u0441\u0435\u0432\u0434\u043E\u043D\u0438\u043C\u044B \u0442\u043E\u0432\u0430\u0440\u043E\u0432"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 720 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: C.textSub,
      marginTop: desktop ? 0 : -8,
      marginBottom: 12
    }
  }, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438\u0437 1\u0421 \u043C\u0435\u043D\u044F\u0435\u0442\u0441\u044F \u043E\u0442 \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0438 \u043A \u043F\u043E\u0441\u0442\u0430\u0432\u043A\u0435 \u2014 \u0437\u0430\u0434\u0430\u0439 \u0437\u0434\u0435\u0441\u044C \u043F\u043E\u0441\u0442\u043E\u044F\u043D\u043D\u043E\u0435 \u0438\u043C\u044F, \u043A\u043E\u0442\u043E\u0440\u043E\u0435 \u0443\u0432\u0438\u0434\u044F\u0442 \u0442\u043E\u0440\u0433\u043F\u0440\u0435\u0434\u044B."), /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      marginBottom: 12
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u043A\u043E\u0434\u0443...",
    value: aliasSearch,
    onChange: e => setAliasSearch(e.target.value),
    autoComplete: "off",
    name: "alias-search"
  }), (() => {
    const renderProductCard = p => {
      const locked = p.has_alias && !editingCodes[p.code];
      return /*#__PURE__*/React.createElement(ProductAliasCard, {
        key: p.code,
        p: p,
        locked: locked,
        saving: savingCode === p.code,
        alias: getField(p, 'alias'),
        price1: getField(p, 'price1'),
        price2: getField(p, 'price2'),
        price3: getField(p, 'price3'),
        commission: getField(p, 'commission'),
        cost: getField(p, 'cost'),
        pricedByWeight: getField(p, 'priced_by_weight'),
        avgBoxWeight: getField(p, 'avg_box_weight'),
        onChange: updateField,
        onEditRequest: onEditRequest,
        onSave: saveAlias
      });
    };
    const q = aliasSearch.trim().toLowerCase();
    const filtered = products.filter(p => !q || p.name.toLowerCase().includes(q) || (p.code || '').includes(q));
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
    const renderAliasSection = ({
      id,
      title,
      badgeColor,
      list
    }) => {
      const open = !!aliasSectionsOpen[id];
      return /*#__PURE__*/React.createElement("div", {
        key: id,
        style: {
          ...S.card,
          padding: 0,
          marginBottom: 12,
          overflow: "hidden"
        }
      }, /*#__PURE__*/React.createElement("div", {
        onClick: () => setAliasSectionsOpen(s => ({
          ...s,
          [id]: !s[id]
        })),
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 14px",
          cursor: "pointer",
          background: C.surface
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 15,
          fontWeight: 700,
          color: C.navy,
          display: "flex",
          alignItems: "center",
          gap: 8
        }
      }, title, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: badgeColor,
          background: badgeColor + "22",
          padding: "2px 8px",
          borderRadius: 99
        }
      }, list.length)), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 14,
          color: C.textFaint
        }
      }, open ? "▲ Свернуть" : "▼ Развернуть")), open && /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 10,
          maxHeight: 520,
          overflowY: "auto",
          borderTop: `1px solid ${C.border}`
        }
      }, list.length === 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: "center",
          padding: "20px 0",
          color: C.textFaint,
          fontSize: 15
        }
      }, q ? "Ничего не найдено" : "Пусто") : list.map(renderProductCard)));
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, renderAliasSection({
      id: "unset",
      title: "⚠️ Цены не установлены",
      badgeColor: C.red,
      list: withoutAlias
    }), renderAliasSection({
      id: "set",
      title: "✅ Цены установлены",
      badgeColor: C.green,
      list: withAlias
    }));
  })(), products.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, "\u041D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0438\u0437 1\u0421"))), tab === "stock" && /*#__PURE__*/React.createElement(StockPanel, null), tab === "catalog" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041A\u0430\u0442\u0430\u043B\u043E\u0433"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: C.textSub,
      marginTop: desktop ? 0 : -8,
      marginBottom: 12
    }
  }, "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u043A\u043E\u0434 \u2014 \u0438\u0437 1\u0421, \u043A\u0430\u043A \u0435\u0441\u0442\u044C. \u0417\u0434\u0435\u0441\u044C \u2014 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E, \u0447\u0442\u043E \u0432\u0438\u0434\u0438\u0442 \u043F\u043E\u043A\u0443\u043F\u0430\u0442\u0435\u043B\u044C \u043F\u0440\u0438 \u0432\u044B\u0431\u043E\u0440\u0435: \u0444\u043E\u0442\u043E \u0438 \u0440\u0430\u0437\u0434\u0435\u043B \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0430."), /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      marginBottom: 12
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043A\u043E\u0434\u0443 \u0438\u043B\u0438 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443...",
    value: catalogAdminSearch,
    onChange: e => setCatalogAdminSearch(e.target.value),
    autoComplete: "off",
    name: "catalog-admin-search"
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.row,
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textSub
    }
  }, categoryOptions.length > 0 ? `${categoryOptions.length} раздел(ов)` : "Разделов пока нет"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setShowCategoryManager(s => !s),
    style: {
      ...S.btnSecondary,
      padding: "5px 12px",
      fontSize: 14
    }
  }, showCategoryManager ? "✕ Закрыть" : "⚙ Управление разделами")), showCategoryManager && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: categoryOptions.length > 0 ? 12 : 0
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      padding: "7px 10px",
      fontSize: 15,
      flex: 1
    },
    placeholder: "\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043D\u043E\u0432\u043E\u0433\u043E \u0440\u0430\u0437\u0434\u0435\u043B\u0430",
    value: newCategoryName,
    onChange: e => setNewCategoryName(e.target.value),
    onKeyDown: e => {
      if (e.key === 'Enter') {
        createCategory(newCategoryName);
        setNewCategoryName("");
      }
    }
  }), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      padding: "7px 14px",
      fontSize: 14,
      marginTop: 0,
      boxShadow: "none",
      width: "auto",
      whiteSpace: "nowrap"
    },
    onClick: () => {
      createCategory(newCategoryName);
      setNewCategoryName("");
    }
  }, "+ \u0420\u0430\u0437\u0434\u0435\u043B")), categoryOptions.map(cat => /*#__PURE__*/React.createElement("div", {
    key: cat,
    style: {
      ...S.row,
      padding: "7px 0",
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 15,
      color: C.textMid
    }
  }, cat), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6
    }
  }, /*#__PURE__*/React.createElement("button", {
    title: "\u041F\u0435\u0440\u0435\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u0442\u044C",
    onClick: () => {
      const next = window.prompt(`Новое название для «${cat}»`, cat);
      if (next != null) renameCategory(cat, next);
    },
    style: {
      width: 28,
      height: 28,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      background: C.white,
      cursor: "pointer",
      fontSize: 15
    }
  }, "\u270E"), /*#__PURE__*/React.createElement("button", {
    title: "\u0423\u0434\u0430\u043B\u0438\u0442\u044C",
    onClick: () => deleteCategory(cat),
    style: {
      width: 28,
      height: 28,
      border: `1px solid ${C.border}`,
      borderRadius: 8,
      background: C.white,
      color: C.red,
      cursor: "pointer",
      fontSize: 15
    }
  }, "\uD83D\uDDD1"))))), categoryOptions.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setCatalogAdminSection(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${catalogAdminSection === "" ? C.navy : C.border}`,
      background: catalogAdminSection === "" ? C.navy : C.white,
      color: catalogAdminSection === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435"), categoryOptions.map(cat => /*#__PURE__*/React.createElement("button", {
    key: cat,
    onClick: () => setCatalogAdminSection(cat),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${catalogAdminSection === cat ? C.navy : C.border}`,
      background: catalogAdminSection === cat ? C.navy : C.white,
      color: catalogAdminSection === cat ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, cat)), /*#__PURE__*/React.createElement("button", {
    onClick: () => setCatalogAdminSection("__none__"),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${catalogAdminSection === "__none__" ? C.red : C.border}`,
      background: catalogAdminSection === "__none__" ? "#FEF2F2" : C.white,
      color: catalogAdminSection === "__none__" ? C.red : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0411\u0435\u0437 \u0440\u0430\u0437\u0434\u0435\u043B\u0430")), (() => {
    const q = catalogAdminSearch.trim().toLowerCase();
    const filtered = products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.code || '').includes(q) || (p.barcode || '').includes(q)) && (!catalogAdminSection || (catalogAdminSection === "__none__" ? !p.group : p.group === catalogAdminSection)));
    return filtered.length === 0 ? /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "center",
        padding: "20px 0",
        color: C.textFaint,
        fontSize: 15
      }
    }, q ? "Ничего не найдено" : "Пусто") : /*#__PURE__*/React.createElement("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
        gap: 14
      }
    }, filtered.map(p => /*#__PURE__*/React.createElement(ProductCatalogCard, {
      key: p.code,
      p: p,
      category: getField(p, 'category'),
      barcode: getField(p, 'barcode'),
      categoryOptions: categoryOptions,
      saving: savingCategoryCode === p.code,
      onChangeCategory: updateField,
      onSaveCategory: saveCategory,
      onUploadPhoto: uploadProductPhoto,
      onRemovePhoto: removeProductPhoto
    })));
  })(), products.length === 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, "\u041D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u0430 \u0435\u0449\u0451 \u043D\u0435 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0438\u0440\u043E\u0432\u0430\u043D\u0430 \u0438\u0437 1\u0421"))), tab === "nkt" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041A\u043E\u0434\u044B \u041D\u041A\u0422"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: C.textSub,
      marginTop: desktop ? 0 : -8,
      marginBottom: 12
    }
  }, "\u041A\u043E\u0434 \u041D\u041A\u0422 (NTIN) \u0438\u0449\u0435\u0442\u0441\u044F \u0432 \u041D\u0430\u0446\u0438\u043E\u043D\u0430\u043B\u044C\u043D\u043E\u043C \u043A\u0430\u0442\u0430\u043B\u043E\u0433\u0435 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u043F\u043E \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443. \u041D\u0430\u0439\u0434\u0435\u043D\u043D\u043E\u0435 \u2014 \u044D\u0442\u043E \u0442\u043E \u0436\u0435 \u0437\u043D\u0430\u0447\u0435\u043D\u0438\u0435, \u0447\u0442\u043E \u0432 1\u0421 \u0432 \u043F\u043E\u043B\u0435 \"\u041A\u043E\u0434 \u041D\u041A\u0422\" \u043A\u0430\u0440\u0442\u043E\u0447\u043A\u0438 \u043D\u043E\u043C\u0435\u043D\u043A\u043B\u0430\u0442\u0443\u0440\u044B. \u041C\u043E\u0436\u043D\u043E \u043F\u043E\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u0438 \u043F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u0435\u0441\u043B\u0438 \u043F\u043E \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443 \u043D\u0435 \u043D\u0430\u0448\u043B\u043E\u0441\u044C."), (() => {
    const total = products.length;
    const withBarcode = products.filter(p => p.barcode).length;
    const matched = products.filter(p => p.nkt_status === 'matched').length;
    const manual = products.filter(p => p.nkt_status === 'manual').length;
    const notFound = products.filter(p => p.nkt_status === 'not_found').length;
    const unchecked = total - matched - manual - notFound;
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        flexWrap: "wrap",
        marginBottom: 12
      }
    }, [["Всего", total, C.textMid], ["Со штрихкодом", withBarcode, C.textMid], ["Найдено", matched, C.green], ["Вручную", manual, C.navy], ["Не найдено", notFound, C.red], ["Не проверено", unchecked, C.textFaint]].map(([label, val, color]) => /*#__PURE__*/React.createElement("div", {
      key: label,
      style: {
        ...S.card,
        padding: "8px 12px",
        display: "flex",
        flexDirection: "column",
        gap: 2,
        minWidth: 88
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.textSub
      }
    }, label), /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18,
        fontWeight: 800,
        fontFamily: FH,
        color
      }
    }, val))));
  })(), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      marginBottom: 12,
      display: "flex",
      flexDirection: "column",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      alignItems: "center",
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      width: "auto",
      padding: "9px 16px",
      marginTop: 0,
      boxShadow: "none",
      opacity: nktRunning ? 0.6 : 1
    },
    disabled: nktRunning,
    onClick: runNktMatch
  }, "\u25B6 \u041F\u043E\u0434\u043E\u0431\u0440\u0430\u0442\u044C \u043A\u043E\u0434\u044B \u041D\u041A\u0422 \u043F\u043E \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0430\u043C"), nktRunning && /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnSecondary,
      width: "auto",
      padding: "9px 16px"
    },
    onClick: () => {
      nktStopRef.current = true;
    }
  }, "\u25A0 \u041E\u0441\u0442\u0430\u043D\u043E\u0432\u0438\u0442\u044C"), nktProgress && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 14,
      color: C.textSub
    }
  }, nktRunning ? "Идёт подбор: " : "Готово: ", nktProgress.done, " / ", nktProgress.total, " ", "(\u043D\u0430\u0439\u0434\u0435\u043D\u043E ", nktProgress.matched, ", \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E ", nktProgress.notFound, ", \u043E\u0448\u0438\u0431\u043E\u043A ", nktProgress.errors, ")")), /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 13,
      color: C.textFaint,
      margin: 0
    }
  }, "\u041E\u0431\u0440\u0430\u0431\u0430\u0442\u044B\u0432\u0430\u0435\u0442 \u0442\u043E\u043B\u044C\u043A\u043E \u0442\u043E\u0432\u0430\u0440\u044B \u0441\u043E \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u043E\u043C, \u0443 \u043A\u043E\u0442\u043E\u0440\u044B\u0445 \u043A\u043E\u0434 \u041D\u041A\u0422 \u0435\u0449\u0451 \u043D\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D. \u0422\u043E\u0432\u0430\u0440\u044B \u0431\u0435\u0437 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0430 \u0438 \u0443\u0436\u0435 \u0437\u0430\u043F\u043E\u043B\u043D\u0435\u043D\u043D\u044B\u0435 \u2014 \u043D\u0435 \u0442\u0440\u043E\u0433\u0430\u0435\u0442; \u0434\u043B\u044F \u043D\u0438\u0445 \u0438\u0449\u0438\u0442\u0435 \u0432\u0440\u0443\u0447\u043D\u0443\u044E \u043A\u043D\u043E\u043F\u043A\u043E\u0439 \"\uD83D\uDD0D\" \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E.")), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8,
      marginBottom: 10,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      flex: 1,
      minWidth: 200
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E, \u043A\u043E\u0434\u0443 1\u0421 \u0438\u043B\u0438 \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443...",
    value: nktSearch,
    onChange: e => setNktSearch(e.target.value),
    autoComplete: "off",
    name: "nkt-search"
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      display: "flex",
      alignItems: "center",
      gap: 6,
      fontSize: 14,
      color: C.textMid,
      whiteSpace: "nowrap"
    }
  }, /*#__PURE__*/React.createElement("input", {
    type: "checkbox",
    checked: nktOnlyMissing,
    onChange: e => setNktOnlyMissing(e.target.checked)
  }), "\u0422\u043E\u043B\u044C\u043A\u043E \u0431\u0435\u0437 \u043A\u043E\u0434\u0430 \u041D\u041A\u0422")), (() => {
    const q = nktSearch.trim().toLowerCase();
    const filtered = products.filter(p => (!q || p.name.toLowerCase().includes(q) || (p.code || '').includes(q) || (p.barcode || '').includes(q)) && (!nktOnlyMissing || !p.nkt_code));
    const STATUS_LABEL = {
      matched: "Найден",
      manual: "Вручную",
      not_found: "Не найден"
    };
    const STATUS_COLOR = {
      matched: C.green,
      manual: C.navy,
      not_found: C.red
    };
    if (filtered.length === 0) {
      return /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: "center",
          padding: "20px 0",
          color: C.textFaint,
          fontSize: 15
        }
      }, q || nktOnlyMissing ? "Ничего не найдено" : "Пусто");
    }
    // Плоская таблица, не карточки с фото — на 3000+ позициях это заметно легче.
    return /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.card,
        padding: 0,
        overflow: "hidden"
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        overflowX: "auto"
      }
    }, /*#__PURE__*/React.createElement("table", {
      style: {
        width: "100%",
        borderCollapse: "collapse",
        fontSize: 14
      }
    }, /*#__PURE__*/React.createElement("thead", null, /*#__PURE__*/React.createElement("tr", {
      style: {
        background: C.surface,
        textAlign: "left"
      }
    }, ["Название", "Код 1С", "Штрихкод", "Код НКТ", "Статус", ""].map(h => /*#__PURE__*/React.createElement("th", {
      key: h,
      style: {
        padding: "8px 10px",
        fontWeight: 700,
        color: C.textSub,
        whiteSpace: "nowrap"
      }
    }, h)))), /*#__PURE__*/React.createElement("tbody", null, filtered.slice(0, 500).map(p => /*#__PURE__*/React.createElement("tr", {
      key: p.code,
      className: "rowh",
      style: {
        borderTop: `1px solid ${C.border}`
      }
    }, /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        maxWidth: 280
      }
    }, p.name), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        color: C.textFaint,
        whiteSpace: "nowrap"
      }
    }, p.code), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        color: C.textFaint,
        whiteSpace: "nowrap"
      }
    }, p.barcode || "—"), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        minWidth: 150
      }
    }, /*#__PURE__*/React.createElement("input", {
      defaultValue: p.nkt_code,
      key: p.code + ':' + p.nkt_code,
      style: {
        ...S.input,
        padding: "5px 8px",
        fontSize: 14,
        width: 150
      },
      placeholder: "\u043D\u0435 \u0443\u043A\u0430\u0437\u0430\u043D",
      onBlur: e => {
        if (e.target.value !== (p.nkt_code || '')) saveNktCodeManually(p.code, e.target.value.trim());
      }
    })), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        whiteSpace: "nowrap"
      }
    }, p.nkt_status ? /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        fontWeight: 700,
        color: STATUS_COLOR[p.nkt_status] || C.textFaint,
        background: (STATUS_COLOR[p.nkt_status] || C.textFaint) + "22",
        padding: "2px 8px",
        borderRadius: 99
      }
    }, STATUS_LABEL[p.nkt_status] || p.nkt_status) : /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 13,
        color: C.textFaint
      }
    }, "\u2014")), /*#__PURE__*/React.createElement("td", {
      style: {
        padding: "6px 10px",
        whiteSpace: "nowrap"
      }
    }, /*#__PURE__*/React.createElement("button", {
      title: "\u0418\u0441\u043A\u0430\u0442\u044C \u0432 \u041D\u041A\u0422 \u043F\u043E \u0448\u0442\u0440\u0438\u0445\u043A\u043E\u0434\u0443/\u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E",
      onClick: () => searchNktForProduct(p),
      style: {
        width: 26,
        height: 26,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        background: C.white,
        cursor: "pointer",
        fontSize: 14
      }
    }, "\uD83D\uDD0D"))))))), filtered.length > 500 && /*#__PURE__*/React.createElement("div", {
      style: {
        padding: "8px 10px",
        fontSize: 13,
        color: C.textFaint,
        borderTop: `1px solid ${C.border}`
      }
    }, "\u041F\u043E\u043A\u0430\u0437\u0430\u043D\u044B \u043F\u0435\u0440\u0432\u044B\u0435 500 \u0438\u0437 ", filtered.length, " \u2014 \u0441\u0443\u0437\u044C\u0442\u0435 \u043F\u043E\u0438\u0441\u043A, \u0447\u0442\u043E\u0431\u044B \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u043E\u0441\u0442\u0430\u043B\u044C\u043D\u044B\u0435."));
  })()), nktPicker && /*#__PURE__*/React.createElement("div", {
    style: {
      position: "fixed",
      inset: 0,
      background: "rgba(0,0,0,0.4)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      zIndex: 1000,
      padding: 16
    },
    onClick: () => setNktPicker(null)
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      width: "100%",
      maxWidth: 480,
      maxHeight: "70vh",
      overflowY: "auto"
    },
    onClick: e => e.stopPropagation()
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 10
    }
  }, /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 16,
      fontWeight: 700,
      color: C.navy
    }
  }, "\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u043E\u0438\u0441\u043A\u0430 \u0432 \u041D\u041A\u0422"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setNktPicker(null),
    style: {
      border: "none",
      background: "none",
      fontSize: 18,
      cursor: "pointer",
      color: C.textFaint
    }
  }, "\u2715")), nktPicker.loading && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.textFaint,
      fontSize: 15
    }
  }, "\u0418\u0449\u0443..."), !nktPicker.loading && nktPicker.error && /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "20px 0",
      color: C.red,
      fontSize: 15
    }
  }, nktPicker.error), !nktPicker.loading && nktPicker.results.map((r, i) => /*#__PURE__*/React.createElement("div", {
    key: i,
    onClick: () => pickNktResult(nktPicker.code, r.ntin_code),
    style: {
      padding: "8px 10px",
      borderRadius: 8,
      border: `1px solid ${C.border}`,
      marginBottom: 6,
      cursor: "pointer"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 14,
      fontWeight: 600,
      color: C.textMid
    }
  }, r.name_ru || r.name_kk || 'Без названия'), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.textFaint,
      marginTop: 2
    }
  }, "NTIN: ", r.ntin_code || '—', " \xB7 GTIN: ", r.gtin || '—', r.is_markedeac ? ' · маркированный' : '')))))), tab === "employees" && /*#__PURE__*/React.createElement(React.Fragment, null, !desktop && /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u0421\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u0438"), /*#__PURE__*/React.createElement("div", {
    style: {
      maxWidth: desktop ? 560 : "none"
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      fontSize: 14,
      color: C.textSub,
      marginTop: desktop ? 0 : -8,
      marginBottom: 12
    }
  }, "\u0424\u0418\u041E \u043F\u0440\u0438\u0445\u043E\u0434\u0438\u0442 \u0438\u0437 1\u0421. \u0414\u043B\u044F \u043D\u043E\u0432\u044B\u0445 \u0441\u043E\u0442\u0440\u0443\u0434\u043D\u0438\u043A\u043E\u0432 \u0437\u0430\u0434\u0430\u0439 \u0440\u043E\u043B\u044C, \u043B\u043E\u0433\u0438\u043D \u0438 \u043F\u0430\u0440\u043E\u043B\u044C \u2014 \u043F\u043E\u044F\u0432\u0438\u0442\u0441\u044F \u0440\u0430\u0431\u043E\u0447\u0438\u0439 \u0432\u0445\u043E\u0434 \u043D\u0430 \u0441\u0430\u0439\u0442."), /*#__PURE__*/React.createElement("input", {
    type: "search",
    style: {
      ...S.input,
      marginBottom: 16
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u0424\u0418\u041E \u0438\u043B\u0438 \u043A\u043E\u0434\u0443...",
    value: empSearch,
    onChange: e => setEmpSearch(e.target.value),
    autoComplete: "off",
    name: "emp-search"
  }), (() => {
    const q = empSearch.trim().toLowerCase();
    // _origIdx фиксируется до фильтрации, чтобы formKey сотрудника без
    // кода 1С не менялся при наборе текста в поиске — иначе позиция
    // сотрудника в отфильтрованном списке сдвигается, его formKey
    // "достаётся" другому сотруднику, и уже введённые логин/пароль
    // показываются под чужим именем (данные не были ничьи, но
    // визуально привязываются не к тому человеку)
    const noAccount = employees.map((e, _origIdx) => ({
      ...e,
      _origIdx
    })).filter(e => !e.has_account && (!q || e.name.toLowerCase().includes(q) || (e.code || '').includes(q)));
    const accounts = users.filter(u => !q || u.name.toLowerCase().includes(q) || u.login.toLowerCase().includes(q));
    const storeClientCodes = new Set(users.filter(u => u.role === "store").map(u => u.client_code));
    const noStoreAccount = clients.filter(cl => !storeClientCodes.has(cl.code) && (!q || cl.name.toLowerCase().includes(q) || (cl.code || '').includes(q)));

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
    const renderEmpSection = ({
      id,
      title,
      badgeColor,
      count,
      children
    }) => {
      const open = !!empSectionsOpen[id];
      return /*#__PURE__*/React.createElement("div", {
        key: id,
        style: {
          ...S.card,
          padding: 0,
          marginBottom: 12,
          overflow: "hidden"
        }
      }, /*#__PURE__*/React.createElement("div", {
        onClick: () => setEmpSectionsOpen(s => ({
          ...s,
          [id]: !s[id]
        })),
        style: {
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "13px 14px",
          cursor: "pointer",
          background: C.surface
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 15,
          fontWeight: 700,
          color: C.navy,
          display: "flex",
          alignItems: "center",
          gap: 8
        }
      }, title, /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 13,
          fontWeight: 700,
          color: badgeColor,
          background: badgeColor + "22",
          padding: "2px 8px",
          borderRadius: 99
        }
      }, count)), /*#__PURE__*/React.createElement("span", {
        style: {
          fontSize: 14,
          color: C.textFaint
        }
      }, open ? "▲ Свернуть" : "▼ Развернуть")), open && /*#__PURE__*/React.createElement("div", {
        style: {
          padding: 10,
          maxHeight: 520,
          overflowY: "auto",
          borderTop: `1px solid ${C.border}`
        }
      }, children));
    };
    return /*#__PURE__*/React.createElement(React.Fragment, null, renderEmpSection({
      id: "noAccount",
      title: "Без учётной записи",
      badgeColor: C.red,
      count: noAccount.length,
      children: noAccount.length === 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: "center",
          padding: "16px 0",
          color: C.textFaint,
          fontSize: 15
        }
      }, q ? "Ничего не найдено" : "Все сотрудники из 1С уже с аккаунтами") : noAccount.map(emp => {
        const formKey = (emp.code || 'nocode') + '_' + emp._origIdx;
        return /*#__PURE__*/React.createElement("div", {
          key: formKey,
          style: {
            ...S.card,
            padding: 10,
            marginBottom: 6
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 13,
            color: C.textFaint,
            marginBottom: 2
          }
        }, "\u041A\u043E\u0434 1\u0421: ", emp.code), /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 8,
            color: C.textMid
          }
        }, emp.name), /*#__PURE__*/React.createElement("select", {
          style: {
            ...S.select,
            padding: "7px 8px",
            fontSize: 14,
            marginBottom: 6
          },
          value: (empForm[formKey] || {}).role || '',
          onChange: e => updateEmpForm(formKey, 'role', e.target.value)
        }, /*#__PURE__*/React.createElement("option", {
          value: ""
        }, "\u2014 \u0420\u043E\u043B\u044C \u2014"), ROLE_OPTIONS.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
          key: v,
          value: v
        }, l))), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 6
          }
        }, /*#__PURE__*/React.createElement("input", {
          style: {
            ...S.input,
            padding: "7px 8px",
            fontSize: 14
          },
          placeholder: "\u041B\u043E\u0433\u0438\u043D",
          value: (empForm[formKey] || {}).login || '',
          onChange: e => updateEmpForm(formKey, 'login', e.target.value)
        }), /*#__PURE__*/React.createElement("input", {
          style: {
            ...S.input,
            padding: "7px 8px",
            fontSize: 14
          },
          placeholder: "\u041F\u0430\u0440\u043E\u043B\u044C",
          value: (empForm[formKey] || {}).password || '',
          onChange: e => updateEmpForm(formKey, 'password', e.target.value)
        }), /*#__PURE__*/React.createElement("button", {
          style: {
            ...S.btnPrimary,
            padding: "7px 14px",
            fontSize: 14,
            marginTop: 0,
            boxShadow: "none",
            width: "auto",
            whiteSpace: "nowrap",
            opacity: savingEmp === formKey ? 0.5 : 1
          },
          disabled: savingEmp === formKey,
          onClick: () => createEmpAccount(emp, formKey)
        }, "\u0421\u043E\u0437\u0434\u0430\u0442\u044C")));
      })
    }), renderEmpSection({
      id: "accounts",
      title: "Учётные записи",
      badgeColor: C.green,
      count: accounts.length,
      children: accounts.length === 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: "center",
          padding: "16px 0",
          color: C.textFaint,
          fontSize: 15
        }
      }, q ? "Ничего не найдено" : "Аккаунтов пока нет") : accounts.map(u => /*#__PURE__*/React.createElement("div", {
        key: u.id,
        style: {
          ...S.card,
          padding: 10,
          marginBottom: 6,
          opacity: u.active ? 1 : 0.55
        }
      }, /*#__PURE__*/React.createElement("div", {
        style: S.row
      }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
        style: S.cardTitle
      }, u.name, " ", !u.active && /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.red,
          fontSize: 13,
          fontWeight: 700
        }
      }, "\xB7 \u041E\u0422\u041A\u041B\u042E\u0427\u0401\u041D")), /*#__PURE__*/React.createElement("p", {
        style: S.cardSub
      }, u.login, " \xB7 ", ROLE_OPTIONS.find(([v]) => v === u.role)?.[1] || u.role), u.session_active && /*#__PURE__*/React.createElement("p", {
        style: {
          ...S.cardSub,
          color: C.green,
          fontWeight: 600
        }
      }, "\u25CF \u0421\u0435\u0441\u0441\u0438\u044F \u0430\u043A\u0442\u0438\u0432\u043D\u0430", u.last_seen_at ? ` (посл. активность ${new Date(u.last_seen_at).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit'
      })})` : '')), /*#__PURE__*/React.createElement("button", {
        style: {
          ...S.btnSecondary,
          opacity: togglingUser === u.id ? 0.5 : 1
        },
        disabled: togglingUser === u.id,
        onClick: () => toggleUser(u)
      }, u.active ? "Отключить" : "Включить")), u.session_active && /*#__PURE__*/React.createElement("button", {
        style: {
          ...S.btnSecondary,
          marginTop: 6,
          opacity: resettingSession === u.id ? 0.5 : 1
        },
        disabled: resettingSession === u.id,
        onClick: () => resetUserSession(u)
      }, resettingSession === u.id ? "..." : "Сбросить сессию"), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6,
          marginTop: 8
        }
      }, /*#__PURE__*/React.createElement("select", {
        style: {
          ...S.select,
          padding: "7px 8px",
          fontSize: 14,
          flex: 1
        },
        value: roleEdits[u.id] !== undefined ? roleEdits[u.id] : u.role,
        onChange: e => setRoleEdits(r => ({
          ...r,
          [u.id]: e.target.value
        }))
      }, ROLE_OPTIONS.map(([v, l]) => /*#__PURE__*/React.createElement("option", {
        key: v,
        value: v
      }, l))), /*#__PURE__*/React.createElement("button", {
        style: {
          ...S.btnPrimary,
          padding: "7px 14px",
          fontSize: 14,
          marginTop: 0,
          boxShadow: "none",
          width: "auto",
          whiteSpace: "nowrap",
          opacity: savingRole === u.id || roleEdits[u.id] === undefined || roleEdits[u.id] === u.role ? 0.5 : 1
        },
        disabled: savingRole === u.id || roleEdits[u.id] === undefined || roleEdits[u.id] === u.role,
        onClick: () => changeRole(u)
      }, savingRole === u.id ? "..." : "Сохранить роль")), /*#__PURE__*/React.createElement("div", {
        style: {
          display: "flex",
          gap: 6,
          marginTop: 6
        }
      }, /*#__PURE__*/React.createElement("input", {
        type: "password",
        style: {
          ...S.input,
          padding: "7px 8px",
          fontSize: 14
        },
        placeholder: "\u041D\u043E\u0432\u044B\u0439 \u043F\u0430\u0440\u043E\u043B\u044C (\u043C\u0438\u043D. 4 \u0441\u0438\u043C\u0432.)",
        value: passwordEdits[u.id] || '',
        onChange: e => setPasswordEdits(p => ({
          ...p,
          [u.id]: e.target.value
        }))
      }), /*#__PURE__*/React.createElement("button", {
        style: {
          ...S.btnPrimary,
          padding: "7px 14px",
          fontSize: 14,
          marginTop: 0,
          boxShadow: "none",
          width: "auto",
          whiteSpace: "nowrap",
          opacity: changingPwd === u.id || !(passwordEdits[u.id] || '').trim() ? 0.5 : 1
        },
        disabled: changingPwd === u.id || !(passwordEdits[u.id] || '').trim(),
        onClick: () => changePassword(u)
      }, changingPwd === u.id ? "..." : "Сменить пароль"))))
    }), renderEmpSection({
      id: "noStoreAccount",
      title: "Магазины без кабинета",
      badgeColor: C.red,
      count: noStoreAccount.length,
      children: noStoreAccount.length === 0 ? /*#__PURE__*/React.createElement("div", {
        style: {
          textAlign: "center",
          padding: "16px 0",
          color: C.textFaint,
          fontSize: 15
        }
      }, q ? "Ничего не найдено" : clients.length === 0 ? "Клиенты из 1С ещё не загружены" : "Все магазины уже с кабинетами") : noStoreAccount.map(cl => {
        const formKey = 'store_' + cl.code;
        return /*#__PURE__*/React.createElement("div", {
          key: formKey,
          style: {
            ...S.card,
            padding: 10,
            marginBottom: 6
          }
        }, /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 13,
            color: C.textFaint,
            marginBottom: 2
          }
        }, "\u041A\u043E\u0434 1\u0421: ", cl.code), /*#__PURE__*/React.createElement("div", {
          style: {
            fontSize: 15,
            fontWeight: 600,
            marginBottom: 8,
            color: C.textMid
          }
        }, cl.name), /*#__PURE__*/React.createElement("div", {
          style: {
            display: "flex",
            gap: 6
          }
        }, /*#__PURE__*/React.createElement("input", {
          style: {
            ...S.input,
            padding: "7px 8px",
            fontSize: 14
          },
          placeholder: "\u041B\u043E\u0433\u0438\u043D",
          value: (empForm[formKey] || {}).login || '',
          onChange: e => updateEmpForm(formKey, 'login', e.target.value)
        }), /*#__PURE__*/React.createElement("input", {
          style: {
            ...S.input,
            padding: "7px 8px",
            fontSize: 14
          },
          placeholder: "\u041F\u0430\u0440\u043E\u043B\u044C",
          value: (empForm[formKey] || {}).password || '',
          onChange: e => updateEmpForm(formKey, 'password', e.target.value)
        }), /*#__PURE__*/React.createElement("button", {
          style: {
            ...S.btnPrimary,
            padding: "7px 14px",
            fontSize: 14,
            marginTop: 0,
            boxShadow: "none",
            width: "auto",
            whiteSpace: "nowrap",
            opacity: savingEmp === formKey ? 0.5 : 1
          },
          disabled: savingEmp === formKey,
          onClick: () => createStoreAccount(cl, formKey)
        }, "\u0421\u043E\u0437\u0434\u0430\u0442\u044C")));
      })
    }));
  })())));
  const ROLE_LABEL = {
    sales: "Торговый представитель",
    senior_sales: "Старший торговый представитель",
    driver: "Водитель",
    cashier: "Кассир",
    warehouse: "Зав. склад",
    operator: "Оператор",
    admin: "Администратор",
    manager: "Менеджер",
    store: "Магазин"
  };
  if (desktop) {
    return /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        minHeight: "100vh",
        background: C.surface,
        alignItems: "flex-start"
      }
    }, /*#__PURE__*/React.createElement(AutofillDecoy, null), selectedOrder && /*#__PURE__*/React.createElement(OrderDetail, {
      order: selectedOrder,
      onClose: () => setSelectedOrder(null),
      onUpdateStatus: handleUpdate,
      onDeleteOrder: handleDelete,
      currentUser: user,
      drivers: users.filter(u => u.role === "driver" && u.active !== false)
    }), showPosModal && /*#__PURE__*/React.createElement(PosSaleModal, {
      products: products,
      clients: clients,
      onClose: () => setShowPosModal(false),
      onCompleted: () => {
        setShowPosModal(false);
        loadSales();
      }
    }), showReturnModal && /*#__PURE__*/React.createElement(ReturnFormModal, {
      user: user,
      onClose: () => setShowReturnModal(false),
      onCreated: loadReturns
    }), /*#__PURE__*/React.createElement("aside", {
      style: S.side
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        marginBottom: 34
      }
    }, /*#__PURE__*/React.createElement(Brand, {
      size: 44
    })), /*#__PURE__*/React.createElement("nav", {
      style: {
        flex: 1
      }
    }, TABS.map(([k, ic, lb]) => /*#__PURE__*/React.createElement("button", {
      key: k,
      style: S.sideLink(tab === k),
      onClick: () => setTab(k)
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        fontSize: 18
      }
    }, ic), lb))), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 14,
        color: "#8B8681",
        lineHeight: 1.6
      }
    }, ROLE_LABEL[user.role], " \xB7 ", user.name, /*#__PURE__*/React.createElement("br", null), /*#__PURE__*/React.createElement("button", {
      style: {
        background: "transparent",
        border: `1px solid ${C.border}`,
        color: C.textMid,
        padding: "6px 14px",
        borderRadius: 8,
        cursor: "pointer",
        fontSize: 14,
        marginTop: 8
      },
      onClick: onLogout
    }, "\u0412\u044B\u0439\u0442\u0438"))), /*#__PURE__*/React.createElement("main", {
      style: S.main
    }, /*#__PURE__*/React.createElement("h1", {
      style: S.h1
    }, TAB_TITLES[tab]), /*#__PURE__*/React.createElement("div", {
      style: {
        ...S.h1sub,
        marginBottom: 22
      }
    }, new Date().toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })), content));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 72
    }
  }, /*#__PURE__*/React.createElement(AutofillDecoy, null), selectedOrder && /*#__PURE__*/React.createElement(OrderDetail, {
    order: selectedOrder,
    onClose: () => setSelectedOrder(null),
    onUpdateStatus: handleUpdate,
    onDeleteOrder: handleDelete,
    currentUser: user,
    drivers: users.filter(u => u.role === "driver" && u.active !== false)
  }), showPosModal && /*#__PURE__*/React.createElement(PosSaleModal, {
    products: products,
    clients: clients,
    onClose: () => setShowPosModal(false),
    onCompleted: () => {
      setShowPosModal(false);
      loadSales();
    }
  }), showReturnModal && /*#__PURE__*/React.createElement(ReturnFormModal, {
    user: user,
    onClose: () => setShowReturnModal(false),
    onCreated: loadReturns
  }), /*#__PURE__*/React.createElement("div", {
    style: S.page
  }, content), /*#__PURE__*/React.createElement("div", {
    style: S.nav
  }, (user.role === "operator" ? [["all", "📋", "Заявки"], ["report", "📊", "Отчёт"], ["cashbox", "💵", "Касса"]] : [["all", "📋", "Заявки"], ["report", "📊", "Отчёт"], ["cashbox", "💵", "Касса"], ["aliases", "🏷", "Товары"], ["stock", "📦", "Остатки"], ["employees", "👤", "Сотр."]]).map(([k, ic, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    style: S.navBtn(tab === k),
    onClick: () => setTab(k)
  }, /*#__PURE__*/React.createElement("span", {
    style: S.navIcon
  }, ic), /*#__PURE__*/React.createElement("span", {
    style: S.navLabel(tab === k)
  }, lb)))));
}
function WarehouseCabinet({
  user,
  onLogout
}) {
  const [tab, setTab] = useState("stock");
  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [stockSearch, setStockSearch] = useState("");
  const [stockCategory, setStockCategory] = useState("");
  const [hideEmpty, setHideEmpty] = useState(false);

  // Приём налички от водителей (инкассация) — см. POST/PUT /api/cash-handovers.
  const [cashHandovers, setCashHandovers] = useState([]);
  const [loadingHandovers, setLoadingHandovers] = useState(true);
  const loadCashHandovers = useCallback(async () => {
    try {
      setCashHandovers(await apiCall('GET', '/api/cash-handovers'));
    } catch (e) {}
    setLoadingHandovers(false);
  }, []);
  useEffect(() => {
    loadCashHandovers();
  }, []);
  useRefetchOnVisible(loadCashHandovers);
  const [confirmingId, setConfirmingId] = useState(null);
  const [confirmForm, setConfirmForm] = useState({
    actualAmount: '',
    comment: ''
  });
  const [savingConfirm, setSavingConfirm] = useState(false);
  const startConfirm = h => {
    setConfirmingId(h.id);
    setConfirmForm({
      actualAmount: String(h.expected_amount),
      comment: ''
    });
  };
  const submitConfirm = async id => {
    setSavingConfirm(true);
    try {
      await apiCall('PUT', `/api/cash-handovers/${id}/confirm`, {
        actualAmount: confirmForm.actualAmount,
        comment: confirmForm.comment
      });
      setConfirmingId(null);
      loadCashHandovers();
    } catch (e) {
      alert(e.message);
    }
    setSavingConfirm(false);
  };
  const pendingHandovers = cashHandovers.filter(h => h.status === "pending");
  const confirmedHandovers = cashHandovers.filter(h => h.status === "confirmed");
  const loadProducts = useCallback(async () => {
    try {
      const data = await fetch('/api/products').then(r => r.json());
      setProducts(data);
    } catch (e) {}
    setLoadingProducts(false);
  }, []);
  useEffect(() => {
    loadProducts();
  }, []);
  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  const loadOrders = useCallback(async () => {
    try {
      const data = await apiCall('GET', '/api/orders');
      setOrders(data);
    } catch (e) {
      if (e.message.includes('токен')) onLogout();
    }
    setLoadingOrders(false);
  }, []);
  useEffect(() => {
    loadOrders();
  }, []);
  useRefetchOnVisible(loadProducts, loadOrders);
  const stockStats = products.reduce((acc, p) => {
    acc.total++;
    if (p.stock != null && p.stock > 0) acc.inStock++;else acc.outOfStock++;
    return acc;
  }, {
    total: 0,
    inStock: 0,
    outOfStock: 0
  });
  const stockCategories = Array.from(new Set(products.map(p => p.group).filter(Boolean))).sort((a, b) => a.localeCompare(b));
  const q = stockSearch.trim().toLowerCase();
  const filteredProducts = products.filter(p => !q || (p.display_name || p.name || '').toLowerCase().includes(q) || (p.code || '').includes(q)).filter(p => !stockCategory || p.group === stockCategory).filter(p => !hideEmpty || p.stock != null && p.stock > 0).slice().sort((a, b) => {
    const aOut = !(a.stock > 0),
      bOut = !(b.stock > 0);
    if (aOut !== bOut) return aOut ? 1 : -1;
    return (a.display_name || a.name || '').localeCompare(b.display_name || b.name || '');
  });
  const [driverFilter, setDriverFilter] = useState("");
  const queueOrders = orders.filter(o => o.status === "new");
  const activeOrders = orders.filter(o => o.status === "in_transit");
  const byDriver = {};
  activeOrders.forEach(o => {
    const key = o.driver_id || 'unassigned';
    if (!byDriver[key]) byDriver[key] = {
      key,
      name: o.driver_name || 'Без назначенного водителя',
      orders: []
    };
    byDriver[key].orders.push(o);
  });
  const driverGroups = Object.values(byDriver).filter(g => !driverFilter || String(g.key) === driverFilter).sort((a, b) => b.orders.length - a.orders.length);
  const allDriverGroups = Object.values(byDriver).sort((a, b) => b.orders.length - a.orders.length);

  // Факт. вес — интерактивный аналог бумажного загрузочного листа: вместо
  // ручки на распечатке зав. склад вписывает вес прямо здесь, по каждой
  // позиции каждой заявки отдельно (не суммарно по водителю — у разных
  // заявок вес своей партии, усреднять/схлопывать нельзя).
  const [expandedWeightsFor, setExpandedWeightsFor] = useState(null);
  const [weightForm, setWeightForm] = useState({});
  const [savingWeights, setSavingWeights] = useState(false);
  const orderItemsOf = o => typeof o.items === 'string' ? JSON.parse(o.items || '[]') : o.items || [];
  // it.is_weight_item — снимок на момент создания заявки; у заявок, оформленных
  // до того как товар отметили "Весовой" в карточке, снимок остался false, хотя
  // товар физически весовой. Подстраховываемся текущим состоянием карточки
  // товара (products грузится из /api/products и содержит priced_by_weight),
  // иначе такие заявки молча пропадают из формы ввода веса (сервер их тоже
  // принимает по этой же живой проверке, см. POST /api/orders/weights).
  const productByCode = useMemo(() => {
    const m = {};
    products.forEach(p => {
      m[p.code] = p;
    });
    return m;
  }, [products]);
  const isWeightItem = it => !!(it.is_weight_item || productByCode[it.code] && productByCode[it.code].priced_by_weight);
  const saveWeights = async group => {
    const entries = [];
    group.orders.forEach(o => {
      orderItemsOf(o).filter(isWeightItem).forEach(it => {
        const key = `${o.id}_${it.code}`;
        const val = weightForm[key];
        if (val !== undefined && val !== '') entries.push({
          orderId: o.id,
          code: it.code,
          weight: val
        });
      });
    });
    if (entries.length === 0) {
      alert('Введите хотя бы одно значение веса');
      return;
    }
    if (!window.confirm(`Сохранить фактический вес по ${entries.length} ${entries.length === 1 ? 'позиции' : 'позициям'}? Суммы заявок пересчитаются.`)) return;
    setSavingWeights(true);
    try {
      const res = await apiCall('POST', '/api/orders/weights', {
        entries
      });
      if (res.errors && res.errors.length) {
        alert('Часть значений не сохранена:\n' + res.errors.join('\n'));
      }
      // Очищаем поле ввода только для реально принятых сервером позиций
      // (res.applied) — иначе отклонённое значение (см. errors выше, например
      // некорректный вес или нехватка остатка) тихо стиралось бы из формы,
      // выглядя как ещё не введённое, хотя сотрудник его уже вписывал.
      const appliedKeys = new Set((res.applied || []).map(a => `${a.orderId}_${a.code}`));
      setWeightForm(f => {
        const next = {
          ...f
        };
        entries.forEach(e => {
          const key = `${e.orderId}_${e.code}`;
          if (appliedKeys.has(key)) delete next[key];
        });
        return next;
      });
      setExpandedWeightsFor(null);
      loadOrders();
    } catch (e) {
      alert(e.message);
    }
    setSavingWeights(false);
  };
  return /*#__PURE__*/React.createElement("div", {
    style: {
      paddingBottom: 72
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.page
  }, tab === "stock" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041E\u0441\u0442\u0430\u0442\u043A\u0438 \u043D\u0430 \u0441\u043A\u043B\u0430\u0434\u0435"), !loadingProducts && products.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: S.statsRow
  }, /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum()
  }, stockStats.total), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412\u0441\u0435\u0433\u043E \u043F\u043E\u0437\u0438\u0446\u0438\u0439")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.green)
  }, stockStats.inStock), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u0412 \u043D\u0430\u043B\u0438\u0447\u0438\u0438")), /*#__PURE__*/React.createElement("div", {
    style: S.statCard()
  }, /*#__PURE__*/React.createElement("p", {
    style: S.statNum(C.red)
  }, stockStats.outOfStock), /*#__PURE__*/React.createElement("p", {
    style: S.statLabel
  }, "\u041D\u0435\u0442 \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438"))), /*#__PURE__*/React.createElement("input", {
    style: {
      ...S.input,
      marginBottom: 12
    },
    placeholder: "\u041F\u043E\u0438\u0441\u043A \u043F\u043E \u043D\u0430\u0437\u0432\u0430\u043D\u0438\u044E \u0438\u043B\u0438 \u043A\u043E\u0434\u0443...",
    value: stockSearch,
    onChange: e => setStockSearch(e.target.value)
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap",
      alignItems: "center"
    }
  }, stockCategories.length > 1 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("button", {
    onClick: () => setStockCategory(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${stockCategory === "" ? C.navy : C.border}`,
      background: stockCategory === "" ? C.navy : C.white,
      color: stockCategory === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435 \u0440\u0430\u0437\u0434\u0435\u043B\u044B"), stockCategories.map(cat => /*#__PURE__*/React.createElement("button", {
    key: cat,
    onClick: () => setStockCategory(cat),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${stockCategory === cat ? C.navy : C.border}`,
      background: stockCategory === cat ? C.navy : C.white,
      color: stockCategory === cat ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, cat))), /*#__PURE__*/React.createElement("button", {
    onClick: () => setHideEmpty(h => !h),
    style: {
      marginLeft: "auto",
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${hideEmpty ? C.green : C.border}`,
      background: hideEmpty ? "#EAF5EE" : C.white,
      color: hideEmpty ? C.green : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, hideEmpty ? "✓ " : "", "\u0422\u043E\u043B\u044C\u043A\u043E \u0432 \u043D\u0430\u043B\u0438\u0447\u0438\u0438")), loadingProducts ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : filteredProducts.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.textFaint
    }
  }, "\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E") : filteredProducts.map(p => {
    const out = !(p.stock > 0);
    const low = !out && p.stock <= 5;
    const dot = out ? C.red : low ? C.amber : C.green;
    return /*#__PURE__*/React.createElement("div", {
      key: p.code,
      style: {
        ...S.card,
        opacity: out ? 0.7 : 1
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 10
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        gap: 10,
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        width: 9,
        height: 9,
        borderRadius: "50%",
        background: dot,
        flexShrink: 0
      }
    }), /*#__PURE__*/React.createElement("div", {
      style: {
        minWidth: 0
      }
    }, /*#__PURE__*/React.createElement("p", {
      style: {
        ...S.cardTitle,
        overflowWrap: "anywhere"
      }
    }, p.display_name || p.name), /*#__PURE__*/React.createElement("p", {
      style: S.cardSub
    }, "\u041A\u043E\u0434: ", p.code, p.group ? ' · ' + p.group : ''))), /*#__PURE__*/React.createElement("div", {
      style: {
        textAlign: "right",
        flexShrink: 0
      }
    }, /*#__PURE__*/React.createElement("span", {
      style: {
        display: "inline-block",
        padding: "4px 10px",
        borderRadius: 8,
        fontWeight: 800,
        fontFamily: FH,
        fontSize: 17,
        background: out ? C.redSoft : low ? "#FEF3C7" : "#EAF5EE",
        color: out ? C.red : low ? C.amber : C.green
      }
    }, p.stock != null ? p.stock : '—'), /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "4px 0 0",
        fontSize: 13,
        color: C.textFaint
      }
    }, p.stock_unit || ''))), p.stock_weight_kg != null && /*#__PURE__*/React.createElement("p", {
      style: {
        margin: "6px 0 0",
        fontSize: 14,
        color: C.textSub,
        fontWeight: 600
      }
    }, "\u2696\uFE0F \u0412\u0435\u0441: ", p.stock_weight_kg, " \u043A\u0433"));
  })), tab === "shipping" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041E\u0442\u0433\u0440\u0443\u0437\u043A\u0430"), queueOrders.length > 0 && /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.card,
      background: C.redSoft,
      marginBottom: 12
    }
  }, /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 15,
      fontWeight: 600,
      color: C.accentDark
    }
  }, "\u23F3 \u041E\u0436\u0438\u0434\u0430\u044E\u0442 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u0438\u044F \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F: ", queueOrders.length)), allDriverGroups.length > 1 && /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 6,
      marginBottom: 12,
      flexWrap: "wrap"
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => setDriverFilter(""),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${driverFilter === "" ? C.navy : C.border}`,
      background: driverFilter === "" ? C.navy : C.white,
      color: driverFilter === "" ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, "\u0412\u0441\u0435 \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0438"), allDriverGroups.map(g => /*#__PURE__*/React.createElement("button", {
    key: g.key,
    onClick: () => setDriverFilter(String(g.key)),
    style: {
      padding: "5px 12px",
      borderRadius: 99,
      border: `1px solid ${driverFilter === String(g.key) ? C.navy : C.border}`,
      background: driverFilter === String(g.key) ? C.navy : C.white,
      color: driverFilter === String(g.key) ? C.white : C.textMid,
      fontSize: 14,
      fontWeight: 600,
      cursor: "pointer"
    }
  }, g.name))), loadingOrders ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : driverGroups.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "48px 0",
      color: C.textFaint
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 40,
      marginBottom: 12
    }
  }, "\uD83D\uDE9A"), /*#__PURE__*/React.createElement("p", null, "\u041D\u0435\u0442 \u0437\u0430\u044F\u0432\u043E\u043A \u0432 \u0440\u0430\u0431\u043E\u0442\u0435")) : driverGroups.map(g => {
    const expanded = expandedWeightsFor === g.key;
    return /*#__PURE__*/React.createElement("div", {
      key: g.key,
      style: S.card
    }, /*#__PURE__*/React.createElement("p", {
      style: S.cardTitle
    }, g.name), /*#__PURE__*/React.createElement("p", {
      style: S.cardSub
    }, g.orders.length, " ", g.orders.length === 1 ? 'заявка' : 'заявок', " \u0432 \u0440\u0430\u0431\u043E\u0442\u0435"), /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        gap: 8,
        marginTop: 10
      }
    }, /*#__PURE__*/React.createElement("button", {
      onClick: () => printLoadingList(g.orders, g.name),
      style: {
        flex: 1,
        padding: "11px",
        background: C.navy,
        color: C.white,
        border: "none",
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "\uD83E\uDDFE \u0417\u0430\u0433\u0440\u0443\u0437\u043E\u0447\u043D\u044B\u0439 \u043B\u0438\u0441\u0442"), /*#__PURE__*/React.createElement("button", {
      onClick: () => setExpandedWeightsFor(k => k === g.key ? null : g.key),
      style: {
        flex: 1,
        padding: "11px",
        background: expanded ? C.debtAmber : C.white,
        color: expanded ? "#92400E" : C.navy,
        border: `1.5px solid ${C.navy}`,
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 700,
        cursor: "pointer"
      }
    }, "\u2696\uFE0F ", expanded ? "Скрыть" : "Ввести вес")), expanded && (() => {
      // Показываем только весовые позиции — у остальных qty
      // остаётся в коробах/штуках, и это поле не для них
      // (раньше показывалось для любого товара заявки, подписанное
      // просто "кг", хотя вводить туда следовало только факт. вес
      // весового товара). isWeightItem учитывает и снимок на
      // заявке, и текущую карточку товара — старые заявки, у
      // которых снимок не проставился, тоже не пропадают отсюда.
      const ordersWithWeightItems = g.orders.map(o => ({
        order: o,
        weightItems: orderItemsOf(o).filter(isWeightItem)
      })).filter(x => x.weightItems.length > 0);
      if (ordersWithWeightItems.length === 0) {
        return /*#__PURE__*/React.createElement("div", {
          style: {
            marginTop: 12,
            paddingTop: 12,
            borderTop: `1px solid ${C.border}`
          }
        }, /*#__PURE__*/React.createElement("p", {
          style: {
            margin: 0,
            fontSize: 14,
            color: C.textFaint
          }
        }, "\u0412 \u0437\u0430\u044F\u0432\u043A\u0430\u0445 \u044D\u0442\u043E\u0433\u043E \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u044F \u043D\u0435\u0442 \u0432\u0435\u0441\u043E\u0432\u044B\u0445 \u0442\u043E\u0432\u0430\u0440\u043E\u0432 \u2014 \u0432\u0432\u043E\u0434\u0438\u0442\u044C \u0432\u0435\u0441 \u043D\u0435 \u043D\u0443\u0436\u043D\u043E."));
      }
      return /*#__PURE__*/React.createElement("div", {
        style: {
          marginTop: 12,
          paddingTop: 12,
          borderTop: `1px solid ${C.border}`
        }
      }, ordersWithWeightItems.map(({
        order: o,
        weightItems
      }) => /*#__PURE__*/React.createElement("div", {
        key: o.id,
        style: {
          marginBottom: 12
        }
      }, /*#__PURE__*/React.createElement("p", {
        style: {
          margin: "0 0 6px",
          fontSize: 14,
          fontWeight: 700,
          color: C.textSub
        }
      }, "\u2116 ", o.id, " \xB7 ", o.client_name), weightItems.map(it => /*#__PURE__*/React.createElement("div", {
        key: it.code,
        style: {
          display: "flex",
          alignItems: "flex-start",
          gap: 8,
          marginBottom: 6
        }
      }, /*#__PURE__*/React.createElement("span", {
        style: {
          flex: 1,
          minWidth: 0,
          fontSize: 14,
          color: C.textMid,
          overflowWrap: "anywhere"
        }
      }, it.name, " ", /*#__PURE__*/React.createElement("span", {
        style: {
          color: C.textFaint
        }
      }, "(\u0431\u044B\u043B\u043E ", it.qty, ")"), it.weight_confirmed && it.weighed_by_name && /*#__PURE__*/React.createElement("span", {
        style: {
          display: "block",
          fontSize: 12,
          color: C.textFaint
        }
      }, "\u0412\u0437\u0432\u0435\u0441\u0438\u043B: ", it.weighed_by_name, it.weighed_at ? ', ' + new Date(it.weighed_at).toLocaleString('ru-RU') : '')), /*#__PURE__*/React.createElement("input", {
        type: "number",
        placeholder: "\u043A\u0433",
        style: {
          ...S.input,
          width: 80,
          flexShrink: 0,
          padding: "6px 8px",
          fontSize: 14
        },
        value: weightForm[`${o.id}_${it.code}`] || '',
        onChange: e => setWeightForm(f => ({
          ...f,
          [`${o.id}_${it.code}`]: e.target.value
        })),
        onFocus: e => e.target.select()
      }))))), /*#__PURE__*/React.createElement("button", {
        onClick: () => saveWeights(g),
        disabled: savingWeights,
        style: {
          ...S.btnPrimary,
          marginTop: 4,
          opacity: savingWeights ? 0.6 : 1
        }
      }, savingWeights ? "Сохраняю..." : "Сохранить вес"));
    })());
  }), /*#__PURE__*/React.createElement(WeighLogPanel, null)), tab === "cash" && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: S.sectionTitle
  }, "\u041F\u0440\u0438\u0451\u043C \u043D\u0430\u043B\u0438\u0447\u043A\u0438 \u043E\u0442 \u0432\u043E\u0434\u0438\u0442\u0435\u043B\u0435\u0439"), loadingHandovers ? /*#__PURE__*/React.createElement("div", {
    style: S.loadingWrap
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430...") : /*#__PURE__*/React.createElement(React.Fragment, null, pendingHandovers.length === 0 ? /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "center",
      padding: "40px 0",
      color: C.textFaint
    }
  }, "\u041E\u0436\u0438\u0434\u0430\u044E\u0449\u0438\u0445 \u0441\u0434\u0430\u0447 \u043D\u0435\u0442") : pendingHandovers.map(h => /*#__PURE__*/React.createElement("div", {
    key: h.id,
    style: {
      ...S.card,
      background: "#FFFBEB",
      border: "1px solid #FDE68A"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, h.driver_name), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, h.date, " \xB7 \u0437\u0430\u044F\u0432\u043E\u043A: ", h.order_ids.length)), /*#__PURE__*/React.createElement("p", {
    style: {
      margin: 0,
      fontSize: 19,
      fontWeight: 800,
      fontFamily: FH,
      color: "#92400E"
    }
  }, h.expected_amount.toLocaleString(), " \u20B8")), confirmingId !== h.id ? /*#__PURE__*/React.createElement("button", {
    onClick: () => startConfirm(h),
    style: {
      ...S.btnPrimary,
      marginTop: 10
    }
  }, "\u041F\u0440\u0438\u043D\u044F\u0442\u044C \u0438 \u043F\u043E\u0434\u0442\u0432\u0435\u0440\u0434\u0438\u0442\u044C") : /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 10,
      paddingTop: 10,
      borderTop: `1px solid ${C.border}`
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      fontSize: 12
    }
  }, "\u0421\u043A\u043E\u043B\u044C\u043A\u043E \u0440\u0435\u0430\u043B\u044C\u043D\u043E \u043F\u0440\u0438\u043D\u044F\u0442\u043E, \u20B8"), /*#__PURE__*/React.createElement("input", {
    type: "number",
    style: {
      ...S.input,
      marginBottom: 8
    },
    value: confirmForm.actualAmount,
    onChange: e => setConfirmForm(f => ({
      ...f,
      actualAmount: e.target.value
    })),
    onFocus: e => e.target.select()
  }), /*#__PURE__*/React.createElement("label", {
    style: {
      ...S.label,
      fontSize: 12
    }
  }, "\u041A\u043E\u043C\u043C\u0435\u043D\u0442\u0430\u0440\u0438\u0439, \u043D\u0435\u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E"), /*#__PURE__*/React.createElement("textarea", {
    style: {
      ...S.textarea,
      marginBottom: 8
    },
    placeholder: "\u041D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: \u043F\u0440\u0438\u0447\u0438\u043D\u0430 \u043D\u0435\u0434\u043E\u0441\u0442\u0430\u0447\u0438",
    value: confirmForm.comment,
    onChange: e => setConfirmForm(f => ({
      ...f,
      comment: e.target.value
    }))
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      gap: 8
    }
  }, /*#__PURE__*/React.createElement("button", {
    onClick: () => submitConfirm(h.id),
    disabled: savingConfirm,
    style: {
      ...S.btnPrimary,
      marginTop: 0,
      opacity: savingConfirm ? 0.6 : 1
    }
  }, savingConfirm ? "Сохраняю..." : "Подтвердить"), /*#__PURE__*/React.createElement("button", {
    onClick: () => setConfirmingId(null),
    disabled: savingConfirm,
    style: {
      ...S.btnSecondary,
      marginTop: 0
    }
  }, "\u041E\u0442\u043C\u0435\u043D\u0430"))))), confirmedHandovers.length > 0 && /*#__PURE__*/React.createElement(React.Fragment, null, /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.sectionTitle,
      fontSize: 17,
      marginTop: 20
    }
  }, "\u0418\u0441\u0442\u043E\u0440\u0438\u044F"), confirmedHandovers.map(h => /*#__PURE__*/React.createElement("div", {
    key: h.id,
    style: S.card
  }, /*#__PURE__*/React.createElement("div", {
    style: S.row
  }, /*#__PURE__*/React.createElement("div", null, /*#__PURE__*/React.createElement("p", {
    style: S.cardTitle
  }, h.driver_name), /*#__PURE__*/React.createElement("p", {
    style: S.cardSub
  }, h.date, " \xB7 \u043E\u0436\u0438\u0434\u0430\u043B\u043E\u0441\u044C ", h.expected_amount.toLocaleString(), " \u20B8 \xB7 \u043F\u0440\u0438\u043D\u044F\u0442\u043E ", h.actual_amount.toLocaleString(), " \u20B8")), h.difference !== 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      fontSize: 13,
      fontWeight: 700,
      padding: "3px 9px",
      borderRadius: 99,
      background: h.difference < 0 ? C.redSoft : "#EAF5EE",
      color: h.difference < 0 ? C.red : C.green
    }
  }, h.difference < 0 ? `Недостача ${Math.abs(h.difference).toLocaleString()}` : `Излишек ${h.difference.toLocaleString()}`, " \u20B8")), h.comment && /*#__PURE__*/React.createElement("p", {
    style: {
      margin: "6px 0 0",
      fontSize: 13,
      color: C.textFaint
    }
  }, h.comment))))))), /*#__PURE__*/React.createElement("div", {
    style: S.nav
  }, [["stock", "📦", "Остатки"], ["shipping", "🚚", "Отгрузка"], ["cash", "💰", "Инкассация"]].map(([k, ic, lb]) => /*#__PURE__*/React.createElement("button", {
    key: k,
    style: {
      ...S.navBtn(tab === k),
      flex: 1,
      position: "relative"
    },
    onClick: () => setTab(k)
  }, /*#__PURE__*/React.createElement("span", {
    style: S.navIcon
  }, ic), /*#__PURE__*/React.createElement("span", {
    style: S.navLabel(tab === k)
  }, lb), k === "cash" && pendingHandovers.length > 0 && /*#__PURE__*/React.createElement("span", {
    style: {
      position: "absolute",
      top: 2,
      right: "22%",
      background: C.red,
      color: C.white,
      fontSize: 10,
      fontWeight: 700,
      borderRadius: 99,
      minWidth: 16,
      height: 16,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "0 3px"
    }
  }, pendingHandovers.length)))));
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
    } catch (e) {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [pushStatus, setPushStatus] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const [pushMsg, setPushMsg] = useState('');
  const isDesktop = useIsDesktop();
  const [loginHints, setLoginHints] = useState([]);
  const [showLoginDrop, setShowLoginDrop] = useState(false);
  useEffect(() => {
    fetch('/api/login-hints').then(r => r.json()).then(setLoginHints).catch(() => {});
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
    navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => {
      if (sub) setPushStatus('granted');
    }).catch(() => {});
  }, []);
  useEffect(() => {
    const token = getToken();
    if (token) {
      try {
        const parts = token.split('.');
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)).join(''));
        const payload = JSON.parse(jsonPayload);
        if (payload.exp * 1000 > Date.now()) {
          setUser({
            id: payload.id,
            name: payload.name,
            role: payload.role,
            region: payload.region
          });
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            trySilentSubscribe();
          }
        } else {
          removeToken();
        }
      } catch (e) {
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
    window.history.pushState({
      appFloor: true
    }, '', '');
    const trapBack = () => {
      if (!window.history.state || !window.history.state.appFloor) {
        if (window.confirm('Вы действительно хотите выйти из приложения?')) {
          handleLogout();
        } else {
          window.history.pushState({
            appFloor: true
          }, '', '');
        }
      }
    };
    window.addEventListener('popstate', trapBack);
    return () => window.removeEventListener('popstate', trapBack);
  }, [!!user]);
  const handleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await apiCall('POST', '/api/login', {
        login,
        password
      });
      setToken(data.token);
      setUser(data.user);
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        trySilentSubscribe();
      }
    } catch (e) {
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
    apiCall('POST', '/api/logout').catch(() => {});
    removeToken();
    setUser(null);
  };
  const enablePush = () => {
    setPushMsg('Подключаем...');
    subscribeToPush().then(result => {
      if (typeof Notification !== 'undefined') setPushStatus(Notification.permission);
      setPushMsg(result.ok ? 'Уведомления включены ✓' : 'Ошибка: ' + result.error);
      setTimeout(() => setPushMsg(''), 6000);
    });
  };
  const trySilentSubscribe = () => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    setPushMsg('Проверяем подписку...');
    subscribeToPush().then(result => {
      if (result.ok) setPushStatus('granted');
      setPushMsg(result.ok ? 'Подписка активна ✓' : 'Ошибка подписки: ' + result.error);
      setTimeout(() => setPushMsg(''), 8000);
    });
  };
  const ROLE_LABEL = {
    sales: "Торговый представитель",
    senior_sales: "Старший торговый представитель",
    driver: "Водитель",
    cashier: "Кассир",
    warehouse: "Зав. склад",
    operator: "Оператор",
    admin: "Администратор",
    manager: "Менеджер",
    store: "Магазин"
  };
  if (checking) return /*#__PURE__*/React.createElement("div", {
    style: {
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: C.surface
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 16,
      color: C.textSub
    }
  }, "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430..."));
  if (!user) return /*#__PURE__*/React.createElement("div", {
    style: S.loginWrap
  }, /*#__PURE__*/React.createElement("div", {
    style: S.loginCard
  }, /*#__PURE__*/React.createElement("img", {
    src: "/icon-192.png",
    alt: "",
    style: {
      width: 76,
      height: 76,
      display: "block",
      margin: "0 auto 14px"
    }
  }), /*#__PURE__*/React.createElement("h1", {
    style: {
      ...S.logoTitle,
      textAlign: "center"
    }
  }, "\u0416\u0430\u0439\u044B\u049B \u0410\u049B\u0442\u0430\u0443"), /*#__PURE__*/React.createElement("p", {
    style: {
      ...S.logoSub,
      textAlign: "center"
    }
  }, "\u049B\u04B1\u0441 \u04E9\u043D\u0456\u043C\u0456 \xB7 \u0441\u0438\u0441\u0442\u0435\u043C\u0430 \u0437\u0430\u044F\u0432\u043E\u043A"), error && /*#__PURE__*/React.createElement("div", {
    style: S.errorBox
  }, error), /*#__PURE__*/React.createElement("div", {
    style: S.formGroup
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041B\u043E\u0433\u0438\u043D"), /*#__PURE__*/React.createElement("div", {
    style: {
      position: "relative"
    }
  }, /*#__PURE__*/React.createElement("input", {
    style: S.input,
    value: login,
    onChange: e => {
      setLogin(e.target.value);
      setShowLoginDrop(true);
    },
    onFocus: () => setShowLoginDrop(true),
    onBlur: () => setTimeout(() => setShowLoginDrop(false), 180),
    placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043B\u043E\u0433\u0438\u043D",
    autoComplete: "off"
  }), showLoginDrop && (() => {
    const q = login.toLowerCase();
    const matched = q ? loginHints.filter(u => u.login.toLowerCase().includes(q) || u.name.toLowerCase().includes(q)) : loginHints;
    return matched.length > 0 && /*#__PURE__*/React.createElement("div", {
      style: {
        position: "absolute",
        top: "100%",
        left: 0,
        right: 0,
        background: C.white,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        zIndex: 50,
        maxHeight: 240,
        overflowY: "auto",
        marginTop: 4
      }
    }, matched.map(u => /*#__PURE__*/React.createElement("div", {
      key: u.login,
      onMouseDown: () => {
        setLogin(u.login);
        setShowLoginDrop(false);
        document.getElementById('loginPasswordInput')?.focus();
      },
      style: {
        padding: "10px 12px",
        cursor: "pointer",
        borderBottom: `1px solid ${C.border}`,
        fontSize: 15
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        fontWeight: 600,
        color: C.text
      }
    }, u.name), /*#__PURE__*/React.createElement("div", {
      style: {
        fontSize: 13,
        color: C.textFaint
      }
    }, u.login))));
  })())), /*#__PURE__*/React.createElement("div", {
    style: {
      ...S.formGroup,
      marginBottom: 20
    }
  }, /*#__PURE__*/React.createElement("label", {
    style: S.label
  }, "\u041F\u0430\u0440\u043E\u043B\u044C"), /*#__PURE__*/React.createElement("input", {
    id: "loginPasswordInput",
    style: S.input,
    type: "password",
    value: password,
    onChange: e => setPassword(e.target.value),
    placeholder: "\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u043F\u0430\u0440\u043E\u043B\u044C",
    onKeyDown: e => e.key === "Enter" && handleLogin()
  })), /*#__PURE__*/React.createElement("button", {
    style: {
      ...S.btnPrimary,
      opacity: loading ? 0.7 : 1
    },
    onClick: handleLogin,
    disabled: loading
  }, loading ? "Вход..." : "Войти")));

  // менеджер/админ/оператор на большом экране — версия с сайдбаром
  if ((user.role === "admin" || user.role === "manager" || user.role === "operator") && isDesktop) {
    return /*#__PURE__*/React.createElement("div", {
      style: S.app
    }, (pushStatus === "default" || pushMsg) && /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.accent,
        color: "#fff",
        padding: "10px 16px",
        fontSize: 15
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", null, "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F, \u0447\u0442\u043E\u0431\u044B \u043D\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u043D\u043E\u0432\u044B\u0435 \u0437\u0430\u044F\u0432\u043A\u0438"), /*#__PURE__*/React.createElement("button", {
      onClick: enablePush,
      style: {
        background: "#fff",
        color: C.accent,
        border: "none",
        borderRadius: 8,
        padding: "6px 14px",
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C")), pushMsg && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontSize: 14,
        opacity: 0.95
      }
    }, pushMsg)), pushStatus === "denied" && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#78716C",
        color: "#fff",
        padding: "10px 16px",
        fontSize: 14,
        lineHeight: 1.4
      }
    }, "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430. \u0417\u0430\u0439\u0434\u0438\u0442\u0435 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \"\u0416\u0430\u0439\u044B\u043A\" \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0438\u0445 \u0432\u0440\u0443\u0447\u043D\u0443\u044E."), /*#__PURE__*/React.createElement(AdminCabinet, {
      user: user,
      onLogout: handleLogout,
      desktop: true
    }));
  }

  // магазин на большом экране — тоже версия с сайдбаром
  if (user.role === "store" && isDesktop) {
    return /*#__PURE__*/React.createElement("div", {
      style: S.app
    }, (pushStatus === "default" || pushMsg) && /*#__PURE__*/React.createElement("div", {
      style: {
        background: C.accent,
        color: "#fff",
        padding: "10px 16px",
        fontSize: 15
      }
    }, /*#__PURE__*/React.createElement("div", {
      style: {
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12
      }
    }, /*#__PURE__*/React.createElement("span", null, "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F, \u0447\u0442\u043E\u0431\u044B \u043D\u0435 \u043F\u0440\u043E\u043F\u0443\u0441\u043A\u0430\u0442\u044C \u0441\u0442\u0430\u0442\u0443\u0441 \u0437\u0430\u043A\u0430\u0437\u043E\u0432"), /*#__PURE__*/React.createElement("button", {
      onClick: enablePush,
      style: {
        background: "#fff",
        color: C.accent,
        border: "none",
        borderRadius: 8,
        padding: "6px 14px",
        fontWeight: 700,
        cursor: "pointer",
        whiteSpace: "nowrap"
      }
    }, "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C")), pushMsg && /*#__PURE__*/React.createElement("div", {
      style: {
        marginTop: 6,
        fontSize: 14,
        opacity: 0.95
      }
    }, pushMsg)), pushStatus === "denied" && /*#__PURE__*/React.createElement("div", {
      style: {
        background: "#78716C",
        color: "#fff",
        padding: "10px 16px",
        fontSize: 14,
        lineHeight: 1.4
      }
    }, "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430. \u0417\u0430\u0439\u0434\u0438\u0442\u0435 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \"\u0416\u0430\u0439\u044B\u043A\" \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0438\u0445 \u0432\u0440\u0443\u0447\u043D\u0443\u044E."), /*#__PURE__*/React.createElement(StoreCabinet, {
      user: user,
      onLogout: handleLogout,
      desktop: true
    }));
  }
  return /*#__PURE__*/React.createElement("div", {
    style: S.app
  }, (pushStatus === "default" || pushMsg) && /*#__PURE__*/React.createElement("div", {
    style: {
      background: C.accent,
      color: "#fff",
      padding: "10px 16px",
      fontSize: 15
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: 12
    }
  }, /*#__PURE__*/React.createElement("span", null, "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u0435 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u043E \u0437\u0430\u044F\u0432\u043A\u0430\u0445"), /*#__PURE__*/React.createElement("button", {
    onClick: enablePush,
    style: {
      background: "#fff",
      color: C.accent,
      border: "none",
      borderRadius: 8,
      padding: "6px 14px",
      fontWeight: 700,
      cursor: "pointer",
      whiteSpace: "nowrap"
    }
  }, "\u0412\u043A\u043B\u044E\u0447\u0438\u0442\u044C")), pushMsg && /*#__PURE__*/React.createElement("div", {
    style: {
      marginTop: 6,
      fontSize: 14,
      opacity: 0.95
    }
  }, pushMsg)), pushStatus === "denied" && /*#__PURE__*/React.createElement("div", {
    style: {
      background: "#78716C",
      color: "#fff",
      padding: "10px 16px",
      fontSize: 14,
      lineHeight: 1.4
    }
  }, "\u0423\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u044F \u0437\u0430\u0431\u043B\u043E\u043A\u0438\u0440\u043E\u0432\u0430\u043D\u044B \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u0442\u0435\u043B\u0435\u0444\u043E\u043D\u0430. \u0417\u0430\u0439\u0434\u0438\u0442\u0435 \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0443\u0432\u0435\u0434\u043E\u043C\u043B\u0435\u043D\u0438\u0439 \u043F\u0440\u0438\u043B\u043E\u0436\u0435\u043D\u0438\u044F \"\u0416\u0430\u0439\u044B\u043A\" \u0432 \u0441\u0438\u0441\u0442\u0435\u043C\u0435 \u0438 \u0440\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0438\u0445 \u0432\u0440\u0443\u0447\u043D\u0443\u044E."), /*#__PURE__*/React.createElement("div", {
    style: S.header
  }, /*#__PURE__*/React.createElement(Brand, {
    size: 40
  }), /*#__PURE__*/React.createElement("div", {
    style: {
      textAlign: "right"
    }
  }, /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 15,
      fontWeight: 700,
      color: C.text
    }
  }, user.name), /*#__PURE__*/React.createElement("div", {
    style: {
      fontSize: 13,
      color: C.textSub
    }
  }, ROLE_LABEL[user.role], " \xB7 ", /*#__PURE__*/React.createElement("button", {
    style: S.logoutBtn,
    onClick: handleLogout
  }, "\u0412\u044B\u0439\u0442\u0438")))), (user.role === "sales" || user.role === "senior_sales") && /*#__PURE__*/React.createElement(SalesCabinet, {
    user: user,
    onLogout: handleLogout
  }), user.role === "store" && /*#__PURE__*/React.createElement(StoreCabinet, {
    user: user,
    onLogout: handleLogout
  }), user.role === "driver" && /*#__PURE__*/React.createElement(DriverCabinet, {
    user: user,
    onLogout: handleLogout
  }), user.role === "cashier" && /*#__PURE__*/React.createElement(CashierCabinet, {
    user: user,
    onLogout: handleLogout
  }), user.role === "warehouse" && /*#__PURE__*/React.createElement(WarehouseCabinet, {
    user: user,
    onLogout: handleLogout
  }), (user.role === "admin" || user.role === "manager" || user.role === "operator") && /*#__PURE__*/React.createElement(AdminCabinet, {
    user: user,
    onLogout: handleLogout,
    desktop: false
  }));
}
ReactDOM.render(/*#__PURE__*/React.createElement(App, null), document.getElementById('root'));
