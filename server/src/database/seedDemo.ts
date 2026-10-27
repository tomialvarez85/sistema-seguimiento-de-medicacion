// Datos de DEMOSTRACIÓN. Solo escribe en la base indicada por DB_PATH (por defecto data/demo.sqlite)
// y no toca una base que ya tenga cuentas, salvo que se pase --reset.
// Los registros se crean a través de los mismos servicios que usa la API, respetando las reglas.
import fs from 'node:fs';
import { config } from '../config.js';
import { closeDatabase, db, openDatabase } from './connection.js';
import { setNowForTests } from '../lib/clock.js';
import { addDays, toDateStr, toTimeStr } from '../lib/time.js';
import * as auth from '../services/authService.js';
import * as medicamentos from '../services/medicamentosService.js';
import * as tomas from '../services/tomasService.js';
import * as vinculacion from '../services/vinculacionService.js';
import { obtenerHoy } from '../services/rutinaService.js';

export const DEMO = {
  mayor: { nombre: 'Marta', email: 'marta@demo.local', password: 'demo-pastillero' },
  familiar: { nombre: 'Lucía', email: 'lucia@demo.local', password: 'demo-pastillero' },
  familiar2: { nombre: 'Sofía', email: 'sofia@demo.local', password: 'demo-pastillero' },
};

const reset = process.argv.includes('--reset');
const dbPath = config.dbPath;

if (!/demo/i.test(dbPath) && !process.argv.includes('--permitir-otra-base')) {
  console.error(`Por seguridad, los datos de demostración solo se cargan en una base cuyo nombre contenga "demo".\nBase indicada: ${dbPath}`);
  process.exit(1);
}

if (reset && fs.existsSync(dbPath)) {
  for (const f of [dbPath, `${dbPath}-wal`, `${dbPath}-shm`]) if (fs.existsSync(f)) fs.rmSync(f);
}

openDatabase(dbPath);
const cuentas = Number((db().prepare('SELECT COUNT(*) AS n FROM users').get() as { n: number }).n);
if (cuentas > 0) {
  console.log(`La base de demostración ya tiene datos (${dbPath}). Use "npm run seed:demo -- --reset" para recrearla.`);
  closeDatabase();
  process.exit(0);
}

const real = new Date();
const hoy = toDateStr(real);
const en = (fecha: string, hora: string) => setNowForTests(new Date(`${fecha}T${hora}:00`));

// Alta de cuentas hace 7 días
const inicio = addDays(hoy, -7);
en(inicio, '07:30');
const marta = auth.registrar({ ...DEMO.mayor, rol: 'mayor' });
const lucia = auth.registrar({ ...DEMO.familiar, rol: 'familiar' });
auth.registrar({ ...DEMO.familiar2, rol: 'familiar' }); // cuenta familiar sin vincular, para probar el acceso denegado
const perfilId = Number((db().prepare('SELECT id FROM perfiles WHERE titular_user_id = ?').get(marta.id) as { id: number }).id);

const cod = vinculacion.nuevoCodigo(perfilId);
vinculacion.confirmar(lucia.id, cod.codigo);

const lista: { nombre: string; dosis: string; bloque: 'manana' | 'noche'; etiqueta?: string }[] = [
  { nombre: 'Medicamento 1', dosis: '1 pastilla', bloque: 'manana', etiqueta: 'tensión baja' },
  { nombre: 'Medicamento 2', dosis: '1 pastilla', bloque: 'manana', etiqueta: 'memoria' },
  { nombre: 'Medicamento 3', dosis: '1 cápsula', bloque: 'manana', etiqueta: 'estómago' },
  { nombre: 'Medicamento 4', dosis: '1/2 pastilla', bloque: 'manana', etiqueta: 'colesterol' },
  { nombre: 'Medicamento 5', dosis: '1 pastilla', bloque: 'manana', etiqueta: 'vitaminas' },
  { nombre: 'Medicamento 6', dosis: '1 pastilla', bloque: 'noche', etiqueta: 'tensión' },
  { nombre: 'Medicamento 7', dosis: '2 gotas', bloque: 'noche', etiqueta: 'dormir' },
  { nombre: 'Medicamento 2', dosis: '1 pastilla', bloque: 'noche', etiqueta: 'memoria' },
  { nombre: 'Medicamento 8', dosis: '1 sobre', bloque: 'noche' },
];
for (const m of lista) medicamentos.crear(perfilId, marta.id, m);

type Plan = 'todo' | 'tarde' | 'incompleto' | 'no' | 'nada' | 'confirmado';

function registrarDia(fecha: string, manana: Plan, noche: Plan) {
  for (const [clave, plan, hora, horaTarde] of [
    ['manana', manana, '08:15', '12:40'],
    ['noche', noche, '20:20', '23:25'],
  ] as const) {
    en(fecha, hora);
    const items = () => obtenerHoy(perfilId).bloques.find((b) => b.clave === clave)!.items;
    if (plan === 'todo') tomas.marcarBloque(perfilId, marta.id, clave);
    if (plan === 'incompleto' || plan === 'tarde' || plan === 'confirmado') {
      for (const it of items().slice(0, -1)) tomas.registrarToma(perfilId, marta.id, it.planItemId, 'tomado');
    }
    if (plan === 'tarde') {
      en(fecha, horaTarde);
      const resto = items().filter((i) => i.estado === 'pendiente');
      for (const it of resto) tomas.registrarToma(perfilId, marta.id, it.planItemId, 'tomado');
    }
    if (plan === 'confirmado') tomas.confirmarBloqueIncompleto(perfilId, marta.id, clave);
    if (plan === 'no') {
      const it = items()[0];
      tomas.registrarToma(perfilId, marta.id, it.planItemId, 'no_tomado');
      for (const r of items().filter((i) => i.estado === 'pendiente')) tomas.registrarToma(perfilId, marta.id, r.planItemId, 'tomado');
    }
  }
}

registrarDia(addDays(hoy, -7), 'todo', 'todo');
registrarDia(addDays(hoy, -6), 'todo', 'incompleto');
registrarDia(addDays(hoy, -5), 'tarde', 'todo');
registrarDia(addDays(hoy, -4), 'todo', 'nada');
registrarDia(addDays(hoy, -3), 'no', 'todo');
registrarDia(addDays(hoy, -2), 'confirmado', 'todo');
registrarDia(addDays(hoy, -1), 'todo', 'tarde');

// Hoy: solo se registra lo que ya pudo haber pasado según la hora real.
const ahora = toTimeStr(real);
if (ahora >= '08:20') {
  en(hoy, '08:15');
  const items = obtenerHoy(perfilId).bloques[0].items;
  tomas.registrarToma(perfilId, marta.id, items[0].planItemId, 'tomado');
  tomas.registrarToma(perfilId, marta.id, items[2].planItemId, 'tomado');
  tomas.registrarToma(perfilId, marta.id, items[3].planItemId, 'no_tomado');
}

setNowForTests(null);
closeDatabase();

console.log(`Datos de demostración cargados en ${dbPath}

  Persona mayor:  ${DEMO.mayor.email} / ${DEMO.mayor.password}
  Familiar:       ${DEMO.familiar.email} / ${DEMO.familiar.password}  (vinculada)
  Familiar extra: ${DEMO.familiar2.email} / ${DEMO.familiar2.password}  (sin vincular)

Son cuentas de prueba: no las use como credenciales definitivas.`);
