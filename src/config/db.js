import dotenv from 'dotenv';
import process from 'node:process';
import mysql from 'mysql2';

dotenv.config({ quiet: true });

const pool = mysql.createPool({
  host: process.env.DB_HOST ?? 'localhost',
  port: Number.parseInt(process.env.DB_PORT ?? '3306', 10),
  user: process.env.DB_USER ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'notes_db',
  waitForConnections: true,
  connectionLimit: 10,
  timezone: 'Z',
  charset: 'utf8mb4_unicode_ci',
});

// На каждом новом соединении фиксируется UTC, независимо от настроек MySQL-сервера.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'");
});

export default pool.promise();
