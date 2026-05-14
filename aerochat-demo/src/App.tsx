import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "./components/MainLayout";
import { DemoLogin } from "./components/DemoLogin";
import { SettingsModal } from "./components/SettingsModal";
import { createMockData, defaultSettings } from "./data/mockData";
import type { AppData, Attachment, Chat, ChatFilter, DemoProfile, Message, Settings } from "./types";
import { loadJson, removeKeys, saveJson } from "./utils/storage";
import { makeId } from "./utils/format";

const keys = {
  profile: "aerochat.profile",
  settings: "aerochat.settings",
  data: "aerochat.data",
};

const autoReplies = [
  "Принял, сейчас посмотрю.",
  "Да, звучит нормально. Можно оставить так.",
  "Супер, я добавил это в список.",
  "Через пару минут вернусь с ответом.",
  "Окей, хорошая мысль.",
];

function initialData(): AppData {
  return loadJson<AppData>(keys.data, createMockData());
}

export default function App() {
  const [profile, setProfile] = useState<DemoProfile | null>(() => loadJson<DemoProfile | null>(keys.profile, null));
  const [settings, setSettings] = useState<Settings>(() => loadJson<Settings>(keys.settings, defaultSettings));
  const [data, setData] = useState<AppData>(initialData);
  const [selectedChatId, setSelectedChatId] = useState<string>(() => data.chats.find((chat) => !chat.isArchived)?.id || data.chats[0]?.id || "");
  const [filter, setFilter] = useState<ChatFilter>("all");
  const [query, setQuery] = useState("");
  const [chatQuery, setChatQuery] = useState("");
  const [rightPanelOpen, setRightPanelOpen] = useState(() => window.innerWidth >= 1180);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [replyToId, setReplyToId] = useState<string | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [typingChats, setTypingChats] = useState<Record<string, boolean>>({});
  const [notice, setNotice] = useState("");

  const currentUserId = profile?.id || "me";
  const selectedChat = data.chats.find((chat) => chat.id === selectedChatId) || null;

  useEffect(() => {
    saveJson(keys.settings, settings);
    document.documentElement.dataset.theme = settings.theme === "system" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : settings.theme;
    document.documentElement.dataset.fontSize = settings.fontSize;
    document.documentElement.style.setProperty("--accent", settings.accentColor);
    document.documentElement.dataset.wallpaper = settings.chatBackground;
  }, [settings]);

  useEffect(() => {
    saveJson(keys.data, data);
  }, [data]);

  useEffect(() => {
    if (profile) saveJson(keys.profile, profile);
  }, [profile]);

  useEffect(() => {
    const syncPanels = () => setRightPanelOpen(window.innerWidth >= 1180);
    syncPanels();
    window.addEventListener("resize", syncPanels);
    return () => window.removeEventListener("resize", syncPanels);
  }, []);

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
        const message = data.messages.find((item) => item.id === selectedMessageId);
        if (message?.senderId === currentUserId) setEditingMessageId(message.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentUserId, data.messages, selectedMessageId]);

  const messagesById = useMemo(() => new Map(data.messages.map((message) => [message.id, message])), [data.messages]);

  const selectedMessages = useMemo(() => {
    return data.messages
      .filter((message) => message.chatId === selectedChatId)
      .filter((message) => !chatQuery || message.text.toLowerCase().includes(chatQuery.toLowerCase()))
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [chatQuery, data.messages, selectedChatId]);

  const filteredChats = useMemo(() => {
    const lower = query.toLowerCase();
    return data.chats
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
  }, [data.chats, filter, messagesById, query]);

  function showNotice(text: string) {
    setNotice(text);
    window.setTimeout(() => setNotice(""), 2200);
  }

  function updateChat(chatId: string, patch: Partial<Chat>) {
    setData((prev) => ({ ...prev, chats: prev.chats.map((chat) => (chat.id === chatId ? { ...chat, ...patch } : chat)) }));
  }

  function selectChat(chatId: string) {
    setSelectedChatId(chatId);
    setRightPanelOpen(window.innerWidth >= 1180);
    setSelectedMessageId(null);
    updateChat(chatId, { unreadCount: 0 });
  }

  function updateDraft(chatId: string, draft: string) {
    updateChat(chatId, { draft });
  }

  function sendMessage(text: string, attachments: Attachment[] = []) {
    if (!selectedChat || (!text.trim() && attachments.length === 0)) return;
    if (editingMessageId) {
      editMessage(editingMessageId, text);
      setEditingMessageId(null);
      return;
    }
    const message: Message = {
      id: makeId("msg"),
      chatId: selectedChat.id,
      senderId: currentUserId,
      text: text.trim() || (attachments[0]?.type === "audio" ? "Голосовое сообщение" : "Вложение"),
      createdAt: new Date().toISOString(),
      type: attachments[0]?.type === "audio" ? "audio" : attachments[0]?.type === "image" ? "image" : attachments[0]?.type === "video" ? "video" : attachments[0]?.type === "poll" ? "poll" : attachments.length ? "file" : "text",
      status: "sending",
      replyToId: replyToId || undefined,
      attachments,
      reactions: [],
    };
    setData((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
      chats: prev.chats.map((chat) => (chat.id === selectedChat.id ? { ...chat, draft: "", lastMessageId: message.id } : chat)),
    }));
    setReplyToId(null);
    window.setTimeout(() => setMessageStatus(message.id, "delivered"), 600);
    window.setTimeout(() => setMessageStatus(message.id, "read"), 1300);
    scheduleAutoReply(selectedChat);
  }

  function sendVoice() {
    sendMessage("", [{ id: makeId("att"), type: "audio", name: "voice-demo.ogg", duration: "0:12", size: "96 KB" }]);
  }

  function setMessageStatus(messageId: string, status: Message["status"]) {
    setData((prev) => ({ ...prev, messages: prev.messages.map((message) => (message.id === messageId ? { ...message, status } : message)) }));
  }

  function scheduleAutoReply(chat: Chat) {
    if (chat.type === "channel" || chat.type === "saved") return;
    setTypingChats((prev) => ({ ...prev, [chat.id]: true }));
    window.setTimeout(() => {
      const senderId = chat.participants.find((id) => id !== currentUserId) || "u1";
      const reply: Message = {
        id: makeId("msg"),
        chatId: chat.id,
        senderId,
        text: autoReplies[Math.floor(Math.random() * autoReplies.length)],
        createdAt: new Date().toISOString(),
        type: "text",
        status: "read",
        attachments: [],
        reactions: [],
      };
      setTypingChats((prev) => ({ ...prev, [chat.id]: false }));
      setData((prev) => ({
        ...prev,
        messages: [...prev.messages, reply],
        chats: prev.chats.map((item) => (item.id === chat.id ? { ...item, lastMessageId: reply.id, unreadCount: item.id === selectedChatId ? 0 : item.unreadCount + 1 } : item)),
      }));
    }, 2000 + Math.random() * 2000);
  }

  function editMessage(messageId: string, text: string) {
    setData((prev) => ({ ...prev, messages: prev.messages.map((message) => (message.id === messageId ? { ...message, text, editedAt: new Date().toISOString() } : message)) }));
    showNotice("Сообщение изменено");
  }

  function deleteMessage(messageId: string) {
    setData((prev) => ({ ...prev, messages: prev.messages.map((message) => (message.id === messageId ? { ...message, text: "Сообщение удалено", isDeleted: true, attachments: [], reactions: [] } : message)) }));
    setSelectedMessageId(null);
  }

  function reactToMessage(messageId: string, emoji: string) {
    setData((prev) => ({
      ...prev,
      messages: prev.messages.map((message) => {
        if (message.id !== messageId) return message;
        const existing = message.reactions.find((reaction) => reaction.emoji === emoji);
        const reactions = existing
          ? message.reactions.map((reaction) => (reaction.emoji === emoji ? { ...reaction, userIds: reaction.userIds.includes(currentUserId) ? reaction.userIds.filter((id) => id !== currentUserId) : [...reaction.userIds, currentUserId] } : reaction))
          : [...message.reactions, { emoji, userIds: [currentUserId] }];
        return { ...message, reactions: reactions.filter((reaction) => reaction.userIds.length > 0) };
      }),
    }));
  }

  function clearHistory(chatId: string) {
    setData((prev) => ({ ...prev, messages: prev.messages.filter((message) => message.chatId !== chatId), chats: prev.chats.map((chat) => (chat.id === chatId ? { ...chat, lastMessageId: "", unreadCount: 0 } : chat)) }));
    showNotice("История очищена");
  }

  function deleteChat(chatId: string) {
    setData((prev) => ({ ...prev, messages: prev.messages.filter((message) => message.chatId !== chatId), chats: prev.chats.filter((chat) => chat.id !== chatId) }));
    if (selectedChatId === chatId) setSelectedChatId(data.chats.find((chat) => chat.id !== chatId)?.id || "");
  }

  function forwardMessage(message: Message) {
    const saved = data.chats.find((chat) => chat.type === "saved");
    if (!saved) return;
    const forwarded: Message = {
      ...message,
      id: makeId("msg"),
      chatId: saved.id,
      createdAt: new Date().toISOString(),
      forwardedFrom: selectedChat?.title || "чат",
      status: "read",
    };
    setData((prev) => ({ ...prev, messages: [...prev.messages, forwarded], chats: prev.chats.map((chat) => (chat.id === saved.id ? { ...chat, lastMessageId: forwarded.id, isFavorite: true } : chat)) }));
    showNotice("Сообщение переслано в Избранное");
  }

  function createDemoChat(type: Chat["type"]) {
    const id = makeId("chat");
    const title = type === "group" ? "Новая группа" : type === "channel" ? "Новый канал" : "Новый контакт";
    const chat: Chat = {
      id,
      type,
      title,
      avatar: type === "group" ? "G1" : type === "channel" ? "C3" : "N1",
      participants: type === "private" ? ["me", "u1"] : ["me", "u1", "u2", "u3"],
      lastMessageId: "",
      unreadCount: 0,
      isPinned: false,
      isMuted: false,
      isArchived: false,
      isFavorite: false,
      draft: "",
      description: "Демо-чат создан локально.",
    };
    setData((prev) => ({ ...prev, chats: [chat, ...prev.chats] }));
    setSelectedChatId(id);
  }

  function logout() {
    removeKeys([keys.profile, keys.settings, keys.data]);
    setProfile(null);
    setSettings(defaultSettings);
    setData(createMockData());
  }

  if (!profile) {
    return <DemoLogin settings={settings} onSettingsChange={setSettings} onLogin={setProfile} />;
  }

  return (
    <>
      <MainLayout
        profile={profile}
        settings={settings}
        users={data.users}
        chats={filteredChats}
        allChats={data.chats}
        messages={selectedMessages}
        allMessages={data.messages}
        messagesById={messagesById}
        selectedChat={selectedChat}
        selectedChatId={selectedChatId}
        currentUserId={currentUserId}
        filter={filter}
        query={query}
        chatQuery={chatQuery}
        rightPanelOpen={rightPanelOpen}
        selectedMessageId={selectedMessageId}
        replyToId={replyToId}
        editingMessageId={editingMessageId}
        isTyping={Boolean(selectedChat && typingChats[selectedChat.id])}
        onFilterChange={setFilter}
        onQueryChange={setQuery}
        onChatQueryChange={setChatQuery}
        onSelectChat={selectChat}
        onToggleRightPanel={() => setRightPanelOpen((value) => !value)}
        onOpenSettings={() => setSettingsOpen(true)}
        onCreateChat={createDemoChat}
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
      {settingsOpen && <SettingsModal profile={profile} settings={settings} onProfileChange={setProfile} onSettingsChange={setSettings} onClose={() => setSettingsOpen(false)} onLogout={logout} />}
      {notice && <div className="toast" role="status">{notice}</div>}
    </>
  );
}
