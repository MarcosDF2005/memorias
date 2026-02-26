// Config cargada desde JSON (se rellena al iniciar)
let config = null;
let currentFriendId = null;
let currentUser = null; // { userId, nombre, avatar }

const API_BASE = "";
const STORAGE_CALENDARIO = "memoria_calendario";
const STORAGE_EVENTOS = "memoria_eventos";
const STORAGE_CAPSULAS = "memoria_capsulas";
const STORAGE_ACTIVITY = "memoria_activity";
const STORAGE_NOTIF_SEEN = "memoria_notif_seen";
const STORAGE_STREAK_PREFIX = "memoria_streak_";
const STORAGE_STREAK_BADGES = "memoria_streak_badges";
const STORAGE_STREAK_BADGE_ACTIVE = "memoria_streak_badge_active";
const STORAGE_ESTADOS = "memoria_estados";
const STORAGE_ESTADOS_SEEN = "memoria_estados_seen";
const STORAGE_ESTADOS_LIKES = "memoria_estados_likes";
const STORAGE_ONBOARDING_DONE = "memoria_onboarding_done";
const STORAGE_HUB_TOUR_DONE = "memoria_hub_tour_done";
const ESTADOS_TTL_MS = 24 * 60 * 60 * 1000;
const ESTADO_VIEW_DURATION_MS = 8000;

let calendarioCache = [];
let eventosCache = [];
let capsulasCache = [];
let activityNotifications = [];
let currentStreak = 0;
let bestStreak = 0;
let currentEstadoIndex = null;
let estadoProgressTimeout = null;
let estadoDraft = {
  photoDataUrl: null,
  rotation: 0,
  brightness: 100,
  contrast: 100,
  saturate: 100,
};

function pushLocalActivity(notif) {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_ACTIVITY) || "[]");
    stored.unshift({
      id: "local_" + Date.now(),
      ...notif,
      createdAt: new Date().toISOString(),
    });
    if (stored.length > 30) stored.length = 30;
    localStorage.setItem(STORAGE_ACTIVITY, JSON.stringify(stored));
  } catch {}
}

async function loadActivityNotifications() {
  let fromApi = [];
  try {
    const res = await fetch(`${API_BASE}/api/notifications`, { credentials: "include" });
    if (res.ok) fromApi = await res.json();
  } catch {}
  const fromLocal = JSON.parse(localStorage.getItem(STORAGE_ACTIVITY) || "[]");
  const mine = currentUser?.userId;
  const filtered = [...fromApi, ...fromLocal].filter(n => !mine || n.createdBy !== mine);
  activityNotifications = filtered
    .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0))
    .slice(0, 20);
  return activityNotifications;
}

async function loadCalendarioUser() {
  try {
    const res = await fetch(`${API_BASE}/api/calendario`);
    if (res.ok) {
      calendarioCache = await res.json();
      return calendarioCache;
    }
  } catch {}
  calendarioCache = JSON.parse(localStorage.getItem(STORAGE_CALENDARIO) || "[]");
  return calendarioCache;
}
function getCalendarioUser() {
  return calendarioCache;
}
async function addCalendarioItem(item) {
  try {
    const res = await fetch(`${API_BASE}/api/calendario`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const saved = await res.json();
      calendarioCache = [...calendarioCache, saved];
      await loadActivityNotifications();
      renderNotifications();
      return saved;
    }
  } catch {}
  if (!item.id) item.id = "cal_" + Date.now();
  calendarioCache = [...calendarioCache, item];
  localStorage.setItem(STORAGE_CALENDARIO, JSON.stringify(calendarioCache));
  const nombre = (currentUser && (config?.friends?.[currentUser.userId]?.nombre || currentUser.nombre)) || "Alguien";
  pushLocalActivity({
    type: "calendario",
    title: item.titulo || "Nueva fecha",
    subtitle: `${nombre} añadió una fecha al calendario`,
    screen: "calendar-screen",
    createdBy: currentUser?.userId,
  });
  loadActivityNotifications().then(() => renderNotifications());
}
async function deleteCalendarioApi(id) {
  try {
    const res = await fetch(`${API_BASE}/api/calendario/${id}`, { method: "DELETE" });
    if (res.ok) {
      calendarioCache = calendarioCache.filter((x) => x.id !== id);
      return true;
    }
  } catch {}
  calendarioCache = calendarioCache.filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_CALENDARIO, JSON.stringify(calendarioCache));
}

async function loadEventosUser() {
  try {
    const res = await fetch(`${API_BASE}/api/eventos`);
    if (res.ok) {
      eventosCache = await res.json();
      return eventosCache;
    }
  } catch {}
  eventosCache = JSON.parse(localStorage.getItem(STORAGE_EVENTOS) || "[]");
  return eventosCache;
}
function getEventosUser() {
  return eventosCache;
}
async function addEventoItem(item) {
  try {
    const res = await fetch(`${API_BASE}/api/eventos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const saved = await res.json();
      eventosCache = [...eventosCache, saved];
      await loadActivityNotifications();
      renderNotifications();
      return saved;
    }
  } catch {}
  if (!item.id) item.id = "evt_" + Date.now();
  eventosCache = [...eventosCache, item];
  localStorage.setItem(STORAGE_EVENTOS, JSON.stringify(eventosCache));
  const nombre = (currentUser && (config?.friends?.[currentUser.userId]?.nombre || currentUser.nombre)) || "Alguien";
  pushLocalActivity({
    type: "evento",
    title: item.titulo || "Nuevo evento",
    subtitle: `${nombre} creó un evento`,
    screen: "eventos-screen",
    createdBy: currentUser?.userId,
  });
  loadActivityNotifications().then(() => renderNotifications());
}
async function deleteEventoApi(id) {
  try {
    const res = await fetch(`${API_BASE}/api/eventos/${id}`, { method: "DELETE" });
    if (res.ok) {
      eventosCache = eventosCache.filter((x) => x.id !== id);
      return true;
    }
  } catch {}
  eventosCache = eventosCache.filter((x) => x.id !== id);
  localStorage.setItem(STORAGE_EVENTOS, JSON.stringify(eventosCache));
}

async function loadCapsulasUser() {
  try {
    const res = await fetch(`${API_BASE}/api/capsulas`, { credentials: "include" });
    if (res.ok) {
      capsulasCache = await res.json();
      return capsulasCache;
    }
  } catch {}
  capsulasCache = JSON.parse(localStorage.getItem(STORAGE_CAPSULAS) || "[]");
  return capsulasCache;
}
function getCapsulasUser() {
  return capsulasCache;
}
async function addCapsulaItem(item) {
  const payload = {
    titulo: item.titulo || "",
    fechaApertura: item.fechaApertura || "",
    permittedUsers: item.permittedUsers && item.permittedUsers.length > 0 ? item.permittedUsers : undefined,
    createdBy: item.createdBy || undefined,
  };
  try {
    const res = await fetch(`${API_BASE}/api/capsulas`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const saved = await res.json();
      capsulasCache = [...capsulasCache, saved];
      await loadActivityNotifications();
      renderNotifications();
      return saved;
    }
  } catch {}
  if (!item.id) item.id = "cap_" + Date.now();
  if (!item.mensajes) item.mensajes = [];
  capsulasCache = [...capsulasCache, item];
  localStorage.setItem(STORAGE_CAPSULAS, JSON.stringify(capsulasCache));
  const nombre = (currentUser && (config?.friends?.[currentUser.userId]?.nombre || currentUser.nombre)) || "Alguien";
  pushLocalActivity({
    type: "capsula",
    title: item.titulo || "Nueva cápsula",
    subtitle: `${nombre} creó una cápsula del tiempo`,
    screen: "capsulas-screen",
    createdBy: currentUser?.userId,
  });
  loadActivityNotifications().then(() => renderNotifications());
}
async function deleteCapsulaApi(id) {
  try {
    const res = await fetch(`${API_BASE}/api/capsulas/${id}`, { method: "DELETE", credentials: "include" });
    if (res.ok) {
      capsulasCache = capsulasCache.filter((x) => x.id !== id);
      localStorage.setItem(STORAGE_CAPSULAS, JSON.stringify(capsulasCache));
      return true;
    }
  } catch {}
  return false;
}

async function addMensajeCapsulaApi(capId, msj) {
  try {
    const res = await fetch(`${API_BASE}/api/capsulas/${capId}/mensajes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ msj }),
    });
    if (res.ok) {
      const mensaje = await res.json();
      const cap = capsulasCache.find((c) => c.id === capId);
      if (cap) {
        cap.mensajes = cap.mensajes || [];
        cap.mensajes.push(mensaje);
      }
      return mensaje;
    }
  } catch {}
  const cap = capsulasCache.find((c) => c.id === capId);
  if (cap && currentUser) {
    const mensaje = { de: currentUser.nombre, msj };
    cap.mensajes = cap.mensajes || [];
    cap.mensajes.push(mensaje);
    localStorage.setItem(STORAGE_CAPSULAS, JSON.stringify(capsulasCache));
    return mensaje;
  }
  return null;
}

/** Comprueba si el usuario actual puede acceder a la cápsula */
function canAccessCapsula(cap) {
  if (!cap.permittedUsers || cap.permittedUsers.length === 0) return true;
  if (currentUser && cap.createdBy === currentUser.userId) return true;
  return currentUser && cap.permittedUsers.includes(currentUser.userId);
}

/** Comprueba si el portal está abierto: hoy es su cumple o ya pasó este año */
function isUnlocked(cumpleanos) {
  if (!cumpleanos || !/^\d{1,2}-\d{1,2}$/.test(cumpleanos)) return false;
  const hoy = new Date();
  const [cumpleMes, cumpleDia] = cumpleanos.split("-").map(Number);
  const hoyNum = (hoy.getMonth() + 1) * 100 + hoy.getDate();
  const cumpleNum = cumpleMes * 100 + cumpleDia;
  return hoyNum >= cumpleNum;
}

/** Devuelve todos los portales: todos los amigos con cumpleaños, ordenados por fecha */
function getVisiblePortalUsers() {
  if (!config) return [];
  const hoy = new Date();
  const hoyNum = (hoy.getMonth() + 1) * 100 + hoy.getDate();

  const withCumple = config.friendOrder
    .map(userId => ({ userId, data: config.friends[userId] }))
    .filter(({ data }) => data && data.cumpleanos && /^\d{1,2}-\d{1,2}$/.test(data.cumpleanos));

  return withCumple
    .map(({ userId, data }) => {
      const [mes, dia] = data.cumpleanos.split("-").map(Number);
      const cumpleNum = mes * 100 + dia;
      const unlocked = cumpleNum <= hoyNum;
      return { userId, data, unlocked, cumpleNum };
    })
    .sort((a, b) => a.cumpleNum - b.cumpleNum);
}

/** Comprueba si una fecha MM-DD ya pasó este año */
function isDateUnlocked(fecha) {
  const [mes, dia] = fecha.split("-").map(Number);
  const hoyNum = (new Date().getMonth() + 1) * 100 + new Date().getDate();
  const fechaNum = mes * 100 + dia;
  return hoyNum >= fechaNum;
}

/** Formatea MM-DD a texto legible */
function formatFecha(fecha) {
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const [mes, dia] = fecha.split("-").map(Number);
  return `${dia} de ${meses[mes - 1]}`;
}

