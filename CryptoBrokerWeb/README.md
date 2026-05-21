# CryptoBrokerWeb

Локальный веб-мессенджер на React + TypeScript с отдельным Node.js API, SQLite-базой данных, авторизацией по username/password и криптографической защитой сообщений.

## Что умеет

- Регистрация и вход по username и паролю.
- Хранение пользователей, сессий, чатов и сообщений в SQLite.
- PBKDF2-хеширование паролей на backend-стороне.
- Поиск пользователей по username и создание личного чата.
- Отправка, редактирование и удаление сообщений.
- Хранение новых сообщений в виде AES-256-GCM криптоконтейнеров.
- Правая панель просмотра криптоконтейнера: `iv`, `ciphertext`, `authTag`, `metadata`.
- Реакции, черновики, вложения и настройки интерфейса.
- Метрики для Prometheus/Grafana через `/api/metrics`.

## Запуск

Открой два терминала в директории проекта.

Backend:

```powershell
npm run api
```

Frontend:

```powershell
npm run dev
```

Приложение:

```text
http://localhost:5174
```

API:

```text
http://localhost:5175
```

Файл базы создается автоматически:

```text
server/data/cryptobroker.sqlite
```

## Мониторинг

```powershell
cd monitoring
docker compose up -d
```

- Prometheus: `http://localhost:9090`
- Grafana: `http://localhost:3001`
- Grafana login/password: `admin/admin`

Источник данных Prometheus для Grafana:

```text
http://prometheus:9090
```

## Архитектура

UML-диаграммы, схема Grafana/Prometheus, паттерны проектирования и security-by-design описаны в [docs/architecture.md](docs/architecture.md).
