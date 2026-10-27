import { http } from './http';
import type {
  Aviso,
  BloqueClave,
  CodigoVinculacion,
  Dia,
  DiaDetalle,
  EstadoItem,
  Familiar,
  Horario,
  Medicamento,
  PerfilResumen,
  Rol,
  Semana,
  Sesion,
} from '../types';

export const authApi = {
  me: () => http<Sesion>('GET', '/auth/me'),
  login: (email: string, password: string) => http<Sesion>('POST', '/auth/login', { email, password }),
  register: (d: { nombre: string; email: string; password: string; rol: Rol }) => http<Sesion>('POST', '/auth/register', d),
  logout: () => http<void>('POST', '/auth/logout'),
};

const p = (perfilId: number) => `/perfiles/${perfilId}`;

export interface ResultadoToma {
  hora: string;
  tarde: boolean;
  estado: Exclude<EstadoItem, 'pendiente'>;
  nombre: string;
  dia: Dia;
}

export const perfilApi = {
  resumen: (id: number) => http<PerfilResumen>('GET', p(id)),
  hoy: (id: number) => http<Dia>('GET', `${p(id)}/hoy`),
  registrarToma: (id: number, planItemId: number, estado: 'tomado' | 'no_tomado') =>
    http<ResultadoToma>('POST', `${p(id)}/tomas`, { planItemId, estado }),
  desmarcar: (id: number, planItemId: number) => http<{ nombre: string; dia: Dia }>('DELETE', `${p(id)}/tomas/${planItemId}`),
  marcarBloque: (id: number, clave: BloqueClave) =>
    http<{ hora: string; tarde: boolean; cantidad: number; clave: BloqueClave; dia: Dia }>('POST', `${p(id)}/bloques/${clave}/marcar-todo`),
  confirmarBloque: (id: number, clave: BloqueClave) =>
    http<{ hora: string; noTomadas: string[]; clave: BloqueClave; dia: Dia }>('POST', `${p(id)}/bloques/${clave}/confirmar`),

  medicamentos: (id: number) => http<Medicamento[]>('GET', `${p(id)}/medicamentos`),
  crearMedicamento: (id: number, d: Omit<Medicamento, 'id' | 'orden'>) => http<Medicamento>('POST', `${p(id)}/medicamentos`, d),
  editarMedicamento: (id: number, medId: number, d: Omit<Medicamento, 'id' | 'orden'>) =>
    http<Medicamento>('PUT', `${p(id)}/medicamentos/${medId}`, d),
  eliminarMedicamento: (id: number, medId: number) => http<void>('DELETE', `${p(id)}/medicamentos/${medId}`),

  horarios: (id: number) => http<Horario[]>('GET', `${p(id)}/horarios`),
  guardarHorarios: (id: number, h: Record<BloqueClave, { inicio: string; fin: string }>) =>
    http<Horario[]>('PUT', `${p(id)}/horarios`, h),

  historial: (id: number, hasta?: string) => http<Semana>('GET', `${p(id)}/historial${hasta ? `?hasta=${hasta}` : ''}`),
  historialDia: (id: number, fecha: string) => http<DiaDetalle>('GET', `${p(id)}/historial/${fecha}`),

  avisoActual: (id: number) => http<{ aviso: Aviso | null }>('GET', `${p(id)}/avisos/actual`),
  avisoVisto: (id: number, clave: BloqueClave, numero: number) => http<void>('POST', `${p(id)}/avisos/visto`, { clave, numero }),
};

export const vinculacionApi = {
  codigo: () => http<{ codigo: CodigoVinculacion | null }>('GET', '/vinculacion/codigo'),
  nuevoCodigo: () => http<{ codigo: CodigoVinculacion }>('POST', '/vinculacion/codigo'),
  familiares: () => http<Familiar[]>('GET', '/vinculacion/familiares'),
  quitarFamiliar: (familiarId: number) => http<void>('DELETE', `/vinculacion/familiares/${familiarId}`),
  validar: (codigo: string) => http<{ perfilNombre: string }>('POST', '/vinculacion/validar', { codigo }),
  confirmar: (codigo: string) => http<{ perfilId: number; perfilNombre: string }>('POST', '/vinculacion/confirmar', { codigo }),
  desvincularme: (perfilId: number) => http<void>('DELETE', `/vinculacion/perfiles/${perfilId}`),
};
