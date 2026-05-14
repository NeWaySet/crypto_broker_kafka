import { Check, CheckCheck, Edit3, Forward, MoreHorizontal, Reply, Trash2 } from "lucide-react";
import type { Message, User } from "../types";
import { formatMessageTime } from "../utils/format";
import { Avatar } from "./Avatar";
import { ReactionPicker } from "./ReactionPicker";

interface MessageBubbleProps {
  message: Message;
  replyTo?: Message;
  sender?: User;
  own: boolean;
  selected: boolean;
  onSelect: () => void;
  onReply: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onForward: () => void;
  onReact: (emoji: string) => void;
}

export function MessageBubble({ message, replyTo, sender, own, selected, onSelect, onReply, onEdit, onDelete, onForward, onReact }: MessageBubbleProps) {
  const statusIcon = message.status === "read" ? <CheckCheck size={14} /> : message.status === "delivered" ? <CheckCheck size={14} /> : <Check size={14} />;

  return (
    <article className={`message-row ${own ? "own" : ""} ${selected ? "selected" : ""}`} onClick={onSelect}>
      {!own && <Avatar label={sender?.avatar || "U"} size="sm" online={sender?.isOnline} />}
      <div className="message-bubble">
        {message.forwardedFrom && <span className="forwarded">Переслано из {message.forwardedFrom}</span>}
        {replyTo && <div className="reply-snippet"><strong>Ответ</strong><span>{replyTo.text}</span></div>}
        {message.attachments.map((attachment) => (
          <div className={`attachment attachment-${attachment.type}`} key={attachment.id}>
            <strong>{attachment.name}</strong>
            <span>{attachment.size || attachment.duration || attachment.metadata?.place || "demo preview"}</span>
          </div>
        ))}
        <p>{message.text}</p>
        {message.reactions.length > 0 && (
          <div className="reactions">
            {message.reactions.map((reaction) => (
              <button type="button" key={reaction.emoji} onClick={(event) => { event.stopPropagation(); onReact(reaction.emoji); }}>
                {reaction.emoji} {reaction.userIds.length}
              </button>
            ))}
          </div>
        )}
        <div className="message-meta">
          {message.editedAt && <span>изменено</span>}
          <time>{formatMessageTime(message.createdAt)}</time>
          {own && statusIcon}
        </div>
        {selected && (
          <div className="message-actions" onClick={(event) => event.stopPropagation()}>
            <button type="button" aria-label="Ответить" onClick={onReply}><Reply size={15} /></button>
            {own && <button type="button" aria-label="Редактировать" onClick={onEdit}><Edit3 size={15} /></button>}
            {own && <button type="button" aria-label="Удалить" onClick={onDelete}><Trash2 size={15} /></button>}
            <button type="button" aria-label="Переслать" onClick={onForward}><Forward size={15} /></button>
            <MoreHorizontal size={15} />
            <ReactionPicker onReact={onReact} />
          </div>
        )}
      </div>
    </article>
  );
}
