import 'dotenv/config';
import process from 'node:process';

const apiBaseUrl = getApiBaseUrl();
const runMarker = createRunMarker();
const createdNoteIds = [];
let passedChecks = 0;
let failedChecks = 0;
let createdNotesCount = 0;
let deletedNotesCount = 0;

const testNotes = [
  {
    title: `[СЦЕНАРИЙ ПРОВЕРКИ] Основная заметка ${runMarker}`,
    content: `Текст первой заметки для проверки создания и получения по id.\n#scenario_test #api_check #${runMarker}`,
  },
  {
    title: `[СЦЕНАРИЙ ПРОВЕРКИ] Поиск ${runMarker}`,
    content: `Эта заметка содержит уникальное слово search_${runMarker} для проверки search.\n#scenario_test #search_check`,
  },
  {
    title: `[СЦЕНАРИЙ ПРОВЕРКИ] Фильтр ${runMarker}`,
    content: 'Заметка для проверки фильтрации по тегу.\n#scenario_test #filter_check',
  },
];

/**
 * Запускает полный сценарий проверки API и гарантирует очистку созданных записей.
 *
 * @returns {Promise<void>}
 */
async function main() {
  printHeader();

  try {
    await runStep('Проверка доступности backend', async () => {
      const notes = await getNotes();
      printSuccess(`Backend отвечает. Сейчас в списке заметок: ${notes.length}.`);
    });

    const createdNotes = await runStep('Создание тестовых заметок', async () => {
      const notes = [];

      for (const noteData of testNotes) {
        const note = await createNote(noteData);
        createdNoteIds.push(note.id);
        createdNotesCount += 1;
        notes.push(note);
      }

      printSuccess(`Создано тестовых записей: ${notes.length}.`);
      printNotes(notes);
      return notes;
    });

    await runStep('Проверка общего списка заметок', async () => {
      const notes = await getNotes();
      const createdFromList = notes.filter((note) => createdNoteIds.includes(note.id));

      assert(
        createdFromList.length === createdNoteIds.length,
        'Не все созданные заметки найдены в общем списке.'
      );

      printSuccess('Все созданные заметки найдены в общем списке.');
      printNotes(createdFromList);
    });

    await runStep('Получение заметки по id', async () => {
      const note = await getNoteById(createdNotes[0].id);

      assert(note.id === createdNotes[0].id, 'GET по id вернул не ту заметку.');
      printSuccess(`Заметка ${note.id} успешно получена по id.`);
      printNote(note);
    });

    await runStep('Проверка поиска по строке', async () => {
      const searchValue = `search_${runMarker}`;
      const notes = await getNotes({ search: searchValue });

      assert(
        notes.some((note) => note.id === createdNotes[1].id),
        'Поиск не вернул ожидаемую заметку.'
      );

      printSuccess(`Поиск по строке "${searchValue}" вернул ожидаемую запись.`);
      printNotes(notes);
    });

    await runStep('Проверка фильтрации по тегу', async () => {
      const notes = await getNotes({ tag: 'filter_check' });

      assert(
        notes.some((note) => note.id === createdNotes[2].id),
        'Фильтр по тегу не вернул ожидаемую заметку.'
      );

      printSuccess('Фильтр по тегу #filter_check вернул ожидаемую запись.');
      printNotes(notes.filter((note) => createdNoteIds.includes(note.id)));
    });

    await runStep('Обновление заметки через PATCH', async () => {
      const updatedPayload = {
        title: `[СЦЕНАРИЙ ПРОВЕРКИ] Обновленная заметка ${runMarker}`,
        content: `Текст заметки обновлен через PATCH.\n#scenario_test #updated_check #${runMarker}`,
      };
      const note = await updateNote(createdNotes[0].id, updatedPayload);

      assert(note.title === updatedPayload.title, 'Заголовок после PATCH не обновился.');
      assert(
        note.tags.includes('updated_check'),
        'После PATCH не найден ожидаемый тег updated_check.'
      );

      printSuccess('Заметка успешно обновлена.');
      printNote(note);
    });

    await runStep('Проверка ответа 400 для некорректных данных', async () => {
      const response = await request('/notes', {
        method: 'POST',
        body: { title: '', content: 'Тело без корректного заголовка' },
        expectedStatus: 400,
      });

      assert(
        typeof response.data.message === 'string',
        'Ответ 400 не содержит поле message.'
      );

      printSuccess(`Backend вернул 400 с сообщением: ${response.data.message}`);
    });

    const deletedId = createdNotes[0].id;

    await runStep('Удаление созданных тестовых записей', async () => {
      await cleanupCreatedNotes();
      printSuccess('Все созданные сценарием записи удалены.');
    });

    await runStep('Проверка ответа 404 после удаления', async () => {
      const response = await request(`/notes/${deletedId}`, {
        expectedStatus: 404,
      });

      assert(
        typeof response.data.message === 'string',
        'Ответ 404 не содержит поле message.'
      );

      printSuccess(`Backend вернул 404 для удаленной записи: ${response.data.message}`);
    });
  } catch (error) {
    failedChecks += 1;
    printError(error.message);
    process.exitCode = 1;
  } finally {
    await cleanupCreatedNotes();
    printSummary();
  }
}

/**
 * Получает базовый URL API из окружения или собирает его из HOST/PORT текущей среды.
 *
 * @returns {string}
 */
