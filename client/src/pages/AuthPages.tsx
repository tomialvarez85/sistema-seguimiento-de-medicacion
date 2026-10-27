import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { AlertCircle, BellRing, CalendarCheck, Eye, EyeOff, HeartHandshake, LogIn, Pill, UserPlus, Users } from 'lucide-react';
import styles from './AuthPages.module.css';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/http';
import type { Rol, Sesion } from '../types';

function rutaInicio(s: Sesion): string {
  return s.user.rol === 'mayor' ? '/hoy' : '/supervision';
}

function Marco({ children }: { children: ReactNode }) {
  return (
    <div className={styles.wrap}>
      <aside className={styles.lado}>
        <div className={styles.marca}>
          <span className={styles.marcaIcono} aria-hidden="true">
            <Pill size={28} />
          </span>
          Pastillero digital
        </div>
        <div style={{ position: 'relative', zIndex: 1 }}>
          <p className={styles.lema}>Cada pastilla en su horario, con tranquilidad.</p>
          <ul className={styles.puntos}>
            <li>
              <CalendarCheck aria-hidden="true" /> Qué tomar en cada bloque del día
            </li>
            <li>
              <BellRing aria-hidden="true" /> Avisos al inicio, a la mitad y al final
            </li>
            <li>
              <HeartHandshake aria-hidden="true" /> Su familia acompaña desde su propia cuenta
            </li>
          </ul>
        </div>
      </aside>
      <main className={styles.form}>
        <div className={styles.formInner}>{children}</div>
      </main>
    </div>
  );
}

function CampoError({ id, texto }: { id: string; texto?: string }) {
  if (!texto) return null;
  return (
    <p className="field-error" id={id}>
      <AlertCircle size={20} aria-hidden="true" /> {texto}
    </p>
  );
}

