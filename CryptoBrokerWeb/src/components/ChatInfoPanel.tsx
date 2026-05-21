import { FileText, Link as LinkIcon, Users, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { Chat, InfoTab, Message, User } from "../types";
import { Avatar } from "./Avatar";
import { EmptyState } from "./EmptyState";

interface ChatInfoPanelProps {
  chat: Chat;
  users: User[];
  messages: Message[];
  selectedMessage?: Message;
  currentUserId: string;
  onClose: () => void;
  onUpdateChat: (chatId: string, patch: Partial<Chat>) => void;
  onClearHistory: (chatId: string) => void;
  onNotice: (text: string) => void;
}

const tabs: Array<{ id: InfoTab; label: string }> = [
  { id: "crypto", label: "Крипто" },
  { id: "media", label: "Медиа" },
  { id: "files", label: "Файлы" },
  { id: "links", label: "Ссылки" },
  { id: "voice", label: "Голосовые" },
  { id: "members", label: "Участники" },
];

export function ChatInfoPanel({ chat, users, messages, selectedMessage, currentUserId, onClose }: ChatInfoPanelProps) {
  const [tab, setTab] = useState<InfoTab>("crypto");
  const participants = users.filter((user) => chat.participants.includes(user.id) && user.id !== currentUserId);
  const media = useMemo(() => messages.flatMap((message) => message.attachments.map((attachment) => ({ attachment, message }))), [messages]);
  const cryptoMessage = selectedMessage?.cryptoContainer ? selectedMessage : [...messages].reverse().find((message) => message.cryptoContainer);

  return (
    <aside className="info-panel">
      <button className="info-close icon-button" type="button" aria-label="Закрыть информацию о чате" onClick={onClose}>
        <X size={18} />
      </button>
      <section className="info-hero">
        <Avatar label={chat.avatar} size="xl" online={chat.type === "private" && participants[0]?.isOnline} />
        <h2>{chat.title}</h2>
        <p>{chat.type === "private" ? participants[0]?.status || "был недавно" : chat.type === "group" ? `${chat.participants.length} участников` : chat.type === "channel" ? `${chat.participants.length * 137} подписчиков` : "личные заметки"}</p>
        <span>{chat.description}</span>
      </section>

      <div className="info-tabs" role="tablist" aria-label="Вкладки информации">
        {tabs.map((item) => (
          <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="info-content">
        {tab === "crypto" && (
          cryptoMessage?.cryptoContainer ? (
            <div className="crypto-panel">
              <div>
                <span>algorithm</span>
                <strong>{cryptoMessage.cryptoContainer.algorithm}</strong>
              </div>
              <div>
                <span>messageId</span>
                <code>{cryptoMessage.cryptoContainer.metadata.messageId}</code>
              </div>
              <div>
                <span>iv</span>
                <code>{cryptoMessage.cryptoContainer.iv}</code>
              </div>
              <div>
                <span>ciphertext</span>
                <code>{cryptoMessage.cryptoContainer.ciphertext}</code>
              </div>
              <div>
                <span>authTag</span>
                <code>{cryptoMessage.cryptoContainer.authTag}</code>
              </div>
            </div>
          ) : <EmptyState title="Криптоконтейнеров нет" text="Отправьте сообщение, и здесь появятся iv, ciphertext и authTag." />
        )}
        {tab === "members" && (
          participants.length ? (
            participants.map((user, index) => (
              <div className="member-row" key={user.id}>
                <Avatar label={user.avatar} size="sm" online={user.isOnline} />
                <span><strong>{user.name}</strong><small>{index < 2 && chat.type !== "private" ? "админ" : user.status}</small></span>
              </div>
            ))
          ) : <EmptyState title="Только вы" text="В личном чате участник появится после выбора пользователя." />
        )}
        {tab === "media" && (
          media.filter((item) => ["image", "video", "sticker"].includes(item.attachment.type)).length ? media.filter((item) => ["image", "video", "sticker"].includes(item.attachment.type)).map((item) => <div className="info-file" key={item.attachment.id}><FileText size={17} /> {item.attachment.name}</div>) : <EmptyState title="Медиа нет" text="Изображения и видео появятся здесь." />
        )}
        {tab === "files" && (
          media.filter((item) => item.attachment.type === "file").length ? media.filter((item) => item.attachment.type === "file").map((item) => <div className="info-file" key={item.attachment.id}><FileText size={17} /> {item.attachment.name}</div>) : <EmptyState title="Файлов нет" text="Файлы появятся после отправки вложения." />
        )}
        {tab === "links" && (
          messages.some((message) => message.text.includes("http")) ? messages.filter((message) => message.text.includes("http")).map((message) => <div className="info-file" key={message.id}><LinkIcon size={17} /> {message.text}</div>) : <EmptyState title="Ссылок нет" text="Ссылки из сообщений появятся в этой вкладке." />
        )}
        {tab === "voice" && (
          media.filter((item) => item.attachment.type === "audio").length ? media.filter((item) => item.attachment.type === "audio").map((item) => <div className="info-file" key={item.attachment.id}><Users size={17} /> {item.attachment.name}</div>) : <EmptyState title="Голосовых нет" text="Голосовые сообщения появятся после отправки аудио." />
        )}
      </div>
    </aside>
  );
}
