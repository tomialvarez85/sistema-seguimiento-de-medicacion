import type { Request, Response } from 'express';
import { obtenerHoy } from '../services/rutinaService.js';
import * as tomas from '../services/tomasService.js';
import * as medicamentos from '../services/medicamentosService.js';
import * as horarios from '../services/horariosService.js';
import * as historial from '../services/historialService.js';
import * as avisos from '../services/avisosService.js';

const perfilId = (req: Request) => req.perfil!.id;
const userId = (req: Request) => req.user!.id;

export function resumenPerfil(req: Request, res: Response): void {
  res.json({ id: req.perfil!.id, nombre: req.perfil!.nombre, acceso: req.acceso, planDesde: req.perfil!.plan_desde });
}

export function hoy(req: Request, res: Response): void {
  res.json(obtenerHoy(perfilId(req)));
}

// --- Tomas ---
export function registrarToma(req: Request, res: Response): void {
  res.status(201).json(tomas.registrarToma(perfilId(req), userId(req), req.body?.planItemId, req.body?.estado));
}

export function desmarcar(req: Request, res: Response): void {
  res.json(tomas.desmarcar(perfilId(req), userId(req), req.params.planItemId));
}

export function marcarBloque(req: Request, res: Response): void {
  res.status(201).json(tomas.marcarBloque(perfilId(req), userId(req), req.params.clave));
}

export function confirmarBloque(req: Request, res: Response): void {
  res.status(201).json(tomas.confirmarBloqueIncompleto(perfilId(req), userId(req), req.params.clave));
}

// --- Medicamentos ---
export function listarMedicamentos(req: Request, res: Response): void {
  res.json(medicamentos.listar(perfilId(req)));
}

export function crearMedicamento(req: Request, res: Response): void {
  res.status(201).json(medicamentos.crear(perfilId(req), userId(req), req.body ?? {}));
}

export function editarMedicamento(req: Request, res: Response): void {
  res.json(medicamentos.editar(perfilId(req), userId(req), req.params.id, req.body ?? {}));
}

export function eliminarMedicamento(req: Request, res: Response): void {
  medicamentos.eliminar(perfilId(req), userId(req), req.params.id);
  res.status(204).end();
}

// --- Horarios ---
export function obtenerHorarios(req: Request, res: Response): void {
  res.json(horarios.obtener(perfilId(req)));
}

export function guardarHorarios(req: Request, res: Response): void {
  res.json(horarios.guardar(perfilId(req), userId(req), req.body));
}

// --- Historial ---
export function historialSemana(req: Request, res: Response): void {
  res.json(historial.semana(perfilId(req), req.query.hasta));
}

export function historialDia(req: Request, res: Response): void {
  res.json(historial.detalle(perfilId(req), req.params.fecha));
}

// --- Avisos ---
export function avisoActual(req: Request, res: Response): void {
  res.json({ aviso: avisos.avisoActual(perfilId(req)) });
}

export function avisoVisto(req: Request, res: Response): void {
  avisos.marcarVisto(perfilId(req), req.body ?? {});
  res.status(204).end();
}
