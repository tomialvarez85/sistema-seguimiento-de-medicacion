import request from 'supertest';
import type { Express } from 'express';
import { createApp } from '../src/app.js';
import { openDatabase } from '../src/database/connection.js';
import { setNowForTests } from '../src/lib/clock.js';
import { resetLoginLimiterForTests } from '../src/services/authService.js';

export type Agent = ReturnType<typeof request.agent>;

export function nuevaApp(dbPath = ':memory:'): Express {
  openDatabase(dbPath);
  resetLoginLimiterForTests();
  return createApp();
}

/** Fija la hora local del servidor (fecha y hora locales, sin zona). */
export function fijarHora(local: string): void {
  setNowForTests(new Date(local));
}

export async function registrar(
  app: Express,
  datos: { nombre: string; email: string; rol: 'mayor' | 'familiar'; password?: string },
): Promise<{ agent: Agent; userId: number; perfilId: number | null }> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ password: 'clave-segura-1', ...datos })
    .expect(201);
  return { agent, userId: res.body.user.id, perfilId: res.body.perfiles[0]?.id ?? null };
}

export async function vincular(mayor: Agent, familiar: Agent): Promise<number> {
  const cod = await mayor.post('/api/vinculacion/codigo').expect(201);
  const res = await familiar.post('/api/vinculacion/confirmar').send({ codigo: cod.body.codigo.codigo }).expect(201);
  return res.body.perfilId;
}

export async function agregarMed(
  agent: Agent,
  perfilId: number,
  datos: { nombre: string; dosis?: string; bloque: 'manana' | 'noche'; etiqueta?: string },
) {
  const res = await agent
    .post(`/api/perfiles/${perfilId}/medicamentos`)
    .send({ dosis: '1 pastilla', ...datos })
    .expect(201);
  return res.body as { id: number; nombre: string };
}

export async function hoy(agent: Agent, perfilId: number) {
  return (await agent.get(`/api/perfiles/${perfilId}/hoy`).expect(200)).body;
}

export function itemPorNombre(dia: any, nombre: string) {
  for (const b of dia.bloques) for (const i of b.items) if (i.nombre === nombre) return i;
  throw new Error(`No está ${nombre}`);
}
