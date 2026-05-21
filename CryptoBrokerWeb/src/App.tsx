import { useEffect, useMemo, useState } from "react";
import { useCallback } from "react";
import { AuthScreen } from "./components/AuthScreen";
import { MainLayout } from "./components/MainLayout";
import { SettingsModal } from "./components/SettingsModal";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { useSettings } from "./hooks/useSettings";
import type { AppState, Attachment, Chat, ChatFilter, Message, Profile, User } from "./types";
import { api } from "./utils/api";
import { loadJson, removeKeys, saveJson } from "./utils/storage";

const keys = {
  token: "cryptobroker.token.v1",
};

function normalizeUsername(value: string): string {
  return value.trim().replace(/^@+/, "").toLowerCase();
}

export default function App() {
  const [token, setToken] = useState<string>(() => loadJson<string>(keys.token, ""));
  const { settings, setSettings, toggleTheme } = useSettings();
  const [state, setState] = useState<AppState | null>(null);
  const [selectedChatId, setSelectedChatId] = useState("");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [query, setQuery] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [rightPanelOpen, setRightPanelOpen] = useState(() => window.innerWidth >= 1180);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "online" | "offline">("checking");
  const [loading, setLoading] = useState(Boolean(token));

  const profile: Profile | null = state?.user
    ? { id: state.user.id, name: state.user.name, username: state.user.username, avatar: state.user.avatar }
    : null;
  const users = state?.users || [];
  const chats = state?.chats || [];
  const messages = state?.messages || [];
  const selectedChat = chats.find((chat) => chat.id === selectedChatId && chat.participants.includes(profile?.id || "")) || null;
  const messagesById = useMemo(() => new Map(messages.map((message) => [message.id, message])), [messages]);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function applyState(nextState: AppState) {
    setState(nextState);
  }

  async function runServerAction(action: () => Promise<AppState>, success?: string) {
    if (!token) return;
    try {
      const nextState = await action();
      applyState(nextState);
      setConnectionStatus("online");
      if (success) showNotice(success);
    } catch (error) {
      setConnectionStatus("offline");
      showNotice(error instanceof Error ? error.message : "Ошибка сервера");
    }
  }

  useEffect(() => {
    if (token) saveJson(keys.token, token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const controller = new AbortController();
    api
      .state(token, controller.signal)
      .then((nextState) => {
        applyState(nextState);
        setConnectionStatus("online");
      })
      .catch((error) => {
        if ((error as Error).name === "AbortError") return;
        setConnectionStatus("offline");
        removeKeys([keys.token]);
        setToken("");
        setState(null);
      })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const controller = new AbortController();
    const timer = window.setInterval(() => {
      api
        .state(token, controller.signal)
        .then((nextState) => {
          applyState(nextState);
          setConnectionStatus("online");
        })
        .catch((error) => {
          if ((error as Error).name !== "AbortError") setConnectionStatus("offline");
        });
    }, 2500);
    return () => {
      controller.abort();
      window.clearInterval(timer);
    };
  }, [token]);

  useEffect(() => {
    const syncPanels = () => setRightPanelOpen(window.innerWidth >= 1180);
    syncPanels();
    window.addEventListener("resize", syncPanels);
    return () => window.removeEventListener("resize", syncPanels);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const firstChat = chats.find((chat) => chat.participants.includes(profile.id) && !chat.isArchived);
    if (!selectedChatId && firstChat) setSelectedChatId(firstChat.id);
    if (selectedChatId && !chats.some((chat) => chat.id === selectedChatId && chat.participants.includes(profile.id))) setSelectedChatId("");
  }, [chats, profile, selectedChatId]);

  const closeTransientUi = useCallback(() => {
    setSettingsOpen(false);
    setRightPanelOpen(false);
    setSelectedMessageId(null);
  }, []);

  const editOwnMessageFromShortcut = useCallback((messageId: string) => {
    setEditingMessageId(messageId);
  }, []);

  useKeyboardShortcuts({
    selectedMessageId,
    messages,
    currentUserId: profile?.id,
    onCloseTransientUi: closeTransientUi,
    onEditOwnMessage: editOwnMessageFromShortcut,
  });

  const visibleChats = useMemo(() => {
    if (!profile) return [];
    const lower = query.toLowerCase();
    return chats
      .filter((chat) => chat.participants.includes(profile.id))
      .filter((chat) => {
        if (filter === "archive") return chat.isArchived;
        if (chat.isArchived) return false;
        if (filter === "private" || filter === "group" || filter === "channel") return chat.type === filter;
        if (filter === "unread") return chat.unreadCount > 0;
        if (filter === "favorite") return chat.isFavorite;
        return true;
      })
      .filter((chat) => {
        const lastMessage = messagesById.get(chat.lastMessageId);
        return !lower || chat.title.toLowerCase().includes(lower) || lastMessage?.text.toLowerCase().includes(lower);
      })
      .sort((a, b) => Number(b.isPinned) - Number(a.isPinned) || new Date(messagesById.get(b.lastMessageId)?.createdAt || 0).getTime() - new Date(messagesById.get(a.lastMessageId)?.createdAt || 0).getTime());
  }, [chats, filter, messagesById, profile, query]);

  const userSearchResults = useMemo(() => {
    if (!profile || normalizeUsername(query).length < 2) return [];
    const lower = normalizeUsername(query);
    return users
      .filter((user) => user.id !== profile.id)
      .filter((user) => normalizeUsername(user.username).includes(lower) || user.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8);
  }, [profile, query, users]);

  const selectedMessages = useMemo(() => {
    return messages
      .filter((message) => message.chatId === selectedChatId)
      .filter((message) => !chatQuery || message.text.toLowerCase().includes(chatQuery.toLowerCase()))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [chatQuery, messages, selectedChatId]);

  async function login(username: string, password: string): Promise<string | null> {
    try {
      const payload = await api.login(username, password);
      setToken(payload.token);
      applyState(payload);
      setSelectedChatId("");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Ошибка входа";
    }
  }

  async function register(input: { name: string; username: string; password: string; avatar: string }): Promise<string | null> {
    try {
      const payload = await api.register(input);
      setToken(payload.token);
      applyState(payload);
      setSelectedChatId("");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Ошибка регистрации";
    }
  }

  function updateChat(chatId: string, patch: Partial<Chat>) {
    setState((previous) => previous ? { ...previous, chats: previous.chats.map((chat) => (chat.id === chatId ? { ...chat, ...patch } : chat)) } : previous);
    void runServerAction(() => api.updateChat(token, chatId, patch));
  }

  function selectChat(chatId: string) {
    setSelectedChatId(chatId);
    setRightPanelOpen(window.innerWidth >= 1180);
    setSelectedMessageId(null);
    if (chatId) updateChat(chatId, { unreadCount: 0 });
  }

  async function startChatWithUser(peer: User) {
    if (!token) return;
    try {
      const response = await api.createPrivateChat(token, peer.id);
      applyState(response);
      setSelectedChatId(response.chat.id);
      setQuery("");
    } catch (error) {
      showNotice(error instanceof Error ? error.message : "Не удалось создать чат");
    }
  }

  function updateDraft(chatId: string, draft: string) {
    updateChat(chatId, { draft });
  }

  async function sendMessage(text: string, attachments: Attachment[] = []) {
    if (!token || !profile || !selectedChat || (!text.trim() && attachments.length === 0)) return;
    if (editingMessageId) {
      await editMessage(editingMessageId, text);
      setEditingMessageId(null);
      return;
    }
    const type = attachments[0]?.type === "audio" ? "audio" : attachments[0]?.type === "image" ? "image" : attachments[0]?.type === "video" ? "video" : attachments[0]?.type === "poll" ? "poll" : attachments.length ? "file" : "text";
    await runServerAction(() =>
      api.sendMessage(token, {
        chatId: selectedChat.id,
        text: text.trim() || (attachments[0]?.type === "audio" ? "Голосовое сообщение" : "Вложение"),
        type,
        replyToId: replyToId || undefined,
        attachments,
      }),
    );
    setReplyToId(null);
  }

  async function editMessage(messageId: string, text: string) {
    await runServerAction(() => api.editMessage(token, messageId, text), "Сообщение изменено");
  }

  function deleteMessage(messageId: string) {
    void runServerAction(() => api.deleteMessage(token, messageId));
    setSelectedMessageId(null);
  }

  function reactToMessage(messageId: string, emoji: string) {
    void runServerAction(() => api.reactToMessage(token, messageId, emoji));
  }

  function clearHistory(chatId: string) {
    void runServerAction(() => api.clearHistory(token, chatId), "История очищена");
  }

  function deleteChat(chatId: string) {
    void runServerAction(() => api.deleteChat(token, chatId));
    if (selectedChatId === chatId) setSelectedChatId("");
  }

  function forwardMessage(message: Message) {
    showNotice(`Пересылка подготовлена: ${message.text.slice(0, 40)}`);
  }

  function updateProfile(nextProfile: Profile) {
    setState((previous) => previous ? { ...previous, user: { ...previous.user, name: nextProfile.name, avatar: nextProfile.avatar } } : previous);
    void runServerAction(() => api.updateProfile(token, nextProfile));
  }

  async function logout() {
    if (token) {
      await api.logout(token).catch(() => undefined);
    }
    removeKeys([keys.token]);
    setToken("");
    setState(null);
    setSelectedChatId("");
  }

  if (loading) {
    return <main className="login-screen"><div className="login-panel"><div className="brand-mark">CB</div><h1>CryptoBroker</h1><p>Подключение к серверу...</p></div></main>;
  }

  if (!profile) {
    return <AuthScreen settings={settings} onSettingsChange={setSettings} onLogin={login} onRegister={register} />;
  }

  return (
    <>
      <MainLayout
        profile={profile}
        settings={settings}
        users={users}
        userSearchResults={userSearchResults}
        chats={visibleChats}
        allChats={chats}
        messages={selectedMessages}
        allMessages={messages}
        messagesById={messagesById}
        selectedChat={selectedChat}
        selectedChatId={selectedChatId}
        currentUserId={profile.id}
        filter={filter}
        query={query}
        chatQuery={chatQuery}
        rightPanelOpen={rightPanelOpen}
        selectedMessageId={selectedMessageId}
        replyToId={replyToId}
        editingMessageId={editingMessageId}
        isTyping={false}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        onChatQueryChange={setChatQuery}
        onSelectChat={selectChat}
        onStartChatWithUser={startChatWithUser}
        onToggleRightPanel={() => setRightPanelOpen((value) => !value)}
        onOpenSettings={() => setSettingsOpen(true)}
        onToggleTheme={toggleTheme}
        onCreateChat={() => showNotice("Введите username в поиске, чтобы создать чат")}
        onLogout={logout}
        onSend={sendMessage}
        onDraftChange={updateDraft}
        onSelectMessage={setSelectedMessageId}
        onReply={setReplyToId}
        onEdit={setEditingMessageId}
        onCancelEdit={() => setEditingMessageId(null)}
        onCancelReply={() => setReplyToId(null)}
        onDeleteMessage={deleteMessage}
        onForward={forwardMessage}
        onReact={reactToMessage}
        onUpdateChat={updateChat}
        onClearHistory={clearHistory}
        onDeleteChat={deleteChat}
        onNotice={showNotice}
      />
      {settingsOpen && <SettingsModal profile={profile} settings={settings} onProfileChange={updateProfile} onSettingsChange={setSettings} onClose={() => setSettingsOpen(false)} onLogout={logout} />}
      <div className={`connection-status ${connectionStatus}`} role="status">
        {connectionStatus === "online" ? "Сервер доступен" : connectionStatus === "offline" ? "Нет соединения" : "Проверка сервера"}
      </div>
      {notice && <div className="toast" role="status">{notice}</div>}
    </>
  );
}
