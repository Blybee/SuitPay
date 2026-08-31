import { describe, expect, it, vi, beforeAll } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PapeletaDeGuia } from '../../../src/features/guia/papeleta.tsx'

vi.mock('../../../src/features/guia/guia.funciones.ts', () => ({
  emitirGuiaFn: vi.fn(),
  leerIndiceDeTransportistasFn: vi.fn(async () => ({
    ok: true,
    transportistas: [],
  })),
}))

vi.mock('../../../src/features/emision/precarga.ts', () => ({
  resolverYPrecargarPdf: vi.fn(async () => null),
}))

beforeAll(() => {
  if (typeof HTMLDialogElement.prototype.showModal !== 'function') {
    HTMLDialogElement.prototype.showModal = function (this: HTMLDialogElement) {
      this.setAttribute('open', '')
    }
    HTMLDialogElement.prototype.close = function (this: HTMLDialogElement) {
      this.removeAttribute('open')
    }
  }
})

describe('PapeletaDeGuia — asociación visible', () => {
  it('muestra serie-número del origen, no un id opaco', () => {
    render(
      <PapeletaDeGuia
        abierta
        onCerrar={vi.fn()}
        cliente={{
          tipoDocumento: 'DNI',
          numeroDocumento: '12345678',
          denominacion: 'Ana Pérez',
        }}
        lineas={[
          {
            codigo: 'TUB-1',
            descripcion: 'Tubo',
            unidad: 'UND',
            cantidad: 1,
            precio: 100,
          },
        ]}
        comprobanteOrigenId="id-opaco-no-visible"
        etiquetaOrigen="Asociada a Boleta B001-00000042"
        onEmitida={vi.fn()}
        onRechazoDefinitivo={vi.fn()}
      />,
    )

    expect(
      screen.getByText(/Asociada a Boleta B001-00000042/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/id-opaco-no-visible/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Imprimir origen/i }),
    ).toBeInTheDocument()
  })
})
