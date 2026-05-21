# CryptoBrokerWeb: архитектура, UML, Grafana и паттерны

## Назначение

CryptoBrokerWeb - локальный веб-мессенджер с отдельным frontend, backend API, SQLite-базой данных и криптографической защитой новых сообщений. Пользователи регистрируются по username и паролю, находят друг друга по username, создают личные чаты и обмениваются сообщениями.

## Компонентная UML-диаграмма

```mermaid
flowchart LR
  Browser["Браузер пользователя"]
  React["React UI<br/>CryptoBroker"]
  ApiClient["API Client<br/>src/utils/api.ts"]
  Server["Node HTTP API<br/>server/index.mjs"]
  Crypto["Crypto Layer<br/>AES-256-GCM"]
  Db["SQLite DB<br/>server/data/cryptobroker.sqlite"]
  Metrics["/api/metrics"]
  Prometheus["Prometheus"]
  Grafana["Grafana"]

  Browser --> React
  React --> ApiClient
  ApiClient --> Server
  Server --> Crypto
  Server --> Db
  Server --> Metrics
  Prometheus --> Metrics
  Grafana --> Prometheus
```

## Диаграмма классов / моделей данных

```mermaid
classDiagram
  class User {
    +string id
    +string name
    +string username
    +string avatar
    +string status
    +string bio
    +boolean isOnline
    +string lastSeen
  }

  class Chat {
    +string id
    +ChatType type
    +string title
    +string[] participants
    +string lastMessageId
    +number unreadCount
    +boolean isPinned
    +boolean isArchived
    +string draft
  }

  class Message {
    +string id
    +string chatId
    +string senderId
    +string text
    +string createdAt
    +MessageStatus status
    +CryptoContainer cryptoContainer
  }

  class CryptoContainer {
    +number version
    +string algorithm
    +string iv
    +string ciphertext
    +string authTag
    +object metadata
  }

  class Attachment {
    +string id
    +AttachmentType type
    +string name
    +string size
  }

  class Reaction {
    +string emoji
    +string[] userIds
  }

  Chat "1" --> "*" Message
  User "1" --> "*" Message
  Message "1" --> "0..1" CryptoContainer
  Message "1" --> "*" Attachment
  Message "1" --> "*" Reaction
```

## Sequence: отправка защищенного сообщения

```mermaid
sequenceDiagram
  actor U as Пользователь
  participant UI as MessageComposer
  participant API as Backend API
  participant C as AES-256-GCM
  participant DB as SQLite DB
  participant P as Crypto Panel

  U->>UI: вводит сообщение
  UI->>API: POST /api/messages
  API->>C: encryptMessage(text, metadata)
  C-->>API: cryptoContainer
  API->>DB: сохранить cryptoContainer
  API-->>UI: AppState с расшифрованным text и cryptoContainer
  UI-->>P: показать iv, ciphertext, authTag
```

## Deployment-диаграмма

```mermaid
flowchart TB
  subgraph Host["Локальная машина"]
    FE["Vite dev server<br/>localhost:5174"]
    BE["CryptoBroker API<br/>localhost:5175"]
    DB["cryptobroker.sqlite"]
  end

  subgraph Docker["Docker monitoring"]
    PR["Prometheus<br/>localhost:9090"]
    GF["Grafana<br/>localhost:3001"]
  end

  FE --> BE
  BE --> DB
  PR -->|"scrape /api/metrics"| BE
  GF --> PR
```

## Grafana

Backend отдает метрики:

```text
GET http://localhost:5175/api/metrics
```

Основные метрики:

- `cryptobroker_users_total`
- `cryptobroker_chats_total`
- `cryptobroker_messages_total`
- `cryptobroker_sessions_total`

## Использованные паттерны проектирования

| Паттерн | Где используется | Зачем |
|---|---|---|
| Component | `src/components/*` | UI разделен на независимые компоненты |
| Container / Presentational | `App.tsx` + компоненты | `App` хранит состояние, компоненты отображают данные |
| Facade | `src/utils/api.ts` | frontend работает с API через один слой |
| Repository | `server/index.mjs`: `readDb/writeDb` | доступ к базе изолирован от маршрутов |
| DTO | ответы `AppState`, `AuthPayload` | backend отдает frontend только нужные данные |
| Adapter | `api.ts` адаптирует HTTP к функциям UI | компоненты не знают детали `fetch` |
| Observer / Polling | автообновление `GET /api/state` | клиент получает новые сообщения |
| Strategy | шифрование AES-256-GCM и фильтры чатов | разные стратегии обработки можно менять отдельно |
| Factory Method | `makeId`, создание `Chat`, `Message`, `CryptoContainer` | единый способ создавать сущности |
| Proxy | Vite proxy `/api -> localhost:5175` | frontend обращается к API без ручного CORS-адреса |

## Security by design

- Пароли не хранятся открытым текстом.
- PBKDF2 выполняется на backend.
- Новые сообщения сохраняются как AES-256-GCM криптоконтейнеры.
- Frontend получает публичную модель пользователя без `passwordHash` и `passwordSalt`.
- Доступ к `/api/state`, чатам и сообщениям требует Bearer-token.
- Пользователь видит только те чаты, где он является участником.
- Grafana и Prometheus вынесены в отдельный monitoring-контур.
