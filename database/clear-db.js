import dotenv from 'dotenv';
import process from 'node:process';
import mysql from 'mysql2/promise';

dotenv.config({ quiet: true });

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

    console.log('Database data cleared');
  } finally {
    await connection.end();
  }
}

function getErrorMessage(error) {
  if (error.message !== '') {
    return error.message;
  }

  if (error.code !== undefined) {
    return error.code;
  }

  return 'Database clearing failed';
}

try {
  await main();
} catch (error) {
  console.error(getErrorMessage(error));
  process.exitCode = 1;
}
