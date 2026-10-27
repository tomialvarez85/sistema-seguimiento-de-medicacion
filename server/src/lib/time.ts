// Fechas y horas en la zona horaria local del equipo donde corre el servidor.
// Fecha: 'YYYY-MM-DD'. Hora: 'HH:MM'. Marca de tiempo: 'YYYY-MM-DDTHH:MM:SS'.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateStr(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function toTimeStr(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function toLocalStamp(d: Date): string {
  return `${toDateStr(d)}T${toTimeStr(d)}:${pad(d.getSeconds())}`;
}

export function parseDateStr(s: string): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d, 12, 0, 0);
}

export function isDateStr(s: unknown): s is string {
  if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return toDateStr(parseDateStr(s)) === s;
}

export function addDays(dateStr: string, days: number): string {
  const d = parseDateStr(dateStr);
  d.setDate(d.getDate() + days);
  return toDateStr(d);
}

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export function fromMinutes(total: number): string {
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/** Acepta 'H:MM' o 'HH:MM' entre 00:00 y 23:59 y devuelve 'HH:MM', o null. */
export function normalizeTime(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return `${pad(h)}:${pad(m)}`;
}

/** Hora para mostrar en mensajes, como en los sprints: '08:15' → '8:15'. */
export function horaTexto(hhmm: string | null | undefined): string {
  return hhmm ? hhmm.replace(/^0(\d)/, '$1') : '';
}
