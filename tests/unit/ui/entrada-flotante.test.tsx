import { describe, expect, it, vi, beforeAll } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Entrada } from '../../../src/ui/componentes/Entrada.tsx'
import type {
  ProductoBuscable,
  ResultadoDeBusqueda,
} from '../../../src/domain/busqueda/productos.ts'

beforeAll(() => {
  class ObservadorFalso {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  globalThis.ResizeObserver = ObservadorFalso as unknown as typeof ResizeObserver
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
    configurable: true,
    get() {
      return 384
    },
  })
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
    configurable: true,
    get() {
      return 640
    },
  })
})

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

  it('muestra el recuento de todas las coincidencias aunque virtualice el listbox', () => {
    const quince = Array.from({ length: 15 }, (_, i) => ({
      ...producto,
      codigo: `P-${i + 1}`,
      descripcion: `Valmax VALVULA MINI ${i + 1}`,
    }))

    render(
      <Entrada
        termino="valmax"
        onTerminoCambia={vi.fn()}
        resultado={resultadoCon('valmax', quince)}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    expect(screen.getByText('15 coincidencias')).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /P-1 · UND/ })).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeGreaterThan(0)
    expect(screen.getAllByRole('option').length).toBeLessThanOrEqual(15)
  })

  it('no monta las 90 filas del listbox; el recuento sigue siendo 90', () => {
    const noventa = Array.from({ length: 90 }, (_, i) => ({
      ...producto,
      codigo: `P-${i + 1}`,
      descripcion: `Valmax VALVULA MINI ${i + 1}`,
    }))

    render(
      <Entrada
        termino="valmax"
        onTerminoCambia={vi.fn()}
        resultado={resultadoCon('valmax', noventa)}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        enfocarAlMontar={false}
      />,
    )

    expect(screen.getByText('90 coincidencias')).toBeInTheDocument()
    expect(screen.getAllByRole('option').length).toBeLessThan(40)
    expect(
      screen.queryByRole('button', { name: /Valmax VALVULA MINI 90/i }),
    ).not.toBeInTheDocument()
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

describe('Entrada — menú de captura en móvil', () => {
  it('abre el kebab y dispara dictar / fotografiar', async () => {
    const usuario = userEvent.setup()
    const onDictar = vi.fn()
    const onFotografiar = vi.fn()

    render(
      <Entrada
        termino=""
        onTerminoCambia={vi.fn()}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible
        onDictar={onDictar}
        onFotografiar={onFotografiar}
        enfocarAlMontar={false}
      />,
    )

    await usuario.click(
      screen.getByRole('button', { name: 'Más formas de capturar' }),
    )

    const menu = screen.getByTestId('menu-captura-panel')
    await usuario.click(
      within(menu).getByRole('button', { name: 'Dictar el pedido' }),
    )
    expect(onDictar).toHaveBeenCalledOnce()

    await usuario.click(
      screen.getByRole('button', { name: 'Más formas de capturar' }),
    )
    await usuario.click(
      within(screen.getByTestId('menu-captura-panel')).getByRole('button', {
        name: 'Fotografiar el pedido',
      }),
    )
    expect(onFotografiar).toHaveBeenCalledOnce()
  })

  it('deja las acciones inertes si la asistencia no está disponible', async () => {
    const usuario = userEvent.setup()
    const onDictar = vi.fn()

    render(
      <Entrada
        termino=""
        onTerminoCambia={vi.fn()}
        resultado={resultadoCon('', [])}
        onElegirProducto={vi.fn()}
        asistenciaDisponible={false}
        motivoAsistenciaInerte="Asistencia caída"
        onDictar={onDictar}
        enfocarAlMontar={false}
      />,
    )

    await usuario.click(
      screen.getByRole('button', { name: 'Más formas de capturar' }),
    )

    const dictar = within(screen.getByTestId('menu-captura-panel')).getByRole(
      'button',
      { name: /Dictar el pedido/ },
    )
    expect(dictar).toBeDisabled()
    await usuario.click(dictar)
    expect(onDictar).not.toHaveBeenCalled()
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
      generacionPedido: 0,
      diaCivilLineas: null,
      totalDeudas: 0,
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
