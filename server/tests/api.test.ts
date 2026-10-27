import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { Express } from 'express';
import { closeDatabase, db } from '../src/database/connection.js';
import { setNowForTests } from '../src/lib/clock.js';
import { agregarMed, fijarHora, hoy, itemPorNombre, nuevaApp, registrar, vincular } from './helpers.js';
import type { Agent } from './helpers.js';

let app: Express;

beforeEach(() => {
  fijarHora('2026-10-20T09:00:00');
  app = nuevaApp();
});

afterEach(() => {
  setNowForTests(null);
  closeDatabase();
});

async function escenario() {
  const mayor = await registrar(app, { nombre: 'Marta', email: 'marta@ejemplo.com', rol: 'mayor' });
  const fam = await registrar(app, { nombre: 'Lucía', email: 'lucia@ejemplo.com', rol: 'familiar' });
  const perfilId = mayor.perfilId!;
  await vincular(mayor.agent, fam.agent);
  const m1 = await agregarMed(mayor.agent, perfilId, { nombre: 'Medicamento 1', bloque: 'manana', etiqueta: 'tensión baja' });
  const m2 = await agregarMed(mayor.agent, perfilId, { nombre: 'Medicamento 2', bloque: 'manana', etiqueta: 'memoria' });
  const m3 = await agregarMed(mayor.agent, perfilId, { nombre: 'Medicamento 3', bloque: 'manana' });
  const m4 = await agregarMed(mayor.agent, perfilId, { nombre: 'Medicamento 4', bloque: 'noche' });
  return { mayor: mayor.agent, familiar: fam.agent, perfilId, meds: { m1, m2, m3, m4 } };
}

function tomar(agent: Agent, perfilId: number, planItemId: number, estado: 'tomado' | 'no_tomado' = 'tomado') {
  return agent.post(`/api/perfiles/${perfilId}/tomas`).send({ planItemId, estado });
}

