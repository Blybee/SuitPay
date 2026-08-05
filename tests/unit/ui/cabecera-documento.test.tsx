import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CabeceraDocumento } from '../../../src/ui/componentes/CabeceraDocumento.tsx'

const base = {
  serie: 'B001' as string | null,
  cliente: null,
  onElegirCliente: vi.fn(),
  onQuitarCliente: vi.fn(),
  onCambiarTipo: vi.fn(),
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
        tipo="factura"
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
        tipo="boleta"
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

  it('no muestra campo de documento en nota de venta', () => {
    render(<CabeceraDocumento {...base} tipo="nota_venta" serie={null} />)

    expect(screen.queryByLabelText('RUC del cliente')).not.toBeInTheDocument()
    expect(screen.queryByLabelText('DNI del cliente')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Identificar cliente/i }),
    ).toBeInTheDocument()
  })
})
