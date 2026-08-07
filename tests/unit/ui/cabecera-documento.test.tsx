import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CabeceraDocumento } from '../../../src/ui/componentes/CabeceraDocumento.tsx'

const base = {
  serie: 'B001' as string | null,
  cliente: null,
  onAgregarClienteNuevo: vi.fn(),
  onQuitarCliente: vi.fn(),
  onCambiarModo: vi.fn(),
  total: 0,
  umbral: 70_000,
}

describe('CabeceraDocumento — documento inline', () => {
  it('muestra RUC en factura y dispara al completar 11 dígitos', async () => {
    const usuario = userEvent.setup()
    const onDocumentoCompleto = vi.fn()

    render(
      <CabeceraDocumento
        {...base}
        modo="factura"
        serie="F001"
        onDocumentoCompleto={onDocumentoCompleto}
      />,
    )

    const campo = screen.getByLabelText('RUC del cliente')
    expect(campo).toBeInTheDocument()
    expect(screen.queryByLabelText('DNI del cliente')).not.toBeInTheDocument()

    await usuario.type(campo, '20123456789')
    expect(onDocumentoCompleto).toHaveBeenCalledWith({
      tipoDocumento: 'RUC',
      numeroDocumento: '20123456789',
    })
  })

  it('muestra DNI en boleta y dispara al completar 8 dígitos', async () => {
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
    expect(campo).toBeInTheDocument()
    expect(screen.queryByLabelText('RUC del cliente')).not.toBeInTheDocument()

    await usuario.type(campo, '12345678')
    expect(onDocumentoCompleto).toHaveBeenCalledWith({
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
    })
  })

  it('icon-button de agregar sin texto; morph a Agregar si no registrado', async () => {
    const usuario = userEvent.setup()
    const onConsultar = vi.fn()

    const { rerender } = render(
      <CabeceraDocumento {...base} modo="nota_venta" serie={null} />,
    )

    expect(
      screen.getByRole('button', { name: /Agregar cliente nuevo/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Agregar')).not.toBeInTheDocument()

    rerender(
      <CabeceraDocumento
        {...base}
        modo="boleta"
        documentoNoRegistrado="12345678"
        onConsultarNoRegistrado={onConsultar}
      />,
    )

    const boton = screen.getByRole('button', {
      name: /Agregar cliente no registrado/i,
    })
    expect(screen.getByText('Agregar')).toBeInTheDocument()
    await usuario.click(boton)
    expect(onConsultar).toHaveBeenCalled()
  })

  it('muestra razón social y dirección para confirmar', () => {
    render(
      <CabeceraDocumento
        {...base}
        modo="factura"
        serie="F001"
        clienteParaConfirmar={{
          tipoDocumento: 'RUC',
          numeroDocumento: '20123456789',
          denominacion: 'FERRETERIA DEMO SAC',
          direccion: 'Av. Principal 123',
          origen: 'consulta',
        }}
        onConfirmarCliente={vi.fn()}
        onCancelarConfirmacion={vi.fn()}
      />,
    )

    expect(screen.getByTestId('confirmacion-cliente')).toBeInTheDocument()
    expect(screen.getByText('FERRETERIA DEMO SAC')).toBeInTheDocument()
    expect(screen.getByText('Av. Principal 123')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Confirmar/i })).toBeInTheDocument()
  })

  it('incluye Cotización en el selector', () => {
    render(<CabeceraDocumento {...base} modo="cotizacion" serie={null} />)
    expect(screen.getByText('Borrador')).toBeInTheDocument()
    expect(screen.getByLabelText('Tipo de documento')).toHaveValue('cotizacion')
  })
})
