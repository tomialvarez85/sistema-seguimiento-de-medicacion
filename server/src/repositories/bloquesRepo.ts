import { db } from '../database/connection.js';
import type { BloqueClave, BloqueRow } from '../types/index.js';

export function listByPerfil(perfilId: number): BloqueRow[] {
  return db()
    .prepare(`SELECT * FROM bloques WHERE perfil_id = ? ORDER BY CASE clave WHEN 'manana' THEN 0 ELSE 1 END`)
    .all(perfilId) as unknown as BloqueRow[];
}

export function create(perfilId: number, clave: BloqueClave, inicio: string, fin: string, ahora: string): void {
  db()
    .prepare('INSERT INTO bloques (perfil_id, clave, inicio, fin, actualizado_en) VALUES (?, ?, ?, ?, ?)')
    .run(perfilId, clave, inicio, fin, ahora);
}

export function update(perfilId: number, clave: BloqueClave, inicio: string, fin: string, ahora: string): void {
  db()
    .prepare('UPDATE bloques SET inicio = ?, fin = ?, actualizado_en = ? WHERE perfil_id = ? AND clave = ?')
    .run(inicio, fin, ahora, perfilId, clave);
}
