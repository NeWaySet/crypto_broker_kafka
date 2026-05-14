import { ArrowLeft, Info, MoreVertical, Phone, Search } from "lucide-react";
import type { Chat, User } from "../types";
import { Avatar } from "./Avatar";

interface ChatHeaderProps {
  chat: Chat;
  users: User[];
  currentUserId: string;
  isTyping: boolean;
  chatQuery: string;
  onBack: () => void;
  onQueryChange: (value: string) => void;
  onToggleInfo: () => void;
  onNotice: (text: string) => void;
}

export function ChatHeader({ chat, users, currentUserId, isTyping, chatQuery, onBack, onQueryChange, onToggleInfo, onNotice }: ChatHeaderProps) {
  const peer = chat.type === "private" ? users.find((user) => chat.participants.includes(user.id) && user.id !== currentUserId) : undefined;
  const status = isTyping ? "печатает..." : chat.type === "group" ? `${chat.participants.length} участников` : chat.type === "channel" ? "канал" : peer?.isOnline ? "онлайн" : peer?.status || "был недавно";

  return (
    <header className="chat-header">
      <button className="icon-button mobile-only" type="button" aria-label="Назад к списку чатов" onClick={onBack}>
        <ArrowLeft size={20} />
      </button>
      <Avatar label={chat.avatar} online={peer?.isOnline} />
      <div className="chat-title-block">
        <strong>{chat.title}</strong>
        <span>{status}</span>
      </div>
      <label className="chat-inner-search">
        <Search size={15} />
        <input value={chatQuery} onChange={(event) => onQueryChange(event.target.value)} placeholder="Поиск" aria-label="Поиск внутри чата" />
      </label>
      <button className="icon-button" type="button" aria-label="Демо-звонок" onClick={() => onNotice("Демо-звонок: соединение не создается")}>
        <Phone size={19} />
      </button>
      <button className="icon-button" type="button" aria-label="Открыть информацию о чате" onClick={onToggleInfo}>
        <Info size={19} />
      </button>
      <button className="icon-button" type="button" aria-label="Меню чата" onClick={() => onNotice("Меню чата открывается через правую панель и список чатов")}>
        <MoreVertical size={19} />
      </button>
    </header>
  );
}
