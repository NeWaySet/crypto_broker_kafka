import type { Chat, Message, User } from "../types";
import { EmptyState } from "./EmptyState";
import { ChatListItem } from "./ChatListItem";

interface ChatListProps {
  chats: Chat[];
  messagesById: Map<string, Message>;
  selectedChatId: string;
  currentUserId: string;
  users: User[];
  onSelectChat: (chatId: string) => void;
  onContextMenu: (event: React.MouseEvent, chat: Chat) => void;
}

export function ChatList({ chats, messagesById, selectedChatId, currentUserId, users, onSelectChat, onContextMenu }: ChatListProps) {
  if (!chats.length) {
    return <EmptyState title="Ничего не найдено" text="Попробуй изменить поисковый запрос или фильтр." />;
  }

  return (
    <div className="chat-list">
      {chats.map((chat) => (
        <ChatListItem
          key={chat.id}
          chat={chat}
          lastMessage={messagesById.get(chat.lastMessageId)}
          active={chat.id === selectedChatId}
          currentUserId={currentUserId}
          users={users}
          onSelect={() => onSelectChat(chat.id)}
          onContextMenu={onContextMenu}
        />
      ))}
    </div>
  );
}
