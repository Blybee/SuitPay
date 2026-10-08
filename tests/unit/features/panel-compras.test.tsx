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
    const archivo = new File(['%PDF'], 'orden-compra_2136.pdf', {
      type: 'application/pdf',
    })
    await usuario.upload(
      screen.getByLabelText('Facturas PDF o imagen'),
      archivo,
    )
    expect(await screen.findByText('OC 2136')).toBeTruthy()
    expect(await screen.findByText('4.55')).toBeTruthy()
    expect(screen.getByText('3.64')).toBeTruthy()
    expect(
      screen.getByRole('columnheader', { name: 'Precio US$' }),
    ).toBeTruthy()
    expect(screen.getByLabelText('Precio en dólares de JL-9000')).toHaveValue(
      '1.3200',
    )
    const tipo = screen.getByLabelText('Tipo de cambio SUNAT de OC 2136')
    expect(tipo).toHaveValue('3.450')
    expect(screen.getAllByLabelText(/Tipo de cambio SUNAT/)).toHaveLength(1)
    expect(
      screen.queryByLabelText('Precio en dólares de JL-27000'),
    ).toBeTruthy()
    await usuario.clear(tipo)
    expect(
      screen.getByRole('button', { name: 'Guardar 2 precios' }),
    ).toBeDisabled()
  })

  it('una orden en soles solo edita el costo en la columna S/', async () => {
    const usuario = userEvent.setup()
    vi.mocked(extraerPreciosCompraFn).mockResolvedValue({
      ok: true,
      boceto: {
        modelo: 'orden-pdf',
        coincidencias: [
          {
            codigo: 'TUB-PVC-12',
            etiquetaFactura: 'TUBO',
            precioCompraCentimos: 1250,
            precioCompraEn: '2026-09-30',
          },
        ],
        sinMatch: [],
      },
    })
    render(<PanelCompras puedeEscribir deshabilitado={false} productos={[]} />)
    await usuario.upload(
      screen.getByLabelText('Facturas PDF o imagen'),
      new File(['%PDF'], 'orden-soles.pdf', { type: 'application/pdf' }),
    )
    expect(await screen.findByText('OC 1')).toBeTruthy()
    expect(screen.getByLabelText('Fecha de OC 1')).toHaveValue('2026-09-30')
    expect(screen.queryByLabelText(/Tipo de cambio SUNAT/)).toBeNull()
    expect(screen.queryByLabelText(/Precio en dólares/)).toBeNull()
    expect(screen.getByLabelText('Costo en soles de TUB-PVC-12')).toHaveValue(
      '12.50',
    )
    expect(
      screen.getByRole('button', { name: 'Guardar 1 precio' }),
    ).toBeEnabled()
  })

  it('cada orden tiene su fecha y su tipo de cambio', async () => {
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
            grupo: 0,
          },
          {
            codigo: 'TUB-PVC-12',
            etiquetaFactura: 'TUBO',
            precioCompraCentimos: 800,
            precioCompraEn: '2026-10-01',
            grupo: 1,
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
    render(<PanelCompras puedeEscribir deshabilitado={false} productos={[]} />)
    await usuario.upload(screen.getByLabelText('Facturas PDF o imagen'), [
      new File(['%PDF'], 'orden-compra_2136.pdf', { type: 'application/pdf' }),
      new File(['%PDF'], 'orden-soles_88.pdf', { type: 'application/pdf' }),
    ])
    expect(await screen.findByText('OC 2136')).toBeTruthy()
    expect(screen.getByText('OC 88')).toBeTruthy()
    expect(screen.getByLabelText('Fecha de OC 2136')).toHaveValue('2026-09-30')
    expect(screen.getByLabelText('Fecha de OC 88')).toHaveValue('2026-10-01')
    expect(screen.getAllByLabelText(/Tipo de cambio SUNAT/)).toHaveLength(1)
    expect(await screen.findByText('4.55')).toBeTruthy()
    expect(screen.getByLabelText('Costo en soles de TUB-PVC-12')).toHaveValue(
      '8.00',
    )
  })
})
