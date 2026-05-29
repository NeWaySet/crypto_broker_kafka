# LiteBroker

Защищённый учебный чат на Kafka с PostgreSQL, генератором датчиков, Prometheus и Grafana.

## Запуск

```powershell
docker compose up --build
```

Адреса:

```text
LiteBroker: http://localhost:18091
Kafka UI:   http://localhost:18089
Prometheus: http://localhost:9090
Grafana:    http://localhost:3001
PostgreSQL: localhost:5432
```

Grafana:

```text
admin / admin
```

PostgreSQL:

```text
database: litebroker
user:     litebroker
password: litebroker
```

## Шифрование данных в БД

PostgreSQL volume не является TDE-хранилищем, но чувствительные данные шифруются на уровне приложения перед записью в таблицы:

- `messages.crypto_container` хранит сообщения как AES-256-GCM криптоконтейнеры;
- `sensor_samples.encrypted_payload` хранит замеры датчиков как AES-256-GCM криптоконтейнеры;
- `users.password_hash` хранит не пароль, а PBKDF2-SHA256 хеш с солью.

Открытые числовые поля датчиков оставлены только для совместимости схемы и после миграции зануляются.

## Топики Kafka

```text
litebroker.chat.<usernameA>__<usernameB>
litebroker.sensors.random
```

## Тестовые пользователи

```text
alice / 123456
bob / 123456
sensor_admin / 123456
```

## Остановка

```powershell
docker compose down
```

:3
