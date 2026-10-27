// Panel de supervisión del familiar: solo lectura, con los datos reales de la base.
// No hay porcentajes ni suposiciones: lo pendiente se muestra como pendiente aunque haya pasado el horario.
import { useEffect, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  CircleDashed,
  ClipboardList,
  Eye,
  History,
  Link2,
  Moon,
  RefreshCw,
  Search,
  Sun,
  X,
} from 'lucide-react';
import styles from './SupervisionPage.module.css';
import { useAuth } from '../context/AuthContext';
import { perfilApi } from '../services/api';
import { useCarga } from '../lib/useCarga';
import { fechaLarga, hora, listaNombres } from '../lib/formato';
import { BadgeBloque, BadgeItem } from '../components/Estado';
import { Cargando, ErrorCarga, Vacio } from '../components/Estados';
import type { Bloque } from '../types';

/** Lista de personas supervisadas (o directo al panel si hay una sola). */
export function SupervisionListaPage() {
  const { perfiles } = useAuth();
  if (perfiles.length === 1) return <Navigate to={`/supervision/${perfiles[0].id}`} replace />;
  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisión</p>
          <h1>Personas que supervisa</h1>
        </div>
      </header>
      {perfiles.length === 0 ? (
        <div className="card">
          <Vacio icono={<Link2 size={48} aria-hidden="true" />} titulo="Todavía no supervisa a nadie">
            <p>Pídale a la persona mayor el código de vinculación que aparece en su sección “Familia”.</p>
            <Link to="/vincular" className="btn btn-primary">
              Vincular con un código
            </Link>
          </Vacio>
        </div>
      ) : (
        <div className={styles.perfiles}>
          {perfiles.map((p) => (
            <Link key={p.id} to={`/supervision/${p.id}`} className={styles.perfilCard}>
              <span className={styles.avatar} aria-hidden="true">
                {p.nombre.charAt(0).toUpperCase()}
              </span>
              <span>
                <strong style={{ fontSize: '1.2rem' }}>{p.nombre}</strong>
                <span className="muted" style={{ display: 'block' }}>
                  Ver la rutina de hoy
                </span>
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}

function requiereRevision(b: Bloque): boolean {
  const pend = b.items.filter((i) => i.estado === 'pendiente').length;
  return b.estado.tipo === 'incompleto' || b.estado.tipo === 'no_tomado' || (b.fase === 'terminado' && pend > 0);
}

export function SupervisionPanelPage() {
  const perfilId = Number(useParams().perfilId);
  const { perfiles } = useAuth();
  const nombre = perfiles.find((p) => p.id === perfilId)?.nombre ?? '';
  const { data: dia, error, cargando, recargar } = useCarga(() => perfilApi.hoy(perfilId), [perfilId]);
  const [actualizado, setActualizado] = useState(new Date());
  const [refrescando, setRefrescando] = useState(false);

  useEffect(() => {
    const id = window.setInterval(async () => {
      if ((await recargar(true)) !== null) setActualizado(new Date());
    }, 30_000);
    return () => window.clearInterval(id);
  }, [recargar]);

  async function actualizar() {
    setRefrescando(true);
    if ((await recargar(true)) !== null) setActualizado(new Date());
    setRefrescando(false);
  }

  if (cargando && !dia) return <Cargando texto="Cargando la rutina…" />;
  if (error || !dia) return <ErrorCarga mensaje={error ?? ''} onReintentar={() => void recargar()} />;

  const r = dia.resumen;
  const revisar = dia.bloques.filter(requiereRevision);
  const faltanAhora = dia.bloques
    .filter((b) => b.fase !== 'proximo')
    .map((b) => ({ b, pend: b.items.filter((i) => i.estado === 'pendiente') }))
    .filter((x) => x.pend.length > 0);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisión</p>
          <h1>Rutina de {nombre}</h1>
          <p className="subtitle">{fechaLarga(dia.fecha)}</p>
        </div>
        <div className={styles.actualizado}>
          <span className="muted" aria-live="polite">
            Actualizado a las {hora(actualizado.toTimeString().slice(0, 5))}
          </span>
          <button type="button" className="btn btn-secondary" onClick={() => void actualizar()} disabled={refrescando}>
            <RefreshCw size={20} aria-hidden="true" /> Actualizar
          </button>
        </div>
      </header>

      <p className="notice" style={{ marginBottom: 'var(--s5)' }}>
        <Eye size={22} aria-hidden="true" />
        <span>Solo lectura. Las tomas las registra {nombre} desde su cuenta; usted ve lo mismo que quedó guardado.</span>
      </p>

      <dl className={styles.tiles} aria-label="Resumen del día">
        <div className={`${styles.tile} ${styles.tileOk}`}>
          <dt>
            <Check size={20} aria-hidden="true" /> Tomadas
          </dt>
          <dd>{r.tomadas}</dd>
          <small>de {r.total} pastillas del día</small>
        </div>
        <div className={`${styles.tile} ${styles.tilePend}`}>
          <dt>
            <CircleDashed size={20} aria-hidden="true" /> Pendientes
          </dt>
          <dd>{r.pendientes}</dd>
          <small>todavía sin registrar</small>
        </div>
        <div className={`${styles.tile} ${styles.tileNo}`}>
          <dt>
            <X size={20} aria-hidden="true" /> No tomadas
          </dt>
          <dd>{r.noTomadas}</dd>
          <small>registradas como no tomadas</small>
        </div>
        <div className={`${styles.tile} ${styles.tileRev}`}>
          <dt>
            <Search size={20} aria-hidden="true" /> Para revisar
          </dt>
          <dd>{revisar.length}</dd>
          <small>{revisar.length === 1 ? 'bloque incompleto' : 'bloques incompletos'}</small>
        </div>
      </dl>

      {r.total === 0 ? (
        <div className="card">
          <Vacio icono={<ClipboardList size={44} aria-hidden="true" />} titulo="No hay medicamentos cargados">
            <p>Cuando {nombre} cargue sus medicamentos, va a ver aquí su rutina.</p>
          </Vacio>
        </div>
      ) : (
        <>
          <div className={`notice ${faltanAhora.length ? 'notice-warn' : 'notice-ok'} ${styles.faltan}`} role="status">
            {faltanAhora.length ? <AlertTriangle size={24} aria-hidden="true" /> : <CheckCircle2 size={24} aria-hidden="true" />}
            <div>
              {faltanAhora.length ? (
                <>
                  <strong>Qué falta registrar</strong>
                  <ul>
                    {faltanAhora.map(({ b, pend }) => (
                      <li key={b.clave}>
                        Bloque de la {b.nombre.toLowerCase()}
                        {b.fase === 'terminado' ? ` (terminó a las ${hora(b.fin)})` : ' (en horario)'}: {listaNombres(pend.map((p) => p.nombre))}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <strong>No falta registrar nada de los bloques que ya empezaron.</strong>
              )}
            </div>
          </div>

          <div className={styles.bloques}>
            {dia.bloques.map((b) => (
              <BloqueLectura key={b.clave} bloque={b} revisar={requiereRevision(b)} />
            ))}
          </div>
        </>
      )}

      <div className="row" style={{ marginTop: 'var(--s5)' }}>
        <Link to={`/supervision/${perfilId}/historial`} className="btn btn-primary">
          <History size={22} aria-hidden="true" /> Ver historial
        </Link>
        <Link to={`/supervision/${perfilId}/medicamentos`} className="btn btn-secondary">
          <ClipboardList size={22} aria-hidden="true" /> Medicamentos y horarios
        </Link>
      </div>
    </>
  );
}

function BloqueLectura({ bloque, revisar }: { bloque: Bloque; revisar: boolean }) {
  const Icono = bloque.clave === 'manana' ? Sun : Moon;
  const fase =
    bloque.fase === 'proximo'
      ? `Empieza a las ${hora(bloque.inicio)}`
      : bloque.fase === 'en_curso'
        ? 'En horario ahora'
        : `Terminó a las ${hora(bloque.fin)}`;
  return (
    <section className="card" aria-labelledby={`sup-${bloque.clave}`} style={{ margin: 0 }}>
      <div className={styles.bloqueHead}>
        <div>
          <h2 id={`sup-${bloque.clave}`} className="card-title">
            <Icono size={26} aria-hidden="true" /> Bloque de la {bloque.nombre.toLowerCase()}
          </h2>
          <p className={styles.fase}>
            {hora(bloque.inicio)} a {hora(bloque.fin)} · {fase}
          </p>
        </div>
        <div className="stack" style={{ gap: 'var(--s2)', alignItems: 'flex-end' }}>
          <BadgeBloque estado={bloque.estado} />
          {revisar && (
            <span className="badge badge-info">
              <Search size={16} aria-hidden="true" /> Revisar
            </span>
          )}
        </div>
      </div>
      {bloque.items.length === 0 ? (
        <p className="muted">Sin pastillas en este bloque.</p>
      ) : (
        <ul className={styles.items}>
          {bloque.items.map((i) => (
            <li key={i.planItemId} className={i.estado === 'pendiente' ? styles.pendiente : ''}>
              <span>
                <span className={styles.nombre}>{i.nombre}</span>
                {i.etiqueta && <span className="chip" style={{ marginLeft: '0.5rem' }}>{i.etiqueta}</span>}
                <span className={styles.sub} style={{ display: 'block' }}>
                  {i.dosis}
                  {i.registradoPor && ` · Registró: ${i.registradoPor}`}
                </span>
              </span>
              <BadgeItem item={i} bloqueTerminado={bloque.fase === 'terminado'} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
