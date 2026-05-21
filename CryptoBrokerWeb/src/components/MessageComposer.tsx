import { Smile, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Attachment, Chat, Message } from "../types";
import { EmojiPicker } from "./EmojiPicker";

interface MessageComposerProps {
  chat: Chat;
  replyTo?: Message;
  editingMessage?: Message;
  onSend: (text: string, attachments: Attachment[]) => void;
  onDraftChange: (chatId: string, value: string) => void;
  onCancelReply: () => void;
  onCancelEdit: () => void;
}

export function MessageComposer({ chat, replyTo, editingMessage, onSend, onDraftChange, onCancelReply, onCancelEdit }: MessageComposerProps) {
  const [text, setText] = useState(editingMessage?.text || chat.draft || "");
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

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
    if (!currentText.trim()) return;
    onSend(currentText, []);
    setText("");
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
      <div className="composer-row">
        <button className="icon-button" type="button" aria-label="Открыть эмодзи" onClick={() => setEmojiOpen((value) => !value)}>
          <Smile size={20} />
        </button>
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
      </div>
      {emojiOpen && <EmojiPicker onPick={(emoji) => changeText(`${text}${emoji}`)} />}
    </footer>
  );
}
