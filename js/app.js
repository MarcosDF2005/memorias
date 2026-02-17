// Config cargada desde JSON (se rellena al iniciar)
let config = null;
let currentFriendId = null;
let currentUser = null; // { userId, nombre, avatar }

const API_BASE = "";
const STORAGE_CALENDARIO = "memoria_calendario";
const STORAGE_EVENTOS = "memoria_eventos";

let calendarioCache = [];
let eventosCache = [];

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
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const saved = await res.json();
      calendarioCache = [...calendarioCache, saved];
      return saved;
    }
  } catch {}
  if (!item.id) item.id = "cal_" + Date.now();
  calendarioCache = [...calendarioCache, item];
  localStorage.setItem(STORAGE_CALENDARIO, JSON.stringify(calendarioCache));
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
      body: JSON.stringify(item),
    });
    if (res.ok) {
      const saved = await res.json();
      eventosCache = [...eventosCache, saved];
      return saved;
    }
  } catch {}
  if (!item.id) item.id = "evt_" + Date.now();
  eventosCache = [...eventosCache, item];
  localStorage.setItem(STORAGE_EVENTOS, JSON.stringify(eventosCache));
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

/** Comprueba si el portal está abierto: hoy es su cumple o ya pasó este año */
function isUnlocked(cumpleanos) {
  if (!cumpleanos || !/^\d{1,2}-\d{1,2}$/.test(cumpleanos)) return false;
  const hoy = new Date();
  const [cumpleMes, cumpleDia] = cumpleanos.split("-").map(Number);
  const hoyNum = (hoy.getMonth() + 1) * 100 + hoy.getDate();
  const cumpleNum = cumpleMes * 100 + cumpleDia;
  return hoyNum >= cumpleNum;
}

