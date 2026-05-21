# CryptoBrokerWeb

Основная веб-версия проекта CryptoBroker.

Это локальный веб-мессенджер на React + TypeScript с отдельным Node.js API, SQLite-базой данных, авторизацией по username/password и криптографической защитой сообщений.

## Что умеет

- регистрация и вход по username/password;
- хранение пользователей, сессий, чатов и сообщений в SQLite;
- PBKDF2-хеширование паролей на backend-стороне;
- поиск пользователей по username;
- создание личного чата;
- отправка, редактирование и удаление сообщений;
- хранение новых сообщений в виде AES-256-GCM криптоконтейнеров;
- правая панель просмотра криптоконтейнера: `iv`, `ciphertext`, `authTag`, `metadata`;
- реакции, черновики и настройки интерфейса;
- метрики для Prometheus/Grafana через `/api/metrics`.

## Запуск через Docker

Из корня репозитория:

```powershell
docker compose up --build cryptobroker-api cryptobroker-web
```

Адреса:

```text
Web: http://localhost:5174
API: http://localhost:5175
```

Файл базы данных внутри Docker хранится в volume `cryptobroker-data`.

## Локальный запуск без Docker

Открой два терминала в директории `CryptoBrokerWeb`.

Backend:

```powershell
npm run api
```

Frontend:

```powershell
npm run dev
```

Файл базы создается автоматически:

```text
server/data/cryptobroker.sqlite
```

## Мониторинг

Через общий Docker Compose из корня проекта:

```powershell
docker compose up --build prometheus grafana cryptobroker-api
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

## Архитектура

UML-диаграммы, схема Grafana/Prometheus, паттерны проектирования и security-by-design описаны в:

```text
docs/architecture.md
```

Дизайн-система и структура экранов описаны в:

```text
docs/design-system.md
```
