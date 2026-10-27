// Pantalla 7 · Historial (HU-06): últimos 7 días con el estado de cada bloque y el detalle del día.
// La persona mayor y el familiar ven los mismos registros; nadie puede modificarlos desde aquí.
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, History, ListChecks } from 'lucide-react';
import styles from './HistorialPage.module.css';
import { usePerfilPropio } from '../context/AuthContext';
import { perfilApi } from '../services/api';
import { useCarga } from '../lib/useCarga';
import { fechaCorta, fechaLarga, hora } from '../lib/formato';
import { BadgeBloque, BadgeItem } from '../components/Estado';
import { Cargando, ErrorCarga, Vacio } from '../components/Estados';
import type { Dia } from '../types';

export function HistorialPage() {
  const perfil = usePerfilPropio()!;
  return <HistorialVista perfilId={perfil.id} supervision={false} />;
}

export function HistorialSupervisionPage() {
  const { perfilId } = useParams();
  return <HistorialVista perfilId={Number(perfilId)} supervision />;
}

function HistorialVista({ perfilId, supervision }: { perfilId: number; supervision: boolean }) {
  const [hasta, setHasta] = useState<string | undefined>(undefined);
  const [seleccion, setSeleccion] = useState<string | null>(null);
  const semana = useCarga(() => perfilApi.historial(perfilId, hasta), [perfilId, hasta]);
  const resumen = useCarga(() => perfilApi.resumen(perfilId), [perfilId]);
  const detalleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setSeleccion(null);
  }, [hasta]);

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">{supervision ? `Supervisión · ${resumen.data?.nombre ?? ''}` : 'Registro'}</p>
          <h1>Historial</h1>
          <p className="subtitle">Últimos 7 días con el estado de cada bloque. Elija un día para ver el detalle.</p>
        </div>
        {supervision && (
          <Link to={`/supervision/${perfilId}`} className="btn btn-secondary">
            Volver al panel
          </Link>
        )}
      </header>

      {supervision && (
        <p className="notice" style={{ marginBottom: 'var(--s5)' }}>
          <Eye size={22} aria-hidden="true" /> <span>Solo lectura: el historial no se puede modificar.</span>
        </p>
      )}

      <section className="card" aria-labelledby="titulo-semana">
        <h2 id="titulo-semana" className="card-title" style={{ marginBottom: 'var(--s4)' }}>
          <History size={26} aria-hidden="true" />
          {semana.data ? `Del ${fechaCorta(semana.data.desde)} al ${fechaCorta(semana.data.hasta)}` : 'Semana'}
        </h2>
        {semana.cargando ? (
          <Cargando texto="Cargando el historial…" />
        ) : semana.error || !semana.data ? (
          <ErrorCarga mensaje={semana.error ?? ''} onReintentar={() => void semana.recargar()} />
        ) : semana.data.dias.length === 0 ? (
          <Vacio icono={<History size={44} aria-hidden="true" />} titulo="Todavía no hay registros" />
        ) : (
          <>
            <div className={styles.tablaWrap}>
              <table className={styles.tabla}>
                <caption className="visually-hidden">Estado de cada bloque por día</caption>
                <thead>
                  <tr>
                    <th scope="col">Día</th>
                    <th scope="col">Mañana</th>
                    <th scope="col">Noche</th>
                    <th scope="col">
                      <span className="visually-hidden">Detalle</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {semana.data.dias.map((d: Dia) => (
                    <tr key={d.fecha} className={seleccion === d.fecha ? styles.seleccionado : ''}>
                      <th scope="row" className={styles.dia}>
                        {fechaCorta(d.fecha)}
                        {d.esHoy && <span className={styles.hoy}>HOY</span>}
                      </th>
                      {d.bloques.map((b) => (
                        <td key={b.clave}>
                          <BadgeBloque estado={b.estado} esHoy={d.esHoy} />
                        </td>
                      ))}
                      <td style={{ textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          aria-pressed={seleccion === d.fecha}
                          onClick={() => {
                            setSeleccion(d.fecha);
                            requestAnimationFrame(() => detalleRef.current?.focus());
                          }}
                        >
                          <ListChecks size={18} aria-hidden="true" /> Ver detalle
                          <span className="visually-hidden"> del {fechaLarga(d.fecha)}</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className={styles.leyenda} aria-label="Referencias">
              <span className="badge badge-ok">✓ Completo</span>
              <span className="badge badge-late">Tarde: tomada después del horario</span>
              <span className="badge badge-pending">Incompleto: tomadas de total</span>
              <span className="badge badge-no">No tomado: se registró que no se tomó</span>
              <span className="badge badge-neutral">Sin registrar: nadie registró nada</span>
            </div>
            <div className={styles.paginas}>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!semana.data.anterior}
                onClick={() => setHasta(semana.data!.anterior!)}
              >
                <ChevronLeft size={22} aria-hidden="true" /> Semana anterior
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                disabled={!semana.data.siguiente}
                onClick={() => setHasta(semana.data!.siguiente ?? undefined)}
              >
                Semana siguiente <ChevronRight size={22} aria-hidden="true" />
              </button>
            </div>
          </>
        )}
      </section>

      {seleccion && <DetalleDia perfilId={perfilId} fecha={seleccion} refFoco={detalleRef} />}
    </>
  );
}

function DetalleDia({ perfilId, fecha, refFoco }: { perfilId: number; fecha: string; refFoco: React.RefObject<HTMLElement | null> }) {
  const { data, error, cargando, recargar } = useCarga(() => perfilApi.historialDia(perfilId, fecha), [perfilId, fecha]);
  return (
    <section className="card" ref={refFoco} tabIndex={-1} aria-labelledby="titulo-detalle" style={{ marginTop: 'var(--s5)' }}>
      <h2 id="titulo-detalle">{fechaLarga(fecha)}</h2>
      {cargando ? (
        <Cargando />
      ) : error || !data ? (
        <ErrorCarga mensaje={error ?? 'No se pudo consultar el historial.'} onReintentar={() => void recargar()} />
      ) : (
        <>
          <div className={styles.detalleBloques}>
            {data.bloques.map((b) => {
              const faltaron = b.items.filter((i) => i.estado !== 'tomado');
              return (
                <div key={b.clave} className={styles.detalleBloque}>
                  <div className={styles.detalleHead}>
                    <h3>
                      {b.nombre} <span className="muted" style={{ fontWeight: 400 }}>({hora(b.inicio)} a {hora(b.fin)})</span>
                    </h3>
                    <BadgeBloque estado={b.estado} esHoy={data.esHoy} />
                  </div>
                  {b.items.length === 0 ? (
                    <p className="muted">Sin medicamentos ese día.</p>
                  ) : (
                    <>
                      {faltaron.length > 0 && (
                        <p style={{ marginBottom: 'var(--s2)' }}>
                          <strong>Faltó:</strong> {faltaron.map((i) => i.nombre).join(', ')}
                        </p>
                      )}
                      <ul className={styles.items}>
                        {b.items.map((i) => (
                          <li key={i.planItemId}>
                            <span>
                              <strong>{i.nombre}</strong>
                              {i.etiqueta && <> ({i.etiqueta})</>} · {i.dosis}
                              {i.registradoPor && <div className={styles.quien}>Registró: {i.registradoPor}</div>}
                            </span>
                            <BadgeItem item={i} esHoy={data.esHoy} />
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <h3 style={{ marginTop: 'var(--s5)' }}>Lo que pasó ese día</h3>
          {data.eventos.length === 0 ? (
            <p className="muted">No hubo movimientos.</p>
          ) : (
            <ul className={styles.eventos}>
              {data.eventos.map((e) => (
                <li key={e.id}>
                  <time>{hora(e.hora)}</time>
                  <span>
                    {e.descripcion}
                    {e.usuario && <span className="muted"> · {e.usuario}</span>}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
