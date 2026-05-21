import { createServer } from "node:http";
import { readFile, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.LIGHT_CRYPTO_CHAT_PORT || 8090);
const DATA_DIR = join(__dirname, "data");
const DB_PATH = join(DATA_DIR, "light-cryptobroker.sqlite");
const PUBLIC_DIR = join(__dirname, "public");
const MASTER_SECRET = process.env.LIGHT_CRYPTO_SECRET || "dev-secret-change-me";

let db;

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@+/, "").toLowerCase();
}

function passwordHash(password, salt = randomBytes(16).toString("hex")) {
  return {
    salt,
    hash: pbkdf2Sync(String(password), salt, 120_000, 32, "sha256").toString("hex"),
  };
}

function passwordOk(password, user) {
  const next = passwordHash(password, user.password_salt).hash;
  return timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(user.password_hash, "hex"));
}

function cryptoKey() {
  return pbkdf2Sync(MASTER_SECRET, "light-crypto-chat-v1", 120_000, 32, "sha256");
}

function encryptMessage(plainText, metadata) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return {
    version: 1,
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: authTag.toString("base64"),
    metadata,
  };
}

function decryptMessage(container) {
  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), Buffer.from(container.iv, "base64"));
  decipher.setAAD(Buffer.from(JSON.stringify(container.metadata), "utf8"));
  decipher.setAuthTag(Buffer.from(container.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(container.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

async function openDb() {
  if (db) return db;
  await mkdir(DATA_DIR, { recursive: true });
  db = new DatabaseSync(DB_PATH);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      crypto_container TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  return db;
}

async function body(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const badRequest = new Error("Invalid JSON");
    badRequest.statusCode = 400;
    throw badRequest;
  }
}

function json(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  });
  response.end(JSON.stringify(payload));
}

function error(response, status, message) {
  json(response, status, { error: message });
}

async function currentUser(request) {
  const token = (request.headers.authorization || "").replace(/^Bearer /, "");
  if (!token) return null;
  const database = await openDb();
  const session = database.prepare("SELECT * FROM sessions WHERE token = ?").get(token);
  if (!session) return null;
  return database.prepare("SELECT * FROM users WHERE id = ?").get(session.user_id) || null;
}

function publicUser(user) {
  return { id: user.id, username: `@${user.username}`, displayName: user.display_name };
}

function messageDto(row) {
  const container = JSON.parse(row.crypto_container);
  return {
    id: row.id,
    senderId: row.sender_id,
    senderName: row.sender_name,
    createdAt: row.created_at,
    text: decryptMessage(container),
    cryptoContainer: container,
  };
}

async function api(request, response, url) {
  const database = await openDb();

  if (url.pathname === "/api/health") {
    return json(response, 200, { ok: true, port: PORT, database: "sqlite", encryption: "AES-256-GCM" });
  }

  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    const input = await body(request);
    const username = normalizeUsername(input.username);
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return error(response, 400, "Username: 3-24 символа, латиница, цифры и _");
    if (String(input.password || "").length < 6) return error(response, 400, "Пароль минимум 6 символов");
    if (database.prepare("SELECT id FROM users WHERE username = ?").get(username)) return error(response, 409, "Username уже занят");

    const hashed = passwordHash(input.password);
    const user = {
      id: id("user"),
      username,
      displayName: String(input.displayName || username).trim().slice(0, 40),
      createdAt: now(),
    };
    database.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(user.id, user.username, user.displayName, hashed.hash, hashed.salt, user.createdAt);
    const token = id("session");
    database.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(token, user.id, now());
    return json(response, 201, { token, user: publicUser({ ...user, display_name: user.displayName }) });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const input = await body(request);
    const user = database.prepare("SELECT * FROM users WHERE username = ?").get(normalizeUsername(input.username));
    if (!user || !passwordOk(input.password || "", user)) return error(response, 401, "Неверный username или пароль");
    const token = id("session");
    database.prepare("INSERT INTO sessions VALUES (?, ?, ?)").run(token, user.id, now());
    return json(response, 200, { token, user: publicUser(user) });
  }

  const user = await currentUser(request);
  if (!user) return error(response, 401, "Нужна авторизация");

  if (url.pathname === "/api/messages" && request.method === "GET") {
    const rows = database.prepare("SELECT * FROM messages ORDER BY created_at ASC LIMIT 200").all();
    return json(response, 200, { user: publicUser(user), messages: rows.map(messageDto) });
  }

  if (url.pathname === "/api/messages" && request.method === "POST") {
    const input = await body(request);
    const text = String(input.text || "").trim();
    if (!text) return error(response, 400, "Сообщение пустое");
    const messageId = id("msg");
    const createdAt = now();
    const metadata = { messageId, senderId: user.id, createdAt };
    const container = encryptMessage(text, metadata);
    database.prepare("INSERT INTO messages VALUES (?, ?, ?, ?, ?)").run(messageId, user.id, user.display_name, JSON.stringify(container), createdAt);
    return json(response, 201, { message: messageDto(database.prepare("SELECT * FROM messages WHERE id = ?").get(messageId)) });
  }

  return error(response, 404, "Маршрут не найден");
}

async function staticFile(response, pathname) {
  const file = pathname === "/" ? "index.html" : pathname.slice(1);
  const target = join(PUBLIC_DIR, file);
  if (!target.startsWith(PUBLIC_DIR) || !existsSync(target)) return false;
  const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
  response.writeHead(200, { "content-type": `${types[extname(target)] || "text/plain"}; charset=utf-8` });
  response.end(await readFile(target));
  return true;
}

createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") return json(response, 204, {});
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/")) return api(request, response, url);
    if (await staticFile(response, url.pathname)) return;
    error(response, 404, "Файл не найден");
  } catch (exception) {
    console.error(exception);
    if (exception.statusCode === 400) return error(response, 400, "Некорректный JSON в запросе");
    error(response, 500, "Ошибка сервера");
  }
}).listen(PORT);
