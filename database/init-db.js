import dotenv from 'dotenv';
import fs from 'node:fs/promises';
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
    multipleStatements: true,
    timezone: 'Z',
    charset: 'utf8mb4_unicode_ci',
  };
}

/**
 * Инициализирует схему базы из schema.sql и фиксирует UTC для текущей сессии.
 *
 * @returns {Promise<void>}
 */
async function main() {
  const connection = await mysql.createConnection(getConnectionConfig());

  try {
    const schema = await fs.readFile(new URL('./schema.sql', import.meta.url), 'utf8');

    await connection.query("SET time_zone = '+00:00'");
    await connection.query(schema);
    console.log('Таблицы базы данных инициализированы');
  } finally {
    await connection.end();
  }
}

/**
 * Выбирает понятный текст ошибки для CLI-вывода скрипта инициализации.
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

  return 'Не удалось инициализировать базу данных';
}

try {
  await main();
} catch (error) {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
}
