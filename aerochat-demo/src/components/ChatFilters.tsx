import type { ChatFilter } from "../types";

const filters: Array<{ id: ChatFilter; label: string }> = [
  { id: "all", label: "Все" },
  { id: "private", label: "Личные" },
  { id: "group", label: "Группы" },
  { id: "channel", label: "Каналы" },
  { id: "unread", label: "Непрочитанные" },
  { id: "favorite", label: "Избранное" },
  { id: "archive", label: "Архив" },
];

interface ChatFiltersProps {
  active: ChatFilter;
  onChange: (filter: ChatFilter) => void;
}

export function ChatFilters({ active, onChange }: ChatFiltersProps) {
  return (
    <div className="filters" role="tablist" aria-label="Фильтры чатов">
      {filters.map((filter) => (
        <button type="button" role="tab" aria-selected={filter.id === active} key={filter.id} className={filter.id === active ? "active" : ""} onClick={() => onChange(filter.id)}>
          {filter.label}
        </button>
      ))}
    </div>
  );
}
