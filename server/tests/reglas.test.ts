import { describe, expect, it } from 'vitest';
import {
  calcularAvisos,
  esTarde,
  estadoBloque,
  faseBloque,
  normalizarNombre,
  ordenarPendientesPrimero,
  validarHorarios,
  validarMedicamento,
} from '../src/services/reglas.js';
import { DatoInvalidoError } from '../src/lib/errors.js';

function errorDe(fn: () => unknown): DatoInvalidoError {
  try {
    fn();
  } catch (e) {
    return e as DatoInvalidoError;
  }
  throw new Error('No lanzó error');
}

describe('avisos de cada bloque (HU-05)', () => {
  it('calcula inicio, mitad y cierre', () => {
    expect(calcularAvisos('08:00', '12:00')).toEqual(['08:00', '10:00', '12:00']);
    expect(calcularAvisos('20:00', '23:00')).toEqual(['20:00', '21:30', '23:00']);
  });
});

describe('estado del bloque', () => {
  const p = { estado: 'pendiente' as const, tarde: false, hora: null };
  const t = (hora: string, tarde = false) => ({ estado: 'tomado' as const, tarde, hora });
  const n = { estado: 'no_tomado' as const, tarde: false, hora: '09:00' };

  it('pendiente hoy y sin registrar en días pasados: nunca se suponen tomadas', () => {
    expect(estadoBloque([p, p], true).tipo).toBe('pendiente');
    expect(estadoBloque([p, p], false).tipo).toBe('sin_registrar');
    expect(estadoBloque([p, p], false).tomadas).toBe(0);
  });

  it('incompleto X de Y cuenta solo las tomadas', () => {
    const e = estadoBloque([t('08:15'), p, n, t('08:20'), p], true);
    expect(e.tipo).toBe('incompleto');
    expect(e.texto).toBe('Incompleto · 2 de 5');
    expect(e).toMatchObject({ tomadas: 2, noTomadas: 1, sinRegistrar: 2 });
  });

  it('completo, con entrega tarde indicada', () => {
    expect(estadoBloque([t('08:15'), t('08:20')], true).texto).toBe('Completo');
    expect(estadoBloque([t('08:15'), t('12:40', true)], true).texto).toBe('Completo · con entrega tarde (12:40)');
  });

  it('no tomado solo si todas se registraron explícitamente como no tomadas', () => {
    expect(estadoBloque([n, n], false).tipo).toBe('no_tomado');
    expect(estadoBloque([n, p], false).tipo).toBe('incompleto');
  });
});

describe('orden de la pantalla Hoy (Sprint 3)', () => {
  it('pendientes arriba y registradas al final, sin desordenar las demás', () => {
    const items = [
      { n: 1, estado: 'tomado' as const },
      { n: 2, estado: 'pendiente' as const },
      { n: 3, estado: 'no_tomado' as const },
      { n: 4, estado: 'pendiente' as const },
      { n: 5, estado: 'tomado' as const },
    ];
    expect(ordenarPendientesPrimero(items).map((i) => i.n)).toEqual([2, 4, 1, 3, 5]);
  });
});

describe('tiempo', () => {
  it('fase del bloque y entregas tarde', () => {
    expect(faseBloque('07:59', '08:00', '12:00')).toBe('proximo');
    expect(faseBloque('12:00', '08:00', '12:00')).toBe('en_curso');
    expect(faseBloque('12:01', '08:00', '12:00')).toBe('terminado');
    expect(esTarde('12:00', '12:00')).toBe(false);
    expect(esTarde('12:40', '12:00')).toBe(true);
  });
});

describe('validación de medicamentos (HU-04)', () => {
  it('rechaza nombre y dosis vacíos con los mensajes del Sprint 2', () => {
    const e = errorDe(() => validarMedicamento({ nombre: ' ', dosis: '', bloque: 'manana' }));
    expect(e.extra.campos).toMatchObject({
      nombre: 'Escriba el nombre del medicamento.',
      dosis: 'Escriba la dosis. Por ejemplo: 1 pastilla.',
    });
  });

  it('etiqueta de hasta 35 caracteres contando espacios', () => {
    expect(validarMedicamento({ nombre: 'A', dosis: '1', bloque: 'noche', etiqueta: 'a'.repeat(35) }).etiqueta).toHaveLength(35);
    const e = errorDe(() => validarMedicamento({ nombre: 'A', dosis: '1', bloque: 'noche', etiqueta: 'a'.repeat(36) }));
    expect((e.extra.campos as Record<string, string>).etiqueta).toMatch(/hasta 35/);
  });

  it('normaliza para detectar repetidos', () => {
    expect(normalizarNombre('  Ácido   Fólico ')).toBe('acido folico');
  });
});

describe('validación de horarios (HU-07)', () => {
  it('acepta los horarios del Sprint 3', () => {
    expect(validarHorarios({ manana: { inicio: '8:00', fin: '12:00' }, noche: { inicio: '20:00', fin: '23:00' } })).toEqual({
      manana: { inicio: '08:00', fin: '12:00' },
      noche: { inicio: '20:00', fin: '23:00' },
    });
  });

  it('hora mal escrita', () => {
    const e = errorDe(() => validarHorarios({ manana: { inicio: '25:00', fin: '12:00' }, noche: { inicio: '20:00', fin: '23:00' } }));
    expect(e.message).toBe('Escriba la hora así: 08:00.');
  });

  it('fin antes del inicio', () => {
    const e = errorDe(() => validarHorarios({ manana: { inicio: '12:00', fin: '08:00' }, noche: { inicio: '20:00', fin: '23:00' } }));
    expect(e.message).toBe('La hora de fin tiene que ser después de la de inicio.');
  });

  it('bloques superpuestos', () => {
    const e = errorDe(() => validarHorarios({ manana: { inicio: '08:00', fin: '21:00' }, noche: { inicio: '20:00', fin: '23:00' } }));
    expect(e.message).toBe('Este horario se pisa con el bloque de la noche (20:00 a 23:00).');
  });
});
