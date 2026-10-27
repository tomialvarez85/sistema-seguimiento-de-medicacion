// Reglas de negocio de los Sprints 1 a 3, como funciones puras.
// Son la única fuente de verdad que usan Hoy, Aviso, Bloque incompleto, Historial y Supervisión.
import { fromMinutes, horaTexto, normalizeTime, toMinutes } from '../lib/time.js';
import { DatoInvalidoError } from '../lib/errors.js';
import type { BloqueClave, EstadoItem } from '../types/index.js';
import { NOMBRE_BLOQUE_FRASE } from '../types/index.js';

export const HORARIOS_INICIALES: Record<BloqueClave, { inicio: string; fin: string }> = {
  manana: { inicio: '08:00', fin: '12:00' },
  noche: { inicio: '20:00', fin: '23:00' },
};

export const MAX_ETIQUETA = 35;
export const MAX_NOMBRE = 60;
export const MAX_DOSIS = 40;

/** Tres avisos por bloque: al inicio, a la mitad y al cierre (HU-05). */
export function calcularAvisos(inicio: string, fin: string): [string, string, string] {
  const a = toMinutes(inicio);
  const b = toMinutes(fin);
  return [inicio, fromMinutes(Math.round((a + b) / 2)), fin];
}

/** Largo en caracteres visibles, contando los espacios (Sprint 3). */
export function largo(texto: string): number {
  return [...texto].length;
}

