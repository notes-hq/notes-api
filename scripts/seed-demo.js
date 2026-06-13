import 'dotenv/config';
import { readFileSync } from 'node:fs';
import process from 'node:process';

const apiBaseUrl = getApiBaseUrl();
const demoNotes = JSON.parse(readFileSync(new URL('./data/demo-notes.json', import.meta.url), 'utf8'));

/**
 * Наполняет backend демонстрационными заметками через публичный HTTP API.
 *
 * @returns {Promise<void>}
 */
async function main() {
  printHeader();

  try {
    await checkBackendAvailability();
    const createdNotes = await createDemoNotes();

    printSuccess(`Создано демонстрационных записей: ${createdNotes.length}.`);
    printNotes(createdNotes);
    printSummary(createdNotes);
  } catch (error) {
    console.error('');
    console.error(`Ошибка наполнения демонстрационными данными: ${error.message}`);
    process.exitCode = 1;
  }
}

/**
 * Получает базовый URL API из окружения или собирает его из HOST/PORT текущей среды.
 *
 * @returns {string}
 */
function getApiBaseUrl() {
  const value = process.env.DEMO_API_BASE_URL ?? process.env.API_BASE_URL ?? getDefaultApiBaseUrl();

  return value.replace(/\/+$/u, '');
}

/**
 * Формирует локальный URL backend по тем же PORT/HOST, с которыми запускается сервер.
 *
 * @returns {string}
 */
function getDefaultApiBaseUrl() {
  const port = process.env.PORT ?? '3000';
  const host = process.env.HOST;
  const requestHost = host === undefined || host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host;

  return `http://${requestHost}:${port}/api/v1`;
}

/**
 * Проверяет, что backend доступен перед созданием демонстрационных данных.
 *
 * @returns {Promise<void>}
 */
async function checkBackendAvailability() {
  console.log('');
  console.log('Проверка доступности backend...');

  const response = await request('/notes');

  assert(Array.isArray(response.data), 'GET /notes вернул не массив.');
  printSuccess(`Backend отвечает. Сейчас в базе записей: ${response.data.length}.`);
}

/**
 * Последовательно создает все демонстрационные заметки через POST /notes.
 *
 * @returns {Promise<object[]>}
 */
async function createDemoNotes() {
  const createdNotes = [];
  const creationQueue = [...demoNotes].reverse();

  console.log('');
  console.log('Создание демонстрационных заметок...');

  // Backend сортирует новые заметки сверху, поэтому создаем записи в обратном порядке:
  // после наполнения интерфейс покажет демонстрационный набор в логической последовательности.
  for (const [index, payload] of creationQueue.entries()) {
    const note = await createNote(payload);
    createdNotes.push(note);
    console.log(`Создана запись ${index + 1}/${demoNotes.length}: [${note.id}] ${note.title}`);
  }

  return [...createdNotes].reverse();
}

/**
 * Создает одну заметку через публичный POST endpoint.
 *
 * @param {{ title: string, content: string }} payload
 * @returns {Promise<object>}
 */
async function createNote(payload) {
  const response = await request('/notes', {
    method: 'POST',
    body: payload,
    expectedStatus: 201,
  });

  assertNote(response.data);
  return response.data;
}

/**
 * Выполняет HTTP-запрос к backend API и проверяет ожидаемый HTTP-статус.
 *
 * @param {string} path
 * @param {{ method?: string, body?: object, expectedStatus?: number }} options
 * @returns {Promise<{ status: number, data: unknown }>}
 */