/** Devuelve la lista de amigos visibles: los que ya cumplieron (unlocked) + el siguiente por fecha (locked) */
function getVisiblePortalUsers() {
  if (!config) return [];
  const hoy = new Date();
  const hoyNum = (hoy.getMonth() + 1) * 100 + hoy.getDate();

  const withCumple = config.friendOrder
    .map(userId => ({ userId, data: config.friends[userId] }))
    .filter(({ data }) => data && data.cumpleanos && /^\d{1,2}-\d{1,2}$/.test(data.cumpleanos));

  const passed = [];
  const future = [];
  for (const { userId, data } of withCumple) {
    const [mes, dia] = data.cumpleanos.split("-").map(Number);
    const cumpleNum = mes * 100 + dia;
    if (cumpleNum <= hoyNum) {
      passed.push({ userId, data, cumpleNum });
    } else {
      future.push({ userId, data, cumpleNum });
    }
  }
  passed.sort((a, b) => a.cumpleNum - b.cumpleNum);
  future.sort((a, b) => a.cumpleNum - b.cumpleNum);

  const nextLocked = future[0];
  const visible = passed.map(p => ({ userId: p.userId, data: p.data, unlocked: true, cumpleNum: p.cumpleNum }));
  if (nextLocked && !visible.find(v => v.userId === nextLocked.userId)) {
    visible.push({ userId: nextLocked.userId, data: nextLocked.data, unlocked: false, cumpleNum: nextLocked.cumpleNum });
  }
  visible.sort((a, b) => a.cumpleNum - b.cumpleNum);
  return visible;
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
  document.documentElement.style.setProperty("--accent", "#00f3ff");
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
      <span class="hub-icon">${s.icon}</span>
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
        <p class="empty-hint">Añade el primero usando el formulario de arriba.</p>
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

async function addEvento(e) {
  e.preventDefault();
  const f = e.target;
  const item = {
    fecha: f.fecha.value,
    titulo: f.titulo.value.trim(),
    descripcion: f.descripcion.value.trim() || undefined,
    lugar: f.lugar.value.trim() || undefined
  };
  
  if (!item.titulo || !item.fecha) {
    return;
  }
  
  await addEventoItem(item);
  f.reset();
  
  // Feedback visual
  const btn = f.querySelector('.btn-add-full');
  const originalText = btn.innerHTML;
  btn.innerHTML = '✓ AÑADIDO';
  btn.style.background = 'rgba(0, 243, 255, 0.15)';
  setTimeout(() => {
    btn.innerHTML = originalText;
    btn.style.background = '';
  }, 1500);
  
  renderEventos();
}

async function deleteEvento(id) {
  await deleteEventoApi(id);
  renderEventos();
}

function renderCapsulas() {
  const list = document.getElementById("capsulas-list");
  if (!list || !config) return;

  const capsulas = config.capsulasTiempo || [];

  list.innerHTML = capsulas.map(cap => {
    const unlocked = isDateUnlocked(cap.fechaApertura);
    return `
      <div class="content-item capsula-item ${unlocked ? "unlocked" : "locked"}">
        <span class="capsula-status">${unlocked ? "🔓 ABIERTA" : "🔒 BLOQUEADA"}</span>
        <div class="item-body">
          <h4>${cap.titulo}</h4>
          <span class="item-fecha">Se abre: ${formatFecha(cap.fechaApertura)}</span>
          ${unlocked ? `
            <div class="capsula-mensajes">
              ${(cap.mensajes || []).map(m => `
                <div class="capsula-msg">
                  <strong>${m.de}:</strong> ${m.msj}
                </div>
              `).join("")}
            </div>
          ` : ""}
        </div>
      </div>
    `;
  }).join("") || "<p class='empty-msg'>No hay cápsulas del tiempo.</p>";
  showScreen("capsulas-screen");
}

// --- Selector de amigos ---
function renderSelector() {
  const container = document.getElementById("selector-container");
  if (!container || !config) return;

  const visible = getVisiblePortalUsers();
  container.innerHTML = visible.map(({ userId, data, unlocked }) => `
    <div class="profile-card${unlocked ? "" : " locked"}" ${unlocked ? `onclick="launchPortal('${userId}')"` : ""}>
      <div class="img-wrapper">
        <img src="${data.avatar || ''}" alt="${data.nombre || userId}">
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
            ${m.fotos.map(f => `<img src="${f}" alt="">`).join("")}
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
      currentUser = { userId: data.userId, nombre: data.nombre, avatar: data.avatar };
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
      currentUser = { userId: data.userId, nombre: data.nombre, avatar: data.avatar };
      form.reset();
      showApp();
    } else {
      errEl.textContent = data.error || "Error al iniciar sesión";
      errEl.classList.remove("hidden");
    }
  } catch (err) {
    errEl.textContent = "No hay conexión con el servidor. ¿Está ejecutándose?";
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
  populateLoginUsers();
  showScreen("login-screen");
}

function continueAsGuest() {
  currentUser = null;
  showApp();
}

function populateLoginUsers() {
  const sel = document.getElementById("login-username");
  if (!sel || !config) return;
  const users = config.friendOrder || Object.keys(config.friends || {});
  sel.innerHTML = '<option value="">Selecciona quién eres</option>' +
    users.map(id => {
      const d = config.friends?.[id];
      const name = d?.nombre || id;
      return `<option value="${id}">${name}</option>`;
    }).join("");
}

function showApp() {
  renderHub();
  renderSelector();
  updateHubUser();
  showScreen("hub-screen");
}

function updateHubUser() {
  const wrap = document.getElementById("hub-user");
  const img = document.getElementById("hub-avatar");
  const name = document.getElementById("hub-name");
  if (!wrap || !img || !name) return;
  if (currentUser) {
    wrap.classList.remove("hidden");
    img.src = currentUser.avatar || "";
    img.alt = currentUser.nombre;
    name.textContent = currentUser.nombre;
  } else {
    wrap.classList.add("hidden");
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
