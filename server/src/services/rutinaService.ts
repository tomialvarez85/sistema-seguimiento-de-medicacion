import { now } from '../lib/clock.js';
import { toTimeStr } from '../lib/time.js';
import * as planRepo from '../repositories/planRepo.js';
import * as bloquesRepo from '../repositories/bloquesRepo.js';
import { BLOQUES, NOMBRE_BLOQUE } from '../types/index.js';
import type { BloqueClave, EstadoItem, PlanItemConToma } from '../types/index.js';
import { asegurarPlan, hoy } from './planService.js';
import { calcularAvisos, estadoBloque, faseBloque, ordenarPendientesPrimero } from './reglas.js';
import type { EstadoBloque, Fase } from './reglas.js';

export interface ItemVista {
  planItemId: number;
  medicamentoId: number;
  nombre: string;
  dosis: string;
  etiqueta: string | null;
  estado: EstadoItem;
  tarde: boolean;
  hora: string | null;
  registradoPor: string | null;
}

export interface BloqueVista {
  clave: BloqueClave;
  nombre: string;
  inicio: string;
  fin: string;
  avisos: [string, string, string];
  fase: Fase;
  estado: EstadoBloque;
  /** Hora del último registro del bloque (para "Este bloque ya se registró a las 8:15"). */
  ultimaHora: string | null;
  items: ItemVista[];
}

export interface DiaVista {
  fecha: string;
  esHoy: boolean;
  ahora: string;
  bloques: BloqueVista[];
  resumen: { total: number; tomadas: number; noTomadas: number; pendientes: number };
}

export function aItemVista(r: PlanItemConToma): ItemVista {
  return {
    planItemId: r.id,
    medicamentoId: r.medicamento_id,
    nombre: r.nombre,
    dosis: r.dosis,
    etiqueta: r.etiqueta,
    estado: r.toma_estado ?? 'pendiente',
    tarde: r.toma_tarde === 1,
    hora: r.toma_hora,
    registradoPor: r.toma_registrado_por_nombre,
  };
}

export function armarBloques(
  filas: PlanItemConToma[],
  esHoy: boolean,
  horarios: Record<BloqueClave, { inicio: string; fin: string }>,
  ahora: string,
): BloqueVista[] {
  return BLOQUES.map((clave) => {
    const propias = filas.filter((f) => f.bloque_clave === clave);
    // Hoy se muestra el horario actual; en días anteriores, el horario que tenía ese día.
    const h = esHoy || propias.length === 0 ? horarios[clave] : { inicio: propias[0].bloque_inicio, fin: propias[0].bloque_fin };
    const items = propias.map(aItemVista);
    const horas = items.map((i) => i.hora).filter((x): x is string => !!x).sort();
    return {
      clave,
      nombre: NOMBRE_BLOQUE[clave],
      inicio: h.inicio,
      fin: h.fin,
      avisos: calcularAvisos(h.inicio, h.fin),
      fase: esHoy ? faseBloque(ahora, h.inicio, h.fin) : 'terminado',
      estado: estadoBloque(items, esHoy),
      ultimaHora: horas.at(-1) ?? null,
      items: esHoy ? ordenarPendientesPrimero(items) : items,
    };
  });
}

export function horariosDe(perfilId: number): Record<BloqueClave, { inicio: string; fin: string }> {
  const out = {} as Record<BloqueClave, { inicio: string; fin: string }>;
  for (const b of bloquesRepo.listByPerfil(perfilId)) out[b.clave] = { inicio: b.inicio, fin: b.fin };
  return out;
}

export function resumir(bloques: BloqueVista[]): DiaVista['resumen'] {
  const items = bloques.flatMap((b) => b.items);
  return {
    total: items.length,
    tomadas: items.filter((i) => i.estado === 'tomado').length,
    noTomadas: items.filter((i) => i.estado === 'no_tomado').length,
    pendientes: items.filter((i) => i.estado === 'pendiente').length,
  };
}

export function obtenerDia(perfilId: number, fecha: string): DiaVista {
  asegurarPlan(perfilId);
  const esHoy = fecha === hoy();
  const ahora = toTimeStr(now());
  const bloques = armarBloques(planRepo.itemsConToma(perfilId, fecha), esHoy, horariosDe(perfilId), ahora);
  return { fecha, esHoy, ahora, bloques, resumen: resumir(bloques) };
}

export function obtenerHoy(perfilId: number): DiaVista {
  return obtenerDia(perfilId, hoy());
}
