const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, "data", "user-data.json");

app.use(express.json());
app.use(express.static(__dirname));

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

app.listen(PORT, () => {
  console.log(`Memoria Digital → http://localhost:${PORT}`);
});
