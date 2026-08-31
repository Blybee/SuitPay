import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CuerpoPestana,
  PestanasMostrador,
} from '../../../src/ui/componentes/PestanasMostrador.tsx'

describe('PestanasMostrador workspaces', () => {
  it('el icon button vive dentro del chip de Pedido, no anidado en el tab', async () => {
    const usuario = userEvent.setup()
    const onSlot = vi.fn()
    const { rerender } = render(
      <PestanasMostrador
        activa="pedido"
        onCambiar={() => undefined}
        slotPedido={1}
        segundoAbierto={false}
        onSlotPedido={onSlot}
      />,
    )
    const mas = screen.getByRole('button', { name: 'Abrir segundo pedido' })
    const pedido = screen.getByRole('tab', { name: 'Pedido' })
    expect(mas.closest('[role="tab"]')).toBeNull()
    expect(mas.parentElement).toBe(pedido.parentElement)
    await usuario.click(mas)
    expect(onSlot).toHaveBeenCalledOnce()

    rerender(
      <PestanasMostrador
        activa="pedido"
        onCambiar={() => undefined}
        slotPedido={2}
        segundoAbierto
        onSlotPedido={onSlot}
      />,
    )
    expect(
      screen.getByRole('button', { name: 'Pedido 2, cambiar de workspace' }),
    ).toHaveTextContent('2')
  })
})

describe('CuerpoPestana', () => {
  it('Cotizaciones es un scrollport de página; Vecinos y Lista recortan', () => {
    const { rerender } = render(
      <CuerpoPestana id="cotizaciones" modo="pagina">
        <p>contenido</p>
      </CuerpoPestana>,
    )
    const cotizaciones = screen.getByTestId('cuerpo-pestana-cotizaciones')
    expect(cotizaciones.className).toMatch(/overflow-y-auto/)
    expect(cotizaciones.className).toMatch(/min-h-0/)
    expect(cotizaciones.className).toMatch(/flex-1/)

    rerender(
      <CuerpoPestana id="vecinos" modo="interno">
        <p>contenido</p>
      </CuerpoPestana>,
    )
    const vecinos = screen.getByTestId('cuerpo-pestana-vecinos')
    expect(vecinos.className).toMatch(/overflow-hidden/)
    expect(vecinos.className).toMatch(/min-h-0/)
    expect(vecinos.className).not.toMatch(/overflow-y-auto/)
  })
})
