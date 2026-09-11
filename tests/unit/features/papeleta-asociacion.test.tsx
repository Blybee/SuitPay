import { describe, expect, it, vi, beforeAll, beforeEach } from 'vitest'
import { useState } from 'react'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  PapeletaDeGuia,
  mensajeDeErrorDeGuia,
} from '../../../src/features/guia/papeleta.tsx'
import {
  emitirGuiaFn,
  leerIndiceDeTransportistasFn,
} from '../../../src/features/guia/guia.funciones.ts'
import { reimprimir } from '../../../src/features/emision/reimprimir.ts'

vi.mock('sileo', () => ({
  sileo: { action: vi.fn() },
}))

vi.mock('../../../src/features/guia/guia.funciones.ts', () => ({
  emitirGuiaFn: vi.fn(),
  leerIndiceDeTransportistasFn: vi.fn(async () => ({
    ok: true,
    transportistas: [
      {
        numeroDocumento: '20601856213',
        denominacion: 'Empresa Expreso Trujillo E.I.R.L.',
      },
    ],
  })),
}))

vi.mock('../../../src/features/emision/precarga.ts', () => ({
  resolverYPrecargarPdf: vi.fn(async () => null),
}))

vi.mock('../../../src/features/emision/reimprimir.ts', () => ({
  reimprimir: vi.fn(async () => ({ ok: true, nombre: 'F001-1' })),
}))

