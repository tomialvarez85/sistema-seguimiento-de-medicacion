import { db } from '../database/connection.js';
import type { EstadoToma, OrigenToma, TomaRow } from '../types/index.js';

export function vigente(planItemId: number): TomaRow | undefined {
  return db().prepare('SELECT * FROM tomas WHERE plan_item_id = ? AND anulado_en IS NULL').get(planItemId) as
    | TomaRow
    | undefined;
}

export function create(t: {
  planItemId: number;
  perfilId: number;
  estado: EstadoToma;
  tarde: boolean;
  hora: string;
  registradoEn: string;
  registradoPor: number;
  origen: OrigenToma;
}): number {
  const r = db()
    .prepare(
      `INSERT INTO tomas (plan_item_id, perfil_id, estado, tarde, hora, registrado_en, registrado_por, origen)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(t.planItemId, t.perfilId, t.estado, t.tarde ? 1 : 0, t.hora, t.registradoEn, t.registradoPor, t.origen);
  return Number(r.lastInsertRowid);
}

export function anular(id: number, userId: number, ahora: string): void {
  db().prepare('UPDATE tomas SET anulado_en = ?, anulado_por = ? WHERE id = ? AND anulado_en IS NULL').run(ahora, userId, id);
}

export function countByPerfil(perfilId: number): number {
  const r = db().prepare('SELECT COUNT(*) AS n FROM tomas WHERE perfil_id = ?').get(perfilId) as { n: number };
  return Number(r.n);
}
