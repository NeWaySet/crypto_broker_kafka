import type { Attachment, Chat, Message, User } from "../types";
import { ChatHeader } from "./ChatHeader";
import { EmptyState } from "./EmptyState";
import { MessageComposer } from "./MessageComposer";
import { MessageList } from "./MessageList";

interface ChatWindowProps {
  chat: Chat | null;
  users: User[];
  messages: Message[];
  messagesById: Map<string, Message>;
  currentUserId: string;
  chatQuery: string;
  selectedMessageId: string | null;
  replyToId: string | null;
  editingMessageId: string | null;
  isTyping: boolean;
  onBack: () => void;
  onChatQueryChange: (value: string) => void;
  onToggleInfo: () => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onDraftChange: (chatId: string, value: string) => void;
  onSelectMessage: (id: string | null) => void;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onDeleteMessage: (id: string) => void;
  onForward: (message: Message) => void;
  onReact: (id: string, emoji: string) => void;
  onNotice: (text: string) => void;
}

export function ChatWindow(props: ChatWindowProps) {
  if (!props.chat) {
    return <section className="chat-window"><EmptyState title="Чат не выбран" text="Найдите пользователя по username и начните защищенную переписку." /></section>;
  }

  const pinned = props.chat.pinnedMessageId ? props.messagesById.get(props.chat.pinnedMessageId) : undefined;

  return (
    <section className="chat-window">
      <ChatHeader
        chat={props.chat}
        users={props.users}
        currentUserId={props.currentUserId}
        isTyping={props.isTyping}
        chatQuery={props.chatQuery}
        onBack={props.onBack}
        onQueryChange={props.onChatQueryChange}
        onToggleInfo={props.onToggleInfo}
        onNotice={props.onNotice}
      />
      {pinned && <button className="pinned-message" type="button" onClick={() => props.onSelectMessage(pinned.id)}><strong>Закреплено</strong><span>{pinned.text}</span></button>}
      {props.isTyping && <div className="typing-line">печатает...</div>}
      <MessageList
        messages={props.messages}
        messagesById={props.messagesById}
        users={props.users}
        currentUserId={props.currentUserId}
        selectedMessageId={props.selectedMessageId}
        onSelectMessage={props.onSelectMessage}
        onReply={props.onReply}
        onEdit={props.onEdit}
        onDelete={props.onDeleteMessage}
        onForward={props.onForward}
        onReact={props.onReact}
      />
      <button className="new-messages" type="button" onClick={() => props.onNotice("Новые сообщения уже внизу списка")}>Новые сообщения</button>
      <MessageComposer
        chat={props.chat}
        replyTo={props.replyToId ? props.messagesById.get(props.replyToId) : undefined}
        editingMessage={props.editingMessageId ? props.messagesById.get(props.editingMessageId) : undefined}
        onSend={props.onSend}
        onDraftChange={props.onDraftChange}
        onCancelReply={props.onCancelReply}
        onCancelEdit={props.onCancelEdit}
      />
    </section>
  );
}
