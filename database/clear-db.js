import dotenv from 'dotenv';
import process from 'node:process';
import mysql from 'mysql2/promise';

dotenv.config({ quiet: true });

/**
 * Собирает параметры подключения к MySQL из env с локальными значениями по умолчанию.
 *
 * @returns {object}
 */
function getConnectionConfig() {
  return {
    host: process.env.DB_HOST ?? 'localhost',
    port: Number.parseInt(process.env.DB_PORT ?? '3306', 10),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'notes_db',
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
  };
}

/**
 * Очищает данные таблиц и сбрасывает AUTO_INCREMENT для повторяемых ручных проверок.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const connection = await mysql.createConnection(getConnectionConfig());
  const statements = [
    'DELETE FROM note_tags',
    'DELETE FROM tags',
    'DELETE FROM notes',
    'ALTER TABLE notes AUTO_INCREMENT = 1',
    'ALTER TABLE tags AUTO_INCREMENT = 1',
  ];

  try {
    await connection.query("SET time_zone = '+00:00'");

    for (const statement of statements) {
      await connection.query(statement);
    }

    console.log('Данные базы данных очищены');
  } finally {
    await connection.end();
  }
}

/**
 * Выбирает понятный текст ошибки для CLI-вывода скрипта очистки.
 *
 * @param {Error & { code?: string }} error
 * @returns {string}
 */
function getErrorMessage(error) {
  if (error.message !== '') {
    return error.message;
  }

  if (error.code !== undefined) {
    return error.code;
  }

  return 'Не удалось очистить данные базы данных';
}

try {
  await main();
} catch (error) {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
}
