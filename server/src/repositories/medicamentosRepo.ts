import { db } from '../database/connection.js';
import type { BloqueClave, MedicamentoRow } from '../types/index.js';

export function listActivos(perfilId: number): MedicamentoRow[] {
  return db()
    .prepare('SELECT * FROM medicamentos WHERE perfil_id = ? AND activo = 1 ORDER BY orden, id')
    .all(perfilId) as unknown as MedicamentoRow[];
}

export function findById(perfilId: number, id: number): MedicamentoRow | undefined {
  return db().prepare('SELECT * FROM medicamentos WHERE perfil_id = ? AND id = ?').get(perfilId, id) as
    | MedicamentoRow
    | undefined;
}

export function findActivoPorNombre(
  perfilId: number,
  bloque: BloqueClave,
  nombreNormalizado: string,
): MedicamentoRow | undefined {
  return db()
    .prepare(
      'SELECT * FROM medicamentos WHERE perfil_id = ? AND bloque_clave = ? AND nombre_normalizado = ? AND activo = 1',
    )
    .get(perfilId, bloque, nombreNormalizado) as MedicamentoRow | undefined;
}

export function nextOrden(perfilId: number): number {
  const r = db().prepare('SELECT COALESCE(MAX(orden), 0) + 1 AS n FROM medicamentos WHERE perfil_id = ?').get(perfilId) as {
    n: number;
  };
  return Number(r.n);
}

export interface MedicamentoData {
  bloque: BloqueClave;
  nombre: string;
  nombreNormalizado: string;
  dosis: string;
  etiqueta: string | null;
}

export function create(perfilId: number, data: MedicamentoData, orden: number, ahora: string): number {
  const r = db()
    .prepare(
      `INSERT INTO medicamentos (perfil_id, bloque_clave, nombre, nombre_normalizado, dosis, etiqueta, orden, creado_en, actualizado_en)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(perfilId, data.bloque, data.nombre, data.nombreNormalizado, data.dosis, data.etiqueta, orden, ahora, ahora);
  return Number(r.lastInsertRowid);
}

export function update(perfilId: number, id: number, data: MedicamentoData, ahora: string): void {
  db()
    .prepare(
      `UPDATE medicamentos SET bloque_clave = ?, nombre = ?, nombre_normalizado = ?, dosis = ?, etiqueta = ?, actualizado_en = ?
       WHERE perfil_id = ? AND id = ?`,
    )
    .run(data.bloque, data.nombre, data.nombreNormalizado, data.dosis, data.etiqueta, ahora, perfilId, id);
}

export function desactivar(perfilId: number, id: number, ahora: string): void {
  db()
    .prepare('UPDATE medicamentos SET activo = 0, desactivado_en = ?, actualizado_en = ? WHERE perfil_id = ? AND id = ?')
    .run(ahora, ahora, perfilId, id);
}
