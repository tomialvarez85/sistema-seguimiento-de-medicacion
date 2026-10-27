// Pantalla 1 · Hoy (persona mayor), con las pantallas 3 (Bloque incompleto) y 4 (Confirmaciones).
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, BellRing, Check, CircleDashed, Info, Pill, RotateCw, X } from 'lucide-react';
import styles from './HoyPage.module.css';
import { usePerfilPropio, useAuth } from '../context/AuthContext';
import { perfilApi } from '../services/api';
import { ApiError } from '../services/http';
import { useCarga } from '../lib/useCarga';
import { fechaLarga, fraseBloque, hora, listaNombres, pastillas } from '../lib/formato';
import { IR_A_MARCAR } from '../lib/eventos';
import { BloqueCard } from '../components/BloqueCard';
import { Dialog } from '../components/Dialog';
import { Cargando, ErrorCarga, Vacio } from '../components/Estados';
import { useToast } from '../components/Toasts';
import type { Bloque, BloqueClave, Dia, Item } from '../types';

type Confirmacion = { titulo: string; texto?: string; tono: 'ok' | 'info' | 'no' };

export function HoyPage() {
  const perfil = usePerfilPropio()!;
  const { user } = useAuth();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { data: dia, setData: setDia, error, cargando, recargar } = useCarga(() => perfilApi.hoy(perfil.id), [perfil.id]);

  const [ocupados, setOcupados] = useState<Set<number>>(new Set());
  const [ocupadoBloque, setOcupadoBloque] = useState<BloqueClave | null>(null);
  const [confirmacion, setConfirmacion] = useState<Confirmacion | null>(null);
  const [incompleto, setIncompleto] = useState<BloqueClave | null>(null);
  const [noTomada, setNoTomada] = useState<Item | null>(null);
  const [errorGuardar, setErrorGuardar] = useState<{ mensaje: string; reintentar: () => void } | null>(null);
  const [permisoNotif, setPermisoNotif] = useState<NotificationPermission | 'no'>(
    'Notification' in window ? Notification.permission : 'no',
  );

  const okRef = useRef<HTMLButtonElement>(null);
  const volverRef = useRef<HTMLButtonElement>(null);
  const cancelarNoRef = useRef<HTMLButtonElement>(null);
  const reintentarRef = useRef<HTMLButtonElement>(null);

  // Actualiza la fase de los bloques y lo registrado desde otra pestaña.
  useEffect(() => {
    const id = window.setInterval(() => void recargar(true), 60_000);
    const alVolver = () => !document.hidden && void recargar(true);
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      window.clearInterval(id);
      document.removeEventListener('visibilitychange', alVolver);
    };
  }, [recargar]);

  const enfocarPendiente = useCallback((clave: BloqueClave) => {
    requestAnimationFrame(() => {
      const sel = `[data-bloque="${clave}"] [data-pendiente="true"]`;
      const el = document.querySelector<HTMLElement>(sel) ?? document.querySelector<HTMLElement>(`[data-bloque="${clave}"] [role="checkbox"]`);
      el?.focus();
      el?.scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
  }, []);

  // "Ir a marcar" desde un aviso: foco en la primera pastilla pendiente del bloque.
  useEffect(() => {
    const desdeAviso = (location.state as { irABloque?: BloqueClave } | null)?.irABloque;
    if (desdeAviso && dia) {
      void recargar(true).then(() => enfocarPendiente(desdeAviso));
      navigate('.', { replace: true, state: null });
    }
    const handler = (e: Event) => {
      const clave = (e as CustomEvent<BloqueClave>).detail;
      void recargar(true).then(() => enfocarPendiente(clave));
    };
    window.addEventListener(IR_A_MARCAR, handler);
    return () => window.removeEventListener(IR_A_MARCAR, handler);
  }, [location.state, dia, recargar, enfocarPendiente, navigate]);

  function manejarError(e: unknown, reintentar: () => void) {
    if (e instanceof ApiError && e.code === 'REGISTRO_DUPLICADO') {
      // Solo informa: el registro no se duplica.
      setConfirmacion({ titulo: 'Ya estaba registrado', texto: e.message, tono: 'info' });
      void recargar(true);
      return;
    }
    if (e instanceof ApiError && e.status > 0 && e.status < 500 && e.code !== 'SIN_CONEXION') {
      toast(e.message, 'error');
      void recargar(true);
      return;
    }
    setErrorGuardar({
      mensaje: e instanceof ApiError && e.code === 'SIN_CONEXION' ? e.message : 'No se pudo guardar el cambio. Intente de nuevo.',
      reintentar,
    });
  }

  async function conItem(item: Item, accion: () => Promise<void>) {
    if (ocupados.has(item.planItemId)) return;
    setOcupados((s) => new Set(s).add(item.planItemId));
    try {
      await accion();
    } finally {
      setOcupados((s) => {
        const n = new Set(s);
        n.delete(item.planItemId);
        return n;
      });
    }
  }

  function toggle(item: Item) {
    void conItem(item, async () => {
      try {
        if (item.estado === 'pendiente') {
          const r = await perfilApi.registrarToma(perfil.id, item.planItemId, 'tomado');
          setDia(r.dia);
          toast(r.tarde ? `Registrada como tomada tarde a las ${hora(r.hora)}` : `${r.nombre}: tomada a las ${hora(r.hora)}`);
        } else {
          // Desmarcar es libre, sin confirmación, con un aviso breve (Sprint 2).
          const r = await perfilApi.desmarcar(perfil.id, item.planItemId);
          setDia(r.dia);
          toast(`${r.nombre} desmarcada`, 'info');
        }
      } catch (e) {
        manejarError(e, () => toggle(item));
      }
    });
  }

  function registrarNoTomada(item: Item) {
    setNoTomada(null);
    void conItem(item, async () => {
      try {
        const r = await perfilApi.registrarToma(perfil.id, item.planItemId, 'no_tomado');
        setDia(r.dia);
        toast(`${r.nombre}: registrada como no tomada`, 'info');
      } catch (e) {
        manejarError(e, () => registrarNoTomada(item));
      }
    });
  }

  async function marcarTodo(b: Bloque) {
    if (ocupadoBloque) return;
    setOcupadoBloque(b.clave);
    try {
      const r = await perfilApi.marcarBloque(perfil.id, b.clave);
      setDia(r.dia);
      setConfirmacion({
        titulo: `Bloque de la ${b.nombre.toLowerCase()} registrado${r.tarde ? ' como tarde' : ''} a las ${hora(r.hora)}`,
        texto: `Se ${r.cantidad === 1 ? 'marcó 1 pastilla' : `marcaron ${r.cantidad} pastillas`} como tomada${r.cantidad === 1 ? '' : 's'}.`,
        tono: 'ok',
      });
    } catch (e) {
      manejarError(e, () => void marcarTodo(b));
    } finally {
      setOcupadoBloque(null);
    }
  }

  function terminar(b: Bloque) {
    const pendientes = b.items.filter((i) => i.estado === 'pendiente');
    if (pendientes.length > 0) {
      setIncompleto(b.clave);
      return;
    }
    const noT = b.items.filter((i) => i.estado === 'no_tomado');
    setConfirmacion({
      titulo: `Bloque de la ${b.nombre.toLowerCase()} registrado a las ${hora(b.ultimaHora)}`,
      texto:
        noT.length === 0
          ? `Las ${pastillas(b.items.length)} están registradas como tomadas.`
          : `${b.estado.tomadas} tomada(s). No tomada(s): ${listaNombres(noT.map((i) => i.nombre))}.`,
      tono: noT.length === 0 ? 'ok' : 'info',
    });
  }

  async function confirmarIgual(clave: BloqueClave) {
    setIncompleto(null);
    setOcupadoBloque(clave);
    try {
      const r = await perfilApi.confirmarBloque(perfil.id, clave);
      setDia(r.dia);
      const b = r.dia.bloques.find((x) => x.clave === clave)!;
      setConfirmacion({
        titulo: `Bloque de la ${b.nombre.toLowerCase()} confirmado a las ${hora(r.hora)}`,
        texto: `Quedaron registradas como no tomadas: ${listaNombres(r.noTomadas)}.`,
        tono: 'info',
      });
    } catch (e) {
      manejarError(e, () => void confirmarIgual(clave));
    } finally {
      setOcupadoBloque(null);
    }
  }

  if (cargando && !dia) return <Cargando texto="Cargando la rutina de hoy…" />;
  if (error || !dia)
    return <ErrorCarga mensaje={error ?? 'No se pudieron cargar los datos guardados.'} onReintentar={() => void recargar()} />;

  const r = dia.resumen;
  const bloqueIncompleto = dia.bloques.find((b) => b.clave === incompleto) ?? null;

  return (
    <>
      <section className={styles.resumen} aria-labelledby="titulo-hoy">
        <div>
          <p className={styles.saludo}>Hola, {user?.nombre}</p>
          <h1 id="titulo-hoy" className={styles.fecha}>
            Hoy, {fechaLarga(dia.fecha)}
          </h1>
          <p className={styles.frase} aria-live="polite">
            {r.total === 0 ? (
              'Todavía no hay medicamentos cargados.'
            ) : r.pendientes === 0 ? (
              <>
                <strong>Listo.</strong> Ya registró todas las pastillas de hoy.
              </>
            ) : (
              <>
                Le {r.pendientes === 1 ? 'falta' : 'faltan'} registrar <strong>{pastillas(r.pendientes)}</strong> hoy.
              </>
            )}
          </p>
        </div>
        {r.total > 0 && <Progreso dia={dia} />}
      </section>

      {permisoNotif === 'default' && (
        <div className="notice" style={{ marginBottom: 'var(--s5)' }}>
          <BellRing size={24} aria-hidden="true" />
          <div className="stack" style={{ gap: 'var(--s2)', flex: 1 }}>
            <p>
              Los avisos suenan y aparecen mientras esta página está abierta. Si quiere verlos también cuando usa otra
              pestaña, active los avisos del navegador.
            </p>
            <div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => void Notification.requestPermission().then(setPermisoNotif)}
              >
                Activar avisos del navegador
              </button>
            </div>
          </div>
        </div>
      )}

      {r.total === 0 ? (
        <div className="card">
          <Vacio icono={<Pill size={48} aria-hidden="true" />} titulo="Agregue sus medicamentos para empezar">
            <p>Cargue cada pastilla con su dosis y el bloque en que se toma (mañana o noche).</p>
            <Link to="/medicamentos" className="btn btn-primary">
              Ir a Medicamentos
            </Link>
          </Vacio>
        </div>
      ) : (
        <div className={styles.bloques}>
          {dia.bloques.map((b) => (
            <BloqueCard
              key={b.clave}
              bloque={b}
              ocupados={ocupados}
              ocupadoBloque={ocupadoBloque === b.clave}
              onToggle={toggle}
              onNoTomada={(item) => setNoTomada(item)}
              onMarcarTodo={() => void marcarTodo(b)}
              onTerminar={() => terminar(b)}
            />
          ))}
        </div>
      )}

      {/* Pantalla 4 · Confirmaciones */}
      <Dialog
        open={!!confirmacion}
        title={confirmacion?.titulo ?? ''}
        tone={confirmacion?.tono ?? 'ok'}
        icon={confirmacion?.tono === 'ok' ? <Check size={32} strokeWidth={3} /> : <Info size={30} />}
        onClose={() => setConfirmacion(null)}
        initialFocusRef={okRef}
        actions={
          <button ref={okRef} type="button" className="btn btn-primary btn-lg" onClick={() => setConfirmacion(null)}>
            Listo
          </button>
        }
      >
        {confirmacion?.texto && <p className="dialog-text">{confirmacion.texto}</p>}
      </Dialog>

      {/* Pantalla 3 · Bloque incompleto */}
      <Dialog
        open={!!bloqueIncompleto}
        title={
          bloqueIncompleto
            ? `Faltan ${pastillas(bloqueIncompleto.items.filter((i) => i.estado === 'pendiente').length)}`
            : ''
        }
        tone="warn"
        icon={<AlertTriangle size={30} />}
        role="alertdialog"
        onClose={() => setIncompleto(null)}
        initialFocusRef={volverRef}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => bloqueIncompleto && void confirmarIgual(bloqueIncompleto.clave)}>
              Confirmar igual
            </button>
            <button
              ref={volverRef}
              type="button"
              className="btn btn-primary btn-lg"
              onClick={() => {
                const clave = incompleto!;
                setIncompleto(null);
                // Después de que el diálogo devuelva el foco, se lleva a la primera pendiente.
                window.setTimeout(() => enfocarPendiente(clave), 50);
              }}
            >
              Volver y marcar
            </button>
          </>
        }
      >
        {bloqueIncompleto && <DetalleIncompleto bloque={bloqueIncompleto} />}
      </Dialog>

      {/* Registrar que no la tomó */}
      <Dialog
        open={!!noTomada}
        title={noTomada ? `¿Registrar que ${noTomada.nombre} no se tomó?` : ''}
        tone="no"
        icon={<X size={30} strokeWidth={3} />}
        onClose={() => setNoTomada(null)}
        initialFocusRef={cancelarNoRef}
        actions={
          <>
            <button ref={cancelarNoRef} type="button" className="btn btn-secondary" onClick={() => setNoTomada(null)}>
              Volver
            </button>
            <button type="button" className="btn btn-danger" onClick={() => noTomada && registrarNoTomada(noTomada)}>
              Sí, no se tomó
            </button>
          </>
        }
      >
        <p className="dialog-text">
          Quedará registrada como <strong>No tomada</strong>. Si se equivocó, puede desmarcarla después.
        </p>
      </Dialog>

      {/* Error al guardar */}
      <Dialog
        open={!!errorGuardar}
        title="No se pudo guardar el cambio"
        tone="no"
        icon={<AlertTriangle size={30} />}
        role="alertdialog"
        onClose={() => setErrorGuardar(null)}
        initialFocusRef={reintentarRef}
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => setErrorGuardar(null)}>
              Cerrar
            </button>
            <button
              ref={reintentarRef}
              type="button"
              className="btn btn-primary"
              onClick={() => {
                const f = errorGuardar?.reintentar;
                setErrorGuardar(null);
                f?.();
              }}
            >
              <RotateCw size={22} aria-hidden="true" /> Intentar de nuevo
            </button>
          </>
        }
      >
        <p className="dialog-text">{errorGuardar?.mensaje}</p>
      </Dialog>
    </>
  );
}

