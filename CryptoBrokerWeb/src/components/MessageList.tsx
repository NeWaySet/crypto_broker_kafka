import type { Message, User } from "../types";
import { dateLabel } from "../utils/format";
import { EmptyState } from "./EmptyState";
import { MessageBubble } from "./MessageBubble";

interface MessageListProps {
  messages: Message[];
  messagesById: Map<string, Message>;
  users: User[];
  currentUserId: string;
  selectedMessageId: string | null;
  onSelectMessage: (id: string | null) => void;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
  onForward: (message: Message) => void;
  onReact: (id: string, emoji: string) => void;
}

export function MessageList({ messages, messagesById, users, currentUserId, selectedMessageId, onSelectMessage, onReply, onEdit, onDelete, onForward, onReact }: MessageListProps) {
  if (!messages.length) {
    return <EmptyState title="Сообщений нет" text="Напишите первое сообщение или найдите другой чат." />;
  }

  let currentLabel = "";
  return (
    <div className="message-list">
      {messages.map((message) => {
        const label = dateLabel(message.createdAt);
        const showLabel = label !== currentLabel;
        currentLabel = label;
        return (
          <div key={message.id}>
            {showLabel && <div className="date-pill">{label}</div>}
            <MessageBubble
              message={message}
              replyTo={message.replyToId ? messagesById.get(message.replyToId) : undefined}
              sender={users.find((user) => user.id === message.senderId)}
              own={message.senderId === currentUserId}
              selected={message.id === selectedMessageId}
              onSelect={() => onSelectMessage(message.id === selectedMessageId ? null : message.id)}
              onReply={() => onReply(message.id)}
              onEdit={() => onEdit(message.id)}
              onDelete={() => onDelete(message.id)}
              onForward={() => onForward(message)}
              onReact={(emoji) => onReact(message.id, emoji)}
            />
          </div>
        );
      })}
    </div>
  );
}
