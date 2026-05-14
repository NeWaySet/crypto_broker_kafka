# Crypto Broker Kafka

Учебный проект: защищенный мини-мессенджер на Kafka с криптоконтейнерами, политикой безопасности и отдельным потоком данных датчиков.

В системе есть два независимых пользовательских сценария:

1. **Переписка** - пользователь отправляет текстовые сообщения через веб-интерфейс.
2. **Датчики** - пользователь отправляет значения температуры и влажности, которые можно визуализировать в Grafana.

Оба сценария проходят один и тот же безопасный маршрут: policy check -> encryption -> crypto container -> decrypt -> sanitize/filter -> filtered topic.

## Быстрый запуск

```powershell
cd "C:\Users\HONOR\Documents\New project 8\lab-kafka-iot"
docker compose up --build -d kafka kafka-init policy-engine crypto-gateway filter consumer app grafana
```

Открыть веб-интерфейс:

```text
http://localhost:8088
```

Открыть Grafana:

```text
http://localhost:3001
login: admin
password: admin
```

Проверить контейнеры:

```powershell
docker compose ps
```

## Что именно сделано

Проект не смешивает переписку и данные датчиков в одном топике. Потоки разделены:

| Поток | Raw topic | Crypto topic | Filtered topic |
|---|---|---|---|
| Чат | `messages.raw` | `messages.crypto` | `messages.filtered` |
| Датчики | `sensors.raw` | `sensors.crypto` | `sensors.data.filtered` |

Это удобно для защиты и для демонстрации:

- переписку можно показывать как таблицу сообщений;
- датчики можно визуализировать в Grafana как графики температуры и влажности;
- в промежуточных `*.crypto` топиках лежит не открытый JSON, а криптоконтейнер с `ciphertext`.

## Архитектура

```text
web app / producer
  -> messages.raw или sensors.raw
  -> crypto-gateway
  -> policy-engine
  -> messages.crypto или sensors.crypto
  -> filter
  -> messages.filtered или sensors.data.filtered
  -> consumer / grafana
```

## Компоненты

### `app`

Минимальный веб-интерфейс на Flask.

Адрес:

```text
http://localhost:8088
```

В интерфейсе две формы:

- отправка сообщения в чат;
- отправка значений датчика.

Ниже отображаются последние обработанные сообщения из `messages.filtered` и `sensors.data.filtered`.

### `producer`

Консольная альтернатива веб-интерфейсу.

Запуск:

```powershell
docker compose run --rm producer
```

Обычный текст уйдет в `messages.raw`:

```text
Привет, это сообщение в защищенный чат
```

JSON с температурой/влажностью уйдет в `sensors.raw`:

```json
{"sensor_id":"sensor_1","temperature":23.4,"humidity":48.2}
```

Команда `/sample` отправит тестовые данные датчика.

### `policy-engine`

Компонент принятия решений безопасности.

Он читает запросы из `policy.requests`, проверяет их по [policy.json](./policy/policy.json) и отправляет решение в `policy.decisions`.

Возможные решения:

- `allow` - сообщение можно шифровать и передавать дальше;
- `deny` - сообщение отбрасывается.

### `crypto-gateway`

Компонент применения политики и создания криптоконтейнера.

Он:

1. Читает `messages.raw` и `sensors.raw`.
2. Определяет тип сообщения: `chat-message` или `sensor-data`.
3. Отправляет запрос в `policy.requests`.
4. Ждет ответ из `policy.decisions`.
5. Если ответ `allow`, шифрует payload.
6. Публикует криптоконтейнер в `messages.crypto` или `sensors.crypto`.

Пример криптоконтейнера:

```json
{
  "container_version": "1.0",
  "message_type": "chat-message",
  "source_topic": "messages.raw",
  "algorithm": "Fernet(AES-128-CBC-HMAC-SHA256)",
  "ciphertext": "gAAAAAB...",
  "policy": {
    "decision": "allow",
    "policy_version": "1.0"
  }
}
```

### `filter`

Компонент безопасной обработки.

Он:

1. Читает `messages.crypto` и `sensors.crypto`.
2. Расшифровывает криптоконтейнер.
3. Очищает текст от `<script>...</script>`.
4. Проверяет датчики по диапазонам.
5. Публикует результат в `messages.filtered` или `sensors.data.filtered`.

Правила для датчиков:

| Поле | Условие |
|---|---|
| `temperature` | от `-20` до `50` |
| `humidity` | от `0` до `100` |

### `consumer`

Консольный просмотр результата.  
Читает оба итоговых топика:

- `messages.filtered`;
- `sensors.data.filtered`.

Логи:

```powershell
docker compose logs -f consumer
```

### `grafana`

Grafana нужна для визуализации.

Идея для демонстрации:

- `sensors.data.filtered` - графики температуры и влажности;
- `messages.filtered` - таблица переписки.

Kafka datasource:

```text
Bootstrap server: kafka:9092
Sensor topic: sensors.data.filtered
Message topic: messages.filtered
```