describe('Usuarios y permisos', () => {
  it('1. la persona mayor inicia sesión y consulta su rutina', async () => {
    const { perfilId } = await escenario();
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: 'MARTA@ejemplo.com', password: 'clave-segura-1' }).expect(200);
    expect(login.body.user.rol).toBe('mayor');
    expect(login.headers['set-cookie'][0]).toMatch(/HttpOnly/i);
    const dia = await hoy(agent, perfilId);
    expect(dia.fecha).toBe('2026-10-20');
    expect(dia.bloques.map((b: any) => b.clave)).toEqual(['manana', 'noche']);
    expect(dia.bloques[0].items).toHaveLength(3);
  });

  it('credenciales incorrectas y contraseñas guardadas con hash', async () => {
    await escenario();
    const res = await request(app).post('/api/auth/login').send({ email: 'marta@ejemplo.com', password: 'otra' }).expect(401);
    expect(res.body.error.message).toBe('El correo o la contraseña no son correctos.');
    const fila = db().prepare('SELECT password_hash FROM users WHERE email = ?').get('marta@ejemplo.com') as { password_hash: string };
    expect(fila.password_hash).not.toContain('clave-segura-1');
    expect(fila.password_hash.startsWith('scrypt$')).toBe(true);
  });

  it('2. el familiar inicia sesión y consulta el perfil vinculado', async () => {
    const { perfilId } = await escenario();
    const agent = request.agent(app);
    const login = await agent.post('/api/auth/login').send({ email: 'lucia@ejemplo.com', password: 'clave-segura-1' }).expect(200);
    expect(login.body.perfiles).toEqual([{ id: perfilId, nombre: 'Marta', acceso: 'familiar' }]);
    const dia = await hoy(agent, perfilId);
    expect(dia.resumen.total).toBe(4);
    await agent.get(`/api/perfiles/${perfilId}/medicamentos`).expect(200);
    await agent.get(`/api/perfiles/${perfilId}/horarios`).expect(200);
    await agent.get(`/api/perfiles/${perfilId}/historial`).expect(200);
  });

  it('3. un familiar sin autorización no accede a un perfil ajeno', async () => {
    const { perfilId } = await escenario();
    const extraño = await registrar(app, { nombre: 'Otro', email: 'otro@ejemplo.com', rol: 'familiar' });
    for (const ruta of ['hoy', 'medicamentos', 'horarios', 'historial', 'historial/2026-10-20', '']) {
      const res = await extraño.agent.get(`/api/perfiles/${perfilId}/${ruta}`);
      expect(res.status).toBe(403);
      expect(JSON.stringify(res.body)).not.toContain('Medicamento');
    }
    // Otra persona mayor tampoco ve un perfil que no es el suyo.
    const otraMayor = await registrar(app, { nombre: 'Rosa', email: 'rosa@ejemplo.com', rol: 'mayor' });
    await otraMayor.agent.get(`/api/perfiles/${perfilId}/hoy`).expect(403);
    // Sin sesión
    await request(app).get(`/api/perfiles/${perfilId}/hoy`).expect(401);
  });

  it('no alcanza con conocer el nombre o el correo: hace falta el código', async () => {
    await escenario();
    const otro = await registrar(app, { nombre: 'Otro', email: 'otro@ejemplo.com', rol: 'familiar' });
    for (const codigo of ['Marta', 'marta@ejemplo.com', 'ABCD-EFGH']) {
      const res = await otro.agent.post('/api/vinculacion/confirmar').send({ codigo }).expect(400);
      expect(res.body.error.code).toBe('CODIGO_INVALIDO');
    }
    expect((await otro.agent.get('/api/auth/me')).body.perfiles).toEqual([]);
  });

  it('4. el familiar no puede agregar, editar ni eliminar medicamentos', async () => {
    const { familiar, perfilId, meds } = await escenario();
    await familiar.post(`/api/perfiles/${perfilId}/medicamentos`).send({ nombre: 'X', dosis: '1', bloque: 'manana' }).expect(403);
    await familiar.put(`/api/perfiles/${perfilId}/medicamentos/${meds.m1.id}`).send({ nombre: 'X', dosis: '1', bloque: 'manana' }).expect(403);
    await familiar.delete(`/api/perfiles/${perfilId}/medicamentos/${meds.m1.id}`).expect(403);
    const lista = await familiar.get(`/api/perfiles/${perfilId}/medicamentos`).expect(200);
    expect(lista.body.map((m: any) => m.nombre)).toEqual(['Medicamento 1', 'Medicamento 2', 'Medicamento 3', 'Medicamento 4']);
  });

  it('5. el familiar no puede cambiar horarios', async () => {
    const { familiar, perfilId } = await escenario();
    await familiar
      .put(`/api/perfiles/${perfilId}/horarios`)
      .send({ manana: { inicio: '07:00', fin: '11:00' }, noche: { inicio: '19:00', fin: '22:00' } })
      .expect(403);
    const h = await familiar.get(`/api/perfiles/${perfilId}/horarios`).expect(200);
    expect(h.body[0]).toMatchObject({ inicio: '08:00', fin: '12:00' });
  });

  it('6. el familiar no puede registrar tomas ni modificar el historial', async () => {
    const { mayor, familiar, perfilId } = await escenario();
    const item = itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 1');
    expect((await tomar(familiar, perfilId, item.planItemId)).status).toBe(403);
    expect((await tomar(familiar, perfilId, item.planItemId, 'no_tomado')).status).toBe(403);
    await familiar.post(`/api/perfiles/${perfilId}/bloques/manana/marcar-todo`).expect(403);
    await familiar.post(`/api/perfiles/${perfilId}/bloques/manana/confirmar`).expect(403);
    await tomar(mayor, perfilId, item.planItemId).expect(201);
    await familiar.delete(`/api/perfiles/${perfilId}/tomas/${item.planItemId}`).expect(403);
    await familiar.get(`/api/perfiles/${perfilId}/avisos/actual`).expect(403);
    expect(itemPorNombre(await hoy(familiar, perfilId), 'Medicamento 1').estado).toBe('tomado');
  });

  it('7. los permisos se verifican en el backend aunque la cuenta tenga sesión válida', async () => {
    const { familiar, perfilId } = await escenario();
    const res = await familiar.post(`/api/perfiles/${perfilId}/medicamentos`).send({ nombre: 'X', dosis: '1', bloque: 'noche' });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('SIN_PERMISO');
    const n = db().prepare("SELECT COUNT(*) AS n FROM medicamentos WHERE nombre = 'X'").get() as { n: number };
    expect(Number(n.n)).toBe(0);
  });

  it('la persona mayor puede quitar el acceso de un familiar', async () => {
    const { mayor, familiar, perfilId } = await escenario();
    const fams = await mayor.get('/api/vinculacion/familiares').expect(200);
    expect(fams.body).toHaveLength(1);
    await mayor.delete(`/api/vinculacion/familiares/${fams.body[0].id}`).expect(204);
    await familiar.get(`/api/perfiles/${perfilId}/hoy`).expect(403);
  });

  it('vinculación: código de un solo uso, sin duplicados, varios familiares', async () => {
    const mayor = await registrar(app, { nombre: 'Marta', email: 'marta@ejemplo.com', rol: 'mayor' });
    const f1 = await registrar(app, { nombre: 'Ana', email: 'ana@ejemplo.com', rol: 'familiar' });
    const f2 = await registrar(app, { nombre: 'Sol', email: 'sol@ejemplo.com', rol: 'familiar' });
    const cod = (await mayor.agent.post('/api/vinculacion/codigo').expect(201)).body.codigo.codigo;
    const val = await f1.agent.post('/api/vinculacion/validar').send({ codigo: cod.toLowerCase() }).expect(200);
    expect(val.body.perfilNombre).toBe('Marta');
    // Validar no vincula todavía
    expect((await f1.agent.get('/api/auth/me')).body.perfiles).toEqual([]);
    await f1.agent.post('/api/vinculacion/confirmar').send({ codigo: cod }).expect(201);
    // El mismo código no sirve dos veces
    const usado = await f2.agent.post('/api/vinculacion/confirmar').send({ codigo: cod }).expect(400);
    expect(usado.body.error.code).toBe('CODIGO_VENCIDO');
    // Un código nuevo para el segundo familiar
    const cod2 = (await mayor.agent.post('/api/vinculacion/codigo').expect(201)).body.codigo.codigo;
    await f2.agent.post('/api/vinculacion/confirmar').send({ codigo: cod2 }).expect(201);
    // Vinculación repetida
    const cod3 = (await mayor.agent.post('/api/vinculacion/codigo').expect(201)).body.codigo.codigo;
    const rep = await f1.agent.post('/api/vinculacion/confirmar').send({ codigo: cod3 }).expect(409);
    expect(rep.body.error.code).toBe('YA_VINCULADO');
    expect((await mayor.agent.get('/api/vinculacion/familiares')).body).toHaveLength(2);
    // Una persona mayor no puede usar códigos de familiar
    await mayor.agent.post('/api/vinculacion/confirmar').send({ codigo: cod3 }).expect(403);
  });

  it('un familiar puede supervisar a más de una persona mayor', async () => {
    const a = await registrar(app, { nombre: 'Marta', email: 'marta@ejemplo.com', rol: 'mayor' });
    const b = await registrar(app, { nombre: 'Jorge', email: 'jorge@ejemplo.com', rol: 'mayor' });
    const f = await registrar(app, { nombre: 'Ana', email: 'ana@ejemplo.com', rol: 'familiar' });
    await vincular(a.agent, f.agent);
    await vincular(b.agent, f.agent);
    const me = await f.agent.get('/api/auth/me').expect(200);
    expect(me.body.perfiles.map((p: any) => p.nombre).sort()).toEqual(['Jorge', 'Marta']);
  });

  it('código vencido', async () => {
    const mayor = await registrar(app, { nombre: 'Marta', email: 'marta@ejemplo.com', rol: 'mayor' });
    const f = await registrar(app, { nombre: 'Ana', email: 'ana@ejemplo.com', rol: 'familiar' });
    const cod = (await mayor.agent.post('/api/vinculacion/codigo').expect(201)).body.codigo.codigo;
    fijarHora('2026-10-23T09:00:00');
    const res = await f.agent.post('/api/vinculacion/confirmar').send({ codigo: cod }).expect(400);
    expect(res.body.error.code).toBe('CODIGO_VENCIDO');
  });

  it('cerrar sesión invalida la sesión en el servidor', async () => {
    const { mayor, perfilId } = await escenario();
    await mayor.post('/api/auth/logout').expect(204);
    const res = await mayor.get(`/api/perfiles/${perfilId}/hoy`).expect(401);
    expect(res.body.error.message).toBe('Ingrese con su cuenta para continuar.');
  });

  it('sesión vencida', async () => {
    const { mayor, perfilId } = await escenario();
    fijarHora('2026-11-05T09:00:00');
    const res = await mayor.get(`/api/perfiles/${perfilId}/hoy`).expect(401);
    expect(res.body.error.code).toBe('SESION_VENCIDA');
  });

  it('rechaza modificaciones enviadas desde otro sitio', async () => {
    const { mayor, perfilId } = await escenario();
    await mayor
      .post(`/api/perfiles/${perfilId}/medicamentos`)
      .set('Origin', 'http://sitio-malicioso.com')
      .send({ nombre: 'X', dosis: '1', bloque: 'manana' })
      .expect(403);
  });
});

