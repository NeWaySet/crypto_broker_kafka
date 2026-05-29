# LiteBroker

Лёгкая версия CryptoBroker на базе Kafka и PostgreSQL. Используется для демонстрации защищённого обмена сообщениями, отдельных Kafka-топиков для диалогов и отдельного потока замеров датчиков.

## Возможности

- регистрация и вход по `username/password`;
- выбор собеседника перед отправкой сообщения;
- отдельный Kafka-топик на каждый личный чат;
- отдельный Kafka-топик для генератора датчиков;
- AES-256-GCM криптоконтейнеры для сообщений;
- AES-256-GCM криптоконтейнеры для замеров датчиков в PostgreSQL;
- PostgreSQL-БД для пользователей, сессий, сообщений и замеров;
- Prometheus-метрики;
- JSONL-логи криптоконтейнеров для Grafana/Loki.

## Запуск через общий Docker Compose

Из корня проекта:

```powershell
docker compose up --build
```

Открыть:

```text
LiteBroker: http://localhost:18091
Kafka UI:   http://localhost:18089
Grafana:    http://localhost:3001
PostgreSQL: localhost:5432
```

Подключение к PostgreSQL:

```text
host: localhost
port: 5432
database: litebroker
user: litebroker
password: litebroker
```

## Тестовые пользователи

```text
alice / 123456
bob / 123456
sensor_admin / 123456
```

Можно также создать своего пользователя через форму регистрации.

## Kafka-топики

Чаты:

```text
litebroker.chat.<usernameA>__<usernameB>
```

Пример:

```text
litebroker.chat.alice__bob
```

Датчики:

```text
litebroker.sensors.random
```

## Где данные

В Docker данные PostgreSQL хранятся в volume:

```text
postgres-data
```

Схема создаётся автоматически в `server.mjs` при старте приложения:

- `users`;
- `sessions`;
- `messages`;
- `sensor_samples`.

## Шифрование базы данных

Полного Transparent Data Encryption в стандартном контейнере PostgreSQL нет. Поэтому в проекте используется прикладное шифрование перед записью в БД:

- сообщения хранятся в `messages.crypto_container` как AES-256-GCM контейнер;
- замеры датчиков хранятся в `sensor_samples.encrypted_payload` как AES-256-GCM контейнер;
- пароли не хранятся в открытом виде, используется PBKDF2-SHA256 с индивидуальной солью;
- старые открытые значения датчиков при старте мигрируются в `encrypted_payload`, после чего поля `temperature`, `humidity`, `pressure` зануляются.

Формат контейнера:

```json
{
  "version": 2,
  "algorithm": "AES-256-GCM",
  "iv": "...",
  "ciphertext": "...",
  "authTag": "...",
  "metadata": {
    "messageId": "...",
    "senderId": "...",
    "recipientId": "...",
    "chatTopic": "...",
    "createdAt": "..."
  }
}
```

Для датчиков в `metadata` используются `sampleId`, `topic`, `createdAt` и путь хранения.

## Логи для Grafana/Loki

```text
LiteBroker/logs/chat-containers.jsonl
LiteBroker/logs/sensor-samples.jsonl
```

## API

```text
GET  /api/health
GET  /api/users
GET  /api/messages?peerId=<id>
POST /api/messages
GET  /api/sensors
GET  /metrics
```
