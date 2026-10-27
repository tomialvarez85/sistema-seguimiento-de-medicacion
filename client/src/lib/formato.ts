// Formatos de fecha y hora para mostrar (es-AR). Las horas se muestran como en los sprints: "8:15".
export function hora(hhmm: string | null | undefined): string {
  if (!hhmm) return '';
  return hhmm.replace(/^0(\d)/, '$1');
}

function fechaLocal(fecha: string): Date {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(y, m - 1, d, 12);
}

export function fechaLarga(fecha: string): string {
  const s = new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(
    fechaLocal(fecha),
  );
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function fechaCorta(fecha: string): string {
  const s = new Intl.DateTimeFormat('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).format(fechaLocal(fecha));
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/\./g, '');
}

export function listaHoras(horas: string[]): string {
  const h = horas.map(hora);
  return h.length > 1 ? `${h.slice(0, -1).join(', ')} y ${h.at(-1)}` : h.join('');
}

export function listaNombres(nombres: string[]): string {
  return nombres.length > 1 ? `${nombres.slice(0, -1).join(', ')} y ${nombres.at(-1)}` : nombres.join('');
}

export function pastillas(n: number): string {
  return `${n} ${n === 1 ? 'pastilla' : 'pastillas'}`;
}

export function fraseBloque(nombre: string): string {
  return `el bloque de la ${nombre.toLowerCase()}`;
}

/** "24 de octubre a las 16:28" */
export function fechaHoraIso(iso: string): string {
  const d = new Date(iso);
  const dia = new Intl.DateTimeFormat('es-AR', { day: 'numeric', month: 'long' }).format(d);
  return `${dia} a las ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}
