import { Search } from "lucide-react";

interface ChatSearchProps {
  value: string;
  onChange: (value: string) => void;
}

export function ChatSearch({ value, onChange }: ChatSearchProps) {
  return (
    <label className="search-field">
      <Search size={17} />
      <input data-chat-search value={value} onChange={(event) => onChange(event.target.value)} placeholder="Поиск по чатам и сообщениям" aria-label="Поиск по чатам" />
    </label>
  );
}