## Проверка работы

### 1. Отправить сообщение через веб

Открой:

```text
http://localhost:8088
```

В блоке “Сообщение” введи текст и нажми отправку.  
Через пару секунд сообщение появится в `messages.filtered`.

### 2. Отправить данные датчика через веб

В блоке “Сенсор” введи температуру и влажность.  
Результат появится в `sensors.data.filtered`.

### 3. Посмотреть логи политики

```powershell
docker compose logs -f policy-engine
```

Там будет видно:

```text
DECISION -> {"decision": "allow", ...}
```

### 4. Посмотреть создание криптоконтейнера

```powershell
docker compose logs -f crypto-gateway
```

Пример:

```text
SEALED -> type=chat-message topic=messages.crypto
SEALED -> type=sensor-data topic=sensors.crypto
```

### 5. Доказать, что в Kafka лежит ciphertext

Для чата:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic messages.crypto --from-beginning --timeout-ms 3000 --max-messages 1
```

Для датчиков:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic sensors.crypto --from-beginning --timeout-ms 3000 --max-messages 1
```

В результате будет поле:

```json
"ciphertext": "gAAAAAB..."
```

Это значит, что промежуточный топик хранит не открытое сообщение, а криптоконтейнер.

## Проверка отказа политики

Отправь датчик с неправильной температурой:

```json
{"sensor_id":"bad_sensor","temperature":999,"humidity":40}
```

Ожидаемое поведение:

- `policy-engine` вернет `deny`;
- `crypto-gateway` не создаст криптоконтейнер;
- сообщение не попадет в `sensors.data.filtered`.

## Политика безопасности

Файл:

```text
policy/policy.json
```

Сейчас политика разрешает:

- источники `web:chat`, `web:sensor`, `producer:chat`, `producer:sensor`, `producer:/sample`;
- типы `chat-message` и `sensor-data`;
- текст длиной до 240 символов;
- температуру от `-20` до `50`;
- влажность от `0` до `100`.

После изменения политики:

```powershell
docker compose restart policy-engine
```

## Кибериммунный подход

Система разделена на изолированные компоненты с минимальными обязанностями:

| Компонент | Минимальная ответственность |
|---|---|
| `app` / `producer` | ввод сообщений |
| `policy-engine` | принятие решения безопасности |
| `crypto-gateway` | применение политики и шифрование |
| `filter` | расшифрование, очистка, валидация |
| `consumer` / `grafana` | просмотр результата |
| `kafka` | доставка сообщений |

Почему это уменьшает поверхность защиты:

- UI не имеет ключа расшифрования;
- consumer не читает raw-топики;
- policy-engine отделен от crypto-gateway;
- открытые данные не публикуются в `*.crypto`;
- чат и датчики разведены по разным топикам.

## Использованные шаблоны

### Шаблоны конструктивной информационной безопасности

Использованы идеи из <https://securitybydesign.ru/templates/>.

| Шаблон | Где в проекте |
|---|---|
| Раздельное принятие и применение решений о безопасности | `policy-engine` принимает решение, `crypto-gateway` применяет |
| Выделенный обработчик для очистки данных | `filter` очищает и валидирует данные перед итоговым топиком |
| Минимизация поверхности защиты | каждый контейнер выполняет одну узкую функцию |

### Шаблоны проектирования ПО

Источник: <https://refactoringu.ru/ru/design-patterns/catalog.html>

| Шаблон | Где используется | Зачем |
|---|---|---|
| Strategy | `MessageTypeStrategy` в `crypto-gateway/app.py` | определить тип сообщения и нужный поток |
| Facade | `CryptoContainerFacade` в `crypto-gateway/app.py` | скрыть детали шифрования |
| Adapter | `CryptoContainerAdapter` в `filter/app.py` | открыть криптоконтейнер как обычный payload |
| Factory Method style | функции `connect()` | единый способ создавать Kafka producer/consumer |

## Структура проекта

```text
lab-kafka-iot/
├── app/                 # веб-интерфейс
├── consumer/            # просмотр итоговых топиков
├── crypto-gateway/      # policy enforcement + encryption
├── filter/              # decrypt + sanitize + validate
├── policy/              # policy.json
├── policy-engine/       # policy decision point
├── producer/            # CLI producer
├── diagrams/            # draw.io схемы
├── docker-compose.yml
└── README.md
```

## Остановка

```powershell
docker compose down
```

Остановка с удалением volume Grafana:

```powershell
docker compose down -v
```

## Полезные команды

Список топиков:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

Сообщения чата:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic messages.filtered --from-beginning --timeout-ms 3000
```

Данные датчиков:

```powershell
docker exec kafka-broker /opt/kafka/bin/kafka-console-consumer.sh --bootstrap-server localhost:9092 --topic sensors.data.filtered --from-beginning --timeout-ms 3000
```

Пересборка:

```powershell
docker compose build
```
