// Formulario de medicamento (HU-04): nombre, dosis, bloque y "Para qué es" (hasta 35 caracteres).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, Moon, Save, Sun } from 'lucide-react';
import type { BloqueClave, Medicamento } from '../types';
import { ApiError } from '../services/http';

export const MAX_ETIQUETA = 35;

export interface DatosForm {
  nombre: string;
  dosis: string;
  bloque: BloqueClave;
  etiqueta: string | null;
}

interface Props {
  inicial?: Medicamento | null;
  onGuardar: (d: DatosForm) => Promise<void>;
  onCancelar?: () => void;
  onEditarExistente: (id: number) => void;
}

const largo = (s: string) => [...s].length;

export function MedicamentoForm({ inicial, onGuardar, onCancelar, onEditarExistente }: Props) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? '');
  const [dosis, setDosis] = useState(inicial?.dosis ?? '');
  const [bloque, setBloque] = useState<BloqueClave | ''>(inicial?.bloque ?? '');
  const [etiqueta, setEtiqueta] = useState(inicial?.etiqueta ?? '');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [existenteId, setExistenteId] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const refs = {
    nombre: useRef<HTMLInputElement>(null),
    dosis: useRef<HTMLInputElement>(null),
    bloque: useRef<HTMLInputElement>(null),
    etiqueta: useRef<HTMLInputElement>(null),
  };

  useEffect(() => {
    setNombre(inicial?.nombre ?? '');
    setDosis(inicial?.dosis ?? '');
    setBloque(inicial?.bloque ?? '');
    setEtiqueta(inicial?.etiqueta ?? '');
    setErrores({});
    setGeneral(null);
    setExistenteId(null);
    if (inicial) refs.nombre.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inicial?.id]);

  function enfocarPrimerError(e: Record<string, string>) {
    for (const campo of ['nombre', 'dosis', 'bloque', 'etiqueta'] as const) {
      if (e[campo]) {
        refs[campo].current?.focus();
        return;
      }
    }
  }

  async function enviar(ev: FormEvent) {
    ev.preventDefault();
    if (guardando) return;
    // Validación inmediata con los mismos mensajes; el servidor vuelve a validar todo.
    const e: Record<string, string> = {};
    if (!nombre.trim()) e.nombre = 'Escriba el nombre del medicamento.';
    if (!dosis.trim()) e.dosis = 'Escriba la dosis. Por ejemplo: 1 pastilla.';
    if (!bloque) e.bloque = 'Elija el bloque: mañana o noche.';
    if (largo(etiqueta.trim()) > MAX_ETIQUETA) e.etiqueta = 'La etiqueta puede tener hasta 25 letras. Por ejemplo: tensión baja.';
    setErrores(e);
    setGeneral(null);
    setExistenteId(null);
    if (Object.keys(e).length) {
      enfocarPrimerError(e);
      return;
    }
    setGuardando(true);
    try {
      await onGuardar({ nombre, dosis, bloque: bloque as BloqueClave, etiqueta: etiqueta.trim() || null });
      if (!inicial) {
        setNombre('');
        setDosis('');
        setEtiqueta('');
        refs.nombre.current?.focus();
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrores(err.campos);
        if (err.code === 'MEDICAMENTO_REPETIDO' && typeof err.extra.existenteId === 'number' && err.extra.existenteId > 0)
          setExistenteId(err.extra.existenteId);
        if (!Object.keys(err.campos).length) setGeneral(err.status >= 500 || err.status === 0 ? 'No se pudo guardar el cambio. Intente de nuevo.' : err.message);
        enfocarPrimerError(err.campos);
      } else setGeneral('No se pudo guardar el cambio. Intente de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  const n = largo(etiqueta);

  return (
    <form onSubmit={enviar} noValidate>
      {general && (
        <p className="notice notice-error" role="alert" style={{ marginBottom: 'var(--s4)' }}>
          <AlertCircle size={22} aria-hidden="true" /> <span>{general}</span>
        </p>
      )}
      <div className="field">
        <label htmlFor="med-nombre">Nombre del medicamento</label>
        <input
          ref={refs.nombre}
          id="med-nombre"
          className="input"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-invalid={!!errores.nombre}
          aria-describedby={errores.nombre ? 'med-nombre-error' : undefined}
          autoComplete="off"
          maxLength={60}
        />
        {errores.nombre && (
          <p className="field-error" id="med-nombre-error">
            <AlertCircle size={20} aria-hidden="true" /> {errores.nombre}
          </p>
        )}
        {existenteId && (
          <div>
            <button type="button" className="btn btn-secondary btn-sm" onClick={() => onEditarExistente(existenteId)}>
              Editar el existente
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label htmlFor="med-dosis">Dosis</label>
        <span className="hint" id="med-dosis-hint">
          Por ejemplo: 1 pastilla, media pastilla, 2 gotas.
        </span>
        <input
          ref={refs.dosis}
          id="med-dosis"
          className="input"
          value={dosis}
          onChange={(e) => setDosis(e.target.value)}
          aria-invalid={!!errores.dosis}
          aria-describedby={`med-dosis-hint${errores.dosis ? ' med-dosis-error' : ''}`}
          autoComplete="off"
          maxLength={40}
        />
        {errores.dosis && (
          <p className="field-error" id="med-dosis-error">
            <AlertCircle size={20} aria-hidden="true" /> {errores.dosis}
          </p>
        )}
      </div>

      <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 var(--s4)' }} aria-describedby={errores.bloque ? 'med-bloque-error' : undefined}>
        <legend className="label" style={{ marginBottom: 'var(--s2)', fontWeight: 700 }}>
          Bloque
        </legend>
        <div className="choice-group">
          <label className="choice">
            <input
              ref={refs.bloque}
              type="radio"
              name="bloque"
              value="manana"
              checked={bloque === 'manana'}
              onChange={() => setBloque('manana')}
            />
            <Sun size={24} aria-hidden="true" />
            <span className="choice-text">
              <strong>Mañana</strong>
            </span>
          </label>
          <label className="choice">
            <input type="radio" name="bloque" value="noche" checked={bloque === 'noche'} onChange={() => setBloque('noche')} />
            <Moon size={24} aria-hidden="true" />
            <span className="choice-text">
              <strong>Noche</strong>
            </span>
          </label>
        </div>
        {errores.bloque && (
          <p className="field-error" id="med-bloque-error">
            <AlertCircle size={20} aria-hidden="true" /> {errores.bloque}
          </p>
        )}
      </fieldset>

      <div className="field">
        <div className="field-row">
          <label htmlFor="med-etiqueta">
            Para qué es <span className="muted">(opcional)</span>
          </label>
          <span className={`counter ${n > MAX_ETIQUETA ? 'over' : ''}`} aria-live="polite" id="med-etiqueta-contador">
            {n} de {MAX_ETIQUETA}
          </span>
        </div>
        <span className="hint" id="med-etiqueta-hint">
          Una palabra corta para reconocerla. Por ejemplo: tensión baja.
        </span>
        <input
          ref={refs.etiqueta}
          id="med-etiqueta"
          className="input"
          value={etiqueta}
          onChange={(e) => setEtiqueta(e.target.value)}
          aria-invalid={!!errores.etiqueta}
          aria-describedby={`med-etiqueta-hint med-etiqueta-contador${errores.etiqueta ? ' med-etiqueta-error' : ''}`}
          autoComplete="off"
        />
        {errores.etiqueta && (
          <p className="field-error" id="med-etiqueta-error">
            <AlertCircle size={20} aria-hidden="true" /> {errores.etiqueta}
          </p>
        )}
      </div>

      <div className="row">
        <button type="submit" className="btn btn-primary btn-lg" disabled={guardando}>
          <Save size={22} aria-hidden="true" /> {guardando ? 'Guardando…' : inicial ? 'Guardar cambios' : 'Guardar medicamento'}
        </button>
        {onCancelar && (
          <button type="button" className="btn btn-ghost" onClick={onCancelar}>
            Cancelar
          </button>
        )}
      </div>
    </form>
  );
}
