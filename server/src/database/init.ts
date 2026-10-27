// Crea el archivo de la base de datos (si no existe) y aplica las migraciones pendientes.
// No borra ni reemplaza datos existentes.
import { config } from '../config.js';
import { closeDatabase, openDatabase } from './connection.js';

openDatabase(config.dbPath);
closeDatabase();
console.log(`Base de datos lista en ${config.dbPath}`);
