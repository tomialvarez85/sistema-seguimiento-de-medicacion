import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BloqueCard } from '../components/BloqueCard';
import { bloque, item } from './fixtures';

function montar(items = [
  item({ planItemId: 1, nombre: 'Medicamento 2', etiqueta: 'memoria' }),
  item({ planItemId: 2, nombre: 'Medicamento 4' }),
  item({ planItemId: 3, nombre: 'Medicamento 1', estado: 'tomado', hora: '08:15' }),
  item({ planItemId: 4, nombre: 'Medicamento 3', estado: 'no_tomado', hora: '08:20' }),
]) {
  const props = {
    onToggle: vi.fn(),
    onNoTomada: vi.fn(),
    onMarcarTodo: vi.fn(),
    onTerminar: vi.fn(),
  };
  render(<BloqueCard bloque={bloque({ items })} ocupados={new Set()} ocupadoBloque={false} {...props} />);
  return props;
}

describe('BloqueCard (pantalla Hoy)', () => {
  it('24. se usa con teclado: flechas, Espacio, Enter y N (Sprint 3)', async () => {
    const user = userEvent.setup();
    const p = montar();
    const casillas = screen.getAllByRole('checkbox');
    // Una sola parada de tabulación por bloque (tabindex móvil)
    expect(casillas.filter((c) => c.tabIndex === 0)).toHaveLength(1);

    await user.tab();
    expect(casillas[0]).toHaveFocus();
    await user.keyboard('{ArrowDown}');
    expect(casillas[1]).toHaveFocus();
    await user.keyboard(' ');
    expect(p.onToggle).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Medicamento 4' }));
    await user.keyboard('n');
    expect(p.onNoTomada).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Medicamento 4' }));
    await user.keyboard('{Enter}');
    expect(p.onMarcarTodo).toHaveBeenCalledTimes(1);
    await user.keyboard('{End}');
    expect(casillas[3]).toHaveFocus();
    await user.keyboard('n'); // una pastilla ya registrada no se puede marcar como no tomada
    expect(p.onNoTomada).toHaveBeenCalledTimes(1);
  });

  it('los estados se leen con texto, no solo con color', () => {
    montar();
    expect(screen.getByRole('checkbox', { name: /Medicamento 1.*Tomada 8:15/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Medicamento 3.*No tomada/ })).not.toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Medicamento 2, para memoria.*Pendiente/ })).not.toBeChecked();
    expect(screen.getByText('Tomada 8:15')).toBeInTheDocument();
    expect(screen.getByText('No tomada')).toBeInTheDocument();
    expect(screen.getByText('Avisos: 8:00, 10:00 y 12:00')).toBeInTheDocument();
  });

  it('21. los botones principales llaman a sus acciones', async () => {
    const user = userEvent.setup();
    const p = montar();
    await user.click(screen.getByRole('button', { name: /Marcar todo el bloque/ }));
    await user.click(screen.getByRole('button', { name: /Terminar bloque/ }));
    await user.click(screen.getAllByRole('button', { name: /No la tomó/ })[0]);
    await user.click(screen.getByRole('checkbox', { name: /Medicamento 4/ }));
    expect(p.onMarcarTodo).toHaveBeenCalled();
    expect(p.onTerminar).toHaveBeenCalled();
    expect(p.onNoTomada).toHaveBeenCalledWith(expect.objectContaining({ nombre: 'Medicamento 2' }));
    expect(p.onToggle).toHaveBeenCalledTimes(1); // "No la tomó" no marca la casilla
  });

  it('una pastilla pendiente después del cierre se indica, sin mostrarse como tomada', () => {
    render(
      <BloqueCard
        bloque={bloque({ fase: 'terminado', items: [item({ planItemId: 1, nombre: 'Medicamento 5' })] })}
        ocupados={new Set()}
        ocupadoBloque={false}
        onToggle={vi.fn()}
        onNoTomada={vi.fn()}
        onMarcarTodo={vi.fn()}
        onTerminar={vi.fn()}
      />,
    );
    expect(screen.getByText(/horario terminado/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /Medicamento 5/ })).not.toBeChecked();
  });
});
