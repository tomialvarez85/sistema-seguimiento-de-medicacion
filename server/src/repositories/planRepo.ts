import { db } from '../database/connection.js';
import type { BloqueClave, PlanItemConToma, PlanItemRow } from '../types/index.js';

export function ultimoDiaArmado(perfilId: number): string | null {
  const r = db().prepare('SELECT MAX(fecha) AS f FROM plan_dias WHERE perfil_id = ?').get(perfilId) as { f: string | null };
  return r.f;
}

export function marcarDiaArmado(perfilId: number, fecha: string): void {
  db().prepare('INSERT OR IGNORE INTO plan_dias (perfil_id, fecha) VALUES (?, ?)').run(perfilId, fecha);
}

export function diaArmado(perfilId: number, fecha: string): boolean {
  return !!db().prepare('SELECT 1 FROM plan_dias WHERE perfil_id = ? AND fecha = ?').get(perfilId, fecha);
}

export interface NuevoItem {
  perfilId: number;
  fecha: string;
  medicamentoId: number;
  bloque: BloqueClave;
  bloqueInicio: string;
  bloqueFin: string;
  nombre: string;
  dosis: string;
  etiqueta: string | null;
  orden: number;
}

export function insertItem(i: NuevoItem): void {
  db()
    .prepare(
      `INSERT INTO plan_items (perfil_id, fecha, medicamento_id, bloque_clave, bloque_inicio, bloque_fin, nombre, dosis, etiqueta, orden)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(i.perfilId, i.fecha, i.medicamentoId, i.bloque, i.bloqueInicio, i.bloqueFin, i.nombre, i.dosis, i.etiqueta, i.orden);
}

export function itemsDelDia(perfilId: number, fecha: string): PlanItemRow[] {
  return db()
    .prepare('SELECT * FROM plan_items WHERE perfil_id = ? AND fecha = ?')
    .all(perfilId, fecha) as unknown as PlanItemRow[];
}

export function updateItemDatos(
  id: number,
  d: { bloque: BloqueClave; bloqueInicio: string; bloqueFin: string; nombre: string; dosis: string; etiqueta: string | null; orden: number },
): void {
  db()
    .prepare(
      `UPDATE plan_items SET bloque_clave = ?, bloque_inicio = ?, bloque_fin = ?, nombre = ?, dosis = ?, etiqueta = ?, orden = ?, retirado = 0
       WHERE id = ?`,
    )
    .run(d.bloque, d.bloqueInicio, d.bloqueFin, d.nombre, d.dosis, d.etiqueta, d.orden, id);
}

export function updateHorarioItem(id: number, inicio: string, fin: string): void {
  db().prepare('UPDATE plan_items SET bloque_inicio = ?, bloque_fin = ? WHERE id = ?').run(inicio, fin, id);
}

export function retirarItem(id: number): void {
  db().prepare('UPDATE plan_items SET retirado = 1 WHERE id = ?').run(id);
}

/** Pastillas vigentes de un día con su resultado vigente, si existe. */
export function itemsConToma(perfilId: number, fecha: string): PlanItemConToma[] {
  return db()
    .prepare(
      `SELECT pi.*, t.id AS toma_id, t.estado AS toma_estado, t.tarde AS toma_tarde, t.hora AS toma_hora,
              u.nombre AS toma_registrado_por_nombre
       FROM plan_items pi
       LEFT JOIN tomas t ON t.plan_item_id = pi.id AND t.anulado_en IS NULL
       LEFT JOIN users u ON u.id = t.registrado_por
       WHERE pi.perfil_id = ? AND pi.fecha = ? AND pi.retirado = 0
       ORDER BY pi.orden, pi.id`,
    )
    .all(perfilId, fecha) as unknown as PlanItemConToma[];
}

export function itemsConTomaRango(perfilId: number, desde: string, hasta: string): PlanItemConToma[] {
  return db()
    .prepare(
      `SELECT pi.*, t.id AS toma_id, t.estado AS toma_estado, t.tarde AS toma_tarde, t.hora AS toma_hora,
              u.nombre AS toma_registrado_por_nombre
       FROM plan_items pi
       LEFT JOIN tomas t ON t.plan_item_id = pi.id AND t.anulado_en IS NULL
       LEFT JOIN users u ON u.id = t.registrado_por
       WHERE pi.perfil_id = ? AND pi.fecha BETWEEN ? AND ? AND pi.retirado = 0
       ORDER BY pi.fecha, pi.orden, pi.id`,
    )
    .all(perfilId, desde, hasta) as unknown as PlanItemConToma[];
}

export function findItem(perfilId: number, id: number): PlanItemRow | undefined {
  return db().prepare('SELECT * FROM plan_items WHERE perfil_id = ? AND id = ?').get(perfilId, id) as
    | PlanItemRow
    | undefined;
}
