// Config cargada desde JSON (se rellena al iniciar)
let config = null;
let currentFriendId = null;

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
  const hoy = new Date();
  const [cumpleMes, cumpleDia] = cumpleanos.split("-").map(Number);
  const hoyNum = (hoy.getMonth() + 1) * 100 + hoy.getDate();
  const cumpleNum = cumpleMes * 100 + cumpleDia;
  return hoyNum >= cumpleNum;
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
    { id: "moments", icon: "⚡", titulo: "MOMENTS", subtitulo: "Hitos compartidos", screen: "moments-screen" },
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
  const fns = { portales: renderPortales, calendario: renderCalendario, eventos: renderEventos, moments: renderMoments, capsulas: renderCapsulas };
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

  list.innerHTML = items.map((item) => {
    const isUser = !!item.id;
    return `
    <div class="content-item event-item ${isUser ? "user-added" : ""}">
      <span class="item-fecha">${formatFechaCompleta(item.fecha)}</span>
      <div class="item-body">
        <h4>${item.titulo}</h4>
        <p>${item.descripcion || ""}</p>
        ${item.lugar ? `<span class="item-lugar">📍 ${item.lugar}</span>` : ""}
        ${isUser ? `<button type="button" class="btn-delete" onclick="deleteEvento('${item.id}')" title="Eliminar">×</button>` : ""}
      </div>
    </div>
  `}).join("") || "<p class='empty-msg'>No hay eventos. Añade el primero arriba.</p>";
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
  await addEventoItem(item);
  f.reset();
  renderEventos();
}

async function deleteEvento(id) {
  await deleteEventoApi(id);
  renderEventos();
}

function renderMoments() {
  const list = document.getElementById("moments-list");
  if (!list || !config) return;

  const items = config.moments || [];

  list.innerHTML = items.map((item, i) => `
    <div class="content-item moment-item">
      <span class="moment-num">${String(i + 1).padStart(2, "0")}</span>
      <div class="item-body">
        <h4>${item.titulo}</h4>
        <p>${item.descripcion || ""}</p>
        ${item.fecha ? `<span class="item-fecha">${item.fecha}</span>` : ""}
      </div>
    </div>
  `).join("") || "<p class='empty-msg'>No hay moments aún.</p>";
  showScreen("moments-screen");
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

  container.innerHTML = config.friendOrder.map(userId => {
    const data = config.friends[userId];
    if (!data) return "";

    const unlocked = isUnlocked(data.cumpleanos);
    return `
      <div class="profile-card${unlocked ? "" : " locked"}" ${unlocked ? `onclick="launchPortal('${userId}')"` : ""}>
        <div class="img-wrapper">
          <img src="${data.avatar}" alt="${data.nombre}">
          ${!unlocked ? '<div class="lock-overlay">🔒</div>' : ""}
        </div>
        <p class="name">${userId.toUpperCase()}</p>
        ${!unlocked ? '<span class="badge">ACCESO DENEGADO</span>' : ""}
        ${unlocked && (data.memorias || []).length > 0 ? '<span class="archivo-badge">📁</span>' : ""}
      </div>
    `;
  }).join("");
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
  output.innerHTML = "";
  let i = 0;

  const interval = setInterval(() => {
    if (i < config.terminalStrings.length) {
      const p = document.createElement("p");
      p.textContent = config.terminalStrings[i];
      p.style.marginBottom = "5px";
      output.appendChild(p);
      fill.style.width = `${((i + 1) / config.terminalStrings.length) * 100}%`;
      i++;
    } else {
      clearInterval(interval);
      setTimeout(() => transitionToPortal(data), 800);
    }
  }, 700);
}

function transitionToPortal(data) {
  showScreen("loading-screen");
  setTimeout(() => {
    showScreen("portal-screen");
    document.getElementById("friend-avatar").src = data.avatar;
    document.getElementById("data-name").textContent = data.nombre;

    document.getElementById("access-btn").onclick = () => showCapsule(data);
    document.getElementById("archivo-btn").onclick = () => showMemorias(currentFriendId);
  }, 400);
}

function showCapsule(data) {
  showScreen("capsule-screen");
  document.getElementById("personal-message").textContent = data.msj;

  const grid = document.getElementById("photo-grid");
  grid.innerHTML = "";
  (data.fotos || []).forEach(src => {
    const img = document.createElement("img");
    img.src = src;
    img.onerror = () => (img.style.display = "none");
    grid.appendChild(img);
  });

  document.getElementById("capsule-back-btn").onclick = () => transitionToPortal(data);
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

// --- Init ---
document.addEventListener("DOMContentLoaded", async () => {
  try {
    const res = await fetch("data/friends.json");
    if (!res.ok) throw new Error(res.statusText);
    config = await res.json();
    renderHub();
    renderSelector();
    showScreen("hub-screen");
  } catch (err) {
    console.error("No se pudo cargar data/friends.json:", err);
    const hub = document.getElementById("hub-screen");
    if (hub) {
      hub.innerHTML = '<div class="cyber-card"><p style="color:#ff6b6b;">Error al cargar la configuración. Usa un servidor local (Live Server) y verifica que exista data/friends.json</p></div>';
      hub.classList.remove("hidden");
    }
  }
});
