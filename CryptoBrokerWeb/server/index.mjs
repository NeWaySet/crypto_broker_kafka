import { createServer } from "node:http";
import { mkdir, readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pbkdf2Sync, randomBytes, timingSafeEqual } from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { createCryptoContainer, decryptCryptoContainer } from "./crypto.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const SQLITE_PATH = join(DATA_DIR, "cryptobroker.sqlite");
const LEGACY_JSON_PATH = join(DATA_DIR, "db.json");
const PORT = Number(process.env.CRYPTOBROKER_API_PORT || 5175);
let sqlite;

function makeId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
}

function normalizeUsername(value = "") {
  return String(value).trim().replace(/^@+/, "").toLowerCase();
}

function displayUsername(value) {
  const normalized = normalizeUsername(value);
  return normalized ? `@${normalized}` : "";
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(String(password), salt, 120_000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function passwordsMatch(password, account) {
  const next = hashPassword(password, account.passwordSalt).hash;
  return timingSafeEqual(Buffer.from(next, "hex"), Buffer.from(account.passwordHash, "hex"));
}

function publicUser(user) {
  const { passwordHash, passwordSalt, createdAt, ...safeUser } = user;
  return safeUser;
}

function parseJson(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

async function openDb() {
  if (sqlite) return sqlite;
  await mkdir(DATA_DIR, { recursive: true });
  sqlite = new DatabaseSync(SQLITE_PATH);
  sqlite.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      username TEXT NOT NULL UNIQUE,
      avatar TEXT NOT NULL,
      status TEXT NOT NULL,
      bio TEXT NOT NULL,
      isOnline INTEGER NOT NULL DEFAULT 0,
      lastSeen TEXT NOT NULL,
      passwordHash TEXT NOT NULL,
      passwordSalt TEXT NOT NULL,
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token TEXT PRIMARY KEY,
      userId TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS chats (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      avatar TEXT NOT NULL,
      participants TEXT NOT NULL,
      lastMessageId TEXT NOT NULL DEFAULT '',
      unreadCount INTEGER NOT NULL DEFAULT 0,
      isPinned INTEGER NOT NULL DEFAULT 0,
      isMuted INTEGER NOT NULL DEFAULT 0,
      isArchived INTEGER NOT NULL DEFAULT 0,
      isFavorite INTEGER NOT NULL DEFAULT 0,
      draft TEXT NOT NULL DEFAULT '',
      pinnedMessageId TEXT,
      description TEXT NOT NULL DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      chatId TEXT NOT NULL,
      senderId TEXT NOT NULL,
      text TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      editedAt TEXT,
      type TEXT NOT NULL,
      status TEXT NOT NULL,
      replyToId TEXT,
      forwardedFrom TEXT,
      attachments TEXT NOT NULL DEFAULT '[]',
      reactions TEXT NOT NULL DEFAULT '[]',
      isDeleted INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY (chatId) REFERENCES chats(id) ON DELETE CASCADE,
      FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
    );
  `);
  try {
    sqlite.exec("ALTER TABLE messages ADD COLUMN cryptoContainer TEXT");
  } catch (error) {
    if (!String(error.message || "").includes("duplicate column name")) throw error;
  }
  await migrateLegacyJson(sqlite);
  return sqlite;
}

async function migrateLegacyJson(db) {
  const count = db.prepare("SELECT COUNT(*) AS total FROM users").get().total;
  if (count > 0 || !existsSync(LEGACY_JSON_PATH)) return;
  const raw = await readFile(LEGACY_JSON_PATH, "utf8");
  const legacy = JSON.parse(raw || "{}");
  writeDbSync(db, {
    users: Array.isArray(legacy.users) ? legacy.users : [],
    chats: Array.isArray(legacy.chats) ? legacy.chats : [],
    messages: Array.isArray(legacy.messages) ? legacy.messages : [],
    sessions: Array.isArray(legacy.sessions) ? legacy.sessions : [],
  });
}

function mapUser(row) {
  return {
    ...row,
    isOnline: Boolean(row.isOnline),
  };
}

function mapChat(row) {
  return {
    ...row,
    participants: parseJson(row.participants, []),
    unreadCount: Number(row.unreadCount || 0),
    isPinned: Boolean(row.isPinned),
    isMuted: Boolean(row.isMuted),
    isArchived: Boolean(row.isArchived),
    isFavorite: Boolean(row.isFavorite),
    pinnedMessageId: row.pinnedMessageId || undefined,
  };
}

function mapMessage(row) {
  const cryptoContainer = parseJson(row.cryptoContainer, null);
  let text = row.text;
  if (cryptoContainer) {
    try {
      text = decryptCryptoContainer(cryptoContainer);
    } catch {
      text = "[не удалось расшифровать сообщение]";
    }
  }
  return {
    ...row,
    text,
    editedAt: row.editedAt || undefined,
    replyToId: row.replyToId || undefined,
    forwardedFrom: row.forwardedFrom || undefined,
    attachments: parseJson(row.attachments, []),
    reactions: parseJson(row.reactions, []),
    isDeleted: Boolean(row.isDeleted),
    cryptoContainer: cryptoContainer || undefined,
  };
}

function presentMessage(message) {
  if (!message.cryptoContainer) return message;
  try {
    const container = typeof message.cryptoContainer === "string" ? JSON.parse(message.cryptoContainer) : message.cryptoContainer;
    return { ...message, text: decryptCryptoContainer(container), cryptoContainer: container };
  } catch {
    return { ...message, text: "[не удалось расшифровать сообщение]" };
  }
}

async function readDb() {
  const db = await openDb();
  return {
    users: db.prepare("SELECT * FROM users ORDER BY createdAt ASC").all().map(mapUser),
    chats: db.prepare("SELECT * FROM chats").all().map(mapChat),
    messages: db.prepare("SELECT * FROM messages ORDER BY createdAt ASC").all().map(mapMessage),
    sessions: db.prepare("SELECT * FROM sessions ORDER BY createdAt ASC").all(),
  };
}

function writeDbSync(db, data) {
  db.exec("BEGIN IMMEDIATE");
  try {
    db.exec("DELETE FROM messages; DELETE FROM chats; DELETE FROM sessions; DELETE FROM users;");

    const insertUser = db.prepare(`
      INSERT INTO users (id, name, username, avatar, status, bio, isOnline, lastSeen, passwordHash, passwordSalt, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertSession = db.prepare("INSERT INTO sessions (token, userId, createdAt) VALUES (?, ?, ?)");
    const insertChat = db.prepare(`
      INSERT INTO chats (id, type, title, avatar, participants, lastMessageId, unreadCount, isPinned, isMuted, isArchived, isFavorite, draft, pinnedMessageId, description)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const insertMessage = db.prepare(`
      INSERT INTO messages (id, chatId, senderId, text, createdAt, editedAt, type, status, replyToId, forwardedFrom, attachments, reactions, isDeleted, cryptoContainer)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const user of data.users) {
      insertUser.run(
        user.id,
        user.name,
        user.username,
        user.avatar || "A1",
        user.status || "был недавно",
        user.bio || "",
        user.isOnline ? 1 : 0,
        user.lastSeen || new Date().toISOString(),
        user.passwordHash,
        user.passwordSalt,
        user.createdAt || new Date().toISOString(),
      );
    }

    for (const session of data.sessions) {
      insertSession.run(session.token, session.userId, session.createdAt || new Date().toISOString());
    }

    for (const chat of data.chats) {
      insertChat.run(
        chat.id,
        chat.type,
        chat.title,
        chat.avatar || "C1",
        JSON.stringify(chat.participants || []),
        chat.lastMessageId || "",
        Number(chat.unreadCount || 0),
        chat.isPinned ? 1 : 0,
        chat.isMuted ? 1 : 0,
        chat.isArchived ? 1 : 0,
        chat.isFavorite ? 1 : 0,
        chat.draft || "",
        chat.pinnedMessageId || null,
        chat.description || "",
      );
    }

    for (const message of data.messages) {
      insertMessage.run(
        message.id,
        message.chatId,
        message.senderId,
        message.text || "",
        message.createdAt || new Date().toISOString(),
        message.editedAt || null,
        message.type || "text",
        message.status || "read",
        message.replyToId || null,
        message.forwardedFrom || null,
        JSON.stringify(message.attachments || []),
        JSON.stringify(message.reactions || []),
        message.isDeleted ? 1 : 0,
        message.cryptoContainer ? JSON.stringify(message.cryptoContainer) : null,
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

async function writeDb(data) {
  writeDbSync(await openDb(), data);
}

async function parseBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function send(response, status, payload) {
  response.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "access-control-allow-headers": "content-type, authorization",
  });
  response.end(JSON.stringify(payload));
}

function sendText(response, status, text) {
  response.writeHead(status, {
    "content-type": "text/plain; charset=utf-8",
    "access-control-allow-origin": "*",
  });
  response.end(text);
}

function sendError(response, status, message) {
  send(response, status, { error: message });
}

function authUser(request, db) {
  const header = request.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = db.sessions.find((item) => item.token === token);
  if (!session) return null;
  return db.users.find((user) => user.id === session.userId) || null;
}

function stateFor(user, db) {
  const userChats = db.chats.filter((chat) => chat.participants.includes(user.id));
  const chatIds = new Set(userChats.map((chat) => chat.id));
  return {
    user: publicUser(user),
    users: db.users.map(publicUser),
    chats: userChats,
    messages: db.messages.filter((message) => chatIds.has(message.chatId)).map(presentMessage),
  };
}

function privateChatBetween(chats, firstUserId, secondUserId) {
  return chats.find(
    (chat) =>
      chat.type === "private" &&
      chat.participants.length === 2 &&
      chat.participants.includes(firstUserId) &&
      chat.participants.includes(secondUserId),
  );
}

async function route(request, response) {
  if (request.method === "OPTIONS") return send(response, 204, {});

  const url = new URL(request.url || "/", `http://${request.headers.host}`);
  const db = await readDb();

  if (url.pathname === "/api/health") {
    return send(response, 200, { ok: true, database: "sqlite" });
  }

  if (url.pathname === "/api/metrics") {
    const metrics = [
      "# HELP cryptobroker_users_total Total registered users",
      "# TYPE cryptobroker_users_total gauge",
      `cryptobroker_users_total ${db.users.length}`,
      "# HELP cryptobroker_chats_total Total chats",
      "# TYPE cryptobroker_chats_total gauge",
      `cryptobroker_chats_total ${db.chats.length}`,
      "# HELP cryptobroker_messages_total Total messages",
      "# TYPE cryptobroker_messages_total gauge",
      `cryptobroker_messages_total ${db.messages.length}`,
      "# HELP cryptobroker_sessions_total Active sessions",
      "# TYPE cryptobroker_sessions_total gauge",
      `cryptobroker_sessions_total ${db.sessions.length}`,
    ].join("\n");
    return sendText(response, 200, `${metrics}\n`);
  }

  if (url.pathname === "/api/auth/register" && request.method === "POST") {
    const body = await parseBody(request);
    const username = normalizeUsername(body.username);
    if (!/^[a-z0-9_]{3,24}$/.test(username)) return sendError(response, 400, "Username: 3-24 символа, латиница, цифры и _");
    if (String(body.password || "").length < 6) return sendError(response, 400, "Пароль должен быть минимум 6 символов");
    if (db.users.some((user) => normalizeUsername(user.username) === username)) return sendError(response, 409, "Такой username уже зарегистрирован");

    const password = hashPassword(body.password);
    const user = {
      id: makeId("user"),
      name: String(body.name || username).trim().slice(0, 40),
      username: displayUsername(username),
      avatar: String(body.avatar || "A1").slice(0, 8),
      status: "онлайн",
      bio: "Пользователь CryptoBroker",
      isOnline: true,
      lastSeen: new Date().toISOString(),
      passwordHash: password.hash,
      passwordSalt: password.salt,
      createdAt: new Date().toISOString(),
    };
    const session = { token: makeId("session"), userId: user.id, createdAt: new Date().toISOString() };
    db.users.push(user);
    db.sessions.push(session);
    await writeDb(db);
    return send(response, 201, { token: session.token, ...stateFor(user, db) });
  }

  if (url.pathname === "/api/auth/login" && request.method === "POST") {
    const body = await parseBody(request);
    const username = normalizeUsername(body.username);
    const user = db.users.find((item) => normalizeUsername(item.username) === username);
    if (!user || !passwordsMatch(body.password || "", user)) return sendError(response, 401, "Неверный username или пароль");
    const session = { token: makeId("session"), userId: user.id, createdAt: new Date().toISOString() };
    db.sessions.push(session);
    await writeDb(db);
    return send(response, 200, { token: session.token, ...stateFor(user, db) });
  }

  const user = authUser(request, db);
  if (!user) return sendError(response, 401, "Нужна авторизация");

  if (url.pathname === "/api/auth/logout" && request.method === "POST") {
    const token = (request.headers.authorization || "").replace(/^Bearer /, "");
    db.sessions = db.sessions.filter((session) => session.token !== token);
    await writeDb(db);
    return send(response, 200, { ok: true });
  }

  if (url.pathname === "/api/state" && request.method === "GET") {
    return send(response, 200, stateFor(user, db));
  }

  if (url.pathname === "/api/users" && request.method === "GET") {
    const query = normalizeUsername(url.searchParams.get("query") || "");
    const users = db.users
      .map(publicUser)
      .filter((item) => item.id !== user.id)
      .filter((item) => !query || normalizeUsername(item.username).includes(query) || item.name.toLowerCase().includes(query))
      .slice(0, 12);
    return send(response, 200, { users });
  }

  if (url.pathname === "/api/users/me" && request.method === "PATCH") {
    const body = await parseBody(request);
    user.name = String(body.name || user.name).trim().slice(0, 40);
    user.avatar = String(body.avatar || user.avatar).slice(0, 8);
    await writeDb(db);
    return send(response, 200, stateFor(user, db));
  }

  if (url.pathname === "/api/chats/private" && request.method === "POST") {
    const body = await parseBody(request);
    const peer = db.users.find((item) => item.id === body.userId);
    if (!peer || peer.id === user.id) return sendError(response, 404, "Пользователь не найден");
    const existing = privateChatBetween(db.chats, user.id, peer.id);
    if (existing) return send(response, 200, { chat: existing, ...stateFor(user, db) });
    const chat = {
      id: makeId("chat"),
      type: "private",
      title: publicUser(peer).name,
      avatar: publicUser(peer).avatar,
      participants: [user.id, peer.id],
      lastMessageId: "",
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isArchived: false,
      isFavorite: false,
      draft: "",
      description: `Личный чат с ${peer.username}`,
    };
    db.chats.unshift(chat);
    await writeDb(db);
    return send(response, 201, { chat, ...stateFor(user, db) });
  }

  const chatMatch = url.pathname.match(/^\/api\/chats\/([^/]+)$/);
  if (chatMatch && request.method === "PATCH") {
    const chat = db.chats.find((item) => item.id === chatMatch[1] && item.participants.includes(user.id));
    if (!chat) return sendError(response, 404, "Чат не найден");
    const body = await parseBody(request);
    for (const key of ["isPinned", "isMuted", "isArchived", "isFavorite", "draft", "unreadCount"]) {
      if (key in body) chat[key] = body[key];
    }
    await writeDb(db);
    return send(response, 200, stateFor(user, db));
  }

  if (chatMatch && request.method === "DELETE") {
    const chatId = chatMatch[1];
    const chat = db.chats.find((item) => item.id === chatId && item.participants.includes(user.id));
    if (!chat) return sendError(response, 404, "Чат не найден");
    db.chats = db.chats.filter((item) => item.id !== chatId);
    db.messages = db.messages.filter((message) => message.chatId !== chatId);
    await writeDb(db);
    return send(response, 200, stateFor(user, db));
  }

  const clearMatch = url.pathname.match(/^\/api\/chats\/([^/]+)\/messages$/);
  if (clearMatch && request.method === "DELETE") {
    const chat = db.chats.find((item) => item.id === clearMatch[1] && item.participants.includes(user.id));
    if (!chat) return sendError(response, 404, "Чат не найден");
    db.messages = db.messages.filter((message) => message.chatId !== chat.id);
    chat.lastMessageId = "";
    chat.unreadCount = 0;
    await writeDb(db);
    return send(response, 200, stateFor(user, db));
  }

  if (url.pathname === "/api/messages" && request.method === "POST") {
    const body = await parseBody(request);
    const chat = db.chats.find((item) => item.id === body.chatId && item.participants.includes(user.id));
    if (!chat) return sendError(response, 404, "Чат не найден");
    const messageId = makeId("msg");
    const createdAt = new Date().toISOString();
    const plainText = String(body.text || "").trim() || "Вложение";
    const metadata = { messageId, chatId: chat.id, senderId: user.id, createdAt };
    const cryptoContainer = createCryptoContainer(plainText, metadata);
    const message = {
      id: messageId,
      chatId: chat.id,
      senderId: user.id,
      text: "",
      cryptoContainer,
      createdAt,
      type: body.type || "text",
      status: "read",
      replyToId: body.replyToId || undefined,
      attachments: Array.isArray(body.attachments) ? body.attachments : [],
      reactions: [],
    };
    db.messages.push(message);
    chat.lastMessageId = message.id;
    chat.draft = "";
    await writeDb(db);
    return send(response, 201, stateFor(user, db));
  }

  const messageMatch = url.pathname.match(/^\/api\/messages\/([^/]+)$/);
  if (messageMatch && request.method === "PATCH") {
    const body = await parseBody(request);
    const message = db.messages.find((item) => item.id === messageMatch[1]);
    const chat = message && db.chats.find((item) => item.id === message.chatId && item.participants.includes(user.id));
    if (!message || !chat || message.senderId !== user.id) return sendError(response, 404, "Сообщение не найдено");
    const text = String(body.text || message.text).trim();
    const metadata = { messageId: message.id, chatId: chat.id, senderId: user.id, createdAt: message.createdAt };
    message.text = "";
    message.cryptoContainer = createCryptoContainer(text, metadata);
    message.editedAt = new Date().toISOString();
    await writeDb(db);
    return send(response, 200, stateFor(user, db));
  }

  if (messageMatch && request.method === "DELETE") {
    const message = db.messages.find((item) => item.id === messageMatch[1]);
    const chat = message && db.chats.find((item) => item.id === message.chatId && item.participants.includes(user.id));
    if (!message || !chat || message.senderId !== user.id) return sendError(response, 404, "Сообщение не найдено");
    const deletedText = "Сообщение удалено";
    const metadata = { messageId: message.id, chatId: chat.id, senderId: user.id, createdAt: message.createdAt };
    message.text = "";
    message.cryptoContainer = createCryptoContainer(deletedText, metadata);
    message.isDeleted = true;
    message.attachments = [];
    message.reactions = [];
    await writeDb(db);
    return send(response, 200, stateFor(user, db));
  }

  const reactionMatch = url.pathname.match(/^\/api\/messages\/([^/]+)\/reactions$/);
  if (reactionMatch && request.method === "POST") {
    const body = await parseBody(request);
    const message = db.messages.find((item) => item.id === reactionMatch[1]);
    const chat = message && db.chats.find((item) => item.id === message.chatId && item.participants.includes(user.id));
    if (!message || !chat) return sendError(response, 404, "Сообщение не найдено");
    const emoji = String(body.emoji || "");
    const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
    if (existing) {
      existing.userIds = existing.userIds.includes(user.id) ? existing.userIds.filter((id) => id !== user.id) : [...existing.userIds, user.id];
    } else {
      message.reactions.push({ emoji, userIds: [user.id] });
    }
    message.reactions = message.reactions.filter((reaction) => reaction.userIds.length > 0);
    await writeDb(db);
    return send(response, 200, stateFor(user, db));
  }

  return sendError(response, 404, "Маршрут не найден");
}

createServer((request, response) => {
  route(request, response).catch((error) => {
    console.error(error);
    sendError(response, 500, "Внутренняя ошибка сервера");
  });
}).listen(PORT, () => {
  console.log(`CryptoBroker API listening on http://localhost:${PORT}`);
});
