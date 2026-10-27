// Eventos entre componentes de la misma pestaña (aviso → pantalla Hoy).
import type { BloqueClave } from '../types';

export const IR_A_MARCAR = 'pastillero:ir-a-marcar';

export function emitirIrAMarcar(clave: BloqueClave): void {
  window.dispatchEvent(new CustomEvent<BloqueClave>(IR_A_MARCAR, { detail: clave }));
}
