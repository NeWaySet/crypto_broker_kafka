import type { AppData, Attachment, Chat, Message, MessageType, Settings, User } from "../types";

export const demoAvatars = ["A1", "N2", "P3", "R4", "S5", "M6", "K7", "V8"];

export const defaultSettings: Settings = {
  theme: "light",
  accentColor: "#229ED9",
  fontSize: "normal",
  chatBackground: "soft",
  notificationsEnabled: true,
  privacyMode: false,
  language: "ru",
};

const names = [
  ["u1", "Арина Волкова", "arina", "A1", true, "Product designer"],
  ["u2", "Илья Морозов", "ilya", "N2", true, "Backend developer"],
  ["u3", "Мария Соколова", "maria", "P3", false, "Project manager"],
  ["u4", "Денис Ковалев", "denis", "R4", false, "DevOps engineer"],
  ["u5", "Ника Белова", "nika", "S5", true, "QA analyst"],
  ["u6", "Роман Орлов", "roman", "M6", false, "Security lead"],
  ["u7", "Кира Лебедева", "kira", "K7", true, "UX writer"],
  ["u8", "Вадим Егоров", "vadim", "V8", false, "Frontend engineer"],
  ["u9", "Олег Титов", "oleg", "A1", false, "Data engineer"],
  ["u10", "Саша Ким", "sasha", "N2", true, "Analyst"],
  ["u11", "Лена Фомина", "lena", "P3", false, "HR partner"],
  ["u12", "Тимур Громов", "timur", "R4", true, "Architect"],
  ["u13", "Яна Медведева", "yana", "S5", false, "Support"],
  ["u14", "Павел Миронов", "pavel", "M6", false, "Finance"],
  ["u15", "Катя Новикова", "katya", "K7", true, "Marketing"],
  ["u16", "Глеб Антонов", "gleb", "V8", false, "Mobile engineer"],
  ["u17", "Алла Романова", "alla", "A1", true, "Content editor"],
  ["u18", "Игорь Захаров", "igor", "N2", false, "SRE"],
  ["u19", "Вера Алексеева", "vera", "P3", true, "Researcher"],
  ["u20", "Максим Чернов", "max", "R4", false, "Legal"],
];

