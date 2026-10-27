import { db } from '../database/connection.js';

export interface SessionRow {
  id: number;
  token_hash: string;
  user_id: number;
  creado_en: string;
  expira_en: string;
}

export function create(tokenHash: string, userId: number, creadoEn: string, expiraEn: string): void {
  db()
    .prepare('INSERT INTO sessions (token_hash, user_id, creado_en, expira_en) VALUES (?, ?, ?, ?)')
    .run(tokenHash, userId, creadoEn, expiraEn);
}

export function findByTokenHash(tokenHash: string): SessionRow | undefined {
  return db().prepare('SELECT * FROM sessions WHERE token_hash = ?').get(tokenHash) as SessionRow | undefined;
}

export function deleteByTokenHash(tokenHash: string): void {
  db().prepare('DELETE FROM sessions WHERE token_hash = ?').run(tokenHash);
}

export function deleteExpired(nowIso: string): void {
  db().prepare('DELETE FROM sessions WHERE expira_en <= ?').run(nowIso);
}