function Progreso({ dia }: { dia: Dia }) {
  const r = dia.resumen;
  const pct = (n: number) => `${(n / r.total) * 100}%`;
  return (
    <div className={styles.progreso}>
      <p>
        <strong>
          {r.tomadas} de {r.total}
        </strong>{' '}
        pastillas tomadas hoy
      </p>
      <div
        className={styles.barra}
        role="img"
        aria-label={`${r.tomadas} tomadas, ${r.noTomadas} no tomadas y ${r.pendientes} pendientes, de ${r.total}`}
      >
        <span className={styles.barraOk} style={{ width: pct(r.tomadas) }} />
        <span className={styles.barraNo} style={{ width: pct(r.noTomadas) }} />
      </div>
      <dl className={styles.cuentas}>
        <div>
          <dt>
            <Check size={16} aria-hidden="true" /> Tomadas
          </dt>
          <dd className={styles.ok}>{r.tomadas}</dd>
        </div>
        <div>
          <dt>
            <CircleDashed size={16} aria-hidden="true" /> Pendientes
          </dt>
          <dd className={styles.pend}>{r.pendientes}</dd>
        </div>
        <div>
          <dt>
            <X size={16} aria-hidden="true" /> No tomadas
          </dt>
          <dd className={styles.no}>{r.noTomadas}</dd>
        </div>
      </dl>
    </div>
  );
}

