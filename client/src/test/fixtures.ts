import type { Bloque, Dia, Item } from '../types';

export function item(p: Partial<Item> & { planItemId: number; nombre: string }): Item {
  return {
    medicamentoId: p.planItemId,
    dosis: '1 pastilla',
    etiqueta: null,
    estado: 'pendiente',
    tarde: false,
    hora: null,
    registradoPor: null,
    ...p,
  };
}

export function bloque(p: Partial<Bloque> & { items: Item[] }): Bloque {
  const tomadas = p.items.filter((i) => i.estado === 'tomado').length;
  return {
    clave: 'manana',
    nombre: 'Mañana',
    inicio: '08:00',
    fin: '12:00',
    avisos: ['08:00', '10:00', '12:00'],
    fase: 'en_curso',
    estado: {
      tipo: tomadas === p.items.length ? 'completo' : tomadas ? 'incompleto' : 'pendiente',
      total: p.items.length,
      tomadas,
      noTomadas: p.items.filter((i) => i.estado === 'no_tomado').length,
      sinRegistrar: p.items.filter((i) => i.estado === 'pendiente').length,
      conTarde: false,
      ultimaHoraTarde: null,
      texto: '',
    },
    ultimaHora: null,
    ...p,
  };
}

export function dia(bloques: Bloque[]): Dia {
  const items = bloques.flatMap((b) => b.items);
  return {
    fecha: '2026-10-22',
    esHoy: true,
    ahora: '09:00',
    bloques,
    resumen: {
      total: items.length,
      tomadas: items.filter((i) => i.estado === 'tomado').length,
      noTomadas: items.filter((i) => i.estado === 'no_tomado').length,
      pendientes: items.filter((i) => i.estado === 'pendiente').length,
    },
  };
}
