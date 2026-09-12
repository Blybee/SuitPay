import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { YaUsada } from '../../../src/features/cotizaciones/ya-usada.tsx'

describe('YaUsada', () => {
  it('ofrece Comprobantes y Nuevo pedido sin vaciar el aviso', async () => {
    const usuario = userEvent.setup()
    const onIrAComprobantes = vi.fn()
    const onNuevoPedido = vi.fn()
    render(
      <YaUsada
        mensaje="Esta cotización ya no existe: se convirtió o se quitó."
        onIrAComprobantes={onIrAComprobantes}
        onNuevoPedido={onNuevoPedido}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Volver' })).not.toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Comprobantes' }))
    expect(onIrAComprobantes).toHaveBeenCalledOnce()
    await usuario.click(screen.getByRole('button', { name: 'Nuevo pedido' }))
    expect(onNuevoPedido).toHaveBeenCalledOnce()
  })

  it('no muestra acciones cuando se usa como aviso de búsqueda', () => {
    render(<YaUsada mensaje="No se encontró esa cotización." />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
