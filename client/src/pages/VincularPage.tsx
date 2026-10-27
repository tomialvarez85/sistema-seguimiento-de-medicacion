// Familiar: vincularse con el perfil de una persona mayor usando su código (validar → confirmar).
import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Link2, ShieldCheck, UserCheck } from 'lucide-react';
import { vinculacionApi } from '../services/api';
import { ApiError } from '../services/http';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toasts';

export function VincularPage() {
  const { refrescar } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [codigo, setCodigo] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [encontrado, setEncontrado] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const confirmarRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (encontrado) confirmarRef.current?.focus();
  }, [encontrado]);

  async function validar(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!codigo.trim()) {
      setError('Escriba el código que le dio la persona mayor.');
      input.current?.focus();
      return;
    }
    setEnviando(true);
    try {
      const r = await vinculacionApi.validar(codigo);
      setEncontrado(r.perfilNombre);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No se pudo comprobar el código.');
      input.current?.focus();
    } finally {
      setEnviando(false);
    }
  }

  async function confirmar() {
    setEnviando(true);
    try {
      const r = await vinculacionApi.confirmar(codigo);
      await refrescar();
      toast(`Listo. Ya puede ver la rutina de ${r.perfilNombre}.`);
      navigate(`/supervision/${r.perfilId}`);
    } catch (err) {
      setEncontrado(null);
      setError(err instanceof ApiError ? err.message : 'No se pudo completar la vinculación.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Supervisión</p>
          <h1>Vincular con una persona mayor</h1>
          <p className="subtitle">Escriba el código que aparece en la sección “Familia” de la cuenta de la persona mayor.</p>
        </div>
      </header>

      <div className="card" style={{ maxWidth: '38rem' }}>
        {!encontrado ? (
          <form onSubmit={validar} noValidate>
            <div className="field">
              <label htmlFor="codigo">Código de vinculación</label>
              <span className="hint" id="codigo-hint">
                Son 8 letras y números. Por ejemplo: K7MP-Q2XA
              </span>
              <input
                ref={input}
                id="codigo"
                className="input"
                style={{ fontSize: '1.5rem', letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 700 }}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
                aria-invalid={!!error}
                aria-describedby={`codigo-hint${error ? ' codigo-error' : ''}`}
                autoComplete="off"
                maxLength={12}
              />
              {error && (
                <p className="field-error" id="codigo-error" role="alert">
                  <AlertCircle size={20} aria-hidden="true" /> {error}
                </p>
              )}
            </div>
            <button type="submit" className="btn btn-primary btn-lg" disabled={enviando}>
              <Link2 size={22} aria-hidden="true" /> Buscar
            </button>
          </form>
        ) : (
          <div className="stack">
            <div className="notice notice-ok">
              <UserCheck size={24} aria-hidden="true" />
              <span>
                El código corresponde a <strong>{encontrado}</strong>.
              </span>
            </div>
            <p style={{ fontSize: '1.1rem' }}>
              Si confirma, va a poder ver los medicamentos, los horarios, la rutina de cada día y el historial de {encontrado}. No va a
              poder modificarlos.
            </p>
            <div className="row">
              <button ref={confirmarRef} type="button" className="btn btn-primary btn-lg" onClick={() => void confirmar()} disabled={enviando}>
                <ShieldCheck size={22} aria-hidden="true" /> Confirmar vinculación
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setEncontrado(null)}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
