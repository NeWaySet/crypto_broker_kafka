# LiteBroker

Легкая версия CryptoBroker на базе Kafka. Используется для демонстрации защищенного обмена сообщениями и отдельного потока замеров датчиков.

## Возможности

- регистрация и вход по `username/password`;
- выбор собеседника перед отправкой;
- отдельный Kafka-топик на каждый личный чат;
- отдельный Kafka-топик для генератора датчиков;
- AES-256-GCM криптоконтейнеры для сообщений;
- SQLite-БД для пользователей, сообщений и замеров;
- Prometheus-метрики;
- JSONL-логи криптоконтейнеров для Grafana/Loki.

## Запуск через общий Docker Compose

Из корня проекта:

```powershell
docker compose up --build litebroker kafka kafka-ui prometheus loki promtail grafana
```

Открыть:

```text
LiteBroker: http://localhost:18090
Kafka UI:   http://localhost:18089
Grafana:    http://localhost:3001
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

В Docker:

- SQLite хранится в volume `litebroker-data`;
- логи криптоконтейнеров пишутся в `LiteBroker/logs/chat-containers.jsonl`;
- логи датчиков пишутся в `LiteBroker/logs/sensor-samples.jsonl`.

При локальном запуске SQLite находится в:

```text
LiteBroker/data/litebroker.sqlite
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

## Формат криптоконтейнера

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
