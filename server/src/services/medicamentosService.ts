// Configuración de medicamentos (HU-04).
import { now } from '../lib/clock.js';
import { AppError, NoEncontradoError } from '../lib/errors.js';
import { isUniqueViolation, tx } from '../database/connection.js';
import * as meds from '../repositories/medicamentosRepo.js';
import { NOMBRE_BLOQUE_FRASE } from '../types/index.js';
import type { BloqueClave, MedicamentoRow } from '../types/index.js';
import { normalizarNombre, validarMedicamento } from './reglas.js';
import { asegurarPlan, sincronizarHoy } from './planService.js';
import { registrarEvento } from './eventosService.js';

export interface MedicamentoVista {
  id: number;
  nombre: string;
  dosis: string;
  etiqueta: string | null;
  bloque: BloqueClave;
  orden: number;
}

function vista(m: MedicamentoRow): MedicamentoVista {
  return { id: m.id, nombre: m.nombre, dosis: m.dosis, etiqueta: m.etiqueta, bloque: m.bloque_clave, orden: m.orden };
}

function repetido(bloque: BloqueClave, existenteId: number): AppError {
  const message = `Este medicamento ya está en ${NOMBRE_BLOQUE_FRASE[bloque]}.`;
  return new AppError(409, 'MEDICAMENTO_REPETIDO', message, { existenteId, campos: { nombre: message } });
}

export function listar(perfilId: number): MedicamentoVista[] {
  return meds.listActivos(perfilId).map(vista);
}

export function crear(perfilId: number, userId: number, input: Record<string, unknown>): MedicamentoVista {
  const datos = validarMedicamento(input);
  const nombreNormalizado = normalizarNombre(datos.nombre);
  const id = tx(() => {
    asegurarPlan(perfilId); // los días anteriores quedan con la configuración que tenían
    const existente = meds.findActivoPorNombre(perfilId, datos.bloque, nombreNormalizado);
    if (existente) throw repetido(datos.bloque, existente.id);
    const ahora = now().toISOString();
    let nuevoId: number;
    try {
      nuevoId = meds.create(perfilId, { ...datos, nombreNormalizado }, meds.nextOrden(perfilId), ahora);
    } catch (err) {
      if (isUniqueViolation(err)) throw repetido(datos.bloque, 0);
      throw err;
    }
    sincronizarHoy(perfilId);
    registrarEvento(perfilId, userId, 'medicamento_agregado', `Se agregó ${datos.nombre} (${datos.dosis}) en ${NOMBRE_BLOQUE_FRASE[datos.bloque]}`);
    return nuevoId;
  });
  return vista(meds.findById(perfilId, id)!);
}

export function editar(perfilId: number, userId: number, idRaw: unknown, input: Record<string, unknown>): MedicamentoVista {
  const id = Number(idRaw);
  const datos = validarMedicamento(input);
  const nombreNormalizado = normalizarNombre(datos.nombre);
  tx(() => {
    const actual = meds.findById(perfilId, id);
    if (!actual || !actual.activo) throw new NoEncontradoError('No se encontró ese medicamento.');
    asegurarPlan(perfilId);
    const existente = meds.findActivoPorNombre(perfilId, datos.bloque, nombreNormalizado);
    if (existente && existente.id !== id) throw repetido(datos.bloque, existente.id);
    try {
      meds.update(perfilId, id, { ...datos, nombreNormalizado }, now().toISOString());
    } catch (err) {
      if (isUniqueViolation(err)) throw repetido(datos.bloque, 0);
      throw err;
    }
    sincronizarHoy(perfilId);
    registrarEvento(perfilId, userId, 'medicamento_editado', `Se modificó ${actual.nombre}: ahora ${datos.nombre} (${datos.dosis}) en ${NOMBRE_BLOQUE_FRASE[datos.bloque]}`);
  });
  return vista(meds.findById(perfilId, id)!);
}

/** Eliminar = desactivar: el medicamento deja de aparecer, pero sus registros anteriores se conservan. */
export function eliminar(perfilId: number, userId: number, idRaw: unknown): void {
  const id = Number(idRaw);
  tx(() => {
    const actual = meds.findById(perfilId, id);
    if (!actual || !actual.activo) throw new NoEncontradoError('No se encontró ese medicamento.');
    asegurarPlan(perfilId);
    meds.desactivar(perfilId, id, now().toISOString());
    sincronizarHoy(perfilId);
    registrarEvento(perfilId, userId, 'medicamento_eliminado', `Se quitó ${actual.nombre} de ${NOMBRE_BLOQUE_FRASE[actual.bloque_clave]}`);
  });
}
