import { db } from '../database/connection.js';
import type { BloqueClave } from '../types/index.js';

export function mostrados(perfilId: number, fecha: string): { bloque_clave: BloqueClave; numero: number }[] {
  return db()
    .prepare('SELECT bloque_clave, numero FROM avisos_mostrados WHERE perfil_id = ? AND fecha = ?')
    .all(perfilId, fecha) as { bloque_clave: BloqueClave; numero: number }[];
}

export function marcarMostrado(perfilId: number, fecha: string, bloque: BloqueClave, numero: number, ahora: string): void {
  db()
    .prepare(
      'INSERT OR IGNORE INTO avisos_mostrados (perfil_id, fecha, bloque_clave, numero, mostrado_en) VALUES (?, ?, ?, ?, ?)',
    )
    .run(perfilId, fecha, bloque, numero, ahora);
}