function formatFechaCompleta(str) {
  if (!str || str.length < 10) return str;
  const [y, m, d] = str.split("-");
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${parseInt(d)} ${meses[parseInt(m) - 1]} ${y}`;
}

// --- Navegación ---
function showScreen(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.add("hidden"));
  const el = document.getElementById(id);
  if (el) el.classList.remove("hidden");
}

function goToHub() {
  const accent = localStorage.getItem("memoria_accent") || currentUser?.color || "#00f3ff";
  document.documentElement.style.setProperty("--accent", accent);
  showScreen("hub-screen");
}

function goToSelector() {
  showScreen("selector-screen");
}

// --- Hub ---
function renderHub() {
  const nav = document.getElementById("hub-nav");
  if (!nav || !config) return;

  const sections = [
    { id: "portales", icon: "🎂", titulo: "PORTALES", subtitulo: "Felicitaciones por cumpleaños", screen: "selector-screen" },
    { id: "calendario", icon: "📅", titulo: "CALENDARIO", subtitulo: "Fechas importantes", screen: "calendar-screen" },
    { id: "eventos", icon: "🎉", titulo: "EVENTOS", subtitulo: "Viajes y salidas", screen: "eventos-screen" },
    { id: "capsulas", icon: "⏳", titulo: "CÁPSULAS", subtitulo: "Mensajes en el tiempo", screen: "capsulas-screen" }
  ];

  nav.innerHTML = sections.map(s => `
    <div class="hub-card-item" data-section="${s.id}" onclick="openSection('${s.id}')">
      <span class="hub-icon-wrap"><span class="hub-icon">${s.icon}</span></span>
      <h3>${s.titulo}</h3>
      <p>${s.subtitulo}</p>
    </div>
  `).join("");

  maybeStartHubTour();
}

function openSection(id) {
  const fns = { portales: renderPortales, calendario: renderCalendario, eventos: renderEventos, capsulas: renderCapsulas };
  fns[id]?.();
}

function renderPortales() {
  renderSelector();
  showScreen("selector-screen");
}

let calendarViewDate = new Date();
let calendarViewMode = "month";
let calendarListDays = 7;
let calendarFilterTipo = "todos";

function getCalendarEntries() {
  const base = (config?.calendario || []).map((x) => ({ ...x, id: null }));
  const user = getCalendarioUser();
  return [...base, ...user];
}

function getCalendarEntriesFiltered() {
  const all = getCalendarEntries();
  if (!calendarFilterTipo || calendarFilterTipo === "todos") return all;
  return all.filter((e) => {
    const tipo = e.tipo || "otro";
    return tipo === calendarFilterTipo;
  });
}

function getEntriesForDay(month, day) {
  return getCalendarEntriesFiltered().filter((e) => {
    const [m, d] = String(e.fecha).split("-").map(Number);
    return m === month && d === day;
  });
}

function changeCalendarMonth(delta) {
  calendarViewDate.setMonth(calendarViewDate.getMonth() + delta);
  renderCalendarioGrid();
}

async function renderCalendario() {
  showScreen("calendar-screen");
  await loadCalendarioUser();
  if (calendarViewMode === "month") {
    renderCalendarioGrid();
  } else {
    renderCalendarioList();
  }
}

function renderCalendarioGrid() {
  const container = document.getElementById("calendar-days");
  const label = document.getElementById("calendar-month-label");
  if (!container || !label) return;

  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const year = calendarViewDate.getFullYear();
  const month = calendarViewDate.getMonth();
  label.textContent = `${meses[month]} ${year}`;

  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  let startDay = first.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = last.getDate();

  const hoy = new Date();
  const isToday = (d) => hoy.getDate() === d && hoy.getMonth() === month && hoy.getFullYear() === year;

  let html = "";
  for (let i = 0; i < startDay; i++) {
    html += '<div class="calendar-day empty"></div>';
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const entries = getEntriesForDay(month + 1, d);
    const hasEntries = entries.length > 0;
    const today = isToday(d);
    html += `
      <div class="calendar-day ${today ? "today" : ""} ${hasEntries ? "has-entries" : ""}" 
           onclick="openCalendarDay(${d}, ${month + 1}, ${year})">
        <span class="day-num">${d}</span>
        ${hasEntries ? `<span class="day-dots">${"•".repeat(Math.min(entries.length, 3))}</span>` : ""}
      </div>
    `;
  }
  container.innerHTML = html;
}

function onCalendarFilterChange(value) {
  calendarFilterTipo = value || "todos";
  if (calendarViewMode === "month") {
    renderCalendarioGrid();
  } else {
    renderCalendarioList();
  }
}

function setCalendarView(mode, days) {
  calendarViewMode = mode || "month";
  if (mode === "list" && typeof days === "number") {
    calendarListDays = days;
  }
  const monthView = document.getElementById("calendar-month-view");
  const listView = document.getElementById("calendar-list-view");
  if (monthView && listView) {
    const isMonth = calendarViewMode === "month";
    monthView.classList.toggle("hidden", !isMonth);
    listView.classList.toggle("hidden", isMonth);
  }
  const btnMonth = document.getElementById("calendar-view-month");
  const btn7 = document.getElementById("calendar-view-7");
  const btn30 = document.getElementById("calendar-view-30");
  [btnMonth, btn7, btn30].forEach((b) => b && b.classList.remove("active"));
  if (calendarViewMode === "month" && btnMonth) btnMonth.classList.add("active");
  if (calendarViewMode === "list") {
    if (calendarListDays === 7 && btn7) btn7.classList.add("active");
    else if (calendarListDays === 30 && btn30) btn30.classList.add("active");
  }
  if (calendarViewMode === "month") {
    renderCalendarioGrid();
  } else {
    renderCalendarioList();
  }
}

function renderCalendarioList() {
  const listEl = document.getElementById("calendar-list-view");
  if (!listEl) return;
  const all = getCalendarEntriesFiltered();
  if (!all.length) {
    listEl.innerHTML = `<p class="calendar-list-empty">No hay entradas en el calendario.</p>`;
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const mesesCortos = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

  const withDiff = all
    .map((e) => {
      const [m, d] = String(e.fecha).split("-").map(Number);
      if (!m || !d) return null;
      let date = new Date(today.getFullYear(), m - 1, d);
      date.setHours(0, 0, 0, 0);
      if (date < today) date.setFullYear(date.getFullYear() + 1);
      const diffDays = Math.round((date - today) / (1000 * 60 * 60 * 24));
      return { entry: e, date, diffDays };
    })
    .filter(Boolean)
    .filter((x) => x.diffDays >= 0 && x.diffDays <= calendarListDays)
    .sort((a, b) => a.date - b.date);

  if (!withDiff.length) {
    listEl.innerHTML = `<p class="calendar-list-empty">No hay nada en los próximos ${calendarListDays} días.</p>`;
    return;
  }

  const html = withDiff
    .map(({ entry, date, diffDays }) => {
      const day = date.getDate();
      const monthShort = mesesCortos[date.getMonth()];
      const tipo = entry.tipo || "otro";
      const etiquetaTipo = `<span class="item-type ${tipo}">${tipo}</span>`;
      const desc = entry.descripcion ? `<p>${entry.descripcion}</p>` : "";
      const labelDiff =
        diffDays === 0 ? "Hoy" : diffDays === 1 ? "Mañana" : `En ${diffDays} días`;
      return `
        <div class="calendar-list-item">
          <div class="calendar-list-date">
            <span class="date-day">${day}</span>
            <span class="date-month">${monthShort}</span>
          </div>
          <div class="calendar-list-body">
            ${etiquetaTipo}
            <h4>${entry.titulo}</h4>
            ${desc}
            <p>${labelDiff}</p>
          </div>
        </div>
      `;
    })
    .join("");
  listEl.innerHTML = html;
}

function openCalendarDay(day, month, year) {
  const modal = document.getElementById("calendar-modal");
  const title = modal?.querySelector("#calendar-modal-title span");
  const form = document.getElementById("calendar-day-form");
  const entriesContainer = document.getElementById("calendar-day-entries");

  if (!modal || !form) return;

  const fecha = `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
  const meses = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  if (title) title.textContent = `${day} de ${meses[month - 1]}`;
  form.fecha.value = fecha;
  form.reset();
  form.fecha.value = fecha;

  const entries = getEntriesForDay(month, day);
  if (entriesContainer) {
    entriesContainer.innerHTML = entries.length
      ? entries.map((e) => `
          <div class="day-entry-item ${e.id ? "user-added" : ""}">
            <span class="item-type ${e.tipo}">${e.tipo}</span>
            <strong>${e.titulo}</strong>
            ${e.descripcion ? `<p>${e.descripcion}</p>` : ""}
            ${e.id ? `<button type="button" class="btn-delete" onclick="deleteCalendario('${e.id}', ${day}, ${month})">×</button>` : ""}
          </div>
        `).join("")
      : "<p class='empty-msg'>Nada este día. Añade algo abajo.</p>";
  }

  modal.classList.remove("hidden");
}

function refreshDayModal(day, month) {
  const entriesContainer = document.getElementById("calendar-day-entries");
  const entries = getEntriesForDay(month, day);
  if (entriesContainer) {
    entriesContainer.innerHTML = entries.length
      ? entries.map((e) => `
          <div class="day-entry-item ${e.id ? "user-added" : ""}">
            <span class="item-type ${e.tipo}">${e.tipo}</span>
            <strong>${e.titulo}</strong>
            ${e.descripcion ? `<p>${e.descripcion}</p>` : ""}
            ${e.id ? `<button type="button" class="btn-delete" onclick="deleteCalendario('${e.id}', ${day}, ${month})">×</button>` : ""}
          </div>
        `).join("")
      : "<p class='empty-msg'>Nada este día. Añade algo abajo.</p>";
  }
  renderCalendarioGrid();
}

function closeCalendarModal() {
  document.getElementById("calendar-modal")?.classList.add("hidden");
}

async function addCalendarioFromDay(e) {
  e.preventDefault();
  const f = e.target;
  const item = {
    fecha: f.fecha.value,
    tipo: f.tipo.value,
    titulo: f.titulo.value.trim(),
    descripcion: f.descripcion.value.trim() || undefined
  };
  await addCalendarioItem(item);
  const [month, day] = f.fecha.value.split("-").map(Number);
  f.titulo.value = "";
  f.descripcion.value = "";
  refreshDayModal(day, month);
  highlightLastDayEntry();
  renderCalendarioGrid();
}

async function deleteCalendario(id, day, month) {
  await deleteCalendarioApi(id);
  if (day != null && month != null) {
    refreshDayModal(day, month);
  }
}

function highlightLastDayEntry() {
  const container = document.getElementById("calendar-day-entries");
  if (!container) return;
  const items = container.querySelectorAll(".day-entry-item");
  if (!items.length) return;
  const last = items[items.length - 1];
  last.classList.add("just-added");
  setTimeout(() => last.classList.remove("just-added"), 900);
}

