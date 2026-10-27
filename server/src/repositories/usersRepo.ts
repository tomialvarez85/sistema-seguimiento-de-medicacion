import { db } from '../database/connection.js';
import type { PublicUser, Rol, UserRow } from '../types/index.js';

export function findByEmail(email: string): UserRow | undefined {
  return db().prepare('SELECT * FROM users WHERE email = ?').get(email) as UserRow | undefined;
}

export function findById(id: number): UserRow | undefined {
  return db().prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
}

export function create(data: { nombre: string; email: string; passwordHash: string; rol: Rol; creadoEn: string }): number {
  const r = db()
    .prepare('INSERT INTO users (nombre, email, password_hash, rol, creado_en) VALUES (?, ?, ?, ?, ?)')
    .run(data.nombre, data.email, data.passwordHash, data.rol, data.creadoEn);
  return Number(r.lastInsertRowid);
}

export function toPublic(u: UserRow): PublicUser {
  return { id: u.id, nombre: u.nombre, email: u.email, rol: u.rol };
}
