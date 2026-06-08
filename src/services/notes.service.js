import * as notesRepository from '../repositories/notes.repository.js';
import { parseTags } from '../utils/tags.js';

/**
 * Создает ошибку с HTTP-статусом для единого ответа контроллеров.
 *
 * @param {number} status
 * @param {string} message
 * @returns {Error}
 */
function createHttpError(status, message) {
  const error = new Error(message);

  error.status = status;

  return error;
}

/**
 * Проверяет id из URL как положительное безопасное целое число.
 *
 * @param {string} value
 * @returns {number}
 */
function validateNoteId(value) {
  if (typeof value !== 'string' || !/^[0-9]+$/u.test(value)) {
    throw createHttpError(400, 'Invalid note id');
  }

  const noteId = Number.parseInt(value, 10);

  if (!Number.isSafeInteger(noteId) || noteId < 1) {
    throw createHttpError(400, 'Invalid note id');
  }

  return noteId;
}

/**
 * Нормализует заголовок заметки и применяет ограничения backend.
 *
 * @param {unknown} value
 * @returns {string}
 */
function validateTitle(value) {
  if (typeof value !== 'string') {
    throw createHttpError(400, 'Title is required');
  }

  const title = value.trim();

  if (title === '') {
    throw createHttpError(400, 'Title is required');
  }

  if (title.length > 255) {
    throw createHttpError(400, 'Title is too long');
  }

  return title;
}

/**
 * Нормализует content заметки; длина текста на backend не ограничивается.
 *
 * @param {unknown} value
 * @returns {string}
 */
function validateContent(value) {
  if (typeof value !== 'string') {
    throw createHttpError(400, 'Content is required');
  }

  const content = value.trim();

  if (content === '') {
    throw createHttpError(400, 'Content is required');
  }

  return content;
}

/**
 * Переводит ошибку парсинга тегов в публичную HTTP-ошибку API.
 *
 * @param {string} content
 * @returns {string[]}
 */
function parseContentTags(content) {
  try {
    return parseTags(content);
  } catch {
    throw createHttpError(400, 'Invalid tag format');
  }
}

/**
 * Собирает валидированные данные заметки перед записью в repository.
 *
 * @param {object | null | undefined} input
 * @returns {{ title: string, content: string, tags: string[] }}
 */
function validateNoteInput(input) {
  const source = input ?? {};
  const title = validateTitle(source.title);
  const content = validateContent(source.content);
  const tags = parseContentTags(content);

  return { title, content, tags };
}

/**
 * Очищает query-параметр и убирает пустые значения из фильтров.
 *
 * @param {unknown} value
 * @returns {string | undefined}
 */
function normalizeQueryValue(value) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmedValue = value.trim();

  if (trimmedValue === '') {
    return undefined;
  }

  return trimmedValue;
}

/**
 * Нормализует фильтры списка заметок; тег приводится к lowercase.
 *
 * @param {object} query
 * @returns {{ search: string | undefined, tag: string | undefined }}
 */
function normalizeFilters(query) {
  const search = normalizeQueryValue(query.search);
  const tag = normalizeQueryValue(query.tag);

  return {
    search,
    tag: tag === undefined ? undefined : tag.toLowerCase(),
  };
}

/**
 * Формирует публичную модель заметки и заново вычисляет tags из content.
 *
 * @param {object} row
 * @returns {{ id: number, title: string, content: string, tags: string[], createdAt: string, updatedAt: string }}
 */
function buildNote(row) {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: parseTags(row.content),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Возвращает список заметок с применением search/tag-фильтров из query.
 *
 * @param {object} query
 * @returns {Promise<object[]>}
 */
export async function getNotes(query) {
  const filters = normalizeFilters(query);
  const rows = await notesRepository.findNotes(filters);

  return rows.map(buildNote);
}

/**
 * Создает заметку после backend-валидации title/content и тегов.
 *
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function createNote(input) {
  const noteData = validateNoteInput(input);
  const row = await notesRepository.createNote(noteData);

  return buildNote(row);
}

/**
 * Возвращает одну заметку или HTTP 404, если id отсутствует в базе.
 *
 * @param {string} value
 * @returns {Promise<object>}
 */
export async function getNoteById(value) {
  const noteId = validateNoteId(value);
  const row = await notesRepository.findNoteById(noteId);

  if (row === null) {
    throw createHttpError(404, 'Note not found');
  }

  return buildNote(row);
}

/**
 * Полностью обновляет title/content заметки и пересчитывает связи с тегами.
 *
 * @param {string} value
 * @param {object} input
 * @returns {Promise<object>}
 */
export async function updateNote(value, input) {
  const noteId = validateNoteId(value);
  const noteData = validateNoteInput(input);
  const row = await notesRepository.updateNote(noteId, noteData);

  if (row === null) {
    throw createHttpError(404, 'Note not found');
  }

  return buildNote(row);
}

/**
 * Удаляет заметку по id или возвращает HTTP 404 для отсутствующей записи.
 *
 * @param {string} value
 * @returns {Promise<void>}
 */
export async function deleteNote(value) {
  const noteId = validateNoteId(value);
  const isDeleted = await notesRepository.deleteNote(noteId);

  if (!isDeleted) {
    throw createHttpError(404, 'Note not found');
  }
}