async function renderEventos() {
  const list = document.getElementById("eventos-list");
  if (!list || !config) return;

  await loadEventosUser();
  const base = config.eventos || [];
  const user = getEventosUser();
  const items = [...base, ...user].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));

  if (items.length === 0) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">📅</div>
        <p class="empty-msg">No hay eventos registrados aún.</p>
        <p class="empty-hint">Pulsa «Crear evento» para añadir el primero.</p>
      </div>
    `;
  } else {
    list.innerHTML = items.map((item) => {
      const isUser = !!item.id;
      const fechaStr = formatFechaCompleta(item.fecha);
      const fechaParts = fechaStr.split(" ");
      const day = fechaParts[0] || "";
      const month = fechaParts[1] || "";
      const year = fechaParts[2] || "";
      
      return `
      <div class="event-card ${isUser ? "user-added" : ""}" ${isUser && item.id ? `data-event-id="${item.id}"` : ""}>
        <div class="event-date-badge">
          <span class="date-day">${day}</span>
          <span class="date-month">${month}</span>
          ${year ? `<span class="date-year">${year}</span>` : ""}
        </div>
        <div class="event-content">
          <h4 class="event-title">${item.titulo}</h4>
          ${item.descripcion ? `<p class="event-description">${item.descripcion}</p>` : ""}
          ${item.lugar ? `<div class="event-location">📍 ${item.lugar}</div>` : ""}
        </div>
        ${isUser ? `<button type="button" class="btn-delete-event" onclick="deleteEvento('${item.id}')" title="Eliminar">×</button>` : ""}
      </div>
    `}).join("");
  }
  showScreen("eventos-screen");
}

function openEventoCreateModal() {
  document.getElementById("evento-create-modal")?.classList.remove("hidden");
}

function closeEventoCreateModal() {
  document.getElementById("evento-create-modal")?.classList.add("hidden");
}

async function addEvento(e) {
  e.preventDefault();
  const f = e.target;
  const item = {
    fecha: f.fecha.value,
    titulo: f.titulo.value.trim(),
    descripcion: f.descripcion.value.trim() || undefined,
    lugar: f.lugar.value.trim() || undefined
  };
  
  if (!item.titulo || !item.fecha) return;
  
  const saved = await addEventoItem(item);
  const newId = (saved && saved.id) || item.id;
  f.reset();
  const btn = f.querySelector(".btn-add-evento");
  if (btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = "✓ Añadido";
    btn.style.background = "rgba(0, 243, 255, 0.2)";
    setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ""; }, 1500);
  }
  closeEventoCreateModal();
  await renderEventos();
  if (newId) highlightNewEventCard(newId);
}

function highlightNewEventCard(id) {
  const el = document.querySelector(`.event-card[data-event-id="${id}"]`);
  if (!el) return;
  el.classList.add("just-added");
  setTimeout(() => el.classList.remove("just-added"), 900);
}

async function deleteEvento(id) {
  await deleteEventoApi(id);
  renderEventos();
}

function renderCapsulaPermittedCheckboxes() {
  const container = document.getElementById("capsula-permitted-checkboxes");
  if (!container || !config) return;
  const order = config.friendOrder || [];
  container.innerHTML = order.map((id) => {
    const d = config.friends?.[id];
    const nombre = d?.nombre || id;
    const safeVal = String(id).replace(/"/g, "&quot;");
    return `
      <label class="permitted-chip">
        <input type="checkbox" name="permitted" value="${safeVal}">
        <span class="chip-label">${nombre.replace(/</g, "&lt;")}</span>
      </label>
    `;
  }).join("");
}

async function renderCapsulas() {
  const list = document.getElementById("capsulas-list");
  if (!list || !config) return;

  renderCapsulaPermittedCheckboxes();
  await loadCapsulasUser();
  const base = (config.capsulasTiempo || []).filter((c) => canAccessCapsula({ ...c, permittedUsers: c.permittedUsers }));
  const user = getCapsulasUser().filter((c) => canAccessCapsula(c));
  const capsulas = [...base, ...user].sort((a, b) => (a.fechaApertura || "").localeCompare(b.fechaApertura || ""));

  list.innerHTML = capsulas.map(cap => {
    const unlocked = isDateUnlocked(cap.fechaApertura);
    const isUser = !!cap.id;
    const clickable = isUser && canAccessCapsula(cap);
    return `
      <div class="content-item capsula-item ${unlocked ? "unlocked" : "locked"} ${isUser ? "user-added" : ""} ${clickable ? "clickable" : ""}"
        ${isUser && cap.id ? `data-cap-id="${cap.id}"` : ""} ${clickable ? `onclick="openCapsulaDetail('${cap.id}')"` : ""}>
        <span class="capsula-status">${unlocked ? "🔓 ABIERTA" : "🔒 BLOQUEADA"}</span>
        <div class="item-body">
          <h4>${cap.titulo}</h4>
          ${!unlocked ? `<span class="item-fecha">Se abre: ${formatFecha(cap.fechaApertura)}</span>` : ""}
          ${!unlocked && isUser ? `<span class="capsula-hint">Deja un mensaje antes de que se abra</span>` : ""}
        </div>
        ${isUser && currentUser && cap.createdBy === currentUser.userId ? `<button type="button" class="btn-delete-event" onclick="event.stopPropagation(); deleteCapsula('${cap.id}')" title="Eliminar">×</button>` : ""}
      </div>
    `;
  }).join("") || "<p class='empty-msg'>No hay cápsulas del tiempo.</p>";
  showScreen("capsulas-screen");
}

function openCapsulaCreateModal() {
  renderCapsulaPermittedCheckboxes();
  document.getElementById("capsula-create-modal")?.classList.remove("hidden");
}

function closeCapsulaCreateModal() {
  document.getElementById("capsula-create-modal")?.classList.add("hidden");
}

async function addCapsula(e) {
  e.preventDefault();
  const f = e.target;
  const tituloInput = f.querySelector('[name="titulo"]');
  const fechaInput = f.querySelector('[name="fechaApertura"]');
  const titulo = tituloInput ? tituloInput.value.trim() : "";
  const rawDate = fechaInput ? fechaInput.value : "";
  const fechaApertura = rawDate ? rawDate.slice(5, 7) + "-" + rawDate.slice(8, 10) : "";
  let permitted = Array.from(f.querySelectorAll('input[name="permitted"]:checked'))
    .map((cb) => cb.value?.trim())
    .filter(Boolean);
  if (permitted.length > 0 && currentUser && !permitted.includes(currentUser.userId)) {
    permitted = [currentUser.userId, ...permitted];
  }
  const item = {
    titulo,
    fechaApertura,
    mensajes: [],
    permittedUsers: permitted.length > 0 ? permitted : undefined,
    createdBy: currentUser?.userId,
  };
  if (!item.titulo || !item.fechaApertura) return;
  const saved = await addCapsulaItem(item);
  const newId = (saved && saved.id) || item.id;
  if (tituloInput) tituloInput.value = "";
  if (fechaInput) fechaInput.value = "";
  f.querySelectorAll('input[name="permitted"]').forEach((cb) => { cb.checked = false; });
  const btn = f.querySelector(".btn-add-capsula");
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = "✓ Creada";
    btn.style.background = "rgba(0, 243, 255, 0.2)";
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ""; }, 1500);
  }
  closeCapsulaCreateModal();
  await renderCapsulas();
  if (newId) highlightNewCapsulaCard(newId);
}

function highlightNewCapsulaCard(id) {
  const el = document.querySelector(`.capsula-item[data-cap-id="${id}"]`);
  if (!el) return;
  el.classList.add("just-added");
  setTimeout(() => el.classList.remove("just-added"), 900);
}

async function deleteCapsula(id) {
  await deleteCapsulaApi(id);
  renderCapsulas();
}

let currentCapsulaId = null;

async function openCapsulaDetail(id) {
  try {
    const res = await fetch(`${API_BASE}/api/capsulas/${id}`, { credentials: "include" });
    if (!res.ok) {
      if (res.status === 403) alert("No tienes acceso a esta cápsula.");
      return;
    }
    const cap = await res.json();
    currentCapsulaId = id;
    renderCapsulaDetail(cap);
    showScreen("capsula-detail-screen");
  } catch {
    alert("No se pudo abrir la cápsula.");
  }
}

async function renderCapsulaDetail(cap) {
  const titleEl = document.getElementById("capsula-detail-title");
  const fechaEl = document.getElementById("capsula-detail-fecha");
  const msgsEl = document.getElementById("capsula-detail-mensajes");
  const formWrap = document.getElementById("capsula-detail-form-wrap");
  const form = document.getElementById("capsula-detail-form");
  const accessMsg = document.getElementById("capsula-detail-access-msg");
  if (!titleEl || !msgsEl) return;

  const unlocked = isDateUnlocked(cap.fechaApertura);
  const canAdd = currentUser && canAccessCapsula(cap);

  titleEl.textContent = cap.titulo;
  if (fechaEl) fechaEl.textContent = "Se abre: " + formatFecha(cap.fechaApertura);
  if (accessMsg) accessMsg.style.display = canAdd ? "none" : "";
  if (formWrap) formWrap.style.display = canAdd ? "block" : "none";
  if (!canAdd && accessMsg) {
    accessMsg.textContent = currentUser ? "No tienes acceso a esta cápsula." : "Inicia sesión para dejar mensajes.";
    accessMsg.style.display = "block";
  }
  const textarea = form?.querySelector('textarea[name="msj"]');
  const submitBtn = form?.querySelector('button[type="submit"]');
  if (textarea) textarea.disabled = !canAdd;
  if (submitBtn) submitBtn.disabled = !canAdd;

  msgsEl.innerHTML = unlocked
    ? (cap.mensajes || []).map((m) => `
        <div class="capsula-msg">
          <strong>${m.de}:</strong> ${m.msj}
        </div>
      `).join("") || "<p class='empty-msg'>Aún no hay mensajes.</p>"
    : `<p class="capsula-sealed">🔒 Los mensajes se mostrarán el ${formatFecha(cap.fechaApertura)}</p><p class="capsula-sealed-sub">${(cap.mensajes || []).length} persona(s) ya han dejado mensaje.</p>`;

  if (form) {
    const capIdInput = form.querySelector('input[name="capId"]');
    if (capIdInput) capIdInput.value = cap.id;
    form.reset();
    if (capIdInput) capIdInput.value = cap.id;
  }
}

async function addMensajeCapsula(e) {
  e.preventDefault();
  const f = e.target;
  const capId = f.capId?.value || f.querySelector('input[name="capId"]')?.value;
  const msj = (f.msj && f.msj.value || "").trim();
  if (!msj || !capId) return;
  if (!currentUser) return;
  const cap = capsulasCache.find((c) => c.id === capId);
  if (cap && !canAccessCapsula(cap)) return;
  await addMensajeCapsulaApi(capId, msj);
  if (cap) renderCapsulaDetail(cap);
  const msjInput = f.querySelector('textarea[name="msj"]');
  if (msjInput) msjInput.value = "";
}

function showCapsulaDetailBack() {
  currentCapsulaId = null;
  renderCapsulas();
}

// --- Selector de amigos ---
function renderSelector() {
  const container = document.getElementById("selector-container");
  if (!container || !config) return;

  const visible = getVisiblePortalUsers();
  container.innerHTML = visible.map(({ userId, data, unlocked }) => `
    <div class="profile-card${unlocked ? "" : " locked"}" ${unlocked ? `onclick="launchPortal('${userId}')"` : ""}>
      <div class="img-wrapper">
        <img src="${data.avatar || ''}" alt="${data.nombre || userId}" decoding="async" loading="lazy">
        ${!unlocked ? '<div class="lock-overlay">🔒</div>' : ""}
      </div>
      <p class="name">${userId.toUpperCase()}</p>
      ${!unlocked ? '<span class="badge">ACCESO DENEGADO</span>' : ""}
      ${unlocked && (data.memorias || []).length > 0 ? '<span class="archivo-badge">📁</span>' : ""}
    </div>
  `).join("");
  showScreen("selector-screen");
}

// --- Portal y cápsula de cumpleaños ---
function launchPortal(userId) {
  const data = config?.friends[userId];
  if (!data) return;

  currentFriendId = userId;
  document.documentElement.style.setProperty("--accent", data.color);

  showScreen("selector-screen");
  setTimeout(() => {
    showScreen("loading-screen");
    startLoadingSequence(data);
  }, 300);
}

function startLoadingSequence(data) {
  const output = document.getElementById("terminal-output");
  const fill = document.getElementById("progress-fill");
  if (output) output.innerHTML = "";
  if (fill) fill.style.width = "0%";
  let i = 0;

  const interval = setInterval(() => {
    if (i < config.terminalStrings.length && output) {
      const p = document.createElement("p");
      p.textContent = config.terminalStrings[i];
      p.style.marginBottom = "5px";
      output.appendChild(p);
      if (fill) fill.style.width = `${((i + 1) / config.terminalStrings.length) * 100}%`;
      i++;
    } else {
      clearInterval(interval);
      setTimeout(() => transitionToPortal(data), 800);
    }
  }, 700);
}

function transitionToPortal(data) {
  // Limpiar terminal output al volver
  const terminalOutput = document.getElementById("terminal-output");
  if (terminalOutput) terminalOutput.innerHTML = "";
  const progressFill = document.getElementById("progress-fill");
  if (progressFill) progressFill.style.width = "0%";
  
  showScreen("portal-screen");
  document.getElementById("friend-avatar").src = data.avatar;
  document.getElementById("data-name").textContent = data.nombre;

  document.getElementById("access-btn").onclick = () => showCapsule(data);
  document.getElementById("archivo-btn").onclick = () => showMemorias(currentFriendId);
}

function showCapsule(data) {
  showScreen("capsule-screen");
  const messageEl = document.getElementById("personal-message");
  if (messageEl) messageEl.textContent = data.msj || "";

  const grid = document.getElementById("photo-grid");
  if (grid) {
    grid.innerHTML = "";
    (data.fotos || []).forEach(src => {
      const img = document.createElement("img");
      img.decoding = "async";
      img.loading = "eager";
      img.src = src;
      img.onerror = () => (img.style.display = "none");
      grid.appendChild(img);
    });
  }

  const backBtn = document.getElementById("capsule-back-btn");
  if (backBtn) {
    backBtn.onclick = () => transitionToPortal(data);
  }
}

// --- Archivo de memorias por persona ---
function showMemorias(userId) {
  const data = config?.friends[userId];
  if (!data) return;

  document.getElementById("memorias-title").textContent = `ARCHIVO: ${data.nombre.toUpperCase()}`;
  document.getElementById("memorias-subtitle").textContent = "Fotos, mensajes y recuerdos";

  const list = document.getElementById("memorias-list");
  const memorias = data.memorias || [];

  list.innerHTML = memorias.length ? memorias.map(m => `
    <div class="content-item memoria-item">
      <span class="item-fecha">${m.fecha || ""}</span>
      <div class="item-body">
        <h4>${m.titulo}</h4>
        <p>${m.contenido || ""}</p>
        ${(m.fotos || []).length ? `
          <div class="photo-grid small">
            ${m.fotos.map(f => `<img src="${f}" alt="" decoding="async" loading="lazy">`).join("")}
          </div>
        ` : ""}
      </div>
    </div>
  `).join("") : "<p class='empty-msg'>Aún no hay memorias en este archivo.</p>";

  showScreen("memorias-screen");
}

function showMemoriasBack() {
  if (!currentFriendId) return goToSelector();
  const data = config.friends[currentFriendId];
  showScreen("portal-screen");
  document.getElementById("friend-avatar").src = data.avatar;
  document.getElementById("data-name").textContent = data.nombre;
  document.getElementById("access-btn").onclick = () => showCapsule(data);
  document.getElementById("archivo-btn").onclick = () => showMemorias(currentFriendId);
}

// --- Auth ---
const fetchOpts = { credentials: "include" };

async function checkAuth() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, fetchOpts);
    if (res.ok) {
    const data = await res.json();
    currentUser = { userId: data.userId, nombre: data.nombre, avatar: data.avatar, color: data.color || "#00f3ff" };
      return true;
    }
  } catch {}
  currentUser = null;
  return false;
}

async function doLogin(e) {
  e.preventDefault();
  const form = e.target;
  const errEl = document.getElementById("login-error");
  errEl.textContent = "";
  errEl.classList.add("hidden");
  const username = form.username.value;
  const password = form.password.value;
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      ...fetchOpts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      currentUser = { userId: data.userId, nombre: data.nombre, avatar: data.avatar, color: data.color || "#00f3ff" };
      form.reset();
      showApp();
    } else {
      errEl.textContent = data.error || "Error al iniciar sesión";
      errEl.classList.remove("hidden");
    }
  } catch (err) {
    const isFile = typeof location !== "undefined" && location.protocol === "file:";
    errEl.textContent = isFile
      ? "Abre la app en http://localhost:3000 (no el archivo directamente)"
      : "No hay conexión con el servidor. Ejecuta: npm start";
    errEl.classList.remove("hidden");
  }
}

async function doLogout() {
  try {
    await fetch(`${API_BASE}/api/auth/logout`, { ...fetchOpts, method: "POST" });
  } catch {}
  currentUser = null;
  showLogin();
}

function showLogin() {
  showScreen("login-screen");
}

function continueAsGuest() {
  currentUser = null;
  showApp();
}

function showApp() {
  renderHub();
  renderSelector();
  loadActivityNotifications().then(() => updateHubUser());
  showScreen("hub-screen");
  maybeShowOnboarding();
}

// --- Onboarding inicial + tour del hub ---
let onboardingStep = 0;
const ONBOARDING_STEPS = [
  {
    title: "1 · Portales",
    text: "Cada amigo tiene un portal con su cápsula de cumpleaños: fotos y un mensaje especial que se abre en su día."
  },
  {
    title: "2 · Calendario y Eventos",
    text: "Usad el calendario para guardar cumpleaños, exámenes y planes; en Eventos podéis detallar viajes y quedadas del grupo."
  },
  {
    title: "3 · Cápsulas y Estados",
    text: "Las cápsulas guardan mensajes para el futuro y los estados son historias de 24h para contar cómo va el día."
  }
];

function hasCompletedOnboarding() {
  try { return localStorage.getItem(STORAGE_ONBOARDING_DONE) === "1"; } catch { return false; }
}

function markOnboardingDone() {
  try { localStorage.setItem(STORAGE_ONBOARDING_DONE, "1"); } catch {}
}

function maybeShowOnboarding() {
  if (hasCompletedOnboarding()) return;
  const overlay = document.getElementById("onboarding-overlay");
  if (!overlay) return;
  onboardingStep = 0;
  updateOnboardingStep();
  overlay.classList.remove("hidden");
}

function updateOnboardingStep() {
  const step = ONBOARDING_STEPS[onboardingStep] || ONBOARDING_STEPS[0];
  const titleEl = document.getElementById("onb-step-title");
  const textEl = document.getElementById("onb-step-text");
  const nextBtn = document.getElementById("onb-next-btn");
  if (titleEl) titleEl.textContent = step.title;
  if (textEl) textEl.textContent = step.text;
  document.querySelectorAll(".onb-dot").forEach((dot) => {
    const s = Number(dot.getAttribute("data-step") || "0");
    dot.classList.toggle("active", s === onboardingStep);
  });
  if (nextBtn) {
    nextBtn.textContent = onboardingStep >= ONBOARDING_STEPS.length - 1 ? "Empezar" : "Siguiente";
  }
}

function nextOnboardingStep() {
  if (onboardingStep < ONBOARDING_STEPS.length - 1) {
    onboardingStep += 1;
    updateOnboardingStep();
    return;
  }
  markOnboardingDone();
  const overlay = document.getElementById("onboarding-overlay");
  if (overlay) overlay.classList.add("hidden");
  // Después del onboarding, mostramos un tour rápido por el hub
  startHubTour();
}

function skipOnboarding() {
  markOnboardingDone();
  const overlay = document.getElementById("onboarding-overlay");
  if (overlay) overlay.classList.add("hidden");
}

let hubTourStep = 0;
const HUB_TOUR_STEPS = [
  {
    id: "portales",
    text: "Aquí verás los portales de cumpleaños de cada persona. Cuando llegue su día, podrás abrir su cápsula especial."
  },
  {
    id: "calendario",
    text: "En el calendario guardáis cumpleaños, exámenes y fechas importantes para todo el grupo."
  },
  {
    id: "eventos",
    text: "Usa eventos para planear viajes, fiestas y salidas, con lugar y descripción."
  },
  {
    id: "capsulas",
    text: "Las cápsulas del tiempo guardan mensajes que se abren en fechas concretas. Perfectas para sorpresas."
  }
];

function hasCompletedHubTour() {
  try { return localStorage.getItem(STORAGE_HUB_TOUR_DONE) === "1"; } catch { return false; }
}

function markHubTourDone() {
  try { localStorage.setItem(STORAGE_HUB_TOUR_DONE, "1"); } catch {}
}

function maybeStartHubTour() {
  if (hasCompletedHubTour() || !hasCompletedOnboarding()) return;
  // Se llama después de renderHub; si el overlay de onboarding sigue abierto no hacemos nada aún
  const onboardingOverlay = document.getElementById("onboarding-overlay");
  if (onboardingOverlay && !onboardingOverlay.classList.contains("hidden")) return;
  startHubTour();
}

function startHubTour() {
  if (hasCompletedHubTour()) return;
  const overlay = document.getElementById("hub-tour-overlay");
  if (!overlay) return;
  hubTourStep = 0;
  overlay.classList.remove("hidden");
  updateHubTourStep();
}

function endHubTour() {
  const overlay = document.getElementById("hub-tour-overlay");
  if (overlay) overlay.classList.add("hidden");
  clearHubTourHighlight();
  markHubTourDone();
}

function clearHubTourHighlight() {
  document.querySelectorAll(".hub-card-item.hub-tour-highlight").forEach((el) => {
    el.classList.remove("hub-tour-highlight");
  });
}

function updateHubTourStep() {
  const step = HUB_TOUR_STEPS[hubTourStep];
  const tooltip = document.getElementById("hub-tour-tooltip");
  const textEl = document.getElementById("hub-tour-text");
  const nextBtn = document.getElementById("hub-tour-next-btn");
  if (!step || !tooltip || !textEl) {
    endHubTour();
    return;
  }
  const target = document.querySelector(`.hub-card-item[data-section="${step.id}"]`);
  if (!target) {
    endHubTour();
    return;
  }
  clearHubTourHighlight();
  target.classList.add("hub-tour-highlight");

  textEl.textContent = step.text;
  if (nextBtn) {
    nextBtn.textContent = hubTourStep >= HUB_TOUR_STEPS.length - 1 ? "Listo" : "Siguiente";
  }

  // Posicionar tooltip cerca de la tarjeta
  const rect = target.getBoundingClientRect();
  const tooltipRect = tooltip.getBoundingClientRect();
  const top = rect.bottom + 12;
  let left = rect.left + rect.width / 2 - tooltipRect.width / 2;
  const margin = 12;
  left = Math.max(margin, Math.min(left, window.innerWidth - tooltipRect.width - margin));
  tooltip.style.top = `${top}px`;
  tooltip.style.left = `${left}px`;
}

function nextHubTourStep() {
  if (hubTourStep < HUB_TOUR_STEPS.length - 1) {
    hubTourStep += 1;
    updateHubTourStep();
    return;
  }
  endHubTour();
}

function updateHubUser() {
  const wrap = document.getElementById("hub-user");
  const img = document.getElementById("hub-avatar");
  const name = document.getElementById("hub-name");
  const nextBday = document.getElementById("hub-next-bday");
  const btnMiPortal = document.getElementById("btn-mi-portal-bday");
  const centerEl = wrap?.querySelector(".hub-bar-center");
  const notifWrap = wrap?.querySelector(".hub-bar-right");
  if (!wrap || !img || !name) return;
  if (currentUser) {
    wrap.classList.remove("hidden");
    if (centerEl) centerEl.style.display = "";
    if (notifWrap) notifWrap.style.display = "";
    img.src = currentUser.avatar || "";
    img.alt = currentUser.nombre;
    name.textContent = currentUser.nombre;
    const data = config?.friends?.[currentUser.userId];
    const isAdmin = data?.role === "admin" || !data?.cumpleanos;
    const miPortalUnlocked = !isAdmin && isUnlocked(data.cumpleanos);
    if (btnMiPortal) {
      btnMiPortal.style.display = isAdmin ? "none" : "";
      btnMiPortal.disabled = !miPortalUnlocked;
      btnMiPortal.title = miPortalUnlocked ? "" : "Se abre cuando sea tu cumpleaños";
      btnMiPortal.innerHTML = miPortalUnlocked ? "🎁 Mi portal de cumpleaños" : "🎁 Mi portal de cumpleaños <span class=\"menu-lock\">🔒</span>";
    }
    const accent = localStorage.getItem("memoria_accent") || currentUser.color || "#00f3ff";
    document.documentElement.style.setProperty("--accent", accent);
    applyActiveBadgeIcon();
    const nb = getNextBirthdayText();
    if (nextBday) nextBday.textContent = nb;
    renderProfileMenuColors();
    renderNotifications();
  } else {
    if (centerEl) centerEl.style.display = "none";
    if (notifWrap) notifWrap.style.display = "";
    wrap.classList.remove("hidden");
    loadActivityNotifications().then(() => renderNotifications());
  }
  pingPresence();
  renderEstadosStrip();
}

function daysUntilBirthday(month, day) {
  const hoy = new Date();
  const cumple = new Date(hoy.getFullYear(), month - 1, day);
  cumple.setHours(0, 0, 0, 0);
  hoy.setHours(0, 0, 0, 0);
  if (cumple < hoy) cumple.setFullYear(cumple.getFullYear() + 1);
  return Math.ceil((cumple - hoy) / (1000 * 60 * 60 * 24));
}

function getNextBirthdayText() {
  if (!config) return "";
  const withCumple = config.friendOrder
    .map(id => ({ id, data: config.friends?.[id] }))
    .filter(({ data }) => data?.cumpleanos && /^\d{1,2}-\d{1,2}$/.test(data.cumpleanos));
  let next = null;
  for (const { id, data } of withCumple) {
    const [m, d] = data.cumpleanos.split("-").map(Number);
    const days = daysUntilBirthday(m, d);
    if (!next || days < next.days) next = { id, nombre: data.nombre || id, days };
  }
  if (!next) return "";
  if (next.days === 0) return "¡Hoy es cumple!";
  if (next.days === 1) return `Mañana: ${next.nombre}`;
  return `Próximo: ${next.nombre} en ${next.days}d`;
}

async function pingPresence() {
  try {
    await fetch(`${API_BASE}/api/presence`, { method: "POST", credentials: "include" });
  } catch {}
  refreshPresenceBadge();
  pingDailyStreak();
}

async function refreshPresenceBadge() {
  if (!config) return;
  const order = config.friendOrder || Object.keys(config.friends || {});
  const meId = currentUser?.userId;
  const onlineIds = new Set(meId ? [meId] : []);
  try {
    const res = await fetch(`${API_BASE}/api/presence`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      const ids = Array.isArray(data.ids) ? data.ids : [];
      ids.forEach(id => onlineIds.add(id));
    }
  } catch {}
  const onlineCount = order.filter(id => onlineIds.has(id)).length;
  const badge = document.getElementById("presence-badge");
  if (badge) {
    badge.textContent = String(onlineCount);
    badge.classList.toggle("hidden", onlineCount === 0);
  }
}

function getTodayKey() {
  const d = new Date();
  // YYYY-MM-DD en zona local
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getYesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function updateLocalStreak() {
  if (!currentUser?.userId) return { current: 0, best: 0, milestone: null };
  const key = STORAGE_STREAK_PREFIX + currentUser.userId;
  let rec = { lastDate: null, current: 0, best: 0 };
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null");
    if (parsed && typeof parsed === "object") rec = { ...rec, ...parsed };
  } catch {}

  const today = getTodayKey();
  if (rec.lastDate === today) {
    const cur = rec.current || 1;
    const best = rec.best || cur;
    currentStreak = cur;
    return { current: cur, best, milestone: null };
  }

  const yesterday = getYesterdayKey();
  let current;
  if (rec.lastDate === yesterday) current = (rec.current || 0) + 1;
  else current = 1;

  const best = Math.max(current, rec.best || 0);
  const milestone = [7, 15, 30].includes(current) ? current : null;
  const next = { lastDate: today, current, best };
  try {
    localStorage.setItem(key, JSON.stringify(next));
  } catch {}
  currentStreak = current;
  bestStreak = best;
  return { current, best, milestone };
}

function applyStreakVisuals(streak) {
  const btn = document.getElementById("hub-profile-btn");
  if (!btn) return;
  btn.classList.remove("streak-7", "streak-15", "streak-30");
  let cls = "";
  if (streak >= 30) cls = "streak-30";
  else if (streak >= 15) cls = "streak-15";
  else if (streak >= 7) cls = "streak-7";
  if (cls) btn.classList.add(cls);
}

function maybeShowStreakMilestone(milestone) {
  if (!currentUser?.userId || !milestone) return;
  const key = `${STORAGE_STREAK_PREFIX}${currentUser.userId}_last_milestone`;
  let last = 0;
  try {
    last = parseInt(localStorage.getItem(key) || "0", 10) || 0;
  } catch {}
  if (milestone <= last) return;
  try {
    localStorage.setItem(key, String(milestone));
  } catch {}
  unlockStreakBadge(milestone);
  const mensajes = {
    7: "¡Racha de 7 días! 🔥",
    15: "¡15 días seguidos guardando recuerdos! 🚀",
    30: "¡30 días de racha! Eres leyenda de la memoria. 🏆",
  };
  alert(mensajes[milestone] || `Nueva racha de ${milestone} días 🔥`);
}

function pingDailyStreak() {
  const { current, best, milestone } = updateLocalStreak();
  applyStreakVisuals(current);
  updateStreakWidget(current, best);
  maybeShowStreakMilestone(milestone);
}

function updateStreakWidget(current, best) {
  const widget = document.getElementById("streak-widget");
  const countEl = document.getElementById("streak-count");
  const barInner = document.getElementById("streak-bar-inner");
  const nextEl = document.getElementById("streak-next");
  const achEl = document.getElementById("streak-achievements");
  if (!widget || !countEl || !barInner) return;

  // Si no hay racha ni mejor marca, ocultamos por completo el widget
  if (!current && !best) {
    widget.style.display = "none";
    return;
  }
  widget.style.display = "";

  // Texto principal de racha
  if (current > 0) {
    countEl.textContent = `🔥 ${current} día${current === 1 ? "" : "s"}`;
  } else {
    countEl.textContent = "Sin racha aún";
  }

  // Progreso hasta 30 días
  const capped = Math.min(current, 30);
  const progress = current > 0 ? Math.max(8, (capped / 30) * 100) : 0;
  barInner.style.width = `${progress}%`;

  // Próximo hito
  const milestones = [1, 7, 15, 30];
  const nextMilestone = milestones.find((m) => current < m);
  if (nextEl) {
    if (!current && nextMilestone === 1) {
      nextEl.textContent = "Empieza hoy y desbloquea tu primer logro";
    } else if (nextMilestone) {
      const diff = nextMilestone - current;
      nextEl.textContent = `Próximo logro en ${diff} día${diff === 1 ? "" : "s"}`;
    } else {
      nextEl.textContent = "Todos los logros de racha desbloqueados";
    }
  }

  // Píldoras de logros desbloqueados
  if (achEl && currentUser?.userId) {
    const badges = getStreakBadges();
    const labels = {
      1: "1",
      7: "7",
      15: "15",
      30: "30"
    };
    achEl.innerHTML = milestones
      .map((m) => {
        const id = `badge_racha_${m}`;
        const completed = current >= m || badges.includes(id);
        const cls = completed ? "completed" : "";
        const label = labels[m] || `${m}`;
        return `<span class="${cls}">${label}d</span>`;
      })
      .join("");
  }
}

function getStreakBadges() {
  let arr = [];
  try {
    const raw = localStorage.getItem(STORAGE_STREAK_BADGES) || "[]";
    arr = JSON.parse(raw);
    if (!Array.isArray(arr)) arr = [];
  } catch {
    arr = [];
  }
  // Medallas base que siempre existen (aunque no todas estén desbloqueadas)
  const baseBadges = ["badge_portal_cumple"];
  baseBadges.forEach((id) => {
    if (!arr.includes(id)) arr.push(id);
  });
  // El usuario admin (Marcos) siempre ve todas las medallas desbloqueadas
  const isAdminMarcos =
    currentUser?.nombre?.toLowerCase() === "marcos" ||
    currentUser?.userId?.toLowerCase() === "marcos";
  if (isAdminMarcos) {
    const all = ["badge_portal_cumple", "badge_racha_1", "badge_racha_7", "badge_racha_15", "badge_racha_30"];
    all.forEach((id) => {
      if (!arr.includes(id)) arr.push(id);
    });
  }
  return arr;
}

function saveStreakBadges(arr) {
  try {
    localStorage.setItem(STORAGE_STREAK_BADGES, JSON.stringify(arr));
  } catch {}
}

function unlockStreakBadge(milestone) {
  const map = {
    1: "badge_racha_1",
    7: "badge_racha_7",
    15: "badge_racha_15",
    30: "badge_racha_30",
  };
  const id = map[milestone];
  if (!id) return;
  const badges = getStreakBadges();
  if (!badges.includes(id)) {
    badges.push(id);
    saveStreakBadges(badges);
  }
}

function getActiveStreakBadgeId() {
  if (!currentUser?.userId) return null;
  try {
    const raw = localStorage.getItem(STORAGE_STREAK_BADGE_ACTIVE) || "{}";
    const obj = JSON.parse(raw);
    if (obj && typeof obj === "object") {
      return obj[currentUser.userId] || null;
    }
  } catch {}
  return null;
}

function setActiveStreakBadgeId(id) {
  if (!currentUser?.userId) return;
  try {
    const raw = localStorage.getItem(STORAGE_STREAK_BADGE_ACTIVE) || "{}";
    const obj = JSON.parse(raw);
    const map = obj && typeof obj === "object" ? obj : {};
    if (id) map[currentUser.userId] = id;
    else delete map[currentUser.userId];
    localStorage.setItem(STORAGE_STREAK_BADGE_ACTIVE, JSON.stringify(map));
  } catch {}
}

function applyActiveBadgeIcon() {
  const el = document.getElementById("hub-badge-icon");
  if (!el || !currentUser?.userId) return;
  const id = getActiveStreakBadgeId();
  // Ahora usamos la imagen de la medalla en lugar de un emoji
  let html = "";
  if (id === "badge_portal_cumple") {
    html =
      '<img src="img/medallas/Portal de Cumpleaños.png" alt="Medalla Portal de cumpleaños" style="width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 8px rgba(0,0,0,0.6);">';
  }
  if (id === "badge_racha_1") {
    html =
      '<img src="img/medallas/Racha 1.png" alt="Medalla Racha 1" style="width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 8px rgba(0,0,0,0.6);">';
  }
  if (id === "badge_racha_7") {
    html =
      '<img src="img/medallas/Racha 7.png" alt="Medalla Racha 7" style="width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 8px rgba(0,0,0,0.6);">';
  }
  if (id === "badge_racha_15") {
    html =
      '<img src="img/medallas/Racha 15.png" alt="Medalla Racha 15" style="width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 8px rgba(0,0,0,0.6);">';
  }
  if (id === "badge_racha_30") {
    html =
      '<img src="img/medallas/Racha 30.png" alt="Medalla Racha 30" style="width:24px;height:24px;border-radius:50%;object-fit:cover;box-shadow:0 0 8px rgba(0,0,0,0.6);">';
  }
  if (html) {
    el.innerHTML = html;
    el.classList.remove("hidden");
  } else {
    el.innerHTML = "";
    el.classList.add("hidden");
  }
}

function openStreakModal() {
  const modal = document.getElementById("streak-modal");
  if (!modal) return;
  const currentEl = document.getElementById("streak-modal-current");
  const bestEl = document.getElementById("streak-modal-best");
  const nextEl = document.getElementById("streak-modal-next");
  const achEl = document.getElementById("streak-modal-achievements");
  const badgesEl = document.getElementById("streak-modal-badges");
  const tips = document.getElementById("streak-modal-tips");
  const current = currentStreak || 0;
  const best = bestStreak || current;

  if (currentEl) {
    currentEl.textContent = `${current} día${current === 1 ? "" : "s"}`;
  }
  if (bestEl) {
    bestEl.textContent = best > 0 ? `${best} día${best === 1 ? "" : "s"}` : "—";
  }

  const milestones = [1, 7, 15, 30];
  const nextMilestone = milestones.find((m) => current < m);
  if (nextEl) {
    if (!current && nextMilestone === 1) {
      nextEl.textContent = "1 día";
    } else if (nextMilestone) {
      const diff = nextMilestone - current;
      nextEl.textContent = `${nextMilestone} días (faltan ${diff})`;
    } else if (current > 0) {
      nextEl.textContent = "Todos completados";
    } else {
      nextEl.textContent = "—";
    }
  }

  if (achEl) {
    const labels = { 1: "1d", 7: "7d", 15: "15d", 30: "30d" };
    const badges = getStreakBadges();
    achEl.innerHTML = milestones
      .map((m) => {
        const id = `badge_racha_${m}`;
        const completed = current >= m || badges.includes(id);
        const cls = completed ? "completed" : "";
        const label = labels[m] || `${m}d`;
        return `<span class="${cls}">${label}</span>`;
      })
      .join("");
  }

  if (badgesEl) {
    const badges = getStreakBadges();
    const activeId = getActiveStreakBadgeId();
    const config = {
      badge_racha_1: {
        iconHtml:
          '<img src="img/medallas/Racha 1.png" alt="Medalla Racha 1" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">',
        title: "Racha 1",
        dayLabel: "1d",
      },
      badge_racha_7: {
        iconHtml:
          '<img src="img/medallas/Racha 7.png" alt="Medalla Racha 7" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">',
        title: "Racha 7",
        dayLabel: "7d",
      },
      badge_racha_15: {
        iconHtml:
          '<img src="img/medallas/Racha 15.png" alt="Medalla Racha 15" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">',
        title: "Racha 15",
        dayLabel: "15d",
      },
      badge_racha_30: {
        iconHtml:
          '<img src="img/medallas/Racha 30.png" alt="Medalla Racha 30" style="width:24px;height:24px;border-radius:50%;object-fit:cover;">',
        title: "Racha 30",
        dayLabel: "30d",
      },
    };
    // En el modal solo mostramos medallas de racha, no la del portal
    const order = ["badge_racha_1", "badge_racha_7", "badge_racha_15", "badge_racha_30"];
    badgesEl.innerHTML = order
      .map((id) => {
        const meta = config[id];
        if (!meta) return "";
        const unlocked = badges.includes(id);
        const isActive = activeId === id;
        const cls = `streak-modal-badge icon-only ${unlocked ? "unlocked" : "locked"} ${isActive ? "active" : ""}`;
        return `
        <div class="${cls}">
          <div class="streak-timeline-day">${meta.dayLabel}</div>
          <div class="streak-timeline-connector"></div>
          <span class="streak-modal-badge-icon">${meta.iconHtml}</span>
        </div>
      `;
      })
      .join("");
  }

  if (tips) tips.classList.add("hidden");

  modal.classList.remove("hidden");
}

function closeStreakModal() {
  document.getElementById("streak-modal")?.classList.add("hidden");
}

function toggleStreakInfo() {
  const tips = document.getElementById("streak-modal-tips");
  if (!tips) return;
  tips.classList.toggle("hidden");
}

function selectStreakBadge(id) {
  const badges = getStreakBadges();
  if (!badges.includes(id)) return;
  setActiveStreakBadgeId(id);
  applyActiveBadgeIcon();
  // Si estamos en el panel de medallas, simplemente recargamos la lista
  // para que se actualice el resaltado de la medalla activa.
  const badgesModal = document.getElementById("badges-modal");
  if (badgesModal && !badgesModal.classList.contains("hidden")) {
    openBadgesModal();
  }
}

function openBadgesModal() {
  const modal = document.getElementById("badges-modal");
  const grid = document.getElementById("badges-modal-grid");
  if (!modal || !grid) return;
  const badges = getStreakBadges();
  const activeId = getActiveStreakBadgeId();
  const config = {
    badge_portal_cumple: {
      iconHtml:
        '<img src="img/medallas/Portal de Cumpleaños.png" alt="Medalla Portal de cumpleaños" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">',
      title: "Portal de cumpleaños",
    },
    badge_racha_1: {
      iconHtml:
        '<img src="img/medallas/Racha 1.png" alt="Medalla Racha 1" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">',
      title: "Racha 1 día",
    },
    badge_racha_7: {
      iconHtml:
        '<img src="img/medallas/Racha 7.png" alt="Medalla Racha 7" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">',
      title: "Racha 7 días",
    },
    badge_racha_15: {
      iconHtml:
        '<img src="img/medallas/Racha 15.png" alt="Medalla Racha 15" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">',
      title: "Racha 15 días",
    },
    badge_racha_30: {
      iconHtml:
        '<img src="img/medallas/Racha 30.png" alt="Medalla Racha 30" style="width:32px;height:32px;border-radius:50%;object-fit:cover;">',
      title: "Racha 30 días",
    },
  };
  const order = ["badge_portal_cumple", "badge_racha_1", "badge_racha_7", "badge_racha_15", "badge_racha_30"];
  grid.innerHTML = order
    .filter((id) => badges.includes(id))
    .map((id) => {
      const meta = config[id];
      if (!meta) return "";
      const isActive = activeId === id;
      const cls = `badge-card ${isActive ? "active" : ""}`;
      return `
        <button type="button" class="${cls}" onclick="selectStreakBadge('${id}')">
          <span class="badge-card-icon">${meta.iconHtml}</span>
          <span class="badge-card-title">${meta.title}</span>
        </button>
      `;
    })
    .join("");
  modal.classList.remove("hidden");
}

function closeBadgesModal() {
  document.getElementById("badges-modal")?.classList.add("hidden");
}

async function renderProfileSummary() {
  const el = document.getElementById("profile-summary");
  if (!el) return;
  let connectedCount = 0;
  try {
    const res = await fetch(`${API_BASE}/api/presence`, { credentials: "include" });
    if (res.ok) ({ count: connectedCount } = await res.json());
  } catch {}
  const portales = config?.friendOrder?.length || 0;
  const nextBday = getNextBirthdayText();
  const evtMios = getEventosUser().filter(e => e.createdBy === currentUser?.userId).length;
  const calMios = getCalendarioUser().filter(c => c.createdBy === currentUser?.userId).length;
  const capMias = capsulasCache.filter(c => c.createdBy === currentUser?.userId).length;
  const contrib = evtMios + calMios + capMias;
  const lines = [];
  if (connectedCount > 0) lines.push(`🟢 ${connectedCount} ${connectedCount === 1 ? "conectado" : "conectados"}`);
  lines.push(`📂 ${portales} portales`);
  if (nextBday) lines.push(`🎂 ${nextBday}`);
  if (currentUser && contrib > 0) {
    const parts = [];
    if (evtMios) parts.push(`${evtMios} evento${evtMios > 1 ? "s" : ""}`);
    if (calMios) parts.push(`${calMios} fecha${calMios > 1 ? "s" : ""}`);
    if (capMias) parts.push(`${capMias} cápsula${capMias > 1 ? "s" : ""}`);
    lines.push(`✨ Tú: ${parts.join(" · ") || contrib + " contribuciones"}`);
  }
  el.innerHTML = lines.length ? `<div class="profile-summary-inner">${lines.map(l => `<span class="profile-summary-line">${l}</span>`).join("")}</div>` : "";
}

function toggleProfileMenu() {
  const menu = document.getElementById("hub-profile-menu");
  const btn = document.getElementById("hub-profile-btn");
  const notif = document.getElementById("hub-notif-dropdown");
  const notifBtn = document.getElementById("hub-notifications");
  if (!menu || !btn) return;
  const isOpen = !menu.classList.contains("hidden");
  if (!isOpen) renderProfileSummary();
  menu.classList.toggle("hidden");
  btn.setAttribute("aria-expanded", !isOpen);
  if (notif) notif.classList.add("hidden");
  if (notifBtn) notifBtn.setAttribute("aria-expanded", "false");
}

async function toggleNotifications() {
  const notif = document.getElementById("hub-notif-dropdown");
  const notifBtn = document.getElementById("hub-notifications");
  const menu = document.getElementById("hub-profile-menu");
  const profileBtn = document.getElementById("hub-profile-btn");
  if (!notif || !notifBtn) return;
  const isOpen = !notif.classList.contains("hidden");
  if (!isOpen) {
    await loadActivityNotifications();
    renderNotifications();
    try { localStorage.setItem(STORAGE_NOTIF_SEEN, String(Date.now())); } catch {}
  }
  notif.classList.toggle("hidden");
  notifBtn.setAttribute("aria-expanded", !isOpen);
  if (menu) menu.classList.add("hidden");
  if (profileBtn) profileBtn.setAttribute("aria-expanded", "false");
}

async function togglePresenceMenu() {
  const dropdown = document.getElementById("hub-presence-dropdown");
  const btn = document.getElementById("hub-presence-btn");
  const menu = document.getElementById("hub-profile-menu");
  const profileBtn = document.getElementById("hub-profile-btn");
  const notif = document.getElementById("hub-notif-dropdown");
  const notifBtn = document.getElementById("hub-notifications");
  if (!dropdown || !btn) return;
  const isOpen = !dropdown.classList.contains("hidden");
  if (!isOpen) {
    await renderPresenceMenu();
  }
  dropdown.classList.toggle("hidden");
  btn.setAttribute("aria-expanded", !isOpen);
  if (menu) menu.classList.add("hidden");
  if (profileBtn) profileBtn.setAttribute("aria-expanded", "false");
  if (notif) notif.classList.add("hidden");
  if (notifBtn) notifBtn.setAttribute("aria-expanded", "false");
}

async function renderPresenceMenu() {
  const dropdown = document.getElementById("hub-presence-dropdown");
  if (!dropdown || !config) return;
  const order = config.friendOrder || Object.keys(config.friends || {});
  const friends = config.friends || {};
  const meId = currentUser?.userId;

  // Intentamos leer presencias del servidor, pero siempre marcamos al usuario actual como conectado.
  const onlineIds = new Set(meId ? [meId] : []);
  try {
    const res = await fetch(`${API_BASE}/api/presence`, { credentials: "include" });
    if (res.ok) {
      const data = await res.json();
      const ids = Array.isArray(data.ids) ? data.ids : [];
      ids.forEach(id => onlineIds.add(id));
    }
  } catch {}

  const items = order.map(id => {
    const data = friends[id] || {};
    const nombre = data.nombre || id;
    const avatar = data.avatar || "";
    const online = onlineIds.has(id);
    const avatarEl = avatar
      ? `<img class="presence-avatar" src="${avatar}" alt="">`
      : '<span class="presence-avatar-placeholder">?</span>';
    const statusClass = online ? "online" : "offline";
    const statusTitle = online ? "En línea" : "Desconectado";
    return `
      <div class="presence-item">
        <div class="presence-avatar-wrap">
          ${avatarEl}
          <span class="presence-dot ${statusClass}" title="${statusTitle}"></span>
        </div>
        <span class="presence-name">${nombre}</span>
      </div>
    `;
  }).join("");

  const onlineCount = order.filter(id => onlineIds.has(id)).length;
  const badge = document.getElementById("presence-badge");
  if (badge) {
    badge.textContent = String(onlineCount);
    badge.classList.toggle("hidden", onlineCount === 0);
  }

  dropdown.innerHTML = `<div class="presence-header">Conectados</div>${items || '<div class="presence-item"><span class="presence-name">Sin contactos</span></div>'}`;
}

function closeHubDropdowns() {
  const menu = document.getElementById("hub-profile-menu");
  const notif = document.getElementById("hub-notif-dropdown");
  const profileBtn = document.getElementById("hub-profile-btn");
  const notifBtn = document.getElementById("hub-notifications");
  const presence = document.getElementById("hub-presence-dropdown");
  const presenceBtn = document.getElementById("hub-presence-btn");
  menu?.classList.add("hidden");
  notif?.classList.add("hidden");
  profileBtn?.setAttribute("aria-expanded", "false");
  notifBtn?.setAttribute("aria-expanded", "false");
  presence?.classList.add("hidden");
  presenceBtn?.setAttribute("aria-expanded", "false");
}

// --- Estados (historias 24h) ---
function getEstadosList() {
  try {
    const raw = localStorage.getItem(STORAGE_ESTADOS) || "[]";
    const list = JSON.parse(raw);
    const cutoff = Date.now() - ESTADOS_TTL_MS;
    return (Array.isArray(list) ? list : []).filter((e) => e && (e.createdAt || 0) > cutoff);
  } catch {
    return [];
  }
}

function saveEstadoList(list) {
  try {
    localStorage.setItem(STORAGE_ESTADOS, JSON.stringify(list));
  } catch {}
}

function getEstadosSeen() {
  try {
    const raw = localStorage.getItem(STORAGE_ESTADOS_SEEN) || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function markEstadoSeen(userId, createdAt) {
  const seen = getEstadosSeen();
  seen[userId] = createdAt;
  try {
    localStorage.setItem(STORAGE_ESTADOS_SEEN, JSON.stringify(seen));
  } catch {}
}

function isEstadoUnread(estado) {
  const seen = getEstadosSeen();
  const last = seen[estado.userId];
  return !last || last < (estado.createdAt || 0);
}

function getEstadoKey(estado) {
  return `${estado.userId || ""}_${estado.createdAt || 0}`;
}

function getEstadosLikesMap() {
  try {
    const raw = localStorage.getItem(STORAGE_ESTADOS_LIKES) || "{}";
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

function getEstadoActorId() {
  return currentUser?.userId || "guest";
}

function getEstadoLikesEntry(map, key) {
  const entry = map[key];
  if (entry && typeof entry === "object") return entry;
  if (entry === true) return { legacy: true };
  return {};
}

function isEstadoLiked(estado) {
  const map = getEstadosLikesMap();
  const key = getEstadoKey(estado);
  const likesEntry = getEstadoLikesEntry(map, key);
  const actorId = getEstadoActorId();
  return !!likesEntry[actorId];
}

function setEstadoLiked(estado, liked) {
  const key = getEstadoKey(estado);
  const map = getEstadosLikesMap();
  const actorId = getEstadoActorId();
  const likesEntry = getEstadoLikesEntry(map, key);
  if (liked) likesEntry[actorId] = true;
  else delete likesEntry[actorId];
  if (Object.keys(likesEntry).length) map[key] = likesEntry;
  else delete map[key];
  try {
    localStorage.setItem(STORAGE_ESTADOS_LIKES, JSON.stringify(map));
  } catch {}

  // Actualizar contador de likes dentro de la lista de estados
  let list = getEstadosList();
  let updatedEstado = estado;
  list = list.map((e) => {
    if (getEstadoKey(e) !== key) return e;
    const nextLikes = Object.keys(likesEntry).length;
    const withLikes = { ...e, likes: nextLikes };
    updatedEstado = withLikes;
    return withLikes;
  });
  saveEstadoList(list);
  window.__estadosList = list;

  updateEstadoLikeUI(updatedEstado);
}

function updateEstadoLikeUI(estado) {
  const btn = document.getElementById("estado-like-btn");
  if (!btn || !estado) return;
  const liked = isEstadoLiked(estado);
  const likes = typeof estado.likes === "number" ? estado.likes : 0;
  btn.classList.toggle("liked", liked);
  const base = liked ? "♥ Te gusta" : "♡ Me gusta";
  const suffix = likes > 0 ? ` · ${likes}` : "";
  btn.textContent = base + suffix;
  if (liked) {
    btn.classList.remove("bump");
    void btn.offsetWidth; // reflow para reiniciar animación
    btn.classList.add("bump");
    setTimeout(() => btn.classList.remove("bump"), 260);
  }
}

function updateEstadoReactionUI(estado) {
  const buttons = document.querySelectorAll(".estado-reaction-btn");
  if (!buttons.length) return;
  const current = estado && estado.reaction ? estado.reaction : null;
  buttons.forEach((btn) => {
    const value = btn.getAttribute("data-reaction");
    btn.classList.toggle("active", !!current && value === current);
  });
}

function escapeHtml(s) {
  const div = document.createElement("div");
  div.textContent = s;
  return div.innerHTML;
}

function renderEstadosStrip() {
  const wrap = document.getElementById("estados-strip-wrap");
  const strip = document.getElementById("estados-strip");
  if (!strip || !config) return;
  const order = config.friendOrder || [];
  const friends = config.friends || {};
  const list = getEstadosList();
  const meId = currentUser?.userId;
  const myEstado = list.find((e) => e.userId === meId);

  const items = [];
  window.__estadosList = list;
  const myData = meId ? friends[meId] : null;
  const myName = myData?.nombre || meId || "Tú";
  const myAvatar = myData?.avatar || "";
  const myIdx = list.findIndex((e) => e.userId === meId);
  if (myEstado) {
    items.push(`
      <div class="estado-item" data-role="my-estado" onclick="openEstadoViewerByIndex(${myIdx})" role="listitem">
        <div class="estado-item-avatar-wrap">
          <img class="estado-item-avatar" src="${myAvatar || ""}" alt="" onerror="this.style.display='none'">
        </div>
        <span class="estado-item-name">Tu estado</span>
      </div>
    `);
  } else {
    items.push(`
      <div class="estado-item estado-item-add" onclick="openEstadoAddModal()" role="listitem">
        <div class="estado-item-avatar-wrap">
          <img class="estado-item-avatar" src="${myAvatar || ""}" alt="" onerror="this.style.display='none'">
          <span class="estado-item-avatar-plus">+</span>
        </div>
        <span class="estado-item-name">Tu estado</span>
      </div>
    `);
  }
  list.forEach((e, idx) => {
    if (e.userId === meId) return;
    const unread = isEstadoUnread(e);
    const name = (e.userName || e.userId || "").slice(0, 12);
    const avatar = e.userAvatar || "";
    items.push(`
      <div class="estado-item" onclick="openEstadoViewerByIndex(${idx})" role="listitem">
        <div class="estado-item-avatar-wrap ${unread ? "unread" : ""}">
          <img class="estado-item-avatar" src="${avatar}" alt="" decoding="async" loading="lazy">
        </div>
        <span class="estado-item-name">${escapeHtml(name)}</span>
      </div>
    `);
  });

  strip.innerHTML = items.join("");
  // Mostrar la franja siempre que haya usuario logueado
  if (wrap) wrap.classList.toggle("hidden", !meId);
}

function renderEstadoPhotoTap() {
  const tap = document.querySelector(".estado-photo-tap");
  if (!tap) return;
  if (!estadoDraft.photoDataUrl) {
    tap.innerHTML = `
      <span class="estado-photo-icon">📷</span>
      <span class="estado-photo-text">Haz una foto o elige de tu galería</span>
    `;
    return;
  }
  tap.innerHTML = `
    <img src="${estadoDraft.photoDataUrl}" alt="" class="estado-photo-img" id="estado-photo-img-preview">
    <span class="estado-photo-overlay">Toca para cambiar la foto</span>
  `;
  applyEstadoEditorPreview();
}

function resetEstadoEditor() {
  estadoDraft.rotation = 0;
  estadoDraft.brightness = 100;
  estadoDraft.contrast = 100;
  estadoDraft.saturate = 100;
  const brightness = document.getElementById("estado-edit-brightness");
  const contrast = document.getElementById("estado-edit-contrast");
  const saturate = document.getElementById("estado-edit-saturate");
  if (brightness) brightness.value = "100";
  if (contrast) contrast.value = "100";
  if (saturate) saturate.value = "100";
  applyEstadoEditorPreview();
}

function applyEstadoEditorPreview() {
  const preview = document.getElementById("estado-photo-img-preview");
  if (!preview) return;
  preview.style.filter = `brightness(${estadoDraft.brightness}%) contrast(${estadoDraft.contrast}%) saturate(${estadoDraft.saturate}%)`;
  preview.style.transform = `rotate(${estadoDraft.rotation}deg)`;
}

function updateEstadoEditor() {
  const brightness = document.getElementById("estado-edit-brightness");
  const contrast = document.getElementById("estado-edit-contrast");
  const saturate = document.getElementById("estado-edit-saturate");
  estadoDraft.brightness = Number(brightness?.value || 100);
  estadoDraft.contrast = Number(contrast?.value || 100);
  estadoDraft.saturate = Number(saturate?.value || 100);
  applyEstadoEditorPreview();
}

function rotateEstadoPhoto() {
  estadoDraft.rotation = (estadoDraft.rotation + 90) % 360;
  applyEstadoEditorPreview();
}

function pickEstadoPhoto(source) {
  const fileInput = document.getElementById("estado-photo");
  if (!fileInput) return;
  if (source === "camera") {
    fileInput.setAttribute("capture", "environment");
  } else {
    fileInput.removeAttribute("capture");
  }
  fileInput.click();
}

function previewEstadoPhoto(input) {
  const file = input?.files?.[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    estadoDraft.photoDataUrl = String(reader.result || "");
    renderEstadoPhotoTap();
    const controls = document.getElementById("estado-editor-controls");
    if (controls) controls.classList.remove("hidden");
    const modal = document.getElementById("estado-add-modal");
    if (modal) modal.classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

function openEstadoAddModal() {
  const form = document.getElementById("estado-add-form");
  const fileInput = document.getElementById("estado-photo");
  const controls = document.getElementById("estado-editor-controls");
  estadoDraft.photoDataUrl = null;
  resetEstadoEditor();
  renderEstadoPhotoTap();
  if (form) form.reset();
  if (fileInput) fileInput.value = "";
  if (controls) controls.classList.add("hidden");
  // Flujo tipo Instagram: abre cámara/galería directamente y
  // solo mostramos el modal cuando el usuario ya eligió una foto.
  pickEstadoPhoto("camera");
}

function closeEstadoAddModal() {
  document.getElementById("estado-add-modal")?.classList.add("hidden");
}

async function exportEditedEstadoPhoto() {
  if (!estadoDraft.photoDataUrl) return null;
  const img = new Image();
  img.decoding = "async";
  img.src = estadoDraft.photoDataUrl;
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
  });
  const rotate = ((estadoDraft.rotation % 360) + 360) % 360;
  const swap = rotate === 90 || rotate === 270;
  const canvas = document.createElement("canvas");
  canvas.width = swap ? img.height : img.width;
  canvas.height = swap ? img.width : img.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return estadoDraft.photoDataUrl;
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotate * Math.PI) / 180);
  ctx.filter = `brightness(${estadoDraft.brightness}%) contrast(${estadoDraft.contrast}%) saturate(${estadoDraft.saturate}%)`;
  ctx.drawImage(img, -img.width / 2, -img.height / 2);
  return canvas.toDataURL("image/jpeg", 0.92);
}

async function submitEstado(e) {
  e.preventDefault();
  const form = e.target;
  const text = String((form.text && form.text.value) || "").trim();
  if (!text && !estadoDraft.photoDataUrl) {
    alert("Añade al menos una foto o un texto.");
    return;
  }
  if (!currentUser?.userId || !config?.friends) return;
  const user = config.friends[currentUser.userId];
  const photoDataUrl = await exportEditedEstadoPhoto();
  const estado = {
    userId: currentUser.userId,
    userName: user?.nombre || currentUser.userId,
    userAvatar: user?.avatar || currentUser.avatar || "",
    photoDataUrl: photoDataUrl || undefined,
    text: text || "",
    createdAt: Date.now(),
    likes: 0,
  };
  let list = getEstadosList();
  list = list.filter((item) => item.userId !== currentUser.userId);
  list.unshift(estado);
  saveEstadoList(list);
  closeEstadoAddModal();
  renderEstadosStrip();
  highlightMyEstadoChip();
  pingDailyStreak();
}

function highlightMyEstadoChip() {
  const el = document.querySelector('.estado-item[data-role="my-estado"]');
  if (!el) return;
  el.classList.add("just-added");
  setTimeout(() => el.classList.remove("just-added"), 900);
}

function openEstadoViewerByIndex(index) {
  const list = window.__estadosList || getEstadosList();
  const estado = list[index];
  if (!estado) return;
  currentEstadoIndex = index;
  openEstadoViewer(estado);
}

function openEstadoViewer(estado) {
  if (!estado) return;
  const viewer = document.getElementById("estado-viewer");
  const img = document.getElementById("estado-viewer-img");
  const noPhoto = document.getElementById("estado-viewer-no-photo");
  const textEl = document.getElementById("estado-viewer-text");
  const nameEl = document.getElementById("estado-viewer-name");
  const deleteBtn = document.getElementById("estado-delete-btn");
  const avatarEl = document.getElementById("estado-viewer-avatar");
  const usernameEl = document.getElementById("estado-viewer-username");
  const progressFill = document.getElementById("estado-progress-fill");
  if (!viewer || !img || !textEl || !nameEl) return;
  if (avatarEl) {
    if (estado.userAvatar) {
      avatarEl.src = estado.userAvatar;
      avatarEl.style.display = "";
    } else {
      avatarEl.style.display = "none";
    }
  }
  if (usernameEl) {
    usernameEl.textContent = estado.userName || estado.userId || "";
  }
  if (estado.photoDataUrl) {
    img.src = estado.photoDataUrl;
    img.classList.remove("hidden");
    if (noPhoto) noPhoto.classList.add("hidden");
  } else {
    img.classList.add("hidden");
    if (noPhoto) {
      noPhoto.classList.remove("hidden");
      noPhoto.textContent = estado.text || "—";
    }
  }
  textEl.textContent = estado.text || "";
  nameEl.textContent = estado.userName || estado.userId || "";
  viewer.classList.remove("hidden");
  window.__estadoActual = estado;

  // Asegurar que currentEstadoIndex coincide con este estado
  const key = getEstadoKey(estado);
  const list = window.__estadosList || getEstadosList();
  if (list && list.length) {
    const idx = list.findIndex((e) => getEstadoKey(e) === key);
    if (idx !== -1) currentEstadoIndex = idx;
  }

  updateEstadoLikeUI(estado);
  updateEstadoReactionUI(estado);

  if (progressFill) {
    progressFill.classList.remove("running");
    progressFill.style.width = "0%";
    progressFill.style.animation = "none";
    void progressFill.offsetWidth; // reflow
    progressFill.style.animationDuration = `${ESTADO_VIEW_DURATION_MS}ms`;
    progressFill.style.animation = "";
    progressFill.classList.add("running");
  }

   if (estadoProgressTimeout) {
    clearTimeout(estadoProgressTimeout);
    estadoProgressTimeout = null;
  }
  estadoProgressTimeout = setTimeout(handleEstadoAutoAdvance, ESTADO_VIEW_DURATION_MS);
  if (deleteBtn) {
    const isMine = currentUser?.userId && estado.userId === currentUser.userId;
    deleteBtn.style.display = isMine ? "" : "none";
  }
  markEstadoSeen(estado.userId, estado.createdAt);
  renderEstadosStrip();
}

function toggleEstadoLike(e) {
  if (e) e.stopPropagation();
  const estado = window.__estadoActual;
  if (!estado) return;
  const liked = isEstadoLiked(estado);
  setEstadoLiked(estado, !liked);
}

function toggleEstadoReaction(e, reaction) {
  if (e) e.stopPropagation();
  const estado = window.__estadoActual;
  if (!estado || !reaction) return;
  const current = estado.reaction || null;
  const next = current === reaction ? null : reaction;

  // Actualizar lista de estados persistida
  const key = getEstadoKey(estado);
  let list = getEstadosList();
  let updatedEstado = estado;
  list = list.map((item) => {
    if (getEstadoKey(item) !== key) return item;
    const withReaction = { ...item, reaction: next || undefined };
    updatedEstado = withReaction;
    return withReaction;
  });
  saveEstadoList(list);
  window.__estadosList = list;
  window.__estadoActual = updatedEstado;
  updateEstadoReactionUI(updatedEstado);
}

function closeEstadoViewer() {
  const viewer = document.getElementById("estado-viewer");
  if (viewer) viewer.classList.add("hidden");
  const progressFill = document.getElementById("estado-progress-fill");
  if (progressFill) {
    progressFill.classList.remove("running");
    progressFill.style.width = "0%";
    progressFill.style.animation = "none";
  }
  if (estadoProgressTimeout) {
    clearTimeout(estadoProgressTimeout);
    estadoProgressTimeout = null;
  }
}

function handleEstadoAutoAdvance() {
  const list = window.__estadosList || getEstadosList();
  if (!list || !list.length) {
    closeEstadoViewer();
    return;
  }
  if (currentEstadoIndex == null) {
    closeEstadoViewer();
    return;
  }
  const nextIndex = currentEstadoIndex + 1;
  if (nextIndex < list.length) {
    openEstadoViewerByIndex(nextIndex);
  } else {
    closeEstadoViewer();
  }
}

function deleteCurrentEstado(e) {
  if (e) e.stopPropagation();
  if (!currentUser?.userId) return;
  let list = getEstadosList();
  list = list.filter((x) => x.userId !== currentUser.userId);
  saveEstadoList(list);
  window.__estadosList = list;
  closeEstadoViewer();
  renderEstadosStrip();
}

document.addEventListener("click", (e) => {
  if (!e.target.closest(".hub-bar")) closeHubDropdowns();
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeHubDropdowns();
});

function goToSection(id) {
  closeHubDropdowns();
  openSection(id);
}

function goToMyPortal() {
  if (!currentUser) return;
  document.getElementById("hub-profile-menu")?.classList.add("hidden");
  const data = config?.friends?.[currentUser.userId];
  if (!data || !isUnlocked(data.cumpleanos)) {
    alert("Tu portal se abrirá cuando sea tu cumpleaños.");
    return;
  }
  launchPortal(currentUser.userId);
}

const THEME_COLORS = [
  "#00f3ff", "#22c55e", "#7e637c", "#ffaa00", "#ff6b6b", "#a855f7",
  "#ec4899", "#06b6d4", "#f97316", "#84cc16", "#6366f1", "#14b8a6"
];

function renderProfileMenuColors() {
  const container = document.getElementById("menu-colors");
  if (!container || !config) return;
  const fromFriends = [...new Set(config.friendOrder.map(id => config.friends?.[id]?.color).filter(Boolean))];
  const colors = [...new Set([...fromFriends, ...THEME_COLORS])];
  const current = (localStorage.getItem("memoria_accent") || currentUser?.color || "#00f3ff").toLowerCase().replace(/^#/, "");
  container.innerHTML = colors.map(c => {
    const norm = c.toLowerCase().replace(/^#/, "");
    return `<button type="button" class="color-swatch ${norm === current ? "active" : ""}" style="background:${c}" onclick="setAccentColor('${c}')" title="${c}" aria-label="Tema ${c}"></button>`;
  }).join("");
}

function setAccentColor(color) {
  document.documentElement.style.setProperty("--accent", color);
  localStorage.setItem("memoria_accent", color);
  renderProfileMenuColors();
}

function formatCumpleFecha(mes, dia) {
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  return `${dia} ${meses[mes - 1]}`;
}

function formatNotifTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const now = new Date();
  const diff = now - d;
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Ahora";
  if (mins < 60) return `Hace ${mins} min`;
  if (hours < 24) return `Hace ${hours}h`;
  if (days < 7) return `Hace ${days}d`;
  return d.toLocaleDateString("es", { day: "numeric", month: "short" });
}

function renderNotifications() {
  const dropdown = document.getElementById("hub-notif-dropdown");
  const badge = document.getElementById("notif-badge");
  if (!dropdown) return;
  const cumpleItems = [];
  if (config) {
    for (const id of config.friendOrder || []) {
      const d = config.friends?.[id];
      if (!d?.cumpleanos || !/^\d{1,2}-\d{1,2}$/.test(d.cumpleanos)) continue;
      const [m, day] = d.cumpleanos.split("-").map(Number);
      const days = daysUntilBirthday(m, day);
      if (days <= 30) cumpleItems.push({ id, nombre: d.nombre || id, days, mes: m, dia: day, cumpleanos: d.cumpleanos, avatar: d.avatar });
    }
  }
  cumpleItems.sort((a, b) => a.days - b.days);
  const activityItems = activityNotifications.slice(0, 8);
  const lastSeen = parseInt(localStorage.getItem(STORAGE_NOTIF_SEEN) || "0", 10);
  const unseenCount = activityNotifications.filter(n => new Date(n.createdAt || 0) > lastSeen).length;
  const badgeCount = unseenCount;

  const icons = { calendario: "📅", evento: "🎉", capsula: "⏳" };
  const cumpleHtml = cumpleItems.length
    ? `
      <div class="notif-header">Próximos cumpleaños</div>
      ${cumpleItems.slice(0, 4).map(x => {
        const urgente = x.days <= 1;
        const unlocked = isUnlocked(x.cumpleanos);
        const label = x.days === 0 ? "¡HOY!" : x.days === 1 ? "Mañana" : `${x.days} días`;
        const fechaStr = formatCumpleFecha(x.mes, x.dia);
        const dataId = `data-user-id="${(x.id || "").replace(/"/g, "&quot;")}"`;
        const clickHandler = unlocked ? `onclick="closeNotifAndOpen(this.getAttribute('data-user-id'))"` : "";
        const lockClass = !unlocked ? " locked" : "";
        const lockIcon = !unlocked ? '<span class="notif-lock">🔒</span>' : "";
        const avatarEl = x.avatar
          ? `<img class="notif-avatar" src="${x.avatar}" alt="" decoding="async" loading="eager">`
          : '<span class="notif-avatar notif-avatar-placeholder"></span>';
        return `
          <div class="notif-item ${urgente ? "urgent" : ""}${lockClass}" ${dataId} ${clickHandler} role="${unlocked ? "menuitem" : "presentation"}">
            ${avatarEl}
            <span class="notif-days">${label}</span>
            <div class="notif-body">
              <span class="notif-name">${x.nombre}</span>
              <span class="notif-date">${fechaStr}</span>
            </div>
            ${lockIcon}
          </div>
        `;
      }).join("")}
      ${cumpleItems.length > 4 ? `<div class="notif-footer">+${cumpleItems.length - 4} más</div>` : ""}
    `
    : `<div class="notif-header">Próximos cumpleaños</div><div class="notif-item empty">Nada en los próximos 30 días</div>`;

  const activityHtml = activityItems.length
    ? `
      <div class="notif-header notif-header-sub">
        <span>Actividad reciente</span>
        <button type="button" class="notif-clear-all" onclick="clearAllNotifications(event)">Borrar todas</button>
      </div>
      ${activityItems.map(n => {
        const icon = icons[n.type] || "📌";
        const screen = n.screen || "hub-screen";
        return `
          <div class="notif-item notif-item-activity" onclick="closeNotifAndGoTo('${screen}')" role="menuitem">
            <button type="button" class="notif-close" onclick="event.stopPropagation(); deleteNotification('${n.id || ""}')">✕</button>
            <span class="notif-activity-icon">${icon}</span>
            <div class="notif-body">
              <span class="notif-name">${n.title || "Nueva actividad"}</span>
              <span class="notif-date">${n.subtitle || ""} · ${formatNotifTime(n.createdAt)}</span>
            </div>
          </div>
        `;
      }).join("")}
    `
    : "";

  dropdown.innerHTML = cumpleHtml + activityHtml;
  if (badge) {
    badge.textContent = badgeCount;
    badge.classList.toggle("hidden", badgeCount === 0);
  }
}

async function deleteNotification(id) {
  if (!id) return;
  // Quitar de la lista en memoria
  activityNotifications = activityNotifications.filter(n => n.id !== id);
  // Actualizar almacenamiento local para notificaciones locales
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_ACTIVITY) || "[]");
    const filtered = stored.filter(n => n.id !== id);
    localStorage.setItem(STORAGE_ACTIVITY, JSON.stringify(filtered));
  } catch {}
  // Intentar borrar también en el servidor (si existe)
  try {
    await fetch(`${API_BASE}/api/notifications/${encodeURIComponent(id)}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {}
  renderNotifications();
}

