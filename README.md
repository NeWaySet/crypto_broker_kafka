# CryptoBroker

Учебный проект на тему: **система обмена сообщениями с криптографической защитой информации**.

Проект показывает не просто интерфейс мессенджера, а связанную архитектуру:

- веб-мессенджер;
- локальный backend;
- SQLite-база данных;
- криптоконтейнеры AES-256-GCM;
- Kafka-брокер как отдельный модуль обмена событиями;
- генератор шумовых событий;
- Prometheus/Grafana для мониторинга;
- UML/Mermaid-диаграммы;
- отчет, PDF и презентация для защиты.

## Концепция

Главная идея проекта: сообщение не должно храниться и передаваться как обычный открытый текст. Перед сохранением или отправкой оно превращается в криптоконтейнер.

Криптоконтейнер содержит:

```text
algorithm
iv
ciphertext
authTag
metadata
```

Для основной версии используется связка:

```text
React UI -> Node.js API -> Crypto Layer -> SQLite
```

Для демонстрации брокерной архитектуры используется отдельная связка:

```text
Producer -> Kafka -> Consumer -> Audit log
```

## Что где лежит

| Папка / файл | Назначение |
| --- | --- |
| `CryptoBrokerWeb/` | Основная веб-версия мессенджера |
| `CryptoBrokerWeb/src/` | React + TypeScript frontend |
| `CryptoBrokerWeb/server/` | Node.js backend API |
| `CryptoBrokerWeb/server/crypto.mjs` | AES-256-GCM криптоконтейнеры |
| `CryptoBrokerWeb/server/data/` | Локальная SQLite-БД, не хранится в git |
| `CryptoBrokerWeb/docs/architecture.md` | UML/Mermaid-диаграммы и архитектура |
| `CryptoBrokerWeb/docs/design-system.md` | Дизайн-система, токены, Figma-экраны |
| `CryptoBrokerWeb/monitoring/` | Prometheus/Grafana для мониторинга |
| `KafkaBroker/` | Отдельный Kafka-модуль |
| `KafkaBroker/producer.mjs` | Отправляет зашифрованные события в Kafka |
| `KafkaBroker/consumer.mjs` | Читает Kafka, расшифровывает и пишет audit log |
| `KafkaBroker/noise-generator.mjs` | Генерирует шумовые события |
| `LiteBroker/` | Облегченная версия защищенного обмена |
| `artifacts/` | DOCX, PDF, PPTX и итоговые материалы |

## Используемые технологии

### Frontend

- React
- TypeScript
- Vite
- CSS
- Lucide React
- localStorage для учебных frontend-настроек

### Backend

- Node.js
- REST API
- SQLite
- PBKDF2 для паролей
- AES-256-GCM для сообщений

### Kafka-модуль

- Apache Kafka
- KafkaJS
- Docker Compose
- Kafka UI
- отдельные сервисы `producer`, `consumer`, `noise-generator`

### Мониторинг и документация

- Prometheus
- Grafana
- Mermaid/UML
- DOCX/PDF/PPTX-материалы

## Основная версия: CryptoBrokerWeb

Назначение: полноценный веб-мессенджер.

Функции:

- регистрация и вход по username/password;
- поиск пользователей по username;
- создание личного чата;
- отправка сообщений;
- редактирование и удаление сообщений;
- реакции;
- темная/светлая тема;
- локальная БД SQLite;
- хранение новых сообщений как AES-256-GCM криптоконтейнеров;
- просмотр криптоконтейнера в правой панели.

Запуск:

```powershell
cd CryptoBrokerWeb
npm run api
```

Во втором терминале:

```powershell
cd CryptoBrokerWeb
npm run dev
```

Адрес:

```text
http://localhost:5174
```

API:

```text
http://localhost:5175
```

## Kafka-модуль: KafkaBroker

Назначение: отдельно показать Kafka как брокер сообщений между изолированными компонентами.

Схема:

```text
producer -> cryptobroker.messages.crypto -> consumer -> logs/messages.jsonl
noise-generator -> cryptobroker.noise.raw
```

Запуск:

```powershell
cd KafkaBroker
docker compose up --build
```

Kafka UI:

```text
http://localhost:8089
```

Топики:

```text
cryptobroker.messages.crypto
cryptobroker.noise.raw
```

## LiteBroker

`LiteBroker/` - облегченная версия проекта. Она нужна для быстрой демонстрации защищенного обмена без полного интерфейса мессенджера.

## Grafana и Prometheus

Они нужны не для обычного пользователя, а для администратора и защиты проекта.

Prometheus собирает метрики backend, Grafana показывает их на дашборде.

Запуск мониторинга:

```powershell
cd CryptoBrokerWeb/monitoring
docker compose up -d
```

Адреса:

```text
Prometheus: http://localhost:9090
Grafana:    http://localhost:3001
```

Логин Grafana:

```text
admin / admin
```

## Паттерны проектирования

В проекте используются:

- **Facade** - `api.ts` скрывает детали REST-запросов от компонентов.
- **Strategy** - криптографический слой можно заменить другим алгоритмом.
- **DTO** - frontend получает безопасные представления объектов без passwordHash/passwordSalt.
- **Repository** - работа с SQLite находится на backend-стороне.
- **Observer** - polling, Kafka consumer и Prometheus наблюдают события/состояние.
- **Mediator** - API и Kafka выступают посредниками между компонентами.

## Шаблоны защиты

Используются идеи security-by-design:

- минимизация поверхности атаки;
- изоляция компонентов;
- хранение паролей не в открытом виде;
- хранение сообщений как криптоконтейнеров;
- контроль целостности через `authTag`;
- наблюдаемость через Prometheus/Grafana;
- отсутствие реальных внешних аккаунтов и Telegram API.

## Где материалы для защиты

Итоговые файлы лежат в `artifacts/`:

- `CryptoBroker_отчет_и_аналитика.docx`
- `CryptoBroker_отчет_и_аналитика.pdf`
- `CryptoBroker_презентация.pptx`
- `CryptoBroker_структура_решения_и_сравнение.md`

## Как кратко объяснять проект

CryptoBroker - это учебная система защищенного обмена сообщениями. Основная версия показывает мессенджер с авторизацией, чатами и криптоконтейнерами. Kafka вынесена в отдельный модуль, чтобы показать брокерную архитектуру между изолированными компонентами. Grafana и Prometheus добавлены для наблюдаемости, а UML-диаграммы и документы объясняют архитектуру, паттерны и защитные решения.