const chatBlueprints: Array<{
  id: string;
  type: Chat["type"];
  title: string;
  avatar: string;
  participants: string[];
  unread: number;
  pinned?: boolean;
  muted?: boolean;
  archived?: boolean;
  favorite?: boolean;
  draft?: string;
  description: string;
}> = [
  { id: "c1", type: "private", title: "Арина Волкова", avatar: "A1", participants: ["me", "u1"], unread: 3, pinned: true, favorite: true, description: "Обсуждение макетов и быстрые рабочие заметки." },
  { id: "c2", type: "group", title: "Проект Aero", avatar: "A2", participants: ["me", "u1", "u2", "u3", "u4", "u5", "u12"], unread: 12, pinned: true, description: "Рабочая группа по демо-мессенджеру." },
  { id: "c3", type: "channel", title: "Tech Brief", avatar: "T1", participants: ["u6", "u8", "u9", "u18"], unread: 6, muted: true, description: "Короткие технические обновления и ссылки." },
  { id: "c4", type: "private", title: "Илья Морозов", avatar: "N2", participants: ["me", "u2"], unread: 0, draft: "Потом допишу про Kafka", description: "Диалог с backend-разработчиком." },
  { id: "c5", type: "saved", title: "Избранное", avatar: "★", participants: ["me"], unread: 0, favorite: true, description: "Личные заметки, файлы и ссылки." },
  { id: "c6", type: "group", title: "Design Review", avatar: "D1", participants: ["me", "u1", "u7", "u15", "u17"], unread: 1, description: "Ревью интерфейсов и текстов." },
  { id: "c7", type: "private", title: "Ника Белова", avatar: "S5", participants: ["me", "u5"], unread: 0, favorite: true, description: "QA и сценарии проверки." },
  { id: "c8", type: "channel", title: "Security Notes", avatar: "S2", participants: ["u6", "u18", "u20"], unread: 4, pinned: true, description: "Заметки по безопасной разработке." },
  { id: "c9", type: "private", title: "Роман Орлов", avatar: "M6", participants: ["me", "u6"], unread: 0, muted: true, description: "Разговоры про криптографию и политики." },
  { id: "c10", type: "group", title: "Frontend Guild", avatar: "F1", participants: ["me", "u8", "u16", "u19"], unread: 2, description: "Компоненты, CSS и производительность." },
  { id: "c11", type: "private", title: "Кира Лебедева", avatar: "K7", participants: ["me", "u7"], unread: 0, description: "Тексты интерфейса." },
  { id: "c12", type: "channel", title: "Campus News", avatar: "C1", participants: ["u11", "u14", "u17"], unread: 0, archived: true, description: "Учебные объявления и расписание." },
  { id: "c13", type: "group", title: "Kafka Lab", avatar: "K1", participants: ["me", "u2", "u4", "u6", "u9", "u18"], unread: 5, description: "Лабораторная работа с Kafka и Docker." },
  { id: "c14", type: "private", title: "Саша Ким", avatar: "N2", participants: ["me", "u10"], unread: 0, archived: true, description: "Аналитика и графики." },
  { id: "c15", type: "private", title: "Яна Медведева", avatar: "S5", participants: ["me", "u13"], unread: 1, description: "Support и обратная связь." },
  { id: "c16", type: "group", title: "Cyberimmune Team", avatar: "C2", participants: ["me", "u6", "u12", "u18", "u20"], unread: 7, pinned: true, description: "Команда по кибериммунной архитектуре." },
  { id: "c17", type: "channel", title: "Release Radar", avatar: "R1", participants: ["u3", "u12", "u15"], unread: 0, description: "План релизов и заметки." },
  { id: "c18", type: "private", title: "Глеб Антонов", avatar: "V8", participants: ["me", "u16"], unread: 0, description: "Мобильная адаптация." },
  { id: "c19", type: "group", title: "UX Coffee", avatar: "U1", participants: ["me", "u1", "u7", "u11", "u15", "u17"], unread: 0, muted: true, description: "Неформальный чат про UX." },
  { id: "c20", type: "private", title: "Вера Алексеева", avatar: "P3", participants: ["me", "u19"], unread: 2, description: "Исследования пользователей." },
  { id: "c21", type: "channel", title: "Data Stream", avatar: "D2", participants: ["u9", "u10"], unread: 8, description: "Потоки данных, метрики и наблюдения." },
  { id: "c22", type: "private", title: "Павел Миронов", avatar: "M6", participants: ["me", "u14"], unread: 0, archived: true, description: "Финансовые вопросы." },
];

const texts = [
  "Проверил макет, выглядит аккуратно. Осталось пройтись по мобильной версии.",
  "Скинул короткую заметку в файл, посмотри когда будет окно.",
  "Давай вынесем это в отдельный компонент, так проще поддерживать.",
  "У меня готов черновик, но хочу еще раз проверить формулировки.",
  "Можно добавить реакцию и быстрый ответ, это сильно оживит демо.",
  "Встреча переносится на 15 минут, я добавил запись в календарь.",
  "Похоже, проблема была в старом состоянии localStorage.",
  "Отлично, тогда оставляем этот вариант и двигаемся дальше.",
  "Я приложил файл и пару ссылок для контекста.",
  "В темной теме контраст стал лучше, но кнопки еще стоит подсветить.",
  "Нужно сделать пустое состояние для поиска, иначе выглядит сломанным.",
  "Сейчас соберу список проверок для демонстрации.",
];

