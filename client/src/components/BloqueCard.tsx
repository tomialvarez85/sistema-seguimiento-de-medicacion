// Bloque de la pantalla Hoy (HU-01, HU-02, HU-03) con el uso por teclado del Sprint 3:
// flechas para moverse entre pastillas, Espacio marca o desmarca, Enter marca todo el bloque,
// N registra "no la tomó" y Tab pasa al bloque siguiente.
import { Fragment, useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { Bell, Check, CheckCheck, ClipboardCheck, Moon, Sun, X } from 'lucide-react';
import styles from './BloqueCard.module.css';
import type { Bloque, Item } from '../types';
import { BadgeBloque, BadgeItem, textoItem } from './Estado';
import { hora, listaHoras } from '../lib/formato';

interface Props {
  bloque: Bloque;
  ocupados: Set<number>;
  ocupadoBloque: boolean;
  onToggle: (item: Item) => void;
  onNoTomada: (item: Item) => void;
  onMarcarTodo: () => void;
  onTerminar: () => void;
}

function textoFase(b: Bloque): string {
  if (b.fase === 'proximo') return `Empieza a las ${hora(b.inicio)}`;
  if (b.fase === 'en_curso') return 'Es el horario de este bloque';
  return `El horario terminó a las ${hora(b.fin)}`;
}

export function BloqueCard({ bloque, ocupados, ocupadoBloque, onToggle, onNoTomada, onMarcarTodo, onTerminar }: Props) {
  const [activo, setActivo] = useState(0);
  const refs = useRef<(HTMLDivElement | null)[]>([]);
  const items = bloque.items;
  const terminado = bloque.fase === 'terminado';
  const indice = Math.min(activo, Math.max(items.length - 1, 0));
  const primeraRegistrada = items.findIndex((i) => i.estado !== 'pendiente');
  const hayPendientes = items.some((i) => i.estado === 'pendiente');

  // Al marcar con Espacio la pastilla baja al final: el foco se queda en la misma posición,
  // que pasa a ser la siguiente pendiente.
  const focoPendiente = useRef<number | null>(null);
  useEffect(() => {
    const idx = focoPendiente.current;
    if (idx === null) return;
    focoPendiente.current = null;
    mover(idx);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  function mover(nuevo: number) {
    const n = Math.max(0, Math.min(items.length - 1, nuevo));
    setActivo(n);
    refs.current[n]?.focus();
  }

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>, item: Item, idx: number) {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowRight':
        e.preventDefault();
        mover(idx + 1);
        break;
      case 'ArrowUp':
      case 'ArrowLeft':
        e.preventDefault();
        mover(idx - 1);
        break;
      case 'Home':
        e.preventDefault();
        mover(0);
        break;
      case 'End':
        e.preventDefault();
        mover(items.length - 1);
        break;
      case ' ':
      case 'Spacebar':
        e.preventDefault();
        if (item.estado === 'pendiente') focoPendiente.current = idx;
        onToggle(item);
        break;
      case 'Enter':
        e.preventDefault();
        onMarcarTodo();
        break;
      case 'n':
      case 'N':
        if (item.estado === 'pendiente') {
          e.preventDefault();
          focoPendiente.current = idx;
          onNoTomada(item);
        }
        break;
    }
  }

  const Icono = bloque.clave === 'manana' ? Sun : Moon;
  const titleId = `bloque-${bloque.clave}-titulo`;

  return (
    <section
      className={`${styles.card} ${bloque.fase === 'en_curso' ? styles.actual : ''}`}
      aria-labelledby={titleId}
      data-bloque={bloque.clave}
    >
      <div className={`${styles.head} ${styles[bloque.clave]}`}>
        <div className={styles.headMain}>
          <span className={styles.icon} aria-hidden="true">
            <Icono size={30} />
          </span>
          <div>
            <h2 id={titleId}>Bloque de la {bloque.nombre.toLowerCase()}</h2>
            <p className={styles.horario}>
              {hora(bloque.inicio)} a {hora(bloque.fin)}
            </p>
          </div>
        </div>
        <div className={styles.headSide}>
          <BadgeBloque estado={bloque.estado} />
          <span className={`${styles.fase} ${bloque.fase === 'en_curso' ? styles.ahora : ''}`}>{textoFase(bloque)}</span>
        </div>
      </div>

      {items.length === 0 ? (
        <p className={styles.vacio}>No hay pastillas cargadas en este bloque.</p>
      ) : (
        <div role="group" className={styles.list} aria-label={`Pastillas del bloque de la ${bloque.nombre.toLowerCase()}`}>
          {items.map((item, idx) => {
            const ocupado = ocupados.has(item.planItemId);
            const etiqueta = `${item.nombre}${item.etiqueta ? `, para ${item.etiqueta}` : ''}, ${item.dosis}. ${textoItem(item, terminado)}`;
            return (
              <Fragment key={item.planItemId}>
                {idx === primeraRegistrada && primeraRegistrada > 0 && (
                  <span className={styles.separador} aria-hidden="true">
                    Ya registradas
                  </span>
                )}
                <div
                  ref={(el) => {
                    refs.current[idx] = el;
                  }}
                  role="checkbox"
                  aria-checked={item.estado === 'tomado'}
                  aria-label={etiqueta}
                  aria-busy={ocupado}
                  tabIndex={idx === indice ? 0 : -1}
                  className={`${styles.item} ${styles[item.estado]}`}
                  data-pendiente={item.estado === 'pendiente'}
                  onFocus={() => setActivo(idx)}
                  onClick={() => !ocupado && onToggle(item)}
                  onKeyDown={(e) => !ocupado && onKeyDown(e, item, idx)}
                >
                  <span className={styles.check} aria-hidden="true">
                    {item.estado === 'tomado' && <Check size={28} strokeWidth={3} />}
                    {item.estado === 'no_tomado' && <X size={26} strokeWidth={3} />}
                  </span>
                  <span className={styles.info}>
                    <span className={styles.nombre}>
                      {item.nombre}
                      {item.etiqueta && <span className="chip">{item.etiqueta}</span>}
                    </span>
                    <span className={styles.dosis}>{item.dosis}</span>
                  </span>
                  <span className={styles.right}>
                    <BadgeItem item={item} bloqueTerminado={terminado} />
                    {item.estado === 'pendiente' && (
                      <button
                        type="button"
                        tabIndex={-1}
                        className={styles.noBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!ocupado) onNoTomada(item);
                        }}
                      >
                        <X size={16} aria-hidden="true" /> No la tomó
                      </button>
                    )}
                  </span>
                </div>
              </Fragment>
            );
          })}
        </div>
      )}

      <div className={styles.foot}>
        <button
          type="button"
          className="btn btn-primary btn-lg"
          onClick={onMarcarTodo}
          disabled={items.length === 0 || ocupadoBloque}
          aria-describedby={`${titleId}-ayuda`}
        >
          <CheckCheck size={24} aria-hidden="true" /> Marcar todo el bloque
        </button>
        <button
          type="button"
          className="btn btn-secondary btn-lg"
          onClick={onTerminar}
          disabled={items.length === 0 || ocupadoBloque}
        >
          <ClipboardCheck size={24} aria-hidden="true" /> {hayPendientes ? 'Terminar bloque' : 'Ver resumen'}
        </button>
        <p className={styles.avisos} id={`${titleId}-ayuda`}>
          <Bell size={18} aria-hidden="true" /> Avisos: {listaHoras(bloque.avisos)}
        </p>
      </div>
    </section>
  );
}
