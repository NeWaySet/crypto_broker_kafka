import { Archive, LogOut, Menu, MessageSquarePlus, Moon, Search, Settings } from "lucide-react";
import { useState, type MouseEvent } from "react";
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
  userSearchResults: User[];
  onFilterChange: (filter: ChatFilter) => void;
  onQueryChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onOpenSettings: () => void;
  onCreateChat: (type: Chat["type"]) => void;
  onStartChatWithUser: (user: User) => void;
  onLogout: () => void;
  onUpdateChat: (chatId: string, patch: Partial<Chat>) => void;
  onClearHistory: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onNotice: (text: string) => void;
}

export function Sidebar(props: SidebarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [context, setContext] = useState<{ x: number; y: number; chat: Chat } | null>(null);

  function openContext(event: MouseEvent, chat: Chat) {
    event.preventDefault();
    setContext({ x: event.clientX, y: event.clientY, chat });
  }

  function askForUsernameSearch() {
    props.onQueryChange("");
    props.onNotice("Введи username в поиске, например @ivan");
    setMenuOpen(false);
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
          <span>{props.profile.username}</span>
        </div>
        <button className="icon-button" type="button" aria-label="Найти пользователя" onClick={askForUsernameSearch}>
          <MessageSquarePlus size={20} />
        </button>
      </header>

      {menuOpen && (
        <div className="main-menu">
          <button type="button" onClick={askForUsernameSearch}><Search size={16} /> Найти пользователя</button>
          <button type="button" onClick={() => props.onFilterChange("archive")}><Archive size={16} /> Архив</button>
          <button type="button" onClick={props.onOpenSettings}><Settings size={16} /> Настройки</button>
          <button type="button" onClick={() => props.onNotice("Тема меняется в настройках")}><Moon size={16} /> Тема</button>
          <button type="button" onClick={props.onLogout}><LogOut size={16} /> Выход</button>
        </div>
      )}

      <ChatSearch value={props.query} onChange={props.onQueryChange} />
      <ChatFilters active={props.filter} onChange={props.onFilterChange} />
      {props.query.trim().length >= 2 && (
        <div className="user-search-results">
          <div className="section-label">Пользователи</div>
          {props.userSearchResults.length ? (
            props.userSearchResults.map((user) => (
              <button type="button" key={user.id} className="user-result" onClick={() => props.onStartChatWithUser(user)}>
                <Avatar label={user.avatar} online={user.isOnline} />
                <span>
                  <strong>{user.name}</strong>
                  <small>{user.username}</small>
                </span>
              </button>
            ))
          ) : (
            <p className="user-search-empty">Пользователь не найден. Зарегистрируй второй аккаунт и найди его по username.</p>
          )}
        </div>
      )}
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
