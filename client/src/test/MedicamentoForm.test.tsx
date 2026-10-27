import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { MedicamentoForm } from '../components/MedicamentoForm';
import { ApiError } from '../services/http';

describe('MedicamentoForm (HU-04)', () => {
  it('22. muestra errores comprensibles y lleva el foco al campo', async () => {
    const user = userEvent.setup();
    const guardar = vi.fn();
    render(<MedicamentoForm onGuardar={guardar} onEditarExistente={vi.fn()} />);
    await user.click(screen.getByRole('button', { name: /Guardar medicamento/ }));
    expect(screen.getByText('Escriba el nombre del medicamento.')).toBeInTheDocument();
    expect(screen.getByText('Escriba la dosis. Por ejemplo: 1 pastilla.')).toBeInTheDocument();
    expect(screen.getByText('Elija el bloque: mañana o noche.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre del medicamento')).toHaveFocus();
    expect(screen.getByLabelText('Nombre del medicamento')).toHaveAttribute('aria-invalid', 'true');
    expect(guardar).not.toHaveBeenCalled();
  });

  it('contador de la etiqueta y límite de 25 caracteres con espacios', async () => {
    const user = userEvent.setup();
    const guardar = vi.fn();
    render(<MedicamentoForm onGuardar={guardar} onEditarExistente={vi.fn()} />);
    await user.type(screen.getByLabelText('Nombre del medicamento'), 'Medicamento 1');
    await user.type(screen.getByLabelText('Dosis'), '1 pastilla');
    await user.click(screen.getByLabelText(/Mañana/));
    await user.type(screen.getByLabelText(/Para qué es/), 'presión arterial muy altaX');
    expect(screen.getByText('26 de 25')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Guardar medicamento/ }));
    expect(screen.getByText(/La etiqueta puede tener hasta 25 letras/)).toBeInTheDocument();
    expect(guardar).not.toHaveBeenCalled();
    await user.type(screen.getByLabelText(/Para qué es/), '{Backspace}');
    await user.click(screen.getByRole('button', { name: /Guardar medicamento/ }));
    expect(guardar).toHaveBeenCalledWith({ nombre: 'Medicamento 1', dosis: '1 pastilla', bloque: 'manana', etiqueta: 'presión arterial muy alta' });
  });

  it('repetido en el bloque: muestra el mensaje y ofrece "Editar el existente"', async () => {
    const user = userEvent.setup();
    const editar = vi.fn();
    const guardar = vi.fn().mockRejectedValue(
      new ApiError(409, 'MEDICAMENTO_REPETIDO', 'Este medicamento ya está en el bloque de la mañana.', {
        nombre: 'Este medicamento ya está en el bloque de la mañana.',
      }, { existenteId: 7 }),
    );
    render(<MedicamentoForm onGuardar={guardar} onEditarExistente={editar} />);
    await user.type(screen.getByLabelText('Nombre del medicamento'), 'Medicamento 1');
    await user.type(screen.getByLabelText('Dosis'), '1');
    await user.click(screen.getByLabelText(/Mañana/));
    await user.click(screen.getByRole('button', { name: /Guardar medicamento/ }));
    expect(await screen.findByText('Este medicamento ya está en el bloque de la mañana.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar el existente' }));
    expect(editar).toHaveBeenCalledWith(7);
  });
});
