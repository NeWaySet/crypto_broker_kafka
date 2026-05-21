# KafkaBroker

Отдельный Kafka-модуль для проекта CryptoBroker.

Он не заменяет основной мессенджер `CryptoBrokerWeb`, а показывает брокерную архитектуру:

```text
producer -> Kafka topic cryptobroker.messages.crypto -> consumer -> logs/messages.jsonl
noise-generator -> Kafka topic cryptobroker.noise.raw
```

Сообщения передаются не открытым текстом, а криптоконтейнерами AES-256-GCM.

## Зачем эта папка

Основная версия мессенджера работает через REST API + SQLite. Kafka вынесена отдельно, чтобы на защите можно было показать брокер сообщений между изолированными компонентами.

## Состав

| Файл | Назначение |
| --- | --- |
| `docker-compose.yml` | Kafka, Kafka UI, producer, consumer, noise-generator |
| `producer.mjs` | Отправляет полезные зашифрованные сообщения |
| `consumer.mjs` | Читает сообщения, расшифровывает и пишет audit log |
| `noise-generator.mjs` | Генерирует фоновые шумовые события |
| `crypto.mjs` | AES-256-GCM криптоконтейнеры |
| `logs/messages.jsonl` | Расшифрованный audit log consumer-а |

## Запуск

Лучший способ - общий запуск из корня репозитория:

```powershell
docker compose up --build kafka kafka-ui kafka-producer kafka-consumer noise-generator
```

Можно запустить только эту папку:

```powershell
cd KafkaBroker
docker compose up --build
```

После запуска:

- Kafka broker: `localhost:9092`
- Kafka UI: `http://localhost:8089`
- основной топик: `cryptobroker.messages.crypto`
- шумовой топик: `cryptobroker.noise.raw`

## Как тестировать

1. Открыть Kafka UI:

```text
http://localhost:8089
```

2. Перейти в `Topics`.

3. Открыть топик:

```text
cryptobroker.messages.crypto
```

4. В сообщениях будет JSON с криптоконтейнером:

```json
{
  "eventType": "message.created",
  "cryptoContainer": {
    "algorithm": "AES-256-GCM",
    "iv": "...",
    "ciphertext": "...",
    "authTag": "...",
    "metadata": {
      "chatId": "kafka_demo_chat",
      "senderId": "kafka_demo_user",
      "transport": "kafka"
    }
  }
}
```

5. Проверить расшифровку consumer-а:

```text
logs/messages.jsonl
```

Там будет поле:

```json
"decryptedText": "Kafka crypto message #..."
```

## Генератор шумов

Сервис `noise-generator` отправляет фоновые события в топик:

```text
cryptobroker.noise.raw
```

Типы шумов:

- `heartbeat`
- `duplicate-message`
- `malformed-payload`
- `unknown-sender`
- `oversized-message`
- `policy-denied`
- `sensor-jitter`
- `spam-burst`

Это нужно для демонстрации того, что Kafka может принимать не только полезные сообщения, но и фоновый поток, который дальше можно фильтровать policy-engine или consumer-сервисом.

## Ручная отправка сообщения

Если Kafka уже запущена:

```powershell
docker compose run --rm kafka-producer node producer.mjs "Привет через Kafka"
```

Если запускаешь из папки `KafkaBroker`, имя сервиса будет `producer`:

```powershell
docker compose run --rm producer node producer.mjs "Привет через Kafka"
```

## Остановка

Из корня репозитория:

```powershell
docker compose down
```

Из папки `KafkaBroker`:

```powershell
docker compose down
```
