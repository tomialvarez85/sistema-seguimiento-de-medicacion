// Errores del dominio (equivalen a la jerarquía PastilleroException del Sprint 3).
// El mensaje es el texto directo que ve la persona usuaria.
export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export class DatoInvalidoError extends AppError {
  constructor(campos: Record<string, string>, message?: string) {
    super(400, 'DATO_INVALIDO', message ?? Object.values(campos)[0] ?? 'Revise los datos.', { campos });
  }
}

export class NoAutorizadoError extends AppError {
  constructor(message = 'Su cuenta no tiene permiso para hacer esto.') {
    super(403, 'SIN_PERMISO', message);
  }
}

export class NoEncontradoError extends AppError {
  constructor(message = 'No se encontró lo que busca.') {
    super(404, 'NO_ENCONTRADO', message);
  }
}

export class RegistroDuplicadoError extends AppError {
  constructor(message: string, extra: Record<string, unknown> = {}) {
    super(409, 'REGISTRO_DUPLICADO', message, extra);
  }
}