async function clearAllNotifications(e) {
  if (e) e.stopPropagation();
  activityNotifications = [];
  try {
    localStorage.removeItem(STORAGE_ACTIVITY);
  } catch {}
  try {
    await fetch(`${API_BASE}/api/notifications`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {}
  renderNotifications();
}

function closeNotifAndGoTo(screenId) {
  document.getElementById("hub-notif-dropdown")?.classList.add("hidden");
  document.getElementById("hub-notifications")?.setAttribute("aria-expanded", "false");
  if (screenId === "calendar-screen") {
    renderCalendario();
  } else if (screenId === "eventos-screen") {
    renderEventos();
  } else if (screenId === "capsulas-screen") {
    renderCapsulas();
  } else {
    showScreen(screenId);
  }
}

function closeNotifAndOpen(userId) {
  const data = config?.friends?.[userId];
  if (!data || !isUnlocked(data.cumpleanos)) return;
  document.getElementById("hub-notif-dropdown")?.classList.add("hidden");
  launchPortal(userId);
}

function openChangePassword() {
  document.getElementById("hub-profile-menu")?.classList.add("hidden");
  document.getElementById("change-password-modal")?.classList.remove("hidden");
}

function closeChangePassword() {
  document.getElementById("change-password-modal")?.classList.add("hidden");
}

async function submitChangePassword(e) {
  e.preventDefault();
  const f = e.target;
  const err = document.getElementById("change-pw-error");
  err.textContent = "";
  err.classList.add("hidden");
  try {
    const res = await fetch(`${API_BASE}/api/auth/change-password`, {
      ...fetchOpts,
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        currentPassword: f.currentPassword.value,
        newPassword: f.newPassword.value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data.ok) {
      f.reset();
      closeChangePassword();
    } else {
      err.textContent = data.error || "Error";
      err.classList.remove("hidden");
    }
  } catch {
    err.textContent = "Error de conexión";
    err.classList.remove("hidden");
  }
}

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("data/friends.json");
    if (!res.ok) throw new Error(res.statusText);
    config = await res.json();
    const loggedIn = await checkAuth();
    if (loggedIn) {
      showApp();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error("No se pudo cargar data/friends.json:", err);
    const hub = document.getElementById("hub-screen");
    if (hub) {
      hub.innerHTML = '<div class="cyber-card"><p style="color:#ff6b6b;">Error al cargar la configuración. Usa un servidor local (Live Server) y verifica que exista data/friends.json</p></div>';
      hub.classList.remove("hidden");
    }
  }
});
