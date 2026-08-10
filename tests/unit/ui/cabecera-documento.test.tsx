import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CabeceraDocumento,
  mensajeValidacionCampo,
} from '../../../src/ui/componentes/CabeceraDocumento.tsx'

const series = { boleta: 'B001', factura: 'F001' }

const base = {
  series,
  cliente: null,
  onAgregarClienteNuevo: vi.fn(),
  onQuitarCliente: vi.fn(),
  onCambiarModo: vi.fn(),
  total: 0,
  umbral: 70_000,
}

describe('mensajeValidacionCampo', () => {
  it('exige 8 / 11 dígitos o nombre ≥2', () => {
    expect(mensajeValidacionCampo('dni', '123')).not.toBeNull()
    expect(mensajeValidacionCampo('ruc', '2012345678')).not.toBeNull()
    expect(mensajeValidacionCampo('nombre', 'A')).not.toBeNull()
    expect(mensajeValidacionCampo('ruc', '20123456789')).toBeNull()
  })
})

describe('CabeceraDocumento — campo manual con Enter', () => {
  it('cotización arranca en Nombre', () => {
    render(<CabeceraDocumento {...base} modo="cotizacion" />)
    expect(screen.getByLabelText('Nombre del cliente')).toBeInTheDocument()
  })

  it('no busca al llegar a 8 dígitos; sí con Enter', async () => {
    const usuario = userEvent.setup()
    const onDocumentoCompleto = vi.fn()

    render(
      <CabeceraDocumento
        {...base}
        modo="boleta"
        onDocumentoCompleto={onDocumentoCompleto}
      />,
    )

    const campo = screen.getByLabelText('DNI del cliente')
    await usuario.type(campo, '12345678')
    expect(onDocumentoCompleto).not.toHaveBeenCalled()

    await usuario.keyboard('{Enter}')
    expect(onDocumentoCompleto).toHaveBeenCalledWith({
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
    })
  })

  it('marca borde inválido sin mensaje si Enter con RUC incompleto', async () => {
    const usuario = userEvent.setup()

    render(
      <CabeceraDocumento
        {...base}
        modo="factura"
        onDocumentoCompleto={vi.fn()}
      />,
    )

    const campo = screen.getByLabelText('RUC del cliente')
    await usuario.type(campo, '20123456')
    await usuario.keyboard('{Enter}')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByTestId('error-campo-cliente')).not.toBeInTheDocument()
  })

  it('permite 11 dígitos en RUC', async () => {
    const usuario = userEvent.setup()
    const onDocumentoCompleto = vi.fn()

    render(
      <CabeceraDocumento
        {...base}
        modo="cotizacion"
        onDocumentoCompleto={onDocumentoCompleto}
      />,
    )

    await usuario.click(screen.getByLabelText('Modo de campo siguiente'))
    await usuario.click(screen.getByLabelText('Modo de campo siguiente'))
    const campo = screen.getByLabelText('RUC del cliente')
    await usuario.type(campo, '20123456789')
    await usuario.keyboard('{Enter}')
    expect(onDocumentoCompleto).toHaveBeenCalledWith({
      tipoDocumento: 'RUC',
      numeroDocumento: '20123456789',
    })
  })

  it('el «+» abre buscar/agregar y no confirma el documento', async () => {
    const usuario = userEvent.setup()
    const onDocumentoCompleto = vi.fn()
    const onAgregarClienteNuevo = vi.fn()

    render(
      <CabeceraDocumento
        {...base}
        modo="boleta"
        onDocumentoCompleto={onDocumentoCompleto}
        onAgregarClienteNuevo={onAgregarClienteNuevo}
      />,
    )

    const campo = screen.getByLabelText('DNI del cliente')
    await usuario.type(campo, '12345678')
    await usuario.click(screen.getByLabelText('Buscar o agregar cliente'))
    expect(onAgregarClienteNuevo).toHaveBeenCalledOnce()
    expect(onDocumentoCompleto).not.toHaveBeenCalled()
  })
})
