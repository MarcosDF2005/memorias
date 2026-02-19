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

let calendarioCache = [];
let eventosCache = [];
let capsulasCache = [];
let activityNotifications = [];

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
    <div class="hub-card-item" onclick="openSection('${s.id}')">
      <span class="hub-icon-wrap"><span class="hub-icon">${s.icon}</span></span>
      <h3>${s.titulo}</h3>
      <p>${s.subtitulo}</p>
    </div>
  `).join("");
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

function getCalendarEntries() {
  const base = (config?.calendario || []).map((x) => ({ ...x, id: null }));
  const user = getCalendarioUser();
  return [...base, ...user];
}

function getEntriesForDay(month, day) {
  return getCalendarEntries().filter((e) => {
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
  renderCalendarioGrid();
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
  renderCalendarioGrid();
}

async function deleteCalendario(id, day, month) {
  await deleteCalendarioApi(id);
  if (day != null && month != null) {
    refreshDayModal(day, month);
  }
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
      <div class="event-card ${isUser ? "user-added" : ""}">
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
  
  await addEventoItem(item);
  f.reset();
  const btn = f.querySelector(".btn-add-evento");
  if (btn) {
    const originalText = btn.innerHTML;
    btn.innerHTML = "✓ Añadido";
    btn.style.background = "rgba(0, 243, 255, 0.2)";
    setTimeout(() => { btn.innerHTML = originalText; btn.style.background = ""; }, 1500);
  }
  closeEventoCreateModal();
  renderEventos();
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
        ${clickable ? `onclick="openCapsulaDetail('${cap.id}')"` : ""}>
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
  await addCapsulaItem(item);
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
  renderCapsulas();
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

function pingPresence() {
  try {
    fetch(`${API_BASE}/api/presence`, { method: "POST", credentials: "include" });
  } catch {}
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

function closeHubDropdowns() {
  const menu = document.getElementById("hub-profile-menu");
  const notif = document.getElementById("hub-notif-dropdown");
  const profileBtn = document.getElementById("hub-profile-btn");
  const notifBtn = document.getElementById("hub-notifications");
  menu?.classList.add("hidden");
  notif?.classList.add("hidden");
  profileBtn?.setAttribute("aria-expanded", "false");
  notifBtn?.setAttribute("aria-expanded", "false");
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
      <div class="notif-header notif-header-sub">Actividad reciente</div>
      ${activityItems.map(n => {
        const icon = icons[n.type] || "📌";
        const screen = n.screen || "hub-screen";
        return `
          <div class="notif-item notif-item-activity" onclick="closeNotifAndGoTo('${screen}')" role="menuitem">
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
