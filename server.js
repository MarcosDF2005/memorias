const express = require("express");
const path = require("path");
const fs = require("fs");
const bcrypt = require("bcryptjs");
const session = require("express-session");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "user-data.json");
const FRIENDS_FILE = path.join(__dirname, "data", "friends.json");

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "memoria-digital-secret",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: process.env.NODE_ENV === "production", maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 días
  })
);
app.use(express.static(__dirname));

function readFriends() {
  try {
    return JSON.parse(fs.readFileSync(FRIENDS_FILE, "utf8"));
  } catch {
    return { friends: {} };
  }
}

function readUserData() {
  try {
    const data = fs.readFileSync(DATA_FILE, "utf8");
    return JSON.parse(data);
  } catch {
    return { calendario: [], eventos: [] };
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
  };
  data.calendario = data.calendario || [];
  data.calendario.push(item);
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
  };
  data.eventos = data.eventos || [];
  data.eventos.push(item);
  writeUserData(data);
  res.status(201).json(item);
});

app.delete("/api/eventos/:id", (req, res) => {
  const data = readUserData();
  data.eventos = (data.eventos || []).filter((x) => x.id !== req.params.id);
  writeUserData(data);
  res.status(204).send();
});

// --- Auth ---
app.get("/api/auth/me", (req, res) => {
  if (!req.session?.userId) return res.status(401).json({ ok: false });
  const friends = readFriends();
  const data = friends.friends?.[req.session.userId];
  if (!data) return res.status(401).json({ ok: false });
  res.json({
    ok: true,
    userId: req.session.userId,
    nombre: data.nombre || req.session.userId,
    avatar: data.avatar || "",
  });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ ok: false, error: "Faltan usuario o contraseña" });
  }
  const data = readUserData();
  const users = data.users || {};
  const user = users[username];
  if (!user?.passwordHash) {
    return res.status(401).json({ ok: false, error: "Usuario no encontrado" });
  }
  if (!bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ ok: false, error: "Contraseña incorrecta" });
  }
  req.session.userId = username;
  const friends = readFriends();
  const friendData = friends.friends?.[username];
  res.json({
    ok: true,
    userId: username,
    nombre: friendData?.nombre || username,
    avatar: friendData?.avatar || "",
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

const HOST = process.env.NODE_ENV === "production" ? "0.0.0.0" : "localhost";
app.listen(PORT, HOST, () => {
  console.log(`Memoria Digital → http://localhost:${PORT}`);
});
