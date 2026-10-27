import { db } from '../database/connection.js';
import type { EventoRow } from '../types/index.js';

export function create(e: {
  perfilId: number;
  userId: number | null;
  fecha: string;
  tipo: string;
  descripcion: string;
  creadoEn: string;
}): void {
  db()
    .prepare('INSERT INTO eventos (perfil_id, user_id, fecha, tipo, descripcion, creado_en) VALUES (?, ?, ?, ?, ?, ?)')
    .run(e.perfilId, e.userId, e.fecha, e.tipo, e.descripcion, e.creadoEn);
}

export function delDia(perfilId: number, fecha: string): (EventoRow & { user_nombre: string | null })[] {
  return db()
    .prepare(
      `SELECT e.*, u.nombre AS user_nombre FROM eventos e LEFT JOIN users u ON u.id = e.user_id
       WHERE e.perfil_id = ? AND e.fecha = ? ORDER BY e.creado_en, e.id`,
    )
    .all(perfilId, fecha) as unknown as (EventoRow & { user_nombre: string | null })[];
}
