const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "user-data.json");
const FRIENDS_FILE = path.join(__dirname, "data", "friends.json");
const JWT_SECRET = process.env.JWT_SECRET || process.env.SESSION_SECRET || "memoria-digital-secret";
const COOKIE_NAME = "memoria_token";
const TOKEN_DAYS = 30;
const PRESENCE_TTL_MS = 3 * 60 * 1000;
const presenceMap = new Map();

app.set("trust proxy", 1); // Para Render y proxies
app.use(express.json());
app.use(cookieParser());
app.use(express.static(__dirname));

function authMiddleware(req, res, next) {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) return next();
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.userId = decoded.userId;
  } catch {}
  next();
}

app.use(authMiddleware);

function readFriends() {
  try {
    return JSON.parse(fs.readFileSync(FRIENDS_FILE, "utf8"));
  } catch {
    return { friends: {} };
  }
}

function readUserData() {
  try {
    const data = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
    if (!Array.isArray(data.notifications)) {
      data.notifications = [];
      const cal = data.calendario || [];
      const evt = data.eventos || [];
      const caps = data.capsulasTiempo || [];
      const toMigrate = [...cal.filter(x => x.id), ...evt.filter(x => x.id), ...caps.filter(x => x.id)].slice(-8);
      toMigrate.forEach((item, i) => {
        const type = String(item.id || "").startsWith("cal_") ? "calendario" : String(item.id || "").startsWith("evt_") ? "evento" : "capsula";
        const title = item.titulo || (type === "calendario" ? "Fecha" : type === "evento" ? "Evento" : "Cápsula");
        data.notifications.push({
          id: "mig_" + Date.now() + "_" + i,
          type,
          title,
          subtitle: "Entrada existente",
          screen: type === "calendario" ? "calendar-screen" : type === "evento" ? "eventos-screen" : "capsulas-screen",
          createdAt: new Date().toISOString(),
        });
      });
      if (data.notifications.length > 0) writeUserData(data);
    }
    return data;
  } catch {
    return { calendario: [], eventos: [], capsulasTiempo: [], notifications: [] };
  }
}

function pushNotification(data, notif) {
  data.notifications = data.notifications || [];
  data.notifications.unshift({
    id: "notif_" + Date.now(),
    ...notif,
    createdAt: new Date().toISOString(),
  });
  const maxNotifs = 50;
  if (data.notifications.length > maxNotifs) {
    data.notifications = data.notifications.slice(0, maxNotifs);
  }
}

function writeUserData(data) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), "utf8");
}

// --- Calendario ---
app.get("/api/calendario", (req, res) => {
  const data = readUserData();
  res.json(data.calendario || []);
});

app.post("/api/calendario", (req, res) => {
  const data = readUserData();
  const { fecha, tipo, titulo, descripcion } = req.body;
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
  const data = readUserData();
  data.calendario = (data.calendario || []).filter((x) => x.id !== req.params.id);
  writeUserData(data);
  res.status(204).send();
});

// --- Eventos ---
app.get("/api/eventos", (req, res) => {
  const data = readUserData();
  res.json(data.eventos || []);
});

