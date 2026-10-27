import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, NavLink, Outlet, useMatch, useNavigate } from 'react-router-dom';
import {
  CalendarDays,
  ClipboardList,
  Clock,
  History,
  LayoutDashboard,
  Link2,
  LogOut,
  Pill,
  Users,
} from 'lucide-react';
import styles from './AppLayout.module.css';
import { useAuth } from '../context/AuthContext';
import { Dialog } from '../components/Dialog';
import { AvisoWatcher } from '../components/AvisoWatcher';

function Item({ to, icon, children, end }: { to: string; icon: ReactNode; children: ReactNode; end?: boolean }) {
  return (
    <NavLink to={to} end={end}>
      {icon}
      {children}
    </NavLink>
  );
}

export function AppLayout() {
  const { user, perfiles, logout } = useAuth();
  const navigate = useNavigate();
  const [confirmarSalida, setConfirmarSalida] = useState(false);
  const quedarse = useRef<HTMLButtonElement>(null);
  const enPerfil = useMatch('/supervision/:perfilId/*');
  const perfilSupervisado = enPerfil ? Number(enPerfil.params.perfilId) : perfiles.length === 1 ? perfiles[0].id : null;

  if (!user) return null;
  const esMayor = user.rol === 'mayor';
  // Con varias personas y una seleccionada, el menú no entra en una sola fila junto al usuario.
  const navLarga = !esMayor && perfiles.length > 1 && perfilSupervisado !== null;

  async function salir() {
    setConfirmarSalida(false);
    await logout();
    navigate('/ingresar', { replace: true });
  }

  return (
    <div className={styles.shell}>
      <a href="#contenido" className="skip-link">
        Ir al contenido
      </a>
      <header className={styles.header}>
        <div className={navLarga ? `${styles.headerInner} ${styles.navAparte}` : styles.headerInner}>
          <Link to="/" className={styles.brand} aria-label="Pastillero digital, inicio">
            <span className={styles.logo} aria-hidden="true">
              <Pill size={26} />
            </span>
            <span className={styles.brandText}>
              <strong>Pastillero digital</strong>
              <span>{esMayor ? 'Su rutina de medicación' : 'Supervisión familiar'}</span>
            </span>
          </Link>

          <nav className={styles.nav} aria-label="Secciones">
            {esMayor ? (
              <>
                <Item to="/hoy" icon={<CalendarDays size={22} aria-hidden="true" />}>Hoy</Item>
                <Item to="/medicamentos" icon={<Pill size={22} aria-hidden="true" />}>Medicamentos</Item>
                <Item to="/horarios" icon={<Clock size={22} aria-hidden="true" />}>Cambiar horarios</Item>
                <Item to="/historial" icon={<History size={22} aria-hidden="true" />}>Historial</Item>
                <Item to="/familia" icon={<Users size={22} aria-hidden="true" />}>Familia</Item>
              </>
            ) : (
              <>
                {perfiles.length > 1 && (
                  <Item to="/supervision" end icon={<Users size={22} aria-hidden="true" />}>Mis personas</Item>
                )}
                {perfilSupervisado && (
                  <>
                    <Item to={`/supervision/${perfilSupervisado}`} end icon={<LayoutDashboard size={22} aria-hidden="true" />}>
                      Panel de hoy
                    </Item>
                    <Item to={`/supervision/${perfilSupervisado}/historial`} icon={<History size={22} aria-hidden="true" />}>
                      Historial
                    </Item>
                    <Item to={`/supervision/${perfilSupervisado}/medicamentos`} icon={<ClipboardList size={22} aria-hidden="true" />}>
                      Medicamentos y horarios
                    </Item>
                  </>
                )}
                <Item to="/vincular" icon={<Link2 size={22} aria-hidden="true" />}>Vincular</Item>
              </>
            )}
          </nav>

          <div className={styles.user}>
            <div className={styles.userText}>
              <strong>{user.nombre}</strong>
              <span>{esMayor ? 'Persona mayor' : 'Familiar o cuidador'}</span>
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => (esMayor ? setConfirmarSalida(true) : void salir())}
            >
              <LogOut size={20} aria-hidden="true" /> Salir
            </button>
          </div>
        </div>
      </header>

      <main id="contenido" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
      <footer className={styles.footer}>
        Pastillero digital · Solo registra y recuerda lo que indicó el médico. No calcula dosis ni sugiere medicamentos.
      </footer>

      {esMayor && perfiles[0] && <AvisoWatcher perfilId={perfiles[0].id} />}

      <Dialog
        open={confirmarSalida}
        title="¿Salir del pastillero?"
        tone="warn"
        icon={<LogOut size={30} />}
        onClose={() => setConfirmarSalida(false)}
        initialFocusRef={quedarse}
        role="alertdialog"
        actions={
          <>
            <button type="button" className="btn btn-secondary" onClick={() => void salir()}>
              Salir igual
            </button>
            <button ref={quedarse} type="button" className="btn btn-primary" onClick={() => setConfirmarSalida(false)}>
              Quedarme
            </button>
          </>
        }
      >
        <p className="dialog-text">Si sale, no va a recibir los avisos. ¿Salir igual?</p>
      </Dialog>
    </div>
  );
}
