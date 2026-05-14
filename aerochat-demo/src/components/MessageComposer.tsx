import { Mic, Send, Smile, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Attachment, Chat, Message } from "../types";
import { AttachmentMenu } from "./AttachmentMenu";
import { EmojiPicker } from "./EmojiPicker";

interface MessageComposerProps {
  chat: Chat;
  replyTo?: Message;
  editingMessage?: Message;
  onSend: (text: string, attachments: Attachment[]) => void;
  onSendVoice: () => void;
  onDraftChange: (chatId: string, value: string) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

export function MessageComposer({ chat, replyTo, editingMessage, onSend, onSendVoice, onDraftChange, onCancelReply, onCancelEdit }: MessageComposerProps) {
  const [text, setText] = useState(editingMessage?.text || chat.draft || "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [attachmentOpen, setAttachmentOpen] = useState(false);
  const [attachment, setAttachment] = useState<Attachment | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSend = text.trim().length > 0 || Boolean(attachment);

  useEffect(() => {
    setText(editingMessage?.text || chat.draft || "");
  }, [chat.id, chat.draft, editingMessage]);

  const placeholder = useMemo(() => {
    if (editingMessage) return "Редактирование сообщения";
    if (replyTo) return "Ответить сообщением";
    return chat.type === "channel" ? "Опубликовать запись..." : "Написать сообщение...";
  }, [chat.type, editingMessage, replyTo]);

  function submit() {
    const currentText = textareaRef.current?.value ?? text;
    if (!currentText.trim() && !attachment) {
      onSendVoice();
      return;
    }
    onSend(currentText, attachment ? [attachment] : []);
    setText("");
    setAttachment(null);
    onDraftChange(chat.id, "");
  }

  function changeText(value: string) {
    setText(value);
    if (!editingMessage) onDraftChange(chat.id, value);
  }

  return (
    <footer className="composer">
      {replyTo && (
        <div className="composer-mode">
          <strong>Ответ</strong>
          <span>{replyTo.text}</span>
          <button type="button" aria-label="Отменить ответ" onClick={onCancelReply}><X size={16} /></button>
        </div>
      )}
      {editingMessage && (
        <div className="composer-mode edit">
          <strong>Редактирование</strong>
          <span>{editingMessage.text}</span>
          <button type="button" aria-label="Отменить редактирование" onClick={onCancelEdit}><X size={16} /></button>
        </div>
      )}
      {attachment && (
        <div className="attachment-preview">
          <span>{attachment.name}</span>
          <small>{attachment.size || attachment.duration || attachment.metadata?.place || attachment.type}</small>
          <button type="button" aria-label="Удалить вложение" onClick={() => setAttachment(null)}><X size={16} /></button>
        </div>
      )}
      <div className="composer-row">
        <button className="icon-button" type="button" aria-label="Открыть эмодзи" onClick={() => setEmojiOpen((value) => !value)}>
          <Smile size={20} />
        </button>
        <AttachmentMenu
          open={attachmentOpen}
          onToggle={() => setAttachmentOpen((value) => !value)}
          onSelect={(nextAttachment) => {
            setAttachment(nextAttachment);
            setAttachmentOpen(false);
          }}
        />
        <textarea
          ref={textareaRef}
          value={text}
          placeholder={placeholder}
          aria-label="Поле ввода сообщения"
          rows={1}
          onChange={(event) => changeText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              submit();
            }
          }}
        />
        <button className="send-button" type="button" aria-label={canSend ? "Отправить сообщение" : "Записать голосовое сообщение"} onClick={submit}>
          {canSend ? <Send size={20} /> : <Mic size={20} />}
        </button>
      </div>
      {emojiOpen && <EmojiPicker onPick={(emoji) => changeText(`${text}${emoji}`)} />}
    </footer>
  );
}
