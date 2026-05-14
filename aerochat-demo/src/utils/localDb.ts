import type { AuthAccount, Chat, LocalDatabase, User } from "../types";
import { makeId } from "./format";
import { loadJson, saveJson } from "./storage";

const DB_KEY = "aerochat.localDb.v2";

export function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export function displayUsername(value: string): string {
  const normalized = normalizeUsername(value);
  return normalized ? `@${normalized}` : "";
}

// Demo hash for localStorage only. In a real app this must be server-side password hashing.
export function hashPassword(username: string, password: string): string {
  const input = `${normalizeUsername(username)}:${password}`;
  let hash = 2166136261;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}

export function emptyDatabase(): LocalDatabase {
  return {
    users: [],
    chats: [],
    messages: [],
  };
}

export function loadDatabase(): LocalDatabase {
  const db = loadJson<LocalDatabase>(DB_KEY, emptyDatabase());
  return {
    users: Array.isArray(db.users) ? db.users : [],
    chats: Array.isArray(db.chats) ? db.chats : [],
    messages: Array.isArray(db.messages) ? db.messages : [],
  };
}

export function saveDatabase(db: LocalDatabase): void {
  saveJson(DB_KEY, db);
}

export function publicUsers(users: AuthAccount[]): User[] {
  return users.map(({ passwordHash: _passwordHash, createdAt: _createdAt, ...user }) => user);
}

export function findAccount(db: LocalDatabase, username: string): AuthAccount | undefined {
  const normalized = normalizeUsername(username);
  return db.users.find((user) => normalizeUsername(user.username) === normalized);
}

export function registerAccount(db: LocalDatabase, input: { name: string; username: string; password: string; avatar: string }): { db: LocalDatabase; account: AuthAccount } {
  const username = normalizeUsername(input.username);
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    throw new Error("Username: 3-24 символа, латиница, цифры и _");
  }
  if (input.password.length < 4) {
    throw new Error("Пароль должен быть минимум 4 символа");
  }
  if (findAccount(db, username)) {
    throw new Error("Такой username уже зарегистрирован");
  }

  const account: AuthAccount = {
    id: makeId("user"),
    name: input.name.trim() || username,
    username: displayUsername(username),
    avatar: input.avatar,
    status: "онлайн",
    bio: "Пользователь AeroChat",
    isOnline: true,
    lastSeen: new Date().toISOString(),
    passwordHash: hashPassword(username, input.password),
    createdAt: new Date().toISOString(),
  };

  return {
    db: { ...db, users: [...db.users, account] },
    account,
  };
}

export function authenticate(db: LocalDatabase, username: string, password: string): AuthAccount {
  const account = findAccount(db, username);
  if (!account || account.passwordHash !== hashPassword(username, password)) {
    throw new Error("Неверный username или пароль");
  }
  return account;
}

export function privateChatBetween(chats: Chat[], firstUserId: string, secondUserId: string): Chat | undefined {
  return chats.find(
    (chat) =>
      chat.type === "private" &&
      chat.participants.length === 2 &&
      chat.participants.includes(firstUserId) &&
      chat.participants.includes(secondUserId),
  );
}

export function createPrivateChat(currentUser: User, peer: User): Chat {
  return {
    id: makeId("chat"),
    type: "private",
    title: peer.name,
    avatar: peer.avatar,
    participants: [currentUser.id, peer.id],
    lastMessageId: "",
    unreadCount: 0,
    isPinned: false,
    isMuted: false,
    isArchived: false,
    isFavorite: false,
    draft: "",
    description: `Личный чат с ${peer.username}`,
  };
}
