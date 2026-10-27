import type { Acceso, PerfilRow, PublicUser } from './index.js';

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
      sessionToken?: string;
      perfil?: PerfilRow;
      acceso?: Acceso;
    }
  }
}

export {};
