// Pantalla 6 · Configuración de medicamentos. La persona mayor agrega, edita y quita;
// el familiar ve la misma información sin controles de edición (y el backend lo impide igual).
import { useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bell, Check, Eye, Moon, Palette, Pencil, Pill, Plus, Sun, Trash2 } from 'lucide-react';
import styles from './MedicamentosPage.module.css';
import { usePerfilPropio } from '../context/AuthContext';
import { perfilApi } from '../services/api';
import { ApiError } from '../services/http';
import { useCarga } from '../lib/useCarga';
import { hora, listaHoras } from '../lib/formato';
import { PALETA_COLORES, cargarColores, guardarColor } from '../lib/coloresMedicamento';
import { Cargando, ErrorCarga, Vacio } from '../components/Estados';
import { Dialog } from '../components/Dialog';
import { MedicamentoForm } from '../components/MedicamentoForm';
import type { DatosForm } from '../components/MedicamentoForm';
import { useToast } from '../components/Toasts';
import type { BloqueClave, Horario, Medicamento } from '../types';

export function MedicamentosPage() {
  const perfil = usePerfilPropio()!;
  return <MedicamentosVista perfilId={perfil.id} editable />;
}

export function MedicamentosSupervisionPage() {
  const { perfilId } = useParams();
  return <MedicamentosVista perfilId={Number(perfilId)} editable={false} />;
}

