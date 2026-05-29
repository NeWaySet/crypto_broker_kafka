import { createServer } from "node:http";
import { appendFile, mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { createCipheriv, createDecipheriv, pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Kafka } from "kafkajs";
import pg from "pg";

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.LIGHT_CRYPTO_CHAT_PORT || 18090);
const LOG_DIR = join(__dirname, "logs");
const PUBLIC_DIR = join(__dirname, "public");
const MASTER_SECRET = process.env.LIGHT_CRYPTO_SECRET || "dev-secret-change-me";
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");
const SENSOR_TOPIC = process.env.SENSOR_TOPIC || "litebroker.sensors.random";
const CHAT_TOPIC_PREFIX = process.env.CHAT_TOPIC_PREFIX || "litebroker.chat";
const DATABASE_URL = process.env.DATABASE_URL || "postgres://litebroker:litebroker@localhost:5432/litebroker";

let pool;
let producer;
let kafkaReady = false;
let dbReady = false;
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

function orderedMetadata(metadata = {}) {
  if (metadata.messageId) {
    return {
      messageId: metadata.messageId,
      senderId: metadata.senderId,
      recipientId: metadata.recipientId,
      chatTopic: metadata.chatTopic,
      createdAt: metadata.createdAt,
    };
  }

  if (metadata.sampleId) {
    return {
      sampleId: metadata.sampleId,
      topic: metadata.topic,
      createdAt: metadata.createdAt,
      storage: metadata.storage,
    };
  }

  return Object.keys(metadata)
    .sort()
    .reduce((result, key) => {
      result[key] = metadata[key];
      return result;
    }, {});
}

function aadBuffer(metadata) {
  return Buffer.from(JSON.stringify(orderedMetadata(metadata)), "utf8");
}

function encryptContainer(value, metadata) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cryptoKey(), iv);
  cipher.setAAD(aadBuffer(metadata));
  const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
  return {
    version: 2,
    algorithm: "AES-256-GCM",
    iv: iv.toString("base64"),
    ciphertext: ciphertext.toString("base64"),
    authTag: cipher.getAuthTag().toString("base64"),
    metadata,
  };
}

