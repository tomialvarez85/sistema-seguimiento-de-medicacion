import path from 'node:path';
import { fileURLToPath } from 'node:url';

const serverRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function resolveDbPath(value: string | undefined): string {
  if (!value) return path.resolve(serverRoot, '..', 'data', 'pastillero.sqlite');
  if (value === ':memory:') return value;
  return path.isAbsolute(value) ? value : path.resolve(serverRoot, value);
}

export const config = {
  port: Number(process.env.API_PORT ?? 3001),
  dbPath: resolveDbPath(process.env.DB_PATH),
  clientOrigins: (process.env.CLIENT_ORIGIN ?? 'http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  sessionDays: Number(process.env.SESSION_DAYS ?? 7),
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  linkCodeHours: Number(process.env.LINK_CODE_HOURS ?? 48),
};
