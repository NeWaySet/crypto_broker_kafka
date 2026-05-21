import type { AppState, Attachment, Chat, Profile } from "../types";

export interface AuthPayload extends AppState {
  token: string;
}

const jsonHeaders = {
  "content-type": "application/json",
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...jsonHeaders,
      ...(options.headers || {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(payload.error || "Ошибка сервера", response.status);
  }
  return payload as T;
}

export const api = {
  register(input: { name: string; username: string; password: string; avatar: string }) {
    return request<AuthPayload>("/api/auth/register", { method: "POST", body: JSON.stringify(input) });
  },
  login(username: string, password: string) {
    return request<AuthPayload>("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) });
  },
  logout(token: string) {
    return request<{ ok: true }>("/api/auth/logout", { method: "POST" }, token);
  },
  state(token: string, signal?: AbortSignal) {
    return request<AppState>("/api/state", { signal }, token);
  },
  updateProfile(token: string, profile: Profile) {
    return request<AppState>("/api/users/me", { method: "PATCH", body: JSON.stringify(profile) }, token);
  },
  createPrivateChat(token: string, userId: string) {
    return request<AppState & { chat: Chat }>("/api/chats/private", { method: "POST", body: JSON.stringify({ userId }) }, token);
  },
  updateChat(token: string, chatId: string, patch: Partial<Chat>) {
    return request<AppState>(`/api/chats/${chatId}`, { method: "PATCH", body: JSON.stringify(patch) }, token);
  },
  deleteChat(token: string, chatId: string) {
    return request<AppState>(`/api/chats/${chatId}`, { method: "DELETE" }, token);
  },
  clearHistory(token: string, chatId: string) {
    return request<AppState>(`/api/chats/${chatId}/messages`, { method: "DELETE" }, token);
  },
  sendMessage(token: string, input: { chatId: string; text: string; type: string; replyToId?: string; attachments: Attachment[] }) {
    return request<AppState>("/api/messages", { method: "POST", body: JSON.stringify(input) }, token);
  },
  editMessage(token: string, messageId: string, text: string) {
    return request<AppState>(`/api/messages/${messageId}`, { method: "PATCH", body: JSON.stringify({ text }) }, token);
  },
  deleteMessage(token: string, messageId: string) {
    return request<AppState>(`/api/messages/${messageId}`, { method: "DELETE" }, token);
  },
  reactToMessage(token: string, messageId: string, emoji: string) {
    return request<AppState>(`/api/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }, token);
  },
};
