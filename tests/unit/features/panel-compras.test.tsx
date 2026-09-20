import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PanelCompras } from '../../../src/features/compras/panel-compras.tsx'

vi.mock('../../../src/features/compras/compras.funciones.ts', () => ({
  extraerPreciosCompraFn: vi.fn(),
  aplicarPreciosCompraFn: vi.fn(),
}))

describe('PanelCompras', () => {
  it('muestra el dropzone de facturas', () => {
    render(
      <PanelCompras puedeEscribir deshabilitado={false} productos={[]} />,
    )
    expect(screen.getByText('Compras')).toBeTruthy()
    expect(screen.getByText('Facturas PDF o imagen')).toBeTruthy()
    expect(
      screen.getByText(
        'El archivo no se guarda. El modelo propone costos; tú confirmas.',
      ),
    ).toBeTruthy()
  })
})
