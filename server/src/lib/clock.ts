// Reloj único del backend. Las pruebas pueden fijar la hora para comprobar
// que el paso del tiempo no genera registros por sí solo.
let fixed: Date | null = null;

export function now(): Date {
  return fixed ? new Date(fixed.getTime()) : new Date();
}

export function setNowForTests(date: Date | string | null): void {
  fixed = date === null ? null : new Date(date);
}
