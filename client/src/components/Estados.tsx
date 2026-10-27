import type { ReactNode } from 'react';
import { CloudOff, RotateCw } from 'lucide-react';

export function Cargando({ texto = 'Cargando…' }: { texto?: string }) {
  return (
    <div className="state" role="status" aria-live="polite">
      <div className="spinner" aria-hidden="true" />
      <p>{texto}</p>
    </div>
  );
}

export function ErrorCarga({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
  return (
    <div className="state card" role="alert">
      <CloudOff size={44} aria-hidden="true" />
      <h2>No se pudieron cargar los datos</h2>
      <p>{mensaje}</p>
      {onReintentar && (
        <button type="button" className="btn btn-primary" onClick={onReintentar}>
          <RotateCw size={22} aria-hidden="true" /> Intentar de nuevo
        </button>
      )}
    </div>
  );
}

export function Vacio({ icono, titulo, children }: { icono: ReactNode; titulo: string; children?: ReactNode }) {
  return (
    <div className="state">
      {icono}
      <h3>{titulo}</h3>
      {children}
    </div>
  );
}
