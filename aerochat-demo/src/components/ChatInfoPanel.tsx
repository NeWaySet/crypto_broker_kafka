import { Bell, BellOff, FileText, Link as LinkIcon, LogOut, Search, Shield, Trash2, UserPlus, Users } from "lucide-react";
import { useMemo, useState } from "react";
import type { Chat, InfoTab, Message, User } from "../types";
import { Avatar } from "./Avatar";
import { EmptyState } from "./EmptyState";

interface ChatInfoPanelProps {
  chat: Chat;
  users: User[];
  messages: Message[];
  currentUserId: string;
  onClose: () => void;
  onUpdateChat: (chatId: string, patch: Partial<Chat>) => void;
  onClearHistory: (chatId: string) => void;
  onNotice: (text: string) => void;
}

const tabs: Array<{ id: InfoTab; label: string }> = [
  { id: "media", label: "Медиа" },
  { id: "files", label: "Файлы" },
  { id: "links", label: "Ссылки" },
  { id: "voice", label: "Голосовые" },
  { id: "members", label: "Участники" },
];

export function ChatInfoPanel({ chat, users, messages, currentUserId, onUpdateChat, onClearHistory, onNotice }: ChatInfoPanelProps) {
  const [tab, setTab] = useState<InfoTab>(chat.type === "private" ? "media" : "members");
  const participants = users.filter((user) => chat.participants.includes(user.id) && user.id !== currentUserId);
  const media = useMemo(() => messages.flatMap((message) => message.attachments.map((attachment) => ({ attachment, message }))), [messages]);

  return (
    <aside className="info-panel">
      <section className="info-hero">
        <Avatar label={chat.avatar} size="xl" online={chat.type === "private" && participants[0]?.isOnline} />
        <h2>{chat.title}</h2>
        <p>{chat.type === "private" ? participants[0]?.status || "был недавно" : chat.type === "group" ? `${chat.participants.length} участников` : chat.type === "channel" ? `${chat.participants.length * 137} подписчиков` : "личные заметки"}</p>
        <span>{chat.description}</span>
      </section>

      <div className="info-actions">
        <button type="button" onClick={() => onUpdateChat(chat.id, { isMuted: !chat.isMuted })}>{chat.isMuted ? <Bell size={17} /> : <BellOff size={17} />} {chat.isMuted ? "Включить" : "Без звука"}</button>
        <button type="button" onClick={() => onNotice("Поиск доступен в верхней панели чата")}><Search size={17} /> Поиск</button>
        <button type="button" onClick={() => onClearHistory(chat.id)}><Trash2 size={17} /> Очистить</button>
        {chat.type === "private" && <button type="button" onClick={() => onNotice("Контакт добавлен в демо-блоклист")}><Shield size={17} /> Блок</button>}
        {chat.type === "group" && <button type="button" onClick={() => onNotice("Участник добавлен только в демо-режиме")}><UserPlus size={17} /> Добавить</button>}
        {chat.type === "group" && <button type="button" onClick={() => onUpdateChat(chat.id, { isArchived: true })}><LogOut size={17} /> Выйти</button>}
      </div>

      <div className="info-tabs" role="tablist" aria-label="Вкладки информации">
        {tabs.map((item) => (
          <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="info-content">
        {tab === "members" && (
          participants.length ? (
            participants.map((user, index) => (
              <div className="member-row" key={user.id}>
                <Avatar label={user.avatar} size="sm" online={user.isOnline} />
                <span><strong>{user.name}</strong><small>{index < 2 && chat.type !== "private" ? "админ" : user.status}</small></span>
              </div>
            ))
          ) : <EmptyState title="Только вы" text="Это личное хранилище избранного." />
        )}
        {tab === "media" && (
          media.filter((item) => ["image", "video", "sticker"].includes(item.attachment.type)).length ? media.filter((item) => ["image", "video", "sticker"].includes(item.attachment.type)).map((item) => <div className="info-file" key={item.attachment.id}><FileText size={17} /> {item.attachment.name}</div>) : <EmptyState title="Медиа нет" text="Изображения и видео появятся здесь." />
        )}
        {tab === "files" && (
          media.filter((item) => item.attachment.type === "file").length ? media.filter((item) => item.attachment.type === "file").map((item) => <div className="info-file" key={item.attachment.id}><FileText size={17} /> {item.attachment.name}</div>) : <EmptyState title="Файлов нет" text="Файлы появятся после отправки вложения." />
        )}
        {tab === "links" && (
          messages.some((message) => message.text.includes("http")) ? messages.filter((message) => message.text.includes("http")).map((message) => <div className="info-file" key={message.id}><LinkIcon size={17} /> {message.text}</div>) : <EmptyState title="Ссылок нет" text="Превью ссылок появятся в этой вкладке." />
        )}
        {tab === "voice" && (
          media.filter((item) => item.attachment.type === "audio").length ? media.filter((item) => item.attachment.type === "audio").map((item) => <div className="info-file" key={item.attachment.id}><Users size={17} /> {item.attachment.name}</div>) : <EmptyState title="Голосовых нет" text="Нажми микрофон в поле ввода, чтобы создать демо-голосовое." />
        )}
      </div>
    </aside>
  );
}
