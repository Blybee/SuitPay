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
})
