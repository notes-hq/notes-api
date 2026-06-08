import pool from '../config/db.js';

const noteSelect = `
  notes.id,
  notes.title,
  notes.content,
  DATE_FORMAT(notes.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
  DATE_FORMAT(notes.updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt
`;

/**
 * Собирает SQL списка заметок по опциональным фильтрам.
 * LOWER() оставлен явно, чтобы регистронезависимость не зависела только от collation MySQL.
 *
 * @param {{ search?: string, tag?: string }} filters
 * @param {unknown[]} params
 * @returns {string}
 */
function buildFindNotesSql(filters, params) {
  const sqlParts = [`SELECT ${noteSelect} FROM notes`];
  const whereParts = [];

  if (filters.tag !== undefined) {
    sqlParts.push('JOIN note_tags ON note_tags.note_id = notes.id');
    sqlParts.push('JOIN tags ON tags.id = note_tags.tag_id');
    whereParts.push('LOWER(tags.name) = ?');
    params.push(filters.tag);
  }

  if (filters.search !== undefined) {
    whereParts.push('(LOWER(notes.title) LIKE ? OR LOWER(notes.content) LIKE ?)');
    params.push(`%${filters.search.toLowerCase()}%`);
    params.push(`%${filters.search.toLowerCase()}%`);
  }

  if (whereParts.length > 0) {
    sqlParts.push(`WHERE ${whereParts.join(' AND ')}`);
  }

  sqlParts.push('ORDER BY notes.created_at DESC, notes.id DESC');

  return sqlParts.join(' ');
}

/**
 * Читает заметку через переданное соединение, чтобы транзакции могли вернуть актуальную строку.
 *
 * @param {object} connection
 * @param {number} noteId
 * @returns {Promise<object | null>}
 */
async function findNoteByIdWithConnection(connection, noteId) {
  const [rows] = await connection.execute(
    `SELECT ${noteSelect} FROM notes WHERE notes.id = ? LIMIT 1`,
    [noteId],
  );

  if (rows.length === 0) {
    return null;
  }

  return rows[0];
}

/**
 * Сохраняет связи заметки с тегами внутри той же транзакции, что и сама заметка.
 *
 * @param {object} connection
 * @param {number} noteId
 * @param {string[]} tags
 * @returns {Promise<void>}
 */
async function saveNoteTags(connection, noteId, tags) {
  for (const tag of tags) {
    // INSERT IGNORE делает создание тега идемпотентным при повторном использовании имени.
    await connection.execute('INSERT IGNORE INTO tags (name) VALUES (?)', [tag]);

    const [tagRows] = await connection.execute('SELECT id FROM tags WHERE name = ? LIMIT 1', [tag]);
    const tagId = tagRows[0].id;

    await connection.execute('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', [
      noteId,
      tagId,
    ]);
  }
}

/**
 * Возвращает строки заметок с учетом уже нормализованных фильтров.
 *
 * @param {{ search?: string, tag?: string }} filters
 * @returns {Promise<object[]>}
 */
export async function findNotes(filters) {
  const params = [];
  const sql = buildFindNotesSql(filters, params);
  const [rows] = await pool.execute(sql, params);

  return rows;
}

/**
 * Ищет заметку по числовому id без обработки HTTP-ошибок.
 *
 * @param {number} noteId
 * @returns {Promise<object | null>}
 */
export async function findNoteById(noteId) {
  return await findNoteByIdWithConnection(pool, noteId);
}

/**
 * Создает заметку и ее связи с тегами одной транзакцией.
 *
 * @param {{ title: string, content: string, tags: string[] }} noteData
 * @returns {Promise<object>}
 */
export async function createNote(noteData) {
  const connection = await pool.getConnection();
  let shouldRollback = true;

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute(
      'INSERT INTO notes (title, content) VALUES (?, ?)',
      [noteData.title, noteData.content],
    );
    const noteId = result.insertId;

    await saveNoteTags(connection, noteId, noteData.tags);
    await connection.commit();
    shouldRollback = false;

    // Строка читается тем же соединением, чтобы вернуть результат сразу после commit.
    return findNoteByIdWithConnection(connection, noteId);
  } catch (error) {
    if (shouldRollback) {
      await connection.rollback();
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Обновляет заметку и полностью пересоздает набор ее тегов в одной транзакции.
 *
 * @param {number} noteId
 * @param {{ title: string, content: string, tags: string[] }} noteData
 * @returns {Promise<object | null>}
 */
export async function updateNote(noteId, noteData) {
  const connection = await pool.getConnection();
  let shouldRollback = true;

  try {
    await connection.beginTransaction();

    const existingNote = await findNoteByIdWithConnection(connection, noteId);

    if (existingNote === null) {
      await connection.rollback();
      shouldRollback = false;

      return null;
    }

    await connection.execute('UPDATE notes SET title = ?, content = ? WHERE id = ?', [
      noteData.title,
      noteData.content,
      noteId,
    ]);
    await connection.execute('DELETE FROM note_tags WHERE note_id = ?', [noteId]);
    await saveNoteTags(connection, noteId, noteData.tags);
    await connection.commit();
    shouldRollback = false;

    // После commit возвращается строка с обновленными timestamp-полями.
    return findNoteByIdWithConnection(connection, noteId);
  } catch (error) {
    if (shouldRollback) {
      await connection.rollback();
    }

    throw error;
  } finally {
    connection.release();
  }
}

/**
 * Удаляет заметку и сообщает, была ли реально удалена строка.
 *
 * @param {number} noteId
 * @returns {Promise<boolean>}
 */
export async function deleteNote(noteId) {
  const [result] = await pool.execute('DELETE FROM notes WHERE id = ?', [noteId]);

  return result.affectedRows > 0;
}
