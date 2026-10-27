// Registro de tomas (HU-02 y HU-03). Solo la cuenta titular llega hasta acá (lo controla el middleware).
import { now } from '../lib/clock.js';
import { horaTexto, toLocalStamp, toTimeStr } from '../lib/time.js';
import { AppError, DatoInvalidoError, NoEncontradoError, RegistroDuplicadoError } from '../lib/errors.js';
import { isUniqueViolation, tx } from '../database/connection.js';
import * as planRepo from '../repositories/planRepo.js';
import * as tomasRepo from '../repositories/tomasRepo.js';
import { NOMBRE_BLOQUE_FRASE } from '../types/index.js';
import type { BloqueClave, EstadoToma, OrigenToma, PlanItemRow } from '../types/index.js';
import { asegurarPlan, hoy } from './planService.js';
import { horariosDe, obtenerHoy } from './rutinaService.js';
import type { DiaVista } from './rutinaService.js';
import { esTarde } from './reglas.js';
import { registrarEvento } from './eventosService.js';

function itemDeHoy(perfilId: number, planItemId: number): PlanItemRow {
  const item = planRepo.findItem(perfilId, planItemId);
  if (!item || item.retirado) throw new NoEncontradoError('No se encontró esa pastilla.');
  if (item.fecha !== hoy()) throw new AppError(400, 'SOLO_HOY', 'Solo se pueden registrar las pastillas de hoy.');
  return item;
}

function insertarToma(item: PlanItemRow, estado: EstadoToma, userId: number, origen: OrigenToma) {
  const d = now();
  const hora = toTimeStr(d);
  const finActual = horariosDe(item.perfil_id)[item.bloque_clave].fin;
  const tarde = estado === 'tomado' && esTarde(hora, finActual);
  try {
    tomasRepo.create({
      planItemId: item.id,
      perfilId: item.perfil_id,
      estado,
      tarde,
      hora,
      registradoEn: toLocalStamp(d),
      registradoPor: userId,
      origen,
    });
  } catch (err) {
    if (isUniqueViolation(err)) throw duplicada(item.id);
    throw err;
  }
  return { hora, tarde };
}

function duplicada(planItemId: number): RegistroDuplicadoError {
  const previa = tomasRepo.vigente(planItemId);
  return new RegistroDuplicadoError(previa ? `Esta pastilla ya se registró a las ${horaTexto(previa.hora)}.` : 'Esta pastilla ya estaba registrada.', {
    hora: previa?.hora ?? null,
    estado: previa?.estado ?? null,
  });
}

export interface ResultadoToma {
  hora: string;
  tarde: boolean;
  estado: EstadoToma;
  nombre: string;
  dia: DiaVista;
}

export function registrarToma(perfilId: number, userId: number, planItemId: unknown, estadoRaw: unknown): ResultadoToma {
  const id = Number(planItemId);
  if (!Number.isInteger(id)) throw new DatoInvalidoError({ planItemId: 'Elija una pastilla.' });
  if (estadoRaw !== 'tomado' && estadoRaw !== 'no_tomado')
    throw new DatoInvalidoError({ estado: 'Indique si la tomó o no la tomó.' });
  const estado: EstadoToma = estadoRaw;

  const r = tx(() => {
    asegurarPlan(perfilId);
    const item = itemDeHoy(perfilId, id);
    if (tomasRepo.vigente(item.id)) throw duplicada(item.id);
    const res = insertarToma(item, estado, userId, 'individual');
    registrarEvento(
      perfilId,
      userId,
      estado === 'tomado' ? 'toma' : 'no_toma',
      estado === 'tomado'
        ? `${item.nombre}: tomada${res.tarde ? ' tarde' : ''} a las ${horaTexto(res.hora)}`
        : `${item.nombre}: registrada como no tomada a las ${horaTexto(res.hora)}`,
    );
    return { ...res, nombre: item.nombre };
  });
  return { ...r, estado, dia: obtenerHoy(perfilId) };
}

