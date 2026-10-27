// Pantalla 2 · Aviso del bloque (HU-05). Mientras la app está abierta consulta cada 30 segundos si
// corresponde un aviso. El servidor decide cuál (inicio siempre; mitad y cierre solo con pendientes)
// y anota cuáles ya se mostraron para no repetirlos. Un aviso nunca registra tomas.
import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BellRing, Volume2 } from 'lucide-react';
import { Dialog } from './Dialog';
import { perfilApi } from '../services/api';
import type { Aviso } from '../types';
import { hora, pastillas } from '../lib/formato';
import { habilitarSonido, sonarAviso } from '../lib/sonido';
import { emitirIrAMarcar } from '../lib/eventos';

const INTERVALO_MS = 30_000;

export function AvisoWatcher({ perfilId }: { perfilId: number }) {
  const [aviso, setAviso] = useState<Aviso | null>(null);
  const abierto = useRef<Aviso | null>(null);
  const irBtn = useRef<HTMLButtonElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const tituloOriginal = useRef(document.title);

  const consultar = useCallback(async () => {
    if (abierto.current) return;
    try {
      const { aviso: a } = await perfilApi.avisoActual(perfilId);
      if (!a || abierto.current) return;
      abierto.current = a;
      setAviso(a);
      sonarAviso();
      document.title = `🔔 Aviso: ${a.pendientes.length} pendiente(s) · Pastillero digital`;
      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        const n = new Notification(`Aviso ${a.numero} de 3 · Bloque de la ${a.nombreBloque.toLowerCase()}`, {
          body: `Faltan ${pastillas(a.pendientes.length)}: ${a.pendientes.map((p) => p.nombre).join(', ')}`,
          tag: `aviso-${a.fecha}-${a.clave}-${a.numero}`,
        });
        n.onclick = () => {
          window.focus();
          n.close();
        };
      }
    } catch {
      // Sin conexión: se vuelve a intentar en la próxima consulta.
    }
  }, [perfilId]);

  useEffect(() => {
    habilitarSonido();
    void consultar();
    const id = window.setInterval(() => void consultar(), INTERVALO_MS);
    const alVolver = () => {
      if (!document.hidden) void consultar();
    };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [consultar]);

  async function cerrar(irAMarcar: boolean) {
    const a = abierto.current;
    abierto.current = null;
    setAviso(null);
    document.title = tituloOriginal.current;
    if (a) {
      try {
        await perfilApi.avisoVisto(perfilId, a.clave, a.numero);
      } catch {
        // Si no se pudo anotar, el aviso puede volver a aparecer: es preferible a perderlo.
      }
      if (irAMarcar) {
        if (location.pathname !== '/hoy') navigate('/hoy', { state: { irABloque: a.clave } });
        else emitirIrAMarcar(a.clave);
      }
    }
  }

  return (
    <Dialog
      open={!!aviso}
      title={aviso ? `Aviso ${aviso.numero} de 3 · Bloque de la ${aviso.nombreBloque.toLowerCase()}` : ''}
      tone="warn"
      icon={<BellRing size={30} />}
      onClose={() => void cerrar(false)}
      initialFocusRef={irBtn}
      role="alertdialog"
      actions={
        <>
          <button type="button" className="btn btn-secondary" onClick={() => void cerrar(false)}>
            Cerrar
          </button>
          <button ref={irBtn} type="button" className="btn btn-primary btn-lg" onClick={() => void cerrar(true)}>
            Ir a marcar
          </button>
        </>
      }
    >
      {aviso && (
        <div className="stack">
          <p className="dialog-text">
            Es hora de las pastillas de la {aviso.nombreBloque.toLowerCase()} ({hora(aviso.inicio)} a {hora(aviso.fin)}).{' '}
            {aviso.pendientes.length === aviso.total
              ? `Faltan las ${pastillas(aviso.total)}.`
              : `Faltan ${pastillas(aviso.pendientes.length)} de ${aviso.total}.`}
          </p>
          <ul style={{ margin: 0, paddingLeft: '1.3rem', fontSize: '1.1rem' }}>
            {aviso.pendientes.map((p) => (
              <li key={p.planItemId}>
                <strong>{p.nombre}</strong>
                {p.etiqueta && <> ({p.etiqueta})</>} · {p.dosis}
              </li>
            ))}
          </ul>
          <p className="muted row" style={{ gap: '0.4rem' }}>
            <Volume2 size={20} aria-hidden="true" /> Sonó un aviso. Este aviso no registra las pastillas: márquelas en la pantalla Hoy.
          </p>
        </div>
      )}
    </Dialog>
  );
}