async function request(path, options = {}) {
  const method = options.method ?? 'GET';
  const expectedStatus = options.expectedStatus ?? 200;
  const headers = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  const url = `${apiBaseUrl}${path}`;
  let response;

  try {
    response = await fetch(url, {
      method,
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
  } catch (error) {
    throw new Error(getBackendUnavailableMessage(url, error), { cause: error });
  }

  const data = await readResponseBody(response);

  if (response.status !== expectedStatus) {
    throw new Error(
      `Ожидался HTTP ${expectedStatus}, получен HTTP ${response.status}. Ответ: ${formatData(data)}`
    );
  }

  return { status: response.status, data };
}

/**
 * Формирует понятную подсказку, если CLI-утилита не смогла подключиться к backend.
 *
 * @param {string} url
 * @param {unknown} error
 * @returns {string}
 */
function getBackendUnavailableMessage(url, error) {
  const reason = error instanceof Error ? error.message : String(error);

  return [
    `Backend недоступен по адресу ${url}.`,
    'Проверьте, что backend запущен командой npm start.',
    'Также проверьте HOST и PORT в .env: CLI-утилита использует их для локального URL API.',
    `Исходная ошибка: ${reason}`,
  ].join(' ');
}

/**
 * Читает JSON-ответ backend; для пустого тела возвращает null.
 *
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function readResponseBody(response) {
  const text = await response.text();

  if (text === '') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

/**
 * Проверяет минимальную структуру созданной заметки.
 *
 * @param {unknown} value
 * @returns {void}
 */
function assertNote(value) {
  assert(value !== null && typeof value === 'object', 'Ответ не является объектом заметки.');
  assert(Number.isInteger(value.id), 'В заметке отсутствует числовой id.');
  assert(typeof value.title === 'string', 'В заметке отсутствует строковый title.');
  assert(typeof value.content === 'string', 'В заметке отсутствует строковый content.');
  assert(Array.isArray(value.tags), 'В заметке отсутствует массив tags.');
}

/**
 * Завершает выполнение с ошибкой, если условие не выполнено.
 *
 * @param {boolean} condition
 * @param {string} message
 * @returns {void}
 */
function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

/**
 * Печатает вводную информацию о наполнении базы.
 *
 * @returns {void}
 */
function printHeader() {
  console.log('');
  console.log('Наполнение базы демонстрационными данными');
  console.log('='.repeat(48));
  console.log(`API: ${apiBaseUrl}`);
  console.log(`Количество демонстрационных записей: ${demoNotes.length}`);
  console.log('Очистка базы этой командой не выполняется.');
}

/**
 * Печатает сообщение об успешном действии.
 *
 * @param {string} message
 * @returns {void}
 */
function printSuccess(message) {
  console.log(`Успешно: ${message}`);
}

/**
 * Печатает список созданных демонстрационных записей.
 *
 * @param {object[]} notes
 * @returns {void}
 */
function printNotes(notes) {
  console.log('');
  console.log('Созданные демонстрационные записи');
  console.log('-'.repeat(35));

  for (const note of notes) {
    printNote(note);
  }
}

/**
 * Печатает одну демонстрационную заметку в читаемом консольном виде.
 *
 * @param {object} note
 * @returns {void}
 */
function printNote(note) {
  console.log('');
  console.log(`ID: ${note.id}`);
  console.log(`Заголовок: ${note.title}`);
  console.log(`Текст: ${note.content}`);
  console.log(`Теги: ${formatTags(note.tags)}`);
  console.log(`Создана: ${note.createdAt}`);
  console.log(`Обновлена: ${note.updatedAt}`);
}

/**
 * Печатает итоговую сводку наполнения базы.
 *
 * @param {object[]} notes
 * @returns {void}
 */
function printSummary(notes) {
  console.log('');
  console.log('Итоговая сводка');
  console.log('-'.repeat(15));
  console.log(`Создано демонстрационных записей: ${notes.length}`);
  console.log('Для полной очистки базы используйте команду: npm run clear-db');
}

/**
 * Форматирует массив тегов для консольного вывода.
 *
 * @param {string[]} tags
 * @returns {string}
 */
function formatTags(tags) {
  if (tags.length === 0) {
    return '(нет тегов)';
  }

  return tags.map((tag) => `#${tag}`).join(' ');
}

/**
 * Форматирует произвольный ответ API для диагностического сообщения.
 *
 * @param {unknown} data
 * @returns {string}
 */
function formatData(data) {
  if (typeof data === 'string') {
    return data;
  }

  return JSON.stringify(data);
}

await main();
