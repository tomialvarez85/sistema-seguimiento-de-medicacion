import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../lib/errors.js';

export function notFound(_req: Request, res: Response): void {
  res.status(404).json({ error: { code: 'NO_ENCONTRADO', message: 'No se encontró lo que busca.' } });
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message, ...err.extra } });
    return;
  }
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json({ error: { code: 'JSON', message: 'Los datos enviados no se pudieron leer.' } });
    return;
  }
  // Detalle técnico solo en el log del servidor, sin cuerpos de solicitud (pueden tener contraseñas).
  console.error(`[error] ${req.method} ${req.path}:`, err instanceof Error ? err.stack : err);
  res.status(500).json({ error: { code: 'ERROR_INTERNO', message: 'No se pudo completar. Intente de nuevo.' } });
}
