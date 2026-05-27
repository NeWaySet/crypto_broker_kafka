# LiteBroker

защищенный чат на Kafka, генератор датчиков, Prometheus и Grafana.

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
```

Grafana:

```text
admin / admin
```

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
