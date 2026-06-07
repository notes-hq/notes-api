import pool from '../config/db.js';

const noteSelect = `
  notes.id,
  notes.title,
  notes.content,
  DATE_FORMAT(notes.created_at, '%Y-%m-%dT%H:%i:%s.000Z') AS createdAt,
  DATE_FORMAT(notes.updated_at, '%Y-%m-%dT%H:%i:%s.000Z') AS updatedAt
`;

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

async function saveNoteTags(connection, noteId, tags) {
  for (const tag of tags) {
    await connection.execute('INSERT IGNORE INTO tags (name) VALUES (?)', [tag]);

    const [tagRows] = await connection.execute('SELECT id FROM tags WHERE name = ? LIMIT 1', [tag]);
    const tagId = tagRows[0].id;

    await connection.execute('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)', [
      noteId,
      tagId,
    ]);
  }
}

export async function findNotes(filters) {
  const params = [];
  const sql = buildFindNotesSql(filters, params);
  const [rows] = await pool.execute(sql, params);

  return rows;
}

export async function findNoteById(noteId) {
  return await findNoteByIdWithConnection(pool, noteId);
}

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

export async function deleteNote(noteId) {
  const [result] = await pool.execute('DELETE FROM notes WHERE id = ?', [noteId]);

  return result.affectedRows > 0;
}
