// Representación de estados: siempre símbolo + texto, nunca solo color (TEC-01).
import { AlertTriangle, Check, CircleDashed, Clock, HelpCircle, Minus, X } from 'lucide-react';
import type { EstadoBloque, Item } from '../types';
import { hora } from '../lib/formato';

export function BadgeBloque({ estado, esHoy = true }: { estado: EstadoBloque; esHoy?: boolean }) {
  switch (estado.tipo) {
    case 'completo':
      return estado.conTarde ? (
        <span className="badge badge-late">
          <Clock size={18} aria-hidden="true" /> Completo · tarde ({hora(estado.ultimaHoraTarde)})
        </span>
      ) : (
        <span className="badge badge-ok">
          <Check size={18} aria-hidden="true" /> Completo
        </span>
      );
    case 'incompleto':
      return (
        <span className="badge badge-pending">
          <AlertTriangle size={18} aria-hidden="true" /> Incompleto · {estado.tomadas} de {estado.total}
        </span>
      );
    case 'no_tomado':
      return (
        <span className="badge badge-no">
          <X size={18} aria-hidden="true" /> No tomado
        </span>
      );
    case 'sin_registrar':
      return (
        <span className="badge badge-neutral">
          <HelpCircle size={18} aria-hidden="true" /> Sin registrar
        </span>
      );
    case 'sin_medicamentos':
      return (
        <span className="badge badge-neutral">
          <Minus size={18} aria-hidden="true" /> Sin medicamentos
        </span>
      );
    default:
      return (
        <span className="badge badge-pending">
          <CircleDashed size={18} aria-hidden="true" /> {esHoy ? 'Pendiente' : 'Sin registrar'}
        </span>
      );
  }
}

/** Texto del estado de una pastilla, para leer y para lectores de pantalla. */
export function textoItem(i: Item, bloqueTerminado = false): string {
  if (i.estado === 'tomado') return i.tarde ? `Tomada tarde ${hora(i.hora)}` : `Tomada ${hora(i.hora)}`;
  if (i.estado === 'no_tomado') return `No tomada (registrado ${hora(i.hora)})`;
  return bloqueTerminado ? 'Pendiente · el horario ya terminó' : 'Pendiente';
}

export function BadgeItem({ item, bloqueTerminado = false, esHoy = true }: { item: Item; bloqueTerminado?: boolean; esHoy?: boolean }) {
  if (item.estado === 'tomado')
    return item.tarde ? (
      <span className="badge badge-late">
        <Clock size={18} aria-hidden="true" /> Tomada tarde {hora(item.hora)}
      </span>
    ) : (
      <span className="badge badge-ok">
        <Check size={18} aria-hidden="true" /> Tomada {hora(item.hora)}
      </span>
    );
  if (item.estado === 'no_tomado')
    return (
      <span className="badge badge-no">
        <X size={18} aria-hidden="true" /> No tomada
      </span>
    );
  if (!esHoy)
    return (
      <span className="badge badge-neutral">
        <HelpCircle size={18} aria-hidden="true" /> Sin registrar
      </span>
    );
  return (
    <span className="badge badge-pending">
      {bloqueTerminado ? <Clock size={18} aria-hidden="true" /> : <CircleDashed size={18} aria-hidden="true" />}
      {bloqueTerminado ? 'Pendiente · horario terminado' : 'Pendiente'}
    </span>
  );
}
