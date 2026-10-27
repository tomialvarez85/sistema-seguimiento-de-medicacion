import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../services/api';
import { alVencerSesion } from '../services/http';
import type { PerfilAccesible, Rol, Sesion, Usuario } from '../types';

interface AuthValue {
  user: Usuario | null;
  perfiles: PerfilAccesible[];
  listo: boolean;
  /** Mensaje para la pantalla de ingreso (por ejemplo, sesión vencida). */
  aviso: string | null;
  login: (email: string, password: string) => Promise<Sesion>;
  register: (d: { nombre: string; email: string; password: string; rol: Rol }) => Promise<Sesion>;
  logout: () => Promise<void>;
  refrescar: () => Promise<void>;
}

const Ctx = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [sesion, setSesion] = useState<Sesion | null>(null);
  const [listo, setListo] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);

  const refrescar = useCallback(async () => {
    try {
      setSesion(await authApi.me());
    } catch {
      setSesion(null);
    }
  }, []);

  useEffect(() => {
    void refrescar().finally(() => setListo(true));
    alVencerSesion((msg) => {
      setSesion(null);
      setAviso(msg);
    });
    return () => alVencerSesion(null);
  }, [refrescar]);

  const value = useMemo<AuthValue>(
    () => ({
      user: sesion?.user ?? null,
      perfiles: sesion?.perfiles ?? [],
      listo,
      aviso,
      login: async (email, password) => {
        const s = await authApi.login(email, password);
        setAviso(null);
        setSesion(s);
        return s;
      },
      register: async (d) => {
        const s = await authApi.register(d);
        setAviso(null);
        setSesion(s);
        return s;
      },
      logout: async () => {
        try {
          await authApi.logout();
        } finally {
          setSesion(null);
        }
      },
      refrescar,
    }),
    [sesion, listo, aviso, refrescar],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth fuera de AuthProvider');
  return v;
}

/** Perfil propio de la persona mayor. */
export function usePerfilPropio(): PerfilAccesible | null {
  const { perfiles, user } = useAuth();
  return user?.rol === 'mayor' ? (perfiles[0] ?? null) : null;
}
