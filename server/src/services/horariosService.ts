// Cambiar horarios (HU-07). Cambiar un horario no altera los registros anteriores:
// cada toma guardó si fue tarde al momento de registrarse y cada día guardó su horario.
import { now } from '../lib/clock.js';
import { tx } from '../database/connection.js';
import * as bloquesRepo from '../repositories/bloquesRepo.js';
import { BLOQUES, NOMBRE_BLOQUE } from '../types/index.js';
import type { BloqueClave } from '../types/index.js';
import { calcularAvisos, validarHorarios } from './reglas.js';
import { asegurarPlan, sincronizarHoy } from './planService.js';
import { registrarEvento } from './eventosService.js';

export interface HorarioVista {
  clave: BloqueClave;
  nombre: string;
  inicio: string;
  fin: string;
  avisos: [string, string, string];
}

export function obtener(perfilId: number): HorarioVista[] {
  return bloquesRepo.listByPerfil(perfilId).map((b) => ({
    clave: b.clave,
    nombre: NOMBRE_BLOQUE[b.clave],
    inicio: b.inicio,
    fin: b.fin,
    avisos: calcularAvisos(b.inicio, b.fin),
  }));
}

export function guardar(perfilId: number, userId: number, input: unknown): HorarioVista[] {
  const h = validarHorarios(input);
  tx(() => {
    asegurarPlan(perfilId);
    const ahora = now().toISOString();
    for (const clave of BLOQUES) bloquesRepo.update(perfilId, clave, h[clave].inicio, h[clave].fin, ahora);
    sincronizarHoy(perfilId);
    registrarEvento(
      perfilId,
      userId,
      'horarios_cambiados',
      `Horarios: mañana ${h.manana.inicio} a ${h.manana.fin}, noche ${h.noche.inicio} a ${h.noche.fin}`,
    );
  });
  return obtener(perfilId);
}
