import { Archive, LogOut, Menu, MessageSquarePlus, Moon, Settings, Star, Users, VolumeX } from "lucide-react";
import { useState } from "react";
import type { Chat, ChatFilter, DemoProfile, Message, User } from "../types";
import { Avatar } from "./Avatar";
import { ChatFilters } from "./ChatFilters";
import { ChatList } from "./ChatList";
import { ChatSearch } from "./ChatSearch";
import { ContextMenu } from "./ContextMenu";

interface SidebarProps {
  profile: DemoProfile;
  chats: Chat[];
  messagesById: Map<string, Message>;
  selectedChatId: string;
  currentUserId: string;
  filter: ChatFilter;
  query: string;
  users: User[];
  onFilterChange: (filter: ChatFilter) => void;
  onQueryChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onOpenSettings: () => void;
  onCreateChat: (type: Chat["type"]) => void;
  onLogout: () => void;
  onUpdateChat: (chatId: string, patch: Partial<Chat>) => void;
  onClearHistory: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onNotice: (text: string) => void;
}

export function Sidebar(props: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number; chat: Chat } | null>(null);

  function openContext(event: React.MouseEvent, chat: Chat) {
    event.preventDefault();
    setContext({ x: event.clientX, y: event.clientY, chat });
  }

  return (
    <aside className="sidebar">
      <header className="sidebar-header">
        <button className="icon-button" type="button" aria-label="Открыть главное меню" onClick={() => setMenuOpen((value) => !value)}>
          <Menu size={20} />
        </button>
        <Avatar label={props.profile.avatar} online />
        <div className="app-title">
          <strong>AeroChat</strong>
          <span>demo messenger</span>
        </div>
        <button className="icon-button" type="button" aria-label="Создать новый чат" onClick={() => props.onCreateChat("private")}>
          <MessageSquarePlus size={20} />
        </button>
      </header>

      {menuOpen && (
        <div className="main-menu">
          <button type="button" onClick={() => props.onCreateChat("private")}><MessageSquarePlus size={16} /> Новый чат</button>
          <button type="button" onClick={() => props.onCreateChat("group")}><Users size={16} /> Создать группу</button>
          <button type="button" onClick={() => props.onCreateChat("channel")}><VolumeX size={16} /> Создать канал</button>
          <button type="button" onClick={() => props.onFilterChange("favorite")}><Star size={16} /> Избранное</button>
          <button type="button" onClick={() => props.onFilterChange("archive")}><Archive size={16} /> Архив</button>
          <button type="button" onClick={props.onOpenSettings}><Settings size={16} /> Настройки</button>
          <button type="button" onClick={() => props.onNotice("Тема меняется в настройках")}><Moon size={16} /> Тема</button>
          <button type="button" onClick={props.onLogout}><LogOut size={16} /> Выход</button>
        </div>
      )}

      <ChatSearch value={props.query} onChange={props.onQueryChange} />
      <ChatFilters active={props.filter} onChange={props.onFilterChange} />
      <ChatList
        chats={props.chats}
        messagesById={props.messagesById}
        selectedChatId={props.selectedChatId}
        currentUserId={props.currentUserId}
        users={props.users}
        onSelectChat={props.onSelectChat}
        onContextMenu={openContext}
      />

      {context && (
        <ContextMenu
          x={context.x}
          y={context.y}
          onClose={() => setContext(null)}
          items={[
            { label: context.chat.isPinned ? "Открепить" : "Закрепить", onClick: () => props.onUpdateChat(context.chat.id, { isPinned: !context.chat.isPinned }) },
            { label: context.chat.isArchived ? "Вернуть из архива" : "Добавить в архив", onClick: () => props.onUpdateChat(context.chat.id, { isArchived: !context.chat.isArchived }) },
            { label: context.chat.isMuted ? "Включить уведомления" : "Отключить уведомления", onClick: () => props.onUpdateChat(context.chat.id, { isMuted: !context.chat.isMuted }) },
            { label: "Отметить как прочитанное", onClick: () => props.onUpdateChat(context.chat.id, { unreadCount: 0 }) },
            { label: "Очистить историю", onClick: () => props.onClearHistory(context.chat.id) },
            { label: "Удалить чат", danger: true, onClick: () => props.onDeleteChat(context.chat.id) },
          ]}
        />
      )}
    </aside>
  );
}