describe('Medicación', () => {
  it('8. registra que tomó un medicamento, con la hora real y quién lo hizo', async () => {
    const { mayor, perfilId } = await escenario();
    fijarHora('2026-10-20T08:15:00');
    const item = itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 1');
    const res = await tomar(mayor, perfilId, item.planItemId).expect(201);
    expect(res.body).toMatchObject({ hora: '08:15', tarde: false, estado: 'tomado' });
    const fila = db().prepare('SELECT * FROM tomas').get() as any;
    expect(fila).toMatchObject({ estado: 'tomado', hora: '08:15', registrado_en: '2026-10-20T08:15:00', origen: 'individual' });
    expect(fila.registrado_por).toBeGreaterThan(0);
  });

  it('9. registra que no tomó un medicamento', async () => {
    const { mayor, perfilId } = await escenario();
    const item = itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 2');
    await tomar(mayor, perfilId, item.planItemId, 'no_tomado').expect(201);
    const it2 = itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 2');
    expect(it2.estado).toBe('no_tomado');
  });

  it('10. el estado se refleja en la rutina (Incompleto · X de Y y Completo)', async () => {
    const { mayor, perfilId } = await escenario();
    let dia = await hoy(mayor, perfilId);
    expect(dia.bloques[0].estado.texto).toBe('Pendiente');
    await tomar(mayor, perfilId, itemPorNombre(dia, 'Medicamento 1').planItemId).expect(201);
    dia = await hoy(mayor, perfilId);
    expect(dia.bloques[0].estado.texto).toBe('Incompleto · 1 de 3');
    const res = await mayor.post(`/api/perfiles/${perfilId}/bloques/manana/marcar-todo`).expect(201);
    expect(res.body).toMatchObject({ hora: '09:00', cantidad: 2 });
    expect(res.body.dia.bloques[0].estado.tipo).toBe('completo');
    expect(res.body.dia.resumen).toMatchObject({ total: 4, tomadas: 3, pendientes: 1, noTomadas: 0 });
  });

  it('11. los pendientes no se muestran como tomados', async () => {
    const { mayor, perfilId } = await escenario();
    const dia = await hoy(mayor, perfilId);
    for (const b of dia.bloques) for (const i of b.items) expect(i).toMatchObject({ estado: 'pendiente', hora: null });
    expect(dia.resumen.tomadas).toBe(0);
  });

  it('12. el paso del tiempo no genera confirmaciones ficticias', async () => {
    const { mayor, familiar, perfilId } = await escenario();
    await hoy(mayor, perfilId);
    fijarHora('2026-10-20T23:59:00');
    let dia = await hoy(mayor, perfilId);
    expect(dia.bloques[0].fase).toBe('terminado');
    expect(dia.bloques[0].estado.tipo).toBe('pendiente');
    fijarHora('2026-10-23T10:00:00');
    await hoy(familiar, perfilId);
    const tomas = db().prepare('SELECT COUNT(*) AS n FROM tomas').get() as { n: number };
    expect(Number(tomas.n)).toBe(0);
    const hist = await familiar.get(`/api/perfiles/${perfilId}/historial`).expect(200);
    const d20 = hist.body.dias.find((d: any) => d.fecha === '2026-10-20');
    expect(d20.bloques[0].estado.tipo).toBe('sin_registrar');
    expect(d20.resumen).toMatchObject({ tomadas: 0, noTomadas: 0, pendientes: 4 });
  });

  it('una pendiente marcada después del cierre queda como tarde con la hora real', async () => {
    const { mayor, perfilId } = await escenario();
    fijarHora('2026-10-20T12:40:00');
    const item = itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 3');
    const res = await tomar(mayor, perfilId, item.planItemId).expect(201);
    expect(res.body).toMatchObject({ hora: '12:40', tarde: true });
    // Cambiar el horario después no altera el registro
    await mayor
      .put(`/api/perfiles/${perfilId}/horarios`)
      .send({ manana: { inicio: '08:00', fin: '13:00' }, noche: { inicio: '20:00', fin: '23:00' } })
      .expect(200);
    expect(itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 3').tarde).toBe(true);
  });

  it('13. orden: pendientes arriba y registradas al final; al desmarcar vuelve a su lugar', async () => {
    const { mayor, perfilId } = await escenario();
    let dia = await hoy(mayor, perfilId);
    await tomar(mayor, perfilId, itemPorNombre(dia, 'Medicamento 1').planItemId).expect(201);
    dia = await hoy(mayor, perfilId);
    expect(dia.bloques[0].items.map((i: any) => i.nombre)).toEqual(['Medicamento 2', 'Medicamento 3', 'Medicamento 1']);
    const des = await mayor.delete(`/api/perfiles/${perfilId}/tomas/${itemPorNombre(dia, 'Medicamento 1').planItemId}`).expect(200);
    expect(des.body.nombre).toBe('Medicamento 1');
    expect(des.body.dia.bloques[0].items.map((i: any) => i.nombre)).toEqual(['Medicamento 1', 'Medicamento 2', 'Medicamento 3']);
    // El registro anulado se conserva
    const filas = db().prepare('SELECT anulado_en FROM tomas').all() as any[];
    expect(filas).toHaveLength(1);
    expect(filas[0].anulado_en).not.toBeNull();
  });

  it('14. repetidos: rechaza el mismo nombre en el mismo bloque, permite otro bloque', async () => {
    const { mayor, perfilId, meds } = await escenario();
    const rep = await mayor
      .post(`/api/perfiles/${perfilId}/medicamentos`)
      .send({ nombre: '  medicamento   1 ', dosis: '1', bloque: 'manana' })
      .expect(409);
    expect(rep.body.error.message).toBe('Este medicamento ya está en el bloque de la mañana.');
    expect(rep.body.error.existenteId).toBe(meds.m1.id);
    await mayor.post(`/api/perfiles/${perfilId}/medicamentos`).send({ nombre: 'Medicamento 1', dosis: '1', bloque: 'noche' }).expect(201);
    // Editar otro con el nombre de uno existente en el mismo bloque
    await mayor
      .put(`/api/perfiles/${perfilId}/medicamentos/${meds.m2.id}`)
      .send({ nombre: 'Medicamento 1', dosis: '1', bloque: 'manana' })
      .expect(409);
  });

  it('validaciones de medicamento y horarios con mensajes claros', async () => {
    const { mayor, perfilId } = await escenario();
    const vac = await mayor.post(`/api/perfiles/${perfilId}/medicamentos`).send({ nombre: '', dosis: '', bloque: 'manana' }).expect(400);
    expect(vac.body.error.campos.nombre).toBe('Escriba el nombre del medicamento.');
    const larga = await mayor
      .post(`/api/perfiles/${perfilId}/medicamentos`)
      .send({ nombre: 'Y', dosis: '1', bloque: 'manana', etiqueta: 'x'.repeat(36) })
      .expect(400);
    expect(larga.body.error.campos.etiqueta).toMatch(/hasta 35/);
    const sup = await mayor
      .put(`/api/perfiles/${perfilId}/horarios`)
      .send({ manana: { inicio: '08:00', fin: '21:00' }, noche: { inicio: '20:00', fin: '23:00' } })
      .expect(400);
    expect(sup.body.error.message).toBe('Este horario se pisa con el bloque de la noche (20:00 a 23:00).');
    const ok = await mayor
      .put(`/api/perfiles/${perfilId}/horarios`)
      .send({ manana: { inicio: '08:00', fin: '12:00' }, noche: { inicio: '20:00', fin: '23:00' } })
      .expect(200);
    expect(ok.body[1].avisos).toEqual(['20:00', '21:30', '23:00']);
  });

  it('registro repetido: no duplica y avisa la hora (doble clic o reenvío)', async () => {
    const { mayor, perfilId } = await escenario();
    fijarHora('2026-10-20T08:15:00');
    const item = itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 1');
    const [a, b] = await Promise.all([tomar(mayor, perfilId, item.planItemId), tomar(mayor, perfilId, item.planItemId)]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    const dup = a.status === 409 ? a : b;
    expect(dup.body.error.message).toBe('Esta pastilla ya se registró a las 8:15.');
    await mayor.post(`/api/perfiles/${perfilId}/bloques/manana/marcar-todo`).expect(201);
    const otra = await mayor.post(`/api/perfiles/${perfilId}/bloques/manana/marcar-todo`).expect(409);
    expect(otra.body.error.message).toBe('Este bloque ya se registró a las 8:15.');
    const n = db().prepare('SELECT COUNT(*) AS n FROM tomas WHERE anulado_en IS NULL').get() as { n: number };
    expect(Number(n.n)).toBe(3);
  });

  it('confirmar un bloque incompleto registra explícitamente las faltantes como no tomadas', async () => {
    const { mayor, perfilId } = await escenario();
    const dia = await hoy(mayor, perfilId);
    await tomar(mayor, perfilId, itemPorNombre(dia, 'Medicamento 1').planItemId).expect(201);
    const res = await mayor.post(`/api/perfiles/${perfilId}/bloques/manana/confirmar`).expect(201);
    expect(res.body.noTomadas).toEqual(['Medicamento 2', 'Medicamento 3']);
    const b = res.body.dia.bloques[0];
    expect(b.estado).toMatchObject({ tipo: 'incompleto', tomadas: 1, noTomadas: 2, sinRegistrar: 0 });
  });

  it('solo se registran pastillas del día de hoy', async () => {
    const { mayor, perfilId } = await escenario();
    const item = itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 1');
    fijarHora('2026-10-21T09:00:00');
    const res = await tomar(mayor, perfilId, item.planItemId).expect(400);
    expect(res.body.error.code).toBe('SOLO_HOY');
  });

  it('avisos: inicio siempre, mitad solo con pendientes, sin repetir y sin registrar tomas', async () => {
    const { mayor, perfilId } = await escenario();
    fijarHora('2026-10-20T08:01:00');
    let a = (await mayor.get(`/api/perfiles/${perfilId}/avisos/actual`).expect(200)).body.aviso;
    expect(a).toMatchObject({ clave: 'manana', numero: 1, hora: '08:00' });
    expect(a.pendientes).toHaveLength(3);
    await mayor.post(`/api/perfiles/${perfilId}/avisos/visto`).send({ clave: 'manana', numero: 1 }).expect(204);
    expect((await mayor.get(`/api/perfiles/${perfilId}/avisos/actual`)).body.aviso).toBeNull();
    fijarHora('2026-10-20T10:00:00');
    a = (await mayor.get(`/api/perfiles/${perfilId}/avisos/actual`)).body.aviso;
    expect(a).toMatchObject({ numero: 2 });
    await mayor.post(`/api/perfiles/${perfilId}/bloques/manana/marcar-todo`).expect(201);
    expect((await mayor.get(`/api/perfiles/${perfilId}/avisos/actual`)).body.aviso).toBeNull();
    fijarHora('2026-10-20T12:00:00');
    expect((await mayor.get(`/api/perfiles/${perfilId}/avisos/actual`)).body.aviso).toBeNull();
    const n = db().prepare("SELECT COUNT(*) AS n FROM tomas WHERE origen <> 'bloque'").get() as { n: number };
    expect(Number(n.n)).toBe(0);
  });
});

describe('Historial y persistencia', () => {
  it('15 y 16. los registros se guardan en SQLite y el historial conserva tomas aunque se edite o elimine el medicamento', async () => {
    const { mayor, familiar, perfilId, meds } = await escenario();
    fijarHora('2026-10-20T08:15:00');
    await tomar(mayor, perfilId, itemPorNombre(await hoy(mayor, perfilId), 'Medicamento 1').planItemId).expect(201);
    fijarHora('2026-10-21T08:30:00');
    await mayor
      .put(`/api/perfiles/${perfilId}/medicamentos/${meds.m1.id}`)
      .send({ nombre: 'Medicamento 1 nuevo', dosis: '2 pastillas', bloque: 'manana' })
      .expect(200);
    await mayor.delete(`/api/perfiles/${perfilId}/medicamentos/${meds.m2.id}`).expect(204);
    const det = await familiar.get(`/api/perfiles/${perfilId}/historial/2026-10-20`).expect(200);
    const nombres = det.body.bloques[0].items.map((i: any) => i.nombre);
    expect(nombres).toEqual(['Medicamento 1', 'Medicamento 2', 'Medicamento 3']);
    expect(det.body.bloques[0].items[0]).toMatchObject({ estado: 'tomado', hora: '08:15', dosis: '1 pastilla' });
    const hoyDia = await hoy(mayor, perfilId);
    expect(hoyDia.bloques[0].items.map((i: any) => i.nombre)).toEqual(['Medicamento 1 nuevo', 'Medicamento 3']);
    expect(det.body.eventos.map((e: any) => e.descripcion)).toContain('Medicamento 1: tomada a las 8:15');
  });

  it('historial: últimos 7 días y semana anterior', async () => {
    const { mayor, perfilId } = await escenario();
    await hoy(mayor, perfilId);
    fijarHora('2026-10-29T09:00:00');
    // La sesión del día 20 ya venció: se vuelve a ingresar.
    await mayor.post('/api/auth/login').send({ email: 'marta@ejemplo.com', password: 'clave-segura-1' }).expect(200);
    const h = (await mayor.get(`/api/perfiles/${perfilId}/historial`).expect(200)).body;
    expect(h.dias.map((d: any) => d.fecha)).toEqual([
      '2026-10-23', '2026-10-24', '2026-10-25', '2026-10-26', '2026-10-27', '2026-10-28', '2026-10-29',
    ]);
    expect(h.anterior).toBe('2026-10-22');
    const prev = (await mayor.get(`/api/perfiles/${perfilId}/historial?hasta=${h.anterior}`).expect(200)).body;
    expect(prev.dias[0].fecha).toBe('2026-10-20'); // no antes del alta del perfil
    expect(prev.anterior).toBeNull();
  });

  it('17. el familiar ve los cambios registrados por la persona mayor', async () => {
    const { mayor, familiar, perfilId } = await escenario();
    await mayor.post(`/api/perfiles/${perfilId}/bloques/manana/marcar-todo`).expect(201);
    const dia = await hoy(familiar, perfilId);
    expect(dia.bloques[0].estado.tipo).toBe('completo');
    expect(dia.bloques[0].items[0].registradoPor).toBe('Marta');
  });

  it('18. la información permanece después de cerrar sesión', async () => {
    const { mayor, perfilId } = await escenario();
    await mayor.post(`/api/perfiles/${perfilId}/bloques/manana/marcar-todo`).expect(201);
    await mayor.post('/api/auth/logout').expect(204);
    const otra = request.agent(app);
    await otra.post('/api/auth/login').send({ email: 'marta@ejemplo.com', password: 'clave-segura-1' }).expect(200);
    expect((await hoy(otra, perfilId)).bloques[0].estado.tipo).toBe('completo');
  });

  it('20. los datos de diferentes perfiles no se mezclan', async () => {
    const { perfilId } = await escenario();
    const rosa = await registrar(app, { nombre: 'Rosa', email: 'rosa@ejemplo.com', rol: 'mayor' });
    await agregarMed(rosa.agent, rosa.perfilId!, { nombre: 'Medicamento 1', bloque: 'manana' });
    expect((await hoy(rosa.agent, rosa.perfilId!)).resumen.total).toBe(1);
    const marta = request.agent(app);
    await marta.post('/api/auth/login').send({ email: 'marta@ejemplo.com', password: 'clave-segura-1' }).expect(200);
    expect((await hoy(marta, perfilId)).resumen.total).toBe(4);
    // Rosa no puede registrar sobre una pastilla de Marta usando su propio perfil
    const itemMarta = itemPorNombre(await hoy(marta, perfilId), 'Medicamento 1');
    await rosa.agent.post(`/api/perfiles/${rosa.perfilId}/tomas`).send({ planItemId: itemMarta.planItemId, estado: 'tomado' }).expect(404);
  });
});

describe('19. persistencia después de reiniciar el backend', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'pastillero-'));
  const archivo = path.join(dir, 'prueba.sqlite');
  afterAll(() => {
    closeDatabase();
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('los datos siguen en el archivo después de cerrar y volver a abrir', async () => {
    closeDatabase();
    let a = nuevaApp(archivo);
    const mayor = await registrar(a, { nombre: 'Marta', email: 'marta@ejemplo.com', rol: 'mayor' });
    await agregarMed(mayor.agent, mayor.perfilId!, { nombre: 'Medicamento 1', bloque: 'manana' });
    await mayor.agent.post(`/api/perfiles/${mayor.perfilId}/bloques/manana/marcar-todo`).expect(201);
    closeDatabase(); // "apagar" el servidor

    a = nuevaApp(archivo); // "volver a iniciarlo"
    const agent = request.agent(a);
    await agent.post('/api/auth/login').send({ email: 'marta@ejemplo.com', password: 'clave-segura-1' }).expect(200);
    const dia = await hoy(agent, mayor.perfilId!);
    expect(dia.bloques[0].items[0]).toMatchObject({ nombre: 'Medicamento 1', estado: 'tomado', hora: '09:00' });
  });
});
