import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { migrations } from './migrations.js';

let current: DatabaseSync | null = null;

export function db(): DatabaseSync {
  if (!current) throw new Error('La base de datos no está abierta');
  return current;
}

export function openDatabase(dbPath: string): DatabaseSync {
  closeDatabase();
  if (dbPath !== ':memory:') fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const database = new DatabaseSync(dbPath);
  database.exec('PRAGMA foreign_keys = ON;');
  database.exec('PRAGMA busy_timeout = 5000;');
  if (dbPath !== ':memory:') database.exec('PRAGMA journal_mode = WAL;');
  runMigrations(database);
  current = database;
  return database;
}

export function closeDatabase(): void {
  if (current) {
    current.close();
    current = null;
  }
}

function runMigrations(database: DatabaseSync): void {
  database.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
    version INTEGER PRIMARY KEY, nombre TEXT NOT NULL, aplicado_en TEXT NOT NULL)`);
  const applied = new Set(
    (database.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version),
  );
  for (const m of migrations) {
    if (applied.has(m.version)) continue;
    // PRAGMA foreign_keys no tiene efecto dentro de una transacción: hay que apagarlo antes de empezarla.
    if (m.requiereForeignKeysOff) database.exec('PRAGMA foreign_keys = OFF;');
    try {
      transaction(database, () => {
        database.exec(m.sql);
        if (m.requiereForeignKeysOff) {
          const huerfanos = database.prepare('PRAGMA foreign_key_check').all();
          if (huerfanos.length > 0) throw new Error(`La migración ${m.version} dejó referencias inválidas`);
        }
        database
          .prepare('INSERT INTO schema_migrations (version, nombre, aplicado_en) VALUES (?, ?, ?)')
          .run(m.version, m.nombre, new Date().toISOString());
      });
    } finally {
      if (m.requiereForeignKeysOff) database.exec('PRAGMA foreign_keys = ON;');
    }
  }
}

let depth = 0;

export function transaction<T>(database: DatabaseSync, fn: () => T): T {
  // Las transacciones anidadas se integran a la exterior.
  if (depth > 0) return fn();
  database.exec('BEGIN IMMEDIATE');
  depth++;
  try {
    const result = fn();
    depth--;
    database.exec('COMMIT');
    return result;
  } catch (err) {
    depth--;
    database.exec('ROLLBACK');
    throw err;
  }
}

/** Ejecuta fn en una transacción sobre la base abierta. */
export function tx<T>(fn: () => T): T {
  return transaction(db(), fn);
}

export function isUniqueViolation(err: unknown): boolean {
  return err instanceof Error && /UNIQUE constraint failed/i.test(err.message);
}