export function desmarcar(perfilId: number, userId: number, planItemId: unknown): { nombre: string; dia: DiaVista } {
  const id = Number(planItemId);
  const nombre = tx(() => {
    const item = itemDeHoy(perfilId, id);
    const vigente = tomasRepo.vigente(item.id);
    if (!vigente) throw new AppError(409, 'SIN_REGISTRO', 'Esta pastilla ya estaba sin marcar.');
    // No se borra: queda anulada para conservar el historial de lo que pasó.
    tomasRepo.anular(vigente.id, userId, toLocalStamp(now()));
    registrarEvento(perfilId, userId, 'desmarcada', `${item.nombre}: desmarcada (estaba registrada a las ${horaTexto(vigente.hora)})`);
    return item.nombre;
  });
  return { nombre, dia: obtenerHoy(perfilId) };
}

function validarClave(clave: unknown): BloqueClave {
  if (clave !== 'manana' && clave !== 'noche') throw new NoEncontradoError('No se encontró ese bloque.');
  return clave;
}

/** HU-02: "Marcar todo el bloque" marca como tomadas todas las pendientes. */
export function marcarBloque(perfilId: number, userId: number, claveRaw: unknown) {
  const clave = validarClave(claveRaw);
  const r = tx(() => {
    const dia = obtenerHoy(perfilId);
    const bloque = dia.bloques.find((b) => b.clave === clave)!;
    if (bloque.items.length === 0)
      throw new AppError(409, 'BLOQUE_VACIO', `No hay pastillas cargadas en ${NOMBRE_BLOQUE_FRASE[clave]}.`);
    const pendientes = bloque.items.filter((i) => i.estado === 'pendiente');
    if (pendientes.length === 0)
      throw new RegistroDuplicadoError(`Este bloque ya se registró a las ${horaTexto(bloque.ultimaHora)}.`, { hora: bloque.ultimaHora });
    let hora = '';
    let tarde = false;
    for (const p of pendientes) {
      const item = itemDeHoy(perfilId, p.planItemId);
      const res = insertarToma(item, 'tomado', userId, 'bloque');
      hora = res.hora;
      tarde = tarde || res.tarde;
    }
    registrarEvento(
      perfilId,
      userId,
      'bloque_registrado',
      `${capitalizar(NOMBRE_BLOQUE_FRASE[clave])}: ${pendientes.length} pastilla(s) marcadas como tomadas${tarde ? ' tarde' : ''} a las ${horaTexto(hora)}`,
    );
    return { hora, tarde, cantidad: pendientes.length };
  });
  return { ...r, clave, dia: obtenerHoy(perfilId) };
}

/**
 * "Confirmar igual" en Bloque incompleto: las pastillas que faltan quedan registradas
 * explícitamente como no tomadas. Nunca se suponen tomadas.
 */
export function confirmarBloqueIncompleto(perfilId: number, userId: number, claveRaw: unknown) {
  const clave = validarClave(claveRaw);
  const r = tx(() => {
    const dia = obtenerHoy(perfilId);
    const bloque = dia.bloques.find((b) => b.clave === clave)!;
    const pendientes = bloque.items.filter((i) => i.estado === 'pendiente');
    if (pendientes.length === 0)
      throw new RegistroDuplicadoError(`Este bloque ya se registró a las ${horaTexto(bloque.ultimaHora)}.`, { hora: bloque.ultimaHora });
    let hora = '';
    for (const p of pendientes) {
      hora = insertarToma(itemDeHoy(perfilId, p.planItemId), 'no_tomado', userId, 'confirmar_bloque').hora;
    }
    registrarEvento(
      perfilId,
      userId,
      'bloque_confirmado_incompleto',
      `${capitalizar(NOMBRE_BLOQUE_FRASE[clave])} confirmado incompleto a las ${horaTexto(hora)}. No tomadas: ${pendientes
        .map((p) => p.nombre)
        .join(', ')}`,
    );
    return { hora, noTomadas: pendientes.map((p) => p.nombre) };
  });
  return { ...r, clave, dia: obtenerHoy(perfilId) };
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