function MedicamentosVista({ perfilId, editable }: { perfilId: number; editable: boolean }) {
  const toast = useToast();
  const meds = useCarga(() => perfilApi.medicamentos(perfilId), [perfilId]);
  const horarios = useCarga(() => perfilApi.horarios(perfilId), [perfilId]);
  const perfil = useCarga(() => perfilApi.resumen(perfilId), [perfilId]);
  const [editando, setEditando] = useState<Medicamento | null>(null);
  const [aQuitar, setAQuitar] = useState<Medicamento | null>(null);
  const [quitando, setQuitando] = useState(false);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const [colores, setColores] = useState<Record<number, string>>(() => cargarColores());
  const [eligiendoColor, setEligiendoColor] = useState<Medicamento | null>(null);

  function elegirColor(valor: string | null) {
    if (!eligiendoColor) return;
    guardarColor(eligiendoColor.id, valor);
    setColores((c) => {
      const n = { ...c };
      if (valor) n[eligiendoColor.id] = valor;
      else delete n[eligiendoColor.id];
      return n;
    });
    setEligiendoColor(null);
  }

  if (meds.cargando || horarios.cargando) return <Cargando texto="Cargando medicamentos…" />;
  if (meds.error || horarios.error || !meds.data || !horarios.data)
    return (
      <ErrorCarga
        mensaje={meds.error ?? horarios.error ?? ''}
        onReintentar={() => {
          void meds.recargar();
          void horarios.recargar();
        }}
      />
    );

  const lista = meds.data;
  const fraseBloque = (b: BloqueClave) => (b === 'manana' ? 'el bloque de la mañana' : 'el bloque de la noche');

  async function guardar(d: DatosForm) {
    if (editando) {
      await perfilApi.editarMedicamento(perfilId, editando.id, d);
      toast(`Cambios guardados en ${d.nombre.trim()}`);
      setEditando(null);
    } else {
      await perfilApi.crearMedicamento(perfilId, d);
      toast(`Medicamento guardado en ${fraseBloque(d.bloque)}`);
    }
    await meds.recargar(true);
  }

  async function quitar(m: Medicamento) {
    setQuitando(true);
    try {
      await perfilApi.eliminarMedicamento(perfilId, m.id);
      toast(`${m.nombre} se quitó ${fraseBloque(m.bloque).replace(/^el /, 'del ')}`, 'info');
      if (editando?.id === m.id) setEditando(null);
      setAQuitar(null);
      await meds.recargar(true);
    } catch (e) {
      toast(e instanceof ApiError && e.status < 500 && e.status > 0 ? e.message : 'No se pudo guardar el cambio. Intente de nuevo.', 'error');
    } finally {
      setQuitando(false);
    }
  }

  const listado = (
    <div className="card">
      <h2 className="card-title" style={{ marginBottom: 'var(--s4)' }}>
        <Pill size={26} aria-hidden="true" /> Medicamentos cargados ({lista.length})
      </h2>
      {lista.length === 0 ? (
        <Vacio icono={<Pill size={44} aria-hidden="true" />} titulo="Todavía no hay medicamentos">
          <p>{editable ? 'Use el formulario para agregar el primero.' : 'La persona mayor todavía no cargó medicamentos.'}</p>
        </Vacio>
      ) : (
        horarios.data!.map((h: Horario) => {
          const delBloque = lista.filter((m) => m.bloque === h.clave);
          const Icono = h.clave === 'manana' ? Sun : Moon;
          return (
            <section key={h.clave} className={styles.grupo} aria-labelledby={`grupo-${h.clave}`}>
              <h3 id={`grupo-${h.clave}`} className={styles.grupoTitulo}>
                <Icono size={24} aria-hidden="true" /> {h.nombre}
                <span className={styles.horario}>
                  {hora(h.inicio)} a {hora(h.fin)}
                </span>
              </h3>
              {delBloque.length === 0 ? (
                <p className="muted">No hay pastillas en este bloque.</p>
              ) : (
                <ul className={styles.lista}>
                  {delBloque.map((m) => (
                    <li key={m.id} className={`${styles.med} ${editando?.id === m.id ? styles.editando : ''}`}>
                      {editable ? (
                        <button
                          type="button"
                          className={styles.medIcon}
                          style={colores[m.id] ? { background: colores[m.id], color: '#fff' } : undefined}
                          onClick={() => setEligiendoColor(m)}
                          aria-label={`Cambiar color de ${m.nombre}`}
                        >
                          <Pill size={22} aria-hidden="true" />
                        </button>
                      ) : (
                        <span
                          className={styles.medIcon}
                          style={colores[m.id] ? { background: colores[m.id], color: '#fff' } : undefined}
                          aria-hidden="true"
                        >
                          <Pill size={22} />
                        </span>
                      )}
                      <div className={styles.medInfo}>
                        <div className={styles.medNombre}>
                          {m.nombre}
                          {m.etiqueta && <span className="chip">{m.etiqueta}</span>}
                        </div>
                        <div className={styles.medDosis}>{m.dosis}</div>
                      </div>
                      {editable && (
                        <div className={styles.acciones}>
                          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditando(m)} aria-label={`Editar ${m.nombre}`}>
                            <Pencil size={18} aria-hidden="true" /> Editar
                          </button>
                          <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setAQuitar(m)} aria-label={`Quitar ${m.nombre}`}>
                            <Trash2 size={18} aria-hidden="true" /> Quitar
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })
      )}
    </div>
  );

  if (!editable) {
    return (
      <>
        <header className="page-header">
          <div>
            <p className="eyebrow">Supervisión · {perfil.data?.nombre}</p>
            <h1>Medicamentos y horarios</h1>
            <p className="subtitle">Lo que está configurado hoy en el pastillero.</p>
          </div>
          <Link to={`/supervision/${perfilId}`} className="btn btn-secondary">
            Volver al panel
          </Link>
        </header>
        <p className="notice" style={{ marginBottom: 'var(--s5)' }}>
          <Eye size={22} aria-hidden="true" />
          <span>Solo lectura. Los medicamentos y los horarios los cambia {perfil.data?.nombre ?? 'la persona mayor'} desde su cuenta.</span>
        </p>
        <div className="card">
          <h2 className="card-title">
            <Bell size={24} aria-hidden="true" /> Horarios de los bloques
          </h2>
          <div className={styles.horarios}>
            {horarios.data.map((h) => (
              <div key={h.clave} className={styles.horarioItem}>
                <strong>{h.nombre}</strong>: {hora(h.inicio)} a {hora(h.fin)}
                <div className="muted">Avisos: {listaHoras(h.avisos)}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ marginTop: 'var(--s5)' }}>{listado}</div>
      </>
    );
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Medicamentos</h1>
          <p className="subtitle">Cargue cada pastilla como la indicó el médico, con su dosis y su bloque.</p>
        </div>
      </header>
      <div className={styles.layout}>
        {listado}
        <div className={`card ${styles.formCard}`}>
          <h2 className="card-title" style={{ marginBottom: 'var(--s4)' }}>
            {editando ? <Pencil size={24} aria-hidden="true" /> : <Plus size={24} aria-hidden="true" />}
            {editando ? `Editar ${editando.nombre}` : 'Agregar un medicamento'}
          </h2>
          <MedicamentoForm
            inicial={editando}
            onGuardar={guardar}
            onCancelar={editando ? () => setEditando(null) : undefined}
            onEditarExistente={(id) => {
              const m = lista.find((x) => x.id === id);
              if (m) setEditando(m);
            }}
          />
          <p className="muted" style={{ marginTop: 'var(--s4)', fontSize: '0.92rem' }}>
            Los cambios se aplican desde hoy. El historial de días anteriores no se modifica.
          </p>
        </div>
      </div>

      <Dialog
        open={!!aQuitar}
        title={aQuitar ? `¿Quitar ${aQuitar.nombre}?` : ''}
        tone="no"
        icon={<Trash2 size={28} />}
        role="alertdialog"
        onClose={() => setAQuitar(null)}
        initialFocusRef={cancelarRef}
        actions={
          <>
            <button ref={cancelarRef} type="button" className="btn btn-secondary" onClick={() => setAQuitar(null)}>
              No, volver
            </button>
            <button type="button" className="btn btn-danger" disabled={quitando} onClick={() => aQuitar && void quitar(aQuitar)}>
              <Trash2 size={20} aria-hidden="true" /> Sí, quitar
            </button>
          </>
        }
      >
        {aQuitar && (
          <p className="dialog-text">
            Deja de aparecer en {fraseBloque(aQuitar.bloque)} desde hoy. Los registros de días anteriores se conservan en el historial.
          </p>
        )}
      </Dialog>

      <Dialog
        open={!!eligiendoColor}
        title={eligiendoColor ? `Color para ${eligiendoColor.nombre}` : ''}
        tone="info"
        icon={<Palette size={28} />}
        onClose={() => setEligiendoColor(null)}
        actions={
          <button type="button" className="btn btn-secondary" onClick={() => setEligiendoColor(null)}>
            Cerrar
          </button>
        }
      >
        {eligiendoColor && (
          <>
            <p className="dialog-text">Elija un color para encontrar más fácil este medicamento.</p>
            <div className={styles.paletaColores}>
              <button
                type="button"
                className={styles.colorOpcion}
                style={{ background: 'var(--surface-2)', color: 'var(--primary)' }}
                onClick={() => elegirColor(null)}
                aria-label="Color original (sin color elegido)"
                aria-pressed={!colores[eligiendoColor.id]}
              >
                {!colores[eligiendoColor.id] ? <Check size={20} aria-hidden="true" /> : <Pill size={20} aria-hidden="true" />}
              </button>
              {PALETA_COLORES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className={styles.colorOpcion}
                  style={{ background: c.valor }}
                  onClick={() => elegirColor(c.valor)}
                  aria-label={c.nombre}
                  aria-pressed={colores[eligiendoColor.id] === c.valor}
                >
                  {colores[eligiendoColor.id] === c.valor && <Check size={20} aria-hidden="true" color="#fff" />}
                </button>
              ))}
            </div>
          </>
        )}
      </Dialog>
    </>
  );
}
