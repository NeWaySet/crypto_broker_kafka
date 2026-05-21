import { BellOff, Pin, Volume2 } from "lucide-react";
import type { Chat, Message, User } from "../types";
import { formatChatTime } from "../utils/format";
import { Avatar } from "./Avatar";

interface ChatListItemProps {
  chat: Chat;
  lastMessage?: Message;
  active: boolean;
  currentUserId: string;
  users: User[];
  onSelect: () => void;
  onContextMenu: (event: React.MouseEvent, chat: Chat) => void;
}

export function ChatListItem({ chat, lastMessage, active, currentUserId, users, onSelect, onContextMenu }: ChatListItemProps) {
  const peer = chat.type === "private" ? users.find((user) => chat.participants.includes(user.id) && user.id !== currentUserId) : undefined;
  const lastPrefix = lastMessage?.senderId === currentUserId ? "Вы: " : "";
  const lastText = chat.draft ? `Черновик: ${chat.draft}` : lastMessage?.isDeleted ? "Сообщение удалено" : lastMessage?.text || "Нет сообщений";

  return (
    <button type="button" className={`chat-card ${active ? "active" : ""}`} onClick={onSelect} onContextMenu={(event) => onContextMenu(event, chat)}>
      <Avatar label={chat.avatar} online={peer?.isOnline} />
      <span className="chat-card-body">
        <span className="chat-card-top">
          <strong>{chat.title}</strong>
          <span>{lastMessage ? formatChatTime(lastMessage.createdAt) : ""}</span>
        </span>
        <span className="chat-card-bottom">
          <span className={chat.draft ? "draft" : ""}>{chat.draft ? lastText : `${lastPrefix}${lastText}`}</span>
          <span className="chat-icons">
            {chat.isPinned && <Pin size={13} />}
            {chat.isMuted && <BellOff size={13} />}
            {!chat.isMuted && chat.unreadCount > 0 && <Volume2 size={13} />}
            {chat.unreadCount > 0 && <em>{chat.unreadCount}</em>}
          </span>
        </span>
      </span>
    </button>
  );
}