app.post("/api/eventos", (req, res) => {
  const data = readUserData();
  const { fecha, titulo, descripcion, lugar } = req.body;
  const item = {
    id: "evt_" + Date.now(),
    fecha: fecha || "",
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
  const data = readUserData();
  data.eventos = (data.eventos || []).filter((x) => x.id !== req.params.id);
  writeUserData(data);
  res.status(204).send();
});

// --- Cápsulas del tiempo ---
function canAccessCapsulaServer(cap, userId) {
  if (!cap.permittedUsers || cap.permittedUsers.length === 0) return true;
  if (userId && cap.createdBy === userId) return true;
  return userId && cap.permittedUsers.includes(userId);
}

app.get("/api/capsulas", (req, res) => {
  const data = readUserData();
  const capsulas = data.capsulasTiempo || [];
  const filtered = capsulas.filter((cap) => canAccessCapsulaServer(cap, req.userId));
  res.json(filtered);
});

app.get("/api/capsulas/:id", (req, res) => {
  const data = readUserData();
  const capsulas = data.capsulasTiempo || [];
  const cap = capsulas.find((c) => c.id === req.params.id);
  if (!cap) return res.status(404).json({ ok: false, error: "Cápsula no encontrada" });
  if (!canAccessCapsulaServer(cap, req.userId)) {
    return res.status(403).json({ ok: false, error: "No tienes acceso a esta cápsula" });
  }
  res.json(cap);
});

app.post("/api/capsulas", (req, res) => {
  const data = readUserData();
  const { titulo, fechaApertura, permittedUsers, createdBy } = req.body;
  const item = {
    id: "cap_" + Date.now(),
    titulo: titulo || "",
    fechaApertura: fechaApertura || "",
    mensajes: [],
    permittedUsers: Array.isArray(permittedUsers) ? permittedUsers : undefined,
    createdBy: createdBy || undefined,
  };
  data.capsulasTiempo = data.capsulasTiempo || [];
  data.capsulasTiempo.push(item);
  const friends = readFriends();
  const capCreatedBy = req.body.createdBy || req.userId;
  const nombre = capCreatedBy ? (friends.friends?.[capCreatedBy]?.nombre || capCreatedBy) : "Alguien";
  pushNotification(data, {
    type: "capsula",
    title: titulo || "Nueva cápsula",
    subtitle: `${nombre} creó una cápsula del tiempo`,
    createdBy: capCreatedBy,
    screen: "capsulas-screen",
  });
  writeUserData(data);
  res.status(201).json(item);
});

app.post("/api/capsulas/:id/mensajes", (req, res) => {
  if (!req.userId) return res.status(401).json({ ok: false, error: "Debes iniciar sesión" });
  const data = readUserData();
  const capsulas = data.capsulasTiempo || [];
  const cap = capsulas.find((c) => c.id === req.params.id);
  if (!cap) return res.status(404).json({ ok: false, error: "Cápsula no encontrada" });
  if (!canAccessCapsulaServer(cap, req.userId)) {
    return res.status(403).json({ ok: false, error: "No tienes acceso a esta cápsula" });
  }
  const { msj } = req.body;
  const friends = readFriends();
  const nombre = req.body.de || friends.friends?.[req.userId]?.nombre || req.userId;
  const mensaje = { de: nombre, msj: (msj || "").trim() };
  if (!mensaje.msj) return res.status(400).json({ ok: false, error: "El mensaje no puede estar vacío" });
  cap.mensajes = cap.mensajes || [];
  cap.mensajes.push(mensaje);
  writeUserData(data);
  res.status(201).json(mensaje);
});

app.delete("/api/capsulas/:id", (req, res) => {
  if (!req.userId) return res.status(401).json({ ok: false, error: "Debes iniciar sesión" });
  const data = readUserData();
  const capsulas = data.capsulasTiempo || [];
  const cap = capsulas.find((c) => c.id === req.params.id);
  if (!cap) return res.status(404).json({ ok: false, error: "Cápsula no encontrada" });
  if (!cap.createdBy || cap.createdBy !== req.userId) {
    return res.status(403).json({ ok: false, error: "Solo el creador puede borrar esta cápsula" });
  }
  data.capsulasTiempo = capsulas.filter((x) => x.id !== req.params.id);
  writeUserData(data);
  res.status(204).send();
});

// --- Notificaciones ---
app.get("/api/notifications", (req, res) => {
  const data = readUserData();
  data.notifications = data.notifications || [];
  const notifs = data.notifications.slice(0, 20);
  res.json(notifs);
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

app.get("/api/presence", (req, res) => {
  const cutoff = Date.now() - PRESENCE_TTL_MS;
  let count = 0;
  for (const [k, t] of presenceMap.entries()) {
    if (t >= cutoff) count++;
    else presenceMap.delete(k);
  }
  res.json({ count });
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
  const username = Object.keys(users).find(k => k.toLowerCase() === input.toLowerCase());
  const user = username ? users[username] : null;
  if (!user?.passwordHash) {
    return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
  }
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: "Usuario o contraseña incorrectos" });
  }
  const token = jwt.sign(
    { userId: username },
    JWT_SECRET,
    { expiresIn: TOKEN_DAYS + "d" }
  );
  const friends = readFriends();
  const friendData = friends.friends?.[username];
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
      nombre: friendData?.nombre || username,
      avatar: friendData?.avatar || "",
      color: friendData?.color || "#00f3ff",
    });
});

app.post("/api/auth/logout", (req, res) => {
  res.clearCookie(COOKIE_NAME, { path: "/" }).json({ ok: true });
});

app.post("/api/auth/change-password", (req, res) => {
  if (!req.userId) return res.status(401).json({ ok: false, error: "No autorizado" });
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword || newPassword.length < 4) {
    return res.status(400).json({ ok: false, error: "Contraseña nueva mínimo 4 caracteres" });
  }
  const data = readUserData();
  const users = data.users || {};
  const user = users[req.userId];
  if (!user?.passwordHash || !bcrypt.compareSync(currentPassword, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: "Contraseña actual incorrecta" });
  }
  user.passwordHash = bcrypt.hashSync(newPassword, 10);
  data.users = users;
  writeUserData(data);
  res.json({ ok: true });
});

const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
app.listen(PORT, HOST, () => {
  console.log(`Memoria Digital → http://localhost:${PORT}`);
});
