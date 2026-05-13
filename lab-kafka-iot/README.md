# Система обмена сообщениями с криптографической защитой

Этот проект - учебный прототип системы обмена сообщениями с криптографической защитой информации.  
Он сделан на Docker Compose, Apache Kafka и Python. Сообщение проходит через несколько изолированных контейнеров, а полезная нагрузка перед обработкой упаковывается в криптоконтейнер.

Главная идея: компоненты не доверяют друг другу полностью и общаются только через Kafka-топики по заданной политике безопасности.

## Что делает проект

Пользователь вводит сообщение в `producer`. Дальше система:

1. Отправляет исходное сообщение в Kafka-топик `sensors.raw`.
2. Передает сообщение в `crypto-gateway`.
3. `crypto-gateway` спрашивает у `policy-engine`, можно ли обрабатывать это сообщение.
4. Если политика отвечает `allow`, `crypto-gateway` шифрует payload и создает криптоконтейнер.
5. Криптоконтейнер публикуется в Kafka-топик `sensors.crypto`.
6. `filter` расшифровывает криптоконтейнер, очищает и валидирует данные.
7. Валидное сообщение попадает в `sensors.data.filtered`.
8. `consumer` читает итоговое сообщение.
9. `grafana` можно использовать для визуализации данных из Kafka.

Схема потока:

```text
producer
  -> sensors.raw
  -> crypto-gateway
  -> policy-engine
  -> sensors.crypto
  -> filter
  -> sensors.data.filtered
  -> consumer / grafana
```

## Структура проекта

```text
lab-kafka-iot/
├── docker-compose.yml
├── README.md
├── policy/
│   └── policy.json
├── producer/
│   ├── app.py
│   └── Dockerfile
├── policy-engine/
│   ├── app.py
│   └── Dockerfile
├── crypto-gateway/
│   ├── app.py
│   └── Dockerfile
├── filter/
│   ├── app.py
│   └── Dockerfile
├── consumer/
│   ├── app.py
│   └── Dockerfile
└── diagrams/
    ├── architecture.drawio
    └── sequence.drawio
```

## Компоненты

### `kafka`

Apache Kafka в режиме KRaft.  
Это брокер сообщений. Он не обрабатывает бизнес-логику, а только хранит и передает сообщения между контейнерами.

Основные топики:

| Топик | Назначение |
|---|---|
| `sensors.raw` | исходные сообщения от producer |
| `policy.requests` | запросы на проверку политики |
| `policy.decisions` | ответы `allow/deny` от policy-engine |
| `sensors.crypto` | зашифрованные криптоконтейнеры |
| `sensors.data.filtered` | расшифрованные, очищенные и валидные сообщения |

### `producer`

Контейнер для ручного ввода сообщений.  
Он не шифрует данные сам. Его задача - принять текст или JSON от пользователя и отправить в `sensors.raw`.

Примеры сообщений:

```text
Hello secure Kafka
```

```json
{"sensor_id":"sensor_1","temperature":23.4,"humidity":48.2}
```

Также есть команда:

```text
/sample
```

Она генерирует тестовое сообщение датчика.

### `policy-engine`

Компонент принятия решений безопасности.  
Он читает запросы из `policy.requests`, проверяет их по файлу [policy.json](./policy/policy.json) и отправляет результат в `policy.decisions`.

Пример решения:

```json
{
  "request_id": "...",
  "decision": "allow",
  "reasons": [],
  "policy_version": "1.0"
}
```

Если сообщение нарушает политику, решение будет `deny`, и `crypto-gateway` не пропустит его дальше.

### `crypto-gateway`

Компонент применения политики и создания криптоконтейнера.

Он:

1. Читает сообщение из `sensors.raw`.
2. Определяет тип сообщения.
3. Отправляет запрос в `policy.requests`.
4. Ждет решение из `policy.decisions`.
5. Если решение `allow`, шифрует payload.
6. Публикует криптоконтейнер в `sensors.crypto`.

Криптоконтейнер выглядит примерно так:

```json
{
  "container_version": "1.0",
  "algorithm": "Fernet(AES-128-CBC-HMAC-SHA256)",
  "ciphertext": "gAAAAAB...",
  "policy": {
    "decision": "allow",
    "policy_version": "1.0"
  },
  "created_at": "2026-05-13T20:32:05+00:00"
}
```

Важный момент: в `sensors.crypto` уже нет открытого JSON с температурой и влажностью. Там лежит зашифрованное поле `ciphertext`.

### `filter`

Компонент безопасной обработки данных.

Он:

1. Читает криптоконтейнер из `sensors.crypto`.
2. Расшифровывает payload.
3. Очищает текстовые сообщения от опасных фрагментов.
4. Проверяет данные датчиков.
5. Публикует валидный результат в `sensors.data.filtered`.

Правила проверки:

| Поле | Условие |
|---|---|
| `temperature` | от `-20` до `50` |
| `humidity` | от `0` до `100` |
| `text` | обрезается до 240 символов, удаляются `<script>...</script>` |

### `consumer`

Контейнер для просмотра результата в консоли.  
Он читает только `sensors.data.filtered`, то есть уже безопасно обработанные сообщения.

### `grafana`

Grafana не нужна для самого обмена сообщениями.  
Она нужна, чтобы можно было визуализировать данные: например, строить графики температуры и влажности по Kafka-топику `sensors.data.filtered`.

Адрес:

```text
http://localhost:3000
```

