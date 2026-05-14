import { File, Image, MapPin, Paperclip, UserRound, Video, Vote } from "lucide-react";
import type { Attachment, AttachmentType } from "../types";
import { makeId } from "../utils/format";

const options: Array<{ type: AttachmentType; label: string; icon: React.ReactNode }> = [
  { type: "image", label: "Фото или видео", icon: <Image size={16} /> },
  { type: "file", label: "Файл", icon: <File size={16} /> },
  { type: "sticker", label: "Контакт", icon: <UserRound size={16} /> },
  { type: "poll", label: "Опрос", icon: <Vote size={16} /> },
  { type: "location", label: "Геолокация", icon: <MapPin size={16} /> },
  { type: "video", label: "Видео-заглушка", icon: <Video size={16} /> },
];

interface AttachmentMenuProps {
  open: boolean;
  onToggle: () => void;
  onSelect: (attachment: Attachment) => void;
}

export function AttachmentMenu({ open, onToggle, onSelect }: AttachmentMenuProps) {
  function createAttachment(type: AttachmentType, label: string): Attachment {
    return {
      id: makeId("att"),
      type,
      name: type === "poll" ? "Опрос: выбрать вариант интерфейса" : `${label}.demo`,
      size: type === "image" ? "840 KB" : type === "file" ? "2.1 MB" : undefined,
      duration: type === "video" ? "0:35" : undefined,
      metadata: type === "location" ? { place: "Демо-локация" } : undefined,
    };
  }

  return (
    <div className="attachment-wrapper">
      <button className="icon-button" type="button" aria-label="Открыть меню вложений" onClick={onToggle}>
        <Paperclip size={20} />
      </button>
      {open && (
        <div className="attachment-menu">
          {options.map((option) => (
            <button type="button" key={option.label} onClick={() => onSelect(createAttachment(option.type, option.label))}>
              {option.icon}
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