vi.mock('../../../src/features/transportistas/transportistas.funciones.ts', () => ({
  consultarTransportistaFn: vi.fn(async () => ({ ok: true })),
  crearTransportistaFn: vi.fn(),
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
  Element.prototype.hasPointerCapture ??= () => false
  Element.prototype.setPointerCapture ??= () => undefined
  Element.prototype.releasePointerCapture ??= () => undefined
  Element.prototype.scrollIntoView ??= () => undefined
})

const lineas = [
  {
    codigo: 'TUB-1',
    descripcion: 'Tubo',
    unidad: 'UND',
    cantidad: 1,
    precio: 100,
  },
] as const

function renderPapeleta(
  extra: Partial<Parameters<typeof PapeletaDeGuia>[0]> = {},
) {
  const onCerrar = vi.fn()
  const onEmitida = vi.fn()
  render(
    <PapeletaDeGuia
      abierta
      onCerrar={onCerrar}
      cliente={{
        tipoDocumento: 'DNI',
        numeroDocumento: '12345678',
        denominacion: 'Ana Pérez',
      }}
      lineas={[...lineas]}
      comprobanteOrigenId="id-opaco-no-visible"
      etiquetaOrigen="Asociada a Boleta B001-00000042"
      onEmitida={onEmitida}
      onRechazoDefinitivo={vi.fn()}
      {...extra}
    />,
  )
  return { onCerrar, onEmitida }
}

describe('mensajeDeErrorDeGuia', () => {
  it('explica el rechazo sin filtrar el nombre del proveedor', () => {
    expect(mensajeDeErrorDeGuia({ codigo: 'emision_rechazada' })).toMatch(
      /serie T/,
    )
    expect(mensajeDeErrorDeGuia({ codigo: 'emision_rechazada' })).not.toMatch(
      /factpro|nubefact|sunat/i,
    )
  })

  it('respeta el mensaje de serie no configurada', () => {
    expect(
      mensajeDeErrorDeGuia({
        codigo: 'serie_no_configurada',
        mensaje: 'No tienes serie configurada para este tipo de documento.',
      }),
    ).toMatch(/serie/)
  })
})

describe('PapeletaDeGuia', () => {
  beforeEach(() => {
    vi.mocked(reimprimir).mockClear()
    vi.mocked(leerIndiceDeTransportistasFn).mockClear()
  })

  it('muestra serie-número del origen, no un id opaco', () => {
    renderPapeleta()

    expect(
      screen.getByText(/Asociada a Boleta B001-00000042/),
    ).toBeInTheDocument()
    expect(screen.queryByText(/id-opaco-no-visible/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Imprimir origen/i }),
    ).toBeInTheDocument()
  })

  it('usa placeholders en ubigeo y dirección, no valores de ejemplo', () => {
    renderPapeleta()

    const ubigeos = screen.getAllByPlaceholderText('150101')
    expect(ubigeos).toHaveLength(2)
    for (const campo of ubigeos) {
      expect(campo).toHaveValue('')
    }
    expect(
      screen.getAllByPlaceholderText('Av. Central 122 LIMA - LIMA - LIMA'),
    ).toHaveLength(2)
  })

  it('no cierra con clic en el dialog (sin light-dismiss)', () => {
    const { onCerrar } = renderPapeleta()

    const dialogo = screen.getByRole('dialog', { name: 'Guía de remisión' })
    expect(dialogo).toHaveAttribute('closedby', 'closerequest')
    fireEvent.click(dialogo)
    expect(onCerrar).not.toHaveBeenCalled()
  })

  it('imprime el origen con reimprimir del comprobante reutilizado', async () => {
    const usuario = userEvent.setup()
    renderPapeleta()

    await usuario.click(
      screen.getByRole('button', { name: /Imprimir origen/i }),
    )
    expect(reimprimir).toHaveBeenCalledWith('id-opaco-no-visible')
  })

  it('elige transportista sin apilar texto redundante', async () => {
    const usuario = userEvent.setup()
    renderPapeleta()

    const combo = await screen.findByRole('combobox', { name: 'Transportista' })
    await usuario.type(combo, 'Expreso')

    const opcion = await screen.findByRole('option', {
      name: /Empresa Expreso Trujillo/,
    })
    await usuario.click(opcion)

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.getByDisplayValue(
        'Empresa Expreso Trujillo E.I.R.L. · 20601856213',
      ),
    ).toBeInTheDocument()
    expect(
      screen.queryAllByText(/Empresa Expreso Trujillo E.I.R.L\. · 20601856213/),
    ).toHaveLength(0)
  })

  it('mantiene el rechazo en la papeleta aunque se persista el borrador', async () => {
    vi.mocked(emitirGuiaFn).mockResolvedValue({
      ok: false,
      error: { codigo: 'emision_rechazada', mensaje: 'rechazo' },
    })
    const usuario = userEvent.setup()

    function ConBorrador() {
      const [borrador, setBorrador] = useState<
        Parameters<typeof PapeletaDeGuia>[0]['borradorInicial']
      >(null)
      return (
        <PapeletaDeGuia
          abierta
          onCerrar={vi.fn()}
          cliente={{
            tipoDocumento: 'DNI',
            numeroDocumento: '12345678',
            denominacion: 'Ana Pérez',
          }}
          lineas={[...lineas]}
          comprobanteOrigenId="id-opaco-no-visible"
          etiquetaOrigen="Asociada a Boleta B001-00000042"
          onEmitida={vi.fn()}
          onRechazoDefinitivo={setBorrador}
          borradorInicial={borrador}
        />
      )
    }

    render(<ConBorrador />)

    const ubigeos = screen.getAllByPlaceholderText('150101')
    await usuario.type(ubigeos[0]!, '150101')
    await usuario.type(ubigeos[1]!, '150101')
    const direcciones = screen.getAllByPlaceholderText(
      'Av. Central 122 LIMA - LIMA - LIMA',
    )
    await usuario.type(direcciones[0]!, 'Av. Central 1')
    await usuario.type(direcciones[1]!, 'Av. Central 2')

    const combo = await screen.findByRole('combobox', { name: 'Transportista' })
    await usuario.type(combo, 'Expreso')
    await usuario.click(
      await screen.findByRole('option', { name: /Empresa Expreso Trujillo/ }),
    )

    await usuario.click(screen.getByRole('button', { name: /^Emitir$/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/serie T/)
    expect(
      screen.getByRole('dialog', { name: 'Guía de remisión' }),
    ).toBeInTheDocument()
  })

  it('abre el alta de transportista con el icon button y no cierra la papeleta', async () => {
    const usuario = userEvent.setup()
    const { onCerrar } = renderPapeleta()

    await usuario.click(
      screen.getByRole('button', { name: 'Crear transportista' }),
    )

    expect(
      screen.getByRole('dialog', { name: 'Crear transportista' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('dialog', { name: 'Guía de remisión' }),
    ).toBeInTheDocument()
    expect(onCerrar).not.toHaveBeenCalled()
  })
})
