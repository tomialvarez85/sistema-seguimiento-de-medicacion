import * as perfiles from '../repositories/perfilesRepo.js';
import * as vinculos from '../repositories/vinculosRepo.js';
import type { Acceso, PerfilRow, PublicUser } from '../types/index.js';

/**
 * Relación entre quien inició sesión y un perfil de medicación.
 * Titular: la cuenta Persona mayor dueña del perfil. Familiar: solo si existe un vínculo autorizado.
 */
export function accesoAPerfil(user: PublicUser, perfilId: number): { perfil: PerfilRow; acceso: Acceso } | null {
  const perfil = perfiles.findById(perfilId);
  if (!perfil) return null;
  if (user.rol === 'mayor' && perfil.titular_user_id === user.id) return { perfil, acceso: 'titular' };
  if (user.rol === 'familiar' && vinculos.exists(perfilId, user.id)) return { perfil, acceso: 'familiar' };
  return null;
}

export function perfilesAccesibles(user: PublicUser): { id: number; nombre: string; acceso: Acceso }[] {
  if (user.rol === 'mayor') {
    const p = perfiles.findByTitular(user.id);
    return p ? [{ id: p.id, nombre: p.nombre, acceso: 'titular' }] : [];
  }
  return perfiles.findLinkedToFamiliar(user.id).map((p) => ({ id: p.id, nombre: p.nombre, acceso: 'familiar' as const }));
}
