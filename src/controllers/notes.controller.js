import * as notesService from '../services/notes.service.js';

/**
 * Отправляет единый формат ошибки API: { message }.
 *
 * @param {object} res
 * @param {Error & { status?: number }} error
 * @returns {object}
 */
function sendError(res, error) {
  const status = error.status ?? 500;
  const message = error.status === undefined ? 'Internal Server Error' : error.message;

  return res.status(status).json({ message });
}

/**
 * Контроллер GET /notes: передает query-фильтры в service-слой.
 *
 * @param {object} req
 * @param {object} res
 * @returns {Promise<object>}
 */
export async function getNotes(req, res) {
  try {
    const notes = await notesService.getNotes(req.query);

    return res.status(200).json(notes);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Контроллер POST /notes: создает заметку и возвращает 201 с новой моделью.
 *
 * @param {object} req
 * @param {object} res
 * @returns {Promise<object>}
 */
export async function createNote(req, res) {
  try {
    const note = await notesService.createNote(req.body);

    return res.status(201).json(note);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Контроллер GET /notes/:id: возвращает одну заметку по route-параметру.
 *
 * @param {object} req
 * @param {object} res
 * @returns {Promise<object>}
 */
export async function getNoteById(req, res) {
  try {
    const note = await notesService.getNoteById(req.params.id);

    return res.status(200).json(note);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Контроллер PATCH /notes/:id: обновляет title/content целиком.
 *
 * @param {object} req
 * @param {object} res
 * @returns {Promise<object>}
 */
export async function updateNote(req, res) {
  try {
    const note = await notesService.updateNote(req.params.id, req.body);

    return res.status(200).json(note);
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Контроллер DELETE /notes/:id: успешное удаление отвечает 204 без тела.
 *
 * @param {object} req
 * @param {object} res
 * @returns {Promise<object>}
 */
export async function deleteNote(req, res) {
  try {
    await notesService.deleteNote(req.params.id);

    return res.status(204).send();
  } catch (error) {
    return sendError(res, error);
  }
}
