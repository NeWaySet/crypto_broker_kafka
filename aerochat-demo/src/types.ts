export type ChatType = "private" | "group" | "channel" | "saved";
export type ChatFilter = "all" | "private" | "group" | "channel" | "unread" | "favorite" | "archive";
export type MessageType = "text" | "image" | "video" | "file" | "audio" | "sticker" | "poll" | "link";
export type MessageStatus = "sending" | "sent" | "delivered" | "read";
export type AttachmentType = "image" | "video" | "file" | "audio" | "sticker" | "poll" | "location";
export type ThemeMode = "light" | "dark" | "system";
export type FontSize = "small" | "normal" | "large";
export type InfoTab = "media" | "files" | "links" | "voice" | "members";

export interface User {
  id: string;
  name: string;
  username: string;
  avatar: string;
  status: string;
  bio: string;
  isOnline: boolean;
  lastSeen: string;
}

export interface Attachment {
  id: string;
  type: AttachmentType;
  name: string;
  size?: string;
  url?: string;
  previewUrl?: string;
  duration?: string;
  metadata?: Record<string, string | number | boolean>;
}

export interface Reaction {
  emoji: string;
  userIds: string[];
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text: string;
  createdAt: string;
  editedAt?: string;
  type: MessageType;
  status: MessageStatus;
  replyToId?: string;
  forwardedFrom?: string;
  attachments: Attachment[];
  reactions: Reaction[];
  isDeleted?: boolean;
}

export interface Chat {
  id: string;
  type: ChatType;
  title: string;
  avatar: string;
  participants: string[];
  lastMessageId: string;
  unreadCount: number;
  isPinned: boolean;
  isMuted: boolean;
  isArchived: boolean;
  isFavorite: boolean;
  draft: string;
  pinnedMessageId?: string;
  description: string;
}

export interface Settings {
  theme: ThemeMode;
  accentColor: string;
  fontSize: FontSize;
  chatBackground: string;
  notificationsEnabled: boolean;
  privacyMode: boolean;
  language: "ru" | "en";
}

export interface DemoProfile {
  id: string;
  name: string;
  username: string;
  avatar: string;
}

export interface AppData {
  users: User[];
  chats: Chat[];
  messages: Message[];
}
