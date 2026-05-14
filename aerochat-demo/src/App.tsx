import { useEffect, useMemo, useState } from "react";
import { DemoLogin } from "./components/DemoLogin";
import { MainLayout } from "./components/MainLayout";
import { SettingsModal } from "./components/SettingsModal";
import { defaultSettings } from "./data/mockData";
import type { Attachment, Chat, ChatFilter, DemoProfile, LocalDatabase, Message, Settings, User } from "./types";
import { makeId } from "./utils/format";
import {
  authenticate,
  createPrivateChat,
  emptyDatabase,
  loadDatabase,
  normalizeUsername,
  privateChatBetween,
  publicUsers,
  registerAccount,
  saveDatabase,
} from "./utils/localDb";
import { loadJson, removeKeys, saveJson } from "./utils/storage";

const keys = {
  session: "aerochat.session.v2",
  settings: "aerochat.settings.v2",
};

export default function App() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => loadJson<string | null>(keys.session, null));
  const [settings, setSettings] = useState<Settings>(() => loadJson<Settings>(keys.settings, defaultSettings));
  const [db, setDb] = useState<LocalDatabase>(() => loadDatabase());
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

  const currentAccount = db.users.find((user) => user.id === sessionUserId) || null;
  const profile: DemoProfile | null = currentAccount
    ? { id: currentAccount.id, name: currentAccount.name, username: currentAccount.username, avatar: currentAccount.avatar }
    : null;
  const users = useMemo(() => publicUsers(db.users), [db.users]);
  const selectedChat = db.chats.find((chat) => chat.id === selectedChatId && chat.participants.includes(profile?.id || "")) || null;
  const messagesById = useMemo(() => new Map(db.messages.map((message) => [message.id, message])), [db.messages]);

  useEffect(() => {
    saveDatabase(db);
  }, [db]);

  useEffect(() => {
    saveJson(keys.settings, settings);
    document.documentElement.dataset.theme = settings.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : settings.theme;
    document.documentElement.dataset.fontSize = settings.fontSize;
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    document.documentElement.dataset.wallpaper = settings.chatBackground;
  }, [settings]);

  useEffect(() => {
    if (sessionUserId) saveJson(keys.session, sessionUserId);
  }, [sessionUserId]);

  useEffect(() => {
    const syncPanels = () => setRightPanelOpen(window.innerWidth >= 1180);
    syncPanels();
    window.addEventListener("resize", syncPanels);
    return () => window.removeEventListener("resize", syncPanels);
  }, []);

  useEffect(() => {
    if (!profile) return;
    const firstChat = db.chats.find((chat) => chat.participants.includes(profile.id) && !chat.isArchived);
    if (!selectedChatId && firstChat) setSelectedChatId(firstChat.id);
    if (selectedChatId && !db.chats.some((chat) => chat.id === selectedChatId && chat.participants.includes(profile.id))) setSelectedChatId("");
  }, [db.chats, profile, selectedChatId]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const command = event.ctrlKey || event.metaKey;
      if (command && event.key.toLowerCase() === "k") {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("[data-chat-search]")?.focus();
      }
      if (event.key === "Escape") {
        setSettingsOpen(false);
        setRightPanelOpen(false);
        setSelectedMessageId(null);
      }
      if (command && event.key.toLowerCase() === "e" && selectedMessageId) {
        const message = db.messages.find((item) => item.id === selectedMessageId);
        if (message && message.senderId === profile?.id) setEditingMessageId(message.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [db.messages, profile?.id, selectedMessageId]);

  const visibleChats = useMemo(() => {
    if (!profile) return [];
    const lower = query.toLowerCase();
    return db.chats
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
  }, [db.chats, filter, messagesById, profile, query]);

  const userSearchResults = useMemo(() => {
    if (!profile || normalizeUsername(query).length < 2) return [];
    const lower = normalizeUsername(query);
    return users
      .filter((user) => user.id !== profile.id)
      .filter((user) => normalizeUsername(user.username).includes(lower) || user.name.toLowerCase().includes(query.toLowerCase()))
      .slice(0, 8);
  }, [profile, query, users]);

  const selectedMessages = useMemo(() => {
    return db.messages
      .filter((message) => message.chatId === selectedChatId)
      .filter((message) => !chatQuery || message.text.toLowerCase().includes(chatQuery.toLowerCase()))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [chatQuery, db.messages, selectedChatId]);

  function commitDb(nextDb: LocalDatabase) {
    setDb(nextDb);
    saveDatabase(nextDb);
  }

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function login(username: string, password: string): string | null {
    try {
      const account = authenticate(db, username, password);
      setSessionUserId(account.id);
      setSelectedChatId("");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Ошибка входа";
    }
  }

  function register(input: { name: string; username: string; password: string; avatar: string }): string | null {
    try {
      const result = registerAccount(db, input);
      commitDb(result.db);
      setSessionUserId(result.account.id);
      setSelectedChatId("");
      return null;
    } catch (error) {
      return error instanceof Error ? error.message : "Ошибка регистрации";
    }
  }

  function updateChat(chatId: string, patch: Partial<Chat>) {
    setDb((prev) => ({ ...prev, chats: prev.chats.map((chat) => (chat.id === chatId ? { ...chat, ...patch } : chat)) }));
  }

  function selectChat(chatId: string) {
    setSelectedChatId(chatId);
    setRightPanelOpen(window.innerWidth >= 1180);
    setSelectedMessageId(null);
    updateChat(chatId, { unreadCount: 0 });
  }

  function startChatWithUser(peer: User) {
    if (!profile) return;
    const existing = privateChatBetween(db.chats, profile.id, peer.id);
    if (existing) {
      selectChat(existing.id);
      return;
    }
    const chat = createPrivateChat({ ...profile, status: "онлайн", bio: "", isOnline: true, lastSeen: new Date().toISOString() }, peer);
    setDb((prev) => ({ ...prev, chats: [chat, ...prev.chats] }));
    setSelectedChatId(chat.id);
    setQuery("");
  }

  function updateDraft(chatId: string, draft: string) {
    updateChat(chatId, { draft });
  }

  function sendMessage(text: string, attachments: Attachment[] = []) {
    if (!profile || !selectedChat || (!text.trim() && attachments.length === 0)) return;
    if (editingMessageId) {
      editMessage(editingMessageId, text);
      setEditingMessageId(null);
      return;
    }
    const message: Message = {
      id: makeId("msg"),
      chatId: selectedChat.id,
      senderId: profile.id,
      text: text.trim() || (attachments[0]?.type === "audio" ? "Голосовое сообщение" : "Вложение"),
      createdAt: new Date().toISOString(),
      type: attachments[0]?.type === "audio" ? "audio" : attachments[0]?.type === "image" ? "image" : attachments[0]?.type === "video" ? "video" : attachments[0]?.type === "poll" ? "poll" : attachments.length ? "file" : "text",
      status: "read",
      replyToId: replyToId || undefined,
      attachments,
      reactions: [],
    };
    setDb((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
      chats: prev.chats.map((chat) => (chat.id === selectedChat.id ? { ...chat, draft: "", lastMessageId: message.id } : chat)),
    }));
    setReplyToId(null);
  }

  function sendVoice() {
    sendMessage("", [{ id: makeId("att"), type: "audio", name: "voice-demo.ogg", duration: "0:12", size: "96 KB" }]);
  }

  function editMessage(messageId: string, text: string) {
    setDb((prev) => ({ ...prev, messages: prev.messages.map((message) => (message.id === messageId ? { ...message, text, editedAt: new Date().toISOString() } : message)) }));
    showNotice("Сообщение изменено");
  }

  function deleteMessage(messageId: string) {
    setDb((prev) => ({ ...prev, messages: prev.messages.map((message) => (message.id === messageId ? { ...message, text: "Сообщение удалено", isDeleted: true, attachments: [], reactions: [] } : message)) }));
    setSelectedMessageId(null);
  }

  function reactToMessage(messageId: string, emoji: string) {
    if (!profile) return;
    setDb((prev) => ({
      ...prev,
      messages: prev.messages.map((message) => {
        if (message.id !== messageId) return message;
        const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
        const reactions = existing
          ? message.reactions.map((reaction) => (reaction.emoji === emoji ? { ...reaction, userIds: reaction.userIds.includes(profile.id) ? reaction.userIds.filter((id) => id !== profile.id) : [...reaction.userIds, profile.id] } : reaction))
          : [...message.reactions, { emoji, userIds: [profile.id] }];
        return { ...message, reactions: reactions.filter((reaction) => reaction.userIds.length > 0) };
      }),
    }));
  }

  function clearHistory(chatId: string) {
    setDb((prev) => ({ ...prev, messages: prev.messages.filter((message) => message.chatId !== chatId), chats: prev.chats.map((chat) => (chat.id === chatId ? { ...chat, lastMessageId: "", unreadCount: 0 } : chat)) }));
    showNotice("История очищена");
  }

  function deleteChat(chatId: string) {
    setDb((prev) => ({ ...prev, messages: prev.messages.filter((message) => message.chatId !== chatId), chats: prev.chats.filter((chat) => chat.id !== chatId) }));
    if (selectedChatId === chatId) setSelectedChatId("");
  }

  function forwardMessage(message: Message) {
    showNotice(`Пересылка подготовлена: ${message.text.slice(0, 40)}`);
  }

  function updateProfile(nextProfile: DemoProfile) {
    if (!profile) return;
    setDb((prev) => ({
      ...prev,
      users: prev.users.map((user) => (user.id === profile.id ? { ...user, name: nextProfile.name, avatar: nextProfile.avatar, username: nextProfile.username } : user)),
      chats: prev.chats.map((chat) => {
        if (!chat.participants.includes(profile.id)) return chat;
        const peerId = chat.participants.find((id) => id !== profile.id);
        const peer = prev.users.find((user) => user.id === peerId);
        return peer ? { ...chat, title: peer.name, avatar: peer.avatar } : chat;
      }),
    }));
  }

  function logout() {
    removeKeys([keys.session]);
    setSessionUserId(null);
    setSelectedChatId("");
  }

  function resetLocalDb() {
    commitDb(emptyDatabase());
    logout();
  }

  if (!profile) {
    return <DemoLogin settings={settings} onSettingsChange={setSettings} onLogin={login} onRegister={register} />;
  }

  return (
    <>
      <MainLayout
        profile={profile}
        settings={settings}
        users={users}
        userSearchResults={userSearchResults}
        chats={visibleChats}
        allChats={db.chats}
        messages={selectedMessages}
        allMessages={db.messages}
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
        onCreateChat={() => showNotice("Введите username в поиске, чтобы создать чат")}
        onLogout={logout}
        onSend={sendMessage}
        onSendVoice={sendVoice}
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
      {settingsOpen && <SettingsModal profile={profile} settings={settings} onProfileChange={updateProfile} onSettingsChange={setSettings} onClose={() => setSettingsOpen(false)} onLogout={logout} onResetLocalDb={resetLocalDb} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </>
  );
}