function CampoClave({
  id,
  valor,
  onChange,
  error,
  autoComplete,
  hint,
  inputRef,
}: {
  id: string;
  valor: string;
  onChange: (v: string) => void;
  error?: string;
  autoComplete: string;
  hint?: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const [ver, setVer] = useState(false);
  return (
    <div className="field">
      <label htmlFor={id}>Contraseña</label>
      {hint && (
        <span className="hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      <div style={{ display: 'flex', gap: 'var(--s2)' }}>
        <input
          ref={inputRef}
          id={id}
          type={ver ? 'text' : 'password'}
          className="input"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          aria-invalid={!!error}
          aria-describedby={[hint ? `${id}-hint` : '', error ? `${id}-error` : ''].filter(Boolean).join(' ') || undefined}
        />
        <button type="button" className="btn btn-secondary" onClick={() => setVer((v) => !v)} aria-pressed={ver}>
          {ver ? <EyeOff size={22} aria-hidden="true" /> : <Eye size={22} aria-hidden="true" />}
          {ver ? 'Ocultar' : 'Ver'}
        </button>
      </div>
      <CampoError id={`${id}-error`} texto={error} />
    </div>
  );
}

export function LoginPage() {
  const { login, user, aviso, perfiles } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const emailRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);

  if (user) return <Navigate to={rutaInicio({ user, perfiles })} replace />;

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!email.trim()) errs.email = 'Escriba su correo.';
    if (!password) errs.password = 'Escriba su contraseña.';
    setErrores(errs);
    setGeneral(null);
    if (errs.email) return emailRef.current?.focus();
    if (errs.password) return passRef.current?.focus();
    setEnviando(true);
    try {
      const s = await login(email, password);
      navigate(rutaInicio(s), { replace: true });
    } catch (err) {
      setGeneral(err instanceof ApiError ? err.message : 'No se pudo ingresar. Intente de nuevo.');
      passRef.current?.focus();
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Marco>
      <h1>Ingresar</h1>
      <p>Use el correo y la contraseña de su cuenta.</p>
      {(general || aviso) && (
        <p className={`notice ${general ? 'notice-error' : 'notice-warn'}`} role="alert" style={{ marginBottom: 'var(--s4)' }}>
          <AlertCircle size={22} aria-hidden="true" /> <span>{general ?? aviso}</span>
        </p>
      )}
      <form onSubmit={enviar} noValidate>
        <div className="field">
          <label htmlFor="login-email">Correo</label>
          <input
            ref={emailRef}
            id="login-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            aria-invalid={!!errores.email}
            aria-describedby={errores.email ? 'login-email-error' : undefined}
          />
          <CampoError id="login-email-error" texto={errores.email} />
        </div>
        <CampoClave
          id="login-password"
          valor={password}
          onChange={setPassword}
          error={errores.password}
          autoComplete="current-password"
          inputRef={passRef}
        />
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={enviando}>
          <LogIn size={22} aria-hidden="true" /> {enviando ? 'Ingresando…' : 'Ingresar'}
        </button>
      </form>
      <p className={styles.alterno}>
        ¿Primera vez? <Link to="/registro">Crear una cuenta</Link>
      </p>
    </Marco>
  );
}

export function RegisterPage() {
  const { register, user, perfiles } = useAuth();
  const navigate = useNavigate();
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rol, setRol] = useState<Rol | ''>('');
  const [errores, setErrores] = useState<Record<string, string>>({});
  const [general, setGeneral] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const refs = {
    rol: useRef<HTMLInputElement>(null),
    nombre: useRef<HTMLInputElement>(null),
    email: useRef<HTMLInputElement>(null),
    password: useRef<HTMLInputElement>(null),
  };

  if (user) return <Navigate to={rutaInicio({ user, perfiles })} replace />;

  function enfocar(errs: Record<string, string>) {
    for (const c of ['rol', 'nombre', 'email', 'password'] as const) if (errs[c]) return refs[c].current?.focus();
  }

  async function enviar(e: FormEvent) {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!rol) errs.rol = 'Elija el tipo de cuenta.';
    if (nombre.trim().length < 2) errs.nombre = 'Escriba su nombre.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = 'Escriba un correo válido. Por ejemplo: ana@correo.com';
    if (password.length < 8) errs.password = 'La contraseña tiene que tener al menos 8 caracteres.';
    setErrores(errs);
    setGeneral(null);
    if (Object.keys(errs).length) return enfocar(errs);
    setEnviando(true);
    try {
      const s = await register({ nombre, email, password, rol: rol as Rol });
      navigate(s.user.rol === 'mayor' ? '/medicamentos' : '/vincular', { replace: true });
    } catch (err) {
      if (err instanceof ApiError && Object.keys(err.campos).length) {
        setErrores(err.campos);
        enfocar(err.campos);
      } else setGeneral(err instanceof ApiError ? err.message : 'No se pudo crear la cuenta.');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Marco>
      <h1>Crear una cuenta</h1>
      <p>Cada persona usa su propia cuenta.</p>
      {general && (
        <p className="notice notice-error" role="alert" style={{ marginBottom: 'var(--s4)' }}>
          <AlertCircle size={22} aria-hidden="true" /> <span>{general}</span>
        </p>
      )}
      <form onSubmit={enviar} noValidate>
        <fieldset className="field" style={{ border: 0, padding: 0, margin: '0 0 var(--s4)' }}>
          <legend style={{ fontWeight: 700, marginBottom: 'var(--s2)' }}>¿Quién va a usar esta cuenta?</legend>
          <div className="choice-group" style={{ gridTemplateColumns: '1fr' }}>
            <label className="choice">
              <input ref={refs.rol} type="radio" name="rol" checked={rol === 'mayor'} onChange={() => setRol('mayor')} />
              <Pill size={28} aria-hidden="true" />
              <span className="choice-text">
                <strong>Persona mayor</strong>
                <span>Organizo los medicamentos y registro las tomas.</span>
              </span>
            </label>
            <label className="choice">
              <input type="radio" name="rol" checked={rol === 'familiar'} onChange={() => setRol('familiar')} />
              <Users size={28} aria-hidden="true" />
              <span className="choice-text">
                <strong>Familiar o cuidador</strong>
                <span>Acompaño y reviso la rutina de un familiar, sin modificarla.</span>
              </span>
            </label>
          </div>
          <CampoError id="reg-rol-error" texto={errores.rol} />
        </fieldset>
        <div className="field">
          <label htmlFor="reg-nombre">Nombre</label>
          <input
            ref={refs.nombre}
            id="reg-nombre"
            className="input"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            autoComplete="name"
            aria-invalid={!!errores.nombre}
            aria-describedby={errores.nombre ? 'reg-nombre-error' : undefined}
          />
          <CampoError id="reg-nombre-error" texto={errores.nombre} />
        </div>
        <div className="field">
          <label htmlFor="reg-email">Correo</label>
          <input
            ref={refs.email}
            id="reg-email"
            type="email"
            className="input"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            aria-invalid={!!errores.email}
            aria-describedby={errores.email ? 'reg-email-error' : undefined}
          />
          <CampoError id="reg-email-error" texto={errores.email} />
        </div>
        <CampoClave
          id="reg-password"
          valor={password}
          onChange={setPassword}
          error={errores.password}
          autoComplete="new-password"
          hint="Al menos 8 caracteres."
          inputRef={refs.password}
        />
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={enviando}>
          <UserPlus size={22} aria-hidden="true" /> {enviando ? 'Creando…' : 'Crear cuenta'}
        </button>
      </form>
      <p className={styles.alterno}>
        ¿Ya tiene cuenta? <Link to="/ingresar">Ingresar</Link>
      </p>
    </Marco>
  );
}
