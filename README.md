# API заметок

Backend для системы заметок с тегами.

## Требования

- Node.js
- MySQL

## Настройка

Создать `.env` по примеру `.env.example`.

Создать базу данных:

```sql
CREATE DATABASE notes_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Установить зависимости:

```bash
npm install
```

Создать таблицы:

```bash
npm run init-db
```

Запустить сервер:

```bash
npm start
```

Проверить код:

```bash
npm run lint
```

Публичный API описан в `openapi.yaml`.

Текущая версия API доступна с префиксом:

```text
http://localhost:3000/api/v1
```

Например:

```http
GET /api/v1/notes
```
