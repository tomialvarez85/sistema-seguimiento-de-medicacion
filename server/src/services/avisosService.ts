// Avisos del bloque (HU-05): al inicio siempre; a la mitad y al cierre solo si quedan pendientes.
// Un aviso solo recuerda: nunca registra tomas. Se anota en la base cuál se mostró para no repetirlo.
import { now } from '../lib/clock.js';
import { toLocalStamp, toMinutes } from '../lib/time.js';
import { DatoInvalidoError } from '../lib/errors.js';
import * as avisosRepo from '../repositories/avisosRepo.js';
import type { BloqueClave } from '../types/index.js';
import { hoy } from './planService.js';
import { obtenerHoy } from './rutinaService.js';
import type { ItemVista } from './rutinaService.js';

/** Minutos que sigue vigente el aviso de cierre si la app se abre más tarde. */
const MARGEN_CIERRE = 30;

export interface AvisoVista {
  fecha: string;
  clave: BloqueClave;
  nombreBloque: string;
  numero: 1 | 2 | 3;
  hora: string;
  inicio: string;
  fin: string;
  pendientes: ItemVista[];
  total: number;
}

export function avisoActual(perfilId: number): AvisoVista | null {
  const dia = obtenerHoy(perfilId);
  const t = toMinutes(dia.ahora);
  const vistos = new Set(avisosRepo.mostrados(perfilId, dia.fecha).map((a) => `${a.bloque_clave}:${a.numero}`));

  for (const b of dia.bloques) {
    if (b.items.length === 0) continue;
    const pendientes = b.items.filter((i) => i.estado === 'pendiente');
    // Si el bloque está completo, se cancelan los avisos siguientes (incluido el del inicio).
    if (pendientes.length === 0) continue;
    const horas = b.avisos.map(toMinutes);
    // Aviso que corresponde ahora: el último cuya hora ya llegó, mientras no llegue el siguiente.
    for (let n = 3; n >= 1; n--) {
      const desde = horas[n - 1];
      const hasta = n < 3 ? horas[n] : horas[2] + MARGEN_CIERRE;
      if (t >= desde && t < hasta) {
        if (!vistos.has(`${b.clave}:${n}`))
          return {
            fecha: dia.fecha,
            clave: b.clave,
            nombreBloque: b.nombre,
            numero: n as 1 | 2 | 3,
            hora: b.avisos[n - 1],
            inicio: b.inicio,
            fin: b.fin,
            pendientes,
            total: b.items.length,
          };
        break;
      }
    }
  }
  return null;
}

export function marcarVisto(perfilId: number, input: Record<string, unknown>): void {
  const { clave, numero } = input;
  const n = Number(numero);
  if ((clave !== 'manana' && clave !== 'noche') || ![1, 2, 3].includes(n))
    throw new DatoInvalidoError({ aviso: 'Aviso desconocido.' });
  // Al ver un aviso, también se dan por vistos los anteriores del mismo bloque.
  for (let i = 1; i <= n; i++) avisosRepo.marcarMostrado(perfilId, hoy(), clave, i, toLocalStamp(now()));
}
