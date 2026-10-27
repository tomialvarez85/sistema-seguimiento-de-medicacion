// Cliente HTTP: la sesión viaja en una cookie httpOnly que el navegador envía solo.
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public campos: Record<string, string> = {},
    public extra: Record<string, unknown> = {},
  ) {
    super(message);
  }
}

export const MENSAJE_SIN_CONEXION =
  'No hay conexión con el pastillero. Revise que el programa esté abierto e intente de nuevo.';

type SesionVencidaHandler = (message: string) => void;
let onSesionVencida: SesionVencidaHandler | null = null;

export function alVencerSesion(handler: SesionVencidaHandler | null): void {
  onSesionVencida = handler;
}

export async function http<T>(method: string, url: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${url}`, {
      method,
      credentials: 'same-origin',
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'SIN_CONEXION', MENSAJE_SIN_CONEXION);
  }
  if (res.status === 204) return undefined as T;

  let data: any = null;
  try {
    data = await res.json();
  } catch {
    // El servidor no respondió con JSON (por ejemplo, el proxy no alcanza al backend).
    if (!res.ok) throw new ApiError(res.status, 'SIN_CONEXION', MENSAJE_SIN_CONEXION);
  }
  if (!res.ok) {
    const e = data?.error ?? {};
    const { code, message, campos, ...extra } = e;
    const err = new ApiError(res.status, code ?? 'ERROR', message ?? 'No se pudo completar. Intente de nuevo.', campos ?? {}, extra);
    if (res.status === 401 && url !== '/auth/login' && url !== '/auth/me' && onSesionVencida) onSesionVencida(err.message);
    throw err;
  }
  return data as T;
}
