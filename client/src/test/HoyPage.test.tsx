import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HoyPage } from '../pages/HoyPage';
import { ToastProvider } from '../components/Toasts';
import { ApiError } from '../services/http';
import { bloque, dia, item } from './fixtures';

const api = vi.hoisted(() => ({
  hoy: vi.fn(),
  registrarToma: vi.fn(),
  desmarcar: vi.fn(),
  marcarBloque: vi.fn(),
  confirmarBloque: vi.fn(),
}));

vi.mock('../services/api', () => ({ perfilApi: api }));
vi.mock('../context/AuthContext', () => ({
  usePerfilPropio: () => ({ id: 1, nombre: 'Marta', acceso: 'titular' }),
  useAuth: () => ({ user: { id: 1, nombre: 'Marta', email: 'm@x.com', rol: 'mayor' } }),
}));

const inicial = () =>
  dia([
    bloque({
      items: [
        item({ planItemId: 1, nombre: 'Medicamento 1', etiqueta: 'tensión baja' }),
        item({ planItemId: 2, nombre: 'Medicamento 2' }),
        item({ planItemId: 3, nombre: 'Medicamento 3', estado: 'tomado', hora: '08:15' }),
      ],
    }),
    bloque({ clave: 'noche', nombre: 'Noche', inicio: '20:00', fin: '23:00', fase: 'proximo', items: [item({ planItemId: 9, nombre: 'Medicamento 9' })] }),
  ]);

function montar() {
  return render(
    <MemoryRouter>
      <ToastProvider>
        <HoyPage />
      </ToastProvider>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  api.hoy.mockResolvedValue(inicial());
});

describe('HoyPage', () => {
  it('muestra la fecha, el resumen y lo que falta', async () => {
    montar();
    expect(await screen.findByRole('heading', { name: /22 de octubre de 2026/ })).toBeInTheDocument();
    expect(screen.getByText(/3 pastillas/)).toBeInTheDocument(); // le faltan registrar 3
    expect(screen.getByRole('img', { name: '1 tomadas, 0 no tomadas y 3 pendientes, de 4' })).toBeInTheDocument();
  });

  it('23. bloque incompleto: avisa qué falta, foco en "Volver y marcar", y "Confirmar igual" registra no tomadas', async () => {
    const user = userEvent.setup();
    api.confirmarBloque.mockResolvedValue({ hora: '12:05', noTomadas: ['Medicamento 1', 'Medicamento 2'], clave: 'manana', dia: inicial() });
    montar();
    const manana = (await screen.findByRole('heading', { name: 'Bloque de la mañana' })).closest('section')!;
    await user.click(within(manana).getByRole('button', { name: /Terminar bloque/ }));
    const dlg = await screen.findByRole('alertdialog');
    expect(within(dlg).getByRole('heading', { name: 'Faltan 2 pastillas' })).toBeInTheDocument();
    expect(within(dlg).getByText(/Medicamento 1 y Medicamento 2/)).toBeInTheDocument();
    expect(within(dlg).getByRole('button', { name: 'Volver y marcar' })).toHaveFocus();
    expect(api.confirmarBloque).not.toHaveBeenCalled();
    await user.click(within(dlg).getByRole('button', { name: 'Confirmar igual' }));
    expect(api.confirmarBloque).toHaveBeenCalledWith(1, 'manana');
    expect(await screen.findByText(/Quedaron registradas como no tomadas: Medicamento 1 y Medicamento 2/)).toBeInTheDocument();
  });

  it('no muestra un registro como exitoso hasta que el backend lo confirma', async () => {
    const user = userEvent.setup();
    let resolver!: (v: unknown) => void;
    api.marcarBloque.mockReturnValue(new Promise((r) => (resolver = r)));
    montar();
    const manana = (await screen.findByRole('heading', { name: 'Bloque de la mañana' })).closest('section')!;
    await user.click(within(manana).getByRole('button', { name: /Marcar todo el bloque/ }));
    expect(screen.queryByText(/registrado a las/)).not.toBeInTheDocument();
    expect(within(manana).getByRole('checkbox', { name: /Medicamento 1/ })).not.toBeChecked();
    const despues = inicial();
    despues.bloques[0].items = despues.bloques[0].items.map((i) => ({ ...i, estado: 'tomado', hora: '09:00' }));
    resolver({ hora: '09:00', tarde: false, cantidad: 2, clave: 'manana', dia: despues });
    expect(await screen.findByRole('heading', { name: 'Bloque de la mañana registrado a las 9:00' })).toBeInTheDocument();
  });

  it('registro repetido: solo informa la hora del registro anterior', async () => {
    const user = userEvent.setup();
    api.marcarBloque.mockRejectedValue(new ApiError(409, 'REGISTRO_DUPLICADO', 'Este bloque ya se registró a las 8:15.'));
    montar();
    const manana = (await screen.findByRole('heading', { name: 'Bloque de la mañana' })).closest('section')!;
    await user.click(within(manana).getByRole('button', { name: /Marcar todo el bloque/ }));
    expect(await screen.findByText('Este bloque ya se registró a las 8:15.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Ya estaba registrado' })).toBeInTheDocument();
  });

  it('error al guardar: mensaje claro y "Intentar de nuevo"', async () => {
    const user = userEvent.setup();
    api.registrarToma.mockRejectedValueOnce(new ApiError(500, 'ERROR_INTERNO', 'x'));
    api.registrarToma.mockResolvedValueOnce({ hora: '09:01', tarde: false, estado: 'tomado', nombre: 'Medicamento 1', dia: inicial() });
    montar();
    await user.click(await screen.findByRole('checkbox', { name: /Medicamento 1/ }));
    expect(await screen.findByText('No se pudo guardar el cambio. Intente de nuevo.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Intentar de nuevo/ }));
    expect(api.registrarToma).toHaveBeenCalledTimes(2);
    expect(await screen.findByText('Medicamento 1: tomada a las 9:01')).toBeInTheDocument();
  });

  it('"No la tomó" pide confirmación antes de registrar', async () => {
    const user = userEvent.setup();
    api.registrarToma.mockResolvedValue({ hora: '09:02', tarde: false, estado: 'no_tomado', nombre: 'Medicamento 2', dia: inicial() });
    montar();
    await screen.findByRole('heading', { name: 'Bloque de la mañana' });
    await user.click(screen.getAllByRole('button', { name: /No la tomó/ })[1]);
    expect(api.registrarToma).not.toHaveBeenCalled();
    const dlg = screen.getByRole('dialog');
    expect(within(dlg).getByRole('button', { name: 'Volver' })).toHaveFocus();
    await user.click(within(dlg).getByRole('button', { name: 'Sí, no se tomó' }));
    expect(api.registrarToma).toHaveBeenCalledWith(1, 2, 'no_tomado');
  });
});
