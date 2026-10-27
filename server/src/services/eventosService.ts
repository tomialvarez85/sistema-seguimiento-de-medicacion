import { now } from '../lib/clock.js';
import { toDateStr, toLocalStamp } from '../lib/time.js';
import * as eventos from '../repositories/eventosRepo.js';

export type TipoEvento =
  | 'toma'
  | 'no_toma'
  | 'desmarcada'
  | 'bloque_registrado'
  | 'bloque_confirmado_incompleto'
  | 'medicamento_agregado'
  | 'medicamento_editado'
  | 'medicamento_eliminado'
  | 'horarios_cambiados'
  | 'familiar_vinculado'
  | 'familiar_desvinculado';

export function registrarEvento(perfilId: number, userId: number | null, tipo: TipoEvento, descripcion: string): void {
  const d = now();
  eventos.create({ perfilId, userId, fecha: toDateStr(d), tipo, descripcion, creadoEn: toLocalStamp(d) });
}
