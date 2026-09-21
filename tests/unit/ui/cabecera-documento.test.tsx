import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  CabeceraDocumento,
  clasificarEntradaCliente,
  etiquetaCortaDeModo,
  mensajeValidacionCampo,
  modoEncadenaGuia,
  sanitizarCampoCliente,
  tipoFiscalDeModo,
} from '../../../src/ui/componentes/CabeceraDocumento.tsx'

const series = {
  boleta: 'B001',
  factura: 'F001',
  guia: 'T001',
  notaVenta: '0000000001',
}

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
  it('cotización arranca sin conmutador, lista para nombre o documento', () => {
    render(<CabeceraDocumento {...base} modo="cotizacion" />)
    expect(
      screen.getByLabelText('DNI, RUC o nombre del cliente'),
    ).toHaveAttribute('placeholder', 'DNI, RUC o Nombre')
    expect(
      screen.queryByLabelText('Modo de campo siguiente'),
    ).not.toBeInTheDocument()
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

    const campo = screen.getByLabelText('DNI o nombre del cliente')
    expect(campo).toHaveAttribute('placeholder', 'DNI o Nombre')
    await usuario.type(campo, '12345678')
    expect(onDocumentoCompleto).not.toHaveBeenCalled()

    await usuario.keyboard('{Enter}')
    expect(onDocumentoCompleto).toHaveBeenCalledWith({
      tipoDocumento: 'DNI',
      numeroDocumento: '12345678',
    })
  })

  it('en boleta un nombre confirma con Enter y muestra Usar', async () => {
    const usuario = userEvent.setup()
    const onNombreListo = vi.fn()

    render(
      <CabeceraDocumento
        {...base}
        modo="boleta"
        onNombreListo={onNombreListo}
      />,
    )

    const campo = screen.getByLabelText('DNI o nombre del cliente')
    await usuario.type(campo, 'Maria Perez')
    expect(screen.getByLabelText('Usar nombre del cliente')).toBeInTheDocument()
    await usuario.keyboard('{Enter}')
    expect(onNombreListo).toHaveBeenCalledWith('Maria Perez')
  })

  it('en boleta recorta a 8 dígitos y no deja letras mezcladas en el documento', async () => {
    const usuario = userEvent.setup()

    render(<CabeceraDocumento {...base} modo="boleta" />)
    const campo = screen.getByLabelText('DNI o nombre del cliente')
    await usuario.type(campo, '123456789')
    expect(campo).toHaveValue('12345678')
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
    expect(campo).toHaveAttribute('placeholder', 'RUC')
    expect(screen.queryByText('RUC', { selector: 'label' })).not.toBeInTheDocument()
    await usuario.type(campo, '20123456')
    await usuario.keyboard('{Enter}')
    expect(campo).toHaveAttribute('aria-invalid', 'true')
    expect(screen.queryByTestId('error-campo-cliente')).not.toBeInTheDocument()
  })

  it('permite 11 dígitos en RUC desde cotización, sin conmutador', async () => {
    const usuario = userEvent.setup()
    const onDocumentoCompleto = vi.fn()

    render(
      <CabeceraDocumento
        {...base}
        modo="cotizacion"
        onDocumentoCompleto={onDocumentoCompleto}
      />,
    )

    const campo = screen.getByLabelText('DNI, RUC o nombre del cliente')
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

    const campo = screen.getByLabelText('DNI o nombre del cliente')
    await usuario.type(campo, '12345678')
    await usuario.click(screen.getByLabelText('Buscar o agregar cliente'))
    expect(onAgregarClienteNuevo).toHaveBeenCalledOnce()
    expect(onDocumentoCompleto).not.toHaveBeenCalled()
  })
})

describe('clasificarEntradaCliente y sanitizarCampoCliente', () => {
  it('boleta: dígitos = DNI (máx 8); letras = nombre', () => {
    expect(clasificarEntradaCliente('boleta', '12345678')).toBe('dni')
    expect(clasificarEntradaCliente('boleta', 'Ana')).toBe('nombre')
    expect(sanitizarCampoCliente('boleta', '123456789')).toBe('12345678')
    expect(sanitizarCampoCliente('boleta', 'Ana Lopez')).toBe('Ana Lopez')
  })

  it('factura: solo RUC de 11 dígitos', () => {
    expect(clasificarEntradaCliente('factura', '')).toBe('ruc')
    expect(sanitizarCampoCliente('factura', '20abc12345678999')).toBe(
      '20123456789',
    )
  })
})

describe('modos compuestos Bol/Fact + Guía R', () => {
  it('tipoFiscalDeModo no inventa un tipo fiscal', () => {
    expect(tipoFiscalDeModo('boleta_guia')).toBe('boleta')
    expect(tipoFiscalDeModo('factura_guia')).toBe('factura')
    expect(modoEncadenaGuia('boleta_guia')).toBe(true)
    expect(modoEncadenaGuia('boleta')).toBe(false)
  })

  it('muestra Bol + Guía R y Fact + Guía R en el trigger según el modo', () => {
    const { rerender } = render(
      <CabeceraDocumento {...base} modo="boleta_guia" />,
    )
    expect(screen.getByLabelText('Tipo de documento')).toHaveTextContent(
      'Bol + Guía R · B001',
    )
    rerender(<CabeceraDocumento {...base} modo="factura_guia" />)
    expect(screen.getByLabelText('Tipo de documento')).toHaveTextContent(
      'Fact + Guía R · F001',
    )
  })

  it('nota de venta no muestra el correlativo en el trigger', () => {
    render(<CabeceraDocumento {...base} modo="nota_venta" />)
    expect(screen.getByLabelText('Tipo de documento')).toHaveTextContent(
      'Nota de venta',
    )
    expect(screen.getByLabelText('Tipo de documento')).not.toHaveTextContent(
      '0000000001',
    )
  })
})

describe('etiquetaCortaDeModo — trigger móvil sin serie', () => {
  it('abrevia cada modo sin incluir la serie', () => {
    expect(etiquetaCortaDeModo('boleta')).toBe('Bol')
    expect(etiquetaCortaDeModo('factura')).toBe('Fact')
    expect(etiquetaCortaDeModo('nota_venta')).toBe('Nota')
    expect(etiquetaCortaDeModo('cotizacion')).toBe('Coti')
    expect(etiquetaCortaDeModo('boleta_guia')).toBe('Bol + GR')
    expect(etiquetaCortaDeModo('factura_guia')).toBe('Fact + GR')
  })

  it('el trigger lleva la abreviatura y la etiqueta larga, nunca la serie en la corta', () => {
    const seriesVacias = {
      boleta: null,
      factura: null,
      guia: null,
      notaVenta: null,
    }
    const { rerender } = render(
      <CabeceraDocumento {...base} series={seriesVacias} modo="factura" />,
    )
    const trigger = screen.getByLabelText('Tipo de documento')
    expect(trigger).toHaveTextContent('Fact')
    expect(trigger).toHaveTextContent('Factura · sin asignar')
    expect(screen.getByText('Fact')).toHaveClass('md:hidden')
    expect(screen.getByText('Factura · sin asignar')).toHaveClass(
      'hidden',
      'md:inline',
    )

    rerender(
      <CabeceraDocumento {...base} series={seriesVacias} modo="boleta" />,
    )
    expect(screen.getByText('Bol')).toHaveClass('md:hidden')
    expect(screen.getByText('Boleta · sin asignar')).toHaveClass(
      'hidden',
      'md:inline',
    )
  })
})