/** Para detectar repetidos: sin mayúsculas, tildes ni espacios de más. */
export function normalizarNombre(nombre: string): string {
  return nombre
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export interface DatosMedicamento {
  nombre: string;
  dosis: string;
  bloque: BloqueClave;
  etiqueta: string | null;
}

export function validarMedicamento(input: Record<string, unknown>): DatosMedicamento {
  const campos: Record<string, string> = {};
  const nombre = typeof input.nombre === 'string' ? input.nombre.replace(/\s+/g, ' ').trim() : '';
  const dosis = typeof input.dosis === 'string' ? input.dosis.replace(/\s+/g, ' ').trim() : '';
  const etiquetaRaw = typeof input.etiqueta === 'string' ? input.etiqueta.replace(/\s+/g, ' ').trim() : '';
  const bloque = input.bloque;

  if (!nombre) campos.nombre = 'Escriba el nombre del medicamento.';
  else if (largo(nombre) > MAX_NOMBRE) campos.nombre = `El nombre puede tener hasta ${MAX_NOMBRE} letras.`;

  if (!dosis) campos.dosis = 'Escriba la dosis. Por ejemplo: 1 pastilla.';
  else if (largo(dosis) > MAX_DOSIS) campos.dosis = `La dosis puede tener hasta ${MAX_DOSIS} letras.`;

  if (bloque !== 'manana' && bloque !== 'noche') campos.bloque = 'Elija el bloque: mañana o noche.';

  if (largo(etiquetaRaw) > MAX_ETIQUETA)
    campos.etiqueta = `La etiqueta puede tener hasta ${MAX_ETIQUETA} letras. Por ejemplo: tensión baja.`;

  if (Object.keys(campos).length) throw new DatoInvalidoError(campos);
  return { nombre, dosis, bloque: bloque as BloqueClave, etiqueta: etiquetaRaw || null };
}

export type Horarios = Record<BloqueClave, { inicio: string; fin: string }>;

/** HU-07: formato HH:MM, fin después del inicio y sin bloques superpuestos. */
export function validarHorarios(input: unknown): Horarios {
  const campos: Record<string, string> = {};
  const data = (input ?? {}) as Record<string, { inicio?: unknown; fin?: unknown } | undefined>;
  const out = {} as Horarios;

  for (const clave of ['manana', 'noche'] as BloqueClave[]) {
    const inicio = normalizeTime(data[clave]?.inicio);
    const fin = normalizeTime(data[clave]?.fin);
    if (!inicio) campos[`${clave}.inicio`] = 'Escriba la hora así: 08:00.';
    if (!fin) campos[`${clave}.fin`] = 'Escriba la hora así: 08:00.';
    if (inicio && fin && toMinutes(fin) <= toMinutes(inicio)) {
      campos[`${clave}.inicio`] = 'La hora de fin tiene que ser después de la de inicio.';
      campos[`${clave}.fin`] = 'La hora de fin tiene que ser después de la de inicio.';
    }
    out[clave] = { inicio: inicio ?? '', fin: fin ?? '' };
  }
  if (Object.keys(campos).length) throw new DatoInvalidoError(campos);

  const m = out.manana;
  const n = out.noche;
  if (toMinutes(m.inicio) < toMinutes(n.fin) && toMinutes(n.inicio) < toMinutes(m.fin)) {
    const message = `Este horario se pisa con ${NOMBRE_BLOQUE_FRASE.noche} (${horaTexto(n.inicio)} a ${horaTexto(n.fin)}).`;
    throw new DatoInvalidoError(
      {
        'manana.inicio': message,
        'manana.fin': message,
        'noche.inicio': `Este horario se pisa con ${NOMBRE_BLOQUE_FRASE.manana} (${horaTexto(m.inicio)} a ${horaTexto(m.fin)}).`,
        'noche.fin': `Este horario se pisa con ${NOMBRE_BLOQUE_FRASE.manana} (${horaTexto(m.inicio)} a ${horaTexto(m.fin)}).`,
      },
      message,
    );
  }
  if (toMinutes(n.inicio) < toMinutes(m.inicio)) {
    throw new DatoInvalidoError(
      { 'noche.inicio': 'El bloque de la noche tiene que empezar después del de la mañana.' },
    );
  }
  return out;
}

/** Ubicación de la hora actual respecto del bloque. */
export type Fase = 'proximo' | 'en_curso' | 'terminado';

export function faseBloque(ahora: string, inicio: string, fin: string): Fase {
  const t = toMinutes(ahora);
  if (t < toMinutes(inicio)) return 'proximo';
  if (t <= toMinutes(fin)) return 'en_curso';
  return 'terminado';
}

/** Una pastilla se registra como tarde si se marca tomada después del cierre del bloque (Sprint 1). */
export function esTarde(ahora: string, fin: string): boolean {
  return toMinutes(ahora) > toMinutes(fin);
}

export type TipoEstadoBloque =
  | 'sin_medicamentos'
  | 'pendiente' // hoy, nada registrado
  | 'sin_registrar' // día pasado, nada registrado
  | 'incompleto'
  | 'completo'
  | 'no_tomado';

export interface EstadoBloque {
  tipo: TipoEstadoBloque;
  total: number;
  tomadas: number;
  noTomadas: number;
  sinRegistrar: number;
  conTarde: boolean;
  ultimaHoraTarde: string | null;
  texto: string;
}

/**
 * Estado de un bloque a partir del estado de sus pastillas. Nunca supone que algo se tomó:
 * solo cuentan como tomadas las pastillas registradas como tomadas.
 */
export function estadoBloque(
  items: { estado: EstadoItem; tarde: boolean; hora: string | null }[],
  esHoy: boolean,
): EstadoBloque {
  const total = items.length;
  const tomadas = items.filter((i) => i.estado === 'tomado').length;
  const noTomadas = items.filter((i) => i.estado === 'no_tomado').length;
  const sinRegistrar = total - tomadas - noTomadas;
  const tardes = items.filter((i) => i.estado === 'tomado' && i.tarde && i.hora).map((i) => i.hora as string);
  const ultimaHoraTarde = tardes.length ? tardes.sort().at(-1)! : null;
  const base = { total, tomadas, noTomadas, sinRegistrar, conTarde: tardes.length > 0, ultimaHoraTarde };

  if (total === 0) return { ...base, tipo: 'sin_medicamentos', texto: 'Sin medicamentos' };
  if (tomadas === total)
    return {
      ...base,
      tipo: 'completo',
      texto: ultimaHoraTarde ? `Completo · con entrega tarde (${ultimaHoraTarde})` : 'Completo',
    };
  if (tomadas === 0 && noTomadas === 0)
    return esHoy ? { ...base, tipo: 'pendiente', texto: 'Pendiente' } : { ...base, tipo: 'sin_registrar', texto: 'Sin registrar' };
  if (tomadas === 0 && noTomadas === total) return { ...base, tipo: 'no_tomado', texto: 'No tomado' };
  return { ...base, tipo: 'incompleto', texto: `Incompleto · ${tomadas} de ${total}` };
}

/**
 * Orden de la pantalla Hoy (Sprint 3): pendientes arriba y registradas al final,
 * sin desordenar las demás (equivalente a std::stable_partition).
 */
export function ordenarPendientesPrimero<T extends { estado: EstadoItem }>(items: T[]): T[] {
  return [...items.filter((i) => i.estado === 'pendiente'), ...items.filter((i) => i.estado !== 'pendiente')];
}
