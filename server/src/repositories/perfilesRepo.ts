import { db } from '../database/connection.js';
import type { PerfilRow } from '../types/index.js';

export function create(titularUserId: number, nombre: string, planDesde: string, creadoEn: string): number {
  const r = db()
    .prepare('INSERT INTO perfiles (titular_user_id, nombre, plan_desde, creado_en) VALUES (?, ?, ?, ?)')
    .run(titularUserId, nombre, planDesde, creadoEn);
  return Number(r.lastInsertRowid);
}

export function findById(id: number): PerfilRow | undefined {
  return db().prepare('SELECT * FROM perfiles WHERE id = ?').get(id) as PerfilRow | undefined;
}

export function findByTitular(userId: number): PerfilRow | undefined {
  return db().prepare('SELECT * FROM perfiles WHERE titular_user_id = ?').get(userId) as PerfilRow | undefined;
}

export function findLinkedToFamiliar(userId: number): (PerfilRow & { vinculado_en: string })[] {
  return db()
    .prepare(
      `SELECT p.*, v.creado_en AS vinculado_en FROM perfiles p
       JOIN vinculos v ON v.perfil_id = p.id
       WHERE v.familiar_user_id = ? ORDER BY p.nombre`,
    )
    .all(userId) as unknown as (PerfilRow & { vinculado_en: string })[];
}

export function updatePlanDesde(id: number, fecha: string): void {
  db().prepare('UPDATE perfiles SET plan_desde = ? WHERE id = ?').run(fecha, id);
}
