// Plan diario: copia congelada de qué pastillas correspondían cada día.
// - Los días que pasaron sin abrir la app se arman con la configuración vigente en ese momento,
//   porque toda modificación de la configuración llama antes a asegurarPlan().
// - El día de hoy se reconcilia con la configuración actual después de cada cambio.
// - Los días anteriores no se modifican nunca: el historial se conserva.
import { now } from '../lib/clock.js';
import { addDays, toDateStr } from '../lib/time.js';
import * as perfiles from '../repositories/perfilesRepo.js';
import * as planRepo from '../repositories/planRepo.js';
import * as meds from '../repositories/medicamentosRepo.js';
import * as bloquesRepo from '../repositories/bloquesRepo.js';
import * as tomas from '../repositories/tomasRepo.js';
import { tx } from '../database/connection.js';
import type { BloqueClave } from '../types/index.js';

const MAX_DIAS_A_ARMAR = 400;

export function hoy(): string {
  return toDateStr(now());
}

function horariosActuales(perfilId: number): Record<BloqueClave, { inicio: string; fin: string }> {
  const out = {} as Record<BloqueClave, { inicio: string; fin: string }>;
  for (const b of bloquesRepo.listByPerfil(perfilId)) out[b.clave] = { inicio: b.inicio, fin: b.fin };
  return out;
}

export function asegurarPlan(perfilId: number): void {
  tx(() => {
    const perfil = perfiles.findById(perfilId);
    if (!perfil) return;
    const fechaHoy = hoy();
    const ultimo = planRepo.ultimoDiaArmado(perfilId);
    let desde = ultimo ? addDays(ultimo, 1) : perfil.plan_desde;
    if (desde > fechaHoy) return;
    const limite = addDays(fechaHoy, -MAX_DIAS_A_ARMAR);
    if (desde < limite) desde = limite;

    const activos = meds.listActivos(perfilId);
    const horarios = horariosActuales(perfilId);
    for (let f = desde; f <= fechaHoy; f = addDays(f, 1)) {
      for (const m of activos) {
        planRepo.insertItem({
          perfilId,
          fecha: f,
          medicamentoId: m.id,
          bloque: m.bloque_clave,
          bloqueInicio: horarios[m.bloque_clave].inicio,
          bloqueFin: horarios[m.bloque_clave].fin,
          nombre: m.nombre,
          dosis: m.dosis,
          etiqueta: m.etiqueta,
          orden: m.orden,
        });
      }
      planRepo.marcarDiaArmado(perfilId, f);
    }
  });
}

/** Ajusta el plan de hoy a la configuración actual sin tocar lo que ya se registró. */
export function sincronizarHoy(perfilId: number): void {
  tx(() => {
    asegurarPlan(perfilId);
    const fechaHoy = hoy();
    const activos = meds.listActivos(perfilId);
    const horarios = horariosActuales(perfilId);
    const items = planRepo.itemsDelDia(perfilId, fechaHoy);
    const porMed = new Map(items.map((i) => [i.medicamento_id, i]));
    const activosIds = new Set(activos.map((m) => m.id));

    for (const m of activos) {
      const item = porMed.get(m.id);
      const h = horarios[m.bloque_clave];
      if (!item) {
        planRepo.insertItem({
          perfilId,
          fecha: fechaHoy,
          medicamentoId: m.id,
          bloque: m.bloque_clave,
          bloqueInicio: h.inicio,
          bloqueFin: h.fin,
          nombre: m.nombre,
          dosis: m.dosis,
          etiqueta: m.etiqueta,
          orden: m.orden,
        });
      } else if (!tomas.vigente(item.id)) {
        // Sin registro todavía: se actualiza con los datos nuevos.
        planRepo.updateItemDatos(item.id, {
          bloque: m.bloque_clave,
          bloqueInicio: h.inicio,
          bloqueFin: h.fin,
          nombre: m.nombre,
          dosis: m.dosis,
          etiqueta: m.etiqueta,
          orden: m.orden,
        });
      } else {
        // Ya registrada hoy: se conserva lo que se registró; solo se actualiza el horario mostrado.
        const hb = horarios[item.bloque_clave];
        planRepo.updateHorarioItem(item.id, hb.inicio, hb.fin);
      }
    }

    for (const item of items) {
      if (activosIds.has(item.medicamento_id)) continue;
      // Medicamento eliminado: si hoy no tiene registro deja de mostrarse; si ya se registró, se conserva.
      if (!tomas.vigente(item.id)) planRepo.retirarItem(item.id);
    }
  });
}
