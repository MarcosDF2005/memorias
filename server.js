const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;

// Rutas de datos en disco
const DATA_FILE = path.join(__dirname, "data", "user-data.json");
const FRIENDS_FILE = path.join(__dirname, "data", "friends.json");

// Auth
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "memoria-digital-secret";
const COOKIE_NAME = "memoria_token";
const TOKEN_DAYS = 30;

// Presencia (conectados)
const PRESENCE_TTL_MS = 3 * 60 * 1000;
const presenceMap = new Map(); // id -> timestamp

app.set("trust proxy", 1);
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

// --- Utilidades de lectura/escritura ---
function readUserData() {
  try {
    const raw = fs.readFileSync(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data.calendario)) data.calendario = [];
    if (!Array.isArray(data.eventos)) data.eventos = [];
    if (!Array.isArray(data.capsulasTiempo)) data.capsulasTiempo = [];
    if (!Array.isArray(data.notifications)) data.notifications = [];
    if (!data.users) data.users = {};
    return data;
  } catch {
    return { users: {}, calendario: [], eventos: [], capsulasTiempo: [], notifications: [] };
  }
}

function writeUserData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

function readFriends() {
  try {
    return JSON.parse(fs.readFileSync(FRIENDS_FILE, "utf8"));
  } catch {
    return { friends: {}, friendOrder: [], terminalStrings: [] };
  }
}

function pushNotification(data, notif) {
  data.notifications = data.notifications || [];
  data.notifications.unshift({
    id: "notif_" + Date.now(),
    ...notif,
    createdAt: new Date().toISOString(),
  });
  const max = 50;
  if (data.notifications.length > max) {
    data.notifications = data.notifications.slice(0, max);
  }
}

// --- Auth middleware ---
function authMiddleware(req, _res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
  } catch {
    // token inválido -> ignorar
  }
  next();
}

app.use(authMiddleware);

// --- Rutas de calendario ---
app.get("/api/calendario", (_req, res) => {
  const data = readUserData();
  res.json(data.calendario || []);
});

app.post("/api/calendario", (req, res) => {
  const data = readUserData();
  const { fecha, tipo, titulo, descripcion } = req.body || {};
  const item = {
    id: "cal_" + Date.now(),
    fecha,
    tipo: tipo || "evento",
    titulo: titulo || "",
    descripcion: descripcion || undefined,
    createdBy: req.userId || undefined,
  };
  data.calendario = data.calendario || [];
  data.calendario.push(item);

  const friends = readFriends();
  const nombre = req.userId ? (friends.friends?.[req.userId]?.nombre || req.userId) : "Alguien";
  pushNotification(data, {
    type: "calendario",
    title: titulo || "Nueva fecha",
    subtitle: `${nombre} añadió una fecha al calendario`,
    createdBy: req.userId,
    screen: "calendar-screen",
  });

  writeUserData(data);
  res.status(201).json(item);
});

app.delete("/api/calendario/:id", (req, res) => {
  const id = String(req.params.id || "");
  const data = readUserData();
  data.calendario = (data.calendario || []).filter((x) => x.id !== id);
  writeUserData(data);
  res.status(204).send();
});

// --- Rutas de eventos ---
app.get("/api/eventos", (_req, res) => {
  const data = readUserData();
  res.json(data.eventos || []);
});

app.post("/api/eventos", (req, res) => {
  const data = readUserData();
  const { fecha, titulo, descripcion, lugar } = req.body || {};
  const item = {
    id: "evt_" + Date.now(),
    fecha,
    titulo: titulo || "",
    descripcion: descripcion || undefined,
    lugar: lugar || undefined,
    createdBy: req.userId || undefined,
  };
  data.eventos = data.eventos || [];
  data.eventos.push(item);

  const friends = readFriends();
  const nombre = req.userId ? (friends.friends?.[req.userId]?.nombre || req.userId) : "Alguien";
  pushNotification(data, {
    type: "evento",
    title: titulo || "Nuevo evento",
    subtitle: `${nombre} creó un evento`,
    createdBy: req.userId,
    screen: "eventos-screen",
  });

  writeUserData(data);
  res.status(201).json(item);
});

app.delete("/api/eventos/:id", (req, res) => {
  const id = String(req.params.id || "");
  const data = readUserData();
  data.eventos = (data.eventos || []).filter((x) => x.id !== id);
  writeUserData(data);
  res.status(204).send();
});

// --- Cápsulas del tiempo ---
app.get("/api/capsulas", (req, res) => {
  const data = readUserData();
  let caps = data.capsulasTiempo || [];
  const userId = req.userId;
  if (userId) {
    // Filtrado básico: si tiene permittedUsers, solo las que incluyan al usuario
    caps = caps.filter((c) => {
      if (!Array.isArray(c.permittedUsers) || c.permittedUsers.length === 0) return true;
      return c.permittedUsers.includes(userId);
    });
  }
  res.json(caps);
});

