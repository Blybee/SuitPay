import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { PanelCompras } from '../../../src/features/compras/panel-compras.tsx'
import {
  extraerPreciosCompraFn,
  leerTiposDeCambioFn,
} from '../../../src/features/compras/compras.funciones.ts'

vi.mock('../../../src/features/compras/compras.funciones.ts', () => ({
  extraerPreciosCompraFn: vi.fn(),
  aplicarPreciosCompraFn: vi.fn(),
  leerTiposDeCambioFn: vi.fn(),
}))

describe('PanelCompras', () => {
  it('muestra el dropzone de facturas', () => {
    render(<PanelCompras puedeEscribir deshabilitado={false} productos={[]} />)
    expect(screen.getByText('Compras')).toBeTruthy()
    expect(screen.getByText('Facturas PDF o imagen')).toBeTruthy()
    expect(
      screen.getByText(
        'El archivo no se guarda. El modelo propone costos; tú confirmas.',
      ),
    ).toBeTruthy()
  })

  it('muestra la fila en dólares con el tipo de cambio de la orden', async () => {
    const usuario = userEvent.setup()
    vi.mocked(extraerPreciosCompraFn).mockResolvedValue({
      ok: true,
      boceto: {
        modelo: 'orden-pdf',
        coincidencias: [
          {
            codigo: 'JL-9000',
            etiquetaFactura: 'CODO',
            moneda: 'USD',
            precioOriginal: '1.3200',
            precioCompraEn: '2026-09-30',
          },
          {
            codigo: 'JL-27000',
            etiquetaFactura: 'UNION',
            moneda: 'USD',
            precioOriginal: '1.0550',
            precioCompraEn: '2026-09-30',
          },
        ],
        sinMatch: [],
      },
    })
    vi.mocked(leerTiposDeCambioFn).mockResolvedValue({
      ok: true,
      tipos: [
        { fecha: '2026-09-30', venta: 3.45, fechaPublicada: '2026-09-30' },
      ],
      fallos: [],
    })
    render(
      <PanelCompras
        puedeEscribir
        deshabilitado={false}
        productos={[
          {
            codigo: 'JL-9000',
            descripcion: 'CODO',
            unidad: 'NIU',
            precio: 100,
            activo: true,
            marca: '',
          },
        ]}
      />,
    )
    const archivo = new File(['%PDF'], 'orden.pdf', { type: 'application/pdf' })
    await usuario.upload(
      screen.getByLabelText('Facturas PDF o imagen'),
      archivo,
    )
    expect(await screen.findByText('= S/ 4.55')).toBeTruthy()
    expect(screen.getByText('= S/ 3.64')).toBeTruthy()
    expect(screen.getByLabelText('Precio en dólares de JL-9000')).toHaveValue(
      '1.3200',
    )
    expect(
      screen.getAllByLabelText('Tipo de cambio 30/09/2026')[0],
    ).toHaveValue('3.450')
    await usuario.clear(
      screen.getAllByLabelText('Tipo de cambio 30/09/2026')[0]!,
    )
    expect(screen.getByRole('button', { name: 'Confirmar' })).toBeDisabled()
  })
})
