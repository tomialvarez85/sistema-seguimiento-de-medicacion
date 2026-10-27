export type Rol = 'mayor' | 'familiar';
export type BloqueClave = 'manana' | 'noche';
export type EstadoToma = 'tomado' | 'no_tomado';
export type EstadoItem = 'pendiente' | EstadoToma;
export type OrigenToma = 'individual' | 'bloque' | 'confirmar_bloque';
/** Cómo se relaciona quien inició sesión con el perfil consultado. */
export type Acceso = 'titular' | 'familiar';

export const BLOQUES: readonly BloqueClave[] = ['manana', 'noche'];
export const NOMBRE_BLOQUE: Record<BloqueClave, string> = { manana: 'Mañana', noche: 'Noche' };
export const NOMBRE_BLOQUE_FRASE: Record<BloqueClave, string> = {
  manana: 'el bloque de la mañana',
  noche: 'el bloque de la noche',
};

export interface UserRow {
  id: number;
  nombre: string;
  email: string;
  password_hash: string;
  rol: Rol;
  creado_en: string;
}

export interface PublicUser {
  id: number;
  nombre: string;
  email: string;
  rol: Rol;
}

export interface PerfilRow {
  id: number;
  titular_user_id: number;
  nombre: string;
  plan_desde: string;
  creado_en: string;
}

export interface BloqueRow {
  id: number;
  perfil_id: number;
  clave: BloqueClave;
  inicio: string;
  fin: string;
  actualizado_en: string;
}

export interface MedicamentoRow {
  id: number;
  perfil_id: number;
  bloque_clave: BloqueClave;
  nombre: string;
  nombre_normalizado: string;
  dosis: string;
  etiqueta: string | null;
  orden: number;
  activo: number;
  creado_en: string;
  actualizado_en: string;
  desactivado_en: string | null;
}

export interface PlanItemRow {
  id: number;
  perfil_id: number;
  fecha: string;
  medicamento_id: number;
  bloque_clave: BloqueClave;
  bloque_inicio: string;
  bloque_fin: string;
  nombre: string;
  dosis: string;
  etiqueta: string | null;
  orden: number;
  retirado: number;
}

export interface TomaRow {
  id: number;
  plan_item_id: number;
  perfil_id: number;
  estado: EstadoToma;
  tarde: number;
  hora: string;
  registrado_en: string;
  registrado_por: number;
  origen: OrigenToma;
  anulado_en: string | null;
  anulado_por: number | null;
}

/** Plan del día con su toma vigente (si la hay). */
export interface PlanItemConToma extends PlanItemRow {
  toma_id: number | null;
  toma_estado: EstadoToma | null;
  toma_tarde: number | null;
  toma_hora: string | null;
  toma_registrado_por_nombre: string | null;
}

export interface EventoRow {
  id: number;
  perfil_id: number;
  user_id: number | null;
  fecha: string;
  tipo: string;
  descripcion: string;
  creado_en: string;
}
