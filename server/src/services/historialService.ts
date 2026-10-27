// Historial (HU-06): últimos 7 días con el estado de cada bloque, y el detalle de un día.
import { now } from '../lib/clock.js';
import { addDays, isDateStr, toTimeStr } from '../lib/time.js';
import { AppError } from '../lib/errors.js';
import * as perfiles from '../repositories/perfilesRepo.js';
import * as planRepo from '../repositories/planRepo.js';
import * as eventosRepo from '../repositories/eventosRepo.js';
import { asegurarPlan, hoy } from './planService.js';
import { armarBloques, horariosDe, resumir } from './rutinaService.js';
import type { DiaVista } from './rutinaService.js';

export const DIAS_POR_PAGINA = 7;

export function semana(perfilId: number, hastaRaw: unknown) {
  asegurarPlan(perfilId);
  const fechaHoy = hoy();
  const perfil = perfiles.findById(perfilId)!;
  let hasta = typeof hastaRaw === 'string' && hastaRaw ? hastaRaw : fechaHoy;
  if (!isDateStr(hasta)) throw new AppError(400, 'FECHA', 'Elija una fecha válida.');
  if (hasta > fechaHoy) hasta = fechaHoy;
  const desdeSemana = addDays(hasta, -(DIAS_POR_PAGINA - 1));
  const desde = desdeSemana < perfil.plan_desde ? perfil.plan_desde : desdeSemana;

  const filas = desde <= hasta ? planRepo.itemsConTomaRango(perfilId, desde, hasta) : [];
  const horarios = horariosDe(perfilId);
  const ahora = toTimeStr(now());
  const dias: Omit<DiaVista, 'ahora'>[] = [];
  for (let f = desde; f <= hasta; f = addDays(f, 1)) {
    const esHoy = f === fechaHoy;
    const bloques = armarBloques(filas.filter((r) => r.fecha === f), esHoy, horarios, ahora);
    dias.push({ fecha: f, esHoy, bloques, resumen: resumir(bloques) });
  }
  return {
    desde,
    hasta,
    dias,
    anterior: desdeSemana > perfil.plan_desde ? addDays(desdeSemana, -1) : null,
    siguiente: hasta < fechaHoy ? (addDays(hasta, DIAS_POR_PAGINA) > fechaHoy ? fechaHoy : addDays(hasta, DIAS_POR_PAGINA)) : null,
  };
}

export function detalle(perfilId: number, fecha: unknown) {
  if (!isDateStr(fecha)) throw new AppError(400, 'FECHA', 'Elija una fecha válida.');
  asegurarPlan(perfilId);
  const fechaHoy = hoy();
  if (fecha > fechaHoy) throw new AppError(400, 'FECHA', 'Todavía no hay datos para ese día.');
  const esHoy = fecha === fechaHoy;
  const bloques = armarBloques(planRepo.itemsConToma(perfilId, fecha), esHoy, horariosDe(perfilId), toTimeStr(now()));
  const eventos = eventosRepo.delDia(perfilId, fecha).map((e) => ({
    id: e.id,
    tipo: e.tipo,
    descripcion: e.descripcion,
    hora: e.creado_en.slice(11, 16),
    usuario: e.user_nombre,
  }));
  return { fecha, esHoy, bloques, resumen: resumir(bloques), eventos };
}
