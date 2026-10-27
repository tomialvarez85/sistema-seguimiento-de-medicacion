import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiError } from '../services/http';

/** Carga datos de la API con estados de carga y error. */
export function useCarga<T>(cargar: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(true);
  const fn = useRef(cargar);
  fn.current = cargar;

  const recargar = useCallback(async (silencioso = false) => {
    if (!silencioso) setCargando(true);
    try {
      const d = await fn.current();
      setData(d);
      setError(null);
      return d;
    } catch (e) {
      // En recargas silenciosas se conservan los datos que ya se ven.
      if (!silencioso) setError(e instanceof ApiError ? e.message : 'No se pudieron cargar los datos.');
      return null;
    } finally {
      if (!silencioso) setCargando(false);
    }
  }, []);

  useEffect(() => {
    void recargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, setData, error, cargando, recargar };
}
