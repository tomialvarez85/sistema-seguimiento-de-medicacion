import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { NoAutorizadoError } from '../lib/errors.js';

const SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Protección contra solicitudes de otros sitios: las operaciones que modifican datos
 * solo se aceptan desde la propia aplicación (además de la cookie SameSite=Lax).
 */
export function checkOrigin(req: Request, _res: Response, next: NextFunction): void {
  if (SEGUROS.has(req.method)) return next();
  const origin = req.get('origin');
  if (!origin) return next(); // clientes que no son navegadores (pruebas, curl)
  const propio = `${req.protocol}://${req.get('host')}`;
  if (origin === propio || config.clientOrigins.includes(origin)) return next();
  throw new NoAutorizadoError('Solicitud rechazada.');
}
