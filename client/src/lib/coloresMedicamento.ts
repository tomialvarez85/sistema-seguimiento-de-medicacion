// Color elegido para cada medicamento, para diferenciarlos más fácil a simple vista.
// Se guarda en este navegador (no viaja al servidor): es una preferencia visual personal.
const PREFIJO = 'pastillero.colorMed.';

export interface ColorOpcion {
  id: string;
  nombre: string;
  valor: string;
}

export const PALETA_COLORES: ColorOpcion[] = [
  { id: 'rojo', nombre: 'Rojo', valor: '#e03131' },
  { id: 'naranja', nombre: 'Naranja', valor: '#e8590c' },
  { id: 'amarillo', nombre: 'Amarillo', valor: '#f08c00' },
  { id: 'verde', nombre: 'Verde', valor: '#2f9e44' },
  { id: 'celeste', nombre: 'Celeste', valor: '#1098ad' },
  { id: 'azul', nombre: 'Azul', valor: '#3b5bdb' },
  { id: 'violeta', nombre: 'Violeta', valor: '#9c36b5' },
  { id: 'rosa', nombre: 'Rosa', valor: '#e64980' },
];

export function cargarColores(): Record<number, string> {
  const out: Record<number, string> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(PREFIJO)) continue;
    const id = Number(key.slice(PREFIJO.length));
    const valor = localStorage.getItem(key);
    if (!Number.isNaN(id) && valor) out[id] = valor;
  }
  return out;
}

export function guardarColor(medicamentoId: number, valor: string | null): void {
  const key = `${PREFIJO}${medicamentoId}`;
  if (valor) localStorage.setItem(key, valor);
  else localStorage.removeItem(key);
}
