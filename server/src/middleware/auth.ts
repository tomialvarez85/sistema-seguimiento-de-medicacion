import type { NextFunction, Request, Response } from 'express';
import { AppError, NoAutorizadoError } from '../lib/errors.js';
import { usuarioDeSesion } from '../services/authService.js';
import { accesoAPerfil } from '../services/accesoService.js';
import type { Rol } from '../types/index.js';

export const COOKIE_SESION = 'pastillero_sid';

export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const token = req.cookies?.[COOKIE_SESION];
  if (typeof token !== 'string' || !token) throw new AppError(401, 'SIN_SESION', 'Ingrese con su cuenta para continuar.');
  req.user = usuarioDeSesion(token);
  req.sessionToken = token;
  next();
}

export function requireRol(rol: Rol) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (req.user?.rol !== rol)
      throw new NoAutorizadoError(
        rol === 'mayor'
          ? 'Esta acción es solo para la cuenta de la persona mayor.'
          : 'Esta acción es solo para cuentas de familiar.',
      );
    next();
  };
}

/** Comprueba en cada solicitud que la cuenta tenga acceso al perfil pedido en la URL. */
export function cargarPerfil(req: Request, _res: Response, next: NextFunction): void {
  const perfilId = Number(req.params.perfilId);
  const r = Number.isInteger(perfilId) ? accesoAPerfil(req.user!, perfilId) : null;
  // Misma respuesta si el perfil no existe o si es ajeno: no se revela qué perfiles hay.
  if (!r) throw new NoAutorizadoError('No tiene permiso para ver este perfil.');
  req.perfil = r.perfil;
  req.acceso = r.acceso;
  next();
}

/** Las modificaciones solo las hace la cuenta titular. La supervisión del familiar es de solo lectura. */
export function soloTitular(req: Request, _res: Response, next: NextFunction): void {
  if (req.acceso !== 'titular')
    throw new NoAutorizadoError('Las cuentas de familiar solo pueden consultar. Los cambios los hace la persona mayor.');
  next();
}
