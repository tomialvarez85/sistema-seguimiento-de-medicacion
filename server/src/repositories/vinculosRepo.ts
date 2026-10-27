import { db } from '../database/connection.js';

export interface CodigoRow {
  id: number;
  perfil_id: number;
  codigo: string;
  creado_en: string;
  expira_en: string;
  usado_en: string | null;
  usado_por: number | null;
  anulado_en: string | null;
}

export function exists(perfilId: number, familiarUserId: number): boolean {
  return !!db()
    .prepare('SELECT 1 FROM vinculos WHERE perfil_id = ? AND familiar_user_id = ?')
    .get(perfilId, familiarUserId);
}

export function create(perfilId: number, familiarUserId: number, creadoEn: string): void {
  db()
    .prepare('INSERT INTO vinculos (perfil_id, familiar_user_id, creado_en) VALUES (?, ?, ?)')
    .run(perfilId, familiarUserId, creadoEn);
}

export function remove(perfilId: number, familiarUserId: number): boolean {
  const r = db()
    .prepare('DELETE FROM vinculos WHERE perfil_id = ? AND familiar_user_id = ?')
    .run(perfilId, familiarUserId);
  return Number(r.changes) > 0;
}

export function listFamiliares(perfilId: number): { id: number; nombre: string; email: string; vinculado_en: string }[] {
  return db()
    .prepare(
      `SELECT u.id, u.nombre, u.email, v.creado_en AS vinculado_en FROM vinculos v
       JOIN users u ON u.id = v.familiar_user_id WHERE v.perfil_id = ? ORDER BY v.creado_en`,
    )
    .all(perfilId) as { id: number; nombre: string; email: string; vinculado_en: string }[];
}

// --- Códigos de vinculación ---

export function anularCodigosActivos(perfilId: number, ahora: string): void {
  db()
    .prepare('UPDATE codigos_vinculacion SET anulado_en = ? WHERE perfil_id = ? AND usado_en IS NULL AND anulado_en IS NULL')
    .run(ahora, perfilId);
}

export function crearCodigo(perfilId: number, codigo: string, creadoEn: string, expiraEn: string): void {
  db()
    .prepare('INSERT INTO codigos_vinculacion (perfil_id, codigo, creado_en, expira_en) VALUES (?, ?, ?, ?)')
    .run(perfilId, codigo, creadoEn, expiraEn);
}

export function codigoActivo(perfilId: number, ahora: string): CodigoRow | undefined {
  return db()
    .prepare(
      `SELECT * FROM codigos_vinculacion
       WHERE perfil_id = ? AND usado_en IS NULL AND anulado_en IS NULL AND expira_en > ?
       ORDER BY id DESC LIMIT 1`,
    )
    .get(perfilId, ahora) as CodigoRow | undefined;
}

export function findCodigo(codigo: string): CodigoRow | undefined {
  return db().prepare('SELECT * FROM codigos_vinculacion WHERE codigo = ?').get(codigo) as CodigoRow | undefined;
}

export function marcarCodigoUsado(id: number, userId: number, ahora: string): void {
  db().prepare('UPDATE codigos_vinculacion SET usado_en = ?, usado_por = ? WHERE id = ?').run(ahora, userId, id);
}

export function registrarIntento(userId: number, exito: boolean, ahora: string): void {
  db()
    .prepare('INSERT INTO intentos_vinculacion (user_id, exito, creado_en) VALUES (?, ?, ?)')
    .run(userId, exito ? 1 : 0, ahora);
}

export function intentosFallidosDesde(userId: number, desde: string): number {
  const r = db()
    .prepare('SELECT COUNT(*) AS n FROM intentos_vinculacion WHERE user_id = ? AND exito = 0 AND creado_en > ?')
    .get(userId, desde) as { n: number };
  return Number(r.n);
}
