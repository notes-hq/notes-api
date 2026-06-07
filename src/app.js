import cors from 'cors';
import express from 'express';
import notesRouter from './routes/notes.routes.js';

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/v1/notes', notesRouter);
app.use((error, _req, res, _next) => {
  if (error.status === 400) {
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  return res.status(500).json({ message: 'Internal Server Error' });
});

export default app;
