# Light Crypto Chat

Лёгкая отдельная версия проекта из `lab-kafka-iot`.

## Что внутри

- Один Node.js сервер без Kafka и без Grafana.
- Отдельный порт: `8090`.
- Отдельная SQLite-база: `data/light-cryptobroker.sqlite`.
- Регистрация и вход по `username/password`.
- Пароли хранятся как PBKDF2-хеш + соль.
- Сообщения в базе хранятся не открытым текстом, а криптоконтейнером AES-256-GCM.

## Запуск

```powershell
cd "C:\Users\HONOR\Documents\New project 8\lab-kafka-iot\light-crypto-chat"
npm start
```

Открыть:

```text
http://localhost:8090
```

Проверка API:

```text
http://localhost:8090/api/health
```

## Формат криптоконтейнера

```json
{
  "version": 1,
  "algorithm": "AES-256-GCM",
  "iv": "...",
  "ciphertext": "...",
  "authTag": "...",
  "metadata": {
    "messageId": "...",
    "senderId": "...",
    "createdAt": "..."
  }
}
```

Такой контейнер обеспечивает конфиденциальность сообщения и контроль целостности через `authTag`.
