import { config } from './config.js';
import { closeDatabase, openDatabase } from './database/connection.js';
import { createApp } from './app.js';

try {
  openDatabase(config.dbPath);
} catch (err) {
  console.error(`No se pudo abrir la base de datos en ${config.dbPath}.`, err);
  process.exit(1);
}

const server = createApp().listen(config.port, '127.0.0.1', () => {
  console.log(`API del Pastillero digital en http://localhost:${config.port}/api (base: ${config.dbPath})`);
});

function apagar() {
  server.close(() => {
    closeDatabase();
    process.exit(0);
  });
}
process.on('SIGINT', apagar);
process.on('SIGTERM', apagar);