function decryptContainer(container) {
  const decipher = createDecipheriv("aes-256-gcm", cryptoKey(), Buffer.from(container.iv, "base64"));
  decipher.setAAD(aadBuffer(container.metadata));
  decipher.setAuthTag(Buffer.from(container.authTag, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(container.ciphertext, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function encryptMessage(plainText, metadata) {
  return encryptContainer(plainText, metadata);
}

function decryptMessage(container) {
  return decryptContainer(container);
}

function encryptJsonPayload(payload, metadata) {
  return encryptContainer(JSON.stringify(payload), metadata);
}

function decryptJsonPayload(container) {
  return JSON.parse(decryptContainer(container));
}

async function query(sql, params = []) {
  const database = await openDb();
  return database.query(sql, params);
}

async function openDb() {
  if (pool) return pool;
  await mkdir(LOG_DIR, { recursive: true });
  pool = new Pool({
    connectionString: DATABASE_URL,
    max: 10,
    idleTimeoutMillis: 30_000,
  });
  pool.on("error", (error) => {
    dbReady = false;
    console.error("PostgreSQL pool error:", error.message);
  });

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL UNIQUE,
      display_name TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chat_topic TEXT NOT NULL,
      sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sender_name TEXT NOT NULL,
      recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      recipient_name TEXT NOT NULL,
      crypto_container JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      kafka_offset TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_messages_users_created
      ON messages (sender_id, recipient_id, created_at);

    CREATE INDEX IF NOT EXISTS idx_messages_topic
      ON messages (chat_topic);

    CREATE TABLE IF NOT EXISTS sensor_samples (
      id TEXT PRIMARY KEY,
      topic TEXT NOT NULL,
      temperature DOUBLE PRECISION,
      humidity DOUBLE PRECISION,
      pressure DOUBLE PRECISION,
      encrypted_payload JSONB,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sensor_samples_created
      ON sensor_samples (created_at DESC);
  `);
  await migrateSensorEncryption();
  dbReady = true;
  await seedUsers();
  return pool;
}

async function migrateSensorEncryption() {
  await pool.query(`
    ALTER TABLE sensor_samples ADD COLUMN IF NOT EXISTS encrypted_payload JSONB;
    ALTER TABLE sensor_samples ALTER COLUMN temperature DROP NOT NULL;
    ALTER TABLE sensor_samples ALTER COLUMN humidity DROP NOT NULL;
    ALTER TABLE sensor_samples ALTER COLUMN pressure DROP NOT NULL;
  `);

  const { rows } = await pool.query(`
    SELECT id, topic, temperature, humidity, pressure, created_at
    FROM sensor_samples
    WHERE encrypted_payload IS NULL
      AND temperature IS NOT NULL
      AND humidity IS NOT NULL
      AND pressure IS NOT NULL
    ORDER BY created_at ASC
    LIMIT 2000
  `);

  for (const row of rows) {
    const createdAt = new Date(row.created_at).toISOString();
    const encryptedPayload = encryptJsonPayload(
      {
        temperature: Number(row.temperature),
        humidity: Number(row.humidity),
        pressure: Number(row.pressure),
      },
      {
        sampleId: row.id,
        topic: row.topic,
        createdAt,
        storage: "postgres.sensor_samples.encrypted_payload",
      },
    );
    await pool.query(
      `UPDATE sensor_samples
       SET encrypted_payload = $1::jsonb,
           temperature = NULL,
           humidity = NULL,
           pressure = NULL
       WHERE id = $2`,
      [JSON.stringify(encryptedPayload), row.id],
    );
  }
}

async function seedUsers() {
  const { rows } = await pool.query("SELECT COUNT(*)::int AS total FROM users");
  if (rows[0].total > 0) return;

  for (const [username, displayName] of [
    ["alice", "Алиса"],
    ["bob", "Боб"],
    ["sensor_admin", "Администратор датчиков"],
  ]) {
    const hashed = passwordHash("123456");
    await pool.query(
      `INSERT INTO users (id, username, display_name, password_hash, password_salt, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id("user"), username, displayName, hashed.hash, hashed.salt, now()],
    );
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
  const { rows: sessions } = await query("SELECT * FROM sessions WHERE token = $1", [token]);
  if (!sessions.length) return null;
  const { rows: users } = await query("SELECT * FROM users WHERE id = $1", [sessions[0].user_id]);
  return users[0] || null;
}

function publicUser(user) {
  return { id: user.id, username: `@${user.username}`, displayName: user.display_name };
}

function messageDto(row) {
  const container = typeof row.crypto_container === "string" ? JSON.parse(row.crypto_container) : row.crypto_container;
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
    createdAt: new Date(row.created_at).toISOString(),
    text: textValue,
    cryptoContainer: container,
    kafkaOffset: row.kafka_offset || "",
  };
}

function sensorDto(row) {
  const createdAt = new Date(row.created_at).toISOString();
  const container = typeof row.encrypted_payload === "string" ? JSON.parse(row.encrypted_payload) : row.encrypted_payload;

  if (container) {
    try {
      const payload = decryptJsonPayload(container);
      return {
        id: row.id,
        topic: row.topic,
        temperature: Number(payload.temperature),
        humidity: Number(payload.humidity),
        pressure: Number(payload.pressure),
        created_at: createdAt,
        encrypted: true,
      };
    } catch {
      return {
        id: row.id,
        topic: row.topic,
        temperature: 0,
        humidity: 0,
        pressure: 0,
        created_at: createdAt,
        encrypted: true,
        decryptError: true,
      };
    }
  }

  return {
    id: row.id,
    topic: row.topic,
    temperature: Number(row.temperature),
    humidity: Number(row.humidity),
    pressure: Number(row.pressure),
    created_at: createdAt,
    encrypted: false,
  };
}

async function userMessages(userId, peerId = "") {
  const params = peerId ? [userId, userId, peerId, peerId] : [userId, userId];
  const sql = peerId
    ? `SELECT * FROM messages
       WHERE (sender_id = $1 OR recipient_id = $2) AND (sender_id = $3 OR recipient_id = $4)
       ORDER BY created_at ASC LIMIT 200`
    : `SELECT * FROM messages
       WHERE sender_id = $1 OR recipient_id = $2
       ORDER BY created_at ASC LIMIT 200`;
  const { rows } = await query(sql, params);
  return rows.map(messageDto);
}

async function appendChatLog(event) {
  await appendFile(join(LOG_DIR, "chat-containers.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

async function appendSensorLog(event) {
  await appendFile(join(LOG_DIR, "sensor-samples.jsonl"), `${JSON.stringify(event)}\n`, "utf8");
}

async function createSensorSample() {
  const createdAt = now();
  const sample = {
    id: id("sensor"),
    topic: SENSOR_TOPIC,
    temperature: Number((20 + Math.random() * 12).toFixed(2)),
    humidity: Number((35 + Math.random() * 45).toFixed(2)),
    pressure: Number((735 + Math.random() * 35).toFixed(2)),
    createdAt,
  };
  const encryptedPayload = encryptJsonPayload(
    {
      temperature: sample.temperature,
      humidity: sample.humidity,
      pressure: sample.pressure,
    },
    {
      sampleId: sample.id,
      topic: sample.topic,
      createdAt,
      storage: "postgres.sensor_samples.encrypted_payload",
    },
  );
  await query(
    `INSERT INTO sensor_samples (id, topic, encrypted_payload, created_at)
     VALUES ($1, $2, $3::jsonb, $4)`,
    [sample.id, sample.topic, JSON.stringify(encryptedPayload), sample.createdAt],
  );
  await publishKafka(SENSOR_TOPIC, "random-sensor", { eventType: "sensor.sample", ...sample });
  await appendSensorLog({ eventType: "sensor.sample", ...sample });
}

function startSensorGenerator() {
  if (sensorTimer) return;
  sensorTimer = setInterval(() => {
    createSensorSample().catch((generationError) => console.error("sensor generator failed:", generationError));
  }, Number(process.env.SENSOR_INTERVAL_MS || 5000));
}

async function metrics() {
  const [{ rows: userRows }, { rows: messageRows }, { rows: sensorRows }, { rows: lastSensorRows }, { rows: topicRows }] = await Promise.all([
    query("SELECT COUNT(*)::int AS total FROM users"),
    query("SELECT COUNT(*)::int AS total FROM messages"),
    query("SELECT COUNT(*)::int AS total FROM sensor_samples"),
    query("SELECT * FROM sensor_samples ORDER BY created_at DESC LIMIT 1"),
    query("SELECT chat_topic, COUNT(*)::int AS total FROM messages GROUP BY chat_topic"),
  ]);
  const lines = [
    "# HELP litebroker_users_total Total users",
    "# TYPE litebroker_users_total gauge",
    `litebroker_users_total ${userRows[0].total}`,
    "# HELP litebroker_messages_total Total chat messages",
    "# TYPE litebroker_messages_total gauge",
    `litebroker_messages_total ${messageRows[0].total}`,
    "# HELP litebroker_sensor_samples_total Total sensor samples",
    "# TYPE litebroker_sensor_samples_total gauge",
    `litebroker_sensor_samples_total ${sensorRows[0].total}`,
    "# HELP litebroker_kafka_ready Kafka producer status",
    "# TYPE litebroker_kafka_ready gauge",
    `litebroker_kafka_ready ${kafkaReady ? 1 : 0}`,
    "# HELP litebroker_postgres_ready PostgreSQL database status",
    "# TYPE litebroker_postgres_ready gauge",
    `litebroker_postgres_ready ${dbReady ? 1 : 0}`,
  ];
  for (const row of topicRows) {
    lines.push(`litebroker_chat_messages_total{topic="${row.chat_topic}"} ${row.total}`);
  }
  const lastSensor = lastSensorRows[0] ? sensorDto(lastSensorRows[0]) : null;
  if (lastSensor) {
    lines.push(`litebroker_sensor_temperature_celsius ${lastSensor.temperature}`);
    lines.push(`litebroker_sensor_humidity_percent ${lastSensor.humidity}`);
    lines.push(`litebroker_sensor_pressure_mmhg ${lastSensor.pressure}`);
  }
  return `${lines.join("\n")}\n`;
}

async function api(request, response, url) {
  await openDb();

  if (url.pathname === "/api/health") {
    return json(response, 200, {
      ok: true,
      port: PORT,
      database: "postgresql",
      postgres: dbReady,
      kafka: { ready: kafkaReady },
      encryption: "AES-256-GCM",
      databaseEncryption: {
        messages: "AES-256-GCM crypto_container JSONB",
        sensors: "AES-256-GCM encrypted_payload JSONB",
        passwords: "PBKDF2-SHA256 salted hash",
      },
    });
  }

  if (url.pathname === "/metrics") {
    return text(response, 200, await metrics());
  }

  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    const input = await body(request);
    const username = normalizeUsername(input.username);
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return error(response, 400, "Username: 3-24 символа, латиница, цифры и _");
    if (String(input.password || "").length < 6) return error(response, 400, "Пароль минимум 6 символов");
    const { rows: exists } = await query("SELECT id FROM users WHERE username = $1", [username]);
    if (exists.length) return error(response, 409, "Username уже занят");

    const hashed = passwordHash(input.password);
    const user = {
      id: id("user"),
      username,
      displayName: String(input.displayName || username).trim().slice(0, 40),
      createdAt: now(),
    };
    await query(
      `INSERT INTO users (id, username, display_name, password_hash, password_salt, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [user.id, user.username, user.displayName, hashed.hash, hashed.salt, user.createdAt],
    );
    const token = id("session");
    await query("INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3)", [token, user.id, now()]);
    return json(response, 201, { token, user: publicUser({ ...user, display_name: user.displayName }) });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const input = await body(request);
    const { rows } = await query("SELECT * FROM users WHERE username = $1", [normalizeUsername(input.username)]);
    const user = rows[0];
    if (!user || !passwordOk(input.password || "", user)) return error(response, 401, "Неверный username или пароль");
    const token = id("session");
    await query("INSERT INTO sessions (token, user_id, created_at) VALUES ($1, $2, $3)", [token, user.id, now()]);
    return json(response, 200, { token, user: publicUser(user) });
  }

  const user = await currentUser(request);
  if (!user) return error(response, 401, "Нужна авторизация");

  if (url.pathname === "/api/users" && request.method === "GET") {
    const { rows } = await query("SELECT * FROM users WHERE id != $1 ORDER BY username ASC", [user.id]);
    return json(response, 200, { user: publicUser(user), users: rows.map(publicUser) });
  }

  if (url.pathname === "/api/messages" && request.method === "GET") {
    const peerId = url.searchParams.get("peerId") || "";
    return json(response, 200, { user: publicUser(user), messages: await userMessages(user.id, peerId) });
  }

  if (url.pathname === "/api/messages" && request.method === "POST") {
    const input = await body(request);
    const { rows: recipients } = await query("SELECT * FROM users WHERE id = $1", [String(input.recipientId || "")]);
    const recipient = recipients[0];
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

    await query(
      `INSERT INTO messages (
        id, chat_topic, sender_id, sender_name, recipient_id, recipient_name,
        crypto_container, created_at, kafka_offset
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9)`,
      [
        messageId,
        topic,
        user.id,
        user.display_name,
        recipient.id,
        recipient.display_name,
        JSON.stringify(container),
        createdAt,
        kafkaResult.offset || "",
      ],
    );
    await appendChatLog(event);
    const { rows } = await query("SELECT * FROM messages WHERE id = $1", [messageId]);
    return json(response, 201, { message: messageDto(rows[0]), kafka: kafkaResult });
  }

  if (url.pathname === "/api/sensors" && request.method === "GET") {
    const { rows } = await query("SELECT * FROM sensor_samples ORDER BY created_at DESC LIMIT 50");
    return json(response, 200, {
      topic: SENSOR_TOPIC,
      samples: rows.reverse().map(sensorDto),
    });
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
