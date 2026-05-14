import type { Attachment, Chat, ChatFilter, DemoProfile, Message, Settings, User } from "../types";
import { Sidebar } from "./Sidebar";
import { ChatWindow } from "./ChatWindow";
import { ChatInfoPanel } from "./ChatInfoPanel";

interface MainLayoutProps {
  profile: DemoProfile;
  settings: Settings;
  users: User[];
  userSearchResults: User[];
  chats: Chat[];
  allChats: Chat[];
  messages: Message[];
  allMessages: Message[];
  messagesById: Map<string, Message>;
  selectedChat: Chat | null;
  selectedChatId: string;
  currentUserId: string;
  filter: ChatFilter;
  query: string;
  chatQuery: string;
  rightPanelOpen: boolean;
  selectedMessageId: string | null;
  replyToId: string | null;
  editingMessageId: string | null;
  isTyping: boolean;
  onFilterChange: (filter: ChatFilter) => void;
  onQueryChange: (value: string) => void;
  onChatQueryChange: (value: string) => void;
  onSelectChat: (chatId: string) => void;
  onToggleRightPanel: () => void;
  onOpenSettings: () => void;
  onCreateChat: (type: Chat["type"]) => void;
  onStartChatWithUser: (user: User) => void;
  onLogout: () => void;
  onSend: (text: string, attachments: Attachment[]) => void;
  onSendVoice: () => void;
  onDraftChange: (chatId: string, value: string) => void;
  onSelectMessage: (id: string | null) => void;
  onReply: (id: string) => void;
  onEdit: (id: string) => void;
  onCancelEdit: () => void;
  onCancelReply: () => void;
  onDeleteMessage: (id: string) => void;
  onForward: (message: Message) => void;
  onReact: (id: string, emoji: string) => void;
  onUpdateChat: (chatId: string, patch: Partial<Chat>) => void;
  onClearHistory: (chatId: string) => void;
  onDeleteChat: (chatId: string) => void;
  onNotice: (text: string) => void;
}

export function MainLayout(props: MainLayoutProps) {
  const infoMessages = props.allMessages.filter((message) => message.chatId === props.selectedChatId);

  return (
    <main className={`app-shell ${props.selectedChat ? "has-chat" : ""} ${props.rightPanelOpen ? "has-info" : ""}`}>
      <Sidebar
        profile={props.profile}
        chats={props.chats}
        messagesById={props.messagesById}
        selectedChatId={props.selectedChatId}
        currentUserId={props.currentUserId}
        filter={props.filter}
        query={props.query}
        users={props.users}
        userSearchResults={props.userSearchResults}
        onFilterChange={props.onFilterChange}
        onQueryChange={props.onQueryChange}
        onSelectChat={props.onSelectChat}
        onOpenSettings={props.onOpenSettings}
        onCreateChat={props.onCreateChat}
        onStartChatWithUser={props.onStartChatWithUser}
        onLogout={props.onLogout}
        onUpdateChat={props.onUpdateChat}
        onClearHistory={props.onClearHistory}
        onDeleteChat={props.onDeleteChat}
        onNotice={props.onNotice}
      />
      <ChatWindow
        chat={props.selectedChat}
        users={props.users}
        messages={props.messages}
        messagesById={props.messagesById}
        currentUserId={props.currentUserId}
        chatQuery={props.chatQuery}
        selectedMessageId={props.selectedMessageId}
        replyToId={props.replyToId}
        editingMessageId={props.editingMessageId}
        isTyping={props.isTyping}
        onBack={() => props.onSelectChat("")}
        onChatQueryChange={props.onChatQueryChange}
        onToggleInfo={props.onToggleRightPanel}
        onSend={props.onSend}
        onSendVoice={props.onSendVoice}
        onDraftChange={props.onDraftChange}
        onSelectMessage={props.onSelectMessage}
        onReply={props.onReply}
        onEdit={props.onEdit}
        onCancelEdit={props.onCancelEdit}
        onCancelReply={props.onCancelReply}
        onDeleteMessage={props.onDeleteMessage}
        onForward={props.onForward}
        onReact={props.onReact}
        onNotice={props.onNotice}
      />
      {props.selectedChat && props.rightPanelOpen && (
        <ChatInfoPanel
          chat={props.selectedChat}
          users={props.users}
          messages={infoMessages}
          currentUserId={props.currentUserId}
          onClose={props.onToggleRightPanel}
          onUpdateChat={props.onUpdateChat}
          onClearHistory={props.onClearHistory}
          onNotice={props.onNotice}
        />
      )}
    </main>
  );
}
