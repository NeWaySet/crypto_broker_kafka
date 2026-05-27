import { createServer } from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";
import { Kafka } from "kafkajs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.LIGHT_CRYPTO_CHAT_PORT || 18090);
const DATA_DIR = join(__dirname, "data");
const LOG_DIR = join(__dirname, "logs");
const DB_PATH = join(DATA_DIR, "light-cryptobroker.sqlite");
const PUBLIC_DIR = join(__dirname, "public");
const MASTER_SECRET = process.env.LIGHT_CRYPTO_SECRET || "dev-secret-change-me";
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const SENSOR_TOPIC = process.env.SENSOR_TOPIC || "litebroker.sensors.random";
const CHAT_TOPIC_PREFIX = process.env.CHAT_TOPIC_PREFIX || "litebroker.chat";

let db;
let producer;
let kafkaReady = false;
let sensorTimer;

function id(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function now() {
  return new Date().toISOString();
}

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@+/, "").toLowerCase();
}

function safeTopicPart(value) {
  return normalizeUsername(value).replace(/[^a-z0-9_]/g, "_") || "unknown";
}

function chatTopic(firstUsername, secondUsername) {
  return `${CHAT_TOPIC_PREFIX}.${[safeTopicPart(firstUsername), safeTopicPart(secondUsername)].sort().join("__")}`;
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
  return pbkdf2Sync(MASTER_SECRET, "light-crypto-chat-v2-kafka", 120_000, 32, "sha256");
}

