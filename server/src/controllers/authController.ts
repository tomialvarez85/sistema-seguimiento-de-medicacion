import type { Request, Response } from 'express';
import { config } from '../config.js';
import { COOKIE_SESION } from '../middleware/auth.js';
import * as auth from '../services/authService.js';
import { perfilesAccesibles } from '../services/accesoService.js';
import type { PublicUser } from '../types/index.js';

function iniciarSesion(res: Response, user: PublicUser): void {
  const { token, expira } = auth.crearSesion(user.id);
  res.cookie(COOKIE_SESION, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.cookieSecure,
    expires: expira,
    path: '/',
  });
}

function respuestaSesion(user: PublicUser) {
  return { user, perfiles: perfilesAccesibles(user) };
}

export function register(req: Request, res: Response): void {
  const user = auth.registrar(req.body ?? {});
  iniciarSesion(res, user);
  res.status(201).json(respuestaSesion(user));
}

export function login(req: Request, res: Response): void {
  const user = auth.login(req.body?.email, req.body?.password);
  iniciarSesion(res, user);
  res.json(respuestaSesion(user));
}

export function logout(req: Request, res: Response): void {
  const token = req.cookies?.[COOKIE_SESION];
  if (typeof token === 'string' && token) auth.cerrarSesion(token);
  res.clearCookie(COOKIE_SESION, { path: '/' });
  res.status(204).end();
}

export function me(req: Request, res: Response): void {
  res.json(respuestaSesion(req.user!));
}
