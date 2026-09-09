import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Entrada } from '../../../src/ui/componentes/Entrada.tsx'
import type {
  ProductoBuscable,
  ResultadoDeBusqueda,
} from '../../../src/domain/busqueda/productos.ts'

const producto: ProductoBuscable = {
  codigo: 'P-1',
  descripcion: 'Valvula FV cromada',
  unidad: 'UND',
  precio: 1250,
  activo: true,
}

const productoB: ProductoBuscable = {
  codigo: 'P-2',
  descripcion: 'Valvula check bronce',
  unidad: 'UND',
  precio: 900,
  activo: true,
}

function resultadoCon(
  termino: string,
  coincidencias: readonly ProductoBuscable[],
): ResultadoDeBusqueda<ProductoBuscable> {
  return {
    termino,
    coincidencias: coincidencias.map((elemento) => ({
      elemento,
      grado: 'exacta' as const,
      distancia: 0,
    })),
    sinCoincidencias: coincidencias.length === 0,
    soloAproximadas: false,
  }
}

describe('Entrada — panel flotante', () => {
  it('muestra resultados y los minimiza / restaura con el ojo', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()
    const onElegirProducto = vi.fn()

    render(
      <Entrada
        termino="valvula"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('valvula', [producto])}
        onElegirProducto={onElegirProducto}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    expect(screen.getByRole('listbox')).toBeInTheDocument()
    expect(screen.getByText('Valvula FV cromada')).toHaveClass('uppercase')

    await usuario.click(
      screen.getByRole('button', {
        name: 'Ocultar resultados de búsqueda',
      }),
    )

    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Mostrar resultados de búsqueda' }),
    ).toBeInTheDocument()

    await usuario.click(
      screen.getByRole('button', { name: 'Mostrar resultados de búsqueda' }),
    )
    expect(screen.getByRole('listbox')).toBeInTheDocument()

    await usuario.click(
      screen.getByRole('button', { name: /Valvula FV cromada/i }),
    )
    expect(onElegirProducto).toHaveBeenCalledWith(producto)
    expect(onTerminoCambia).toHaveBeenCalledWith('')
  })

  it('deja que Space escriba un espacio y no marque la casilla', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()

    render(
      <Entrada
        termino="val"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('val', [producto])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    screen.getByRole('combobox').focus()
    await usuario.keyboard(' ')

    expect(onTerminoCambia).toHaveBeenCalledWith('val ')
    expect(
      screen.getByRole('checkbox', { name: /Seleccionar Valvula FV cromada/i }),
    ).not.toBeChecked()
  })

  it('permite multi-select y agrega el lote con «Agregar X productos»', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()
    const onElegirProducto = vi.fn()
    const onElegirProductos = vi.fn()

    render(
      <Entrada
        termino="valvula"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('valvula', [producto, productoB])}
        onElegirProducto={onElegirProducto}
        onElegirProductos={onElegirProductos}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    await usuario.click(
      screen.getByRole('checkbox', { name: /Seleccionar Valvula FV cromada/i }),
    )
    await usuario.click(
      screen.getByRole('checkbox', {
        name: /Seleccionar Valvula check bronce/i,
      }),
    )

    expect(
      screen.getByRole('button', { name: 'Agregar 2 productos' }),
    ).toBeInTheDocument()

    await usuario.click(
      screen.getByRole('button', { name: 'Agregar 2 productos' }),
    )

    expect(onElegirProductos).toHaveBeenCalledWith([producto, productoB])
    expect(onElegirProducto).not.toHaveBeenCalled()
    expect(onTerminoCambia).toHaveBeenCalledWith('')
  })

  it('no restaura al hacer clic en el campo vacío', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()

    render(
      <Entrada
        termino=""
        ultimaBusqueda="valvula"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    await usuario.click(screen.getByRole('combobox'))
    expect(onTerminoCambia).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('no restaura nada si no hay última búsqueda', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()

    render(
      <Entrada
        termino=""
        ultimaBusqueda=""
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    screen.getByRole('combobox').focus()
    await usuario.keyboard('{Enter}')
    expect(onTerminoCambia).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('no reabre el panel por el foco programático al elegir un producto', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()

    const { rerender } = render(
      <Entrada
        termino="valvula"
        ultimaBusqueda="valvula"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('valvula', [producto])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    await usuario.click(
      screen.getByRole('button', { name: /Valvula FV cromada/i }),
    )
    expect(onTerminoCambia).toHaveBeenCalledWith('')
    expect(onTerminoCambia).not.toHaveBeenCalledWith('valvula')

    rerender(
      <Entrada
        termino=""
        ultimaBusqueda="valvula"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
    expect(onTerminoCambia).not.toHaveBeenCalledWith('valvula')
  })

  it('restaura la última búsqueda al pulsar Enter en el campo vacío', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()

    render(
      <Entrada
        termino=""
        ultimaBusqueda="valvula"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    screen.getByRole('combobox').focus()
    await usuario.keyboard('{Enter}')
    expect(onTerminoCambia).toHaveBeenCalledWith('valvula')
  })

  it('no restaura al pulsar flecha abajo en el campo vacío', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()

    render(
      <Entrada
        termino=""
        ultimaBusqueda="valvula"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    screen.getByRole('combobox').focus()
    await usuario.keyboard('{ArrowDown}')
    expect(onTerminoCambia).not.toHaveBeenCalled()
  })

  it('no restaura un último término que era comando', async () => {
    const usuario = userEvent.setup()
    const onTerminoCambia = vi.fn()

    render(
      <Entrada
        termino=""
        ultimaBusqueda="/guia"
        onTerminoCambia={onTerminoCambia}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    screen.getByRole('combobox').focus()
    await usuario.keyboard('{Enter}')
    expect(onTerminoCambia).not.toHaveBeenCalled()
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })
})

describe('Entrada — cotizaciones encima de comandos', () => {
  it('pinta cotizaciones por encima de las pistas de /coti', () => {
    const cotizacion = {
      id: 'c1',
      numero: 5,
      estado: 'pendiente' as const,
      canal: 'general' as const,
      aliasVecino: null,
      cliente: {
        tipoDocumento: 'DNI',
        numeroDocumento: '1',
        denominacion: 'Cliente Test',
      },
      lineas: [
        {
          codigo: 'X',
          descripcion: 'Pieza',
          unidad: 'UND',
          cantidad: 1,
          precio: 900,
        },
      ],
      total: 900,
      creadoPor: 'v',
      creadoEn: new Date(0),
      actualizadoEn: null,
      telefonoVecino: null,
    }

    render(
      <Entrada
        termino="/coti test"
        onTerminoCambia={vi.fn()}
        resultado={resultadoCon('/coti test', [])}
        onElegirProducto={vi.fn()}
        onElegirCotizacion={vi.fn()}
        cotizacionesSugeridas={{
          termino: 'TEST',
          coincidencias: [
            { elemento: cotizacion, distancia: 0, grado: 'exacta' },
          ],
          sinCoincidencias: false,
          soloAproximadas: false,
        }}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    const opciones = screen.getAllByRole('option')
    expect(opciones[0]).toHaveTextContent('#5')
    expect(opciones[0]).toHaveTextContent('Cliente Test')
    expect(opciones.some((opcion) => opcion.textContent?.includes('/cotizacion'))).toBe(
      true,
    )
  })
})
