import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PieTotal } from '../../../src/ui/componentes/PieTotal.tsx'

const propsBase = {
  total: 1_250,
  medioPago: 'efectivo',
  onCambiarMedioPago: () => undefined,
  estado: 'listo' as const,
  motivoDeBloqueo: null,
  onEmitir: () => undefined,
}

describe('PieTotal', () => {
  it('el icon button de cámara dispara onCapturarLista', async () => {
    const usuario = userEvent.setup()
    const onCapturarLista = vi.fn()
    render(
      <PieTotal
        {...propsBase}
        onCapturarLista={onCapturarLista}
        puedeCapturarLista
      />,
    )

    await usuario.click(
      screen.getByRole('button', { name: 'Capturar lista de productos' }),
    )
    expect(onCapturarLista).toHaveBeenCalledTimes(1)
  })

  it('deshabilita la cámara si no hay productos', () => {
    const onCapturarLista = vi.fn()
    render(
      <PieTotal
        {...propsBase}
        onCapturarLista={onCapturarLista}
        puedeCapturarLista={false}
      />,
    )

    expect(
      screen.getByRole('button', { name: 'Capturar lista de productos' }),
    ).toBeDisabled()
  })
})