app.post("/api/capsulas", (req, res) => {
  const data = readUserData();
  const { titulo, fechaApertura, permittedUsers } = req.body || {};
  const item = {
    id: "cap_" + Date.now(),
    titulo: titulo || "",
    fechaApertura: fechaApertura || "",
    permittedUsers: Array.isArray(permittedUsers) && permittedUsers.length ? permittedUsers : undefined,
    createdBy: req.userId || undefined,
    mensajes: [],
  };
  data.capsulasTiempo = data.capsulasTiempo || [];
  data.capsulasTiempo.push(item);

  const friends = readFriends();
  const nombre = req.userId ? (friends.friends?.[req.userId]?.nombre || req.userId) : "Alguien";
  pushNotification(data, {
    type: "capsula",
    title: titulo || "Nueva cápsula",
    subtitle: `${nombre} creó una cápsula del tiempo`,
    createdBy: req.userId,
    screen: "capsulas-screen",
  });

  writeUserData(data);
  res.status(201).json(item);
});

app.get("/api/capsulas/:id", (req, res) => {
  const id = String(req.params.id || "");
  const data = readUserData();
  const cap = (data.capsulasTiempo || []).find((c) => c.id === id);
  if (!cap) return res.status(404).json({ ok: false, error: "No encontrada" });
  res.json(cap);
});

app.delete("/api/capsulas/:id", (req, res) => {
  const id = String(req.params.id || "");
  const data = readUserData();
  data.capsulasTiempo = (data.capsulasTiempo || []).filter((c) => c.id !== id);
  writeUserData(data);
  res.status(204).send();
});

app.post("/api/capsulas/:id/mensajes", (req, res) => {
  const id = String(req.params.id || "");
  const { msj } = req.body || {};
  const data = readUserData();
  const caps = data.capsulasTiempo || [];
  const cap = caps.find((c) => c.id === id);
  if (!cap) return res.status(404).json({ ok: false, error: "No encontrada" });
  cap.mensajes = cap.mensajes || [];
  const mensaje = {
    id: "msg_" + Date.now(),
    msj: String(msj || "").slice(0, 1000),
    createdBy: req.userId || undefined,
    createdAt: new Date().toISOString(),
  };
  cap.mensajes.push(mensaje);
  writeUserData(data);
  res.status(201).json(mensaje);
});

// --- Notificaciones ---
app.get("/api/notifications", (_req, res) => {
  const data = readUserData();
  const notifs = (data.notifications || []).slice(0, 20);
  res.json(notifs);
});

app.delete("/api/notifications/:id", (req, res) => {
  const id = String(req.params.id || "");
  const data = readUserData();
  data.notifications = (data.notifications || []).filter((n) => n.id !== id);
  writeUserData(data);
  res.status(204).send();
});

app.delete("/api/notifications", (_req, res) => {
  const data = readUserData();
  data.notifications = [];
  writeUserData(data);
  res.status(204).send();
});

// --- Presencia (conectados) ---
app.post("/api/presence", (req, res) => {
  const id = req.userId || req.ip || "guest_" + req.ip;
  presenceMap.set(id, Date.now());
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  for (const [k, t] of presenceMap.entries()) {
    if (t < cutoff) presenceMap.delete(k);
  }
  res.json({ ok: true });
});

app.get("/api/presence", (_req, res) => {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  const ids = [];
  for (const [k, t] of presenceMap.entries()) {
    if (t >= cutoff) ids.push(k);
    else presenceMap.delete(k);
  }
  res.json({ count: ids.length, ids });
});

// --- Auth ---
app.get("/api/auth/me", (req, res) => {
  if (!req.userId) return res.status(401).json({ ok: false });
  const friends = readFriends();
  const data = friends.friends?.[req.userId];
  if (!data) return res.status(401).json({ ok: false });
  res.json({
    ok: true,
    userId: req.userId,
    nombre: data.nombre || req.userId,
    avatar: data.avatar || "",
    color: data.color || "#00f3ff",
  });
});

app.post("/api/auth/login", (req, res) => {
  const input = String(req.body.username || "").trim();
  const password = req.body.password;
  if (!input || !password) {
    return res.status(400).json({ ok: false, error: "Faltan usuario o contraseña" });
  }

  const data = readUserData();
  const users = data.users || {};
  const username = Object.keys(users).find((k) => k.toLowerCase() === input.toLowerCase());
  const user = username ? users[username] : null;
  if (!user?.passwordHash) {
    return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
  }
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
  }

  const token = jwt.sign({ userId: username }, JWT_SECRET, { expiresIn: `${TOKEN_DAYS}d` });
  const friends = readFriends();
  const friendData = friends.friends?.[username] || {};

  res
    .cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: TOKEN_DAYS * 24 * 60 * 60 * 1000,
      path: "/",
    })
    .json({
      ok: true,
      userId: username,
      nombre: friendData.nombre || username,
      avatar: friendData.avatar || "",
      color: friendData.color || "#00f3ff",
    });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" });
  res.json({ ok: true });
});

app.post("/api/auth/change-password", (req, res) => {
  if (!req.userId) return res.status(401).json({ ok: false, error: "No autenticado" });
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword) {
    return res.status(400).json({ ok: false, error: "Faltan datos" });
  }
  const data = readUserData();
  const users = data.users || {};
  const user = users[req.userId];
  if (!user?.passwordHash) {
    return res.status(400).json({ ok: false, error: "Usuario no encontrado" });
  }
  if (!bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: "Contraseña actual incorrecta" });
  }
  const hash = bcrypt.hashSync(newPassword, 10);
  users[req.userId].passwordHash = hash;
  data.users = users;
  writeUserData(data);
  res.json({ ok: true });
});

// Fallback: cualquier otra ruta devuelve index.html (SPA)
app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Servidor escuchando en http://localhost:${PORT}`);
});

