// Persona mayor: código para vincular familiares y lista de quienes pueden ver su rutina.
import { useRef, useState } from 'react';
import { KeyRound, RefreshCw, ShieldCheck, UserMinus, Users } from 'lucide-react';
import { vinculacionApi } from '../services/api';
import { useCarga } from '../lib/useCarga';
import { fechaHoraIso } from '../lib/formato';
import { Cargando, ErrorCarga, Vacio } from '../components/Estados';
import { Dialog } from '../components/Dialog';
import { useToast } from '../components/Toasts';
import { ApiError } from '../services/http';
import type { Familiar } from '../types';

export function FamiliaPage() {
  const toast = useToast();
  const codigo = useCarga(() => vinculacionApi.codigo(), []);
  const familiares = useCarga(() => vinculacionApi.familiares(), []);
  const [generando, setGenerando] = useState(false);
  const [aQuitar, setAQuitar] = useState<Familiar | null>(null);
  const cancelar = useRef<HTMLButtonElement>(null);

  async function generar() {
    setGenerando(true);
    try {
      const r = await vinculacionApi.nuevoCodigo();
      codigo.setData(r);
      toast('Código nuevo creado. El anterior ya no sirve.');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo crear el código.', 'error');
    } finally {
      setGenerando(false);
    }
  }

  async function quitar(f: Familiar) {
    try {
      await vinculacionApi.quitarFamiliar(f.id);
      setAQuitar(null);
      toast(`${f.nombre} ya no puede ver su rutina`, 'info');
      await familiares.recargar(true);
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'No se pudo guardar el cambio. Intente de nuevo.', 'error');
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Compartir</p>
          <h1>Familia</h1>
          <p className="subtitle">Sus familiares pueden ver su rutina e historial desde su propia cuenta. No pueden cambiar nada.</p>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(26rem, 100%), 1fr))', gap: 'var(--s5)', alignItems: 'start' }}>
        <section className="card" aria-labelledby="titulo-codigo">
          <h2 id="titulo-codigo" className="card-title">
            <KeyRound size={26} aria-hidden="true" /> Código para vincular
          </h2>
          <ol style={{ paddingLeft: '1.3rem', margin: 'var(--s4) 0' }}>
            <li>Su familiar crea una cuenta de tipo “Familiar o cuidador”.</li>
            <li>Entra en “Vincular” y escribe este código.</li>
            <li>Confirma la vinculación y ya puede ver su rutina.</li>
          </ol>
          {codigo.cargando ? (
            <Cargando />
          ) : codigo.error ? (
            <ErrorCarga mensaje={codigo.error} onReintentar={() => void codigo.recargar()} />
          ) : codigo.data?.codigo ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--s5)',
                background: 'var(--primary-soft)',
                borderRadius: 'var(--radius)',
                border: '2px dashed var(--primary-line)',
              }}
            >
              <p className="muted">Código</p>
              <p style={{ fontSize: '2.4rem', fontWeight: 700, letterSpacing: '0.12em', fontVariantNumeric: 'tabular-nums' }} aria-live="polite">
                {codigo.data.codigo.codigo}
              </p>
              <p className="muted">Sirve una sola vez. Vence el {fechaHoraIso(codigo.data.codigo.expiraEn)}.</p>
            </div>
          ) : (
            <p className="notice">
              <KeyRound size={22} aria-hidden="true" /> <span>No hay un código activo. Cree uno para compartirlo con un familiar.</span>
            </p>
          )}
          <div className="row" style={{ marginTop: 'var(--s4)' }}>
            <button type="button" className="btn btn-primary" onClick={() => void generar()} disabled={generando}>
              <RefreshCw size={22} aria-hidden="true" /> {codigo.data?.codigo ? 'Crear un código nuevo' : 'Crear código'}
            </button>
          </div>
          <p className="muted row" style={{ marginTop: 'var(--s4)', gap: '0.4rem', fontSize: '0.92rem' }}>
            <ShieldCheck size={20} aria-hidden="true" /> Comparta el código solo con personas de confianza.
          </p>
        </section>

        <section className="card" aria-labelledby="titulo-familiares">
          <h2 id="titulo-familiares" className="card-title" style={{ marginBottom: 'var(--s4)' }}>
            <Users size={26} aria-hidden="true" /> Quiénes pueden ver su rutina
          </h2>
          {familiares.cargando ? (
            <Cargando />
          ) : familiares.error || !familiares.data ? (
            <ErrorCarga mensaje={familiares.error ?? ''} onReintentar={() => void familiares.recargar()} />
          ) : familiares.data.length === 0 ? (
            <Vacio icono={<Users size={44} aria-hidden="true" />} titulo="Todavía no hay familiares vinculados">
              <p>Cuando un familiar use su código, va a aparecer aquí.</p>
            </Vacio>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 'var(--s2)' }}>
              {familiares.data.map((f) => (
                <li
                  key={f.id}
                  className="row"
                  style={{ justifyContent: 'space-between', padding: 'var(--s3) var(--s4)', border: '1px solid var(--border)', borderRadius: 'var(--radius)' }}
                >
                  <span>
                    <strong>{f.nombre}</strong>
                    <span className="muted"> · {f.email}</span>
                  </span>
                  <button type="button" className="btn btn-danger-outline btn-sm" onClick={() => setAQuitar(f)}>
                    <UserMinus size={18} aria-hidden="true" /> Quitar acceso
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <Dialog
        open={!!aQuitar}
        title={aQuitar ? `¿Quitar el acceso de ${aQuitar.nombre}?` : ''}
        tone="no"
        icon={<UserMinus size={28} />}
        role="alertdialog"
        onClose={() => setAQuitar(null)}
        initialFocusRef={cancelar}
        actions={
          <>
            <button ref={cancelar} type="button" className="btn btn-secondary" onClick={() => setAQuitar(null)}>
              No, volver
            </button>
            <button type="button" className="btn btn-danger" onClick={() => aQuitar && void quitar(aQuitar)}>
              Sí, quitar acceso
            </button>
          </>
        }
      >
        <p className="dialog-text">Va a dejar de ver su rutina y su historial. Puede volver a vincularse con un código nuevo.</p>
      </Dialog>
    </>
  );
}