function encryptMessage(plainText, metadata) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  cipher.setAAD(Buffer.from(JSON.stringify(metadata), "utf8"));
  const ciphertext = Buffer.concat([cipher.update(String(plainText), "utf8"), cipher.final()]);
  return {
    version: 2,
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
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
  await mkdir(LOG_DIR, { recursive: true });
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
      chat_topic TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      recipient_name TEXT NOT NULL,
      crypto_container TEXT NOT NULL,
      created_at TEXT NOT NULL,
      kafka_offset TEXT,
      FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (recipient_id) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS sensor_samples (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      temperature REAL NOT NULL,
      humidity REAL NOT NULL,
      pressure REAL NOT NULL,
      created_at TEXT NOT NULL
    );
  `);
  try {
    db.exec("ALTER TABLE messages ADD COLUMN chat_topic TEXT NOT NULL DEFAULT 'litebroker.chat.legacy'");
  } catch (error) {
    if (!String(error.message || "").includes("duplicate column name")) throw error;
  }
  try {
    db.exec("ALTER TABLE messages ADD COLUMN recipient_id TEXT NOT NULL DEFAULT ''");
  } catch (error) {
    if (!String(error.message || "").includes("duplicate column name")) throw error;
  }
  try {
    db.exec("ALTER TABLE messages ADD COLUMN recipient_name TEXT NOT NULL DEFAULT ''");
  } catch (error) {
    if (!String(error.message || "").includes("duplicate column name")) throw error;
  }
  try {
    db.exec("ALTER TABLE messages ADD COLUMN kafka_offset TEXT");
  } catch (error) {
    if (!String(error.message || "").includes("duplicate column name")) throw error;
  }
  seedUsers(db);
  return db;
}

function seedUsers(database) {
  const total = database.prepare("SELECT COUNT(*) AS total FROM users").get().total;
  if (total > 0) return;
  for (const demo of [
    ["alice", "Алиса"],
    ["bob", "Боб"],
    ["sensor_admin", "Администратор датчиков"],
  ]) {
    const hashed = passwordHash("123456");
    database.prepare("INSERT INTO users VALUES (?, ?, ?, ?, ?, ?)").run(id("user"), demo[0], demo[1], hashed.hash, hashed.salt, now());
  }
}

async function kafkaProducer() {
  if (producer) return producer;
  const kafka = new Kafka({ clientId: "litebroker-api", brokers: KAFKA_BROKERS });
  producer = kafka.producer();
  try {
    await producer.connect();
    kafkaReady = true;
  } catch (error) {
    kafkaReady = false;
    console.error("Kafka unavailable, local persistence still works:", error.message);
  }
  return producer;
}

async function publishKafka(topic, key, value) {
  const currentProducer = await kafkaProducer();
  if (!kafkaReady) {
    try {
      await currentProducer.connect();
      kafkaReady = true;
    } catch (error) {
      return { ok: false, reason: `kafka unavailable: ${error.message}` };
    }
  }
  try {
    const result = await currentProducer.send({ topic, messages: [{ key, value: JSON.stringify(value) }] });
    return { ok: true, offset: result?.[0]?.baseOffset || "" };
  } catch (error) {
    kafkaReady = false;
    console.error("Kafka publish failed:", error.message);
    return { ok: false, reason: error.message };
  }
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

function text(response, status, payload) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  response.end(payload);
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
  let textValue = "";
  try {
    textValue = decryptMessage(container);
  } catch {
    textValue = "[сообщение не удалось расшифровать]";
  }
  return {
    id: row.id,
    chatTopic: row.chat_topic,
    senderId: row.sender_id,
    senderName: row.sender_name,
    recipientId: row.recipient_id,
    recipientName: row.recipient_name,
    createdAt: row.created_at,
    text: textValue,
    cryptoContainer: container,
    kafkaOffset: row.kafka_offset || "",
  };
}

function userMessages(database, userId, peerId = "") {
  const params = peerId ? [userId, userId, peerId, peerId] : [userId, userId];
  const sql = peerId
    ? `SELECT * FROM messages
       WHERE (sender_id = ? OR recipient_id = ?) AND (sender_id = ? OR recipient_id = ?)
       ORDER BY created_at ASC LIMIT 200`
    : `SELECT * FROM messages
       WHERE sender_id = ? OR recipient_id = ?
       ORDER BY created_at ASC LIMIT 200`;
  return database.prepare(sql).all(...params).map(messageDto);
}

async function appendChatLog(event) {
  await appendFile(join(LOG_DIR, "chat-containers.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

async function appendSensorLog(event) {
  await appendFile(join(LOG_DIR, "sensor-samples.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

async function createSensorSample() {
  const database = await openDb();
  const createdAt = now();
  const sample = {
    id: id("sensor"),
    topic: SENSOR_TOPIC,
    temperature: Number((20 + Math.random() * 12).toFixed(2)),
    humidity: Number((35 + Math.random() * 45).toFixed(2)),
    pressure: Number((735 + Math.random() * 35).toFixed(2)),
    createdAt,
  };
  database.prepare("INSERT INTO sensor_samples VALUES (?, ?, ?, ?, ?, ?)").run(sample.id, sample.topic, sample.temperature, sample.humidity, sample.pressure, sample.createdAt);
  await publishKafka(SENSOR_TOPIC, "random-sensor", { eventType: "sensor.sample", ...sample });
  await appendSensorLog({ eventType: "sensor.sample", ...sample });
}

function startSensorGenerator() {
  if (sensorTimer) return;
  sensorTimer = setInterval(() => {
    createSensorSample().catch((error) => console.error("sensor generator failed:", error));
  }, Number(process.env.SENSOR_INTERVAL_MS || 5000));
}

async function metrics() {
  const database = await openDb();
  const users = database.prepare("SELECT COUNT(*) AS total FROM users").get().total;
  const messages = database.prepare("SELECT COUNT(*) AS total FROM messages").get().total;
  const sensors = database.prepare("SELECT COUNT(*) AS total FROM sensor_samples").get().total;
  const lastSensor = database.prepare("SELECT * FROM sensor_samples ORDER BY created_at DESC LIMIT 1").get();
  const topics = database.prepare("SELECT chat_topic, COUNT(*) AS total FROM messages GROUP BY chat_topic").all();
  const lines = [
    "# HELP litebroker_users_total Total users",
    "# TYPE litebroker_users_total gauge",
    `litebroker_users_total ${users}`,
    "# HELP litebroker_messages_total Total chat messages",
    "# TYPE litebroker_messages_total gauge",
    `litebroker_messages_total ${messages}`,
    "# HELP litebroker_sensor_samples_total Total sensor samples",
    "# TYPE litebroker_sensor_samples_total gauge",
    `litebroker_sensor_samples_total ${sensors}`,
    "# HELP litebroker_kafka_ready Kafka producer status",
    "# TYPE litebroker_kafka_ready gauge",
    `litebroker_kafka_ready ${kafkaReady ? 1 : 0}`,
  ];
  for (const row of topics) {
    lines.push(`litebroker_chat_messages_total{topic="${row.chat_topic}"} ${row.total}`);
  }
  if (lastSensor) {
    lines.push(`litebroker_sensor_temperature_celsius ${lastSensor.temperature}`);
    lines.push(`litebroker_sensor_humidity_percent ${lastSensor.humidity}`);
    lines.push(`litebroker_sensor_pressure_mmhg ${lastSensor.pressure}`);
  }
  return `${lines.join("\n")}\n`;
}

async function api(request, response, url) {
  const database = await openDb();

  if (url.pathname === "/api/health") {
    return json(response, 200, { ok: true, port: PORT, database: "sqlite", kafka: kafkaReady, encryption: "AES-256-GCM" });
  }

  if (url.pathname === "/metrics") {
    return text(response, 200, await metrics());
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

  if (url.pathname === "/api/users" && request.method === "GET") {
    const users = database.prepare("SELECT * FROM users WHERE id != ? ORDER BY username ASC").all(user.id).map(publicUser);
    return json(response, 200, { user: publicUser(user), users });
  }

  if (url.pathname === "/api/messages" && request.method === "GET") {
    const peerId = url.searchParams.get("peerId") || "";
    return json(response, 200, { user: publicUser(user), messages: userMessages(database, user.id, peerId) });
  }

  if (url.pathname === "/api/messages" && request.method === "POST") {
    const input = await body(request);
    const recipient = database.prepare("SELECT * FROM users WHERE id = ?").get(String(input.recipientId || ""));
    if (!recipient || recipient.id === user.id) return error(response, 400, "Выберите собеседника");
    const messageText = String(input.text || "").trim();
    if (!messageText) return error(response, 400, "Сообщение пустое");
    const messageId = id("msg");
    const createdAt = now();
    const topic = chatTopic(user.username, recipient.username);
    const metadata = { messageId, senderId: user.id, recipientId: recipient.id, chatTopic: topic, createdAt };
    const container = encryptMessage(messageText, metadata);
    const event = { eventType: "chat.message.container", id: messageId, chatTopic: topic, createdAt, cryptoContainer: container };
    const kafkaResult = await publishKafka(topic, topic, event);
    database
      .prepare(`
        INSERT INTO messages (
          id, chat_topic, sender_id, sender_name, recipient_id, recipient_name,
          crypto_container, created_at, kafka_offset
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .run(
        messageId,
        topic,
        user.id,
        user.display_name,
        recipient.id,
        recipient.display_name,
        JSON.stringify(container),
        createdAt,
        kafkaResult.offset || "",
      );
    await appendChatLog(event);
    const row = database.prepare("SELECT * FROM messages WHERE id = ?").get(messageId);
    return json(response, 201, { message: messageDto(row), kafka: kafkaResult });
  }

  if (url.pathname === "/api/sensors" && request.method === "GET") {
    const samples = database.prepare("SELECT * FROM sensor_samples ORDER BY created_at DESC LIMIT 50").all().reverse();
    return json(response, 200, { topic: SENSOR_TOPIC, samples });
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

await openDb();
await kafkaProducer();
startSensorGenerator();

createServer(async (request, response) => {
  try {
    if (request.method === "OPTIONS") return json(response, 204, {});
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname.startsWith("/api/") || url.pathname === "/metrics") return api(request, response, url);
    if (await staticFile(response, url.pathname)) return;
    error(response, 404, "Файл не найден");
  } catch (exception) {
    console.error(exception);
    if (exception.statusCode === 400) return error(response, 400, "Некорректный JSON в запросе");
    error(response, 500, "Ошибка сервера");
  }
}).listen(PORT, "0.0.0.0", () => {
  console.log(`LiteBroker Kafka chat listening on http://localhost:${PORT}`);
});
