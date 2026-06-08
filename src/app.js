import { readFileSync } from 'node:fs';
import cors from 'cors';
import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { parse } from 'yaml';
import notesRouter from './routes/notes.routes.js';

const openapiDocument = parse(
  readFileSync(new URL('../openapi.yaml', import.meta.url), 'utf8')
);

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(openapiDocument));
app.use('/api/v1/notes', notesRouter);
// Ошибка от express.json() превращается в 400, остальные непойманные ошибки скрываются за 500.
app.use((error, _req, res, _next) => {
  if (error.status === 400) {
    return res.status(400).json({ message: 'Invalid JSON' });
  }

  return res.status(500).json({ message: 'Internal Server Error' });
});

export default app;
