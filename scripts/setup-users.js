/**
 * Script para crear cuentas de usuario con contraseña por defecto.
 * Ejecutar: npm run setup-users
 * Contraseña por defecto: memoria
 */
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const DATA_FILE = path.join(__dirname, "..", "data", "user-data.json");
const FRIENDS_FILE = path.join(__dirname, "..", "data", "friends.json");
const DEFAULT_PASSWORD = "memoria";

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return {};
  }
}

function main() {
  const friends = readJson(FRIENDS_FILE);
  const friendOrder = friends.friendOrder || Object.keys(friends.friends || {});
  const users = {};

  for (const userId of friendOrder) {
    const data = friends.friends?.[userId];
    if (data && (data.nombre || userId)) {
      users[userId] = {
        passwordHash: bcrypt.hashSync(DEFAULT_PASSWORD, 10),
      };
    }
  }

  let userData = readJson(DATA_FILE);
  userData.users = users;
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(userData, null, 2), "utf8");

  console.log(`✓ Cuentas creadas para: ${Object.keys(users).join(", ")}`);
  console.log(`  Contraseña por defecto: ${DEFAULT_PASSWORD}`);
}

main();
