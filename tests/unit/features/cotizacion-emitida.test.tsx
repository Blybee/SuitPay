import { describe, expect, it, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CotizacionEmitida } from '../../../src/features/cotizaciones/emitida.tsx'
import type { Cotizacion } from '../../../src/features/cotizaciones/tipos.ts'

vi.mock('../../../src/features/cotizaciones/pdf.ts', () => ({
  blobDePdfDeCotizacion: () => new Blob(['pdf'], { type: 'application/pdf' }),
  nombreDeArchivoDeCotizacion: (numero: number) => `cotizacion-${numero}`,
}))

function cotizacionDePrueba(): Cotizacion {
  return {
    id: 'cot-1',
    numero: 42,
    estado: 'pendiente',
    canal: 'general',
    aliasVecino: null,
    telefonoVecino: null,
    cliente: {
      tipoDocumento: 'RUC',
      numeroDocumento: '20123456789',
      denominacion: 'Ferretería Ejemplo',
    },
    lineas: [
      {
        codigo: 'C1',
        descripcion: 'Codo 1/2',
        unidad: 'NIU',
        cantidad: 2,
        precio: 150,
      },
    ],
    total: 300,
    creadoPor: 'u1',
    creadoEn: new Date('2026-09-12T12:00:00Z'),
    actualizadoEn: new Date('2026-09-12T12:00:00Z'),
    generacionPedido: 0,
    diaCivilLineas: null,
    totalDeudas: 0,
  }
}

beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  }
  if (typeof URL.createObjectURL !== 'function') {
    URL.createObjectURL = () => 'blob:cotizacion'
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    URL.revokeObjectURL = () => undefined
  }
})

describe('CotizacionEmitida', () => {
  it('muestra número, total y las mismas acciones que el comprobante emitido', async () => {
    const onCerrar = vi.fn()
    const usuario = userEvent.setup()

    render(
      <CotizacionEmitida cotizacion={cotizacionDePrueba()} onCerrar={onCerrar} />,
    )

    expect(
      screen.getByRole('heading', { name: 'Cotización emitida' }),
    ).toBeInTheDocument()
    expect(screen.getByText('#42')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Imprimir' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Guardar' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Compartir' })).toBeEnabled()

    await usuario.click(screen.getByRole('button', { name: 'Siguiente venta' }))
    expect(onCerrar).toHaveBeenCalledOnce()
  })
})
