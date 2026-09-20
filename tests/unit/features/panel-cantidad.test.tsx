import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PanelCantidad } from '../../../src/features/inventario/panel-cantidad.tsx'
import {
  escribirInventarioFn,
  leerInventarioFn,
} from '../../../src/features/inventario/inventario.funciones.ts'

vi.mock('../../../src/features/inventario/inventario.funciones.ts', () => ({
  leerInventarioFn: vi.fn(),
  escribirInventarioFn: vi.fn(),
}))

vi.mock('../../../src/features/inventario/consultar.ts', () => ({
  vaciarCacheInventario: vi.fn(),
}))

const leer = vi.mocked(leerInventarioFn)
const escribir = vi.mocked(escribirInventarioFn)

describe('PanelCantidad', () => {
  it('muestra precio de compra vacío y permite guardarlo sin cantidad', async () => {
    const usuario = userEvent.setup()
    leer.mockResolvedValue({ ok: true, existencia: null })
    escribir.mockResolvedValue({
      ok: true,
      existencia: {
        codigo: 'C1',
        maximo: 0,
        alerta: false,
        precioCompraCentimos: 1250,
        actualizadoPor: 'admin',
        actualizadoEn: new Date(),
      },
    })

    render(
      <PanelCantidad
        codigo="C1"
        descripcion="CODO"
        puedeEscribir
        onCerrar={() => undefined}
      />,
    )

    expect(
      await screen.findByText('Sin control de cantidad. Escribe un número para empezar.'),
    ).toBeTruthy()

    await usuario.type(screen.getByLabelText('Precio de compra'), '12.50')
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }))

    expect(escribir).toHaveBeenCalledWith({
      data: {
        codigo: 'C1',
        precioCompraCentimos: 1250,
        precioCompraEn: null,
      },
    })
  })
})
