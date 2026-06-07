import * as notesRepository from '../repositories/notes.repository.js';
import { parseTags } from '../utils/tags.js';

function createHttpError(status, message) {
  const error = new Error(message);

  error.status = status;

  return error;
}

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

function parseContentTags(content) {
  try {
    return parseTags(content);
  } catch {
    throw createHttpError(400, 'Invalid tag format');
  }
}

function validateNoteInput(input) {
  const source = input ?? {};
  const title = validateTitle(source.title);
  const content = validateContent(source.content);
  const tags = parseContentTags(content);

  return { title, content, tags };
}

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

function normalizeFilters(query) {
  const search = normalizeQueryValue(query.search);
  const tag = normalizeQueryValue(query.tag);

  return {
    search,
    tag: tag === undefined ? undefined : tag.toLowerCase(),
  };
}

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

export async function getNotes(query) {
  const filters = normalizeFilters(query);
  const rows = await notesRepository.findNotes(filters);

  return rows.map(buildNote);
}

export async function createNote(input) {
  const noteData = validateNoteInput(input);
  const row = await notesRepository.createNote(noteData);

  return buildNote(row);
}

export async function getNoteById(value) {
  const noteId = validateNoteId(value);
  const row = await notesRepository.findNoteById(noteId);

  if (row === null) {
    throw createHttpError(404, 'Note not found');
  }

  return buildNote(row);
}

export async function updateNote(value, input) {
  const noteId = validateNoteId(value);
  const noteData = validateNoteInput(input);
  const row = await notesRepository.updateNote(noteId, noteData);

  if (row === null) {
    throw createHttpError(404, 'Note not found');
  }

  return buildNote(row);
}

export async function deleteNote(value) {
  const noteId = validateNoteId(value);
  const isDeleted = await notesRepository.deleteNote(noteId);

  if (!isDeleted) {
    throw createHttpError(404, 'Note not found');
  }
}
