import type { ReactNode } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toasts';
import { Cargando } from './components/Estados';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage, RegisterPage } from './pages/AuthPages';
import { HoyPage } from './pages/HoyPage';
import { MedicamentosPage, MedicamentosSupervisionPage } from './pages/MedicamentosPage';
import { HorariosPage } from './pages/HorariosPage';
import { HistorialPage, HistorialSupervisionPage } from './pages/HistorialPage';
import { FamiliaPage } from './pages/FamiliaPage';
import { SupervisionListaPage, SupervisionPanelPage } from './pages/SupervisionPage';
import { VincularPage } from './pages/VincularPage';
import type { Rol } from './types';

/** Protección de rutas en la interfaz. La autorización real la hace el backend en cada solicitud. */
function Protegida({ rol, children }: { rol: Rol; children: ReactNode }) {
  const { user, listo } = useAuth();
  const location = useLocation();
  if (!listo) return <Cargando />;
  if (!user) return <Navigate to="/ingresar" replace state={{ desde: location.pathname }} />;
  if (user.rol !== rol) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function Inicio() {
  const { user, listo } = useAuth();
  if (!listo) return <Cargando />;
  if (!user) return <Navigate to="/ingresar" replace />;
  return <Navigate to={user.rol === 'mayor' ? '/hoy' : '/supervision'} replace />;
}

function NoEncontrada() {
  return (
    <div className="state">
      <h1>No se encontró esta página</h1>
      <a className="btn btn-primary" href="/">
        Ir al inicio
      </a>
    </div>
  );
}

export function AppRoutes() {
  const { listo } = useAuth();
  if (!listo) return <Cargando />;
  return (
    <Routes>
      <Route path="/" element={<Inicio />} />
      <Route path="/ingresar" element={<LoginPage />} />
      <Route path="/registro" element={<RegisterPage />} />

      <Route
        element={
          <Protegida rol="mayor">
            <AppLayout />
          </Protegida>
        }
      >
        <Route path="/hoy" element={<HoyPage />} />
        <Route path="/medicamentos" element={<MedicamentosPage />} />
        <Route path="/horarios" element={<HorariosPage />} />
        <Route path="/historial" element={<HistorialPage />} />
        <Route path="/familia" element={<FamiliaPage />} />
      </Route>

      <Route
        element={
          <Protegida rol="familiar">
            <AppLayout />
          </Protegida>
        }
      >
        <Route path="/supervision" element={<SupervisionListaPage />} />
        <Route path="/supervision/:perfilId" element={<SupervisionPanelPage />} />
        <Route path="/supervision/:perfilId/historial" element={<HistorialSupervisionPage />} />
        <Route path="/supervision/:perfilId/medicamentos" element={<MedicamentosSupervisionPage />} />
        <Route path="/vincular" element={<VincularPage />} />
      </Route>

      <Route path="*" element={<NoEncontrada />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