function DetalleIncompleto({ bloque }: { bloque: Bloque }) {
  const pendientes = bloque.items.filter((i) => i.estado === 'pendiente');
  const tomadas = bloque.items.filter((i) => i.estado === 'tomado');
  const noTomadas = bloque.items.filter((i) => i.estado === 'no_tomado');
  return (
    <div>
      <p className="dialog-text">
        Faltan {pastillas(pendientes.length)} en {fraseBloque(bloque.nombre)}:{' '}
        <strong>{listaNombres(pendientes.map((p) => p.nombre))}</strong>. ¿Confirmar igual?
      </p>
      <div className={styles.grupoDialogo} style={{ marginTop: 'var(--s4)' }}>
        <h3>
          <CircleDashed size={18} aria-hidden="true" /> Sin marcar ({pendientes.length})
        </h3>
        <ul className={styles.listaDialogo}>
          {pendientes.map((p) => (
            <li key={p.planItemId}>
              {p.nombre}
              {p.etiqueta && ` (${p.etiqueta})`}
            </li>
          ))}
        </ul>
      </div>
      {tomadas.length > 0 && (
        <div className={styles.grupoDialogo}>
          <h3>
            <Check size={18} aria-hidden="true" /> Tomadas ({tomadas.length})
          </h3>
          <ul className={styles.listaDialogo}>
            {tomadas.map((p) => (
              <li key={p.planItemId}>
                {p.nombre} · {hora(p.hora)}
              </li>
            ))}
          </ul>
        </div>
      )}
      {noTomadas.length > 0 && (
        <div className={styles.grupoDialogo}>
          <h3>
            <X size={18} aria-hidden="true" /> No tomadas ({noTomadas.length})
          </h3>
          <ul className={styles.listaDialogo}>
            {noTomadas.map((p) => (
              <li key={p.planItemId}>{p.nombre}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="notice notice-warn" style={{ marginTop: 'var(--s4)' }}>
        <Info size={22} aria-hidden="true" />
        <span>
          Si confirma igual, las que faltan quedan registradas como <strong>No tomada</strong>.
        </span>
      </p>
    </div>
  );
}