const attachmentKinds: Attachment["type"][] = ["image", "video", "file", "audio", "sticker", "poll", "location"];
const reactionPool = ["👍", "❤️", "😂", "😮", "🔥", "😢"];

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function buildUsers(): User[] {
  return names.map(([id, name, username, avatar, online, bio], index) => ({
    id: String(id),
    name: String(name),
    username: `@${username}`,
    avatar: String(avatar),
    status: online ? "онлайн" : "был недавно",
    bio: String(bio),
    isOnline: Boolean(online),
    lastSeen: minutesAgo(20 + index * 9),
  }));
}

function attachmentFor(index: number): Attachment | undefined {
  if (index % 5 !== 0) return undefined;
  const type = attachmentKinds[index % attachmentKinds.length];
  return {
    id: `att_${index}`,
    type,
    name: type === "poll" ? "Опрос по варианту интерфейса" : `${type}-demo-${index}.${type === "file" ? "pdf" : "demo"}`,
    size: type === "file" ? "1.8 MB" : type === "image" ? "740 KB" : undefined,
    duration: type === "audio" ? "0:24" : type === "video" ? "0:42" : undefined,
    metadata: type === "location" ? { place: "Демо-локация", accuracy: "120 м" } : undefined,
  };
}

function buildMessages(chats: Chat[]): Message[] {
  const messages: Message[] = [];
  chats.forEach((chat, chatIndex) => {
    const count = chat.type === "channel" ? 7 : 6;
    for (let i = 0; i < count; i += 1) {
      const own = i % 3 === 0 && chat.type !== "channel";
      const participant = chat.participants[(i + chatIndex) % chat.participants.length] || "u1";
      const senderId = chat.type === "saved" || own ? "me" : participant === "me" ? chat.participants[1] || "u1" : participant;
      const attachment = attachmentFor(chatIndex * 10 + i);
      const type = attachment ? (attachment.type === "location" ? "file" : attachment.type === "audio" ? "audio" : attachment.type === "poll" ? "poll" : attachment.type) : ("text" as MessageType);
      messages.push({
        id: `m_${chat.id}_${i}`,
        chatId: chat.id,
        senderId,
        text: chat.type === "channel" ? `Публикация: ${texts[(i + chatIndex) % texts.length]}` : texts[(i + chatIndex) % texts.length],
        createdAt: minutesAgo(30 + chatIndex * 21 + (count - i) * 8),
        editedAt: i === 2 ? minutesAgo(24 + chatIndex * 21) : undefined,
        type,
        status: own ? (i % 2 === 0 ? "read" : "delivered") : "read",
        replyToId: i === 4 ? `m_${chat.id}_1` : undefined,
        forwardedFrom: i === 5 ? "Tech Brief" : undefined,
        attachments: attachment ? [attachment] : [],
        reactions: i % 2 === 0 ? [{ emoji: reactionPool[(i + chatIndex) % reactionPool.length], userIds: ["u1", "u2"].slice(0, (i % 3) + 1) }] : [],
      });
    }
  });
  return messages;
}

export function createMockData(): AppData {
  const chats: Chat[] = chatBlueprints.map((chat) => ({
    id: chat.id,
    type: chat.type,
    title: chat.title,
    avatar: chat.avatar,
    participants: chat.participants,
    lastMessageId: "",
    unreadCount: chat.unread,
    isPinned: Boolean(chat.pinned),
    isMuted: Boolean(chat.muted),
    isArchived: Boolean(chat.archived),
    isFavorite: Boolean(chat.favorite),
    draft: chat.draft || "",
    description: chat.description,
  }));
  const messages = buildMessages(chats);
  const updatedChats = chats.map((chat) => {
    const chatMessages = messages.filter((message) => message.chatId === chat.id);
    return {
      ...chat,
      lastMessageId: chatMessages[chatMessages.length - 1]?.id || "",
      pinnedMessageId: chatMessages[1]?.id,
    };
  });
  return {
    users: buildUsers(),
    chats: updatedChats,
    messages,
  };
}