function getApiBaseUrl() {
  const value = process.env.TEST_API_BASE_URL ?? process.env.API_BASE_URL ?? getDefaultApiBaseUrl();

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
 * Создает безопасный уникальный маркер, по которому записи текущего запуска легко отличить.
 *
 * @returns {string}
 */
function createRunMarker() {
  return `scenario_${new Date().toISOString().replace(/\D/gu, '').slice(0, 14)}`;
}

/**
 * Выполняет один именованный шаг сценария и ведет счетчик успешных проверок.
 *
 * @param {string} title
 * @param {() => Promise<unknown>} action
 * @returns {Promise<unknown>}
 */
async function runStep(title, action) {
  printSection(`${passedChecks + failedChecks + 1}. ${title}`);
  const result = await action();
  passedChecks += 1;
  return result;
}

/**
 * Выполняет HTTP-запрос к backend API и проверяет ожидаемый HTTP-статус.
 *
 * @param {string} path
 * @param {{ method?: string, body?: object, expectedStatus?: number, query?: Record<string, string | undefined> }} options
 * @returns {Promise<{ status: number, data: unknown }>}
 */
async function request(path, options = {}) {
  const method = options.method ?? 'GET';
  const expectedStatus = options.expectedStatus ?? 200;
  const url = buildUrl(path, options.query);
  const headers = {};

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

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
 * Строит URL с query-параметрами без добавления пустых значений.
 *
 * @param {string} path
 * @param {Record<string, string | undefined>} query
 * @returns {string}
 */
function buildUrl(path, query = {}) {
  const url = new URL(`${apiBaseUrl}${path}`);

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value.trim() !== '') {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}

/**
 * Читает JSON-ответ backend; для 204 No Content возвращает null.
 *
 * @param {Response} response
 * @returns {Promise<unknown>}
 */
async function readResponseBody(response) {
  if (response.status === 204) {
    return null;
  }

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
 * Загружает список заметок с необязательными фильтрами.
 *
 * @param {{ search?: string, tag?: string }} filters
 * @returns {Promise<object[]>}
 */
async function getNotes(filters = {}) {
  const response = await request('/notes', {
    query: {
      search: filters.search,
      tag: filters.tag,
    },
  });

  assert(Array.isArray(response.data), 'GET /notes вернул не массив.');
  return response.data;
}

/**
 * Создает заметку через публичный POST endpoint.
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
 * Получает одну заметку по id через публичный GET endpoint.
 *
 * @param {number} id
 * @returns {Promise<object>}
 */
async function getNoteById(id) {
  const response = await request(`/notes/${id}`);

  assertNote(response.data);
  return response.data;
}

/**
 * Обновляет заметку через PATCH endpoint и возвращает обновленную модель.
 *
 * @param {number} id
 * @param {{ title: string, content: string }} payload
 * @returns {Promise<object>}
 */
async function updateNote(id, payload) {
  const response = await request(`/notes/${id}`, {
    method: 'PATCH',
    body: payload,
  });

  assertNote(response.data);
  return response.data;
}

/**
 * Удаляет заметку по id через публичный DELETE endpoint.
 *
 * @param {number} id
 * @returns {Promise<void>}
 */
async function deleteNote(id) {
  await request(`/notes/${id}`, {
    method: 'DELETE',
    expectedStatus: 204,
  });
}

/**
 * Удаляет только те записи, которые были созданы текущим запуском сценария.
 *
 * @returns {Promise<void>}
 */
async function cleanupCreatedNotes() {
  while (createdNoteIds.length > 0) {
    const id = createdNoteIds.pop();

    try {
      await deleteNote(id);
      deletedNotesCount += 1;
    } catch (error) {
      if (!error.message.includes('HTTP 404')) {
        console.warn(`Предупреждение: не удалось удалить тестовую запись ${id}: ${error.message}`);
      }
    }
  }
}

/**
 * Проверяет минимальную структуру модели заметки, достаточную для сценария.
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
 * Завершает сценарий с ошибкой, если условие не выполнено.
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
 * Печатает заголовок сценария и параметры запуска.
 *
 * @returns {void}
 */
function printHeader() {
  console.log('');
  console.log('Сценарная проверка backend API системы заметок');
  console.log('='.repeat(55));
  console.log(`API: ${apiBaseUrl}`);
  console.log(`Маркер запуска: ${runMarker}`);
}

/**
 * Печатает заголовок одного шага проверки.
 *
 * @param {string} title
 * @returns {void}
 */
function printSection(title) {
  console.log('');
  console.log(title);
  console.log('-'.repeat(title.length));
}

/**
 * Печатает сообщение об успешном выполнении шага.
 *
 * @param {string} message
 * @returns {void}
 */
function printSuccess(message) {
  console.log(`Успешно: ${message}`);
}

/**
 * Печатает сообщение об ошибке сценария.
 *
 * @param {string} message
 * @returns {void}
 */
function printError(message) {
  console.error('');
  console.error(`Ошибка сценария: ${message}`);
}

/**
 * Печатает итоговую сводку сценария.
 *
 * @returns {void}
 */
function printSummary() {
  const totalChecks = passedChecks + failedChecks;

  console.log('');
  console.log('Итоговая сводка');
  console.log('-'.repeat(15));
  console.log(`Выполнено проверок: ${totalChecks}`);
  console.log(`Успешных проверок: ${passedChecks}`);
  console.log(`Ошибок: ${failedChecks}`);
  console.log(`Создано тестовых записей: ${createdNotesCount}`);
  console.log(`Удалено тестовых записей: ${deletedNotesCount}`);
  console.log(`Неудаленных тестовых записей: ${createdNoteIds.length}`);
}

/**
 * Печатает список заметок в читаемом консольном виде.
 *
 * @param {object[]} notes
 * @returns {void}
 */
function printNotes(notes) {
  console.log(`Найдено записей: ${notes.length}`);

  for (const note of notes) {
    printNote(note);
  }
}

/**
 * Печатает одну заметку с основными полями и тегами.
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
