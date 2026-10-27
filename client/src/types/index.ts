// Tipos de las respuestas de la API (espejo de server/src/services).
export type Rol = 'mayor' | 'familiar';
export type Acceso = 'titular' | 'familiar';
export type BloqueClave = 'manana' | 'noche';
export type EstadoItem = 'pendiente' | 'tomado' | 'no_tomado';
export type Fase = 'proximo' | 'en_curso' | 'terminado';
export type TipoEstadoBloque = 'sin_medicamentos' | 'pendiente' | 'sin_registrar' | 'incompleto' | 'completo' | 'no_tomado';

export interface Usuario {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface PerfilAccesible {
  id: number;
  nombre: string;
  acceso: Acceso;
}

export interface Sesion {
  user: Usuario;
  perfiles: PerfilAccesible[];
}

export interface Item {
  planItemId: number;
  medicamentoId: number;
  nombre: string;
  dosis: string;
  etiqueta: string | null;
  estado: EstadoItem;
  tarde: boolean;
  hora: string | null;
  registradoPor: string | null;
}

export interface EstadoBloque {
  tipo: TipoEstadoBloque;
  total: number;
  tomadas: number;
  noTomadas: number;
  sinRegistrar: number;
  conTarde: boolean;
  ultimaHoraTarde: string | null;
  texto: string;
}

export interface Bloque {
  clave: BloqueClave;
  nombre: string;
  inicio: string;
  fin: string;
  avisos: [string, string, string];
  fase: Fase;
  estado: EstadoBloque;
  ultimaHora: string | null;
  items: Item[];
}

export interface Resumen {
  total: number;
  tomadas: number;
  noTomadas: number;
  pendientes: number;
}

export interface Dia {
  fecha: string;
  esHoy: boolean;
  ahora?: string;
  bloques: Bloque[];
  resumen: Resumen;
}

export interface Evento {
  id: number;
  tipo: string;
  descripcion: string;
  hora: string;
  usuario: string | null;
}

export interface DiaDetalle extends Dia {
  eventos: Evento[];
}

export interface Semana {
  desde: string;
  hasta: string;
  dias: Dia[];
  anterior: string | null;
  siguiente: string | null;
}

export interface Medicamento {
  id: number;
  nombre: string;
  dosis: string;
  etiqueta: string | null;
  bloque: BloqueClave;
  orden: number;
}

export interface Horario {
  clave: BloqueClave;
  nombre: string;
  inicio: string;
  fin: string;
  avisos: [string, string, string];
}

export interface Aviso {
  fecha: string;
  clave: BloqueClave;
  nombreBloque: string;
  numero: 1 | 2 | 3;
  hora: string;
  inicio: string;
  fin: string;
  pendientes: Item[];
  total: number;
}

export interface CodigoVinculacion {
  codigo: string;
  expiraEn: string;
}

export interface Familiar {
  id: number;
  nombre: string;
  email: string;
  vinculadoEn: string;
}

export interface PerfilResumen {
  id: number;
  nombre: string;
  acceso: Acceso;
  planDesde: string;
}