Логин и пароль:

```text
admin / admin
```

## Как запустить

Открой PowerShell в папке проекта:

```powershell
cd "C:\Users\HONOR\Documents\New project 8\lab-kafka-iot"
```

Запусти все контейнеры:

```powershell
docker compose up --build -d kafka kafka-init policy-engine crypto-gateway filter consumer grafana
```

Проверить состояние:

```powershell
docker compose ps
```

Должны быть запущены:

```text
kafka-broker
policy-engine
crypto-gateway
kafka-filter
kafka-consumer
kafka-grafana
```

## Как отправить сообщение

Запусти интерактивный producer:

```powershell
docker compose run --rm producer
```

Появится приглашение:

```text
>
```

Введи, например:

```json
{"sensor_id":"sensor_1","temperature":23.4,"humidity":48.2}
```

Или обычный текст:

```text
Привет, это защищенное сообщение
```

Или тестовое сообщение:

```text
/sample
```

Выйти из producer:

```text
/quit
```

## Где смотреть результат

Логи принятия решения политикой:

```powershell
docker compose logs -f policy-engine
```

Логи создания криптоконтейнера:

```powershell
docker compose logs -f crypto-gateway
```

Логи расшифрования и фильтрации:

```powershell
docker compose logs -f filter
```

Итоговые сообщения:

```powershell
docker compose logs -f consumer
```

## Как доказать, что сообщение шифруется

Можно прочитать одно сообщение из топика `sensors.crypto`:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic sensors.crypto --from-beginning --timeout-ms 3000 --max-messages 1
```

В результате будет видно поле `ciphertext`, например:

```json
{
  "container_version": "1.0",
  "algorithm": "Fernet(AES-128-CBC-HMAC-SHA256)",
  "ciphertext": "gAAAAABqBN_FHxNKKjLRzy4AmmRmd7oD..."
}
```

Это означает, что в промежуточном топике Kafka лежит не открытое сообщение, а криптоконтейнер.

## Как проверить отказ политики

Политика запрещает некорректные значения датчиков. Например, температура `999` не пройдет:

```powershell
docker compose run --rm producer
```

Ввести:

```json
{"sensor_id":"bad_sensor","temperature":999,"humidity":40}
```

После этого в логах `policy-engine` будет решение `deny`, а в `crypto-gateway` сообщение будет отброшено.

## Где находится политика

Файл политики:

```text
policy/policy.json
```

Сейчас политика задает:

```json
{
  "default_decision": "deny",
  "allowed_sources": ["producer:json", "producer:text", "producer:/sample"],
  "allowed_message_types": ["sensor-data", "text-message"],
  "limits": {
    "max_text_length": 240,
    "temperature_min": -20.0,
    "temperature_max": 50.0,
    "humidity_min": 0.0,
    "humidity_max": 100.0
  }
}
```

Если нужно поменять допустимые значения температуры или влажности, редактируется именно этот файл.

После изменения политики перезапусти `policy-engine`:

```powershell
docker compose restart policy-engine
```

## Кибериммунный подход

В проекте применена декомпозиция на изолированные компоненты:

| Компонент | Минимальная ответственность |
|---|---|
| `producer` | только ввод и отправка исходного сообщения |
| `policy-engine` | только принятие решения безопасности |
| `crypto-gateway` | только применение политики и шифрование |
| `filter` | только расшифрование, очистка и валидация |
| `consumer` | только чтение безопасного результата |
| `kafka` | только передача сообщений |

Так уменьшается поверхность защиты:

- producer не имеет ключа расшифрования;
- consumer не видит сырые сообщения;
- policy-engine отделен от crypto-gateway;
- открытые данные не публикуются в промежуточный защищенный топик;
- каждый контейнер можно анализировать отдельно.

## Шаблоны конструктивной информационной безопасности

Использованы идеи из СКИБ:

### Раздельное принятие и применение решений о безопасности

`policy-engine` принимает решение `allow/deny`, а `crypto-gateway` применяет это решение.  
Это полезно, потому что логика политики отделена от логики обработки данных.

### Выделенный обработчик для очистки данных

`filter` выполняет очистку и валидацию перед публикацией результата.  
Это снижает риск, что дальше по цепочке уйдут опасные или некорректные данные.

Источник: <https://securitybydesign.ru/templates/>

## Шаблоны проектирования ПО

В коде использованы несколько шаблонов:

| Шаблон | Где используется | Зачем |
|---|---|---|
| Strategy | `MessageTypeStrategy` в `crypto-gateway/app.py` | определяет тип сообщения |
| Facade | `CryptoContainerFacade` в `crypto-gateway/app.py` | скрывает детали шифрования |
| Adapter | `CryptoContainerAdapter` в `filter/app.py` | преобразует криптоконтейнер обратно в payload |
| Factory Method style | функции `connect()` | единый способ создавать Kafka-клиенты |

Источник: <https://refactoringu.ru/ru/design-patterns/catalog.html>

## Как остановить

Остановить контейнеры:

```powershell
docker compose down
```

Остановить и удалить volume Grafana:

```powershell
docker compose down -v
```

## Полезные команды

Показать все контейнеры проекта:

```powershell
docker compose ps
```

Показать все топики Kafka:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Посмотреть сообщения в итоговом топике:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic sensors.data.filtered --from-beginning --timeout-ms 3000
```

Пересобрать контейнеры:

```powershell
docker compose build
```
