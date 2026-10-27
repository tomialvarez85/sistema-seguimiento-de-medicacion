import { Router } from 'express';
import { cargarPerfil, requireAuth, requireRol, soloTitular } from '../middleware/auth.js';
import * as authC from '../controllers/authController.js';
import * as p from '../controllers/perfilController.js';
import * as v from '../controllers/vinculacionController.js';

export function apiRouter(): Router {
  const api = Router();

  api.get('/salud', (_req, res) => {
    res.json({ ok: true });
  });

  // Autenticación
  api.post('/auth/register', authC.register);
  api.post('/auth/login', authC.login);
  api.post('/auth/logout', authC.logout);
  api.get('/auth/me', requireAuth, authC.me);

  // Vinculación
  const mayor = [requireAuth, requireRol('mayor')];
  const familiar = [requireAuth, requireRol('familiar')];
  api.get('/vinculacion/codigo', ...mayor, v.verCodigo);
  api.post('/vinculacion/codigo', ...mayor, v.generarCodigo);
  api.get('/vinculacion/familiares', ...mayor, v.listarFamiliares);
  api.delete('/vinculacion/familiares/:familiarId', ...mayor, v.quitarFamiliar);
  api.post('/vinculacion/validar', ...familiar, v.validarCodigo);
  api.post('/vinculacion/confirmar', ...familiar, v.confirmarVinculo);
  api.delete('/vinculacion/perfiles/:perfilId', ...familiar, v.desvincularme);

  // Perfil de medicación: lectura para titular y familiares vinculados; escritura solo titular.
  const perfil = Router({ mergeParams: true });
  perfil.use(requireAuth, cargarPerfil);

  perfil.get('/', p.resumenPerfil);
  perfil.get('/hoy', p.hoy);
  perfil.get('/medicamentos', p.listarMedicamentos);
  perfil.get('/horarios', p.obtenerHorarios);
  perfil.get('/historial', p.historialSemana);
  perfil.get('/historial/:fecha', p.historialDia);

  perfil.post('/tomas', soloTitular, p.registrarToma);
  perfil.delete('/tomas/:planItemId', soloTitular, p.desmarcar);
  perfil.post('/bloques/:clave/marcar-todo', soloTitular, p.marcarBloque);
  perfil.post('/bloques/:clave/confirmar', soloTitular, p.confirmarBloque);
  perfil.post('/medicamentos', soloTitular, p.crearMedicamento);
  perfil.put('/medicamentos/:id', soloTitular, p.editarMedicamento);
  perfil.delete('/medicamentos/:id', soloTitular, p.eliminarMedicamento);
  perfil.put('/horarios', soloTitular, p.guardarHorarios);
  perfil.get('/avisos/actual', soloTitular, p.avisoActual);
  perfil.post('/avisos/visto', soloTitular, p.avisoVisto);

  api.use('/perfiles/:perfilId', perfil);
  return api;
}
