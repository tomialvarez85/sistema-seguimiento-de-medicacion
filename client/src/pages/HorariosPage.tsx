// Pantalla 5 · Cambiar horarios (HU-07): solo los dos bloques, con letra grande y el cálculo de los avisos.
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { AlertCircle, Bell, Moon, Save, Sun } from 'lucide-react';
import { usePerfilPropio } from '../context/AuthContext';
import { perfilApi } from '../services/api';
import { ApiError } from '../services/http';
import { useCarga } from '../lib/useCarga';
import { hora, listaHoras } from '../lib/formato';
import { Cargando, ErrorCarga } from '../components/Estados';
import { useToast } from '../components/Toasts';
import type { BloqueClave } from '../types';

type Valores = Record<BloqueClave, { inicio: string; fin: string }>;

// Vista previa mientras se escribe; los avisos definitivos los calcula y devuelve el servidor.
function vistaPrevia(inicio: string, fin: string): string | null {
  const m = (s: string) => {
    const r = /^(\d{1,2}):(\d{2})$/.exec(s.trim());
    if (!r || Number(r[1]) > 23 || Number(r[2]) > 59) return null;
    return Number(r[1]) * 60 + Number(r[2]);
  };
  const a = m(inicio);
  const b = m(fin);
  if (a === null || b === null || b <= a) return null;
  const mid = Math.round((a + b) / 2);
  const f = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  return `${f(a)}, ${f(mid)} y ${f(b)}`;
}

export function HorariosPage() {
  const perfil = usePerfilPropio()!;
  const toast = useToast();
  const { data, error, cargando, recargar, setData } = useCarga(() => perfilApi.horarios(perfil.id), [perfil.id]);
  const [valores, setValores] = useState<Valores | null>(null);
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (data) {
      const v = {} as Valores;
      for (const h of data) v[h.clave] = { inicio: h.inicio, fin: h.fin };
      setValores(v);
    }
  }, [data]);

  if (cargando || !valores) return error ? <ErrorCarga mensaje={error} onReintentar={() => void recargar()} /> : <Cargando />;
  if (error || !data) return <ErrorCarga mensaje={error ?? ''} onReintentar={() => void recargar()} />;

  function set(clave: BloqueClave, campo: 'inicio' | 'fin', valor: string) {
    setValores((v) => ({ ...v!, [clave]: { ...v![clave], [campo]: valor } }));
  }

  async function guardar(e: FormEvent) {
    e.preventDefault();
    setGuardando(true);
    setErrores({});
    setGeneral(null);
    try {
      const r = await perfilApi.guardarHorarios(perfil.id, valores!);
      setData(r);
      toast(`Horarios guardados. Avisos de la mañana: ${listaHoras(r[0].avisos)}. Avisos de la noche: ${listaHoras(r[1].avisos)}.`);
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) {
        setErrores(err.campos);
        const primero = Object.keys(err.campos)[0].replace('.', '-');
        document.getElementById(`hora-${primero}`)?.focus();
      } else setGeneral(err instanceof ApiError && err.code === 'SIN_CONEXION' ? err.message : 'No se pudo guardar el cambio. Intente de nuevo.');
    } finally {
      setGuardando(false);
    }
  }

  return (
    <>
      <header className="page-header">
        <div>
          <p className="eyebrow">Configuración</p>
          <h1>Cambiar horarios</h1>
          <p className="subtitle">Elija a qué hora empieza y termina cada bloque. Los avisos suenan al inicio, a la mitad y al final.</p>
        </div>
      </header>

      <form onSubmit={guardar} noValidate>
        {general && (
          <p className="notice notice-error" role="alert" style={{ marginBottom: 'var(--s4)' }}>
            <AlertCircle size={22} aria-hidden="true" /> <span>{general}</span>
          </p>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(24rem, 100%), 1fr))', gap: 'var(--s5)' }}>
          {data.map((h) => {
            const v = valores[h.clave];
            const Icono = h.clave === 'manana' ? Sun : Moon;
            const previa = vistaPrevia(v.inicio, v.fin);
            const errBloque = errores[`${h.clave}.inicio`] ?? errores[`${h.clave}.fin`];
            return (
              <fieldset key={h.clave} className="card" style={{ margin: 0 }}>
                <legend className="visually-hidden">Bloque de la {h.nombre.toLowerCase()}</legend>
                <h2 className="card-title" aria-hidden="true" style={{ marginBottom: 'var(--s4)' }}>
                  <Icono size={28} /> {h.nombre}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--s4)' }}>
                  {(['inicio', 'fin'] as const).map((campo) => {
                    const id = `hora-${h.clave}-${campo}`;
                    const err = errores[`${h.clave}.${campo}`];
                    return (
                      <div className="field" key={campo} style={{ margin: 0 }}>
                        <label htmlFor={id}>{campo === 'inicio' ? 'Empieza a las' : 'Termina a las'}</label>
                        <input
                          id={id}
                          className="input"
                          style={{ fontSize: '1.6rem', fontWeight: 700, minHeight: '4rem', textAlign: 'center' }}
                          inputMode="numeric"
                          placeholder="08:00"
                          value={v[campo]}
                          onChange={(e) => set(h.clave, campo, e.target.value)}
                          aria-invalid={!!err}
                          aria-describedby={err ? `${h.clave}-error` : `${h.clave}-avisos`}
                          autoComplete="off"
                        />
                      </div>
                    );
                  })}
                </div>
                {errBloque && (
                  <p className="field-error" id={`${h.clave}-error`} style={{ marginTop: 'var(--s3)' }}>
                    <AlertCircle size={20} aria-hidden="true" /> {errBloque}
                  </p>
                )}
                <p className="muted row" id={`${h.clave}-avisos`} style={{ marginTop: 'var(--s4)', gap: '0.4rem' }}>
                  <Bell size={20} aria-hidden="true" />
                  {previa ? <>Avisos: {previa}</> : <>Avisos guardados: {listaHoras(h.avisos)}</>}
                </p>
                <p className="muted" style={{ fontSize: '0.9rem' }}>
                  Guardado ahora: {hora(h.inicio)} a {hora(h.fin)}
                </p>
              </fieldset>
            );
          })}
        </div>
        <div className="row" style={{ marginTop: 'var(--s5)' }}>
          <button type="submit" className="btn btn-primary btn-lg" disabled={guardando}>
            <Save size={22} aria-hidden="true" /> {guardando ? 'Guardando…' : 'Guardar horarios'}
          </button>
          <span className="muted">Escriba la hora así: 08:00. Cambiar un horario no modifica lo que ya se registró.</span>
        </div>
      </form>
    </>
  );
}
