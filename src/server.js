import process from 'node:process';
import app from './app.js';

const port = process.env.PORT ?? 3000;
const host = process.env.HOST ?? '0.0.0.0';

const server = app.listen(port, host, () => {
  console.log(`Server is running on ${host}:${port}`);
});

server.on('error', (error) => {
  throw error;
});
