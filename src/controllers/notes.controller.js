import * as notesService from '../services/notes.service.js';

function sendError(res, error) {
  const status = error.status ?? 500;
  const message = error.status === undefined ? 'Internal Server Error' : error.message;

  return res.status(status).json({ message });
}

export async function getNotes(req, res) {
  try {
    const notes = await notesService.getNotes(req.query);

    return res.status(200).json(notes);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function createNote(req, res) {
  try {
    const note = await notesService.createNote(req.body);

    return res.status(201).json(note);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function getNoteById(req, res) {
  try {
    const note = await notesService.getNoteById(req.params.id);

    return res.status(200).json(note);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function updateNote(req, res) {
  try {
    const note = await notesService.updateNote(req.params.id, req.body);

    return res.status(200).json(note);
  } catch (error) {
    return sendError(res, error);
  }
}

export async function deleteNote(req, res) {
  try {
    await notesService.deleteNote(req.params.id);

    return res.status(204).send();
  } catch (error) {
    return sendError(res, error);
  }
}
