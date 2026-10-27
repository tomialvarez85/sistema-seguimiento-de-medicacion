import type { Request, Response } from 'express';
import * as vinculacion from '../services/vinculacionService.js';
import * as perfiles from '../repositories/perfilesRepo.js';
import { NoEncontradoError } from '../lib/errors.js';

function perfilPropio(req: Request) {
  const p = perfiles.findByTitular(req.user!.id);
  if (!p) throw new NoEncontradoError('Su cuenta no tiene un perfil de medicación.');
  return p;
}

// --- Persona mayor ---
export function verCodigo(req: Request, res: Response): void {
  res.json({ codigo: vinculacion.codigoActual(perfilPropio(req).id) });
}

export function generarCodigo(req: Request, res: Response): void {
  res.status(201).json({ codigo: vinculacion.nuevoCodigo(perfilPropio(req).id) });
}

export function listarFamiliares(req: Request, res: Response): void {
  res.json(vinculacion.familiares(perfilPropio(req).id));
}

export function quitarFamiliar(req: Request, res: Response): void {
  vinculacion.quitarFamiliar(perfilPropio(req).id, req.user!.id, req.params.familiarId);
  res.status(204).end();
}

// --- Familiar ---
export function validarCodigo(req: Request, res: Response): void {
  res.json(vinculacion.validar(req.user!.id, req.body?.codigo));
}

export function confirmarVinculo(req: Request, res: Response): void {
  res.status(201).json(vinculacion.confirmar(req.user!.id, req.body?.codigo));
}

export function desvincularme(req: Request, res: Response): void {
  vinculacion.desvincularme(req.user!.id, Number(req.params.perfilId));
  res.status(204).end();
}
