import crypto from 'node:crypto';
import { config } from '../config.js';
import { tx, isUniqueViolation } from '../database/connection.js';
import { AppError, DatoInvalidoError } from '../lib/errors.js';
import { now } from '../lib/clock.js';
import { toDateStr } from '../lib/time.js';
import * as users from '../repositories/usersRepo.js';
import * as sessions from '../repositories/sessionsRepo.js';
import * as perfiles from '../repositories/perfilesRepo.js';
import * as bloques from '../repositories/bloquesRepo.js';
import type { PublicUser, Rol, UserRow } from '../types/index.js';
import { HORARIOS_INICIALES } from './reglas.js';

// --- Contraseñas: scrypt con sal aleatoria ---
const SCRYPT = { N: 16384, r: 8, p: 1, keylen: 64 };

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, SCRYPT.keylen, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('base64')}$${hash.toString('base64')}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [alg, n, r, p, saltB64, hashB64] = stored.split('$');
  if (alg !== 'scrypt') return false;
  const expected = Buffer.from(hashB64, 'base64');
  const actual = crypto.scryptSync(password, Buffer.from(saltB64, 'base64'), expected.length, {
    N: Number(n),
    r: Number(r),
    p: Number(p),
  });
  return crypto.timingSafeEqual(expected, actual);
}

// Se compara contra un hash ficticio cuando el correo no existe, para no revelar qué cuentas hay.
const DUMMY_HASH = hashPassword(crypto.randomBytes(12).toString('hex'));

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function registrar(input: Record<string, unknown>): PublicUser {
  const nombre = typeof input.nombre === 'string' ? input.nombre.replace(/\s+/g, ' ').trim() : '';
  const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';
  const password = typeof input.password === 'string' ? input.password : '';
  const rol = input.rol as Rol;

  const campos: Record<string, string> = {};
  if (nombre.length < 2) campos.nombre = 'Escriba su nombre.';
  else if (nombre.length > 60) campos.nombre = 'El nombre puede tener hasta 60 letras.';
  if (!EMAIL_RE.test(email)) campos.email = 'Escriba un correo válido. Por ejemplo: ana@correo.com';
  if (password.length < 8) campos.password = 'La contraseña tiene que tener al menos 8 caracteres.';
  else if (password.length > 200) campos.password = 'La contraseña es demasiado larga.';
  if (rol !== 'mayor' && rol !== 'familiar') campos.rol = 'Elija el tipo de cuenta.';
  if (Object.keys(campos).length) throw new DatoInvalidoError(campos);

  const ahora = now();
  const iso = ahora.toISOString();
  try {
    return tx(() => {
      const id = users.create({ nombre, email, passwordHash: hashPassword(password), rol, creadoEn: iso });
      if (rol === 'mayor') {
        const perfilId = perfiles.create(id, nombre, toDateStr(ahora), iso);
        for (const clave of ['manana', 'noche'] as const) {
          bloques.create(perfilId, clave, HORARIOS_INICIALES[clave].inicio, HORARIOS_INICIALES[clave].fin, iso);
        }
      }
      return users.toPublic(users.findById(id)!);
    });
  } catch (err) {
    if (isUniqueViolation(err))
      throw new AppError(409, 'EMAIL_EN_USO', 'Ya existe una cuenta con ese correo.', {
        campos: { email: 'Ya existe una cuenta con ese correo.' },
      });
    throw err;
  }
}

// Límite simple de intentos de ingreso por correo (en memoria).
const fallos = new Map<string, { n: number; desde: number }>();
const MAX_FALLOS = 8;
const VENTANA_MS = 15 * 60 * 1000;

export function login(emailRaw: unknown, passwordRaw: unknown): PublicUser {
  const email = typeof emailRaw === 'string' ? emailRaw.trim().toLowerCase() : '';
  const password = typeof passwordRaw === 'string' ? passwordRaw : '';
  if (!email || !password)
    throw new DatoInvalidoError({
      ...(email ? {} : { email: 'Escriba su correo.' }),
      ...(password ? {} : { password: 'Escriba su contraseña.' }),
    });

  const f = fallos.get(email);
  const t = Date.now();
  if (f && t - f.desde < VENTANA_MS && f.n >= MAX_FALLOS)
    throw new AppError(429, 'DEMASIADOS_INTENTOS', 'Hubo muchos intentos. Espere unos minutos y vuelva a probar.');

  const user: UserRow | undefined = users.findByEmail(email);
  const ok = verifyPassword(password, user?.password_hash ?? DUMMY_HASH) && !!user;
  if (!ok) {
    const prev = f && t - f.desde < VENTANA_MS ? f : { n: 0, desde: t };
    fallos.set(email, { n: prev.n + 1, desde: prev.desde });
    throw new AppError(401, 'CREDENCIALES', 'El correo o la contraseña no son correctos.');
  }
  fallos.delete(email);
  return users.toPublic(user);
}

export function resetLoginLimiterForTests(): void {
  fallos.clear();
}

// --- Sesiones: token aleatorio en cookie httpOnly; en la base solo se guarda su hash ---
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function crearSesion(userId: number): { token: string; expira: Date } {
  const token = crypto.randomBytes(32).toString('base64url');
  const ahora = now();
  const expira = new Date(ahora.getTime() + config.sessionDays * 24 * 60 * 60 * 1000);
  sessions.deleteExpired(ahora.toISOString());
  sessions.create(hashToken(token), userId, ahora.toISOString(), expira.toISOString());
  return { token, expira };
}

export function usuarioDeSesion(token: string): PublicUser {
  const s = sessions.findByTokenHash(hashToken(token));
  if (!s) throw new AppError(401, 'SESION_VENCIDA', 'Su sesión terminó. Vuelva a ingresar.');
  if (s.expira_en <= now().toISOString()) {
    sessions.deleteByTokenHash(s.token_hash);
    throw new AppError(401, 'SESION_VENCIDA', 'Su sesión terminó. Vuelva a ingresar.');
  }
  const u = users.findById(s.user_id);
  if (!u) throw new AppError(401, 'SESION_VENCIDA', 'Su sesión terminó. Vuelva a ingresar.');
  return users.toPublic(u);
}

export function cerrarSesion(token: string): void {
  sessions.deleteByTokenHash(hashToken(token));
}
