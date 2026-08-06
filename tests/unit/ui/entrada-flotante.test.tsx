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
        name: 'Minimizar resultados de búsqueda',
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
})
