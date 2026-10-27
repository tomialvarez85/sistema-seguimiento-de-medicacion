// Vinculación entre una cuenta Familiar y el perfil de una Persona mayor.
// Solo se accede con un código generado por la persona mayor: un solo uso y con vencimiento.
import crypto from 'node:crypto';
import { config } from '../config.js';
import { now } from '../lib/clock.js';
import { AppError, NoEncontradoError } from '../lib/errors.js';
import { isUniqueViolation, tx } from '../database/connection.js';
import * as vinculos from '../repositories/vinculosRepo.js';
import * as perfiles from '../repositories/perfilesRepo.js';
import * as users from '../repositories/usersRepo.js';
import { registrarEvento } from './eventosService.js';

// Sin letras ni números que se confundan (0/O, 1/I/L).
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const LARGO = 8;
const MAX_FALLOS_POR_HORA = 10;

function generarCodigo(): string {
  let s = '';
  for (let i = 0; i < LARGO; i++) s += ALFABETO[crypto.randomInt(ALFABETO.length)];
  return s;
}

export function normalizarCodigo(raw: unknown): string {
  return typeof raw === 'string' ? raw.toUpperCase().replace(/[^A-Z0-9]/g, '') : '';
}

export function formatearCodigo(c: string): string {
  return `${c.slice(0, 4)}-${c.slice(4)}`;
}

export function codigoActual(perfilId: number) {
  const c = vinculos.codigoActivo(perfilId, now().toISOString());
  return c ? { codigo: formatearCodigo(c.codigo), expiraEn: c.expira_en } : null;
}

export function nuevoCodigo(perfilId: number) {
  return tx(() => {
    const ahora = now();
    vinculos.anularCodigosActivos(perfilId, ahora.toISOString());
    const expira = new Date(ahora.getTime() + config.linkCodeHours * 3600 * 1000).toISOString();
    for (let intento = 0; intento < 5; intento++) {
      const codigo = generarCodigo();
      try {
        vinculos.crearCodigo(perfilId, codigo, ahora.toISOString(), expira);
        return { codigo: formatearCodigo(codigo), expiraEn: expira };
      } catch (err) {
        if (!isUniqueViolation(err)) throw err;
      }
    }
    throw new Error('No se pudo generar un código único');
  });
}

function controlarIntentos(userId: number): void {
  const desde = new Date(now().getTime() - 3600 * 1000).toISOString();
  if (vinculos.intentosFallidosDesde(userId, desde) >= MAX_FALLOS_POR_HORA)
    throw new AppError(429, 'DEMASIADOS_INTENTOS', 'Hubo muchos intentos con códigos incorrectos. Espere un rato y vuelva a probar.');
}

function buscarCodigoValido(userId: number, raw: unknown) {
  controlarIntentos(userId);
  const codigo = normalizarCodigo(raw);
  const fila = codigo.length === LARGO ? vinculos.findCodigo(codigo) : undefined;
  const ahora = now().toISOString();
  if (!fila || fila.anulado_en) {
    vinculos.registrarIntento(userId, false, ahora);
    throw new AppError(400, 'CODIGO_INVALIDO', 'Ese código no es correcto. Revíselo y vuelva a escribirlo.', {
      campos: { codigo: 'Ese código no es correcto.' },
    });
  }
  if (fila.usado_en || fila.expira_en <= ahora) {
    vinculos.registrarIntento(userId, false, ahora);
    throw new AppError(400, 'CODIGO_VENCIDO', 'Ese código ya se usó o venció. Pida un código nuevo.', {
      campos: { codigo: 'Ese código ya se usó o venció.' },
    });
  }
  return fila;
}

/** Paso 1: valida el código y muestra a quién se va a vincular, sin crear el vínculo todavía. */
export function validar(userId: number, raw: unknown) {
  const fila = buscarCodigoValido(userId, raw);
  const perfil = perfiles.findById(fila.perfil_id)!;
  if (vinculos.exists(perfil.id, userId))
    throw new AppError(409, 'YA_VINCULADO', `Su cuenta ya está vinculada con ${perfil.nombre}.`);
  return { perfilNombre: perfil.nombre };
}

/** Paso 2: el familiar confirma y se crea el vínculo. El código queda usado. */
export function confirmar(userId: number, raw: unknown) {
  // Primero fuera de la transacción, para que los intentos fallidos queden anotados.
  buscarCodigoValido(userId, raw);
  return tx(() => {
    const fila = buscarCodigoValido(userId, raw);
    const perfil = perfiles.findById(fila.perfil_id)!;
    if (vinculos.exists(perfil.id, userId))
      throw new AppError(409, 'YA_VINCULADO', `Su cuenta ya está vinculada con ${perfil.nombre}.`);
    const ahora = now().toISOString();
    vinculos.create(perfil.id, userId, ahora);
    vinculos.marcarCodigoUsado(fila.id, userId, ahora);
    vinculos.registrarIntento(userId, true, ahora);
    const familiar = users.findById(userId)!;
    registrarEvento(perfil.id, userId, 'familiar_vinculado', `${familiar.nombre} se vinculó como familiar`);
    return { perfilId: perfil.id, perfilNombre: perfil.nombre };
  });
}

export function familiares(perfilId: number) {
  return vinculos.listFamiliares(perfilId).map((f) => ({ id: f.id, nombre: f.nombre, email: f.email, vinculadoEn: f.vinculado_en }));
}

export function quitarFamiliar(perfilId: number, titularId: number, familiarIdRaw: unknown): void {
  const familiarId = Number(familiarIdRaw);
  tx(() => {
    const familiar = users.findById(familiarId);
    if (!familiar || !vinculos.remove(perfilId, familiarId)) throw new NoEncontradoError('Ese familiar no está vinculado.');
    registrarEvento(perfilId, titularId, 'familiar_desvinculado', `Se quitó el acceso de ${familiar.nombre}`);
  });
}

export function desvincularme(familiarId: number, perfilId: number): void {
  tx(() => {
    if (!vinculos.remove(perfilId, familiarId)) throw new NoEncontradoError('Su cuenta no está vinculada con ese perfil.');
    const familiar = users.findById(familiarId)!;
    registrarEvento(perfilId, familiarId, 'familiar_desvinculado', `${familiar.nombre} dejó de supervisar este perfil`);
  });
}
