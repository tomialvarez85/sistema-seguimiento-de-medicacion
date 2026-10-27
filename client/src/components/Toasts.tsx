import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';

type Tono = 'ok' | 'info' | 'error';
interface Toast {
  id: number;
  texto: string;
  tono: Tono;
}

const Ctx = createContext<(texto: string, tono?: Tono) => void>(() => {});

/** Mensajes breves que se anuncian a lectores de pantalla y desaparecen solos. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const cerrar = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);
  const mostrar = useCallback(
    (texto: string, tono: Tono = 'ok') => {
      const id = next.current++;
      setToasts((t) => [...t.slice(-2), { id, texto, tono }]);
      window.setTimeout(() => cerrar(id), tono === 'error' ? 8000 : 5000);
    },
    [cerrar],
  );
  const value = useMemo(() => mostrar, [mostrar]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.tono === 'error' ? 'error' : ''}`}>
            {t.tono === 'ok' && <CheckCircle2 size={26} aria-hidden="true" />}
            {t.tono === 'info' && <Info size={26} aria-hidden="true" />}
            {t.tono === 'error' && <AlertCircle size={26} aria-hidden="true" />}
            <span>{t.texto}</span>
            <button type="button" onClick={() => cerrar(t.id)} aria-label="Cerrar mensaje">
              <X size={22} aria-hidden="true" />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  return useContext(Ctx);
}
